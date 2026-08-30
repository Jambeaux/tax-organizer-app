import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isStaffEmail } from "@/lib/staff";

// Every signature request across every client, newest first. Staff-only.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isStaffEmail(user.email)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const admin = createAdminClient();

  const { data: requests, error } = await admin
    .from("signature_requests")
    .select("id, user_id, document_name, status, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: usersData } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const emailByUserId = new Map(
    (usersData?.users ?? []).map((u) => [u.id, u.email ?? "Unknown"])
  );

  const { data: profiles } = await admin
    .from("profiles")
    .select("user_id, first_name, last_name");
  const profileByUserId = new Map((profiles ?? []).map((p) => [p.user_id, p]));

  const withClients = (requests ?? []).map((r) => {
    const profile = profileByUserId.get(r.user_id);
    return {
      ...r,
      client_email: emailByUserId.get(r.user_id) ?? "Unknown",
      client_first_name: profile?.first_name ?? null,
      client_last_name: profile?.last_name ?? null,
    };
  });

  return NextResponse.json({ signatureRequests: withClients });
}
