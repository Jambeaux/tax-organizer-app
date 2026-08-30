import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendStaffNotification } from "@/lib/mail";

// Runs the client's own document upload server-side (still the
// request-scoped, RLS-bound client — a client can only ever write into
// their own "<userId>/..." folder, same as before) so we have a place to
// email staff on every successful upload.
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

  const storedName = `${Date.now()}_${file.name}`;
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
    text: `${who} just uploaded a document: ${file.name}\n\nView it in the staff dashboard or the client's Documents area.`,
  });

  return NextResponse.json({ ok: true, storedName });
}
