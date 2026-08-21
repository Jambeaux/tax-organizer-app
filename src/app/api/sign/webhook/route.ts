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
  const signatureRequest = payload.signature_request as
    | { signature_request_id?: string; is_complete?: boolean }
    | undefined;

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

  if (
    signatureRequest?.signature_request_id &&
    (event?.event_type === "signature_request_all_signed" ||
      signatureRequest.is_complete)
  ) {
    const admin = createAdminClient();
    await admin
      .from("signature_requests")
      .update({ status: "signed", updated_at: new Date().toISOString() })
      .eq("dropbox_sign_request_id", signatureRequest.signature_request_id);
  }

  return new Response("Hello API Event Received", { status: 200 });
}
