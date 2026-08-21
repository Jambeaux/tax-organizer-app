import { NextResponse } from "next/server";
import { WebhooksHelper } from "square";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSquareSignatureKey } from "@/lib/square/client";

// Square posts here whenever a payment's status changes. Configure this
// URL (https://portal.jlbtax.com/api/pay/webhook) under Square's Developer
// Dashboard > your app > Webhooks, subscribed to the "payment.updated"
// event, using the same domain that's live in Vercel.
//
// Signature verification is enforced below — requests that don't match
// are rejected before any data gets touched. Confirmed working against a
// real test event from Square's webhook dashboard.

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
    console.warn("Square webhook: rejected — signature did not verify.");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
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
