import { createAdminClient } from "@/lib/supabase/admin";

export type Profile = {
  user_id: string;
  email: string;
  name: string | null;
  phone: string | null;
  address: string | null;
  is_business: boolean;
  status: "pending" | "approved";
  created_at: string;
  updated_at: string;
};

// Server-side only (uses the service role key). Looks up this user's
// profile row, creating one if this is their first time logging in.
//
// A brand-new profile starts out 'pending' unless a staff member
// already created an invite for this exact email — in that case we
// auto-approve immediately and mark the invite used, so a client who
// was personally invited never sits in the approval queue.
export async function getOrCreateProfile(
  userId: string,
  email: string
): Promise<Profile> {
  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) return existing as Profile;

  const { data: invite } = await admin
    .from("invites")
    .select("*")
    .ilike("email", email)
    .is("used_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const status = invite ? "approved" : "pending";
  const name = invite?.name ?? null;

  const { data: created, error } = await admin
    .from("profiles")
    .insert({ user_id: userId, email, name, status })
    .select("*")
    .single();

  if (error) {
    // Fall back to a plain in-memory pending profile rather than crash
    // the dashboard if this insert ever fails for some reason (e.g. a
    // race between two tabs both creating the row at once) — the next
    // page load will pick up whichever row actually got created.
    return {
      user_id: userId,
      email,
      name,
      phone: null,
      address: null,
      is_business: false,
      status,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  if (invite) {
    await admin
      .from("invites")
      .update({ used_at: new Date().toISOString() })
      .eq("id", invite.id);
  }

  return created as Profile;
}
