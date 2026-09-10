"use client";

import { useEffect, useState } from "react";

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

const SIGNWELL_SCRIPT_URL = "https://static.signwell.com/assets/embedded.js";

// Cached across the whole app lifetime (not per-component-mount) so the
// script is only ever fetched once, however many times staff send a
// document for signature.
let signWellScriptPromise: Promise<void> | null = null;

function loadSignWellScript(): Promise<void> {
  if (typeof window !== "undefined" && window.SignWellEmbed) {
    return Promise.resolve();
  }
  if (signWellScriptPromise) return signWellScriptPromise;

  signWellScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SIGNWELL_SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      signWellScriptPromise = null;
      reject(new Error("Failed to load the SignWell editor script"));
    };
    document.body.appendChild(script);
  });
  return signWellScriptPromise;
}

// Sends a document for signature to, and lists signature requests for,
// one client. Reuses the existing (all-clients)
// /api/staff/signature-requests route and filters client-side to this
// one user — the client is fixed by the page this is embedded in, so
// there's no client picker here.
export default function StaffSignatureRequests({ clientId }: { clientId: string }) {
  const [requests, setRequests] = useState<SignatureRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [preparingFields, setPreparingFields] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadAll() {
    setLoading(true);
    const res = await fetch("/api/staff/signature-requests");
    const body = await res.json().catch(() => ({}));
    const all: SignatureRequestRow[] = body.signatureRequests ?? [];
    setRequests(all.filter((r) => r.user_id === clientId));
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!file) {
      setError("Choose a document to send.");
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

    const body = await res.json();
    if (!body.embeddedEditUrl) {
      setError("SignWell didn't return an editor link.");
      return;
    }

    // Hand off to SignWell's own embedded editor so the staff member can
    // drag a signature/date field onto the document before it actually
    // sends. It doesn't finish sending until they click "Continue" inside
    // that editor — the "completed" event below fires then.
    setPreparingFields(true);
    try {
      await loadSignWellScript();
    } catch {
      setPreparingFields(false);
      setError("Could not load the SignWell editor. Check your connection and try again.");
      return;
    }

    if (!window.SignWellEmbed) {
      setPreparingFields(false);
      setError("SignWell editor failed to load.");
      return;
    }

    new window.SignWellEmbed({
      url: body.embeddedEditUrl,
      events: {
        completed: () => {
          setPreparingFields(false);
          setFile(null);
          // The signature_requests row already exists (created
          // synchronously when we asked SignWell for this editor link),
          // so it'll show up right away — its status just updates from
          // "draft" to "pending" a moment later once our webhook hears
          // about it.
          loadAll();
        },
        closed: () => {
          setPreparingFields(false);
        },
      },
    }).open();
  }

  if (loading) {
    return <p style={{ fontSize: "0.9rem", color: "#5f5e5a" }}>Loading...</p>;
  }

  return (
    <>
      <div className="card" style={{ marginBottom: "1.25rem" }}>
        <p className="section-title">Send a document for signature</p>
        <p style={{ fontSize: "0.85rem", color: "#5f5e5a", marginTop: 0 }}>
          Uploads the document to the client's own secure Documents area,
          then opens SignWell's editor so you can drag a signature and
          date field onto it. Click Continue in that editor to actually
          send it — nothing goes to the client until then.
        </p>

        {error && <p style={{ color: "#a32d2d", fontSize: "0.85rem" }}>{error}</p>}

        <form onSubmit={handleSend}>
          <div className="field-group">
            <label className="field-label">Document</label>
            <input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>

          <button className="btn" type="submit" disabled={sending || preparingFields}>
            {sending
              ? "Uploading..."
              : preparingFields
                ? "Waiting on editor..."
                : "Send for signature"}
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
              <span>{r.document_name}</span>
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
