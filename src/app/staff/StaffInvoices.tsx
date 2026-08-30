"use client";

import { useEffect, useState } from "react";
import { clientLabel } from "@/lib/clientLabel";

type Client = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
};
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

export default function StaffInvoices() {
  const [clients, setClients] = useState<Client[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientId, setClientId] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadAll() {
    setLoading(true);
    const [clientsRes, invoicesRes] = await Promise.all([
      fetch("/api/staff/clients"),
      fetch("/api/staff/invoices"),
    ]);
    const clientsBody = await clientsRes.json().catch(() => ({}));
    const invoicesBody = await invoicesRes.json().catch(() => ({}));
    setClients(clientsBody.clients ?? []);
    setInvoices(invoicesBody.invoices ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const dollars = parseFloat(amount);
    if (!clientId || !description.trim() || !dollars || dollars <= 0) {
      setError("Pick a client, enter a description, and a positive dollar amount.");
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
            <label className="field-label">Client</label>
            <select value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">Select a client</option>
              {clients.map((c) => (
                <option value={c.id} key={c.id}>
                  {clientLabel({ firstName: c.first_name, lastName: c.last_name, email: c.email }) || c.id}
                </option>
              ))}
            </select>
          </div>

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
        <p className="section-title">All invoices</p>

        {invoices.length === 0 ? (
          <p style={{ fontSize: "0.9rem", color: "#5f5e5a" }}>No invoices yet.</p>
        ) : (
          invoices.map((inv) => (
            <div className="doc-row" key={inv.id}>
              <span>
                {clientLabel({
                  firstName: inv.client_first_name,
                  lastName: inv.client_last_name,
                  email: inv.client_email,
                })}{" "}
                — {inv.description} — $
                {(inv.amount_cents / 100).toFixed(2)}
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
