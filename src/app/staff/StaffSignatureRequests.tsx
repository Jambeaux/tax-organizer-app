"use client";

import { useEffect, useState } from "react";
import { clientLabel } from "@/lib/clientLabel";

type Client = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
};

type SignatureRequestRow = {
  id: string;
  user_id: string;
  document_name: string;
  status: string;
  created_at: string;
  client_email: string;
  client_first_name: string | null;
  client_last_name: string | null;
};

export default function StaffSignatureRequests() {
  const [clients, setClients] = useState<Client[]>([]);
  const [requests, setRequests] = useState<SignatureRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientId, setClientId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadAll() {
    setLoading(true);
    const [clientsRes, requestsRes] = await Promise.all([
      fetch("/api/staff/clients"),
      fetch("/api/staff/signature-requests"),
    ]);
    const clientsBody = await clientsRes.json().catch(() => ({}));
    const requestsBody = await requestsRes.json().catch(() => ({}));
    setClients(clientsBody.clients ?? []);
    setRequests(requestsBody.signatureRequests ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!clientId || !file) {
      setError("Pick a client and choose a document to send.");
      return;
    }

    setSending(true);
    const formData = new FormData();
    formData.append("clientUserId", clientId);
    formData.append("file", file);

    const res = await fetch("/api/staff/sign/request", {
      method: "POST",
      body: formData,
    });
    setSending(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Could not send document for signature");
      return;
    }

    setClientId("");
    setFile(null);
    loadAll();
  }

  if (loading) {
    return <p style={{ fontSize: "0.9rem", color: "#5f5e5a" }}>Loading...</p>;
  }

  return (
    <>
      <div className="card" style={{ marginBottom: "1.25rem" }}>
        <p className="section-title">Send a document for signature</p>
        <p style={{ fontSize: "0.85rem", color: "#5f5e5a", marginTop: 0 }}>
          Uploads the document to the client's own secure Documents area and
          emails them a Dropbox Sign link to review and sign it.
        </p>

        {error && <p style={{ color: "#a32d2d", fontSize: "0.85rem" }}>{error}</p>}

        <form onSubmit={handleSend}>
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
            <label className="field-label">Document</label>
            <input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>

          <button className="btn" type="submit" disabled={sending}>
            {sending ? "Sending..." : "Send for signature"}
          </button>
        </form>
      </div>

      <div className="card">
        <p className="section-title">Signature requests</p>

        {requests.length === 0 ? (
          <p style={{ fontSize: "0.9rem", color: "#5f5e5a" }}>No signature requests sent yet.</p>
        ) : (
          requests.map((r) => (
            <div className="doc-row" key={r.id}>
              <span>
                {clientLabel({
                  firstName: r.client_first_name,
                  lastName: r.client_last_name,
                  email: r.client_email,
                })}{" "}
                — {r.document_name}
              </span>
              <span
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: r.status === "signed" ? "#047E20" : "#cc9900",
                  textTransform: "capitalize",
                }}
              >
                {r.status}
              </span>
            </div>
          ))
        )}
      </div>
    </>
  );
}
