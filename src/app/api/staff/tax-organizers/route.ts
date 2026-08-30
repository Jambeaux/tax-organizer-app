import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isStaffEmail } from "@/lib/staff";

// Every client's tax organizer, newest-updated first, with the client's
// email attached. Staff-only.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isStaffEmail(user.email)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const admin = createAdminClient();

  const { data: organizers, error } = await admin
    .from("tax_organizer_responses")
    .select("id, user_id, status, responses, needs_attention, attention_notes, submitted_at, updated_at")
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: usersData } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const emailByUserId = new Map(
    (usersData?.users ?? []).map((u) => [u.id, u.email ?? "Unknown"])
  );

  const { data: profiles } = await admin
    .from("profiles")
    .select("user_id, name, first_name, last_name");
  const profileByUserId = new Map((profiles ?? []).map((p) => [p.user_id, p]));

  const withEmails = (organizers ?? []).map((org) => {
    const profile = profileByUserId.get(org.user_id);
    return {
      ...org,
      client_email: emailByUserId.get(org.user_id) ?? "Unknown",
      client_name: profile?.name ?? null,
      client_first_name: profile?.first_name ?? null,
      client_last_name: profile?.last_name ?? null,
    };
  });

  return NextResponse.json({ organizers: withEmails });
}
