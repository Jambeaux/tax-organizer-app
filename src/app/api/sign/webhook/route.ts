import { NextResponse } from "next/server";
import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

// Dropbox Sign posts here whenever a signature request's status changes.
// Configure this URL (https://portal.jlbtax.com/api/sign/webhook) under
// your Dropbox Sign API App settings once deployed.
//
// Signature verification is enforced below — requests with a missing or
// invalid event_hash are rejected before any data gets touched. Confirmed
// working against Dropbox Sign's own callback_test event.
//
// Since staff-initiated requests now go through Embedded Requesting
// (create an "unclaimed draft", staff places fields in Dropbox Sign's own
// editor, THEN it actually sends), we don't have a real
// dropbox_sign_request_id at the moment staff clicks "Send" — only once
// Dropbox Sign fires signature_request_sent here do we know the request
// actually exists. That's why the signature_requests row now gets
// created here instead of in the /api/staff/sign/request route.

type SignatureRequestPayload = {
  signature_request_id?: string;
  is_complete?: boolean;
  title?: string;
  signatures?: { signer_email_address?: string }[];
};

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  let payload: Record<string, unknown>;

  if (contentType.includes("application/json")) {
    payload = await request.json();
  } else {
    const form = await request.formData();
    const raw = form.get("json");
    payload = raw ? JSON.parse(raw.toString()) : {};
  }

  const event = payload.event as
    | { event_type?: string; event_time?: string; event_hash?: string }
    | undefined;
  const signatureRequest = payload.signature_request as SignatureRequestPayload | undefined;

  if (!event?.event_hash || !event.event_time || !event.event_type) {
    console.warn("Dropbox Sign webhook: rejected — missing event verification fields.");
    return new Response("Missing event verification fields", { status: 400 });
  }

  const isLive = process.env.DROPBOX_SIGN_MODE === "live";
  const apiKey = isLive
    ? process.env.DROPBOX_SIGN_LIVE_KEY
    : process.env.DROPBOX_SIGN_TEST_KEY;

  const expected = crypto
    .createHmac("sha256", apiKey!)
    .update(event.event_time + event.event_type)
    .digest("hex");

  if (expected !== event.event_hash) {
    console.warn("Dropbox Sign webhook: rejected — signature did not match.");
    return new Response("Invalid signature", { status: 401 });
  }

  if (event?.event_type === "callback_test") {
    return new Response("Hello API Event Received", { status: 200 });
  }

  const admin = createAdminClient();

  // A staff-initiated Embedded Requesting draft has just actually become
  // a real signature request — this is the first point we can record it.
  if (event?.event_type === "signature_request_sent" && signatureRequest?.signature_request_id) {
    const signerEmail = signatureRequest.signatures?.[0]?.signer_email_address;

    if (signerEmail) {
      const { data: usersData } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const matchedUser = usersData?.users.find(
        (u) => u.email?.toLowerCase() === signerEmail.toLowerCase()
      );

      if (matchedUser) {
        const { error: upsertError } = await admin.from("signature_requests").upsert(
          {
            user_id: matchedUser.id,
            document_name: signatureRequest.title || "Document",
            dropbox_sign_request_id: signatureRequest.signature_request_id,
            status: "pending",
          },
          { onConflict: "dropbox_sign_request_id" }
        );
        if (upsertError) {
          console.error("Dropbox Sign webhook: failed to record sent request:", upsertError);
        }
      } else {
        console.warn(
          "Dropbox Sign webhook: signature_request_sent for unknown signer email",
          signerEmail
        );
      }
    }
  }

  if (
    signatureRequest?.signature_request_id &&
    (event?.event_type === "signature_request_all_signed" ||
      signatureRequest.is_complete)
  ) {
    await admin
      .from("signature_requests")
      .update({ status: "signed", updated_at: new Date().toISOString() })
      .eq("dropbox_sign_request_id", signatureRequest.signature_request_id);
  }

  return new Response("Hello API Event Received", { status: 200 });
}
