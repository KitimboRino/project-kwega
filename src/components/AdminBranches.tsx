"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fmt } from "@/lib/data";
import { Icon } from "@/components/Icons";

type BranchRow = { name: string; memberCount: number; funds: number };

export default function AdminBranches() {
  const supabase = createClient();
  const [branches, setBranches] = useState<BranchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [newBranch, setNewBranch] = useState("");
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState("");
  const [deletingName, setDeletingName] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [branchesRes, membersRes] = await Promise.all([
      supabase.from("branches").select("name").order("name"),
      supabase.from("members").select("branch, principal, interest"),
    ]);

    const totals = new Map<string, { count: number; funds: number }>();
    for (const m of (membersRes.data ?? []) as { branch: string; principal: number; interest: number }[]) {
      const t = totals.get(m.branch) ?? { count: 0, funds: 0 };
      t.count += 1;
      t.funds += m.principal + m.interest;
      totals.set(m.branch, t);
    }

    const rows = ((branchesRes.data ?? []) as { name: string }[]).map((b) => ({
      name: b.name,
      memberCount: totals.get(b.name)?.count ?? 0,
      funds: totals.get(b.name)?.funds ?? 0,
    }));
    setBranches(rows);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdd = async () => {
    const name = newBranch.trim();
    if (!name) {
      setNotice("Enter a branch name.");
      return;
    }
    setAdding(true);
    setNotice("");
    const { error } = await supabase.from("branches").insert({ name });
    setAdding(false);
    if (error) {
      setNotice(error.code === "23505" ? "A branch with that name already exists." : error.message);
      return;
    }
    setNewBranch("");
    load();
  };

  const handleDelete = async (name: string) => {
    if (!window.confirm(`Delete branch "${name}"? This can't be undone.`)) return;
    setDeletingName(name);
    setNotice("");
    const { error } = await supabase.from("branches").delete().eq("name", name);
    setDeletingName(null);
    if (error) {
      setNotice(
        error.code === "23503"
          ? `Can't delete "${name}" — it still has members or officers assigned to it.`
          : error.message
      );
      return;
    }
    load();
  };

  if (loading) return <div style={{ padding: 40, color: "var(--muted)" }}>Loading…</div>;

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Branches</h2>
          <p>Add, review, and remove branches across the platform</p>
        </div>
      </div>

      {notice && (
        <p style={{ fontSize: 12.5, marginBottom: 14, color: "var(--danger)", fontWeight: 600 }}>{notice}</p>
      )}

      <div className="panel">
        <h3>Add a branch</h3>
        <p className="hint">New branches immediately become selectable when opening accounts or editing officers.</p>
        <div className="form-row">
          <div className="field">
            <label>Branch name</label>
            <input value={newBranch} onChange={(e) => setNewBranch(e.target.value)} placeholder="e.g. Mbarara" />
          </div>
        </div>
        <button className="btn btn-primary" onClick={handleAdd} disabled={adding}>
          {Icon.plus} {adding ? "Adding…" : "Add branch"}
        </button>
      </div>

      <div className="tbl-wrap section-gap">
        <div className="tbl-top">
          <h3>All branches</h3>
        </div>
        <table>
          <thead>
            <tr>
              <th>Branch</th><th className="num">Members</th><th className="num">Funds under management</th><th></th>
            </tr>
          </thead>
          <tbody>
            {branches.map((b) => (
              <tr key={b.name}>
                <td><b>{b.name}</b></td>
                <td className="num">{b.memberCount}</td>
                <td className="num">{fmt(b.funds)}</td>
                <td>
                  <button
                    className="btn btn-ghost"
                    style={{ padding: "4px 10px", fontSize: 12 }}
                    onClick={() => handleDelete(b.name)}
                    disabled={deletingName === b.name}
                  >
                    {deletingName === b.name ? "Deleting…" : "Delete"}
                  </button>
                </td>
              </tr>
            ))}
            {branches.length === 0 && (
              <tr>
                <td colSpan={4} style={{ textAlign: "center", color: "var(--muted)", padding: "24px 0" }}>
                  No branches yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
