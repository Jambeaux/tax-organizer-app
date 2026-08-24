import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isStaffEmail } from "@/lib/staff";

// Every client's business tax organizer, newest-updated first, with the
// client's name/email attached. Staff-only.
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
    .from("business_tax_organizer_responses")
    .select("id, user_id, status, responses, needs_attention, attention_notes, submitted_at, updated_at")
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: usersData } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const emailByUserId = new Map(
    (usersData?.users ?? []).map((u) => [u.id, u.email ?? "Unknown"])
  );

  const { data: profiles } = await admin.from("profiles").select("user_id, name");
  const nameByUserId = new Map((profiles ?? []).map((p) => [p.user_id, p.name]));

  const withEmails = (organizers ?? []).map((org) => ({
    ...org,
    client_email: emailByUserId.get(org.user_id) ?? "Unknown",
    client_name: nameByUserId.get(org.user_id) ?? null,
  }));

  return NextResponse.json({ organizers: withEmails });
}
