"use client";

import { useEffect, useState } from "react";
import { clientLabel } from "@/lib/clientLabel";

type Client = {
  id: string;
  email: string | null;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
  status: "pending" | "approved";
  is_business: boolean;
};

type Invite = {
  id: string;
  token: string;
  email: string;
  name: string | null;
  note: string | null;
  created_by: string;
  used_at: string | null;
  created_at: string;
};

export default function StaffAccounts() {
  const [clients, setClients] = useState<Client[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteNote, setInviteNote] = useState("");
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  async function loadAll() {
    setLoading(true);
    const [clientsRes, invitesRes] = await Promise.all([
      fetch("/api/staff/clients"),
      fetch("/api/staff/invites"),
    ]);
    const clientsBody = await clientsRes.json().catch(() => ({}));
    const invitesBody = await invitesRes.json().catch(() => ({}));
    setClients(clientsBody.clients ?? []);
    setInvites(invitesBody.invites ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function handleApprove(userId: string) {
    setBusyId(userId);
    await fetch("/api/staff/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    setBusyId(null);
    loadAll();
  }

  async function handleReject(userId: string) {
    if (!confirm("Reject and delete this account? This can't be undone.")) return;
    setBusyId(userId);
    await fetch("/api/staff/reject", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    setBusyId(null);
    loadAll();
  }

  async function handleCreateInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteError(null);

    if (!inviteEmail.trim() || !inviteEmail.includes("@")) {
      setInviteError("Enter a valid email.");
      return;
    }

    setCreatingInvite(true);
    const res = await fetch("/api/staff/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: inviteName.trim(),
        email: inviteEmail.trim(),
        note: inviteNote.trim(),
      }),
    });
    setCreatingInvite(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setInviteError(body.error ?? "Could not create invite");
      return;
    }

    setInviteName("");
    setInviteEmail("");
    setInviteNote("");
    loadAll();
  }

  function inviteLink(token: string) {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/login?email=${encodeURIComponent(
      invites.find((i) => i.token === token)?.email ?? ""
    )}`;
  }

  async function copyLink(token: string) {
    const link = inviteLink(token);
    try {
      await navigator.clipboard.writeText(link);
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 2000);
    } catch {
      // Clipboard API can be unavailable (e.g. non-HTTPS local testing) —
      // the link is still shown in the list, just not auto-copied.
    }
  }

  const pending = clients.filter((c) => c.status === "pending");

  if (loading) {
    return <p style={{ fontSize: "0.9rem", color: "#5f5e5a" }}>Loading...</p>;
  }

  return (
    <>
      {pending.length > 0 && (
        <div className="card" style={{ marginBottom: "1.25rem" }}>
          <p className="section-title">
            Pending accounts ({pending.length})
          </p>
          <p style={{ fontSize: "0.85rem", color: "#5f5e5a", marginTop: 0 }}>
            These are leftover from before CAPTCHA replaced manual review —
            new signups no longer land here. You can still approve or
            reject them below.
          </p>
          {pending.map((c) => (
            <div className="doc-row" key={c.id}>
              <span>{clientLabel({ firstName: c.first_name, lastName: c.last_name, email: c.email })}</span>
              <span style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  className="btn"
                  style={{ padding: "0.3rem 0.8rem", fontSize: "0.8rem" }}
                  onClick={() => handleApprove(c.id)}
                  disabled={busyId === c.id}
                  type="button"
                >
                  Approve
                </button>
                <button
                  className="btn btn-outline"
                  style={{ padding: "0.3rem 0.8rem", fontSize: "0.8rem" }}
                  onClick={() => handleReject(c.id)}
                  disabled={busyId === c.id}
                  type="button"
                >
                  Reject
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="card" style={{ marginBottom: "1.25rem" }}>
        <p className="section-title">Invite a client</p>
        <p style={{ fontSize: "0.85rem", color: "#5f5e5a", marginTop: 0 }}>
          Creates a record of who you're expecting, so their name is
          pre-filled automatically the first time they sign in.
        </p>

        {inviteError && (
          <p style={{ color: "#a32d2d", fontSize: "0.85rem" }}>{inviteError}</p>
        )}

        <form onSubmit={handleCreateInvite}>
          <div className="field-group">
            <label className="field-label">Client name</label>
            <input
              type="text"
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
            />
          </div>
          <div className="field-group">
            <label className="field-label">Client email</label>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
            />
          </div>
          <div className="field-group">
            <label className="field-label">Note (optional, staff-only)</label>
            <input
              type="text"
              value={inviteNote}
              onChange={(e) => setInviteNote(e.target.value)}
              placeholder="e.g. referred by Azaria"
            />
          </div>
          <button className="btn" type="submit" disabled={creatingInvite}>
            {creatingInvite ? "Creating..." : "Create invite"}
          </button>
        </form>
      </div>

      <div className="card" style={{ marginBottom: "1.25rem" }}>
        <p className="section-title">Invites sent</p>
        {invites.length === 0 ? (
          <p style={{ fontSize: "0.9rem", color: "#5f5e5a" }}>
            No invites created yet.
          </p>
        ) : (
          invites.map((inv) => (
            <div className="doc-row" key={inv.id}>
              <span>
                {inv.name ? `${inv.name} — ${inv.email}` : inv.email}
                {inv.note ? ` (${inv.note})` : ""}
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    color: inv.used_at ? "#047E20" : "#cc9900",
                  }}
                >
                  {inv.used_at ? "Signed up" : "Waiting"}
                </span>
                {!inv.used_at && (
                  <button
                    className="btn btn-outline"
                    style={{ padding: "0.25rem 0.6rem", fontSize: "0.75rem" }}
                    onClick={() => copyLink(inv.token)}
                    type="button"
                  >
                    {copiedToken === inv.token ? "Copied!" : "Copy link"}
                  </button>
                )}
              </span>
            </div>
          ))
        )}
      </div>

      <div className="card" style={{ marginBottom: "1.25rem" }}>
        <p className="section-title">All clients ({clients.length})</p>
        {clients.length === 0 ? (
          <p style={{ fontSize: "0.9rem", color: "#5f5e5a" }}>
            No clients signed up yet.
          </p>
        ) : (
          clients.map((c) => (
            <div className="doc-row" key={c.id}>
              <span>
                {clientLabel({ firstName: c.first_name, lastName: c.last_name, email: c.email })}
                {c.is_business ? " (business/self-employed)" : ""}
              </span>
              <span
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: c.status === "approved" ? "#047E20" : "#cc9900",
                  textTransform: "capitalize",
                }}
              >
                {c.status}
              </span>
            </div>
          ))
        )}
      </div>
    </>
  );
}
