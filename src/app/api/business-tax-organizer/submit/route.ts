import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendStaffNotification } from "@/lib/mail";

// Same pattern as /api/tax-organizer/submit, for the business organizer.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { responses, needsAttention, attentionNotes } = body ?? {};

  if (!responses || typeof responses !== "object") {
    return NextResponse.json({ error: "responses is required" }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("business_tax_organizer_responses")
    .select("status")
    .eq("user_id", user.id)
    .maybeSingle();

  const wasAlreadySubmitted = existing?.status === "submitted";

  const { error } = await supabase.from("business_tax_organizer_responses").upsert(
    {
      user_id: user.id,
      responses,
      needs_attention: !!needsAttention,
      attention_notes: attentionNotes ?? "",
      status: "submitted",
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!wasAlreadySubmitted) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("first_name, last_name")
      .eq("user_id", user.id)
      .maybeSingle();

    const nameLabel = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ");
    const who = nameLabel ? `${nameLabel} (${user.email})` : user.email;

    await sendStaffNotification({
      subject: "New business tax organizer submitted",
      text: `${who} just submitted their business tax organizer for the first time.\n\nView it in the staff dashboard.`,
    });
  }

  return NextResponse.json({ ok: true });
}
