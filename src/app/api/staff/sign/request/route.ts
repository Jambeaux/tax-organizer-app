import { NextResponse } from "next/server";
import { Configuration, Embedded, Errors } from "@signwell/node-sdk";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isStaffEmail } from "@/lib/staff";
import { sanitizeFileName } from "@/lib/sanitizeFileName";

// Staff-only: uploads a document to a specific client's Storage folder,
// then creates a SignWell document in "draft" mode (Embedded Requesting)
// and hands back an embedded_edit_url. The staff member's browser opens
// that URL in SignWell's embedded editor, where they drag a signature/
// date field onto the document themselves before clicking "Continue" —
// that click is what actually sends it to the client.
//
// Unlike our previous Dropbox Sign integration, SignWell gives us a real
// document ID immediately (even while still a draft), so we record the
// signature_requests row here rather than waiting on a webhook. The
// webhook (src/app/api/sign/webhook/route.ts) only needs to update the
// row's status afterward (sent, signed).
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user: staffUser },
  } = await supabase.auth.getUser();

  if (!staffUser || !isStaffEmail(staffUser.email)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }
  if (!staffUser.email) {
    return NextResponse.json({ error: "Your account has no email on file" }, { status: 400 });
  }

  const formData = await request.formData();
  const clientUserId = formData.get("clientUserId");
  const file = formData.get("file");

  if (typeof clientUserId !== "string" || !clientUserId) {
    return NextResponse.json({ error: "clientUserId is required" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "A file is required" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Confirm this is a real, non-staff client before sending anything or
  // writing to storage on their behalf.
  const { data: targetUserData, error: targetError } = await admin.auth.admin.getUserById(
    clientUserId
  );
  const targetUser = targetUserData?.user;
  if (targetError || !targetUser) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }
  if (isStaffEmail(targetUser.email)) {
    return NextResponse.json(
      { error: "Can't send a signature request to a staff account" },
      { status: 400 }
    );
  }
  if (!targetUser.email) {
    return NextResponse.json({ error: "This client has no email on file" }, { status: 400 });
  }

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

  const { data: profile } = await admin
    .from("profiles")
    .select("name, first_name, last_name")
    .eq("user_id", clientUserId)
    .maybeSingle();
  const signerName = profile?.name || targetUser.email;

  const isLive = process.env.SIGNWELL_MODE === "live";
  const apiKey = process.env.SIGNWELL_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "SIGNWELL_API_KEY is not configured on the server" },
      { status: 500 }
    );
  }

  const configuration = new Configuration({ apiKey });

  let document;
  try {
    document = await Embedded.createRequestingDocument(
      {
        name: file.name,
        test_mode: !isLive,
        files: [{ name: file.name, file_base64: fileBuffer.toString("base64") }],
        recipients: [{ id: "1", name: signerName, email: targetUser.email }],
        subject: `Please sign: ${file.name}`,
        message: "JLB Tax & Bookkeeping has sent you a document to review and sign.",
        custom_requester_name: "JLB Tax & Bookkeeping",
        custom_requester_email: staffUser.email,
      },
      { configuration }
    );
  } catch (err) {
    // SignWell's SDK throws a proper ApiError with a real .body/.message —
    // unlike Dropbox Sign's generic wrapper, this should already be
    // diagnosable, but log it server-side too just in case.
    const apiError = err instanceof Errors.ApiError ? err : null;
    console.error(
      "SignWell createRequestingDocument failed:",
      apiError?.code,
      JSON.stringify(apiError?.body ?? err)
    );
    const message =
      (apiError?.body as { message?: string } | undefined)?.message ||
      apiError?.message ||
      (err instanceof Error ? err.message : "SignWell error");
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const embeddedEditUrl = document.embedded_edit_url;
  if (!embeddedEditUrl) {
    return NextResponse.json(
      { error: "SignWell did not return an editor link" },
      { status: 502 }
    );
  }

  const { error: insertError } = await admin.from("signature_requests").insert({
    user_id: clientUserId,
    document_name: file.name,
    external_request_id: document.id,
    status: "draft",
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ embeddedEditUrl });
}
