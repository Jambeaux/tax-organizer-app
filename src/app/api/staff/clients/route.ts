import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isStaffEmail } from "@/lib/staff";

// Returns every signed-up client (i.e. every auth user who isn't staff),
// with name/status/is_business from their profile when available — for
// the "Create invoice" client picker and the staff account directory.
// Staff-only.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isStaffEmail(user.email)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: profiles } = await admin
    .from("profiles")
    .select("user_id, name, status, is_business");
  const profileByUserId = new Map((profiles ?? []).map((p) => [p.user_id, p]));

  const clients = data.users
    .filter((u) => !isStaffEmail(u.email))
    .map((u) => {
      const profile = profileByUserId.get(u.id);
      return {
        id: u.id,
        email: u.email,
        name: profile?.name ?? null,
        status: profile?.status ?? "pending",
        is_business: profile?.is_business ?? false,
      };
    });

  return NextResponse.json({ clients });
}
