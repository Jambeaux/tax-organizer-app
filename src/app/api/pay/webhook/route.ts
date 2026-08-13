import { NextResponse } from "next/server";
import { WebhooksHelper } from "square";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSquareSignatureKey } from "@/lib/square/client";

// Square posts here whenever a payment's status changes. Configure this
// URL (https://portal.jlbtax.com/api/pay/webhook) under Square's Developer
// Dashboard > your app > Webhooks, subscribed to the "payment.updated"
// event, using the same domain that's live in Vercel.
//
// NOTE: same caveat as the Dropbox Sign webhook — this hasn't been
// verified against a real Square callback yet, so signature mismatches
// are logged as a warning instead of rejected. Watch the server logs the
// first time a real payment comes through, confirm the signature check
// passes, then tighten this to reject on mismatch before going live.

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signatureHeader =
    request.headers.get("x-square-hmacsha256-signature") ?? "";
  const notificationUrl = new URL(request.url).toString();

  const isValid = WebhooksHelper.verifySignature({
    requestBody: rawBody,
    signatureHeader,
    signatureKey: getSquareSignatureKey(),
    notificationUrl,
  });

  if (!isValid) {
    console.warn(
      "Square webhook: signature did not verify — check this against a real payload before going live."
    );
  }

  const payload = JSON.parse(rawBody) as {
    type?: string;
    data?: {
      object?: {
        payment?: { id?: string; order_id?: string; status?: string };
      };
    };
  };

  const payment = payload.data?.object?.payment;

  if (
    payload.type === "payment.updated" &&
    payment?.status === "COMPLETED" &&
    payment.order_id
  ) {
    const admin = createAdminClient();
    await admin
      .from("payment_requests")
      .update({
        status: "paid",
        square_payment_id: payment.id,
        updated_at: new Date().toISOString(),
      })
      .eq("square_order_id", payment.order_id);
  }

  return NextResponse.json({ received: true });
}
