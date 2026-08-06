"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type SignatureRequestRow = {
  id: string;
  document_name: string;
  status: string;
  created_at: string;
};

export default function SignatureRequests({
  userId,
  refreshKey,
}: {
  userId: string;
  refreshKey: number;
}) {
  const supabase = createClient();
  const [rows, setRows] = useState<SignatureRequestRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from("signature_requests")
        .select("id, document_name, status, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      setRows(data ?? []);
      setLoading(false);
    }
    load();
  }, [supabase, userId, refreshKey]);

  if (loading) return null;
  if (rows.length === 0) return null;

  return (
    <div className="card" style={{ marginTop: "1.25rem" }}>
      <p style={{ fontWeight: 600, fontSize: "0.95rem", marginTop: 0 }}>
        Signature requests
      </p>
      {rows.map((row) => (
        <div className="doc-row" key={row.id}>
          <span>{row.document_name}</span>
          <span
            style={{
              fontSize: "0.75rem",
              fontWeight: 600,
              color: row.status === "signed" ? "#047E20" : "#cc9900",
              textTransform: "capitalize",
            }}
          >
            {row.status}
          </span>
        </div>
      ))}
    </div>
  );
}
