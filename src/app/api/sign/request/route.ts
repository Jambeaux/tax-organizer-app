import { NextResponse } from "next/server";
import * as DropboxSign from "@dropbox/sign";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";

// Sends an existing document (already sitting in the client's Storage
// folder) out for e-signature via Dropbox Sign, and logs the request so
// the dashboard can show its status.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { documentName } = await request.json();
  if (!documentName) {
    return NextResponse.json(
      { error: "documentName is required" },
      { status: 400 }
    );
  }

  // documentName comes straight from the request body — never trust it as
  // a filesystem path. It should only ever be a plain filename (the app
  // always generates these as `${Date.now()}_${originalName}`), so reject
  // anything that looks like it's trying to reference a different
  // directory before it gets anywhere near disk or storage.
  if (documentName.includes("/") || documentName.includes("\\") || documentName.includes("..")) {
    return NextResponse.json({ error: "Invalid documentName" }, { status: 400 });
  }

  const admin = createAdminClient();
  const storagePath = `${user.id}/${documentName}`;
  const { data: fileBlob, error: downloadError } = await admin.storage
  .from("documents")
  .download(storagePath);

  if (downloadError || !fileBlob) {
    return NextResponse.json(
      { error: downloadError?.message ?? "Could not read document" },
      { status: 404 }
    );
  }


const fileBuffer = Buffer.from(await fileBlob.arrayBuffer());
// Random name, not derived from user input — belt and suspenders on top
// of the documentName check above, so there's no path-traversal vector
// into where this temp file gets written.
const tmpPath = path.join(os.tmpdir(), crypto.randomUUID());
fs.writeFileSync(tmpPath, fileBuffer);
const fileStream = fs.createReadStream(tmpPath);

  const isLive = process.env.DROPBOX_SIGN_MODE === "live";
  const apiKey = isLive
    ? process.env.DROPBOX_SIGN_LIVE_KEY
    : process.env.DROPBOX_SIGN_TEST_KEY;

  const signatureRequestApi = new DropboxSign.SignatureRequestApi();
  signatureRequestApi.username = apiKey!;

  const displayName = documentName.replace(/^\d+_/, "");

  const sendRequest: DropboxSign.SignatureRequestSendRequest = {
    title: displayName,
    subject: `Please sign: ${displayName}`,
    message:
      "JLB Tax & Bookkeeping has sent you a document to review and sign.",
    signers: [
      {
        emailAddress: user.email!,
        name: user.email!,
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
    // Clean up the temp file regardless of outcome — Vercel wipes /tmp
    // between invocations anyway, but no reason to leave client document
    // bytes sitting on disk any longer than this request needs them.
    fs.unlink(tmpPath, () => {});
  }

  const dropboxSignRequestId =
    response.body.signatureRequest?.signatureRequestId;

  if (!dropboxSignRequestId) {
    return NextResponse.json(
      { error: "Dropbox Sign did not return a request id" },
      { status: 502 }
    );
  }

  const { data: row, error: insertError } = await admin
    .from("signature_requests")
    .insert({
      user_id: user.id,
      document_name: displayName,
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
