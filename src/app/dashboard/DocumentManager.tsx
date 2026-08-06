"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type FileRow = {
  name: string;
  id: string | null;
};

export default function DocumentManager({
  userId,
  onSignatureRequested,
}: {
  userId: string;
  onSignatureRequested?: () => void;
}) {
  const supabase = createClient();
  const [files, setFiles] = useState<FileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [requestingName, setRequestingName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.storage
      .from("documents")
      .list(userId, { sortBy: { column: "created_at", order: "desc" } });

    if (error) {
      setError(error.message);
    } else {
      setFiles(data ?? []);
    }
    setLoading(false);
  }, [supabase, userId]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    const { error } = await supabase.storage
      .from("documents")
      .upload(`${userId}/${Date.now()}_${file.name}`, file, {
        upsert: false,
      });

    setUploading(false);
    e.target.value = "";

    if (error) {
      setError(error.message);
    } else {
      loadFiles();
    }
  }

  async function handleDownload(name: string) {
    const { data, error } = await supabase.storage
      .from("documents")
      .createSignedUrl(`${userId}/${name}`, 60);

    if (error) {
      setError(error.message);
      return;
    }
    window.open(data.signedUrl, "_blank");
  }

  async function handleRequestSignature(name: string) {
    setRequestingName(name);
    setError(null);

    const res = await fetch("/api/sign/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentName: name }),
    });

    setRequestingName(null);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Could not send document for signature");
      return;
    }

    onSignatureRequested?.();
  }

  async function handleDelete(name: string) {
    const { error } = await supabase.storage
      .from("documents")
      .remove([`${userId}/${name}`]);

    if (error) {
      setError(error.message);
    } else {
      loadFiles();
    }
  }

  return (
    <div className="card">
      <div style={{ marginBottom: "1.25rem" }}>
        <label className="btn" style={{ display: "inline-block" }}>
          {uploading ? "Uploading..." : "Upload document"}
          <input
            type="file"
            onChange={handleUpload}
            disabled={uploading}
            style={{ display: "none" }}
          />
        </label>
      </div>

      {error && (
        <p style={{ color: "#a32d2d", fontSize: "0.85rem" }}>{error}</p>
      )}

      {loading ? (
        <p style={{ fontSize: "0.9rem", color: "#5f5e5a" }}>Loading...</p>
      ) : files.length === 0 ? (
        <p style={{ fontSize: "0.9rem", color: "#5f5e5a" }}>
          No documents yet. Upload your first one above.
        </p>
      ) : (
        files.map((file) => (
          <div className="doc-row" key={file.name}>
            <span>{file.name.replace(/^\d+_/, "")}</span>
            <span style={{ display: "flex", gap: "10px" }}>
              <button
                className="btn btn-outline"
                style={{ padding: "0.3rem 0.8rem", fontSize: "0.8rem" }}
                onClick={() => handleDownload(file.name)}
              >
                Download
              </button>
              <button
                className="btn btn-outline"
                style={{ padding: "0.3rem 0.8rem", fontSize: "0.8rem" }}
                disabled={requestingName === file.name}
                onClick={() => handleRequestSignature(file.name)}
              >
                {requestingName === file.name ? "Sending..." : "Request signature"}
              </button>
              <button
                className="btn btn-outline"
                style={{ padding: "0.3rem 0.8rem", fontSize: "0.8rem" }}
                onClick={() => handleDelete(file.name)}
              >
                Delete
              </button>
            </span>
          </div>
        ))
      )}
    </div>
  );
}
