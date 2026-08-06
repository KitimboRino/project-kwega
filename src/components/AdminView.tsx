"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fmt, isLocked, type Member } from "@/lib/data";
import { Icon } from "@/components/Icons";

type MemberRow = {
  id: string;
  account_no: string;
  branch: string;
  principal: number;
  interest: number;
  start_date: string;
  member_profile: { name: string } | null;
  officer_profile: { name: string } | null;
};

function mapRow(row: MemberRow): Member {
  return {
    id: row.id,
    name: row.member_profile?.name ?? "Unknown",
    accountNo: row.account_no,
    phone: "",
    officer: row.officer_profile?.name ?? "Unassigned",
    branch: row.branch,
    status: isLocked(row.start_date) ? "locked" : "active",
    principal: row.principal,
    interest: row.interest,
    dailyAmount: 0,
    startDate: row.start_date,
    transactions: [],
  };
}

const BRANCH_COLORS = ["#16a34a", "#4ade80", "#fbbf24", "#fef3c7", "#0ea5e9", "#f472b6"];

// Illustrative placeholder — a real month-by-month chart needs real
// transaction volume to look meaningful (see plan notes). Not wired to
// live data yet.
const FLOW = [
  { m: "Mar", inc: 62, exp: 26 },
  { m: "Apr", inc: 88, exp: 40 },
  { m: "May", inc: 74, exp: 34 },
  { m: "Jun", inc: 60, exp: 26 },
  { m: "Jul", inc: 90, exp: 40 },
  { m: "Aug", inc: 62, exp: 28 },
];

export default function AdminView({ tab }: { tab: string }) {
  const supabase = createClient();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("members")
      .select(
        "id, account_no, branch, principal, interest, start_date, member_profile:profiles!members_id_fkey(name), officer_profile:profiles!members_officer_id_fkey(name)"
      );
    if (data) setMembers((data as unknown as MemberRow[]).map(mapRow));
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const totalFunds = members.reduce((s, m) => s + m.principal + m.interest, 0);
  const totalInterest = members.reduce((s, m) => s + m.interest, 0);

  const byBranch = new Map<string, number>();
  for (const m of members) byBranch.set(m.branch, (byBranch.get(m.branch) ?? 0) + m.principal + m.interest);
  const CATS = Array.from(byBranch.entries())
    .map(([name, amt], i) => ({
      name,
      amt,
      pct: totalFunds > 0 ? Math.round((amt / totalFunds) * 100) : 0,
      color: BRANCH_COLORS[i % BRANCH_COLORS.length],
    }))
    .sort((a, b) => b.amt - a.amt);

  let acc = 0;
  const stops = CATS.length
    ? CATS.map((c) => {
        const start = acc;
        acc += c.pct;
        return `${c.color} ${start}% ${acc}%`;
      }).join(", ")
    : "var(--line) 0% 100%";

  if (loading) return <div style={{ padding: 40, color: "var(--muted)" }}>Loading…</div>;

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Reports</h2>
          <p>Full visibility across members, officers, and funds</p>
        </div>
        <div className="actions">
          <button className="btn btn-ghost">Compare</button>
          <button className="btn btn-primary">Export</button>
        </div>
      </div>

      {tab === "home" && (
        <>
          <div className="grid g4">
            <div className="sum-card">
              <div className="row1">
                <div className="tile">{Icon.income}</div>
                <div className="lbl">Total funds</div>
                <div className="dots">···</div>
              </div>
              <div className="val">{fmt(totalFunds)}</div>
              <div className="cur">Ushs · all branches</div>
            </div>
            <div className="sum-card">
              <div className="row1">
                <div className="tile">{Icon.expense}</div>
                <div className="lbl">Interest accrued</div>
                <div className="dots">···</div>
              </div>
              <div className="val">{fmt(totalInterest)}</div>
              <div className="cur">across all members</div>
            </div>
            <div className="sum-card dark">
              <div className="row1">
                <div className="tile">{Icon.chart}</div>
                <div className="lbl">Principal saved</div>
                <div className="dots">···</div>
              </div>
              <div className="val">{fmt(totalFunds - totalInterest)}</div>
              <div className="cur">funds minus interest</div>
            </div>
            <div className="sum-card">
              <div className="row1">
                <div className="tile">{Icon.users}</div>
                <div className="lbl">Total members</div>
                <div className="dots">···</div>
              </div>
              <div className="val">{members.length}</div>
              <div className="cur">across {CATS.length} branches</div>
            </div>
          </div>

          <div className="grid g2 section-gap">
            <div className="panel">
              <div className="panel-head">
                <div>
                  <h3>Cash flow</h3>
                  <p className="hint">Contributions vs payouts over time · illustrative, not live yet</p>
                </div>
                <div className="legend-toggle">
                  <span><i className="dot g" /> Income</span>
                  <span><i className="dot y" /> Expense</span>
                  <span className="on"><i className="dot k" /> Both</span>
                </div>
              </div>
              <div className="chart">
                {FLOW.map((f) => (
                  <div className="col" key={f.m}>
                    <div className="pair">
                      <div className="bar inc" style={{ height: `${f.inc}%` }}>
                        <span>{f.inc}%</span>
                      </div>
                      <div className="bar exp" style={{ height: `${f.exp}%` }}>
                        <span>{f.exp}%</span>
                      </div>
                    </div>
                    <div className="xlabel">{f.m}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="panel">
              <h3>Funds by branch</h3>
              <p className="hint">Share of total under management</p>
              <div className="donut-wrap" style={{ marginTop: 8 }}>
                <div className="donut" style={{ background: `conic-gradient(${stops})` }}>
                  <div className="hole">
                    <div>
                      <b>{fmt(totalFunds)}</b>
                      <small>total</small>
                    </div>
                  </div>
                </div>
                <div className="donut-legend">
                  {CATS.map((c) => (
                    <div className="li" key={c.name}>
                      <i className="dot" style={{ background: c.color }} />
                      {c.name}
                      <span className="amt">{fmt(c.amt)}</span>
                    </div>
                  ))}
                  {CATS.length === 0 && <p style={{ fontSize: 12.5, color: "var(--muted)" }}>No members yet.</p>}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      <div className="tbl-wrap section-gap">
        <div className="tbl-top">
          <h3>All members</h3>
          <button className="btn btn-ghost" style={{ padding: "8px 14px" }}>Filter</button>
        </div>
        <table>
          <thead>
            <tr>
              <th>Member</th><th>Officer</th><th>Status</th>
              <th className="num">Principal</th><th className="num">Interest</th><th className="num">Balance</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id}>
                <td>
                  <span className="avatar">{m.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}</span>
                  <span className="uname"><b>{m.name}</b><small>{m.accountNo}</small></span>
                </td>
                <td>{m.officer}</td>
                <td><span className={`tag ${m.status}`}>{m.status[0].toUpperCase() + m.status.slice(1)}</span></td>
                <td className="num">{fmt(m.principal)}</td>
                <td className="num" style={{ color: "var(--forest)" }}>{fmt(m.interest)}</td>
                <td className="num">{fmt(m.principal + m.interest)}</td>
              </tr>
            ))}
            {members.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", color: "var(--muted)", padding: "24px 0" }}>
                  No members yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <p style={{ fontSize: 11.5, color: "var(--muted)", padding: "12px 22px" }}>
          Totals — funds {fmt(totalFunds)} Ushs · interest {fmt(totalInterest)} Ushs
        </p>
      </div>
    </>
  );
}
