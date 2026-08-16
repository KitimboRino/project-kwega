"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { Icon } from "@/components/Icons";
import AuthVisual from "@/components/AuthVisual";

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
    <div className="auth-split">
      <AuthVisual />

      <div className="auth-form-side">
        <div className="auth-form-wrap">
          <div className="auth-brand-row">
            <div className="mark">K</div>
            <span className="auth-brand-name">Kiyemba Savings</span>
          </div>

          <h1 className="auth-welcome">Welcome back</h1>
          <p className="sub">Sign in to view your balance, log contributions, or manage your team.</p>

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
              {Icon.user} {submitting ? "Signing in…" : "Log In"}
            </button>
          </form>

          <p className="auth-forgot-link">
            <Link href="/forgot-password">Forgot your password?</Link>
          </p>

          <div className="auth-security-note">
            <span className="ic">{Icon.shield}</span>
            <div>
              <b>Keep your account secure</b>
              <p>
                Never share your password with anyone. If you notice unfamiliar activity on your account,
                contact your savings officer immediately.
              </p>
            </div>
          </div>

          <p className="auth-signup-link">
            New here? <Link href="/signup">Create an account</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
