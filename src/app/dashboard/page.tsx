"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Icon } from "@/components/Icons";
import MemberView from "@/components/MemberView";
import OfficerView from "@/components/OfficerView";
import AdminView from "@/components/AdminView";
import AdminUsers from "@/components/AdminUsers";
import AdminBranches from "@/components/AdminBranches";
import AdminSavings from "@/components/AdminSavings";
import AccountSettings from "@/components/AccountSettings";
import GlobalSearch from "@/components/GlobalSearch";
import { Loader } from "@/components/Loader";

type NavEntry = { key: string; label: string; icon: keyof typeof Icon; group: string; badge?: string };

const NAV: Record<string, NavEntry[]> = {
  member: [
    { key: "home", label: "Overview", icon: "home", group: "Main menu" },
    { key: "activity", label: "Activity", icon: "list", group: "Main menu" },
    { key: "withdraw", label: "Withdraw", icon: "money", group: "Main menu" },
    { key: "settings", label: "Settings", icon: "user", group: "Account" },
  ],
  officer: [
    { key: "home", label: "Officer desk", icon: "home", group: "Main menu" },
    { key: "accounts", label: "Accounts", icon: "users", group: "Management" },
    { key: "new", label: "New account", icon: "plus", group: "Management", badge: "New" },
    { key: "settings", label: "Settings", icon: "user", group: "Account" },
  ],
  admin: [
    { key: "home", label: "Overview", icon: "chart", group: "Main menu" },
    { key: "members", label: "All members", icon: "users", group: "Management" },
    { key: "savings", label: "Savings", icon: "income", group: "Management" },
    { key: "branches", label: "Branches", icon: "shield", group: "Management" },
    { key: "users", label: "Users", icon: "users", group: "Management" },
    { key: "settings", label: "Settings", icon: "user", group: "Account" },
  ],
};

export default function Dashboard() {
  const { user, loading, logout } = useAuth();
  const [tab, setTab] = useState("home");
  const [searchOpen, setSearchOpen] = useState(false);
  // A nonce alongside the id, not just the id, so jumping to the same
  // person twice in a row still re-triggers the effect that consumes it.
  const [jump, setJump] = useState<{ id: string; nonce: number } | null>(null);

  // Global search is only meaningful for officer/admin — a member has just
  // their own single account, nothing to search. Only they get ⌘K.
  const canSearch = !!user && user.role !== "member";
  useEffect(() => {
    if (!canSearch) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canSearch]);

  // middleware.ts owns the real signed-out -> "/" redirect; this is just
  // the brief loading state before the client picks up the session.
  if (loading || !user) {
    return <Loader full label="Loading your dashboard…" />;
  }

  const nav = NAV[user.role];
  const groups = Array.from(new Set(nav.map((n) => n.group)));
  const initials = user.name.split(" ").map((w) => w[0]).join("").slice(0, 2);

  const handleJump = (id: string) => {
    setTab(user.role === "admin" ? "users" : "accounts");
    setJump({ id, nonce: Date.now() });
  };

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="mark">K</div>
          <div>
            <b>Kiyemba</b>
            <span>Savings</span>
          </div>
        </div>

        {groups.map((g) => (
          <div key={g} className="nav-group">
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
          {canSearch ? (
            <div className="search-full" onClick={() => setSearchOpen(true)} role="button" tabIndex={0}>
              {Icon.search}
              <span>Search {user.role === "officer" ? "your members" : "members, officers, admins"}…</span>
              <span className="kbd">⌘K</span>
            </div>
          ) : (
            <div />
          )}
          <div className="head-actions">
            <button className="btn btn-ghost">Last 6 months</button>
          </div>
        </div>

        <div className="content">
          {tab === "settings" ? (
            <AccountSettings />
          ) : tab === "users" && user.role === "admin" ? (
            <AdminUsers jumpToUserId={jump?.id ?? null} jumpNonce={jump?.nonce ?? null} />
          ) : tab === "branches" && user.role === "admin" ? (
            <AdminBranches />
          ) : tab === "savings" && user.role === "admin" ? (
            <AdminSavings />
          ) : (
            <>
              {user.role === "member" && <MemberView tab={tab} />}
              {user.role === "officer" && (
                <OfficerView tab={tab} jumpToMemberId={jump?.id ?? null} jumpNonce={jump?.nonce ?? null} />
              )}
              {user.role === "admin" && <AdminView tab={tab} />}
            </>
          )}
        </div>
      </main>

      {canSearch && (
        <GlobalSearch
          role={user.role as "officer" | "admin"}
          officerId={user.role === "officer" ? user.id : undefined}
          open={searchOpen}
          onClose={() => setSearchOpen(false)}
          onJump={handleJump}
        />
      )}
    </div>
  );
}
