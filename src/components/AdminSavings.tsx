"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { downloadCSV } from "@/lib/csv";
import { Loader } from "@/components/Loader";
import TransactionLog, { type LogTxn } from "@/components/TransactionLog";

export default function AdminSavings() {
  const supabase = createClient();
  const [txns, setTxns] = useState<LogTxn[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("transactions")
      .select("id, type, amount, balance, occurred_at, withdrawal_kind, members(account_no, profiles!members_id_fkey(name))")
      .order("occurred_at", { ascending: false })
      .limit(500);
    if (data) setTxns(data as unknown as LogTxn[]);
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

  if (loading) return <Loader />;

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

      <div className="section-gap">
        <TransactionLog txns={filtered} onReload={load} showMember />
      </div>
    </>
  );
}
