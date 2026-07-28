"use client";

import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { Icon } from "@/components/Icons";

export default function LoginPage() {
  const { user, login, loading } = useAuth();

  // If already signed in, bounce to dashboard
  useEffect(() => {
    if (!loading && user) window.location.href = "/dashboard";
  }, [user, loading]);

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="mark">K</div>
        <h1>Kwega Savings</h1>
        <p className="sub">Daily contribution savings · 7% monthly compound. Sign in to continue.</p>

        <div className="demo-label">Demo — choose a role</div>

        <button className="demo-btn" onClick={() => login("member")}>
          <span className="ic">{Icon.user}</span>
          <span className="txt">
            <b>Sign in as Member</b>
            <span>See only your own account &amp; withdrawals</span>
          </span>
        </button>

        <button className="demo-btn" onClick={() => login("officer")}>
          <span className="ic">{Icon.plus}</span>
          <span className="txt">
            <b>Sign in as Officer</b>
            <span>Open accounts &amp; log contributions</span>
          </span>
        </button>

        <button className="demo-btn" onClick={() => login("admin")}>
          <span className="ic">{Icon.shield}</span>
          <span className="txt">
            <b>Sign in as Admin</b>
            <span>See everyone and everything</span>
          </span>
        </button>
      </div>
    </div>
  );
}
