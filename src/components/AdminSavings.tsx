"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fmt } from "@/lib/data";
import { downloadCSV } from "@/lib/csv";
import { Icon } from "@/components/Icons";

type TxnRow = {
  id: string;
  type: string;
  amount: number;
  balance: number;
  occurred_at: string;
  members: { account_no: string; profiles: { name: string } | null } | null;
};

export default function AdminSavings() {
  const supabase = createClient();
  const [txns, setTxns] = useState<TxnRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [editing, setEditing] = useState<TxnRow | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editNotice, setEditNotice] = useState("");

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("transactions")
      .select("id, type, amount, balance, occurred_at, members(account_no, profiles!members_id_fkey(name))")
      .order("occurred_at", { ascending: false })
      .limit(500);
    if (data) setTxns(data as unknown as TxnRow[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = txns.filter((t) => {
    if (!search) return true;
    const name = t.members?.profiles?.name ?? "";
    const acc = t.members?.account_no ?? "";
    return name.toLowerCase().includes(search.toLowerCase()) || acc.toLowerCase().includes(search.toLowerCase());
  });

  const startEdit = (t: TxnRow) => {
    setEditing(t);
    setEditDate(t.occurred_at.slice(0, 10));
    setEditAmount(String(Math.abs(t.amount)));
    setEditNotice("");
  };

  const saveEdit = async () => {
    if (!editing) return;
    const val = Number(editAmount.replace(/,/g, ""));
    if (!val || val <= 0) {
      setEditNotice("Enter a valid amount.");
      return;
    }
    setEditSaving(true);
    setEditNotice("");
    // Reconstruct the correctly-signed amount (withdrawals are stored
    // negative) — for withdrawals the amount field stays disabled/
    // unchanged, so this always resolves back to the original value and
    // the RPC only applies the date correction, per its own restriction.
    const signedAmount = editing.type === "withdrawal" ? -val : val;
    const { error } = await supabase.rpc("admin_edit_transaction", {
      p_transaction_id: editing.id,
      p_occurred_at: new Date(editDate).toISOString(),
      p_amount: signedAmount,
    });
    setEditSaving(false);
    if (error) {
      setEditNotice(error.message);
      return;
    }
    setEditing(null);
    load();
  };

  if (loading) return <div style={{ padding: 40, color: "var(--muted)" }}>Loading…</div>;

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Savings</h2>
          <p>Every deposit, withdrawal, and interest credit across the platform</p>
        </div>
        <div className="actions">
          <button
            className="btn btn-primary"
            onClick={() =>
              downloadCSV(
                "all-transactions.csv",
                ["Date", "Member", "Account #", "Type", "Amount", "Balance"],
                filtered.map((t) => [
                  new Date(t.occurred_at).toLocaleDateString("en-US"),
                  t.members?.profiles?.name ?? "",
                  t.members?.account_no ?? "",
                  t.type,
                  t.amount,
                  t.balance,
                ])
              )
            }
          >
            Export
          </button>
        </div>
      </div>

      <div className="field" style={{ marginBottom: 16, maxWidth: 340 }}>
        <label>Search</label>
        <input
          placeholder="Search member name or account #"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {editing && (
        <div className="panel section-gap" style={{ marginBottom: 16 }}>
          <h3>Edit transaction</h3>
          <p className="hint">
            {editing.type === "withdrawal"
              ? "Only the date can be corrected for withdrawals — reverse and re-enter if the amount itself was wrong."
              : "Date and amount can both be corrected. The member's balance is adjusted by the difference."}
          </p>
          <div className="form-row">
            <div className="field">
              <label>Date</label>
              <input
                type="date"
                max={new Date().toISOString().slice(0, 10)}
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
              />
            </div>
            <div className="field">
              <label>Amount</label>
              <input
                className="mono"
                value={editAmount}
                disabled={editing.type === "withdrawal"}
                onChange={(e) => setEditAmount(e.target.value)}
              />
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-primary" onClick={saveEdit} disabled={editSaving}>
              {editSaving ? "Saving…" : "Save"}
            </button>
            <button className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
          </div>
          {editNotice && (
            <p style={{ fontSize: 12.5, marginTop: 12, color: "var(--danger)", fontWeight: 600 }}>{editNotice}</p>
          )}
        </div>
      )}

      <div className="tbl-wrap section-gap">
        <table>
          <thead>
            <tr>
              <th>Date</th><th>Member</th><th>Type</th>
              <th className="num">Amount</th><th className="num">Balance</th><th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => (
              <tr key={t.id}>
                <td>{new Date(t.occurred_at).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })}</td>
                <td>
                  <span className="uname">
                    <b>{t.members?.profiles?.name ?? "Unknown"}</b>
                    <small>{t.members?.account_no}</small>
                  </span>
                </td>
                <td>
                  <span className={`tag ${t.type === "deposit" ? "dep" : t.type === "interest" ? "int" : "wd"}`}>
                    {t.type[0].toUpperCase() + t.type.slice(1)}
                  </span>
                </td>
                <td className="num" style={{ color: t.amount < 0 ? "var(--danger)" : "var(--forest)" }}>
                  {t.amount < 0 ? "−" : "+"}{fmt(Math.abs(t.amount))}
                </td>
                <td className="num">{fmt(t.balance)}</td>
                <td>
                  <button className="btn btn-ghost" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => startEdit(t)}>
                    {Icon.edit} Edit
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", color: "var(--muted)", padding: "24px 0" }}>
                  No transactions yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
