import { NextResponse } from "next/server";
import { Webhook } from "@signwell/node-sdk";
import { createAdminClient } from "@/lib/supabase/admin";

// SignWell posts here whenever a document's status changes. Register this
// URL (https://portal.jlbtax.com/api/sign/webhook) via SignWell's
// "Create Webhook" API call once — see README for the exact command —
// which returns a webhook ID. That ID (not the API key) is the HMAC
// secret used to verify these events; set it as SIGNWELL_WEBHOOK_ID.
//
// The signature_requests row itself is created synchronously in
// /api/staff/sign/request (SignWell hands back a real document ID right
// away, unlike Dropbox Sign's old "unclaimed draft" flow) — this webhook
// only updates that row's status as the document moves through its
// lifecycle: draft -> pending (once staff finishes the embedded editor
// and it's actually sent) -> signed (once the client completes it).
export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);

  const event = payload?.event as
    | { type?: string; time?: string | number; hash?: string }
    | undefined;

  if (!event?.hash || !event.time || !event.type) {
    console.warn("SignWell webhook: rejected — missing event verification fields.");
    return new Response("Missing event verification fields", { status: 400 });
  }

  const webhookId = process.env.SIGNWELL_WEBHOOK_ID;
  if (!webhookId) {
    console.error("SignWell webhook: SIGNWELL_WEBHOOK_ID is not configured.");
    return new Response("Webhook not configured", { status: 500 });
  }

  try {
    Webhook.verifyEventOrThrow({
      event,
      webhookId,
      toleranceSeconds: 300,
    });
  } catch (err) {
    console.warn("SignWell webhook: rejected — signature did not verify.", err);
    return new Response("Invalid signature", { status: 401 });
  }

  const documentId = (payload?.data?.object as { id?: string } | undefined)?.id;

  if (documentId) {
    const admin = createAdminClient();

    if (event.type === "document_sent") {
      await admin
        .from("signature_requests")
        .update({ status: "pending", updated_at: new Date().toISOString() })
        .eq("external_request_id", documentId);
    } else if (event.type === "document_completed") {
      await admin
        .from("signature_requests")
        .update({ status: "signed", updated_at: new Date().toISOString() })
        .eq("external_request_id", documentId);
    } else if (event.type === "document_declined") {
      await admin
        .from("signature_requests")
        .update({ status: "declined", updated_at: new Date().toISOString() })
        .eq("external_request_id", documentId);
    }
  }

  return new Response("OK", { status: 200 });
}
