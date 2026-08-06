"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { Icon } from "@/components/Icons";

export default function SignupPage() {
  const { signUp } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const res = await signUp(email, password, name);
    setSubmitting(false);
    if (res.error) setError(res.error);
    else setDone(true);
  };

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="mark">K</div>
        <h1>Create an account</h1>
        <p className="sub">
          Every new sign-up starts as a member with no savings account attached. Real member
          accounts are opened by a savings officer — this page mainly bootstraps the first
          admin/officer login, who are then promoted from the Supabase dashboard.
        </p>

        {done ? (
          <p style={{ fontSize: 13.5, color: "var(--forest)", fontWeight: 600 }}>
            Account created. Check your email to confirm, then{" "}
            <Link href="/" style={{ color: "var(--forest)" }}>sign in</Link>.
          </p>
        ) : (
          <>
            <form onSubmit={handleSubmit}>
              <div className="field" style={{ marginBottom: 14 }}>
                <label>Full name</label>
                <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Amara Nabirye" />
              </div>
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
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
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
                {Icon.plus} {submitting ? "Creating…" : "Create account"}
              </button>
            </form>
            <p style={{ fontSize: 12.5, marginTop: 18, textAlign: "center", color: "var(--muted)" }}>
              Already have an account? <Link href="/" style={{ color: "var(--forest)", fontWeight: 600 }}>Sign in</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
