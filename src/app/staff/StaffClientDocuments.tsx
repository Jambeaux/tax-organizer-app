"use client";

import { useEffect, useState } from "react";

type DocumentRow = {
  fileName: string;
  originalName: string;
  uploadedBy: "client" | "staff";
  uploadedByEmail: string | null;
  note: string | null;
  createdAt: string | null;
};

// Lets staff send one or more plain (non-signature) documents to a
// client — the client gets an email notification — and lists the
// client's own uploads alongside anything the firm has sent them.
// Signature-request documents and the P&L statement have their own
// sections elsewhere on the page, so they're excluded here (see
// /api/staff/documents' filtering).
export default function StaffClientDocuments({ clientId }: { clientId: string }) {
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [files, setFiles] = useState<FileList | null>(null);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);

  async function loadDocuments() {
    setLoading(true);
    const res = await fetch(`/api/staff/documents?userId=${encodeURIComponent(clientId)}`);
    const body = await res.json().catch(() => ({}));
    setDocuments(body.documents ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!files || files.length === 0) {
      setError("Choose at least one document to send.");
      return;
    }

    setSending(true);
    const formData = new FormData();
    formData.append("clientUserId", clientId);
    if (note.trim()) formData.append("note", note.trim());
    Array.from(files).forEach((file) => formData.append("files", file));

    const res = await fetch("/api/staff/documents/send", {
      method: "POST",
      body: formData,
    });
    setSending(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Could not send document");
      return;
    }

    setFiles(null);
    setNote("");
    const fileInput = document.getElementById(
      "staff-send-document-input"
    ) as HTMLInputElement | null;
    if (fileInput) fileInput.value = "";
    loadDocuments();
  }

  async function handleDownload(fileName: string) {
    setDownloadingFile(fileName);
    const res = await fetch(
      `/api/staff/documents?userId=${encodeURIComponent(clientId)}&fileName=${encodeURIComponent(
        fileName
      )}`
    );
    const body = await res.json().catch(() => ({}));
    setDownloadingFile(null);
    if (res.ok && body.url) {
      window.open(body.url, "_blank");
    } else {
      setError(body.error ?? "Could not open file");
    }
  }

  const fromClient = documents.filter((d) => d.uploadedBy === "client");
  const fromFirm = documents.filter((d) => d.uploadedBy === "staff");

  return (
    <>
      <div className="card" style={{ marginBottom: "1.25rem" }}>
        <p className="section-title">Send a document (no signature required)</p>
        <p style={{ fontSize: "0.85rem", color: "#5f5e5a", marginTop: 0 }}>
          Uploads directly to the client's Documents area and emails them
          to let them know. For documents that need to be signed, use
          "Send a document for signature" below instead.
        </p>

        {error && <p style={{ color: "#a32d2d", fontSize: "0.85rem" }}>{error}</p>}

        <form onSubmit={handleSend}>
          <div className="field-group">
            <label className="field-label">Document(s)</label>
            <input
              id="staff-send-document-input"
              type="file"
              multiple
              onChange={(e) => setFiles(e.target.files)}
            />
          </div>

          <div className="field-group">
            <label className="field-label">Note (optional, included in the email)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Here's your engagement letter for this year"
            />
          </div>

          <button className="btn" type="submit" disabled={sending}>
            {sending ? "Sending..." : "Send document"}
          </button>
        </form>
      </div>

      <div className="card" style={{ marginBottom: "1.25rem" }}>
        <p className="section-title">Sent from firm</p>
        {loading ? (
          <p style={{ fontSize: "0.9rem", color: "#5f5e5a" }}>Loading...</p>
        ) : fromFirm.length === 0 ? (
          <p style={{ fontSize: "0.9rem", color: "#5f5e5a" }}>No documents sent yet.</p>
        ) : (
          fromFirm.map((doc) => (
            <div className="doc-row" key={doc.fileName}>
              <span>
                {doc.originalName}
                {doc.note ? ` — ${doc.note}` : ""}
              </span>
              <button
                type="button"
                className="btn btn-outline"
                style={{ padding: "0.2rem 0.6rem", fontSize: "0.75rem" }}
                onClick={() => handleDownload(doc.fileName)}
                disabled={downloadingFile === doc.fileName}
              >
                {downloadingFile === doc.fileName ? "Opening..." : "Download"}
              </button>
            </div>
          ))
        )}
      </div>

      <div className="card">
        <p className="section-title">Uploaded by client</p>
        {loading ? (
          <p style={{ fontSize: "0.9rem", color: "#5f5e5a" }}>Loading...</p>
        ) : fromClient.length === 0 ? (
          <p style={{ fontSize: "0.9rem", color: "#5f5e5a" }}>No documents uploaded yet.</p>
        ) : (
          fromClient.map((doc) => (
            <div className="doc-row" key={doc.fileName}>
              <span>{doc.originalName}</span>
              <button
                type="button"
                className="btn btn-outline"
                style={{ padding: "0.2rem 0.6rem", fontSize: "0.75rem" }}
                onClick={() => handleDownload(doc.fileName)}
                disabled={downloadingFile === doc.fileName}
              >
                {downloadingFile === doc.fileName ? "Opening..." : "Download"}
              </button>
            </div>
          ))
        )}
      </div>
    </>
  );
}
