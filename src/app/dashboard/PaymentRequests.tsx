"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type PaymentRequestRow = {
  id: string;
  description: string;
  amount_cents: number;
  status: string;
  created_at: string;
};

export default function PaymentRequests({
  userId,
  refreshKey,
}: {
  userId: string;
  refreshKey: number;
}) {
  const supabase = createClient();
  const [rows, setRows] = useState<PaymentRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from("payment_requests")
        .select("id, description, amount_cents, status, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      setRows(data ?? []);
      setLoading(false);
    }
    load();
  }, [supabase, userId, refreshKey]);

  async function handlePay(id: string) {
    setPayingId(id);
    setError(null);

    const res = await fetch("/api/pay/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentRequestId: id }),
    });

    setPayingId(null);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Could not start checkout");
      return;
    }

    const { checkoutUrl } = await res.json();
    window.open(checkoutUrl, "_blank");
  }

  if (loading) return null;
  if (rows.length === 0) return null;

  return (
    <div className="card" style={{ marginTop: "1.25rem" }}>
      <p style={{ fontWeight: 600, fontSize: "0.95rem", marginTop: 0 }}>
        Invoices
      </p>

      {error && (
        <p style={{ color: "#a32d2d", fontSize: "0.85rem" }}>{error}</p>
      )}

      {rows.map((row) => (
        <div className="doc-row" key={row.id}>
          <span>
            {row.description} — ${(row.amount_cents / 100).toFixed(2)}
          </span>
          {row.status === "paid" ? (
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: 600,
                color: "#047E20",
                textTransform: "capitalize",
              }}
            >
              Paid
            </span>
          ) : (
            <button
              className="btn btn-outline"
              style={{ padding: "0.3rem 0.8rem", fontSize: "0.8rem" }}
              disabled={payingId === row.id}
              onClick={() => handlePay(row.id)}
            >
              {payingId === row.id ? "Starting..." : "Pay now"}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
