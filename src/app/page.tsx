"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { Icon } from "@/components/Icons";

export default function LoginPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const res = await signIn(email, password);
    setSubmitting(false);
    if (res.error) setError(res.error);
  };

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="mark">K</div>
        <h1>Kwega Savings</h1>
        <p className="sub">Daily contribution savings · 7% monthly compound. Sign in to continue.</p>

        <form onSubmit={handleSubmit}>
          <div className="field" style={{ marginBottom: 14 }}>
            <label>Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <div className="field" style={{ marginBottom: 14 }}>
            <label>Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          {error && (
            <p style={{ fontSize: 12.5, marginBottom: 14, color: "var(--danger)", fontWeight: 600 }}>{error}</p>
          )}
          <button
            className="btn btn-primary"
            type="submit"
            disabled={submitting}
            style={{ width: "100%", justifyContent: "center" }}
          >
            {Icon.user} {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p style={{ fontSize: 12.5, marginTop: 18, textAlign: "center", color: "var(--muted)" }}>
          New here? <Link href="/signup" style={{ color: "var(--forest)", fontWeight: 600 }}>Create an account</Link>
        </p>
      </div>
    </div>
  );
}
