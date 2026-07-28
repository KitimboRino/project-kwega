"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Icon } from "@/components/Icons";
import MemberView from "@/components/MemberView";
import OfficerView from "@/components/OfficerView";
import AdminView from "@/components/AdminView";

type NavEntry = { key: string; label: string; icon: keyof typeof Icon; group: string; badge?: string };

const NAV: Record<string, NavEntry[]> = {
  member: [
    { key: "home", label: "Overview", icon: "home", group: "Main menu" },
    { key: "activity", label: "Activity", icon: "list", group: "Main menu" },
    { key: "withdraw", label: "Withdraw", icon: "money", group: "Main menu" },
  ],
  officer: [
    { key: "home", label: "Officer desk", icon: "home", group: "Main menu" },
    { key: "accounts", label: "Accounts", icon: "users", group: "Management" },
    { key: "new", label: "New account", icon: "plus", group: "Management", badge: "New" },
  ],
  admin: [
    { key: "home", label: "Overview", icon: "chart", group: "Main menu" },
    { key: "members", label: "All members", icon: "users", group: "Management" },
    { key: "branches", label: "Branches", icon: "shield", group: "Management" },
  ],
};

export default function Dashboard() {
  const { user, loading, logout } = useAuth();
  const [tab, setTab] = useState("home");

  useEffect(() => {
    if (!loading && !user) window.location.href = "/";
  }, [user, loading]);

  if (loading || !user) {
    return <div style={{ padding: 40, color: "var(--muted)" }}>Loading…</div>;
  }

  const nav = NAV[user.role];
  const groups = Array.from(new Set(nav.map((n) => n.group)));
  const initials = user.name.split(" ").map((w) => w[0]).join("").slice(0, 2);

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="mark">K</div>
          <div>
            <b>Kwega</b>
            <span>Savings</span>
          </div>
        </div>

        <div className="side-search">
          {Icon.search}
          <span>Search</span>
          <span className="kbd">⌘K</span>
        </div>

        {groups.map((g) => (
          <div key={g}>
            <div className="side-group">{g}</div>
            {nav
              .filter((n) => n.group === g)
              .map((n) => (
                <div
                  key={n.key}
                  className={`nav-item ${tab === n.key ? "on" : ""}`}
                  onClick={() => setTab(n.key)}
                >
                  {Icon[n.icon]}
                  <span>{n.label}</span>
                  {n.badge && <span className="badge-new">{n.badge}</span>}
                </div>
              ))}
          </div>
        ))}

        <div className="side-foot">
          <span className="role-badge">{user.role}</span>
          <div className="who">
            <div className="av">{initials}</div>
            <div>
              <b>{user.name}</b>
              <small>{user.accountNo ?? user.branch ?? "Head office"}</small>
            </div>
          </div>
          <button className="logout" onClick={logout}>
            Sign out
          </button>
        </div>
      </aside>

      <main className="main">
        <div className="topbar">
          <div className="search-full">
            {Icon.search}
            <span>Search members, transactions…</span>
          </div>
          <div className="head-actions">
            <button className="btn btn-ghost">Last 6 months</button>
          </div>
        </div>

        <div className="content">
          {user.role === "member" && <MemberView tab={tab} />}
          {user.role === "officer" && <OfficerView tab={tab} />}
          {user.role === "admin" && <AdminView tab={tab} />}
        </div>
      </main>
    </div>
  );
}
