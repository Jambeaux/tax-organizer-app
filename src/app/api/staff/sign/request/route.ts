import { NextResponse } from "next/server";
import * as DropboxSign from "@dropbox/sign";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isStaffEmail } from "@/lib/staff";
import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";

// Staff-only: uploads a document to a specific client's Storage folder and
// sends it out for e-signature via Dropbox Sign, addressed to that client's
// own email — not the staff member's. This replaces the old client-side
// "request signature on my own upload" flow, which had the direction
// backwards (a client can't meaningfully send themselves something to sign).
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

  const storedName = `${Date.now()}_${file.name}`;
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

  // Random temp filename, not derived from the uploaded filename — same
  // belt-and-suspenders reasoning as the original client-facing route.
  const tmpPath = path.join(os.tmpdir(), crypto.randomUUID());
  fs.writeFileSync(tmpPath, fileBuffer);
  const fileStream = fs.createReadStream(tmpPath);

  const { data: profile } = await admin
    .from("profiles")
    .select("name")
    .eq("user_id", clientUserId)
    .maybeSingle();
  const signerName = profile?.name || targetUser.email;

  const isLive = process.env.DROPBOX_SIGN_MODE === "live";
  const apiKey = isLive
    ? process.env.DROPBOX_SIGN_LIVE_KEY
    : process.env.DROPBOX_SIGN_TEST_KEY;

  const signatureRequestApi = new DropboxSign.SignatureRequestApi();
  signatureRequestApi.username = apiKey!;

  const sendRequest: DropboxSign.SignatureRequestSendRequest = {
    title: file.name,
    subject: `Please sign: ${file.name}`,
    message: "JLB Tax & Bookkeeping has sent you a document to review and sign.",
    signers: [
      {
        emailAddress: targetUser.email,
        name: signerName,
      },
    ],
    files: [fileStream],
    testMode: !isLive,
  };

  let response;
  try {
    response = await signatureRequestApi.signatureRequestSend(sendRequest);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Dropbox Sign error";
    return NextResponse.json({ error: message }, { status: 502 });
  } finally {
    fs.unlink(tmpPath, () => {});
  }

  const dropboxSignRequestId = response.body.signatureRequest?.signatureRequestId;

  if (!dropboxSignRequestId) {
    return NextResponse.json(
      { error: "Dropbox Sign did not return a request id" },
      { status: 502 }
    );
  }

  const { data: row, error: insertError } = await admin
    .from("signature_requests")
    .insert({
      user_id: clientUserId,
      document_name: file.name,
      dropbox_sign_request_id: dropboxSignRequestId,
      status: "pending",
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ signatureRequest: row });
}
