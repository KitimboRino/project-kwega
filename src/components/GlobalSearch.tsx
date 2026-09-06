"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "@/components/Icons";
import { Loader } from "@/components/Loader";

type Result = { id: string; name: string; sub: string; tag: string };

// The whole platform is small (tens of accounts, not thousands), so this
// loads the searchable set once when the box opens and filters client-side
// as you type — same trade-off the officer's "Quick log" and admin's "Find
// a user" search boxes already make, just shared across both roles here.
export default function GlobalSearch({
  role,
  officerId,
  open,
  onClose,
  onJump,
}: {
  role: "officer" | "admin";
  officerId?: string;
  open: boolean;
  onClose: () => void;
  onJump: (id: string) => void;
}) {
  const supabase = createClient();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const loadedRef = useRef(false);

  const loadPool = useCallback(async () => {
    setLoading(true);
    if (role === "officer" && officerId) {
      const { data } = await supabase
        .from("members")
        .select("id, account_no, branch, profiles!members_id_fkey(name, phone)")
        .eq("officer_id", officerId);
      setResults(
        (data ?? []).map((r) => {
          const row = r as unknown as { id: string; account_no: string; branch: string; profiles: { name: string; phone: string | null } | null };
          return { id: row.id, name: row.profiles?.name ?? "Unknown", sub: `${row.account_no} · ${row.branch}`, tag: "member" };
        })
      );
    } else {
      const [profilesRes, membersRes] = await Promise.all([
        supabase.from("profiles").select("id, name, role, branch"),
        supabase.from("members").select("id, account_no, branch"),
      ]);
      const accountByMember = new Map((membersRes.data ?? []).map((m) => [m.id, m.account_no]));
      setResults(
        (profilesRes.data ?? []).map((p) => ({
          id: p.id,
          name: p.name,
          sub: accountByMember.has(p.id) ? `${accountByMember.get(p.id)} · ${p.branch ?? ""}` : p.role,
          tag: p.role,
        }))
      );
    }
    setLoading(false);
    loadedRef.current = true;
  }, [supabase, role, officerId]);

  useEffect(() => {
    if (open) {
      setQuery("");
      if (!loadedRef.current) loadPool();
      const t = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
  }, [open, loadPool]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const q = query.trim().toLowerCase();
  const filtered = q
    ? results.filter((r) => r.name.toLowerCase().includes(q) || r.sub.toLowerCase().includes(q)).slice(0, 8)
    : results.slice(0, 8);

  return (
    <div className="search-overlay" onClick={onClose}>
      <div className="search-modal" onClick={(e) => e.stopPropagation()}>
        <div className="search-modal-head">
          {Icon.search}
          <input
            ref={inputRef}
            placeholder={role === "officer" ? "Search your members by name or account #…" : "Search anyone by name, role, or account #…"}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button className="search-modal-close" onClick={onClose} aria-label="Close search">
            {Icon.close}
          </button>
        </div>
        <div className="search-modal-results">
          {loading && <Loader label="Loading…" />}
          {!loading &&
            filtered.map((r) => (
              <div
                key={r.id}
                className="search-modal-row"
                onClick={() => {
                  onJump(r.id);
                  onClose();
                }}
              >
                <span className="avatar" style={{ width: 32, height: 32, fontSize: 12 }}>
                  {r.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}
                </span>
                <span className="uname">
                  <b>{r.name}</b>
                  <small>{r.sub}</small>
                </span>
                {role === "admin" && <span className={`tag ${r.tag === "admin" ? "locked" : "active"}`}>{r.tag}</span>}
              </div>
            ))}
          {!loading && filtered.length === 0 && (
            <div className="search-modal-empty">{q ? "No matches." : "Nothing to search yet."}</div>
          )}
        </div>
      </div>
    </div>
  );
}
