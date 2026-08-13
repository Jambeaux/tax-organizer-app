import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSquareClient, getSquareLocationId } from "@/lib/square/client";

// Called when a client clicks "Pay now" on an invoice already sitting in
// payment_requests (created by hand for now — see schema_payments.sql).
// Creates a Square-hosted checkout link for that invoice's amount and
// hands the URL back so the client can be sent there to pay.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { paymentRequestId } = await request.json();
  if (!paymentRequestId) {
    return NextResponse.json(
      { error: "paymentRequestId is required" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { data: invoice, error: fetchError } = await admin
    .from("payment_requests")
    .select("*")
    .eq("id", paymentRequestId)
    .single();

  if (fetchError || !invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  if (invoice.user_id !== user.id) {
    return NextResponse.json({ error: "Not your invoice" }, { status: 403 });
  }

  if (invoice.status === "paid") {
    return NextResponse.json({ error: "This invoice is already paid" }, { status: 400 });
  }

  // Already have a link from a previous click — reuse it instead of
  // creating a duplicate Square order.
  if (invoice.checkout_url) {
    return NextResponse.json({ checkoutUrl: invoice.checkout_url });
  }

  const square = createSquareClient();

  let result;
  try {
    result = await square.checkout.paymentLinks.create({
      idempotencyKey: invoice.id,
      description: invoice.description,
      quickPay: {
        name: invoice.description,
        priceMoney: {
          amount: BigInt(invoice.amount_cents),
          currency: "USD",
        },
        locationId: getSquareLocationId(),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Square error";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const checkoutUrl = result.paymentLink?.url;
  const orderId = result.paymentLink?.orderId;

  if (!checkoutUrl) {
    return NextResponse.json(
      { error: "Square did not return a checkout link" },
      { status: 502 }
    );
  }

  await admin
    .from("payment_requests")
    .update({
      checkout_url: checkoutUrl,
      square_order_id: orderId ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", invoice.id);

  return NextResponse.json({ checkoutUrl });
}
