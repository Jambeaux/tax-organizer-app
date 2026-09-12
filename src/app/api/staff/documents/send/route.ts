import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isStaffEmail } from "@/lib/staff";
import { sendClientNotification } from "@/lib/mail";
import { sanitizeFileName } from "@/lib/sanitizeFileName";

// Staff-only: uploads one or more plain (non-signature) documents to a
// specific client's Storage folder, tags each with a `documents` row
// (uploaded_by: "staff") so the per-client staff view can tell it apart
// from the client's own uploads, and emails the client to let them know
// something new is waiting for them. Distinct from
// /api/staff/sign/request, which is for documents that need a signature.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user: staffUser },
  } = await supabase.auth.getUser();

  if (!staffUser || !isStaffEmail(staffUser.email)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const formData = await request.formData();
  const clientUserId = formData.get("clientUserId");
  const note = formData.get("note");
  const files = formData.getAll("files").filter((f): f is File => f instanceof File);

  if (typeof clientUserId !== "string" || !clientUserId) {
    return NextResponse.json({ error: "clientUserId is required" }, { status: 400 });
  }
  if (files.length === 0) {
    return NextResponse.json({ error: "At least one file is required" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: targetUserData, error: targetError } = await admin.auth.admin.getUserById(
    clientUserId
  );
  const targetUser = targetUserData?.user;
  if (targetError || !targetUser) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }
  if (isStaffEmail(targetUser.email)) {
    return NextResponse.json(
      { error: "Can't send a document to a staff account" },
      { status: 400 }
    );
  }

  const sentFileNames: string[] = [];

  for (const file of files) {
    const storedName = `${Date.now()}_${sanitizeFileName(file.name)}`;
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await admin.storage
      .from("documents")
      .upload(`${clientUserId}/${storedName}`, fileBuffer, {
        upsert: false,
        contentType: file.type || undefined,
      });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { error: insertError } = await admin.from("documents").insert({
      user_id: clientUserId,
      file_name: storedName,
      original_name: file.name,
      uploaded_by: "staff",
      uploaded_by_email: staffUser.email,
      note: typeof note === "string" && note.trim() ? note.trim() : null,
    });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    sentFileNames.push(file.name);
  }

  if (targetUser.email) {
    const fileList = sentFileNames.map((n) => `- ${n}`).join("\n");
    await sendClientNotification({
      to: targetUser.email,
      subject: "JLB Tax & Bookkeeping sent you a document",
      text: `JLB Tax & Bookkeeping has sent you ${sentFileNames.length > 1 ? "documents" : "a document"} through your client portal:\n\n${fileList}${
        typeof note === "string" && note.trim() ? `\n\nMessage from JLB Tax:\n${note.trim()}` : ""
      }\n\nLog in to your account at ${
        process.env.NEXT_PUBLIC_SITE_URL || "https://portal.jlbtax.com"
      } and check your Documents area to view it.`,
    });
  }

  return NextResponse.json({ ok: true, sentCount: sentFileNames.length });
}
