"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Turnstile from "./Turnstile";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(
    searchParams.get("error")
  );
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRequired = !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        captchaToken: captchaToken ?? undefined,
      },
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      setCaptchaToken(null);
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
            <Turnstile onToken={setCaptchaToken} />
            <button
              className="btn"
              type="submit"
              disabled={loading || (captchaRequired && !captchaToken)}
            >
              {loading ? "Sending..." : "Send sign-in link"}
            </button>
            {error && (
              <p style={{ color: "#a32d2d", fontSize: "0.85rem" }}>{error}</p>
            )}
          </form>
        )}

        <p style={{ fontSize: "0.75rem", color: "#5f5e5a", marginTop: "1.5rem", marginBottom: 0 }}>
          For your security: JLB Tax &amp; Bookkeeping will never call, text,
          or email you asking for a password, Social Security Number, or
          payment card number. Sign-in only ever happens through this page.
        </p>
      </div>
    </div>
  );
}
