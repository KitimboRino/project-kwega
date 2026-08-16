"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { Icon } from "@/components/Icons";
import AuthVisual from "@/components/AuthVisual";

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const res = await resetPassword(email);
    setSubmitting(false);
    if (res.error) setError(res.error);
    else setDone(true);
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

          <h1 className="auth-welcome">Reset your password</h1>
          <p className="sub">Enter the email on your account and we&apos;ll send you a reset link.</p>

          {done ? (
            <p style={{ fontSize: 13.5, color: "var(--forest)", fontWeight: 600 }}>
              If an account exists for that email, a reset link is on its way. Check your inbox (and spam folder).
            </p>
          ) : (
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
              {error && (
                <p style={{ fontSize: 12.5, marginBottom: 14, color: "var(--danger)", fontWeight: 600 }}>{error}</p>
              )}
              <button
                className="btn btn-primary"
                type="submit"
                disabled={submitting}
                style={{ width: "100%", justifyContent: "center" }}
              >
                {Icon.user} {submitting ? "Sending…" : "Send reset link"}
              </button>
            </form>
          )}

          <p className="auth-signup-link">
            <Link href="/">Back to sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
