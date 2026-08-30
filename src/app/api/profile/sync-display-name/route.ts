import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Self-service only: a signed-in user pushes their own "Last, First" name
// into Supabase Auth's user_metadata.full_name, which is what Supabase's
// own dashboard shows as "Display name" in the Users list. Updating Auth
// user metadata requires the service role key, so this can't happen
// directly from the browser — but it always targets the caller's own
// user id (taken from their session, never from the request body), so
// there's no way to use this to rename someone else's account.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const firstName = typeof body.firstName === "string" ? body.firstName.trim() : "";
  const lastName = typeof body.lastName === "string" ? body.lastName.trim() : "";

  if (!firstName && !lastName) {
    return NextResponse.json({ error: "firstName or lastName required" }, { status: 400 });
  }

  const displayName = [lastName, firstName].filter(Boolean).join(", ");

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(user.id, {
    user_metadata: { full_name: displayName },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
