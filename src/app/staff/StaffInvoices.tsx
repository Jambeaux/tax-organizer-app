"use client";

import { useEffect, useState } from "react";

type Invoice = {
  id: string;
  user_id: string;
  description: string;
  amount_cents: number;
  status: string;
  created_at: string;
  client_email: string;
  client_first_name: string | null;
  client_last_name: string | null;
};

// Shows and creates invoices for one client. Reuses the existing
// (all-clients) /api/staff/invoices route and filters client-side to
// this one user — the client is fixed by the page this is embedded in,
// so there's no client picker here.
export default function StaffInvoices({ clientId }: { clientId: string }) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadAll() {
    setLoading(true);
    const res = await fetch("/api/staff/invoices");
    const body = await res.json().catch(() => ({}));
    const all: Invoice[] = body.invoices ?? [];
    setInvoices(all.filter((inv) => inv.user_id === clientId));
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const dollars = parseFloat(amount);
    if (!description.trim() || !dollars || dollars <= 0) {
      setError("Enter a description and a positive dollar amount.");
      return;
    }

    setCreating(true);
    const res = await fetch("/api/staff/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientUserId: clientId,
        description: description.trim(),
        amountCents: Math.round(dollars * 100),
      }),
    });
    setCreating(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Could not create invoice");
      return;
    }

    setDescription("");
    setAmount("");
    loadAll();
  }

  if (loading) {
    return <p style={{ fontSize: "0.9rem", color: "#5f5e5a" }}>Loading...</p>;
  }

  return (
    <>
      <div className="card" style={{ marginBottom: "1.25rem" }}>
        <p className="section-title">Create invoice</p>

        {error && <p style={{ color: "#a32d2d", fontSize: "0.85rem" }}>{error}</p>}

        <form onSubmit={handleCreate}>
          <div className="field-group">
            <label className="field-label">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Tax prep — 2025 return"
            />
          </div>

          <div className="field-group">
            <label className="field-label">Amount (USD)</label>
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="450.00"
            />
          </div>

          <button className="btn" type="submit" disabled={creating}>
            {creating ? "Creating..." : "Create invoice"}
          </button>
        </form>
      </div>

      <div className="card">
        <p className="section-title">Invoices</p>

        {invoices.length === 0 ? (
          <p style={{ fontSize: "0.9rem", color: "#5f5e5a" }}>No invoices yet.</p>
        ) : (
          invoices.map((inv) => (
            <div className="doc-row" key={inv.id}>
              <span>
                {inv.description} — ${(inv.amount_cents / 100).toFixed(2)}
              </span>
              <span
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: inv.status === "paid" ? "#047E20" : "#cc9900",
                  textTransform: "capitalize",
                }}
              >
                {inv.status}
              </span>
            </div>
          ))
        )}
      </div>
    </>
  );
}
