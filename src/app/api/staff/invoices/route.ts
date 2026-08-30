import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isStaffEmail } from "@/lib/staff";

async function requireStaff() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isStaffEmail(user.email)) {
    return null;
  }
  return user;
}

// Every invoice across every client, newest first, with the client's
// email attached so staff don't have to cross-reference user ids by
// hand. Staff-only.
export async function GET() {
  const staffUser = await requireStaff();
  if (!staffUser) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const admin = createAdminClient();

  const { data: invoices, error } = await admin
    .from("payment_requests")
    .select("id, user_id, description, amount_cents, status, created_at")
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

  const withEmails = (invoices ?? []).map((inv) => {
    const profile = profileByUserId.get(inv.user_id);
    return {
      ...inv,
      client_email: emailByUserId.get(inv.user_id) ?? "Unknown",
      client_first_name: profile?.first_name ?? null,
      client_last_name: profile?.last_name ?? null,
    };
  });

  return NextResponse.json({ invoices: withEmails });
}

// Creates a new invoice for a client — this is the replacement for
// inserting rows into payment_requests by hand in Supabase. Staff-only.
export async function POST(request: Request) {
  const staffUser = await requireStaff();
  if (!staffUser) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { clientUserId, description, amountCents } = await request.json();

  if (
    typeof clientUserId !== "string" ||
    !clientUserId ||
    typeof description !== "string" ||
    !description.trim() ||
    typeof amountCents !== "number" ||
    !Number.isInteger(amountCents) ||
    amountCents <= 0
  ) {
    return NextResponse.json(
      { error: "clientUserId, description, and a positive whole-cent amountCents are required" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { data: row, error } = await admin
    .from("payment_requests")
    .insert({
      user_id: clientUserId,
      description: description.trim(),
      amount_cents: amountCents,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ invoice: row });
}
