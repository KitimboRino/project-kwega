"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import AuthVisual from "@/components/AuthVisual";

export default function ResetPasswordPage() {
  const supabase = createClient();
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  // Clicking the emailed reset link lands here with a recovery session
  // established client-side (from the URL fragment) — Supabase fires a
  // dedicated PASSWORD_RECOVERY event when that happens. We also check
  // getSession() directly in case the event fired before this listener
  // attached.
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
      setChecked(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
      setChecked(true);
    });
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setError("");
    setSubmitting(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (err) {
      setError(err.message);
      return;
    }
    setDone(true);
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

          <h1 className="auth-welcome">Set a new password</h1>

          {!checked ? (
            <p className="sub">Checking your link…</p>
          ) : done ? (
            <>
              <p style={{ fontSize: 13.5, color: "var(--forest)", fontWeight: 600, margin: "8px 0 18px" }}>
                Password updated.
              </p>
              <button
                className="btn btn-primary"
                style={{ width: "100%", justifyContent: "center" }}
                onClick={() => router.push("/dashboard")}
              >
                Continue to dashboard
              </button>
            </>
          ) : !ready ? (
            <>
              <p className="sub">This link is invalid or has expired.</p>
              <Link href="/forgot-password" style={{ color: "var(--forest)", fontWeight: 600 }}>
                Request a new reset link
              </Link>
            </>
          ) : (
            <form onSubmit={handleSubmit}>
              <p className="sub">Choose a new password for your account.</p>
              <div className="field" style={{ marginBottom: 14 }}>
                <label>New password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                />
              </div>
              <div className="field" style={{ marginBottom: 14 }}>
                <label>Confirm password</label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
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
                {submitting ? "Saving…" : "Save new password"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
