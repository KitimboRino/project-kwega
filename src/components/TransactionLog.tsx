"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fmt } from "@/lib/data";
import { Icon } from "@/components/Icons";

export type LogTxn = {
  id: string;
  type: string;
  amount: number;
  balance: number;
  occurred_at: string;
  withdrawal_kind: string | null;
  members?: { account_no: string; profiles: { name: string } | null } | null;
};

// Shared by the platform-wide Savings tab (showMember, no height cap — the
// page itself scrolls) and the Users tab's per-member log (no member
// column, capped height — it lives inside an edit panel). Edit/delete both
// go through the same admin RPCs either way, so a fix made from one place
// behaves identically to a fix made from the other.
export default function TransactionLog({
  txns,
  onReload,
  showMember = false,
  maxHeight,
}: {
  txns: LogTxn[];
  onReload: () => void;
  showMember?: boolean;
  maxHeight?: number;
}) {
  const supabase = createClient();

  const [editing, setEditing] = useState<LogTxn | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editNotice, setEditNotice] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [listNotice, setListNotice] = useState("");

  // A withdrawal logged before withdrawal_kind existed doesn't record
  // which bucket it drew from, so its amount can't be safely corrected
  // or the row safely deleted — only the date, for those old rows.
  const canEditAmount = (t: LogTxn) => t.type !== "withdrawal" || t.withdrawal_kind !== null;
  const canDelete = (t: LogTxn) => t.type !== "withdrawal" || t.withdrawal_kind !== null;

  const startEdit = (t: LogTxn) => {
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
    onReload();
  };

  const handleDelete = async (t: LogTxn) => {
    const who = t.members?.profiles?.name ?? "this member";
    if (!window.confirm(`Delete this ${t.type} of ${fmt(Math.abs(t.amount))} Ushs for ${who}? Their balance will be adjusted back. This can't be undone.`)) {
      return;
    }
    setDeletingId(t.id);
    setListNotice("");
    const { error } = await supabase.rpc("admin_delete_transaction", { p_transaction_id: t.id });
    setDeletingId(null);
    if (error) {
      setListNotice(error.message);
      return;
    }
    if (editing?.id === t.id) setEditing(null);
    onReload();
  };

  return (
    <>
      {listNotice && (
        <p style={{ fontSize: 12.5, marginBottom: 12, color: "var(--danger)", fontWeight: 600 }}>{listNotice}</p>
      )}

      {editing && (
        <div className="panel" style={{ marginBottom: 16 }}>
          <h3>Edit transaction</h3>
          <p className="hint">
            {canEditAmount(editing)
              ? "Date and amount can both be corrected. The member's balance is adjusted by the difference."
              : "This withdrawal predates bucket tracking — only the date can be corrected. Reverse and re-enter instead if the amount itself was wrong."}
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
                disabled={!canEditAmount(editing)}
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

      <div className="tbl-wrap" style={maxHeight ? { maxHeight, overflowY: "auto" } : undefined}>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              {showMember && <th>Member</th>}
              <th>Type</th>
              <th className="num">Amount</th><th className="num">Balance</th><th></th>
            </tr>
          </thead>
          <tbody>
            {txns.map((t) => (
              <tr key={t.id}>
                <td>{new Date(t.occurred_at).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })}</td>
                {showMember && (
                  <td>
                    <span className="uname">
                      <b>{t.members?.profiles?.name ?? "Unknown"}</b>
                      <small>{t.members?.account_no}</small>
                    </span>
                  </td>
                )}
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
                  <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                    <button className="btn btn-ghost" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => startEdit(t)}>
                      {Icon.edit} Edit
                    </button>
                    <button
                      className="btn btn-ghost"
                      style={{ padding: "4px 10px", fontSize: 12, color: "var(--danger)" }}
                      onClick={() => handleDelete(t)}
                      disabled={deletingId === t.id || !canDelete(t)}
                      title={canDelete(t) ? undefined : "Predates bucket tracking — can't be safely deleted"}
                    >
                      {deletingId === t.id ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {txns.length === 0 && (
              <tr>
                <td colSpan={showMember ? 6 : 5} style={{ textAlign: "center", color: "var(--muted)", padding: "24px 0" }}>
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
