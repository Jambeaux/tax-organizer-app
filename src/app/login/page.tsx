"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    setLoading(false);

    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
  }

  return (
    <div className="container">
      <div className="card">
        <h1 style={{ fontSize: "1.3rem", marginTop: 0 }}>
          JLB Tax &amp; Bookkeeping client portal
        </h1>

        {sent ? (
          <p>
            Check your email — we sent a secure sign-in link to <b>{email}</b>.
            Click it to get into your account.
          </p>
        ) : (
          <form onSubmit={handleSubmit}>
            <p style={{ fontSize: "0.9rem", color: "#5f5e5a" }}>
              Enter your email and we&apos;ll send you a secure link to sign
              in — no password needed.
            </p>
            <input
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ marginBottom: "1rem" }}
            />
            <button className="btn" type="submit" disabled={loading}>
              {loading ? "Sending..." : "Send sign-in link"}
            </button>
            {error && (
              <p style={{ color: "#a32d2d", fontSize: "0.85rem" }}>{error}</p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
