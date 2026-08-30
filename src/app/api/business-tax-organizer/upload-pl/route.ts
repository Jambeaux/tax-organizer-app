import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendStaffNotification } from "@/lib/mail";

// Same pattern as /api/documents/upload, for the business organizer's
// profit & loss statement upload — a second entry point into the same
// "documents" bucket, so it gets the same staff notification.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "A file is required" }, { status: 400 });
  }

  const storedName = `${Date.now()}_PL_${file.name}`;
  const fileBuffer = Buffer.from(await file.arrayBuffer());

  const { error } = await supabase.storage
    .from("documents")
    .upload(`${user.id}/${storedName}`, fileBuffer, {
      upsert: false,
      contentType: file.type || undefined,
    });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name")
    .eq("user_id", user.id)
    .maybeSingle();

  const nameLabel = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ");
  const who = nameLabel ? `${nameLabel} (${user.email})` : user.email;

  await sendStaffNotification({
    subject: "Client uploaded a document",
    text: `${who} just uploaded a profit & loss statement: ${file.name}\n\nView it in the staff dashboard or the client's Documents area.`,
  });

  return NextResponse.json({ ok: true, storedName });
}
