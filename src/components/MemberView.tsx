"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { fmt, isLocked, unlockDate, type Member } from "@/lib/data";
import { Icon } from "@/components/Icons";

type MemberRow = {
  account_no: string;
  principal: number;
  interest: number;
  daily_amount: number;
  start_date: string;
  profiles: { name: string; phone: string | null } | null;
  transactions: { id: string; type: string; amount: number; balance: number; occurred_at: string }[];
};

function mapRow(row: MemberRow, fallbackName: string): Member {
  return {
    id: "",
    name: row.profiles?.name ?? fallbackName,
    accountNo: row.account_no,
    phone: row.profiles?.phone ?? "",
    officer: "",
    branch: "",
    status: isLocked(row.start_date) ? "locked" : "active",
    principal: row.principal,
    interest: row.interest,
    dailyAmount: row.daily_amount,
    startDate: row.start_date,
    transactions: row.transactions
      .slice()
      .sort((a, b) => +new Date(b.occurred_at) - +new Date(a.occurred_at))
      .map((t) => ({
        date: new Date(t.occurred_at).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }),
        type: t.type as "deposit" | "interest" | "withdrawal",
        amount: t.amount,
        balance: t.balance,
      })),
  };
}

export default function MemberView({ tab }: { tab: string }) {
  const { user } = useAuth();
  const supabase = createClient();
  const [me, setMe] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!user) return;
    const { data, error: err } = await supabase
      .from("members")
      .select("account_no, principal, interest, daily_amount, start_date, profiles!members_id_fkey(name, phone), transactions(*)")
      .eq("id", user.id)
      .maybeSingle();
    if (err) {
      setError(err.message);
    } else if (data) {
      setMe(mapRow(data as unknown as MemberRow, user.name));
    }
    setLoading(false);
  }, [user, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const withdraw = async (kind: "interest" | "principal", amount: number) => {
    if (!user || amount <= 0) return;
    if (!window.confirm(`Withdraw ${fmt(amount)} Ushs of ${kind}?`)) return;
    setBusy(true);
    setError("");
    const { error: err } = await supabase.rpc("request_withdrawal", {
      p_member_id: user.id,
      p_kind: kind,
      p_amount: amount,
    });
    setBusy(false);
    if (err) setError(err.message);
    else load();
  };

  if (loading) return <div style={{ padding: 40, color: "var(--muted)" }}>Loading…</div>;
  if (error && !me) return <div style={{ padding: 40, color: "var(--danger)" }}>{error}</div>;
  if (!me) {
    return (
      <div className="panel" style={{ maxWidth: 480, margin: "40px auto", textAlign: "center" }}>
        <h3>No savings account yet</h3>
        <p className="hint">
          Your login works, but a savings officer hasn&apos;t opened your account yet. Visit a branch or
          contact your officer to get started — your balance and activity will show up here once they do.
        </p>
      </div>
    );
  }

  const balance = me.principal + me.interest;
  const locked = isLocked(me.startDate);
  const unlock = unlockDate(me.startDate).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const monthTarget = me.dailyAmount * 30;
  const monthSaved = Math.round(monthTarget * 0.74);
  const pct = Math.round((monthSaved / monthTarget) * 100);

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Hi, {me.name.split(" ")[0]}</h2>
          <p>
            Account {me.accountNo} · Member since{" "}
            {new Date(me.startDate).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </p>
        </div>
        <div className="actions">
          <button className="btn btn-primary" disabled title="Contributions are logged by your savings officer">
            {Icon.plus} Add contribution
          </button>
        </div>
      </div>

      {error && (
        <p style={{ fontSize: 12.5, marginBottom: 14, color: "var(--danger)", fontWeight: 600 }}>{error}</p>
      )}

      {(tab === "home" || tab === "withdraw" || tab === "activity") && (
        <div className="grid g4">
          <div className="sum-card dark">
            <div className="row1">
              <div className="tile">{Icon.wallet}</div>
              <div className="lbl">Total balance</div>
              <div className="dots">···</div>
            </div>
            <div className="val">
              {fmt(balance)} <span className="delta up">▲ 7%</span>
            </div>
            <div className="cur">Ushs · principal + interest</div>
          </div>

          <div className="sum-card">
            <div className="row1">
              <div className="tile">{Icon.lock}</div>
              <div className="lbl">Principal saved</div>
              <div className="dots">···</div>
            </div>
            <div className="val">{fmt(me.principal)}</div>
            <div className="cur">{locked ? `Locked until ${unlock}` : "Unlocked"}</div>
          </div>

          <div className="sum-card">
            <div className="row1">
              <div className="tile">{Icon.income}</div>
              <div className="lbl">Interest earned</div>
              <div className="dots">···</div>
            </div>
            <div className="val" style={{ color: "var(--forest)" }}>{fmt(me.interest)}</div>
            <div className="cur">Available to withdraw</div>
          </div>

          <div className="sum-card">
            <div className="row1">
              <div className="tile">{Icon.chart}</div>
              <div className="lbl">Total profits</div>
              <div className="dots">···</div>
            </div>
            <div className="val" style={{ color: "#b45309" }}>{fmt(me.interest)}</div>
            <div className="cur">All-time earnings</div>
          </div>
        </div>
      )}

      {(tab === "home" || tab === "withdraw") && (
        <div className="grid g2 section-gap">
          <div className="panel">
            <div className="panel-head">
              <div>
                <h3>This month&apos;s contribution</h3>
                <p className="hint">Minimum 2,000 Ushs per day builds your monthly total.</p>
              </div>
            </div>
            <div className="contrib-bar">
              <div className="contrib-fill" style={{ width: `${pct}%` }} />
            </div>
            <div className="bar-legend">
              <span>{fmt(monthSaved)} / {fmt(monthTarget)} Ushs</span>
              <span>22 of 30 days</span>
            </div>
            <div style={{ marginTop: 18, display: "flex", gap: 10 }}>
              <button className="btn btn-primary" disabled title="Contributions are logged by your savings officer">
                {Icon.plus} Add contribution
              </button>
              <button className="btn btn-ghost">View schedule</button>
            </div>
          </div>

          <div className="panel">
            <h3>Withdraw</h3>
            <p className="hint">Interest is available anytime. Principal unlocks after 1 year.</p>
            <div className="split">
              <div className="split-box">
                <div className="k">Interest</div>
                <div className="v" style={{ color: "var(--forest)" }}>{fmt(me.interest)}</div>
                <button
                  className="btn btn-lime"
                  style={{ width: "100%", justifyContent: "center" }}
                  disabled={busy || me.interest <= 0}
                  onClick={() => withdraw("interest", me.interest)}
                >
                  Withdraw
                </button>
              </div>
              <div className="split-box locked">
                <div className="k">Principal</div>
                <div className="v">{fmt(me.principal)}</div>
                <button
                  className="btn btn-ghost"
                  disabled={locked || busy || me.principal <= 0}
                  style={{ width: "100%", justifyContent: "center" }}
                  onClick={() => withdraw("principal", me.principal)}
                >
                  {locked ? "Locked" : "Withdraw"}
                </button>
              </div>
            </div>
            {locked && (
              <div className="lock-note">
                {Icon.lock}
                Principal unlocks on {unlock}
              </div>
            )}
          </div>
        </div>
      )}

      {(tab === "home" || tab === "activity") && (
        <div className="tbl-wrap section-gap">
          <div className="tbl-top">
            <h3>Recent activity</h3>
            <button className="btn btn-ghost" style={{ padding: "8px 14px" }}>Export</button>
          </div>
          <table>
            <thead>
              <tr>
                <th>Date</th><th>Type</th>
                <th className="num">Amount</th><th className="num">Balance</th>
              </tr>
            </thead>
            <tbody>
              {me.transactions.map((t, i) => (
                <tr key={i}>
                  <td>{t.date}</td>
                  <td>
                    <span className={`tag ${t.type === "deposit" ? "dep" : t.type === "interest" ? "int" : "wd"}`}>
                      {t.type[0].toUpperCase() + t.type.slice(1)}
                    </span>
                  </td>
                  <td className="num" style={{ color: t.amount < 0 ? "var(--danger)" : "var(--forest)" }}>
                    {t.amount < 0 ? "−" : "+"}{fmt(Math.abs(t.amount))}
                  </td>
                  <td className="num">{fmt(t.balance)}</td>
                </tr>
              ))}
              {me.transactions.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center", color: "var(--muted)", padding: "24px 0" }}>
                    No activity yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
