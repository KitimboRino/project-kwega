"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { MEMBERS, RULES, fmt } from "@/lib/data";
import { Icon } from "@/components/Icons";

export default function OfficerView({ tab }: { tab: string }) {
  const { user } = useAuth();
  const myMembers = MEMBERS.filter((m) => m.officer === user?.name);
  const [daily, setDaily] = useState("2,000");
  const [notice, setNotice] = useState("");

  const handleCreate = () => {
    const val = Number(daily.replace(/,/g, ""));
    if (val < RULES.MIN_DAILY) {
      setNotice(`Daily amount must be at least ${fmt(RULES.MIN_DAILY)} Ushs.`);
      return;
    }
    setNotice("Account created. The member can now sign in to view it.");
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Officer desk</h2>
          <p>Register members and record daily contributions · {user?.name}</p>
        </div>
        <div className="actions">
          <button className="btn btn-primary">{Icon.plus} New account</button>
        </div>
      </div>

      {tab === "home" && (
        <div className="grid g3">
          <div className="sum-card">
            <div className="row1">
              <div className="tile">{Icon.users}</div>
              <div className="lbl">Accounts opened</div>
              <div className="dots">···</div>
            </div>
            <div className="val">{myMembers.length} <span className="delta up">+{myMembers.length}</span></div>
            <div className="cur">you manage</div>
          </div>
          <div className="sum-card">
            <div className="row1">
              <div className="tile">{Icon.income}</div>
              <div className="lbl">Contributions logged</div>
              <div className="dots">···</div>
            </div>
            <div className="val">312</div>
            <div className="cur">across members today</div>
          </div>
          <div className="sum-card dark">
            <div className="row1">
              <div className="tile">{Icon.list}</div>
              <div className="lbl">Pending sign-ups</div>
              <div className="dots">···</div>
            </div>
            <div className="val">3</div>
            <div className="cur">awaiting verification</div>
          </div>
        </div>
      )}

      {(tab === "home" || tab === "new") && (
        <div className="grid g2 section-gap">
          <div className="panel">
            <h3>Open a new account</h3>
            <p className="hint">Members can only view their own account after registration.</p>
            <div className="form-row">
              <div className="field"><label>Full name</label><input placeholder="e.g. Grace Nakato" /></div>
              <div className="field"><label>Phone number</label><input placeholder="+256 7XX XXX XXX" /></div>
            </div>
            <div className="form-row">
              <div className="field"><label>National ID</label><input placeholder="CM..." /></div>
              <div className="field">
                <label>Daily amount (min {fmt(RULES.MIN_DAILY)})</label>
                <input className="mono" value={daily} onChange={(e) => setDaily(e.target.value)} />
              </div>
            </div>
            <div className="form-row">
              <div className="field">
                <label>Branch</label>
                <select><option>Kampala Central</option><option>Nakawa</option><option>Entebbe</option></select>
              </div>
              <div className="field"><label>Start date</label><input type="date" defaultValue="2026-07-28" /></div>
            </div>
            <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={handleCreate}>
              {Icon.plus} Create account
            </button>
            {notice && (
              <p style={{ fontSize: 12.5, marginTop: 12, color: "var(--forest)", fontWeight: 600 }}>{notice}</p>
            )}
          </div>

          <div className="panel">
            <h3>Quick log contribution</h3>
            <p className="hint">Record a daily deposit against a member&apos;s account.</p>
            <div className="field" style={{ marginBottom: 14 }}>
              <label>Find member</label><input placeholder="Search name or account #" />
            </div>
            <div className="field" style={{ marginBottom: 14 }}>
              <label>Amount</label><input className="mono" defaultValue="2,000" />
            </div>
            <button className="btn btn-lime" style={{ width: "100%", justifyContent: "center" }}>Log deposit</button>
            <div style={{ marginTop: 20, borderTop: "1px solid var(--line)", paddingTop: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".5px", color: "var(--muted)", marginBottom: 10 }}>
                Logged today
              </div>
              {myMembers.slice(0, 3).map((m) => (
                <div key={m.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "7px 0" }}>
                  <span>{m.name} · {m.accountNo}</span>
                  <span className="mono" style={{ color: "var(--forest)" }}>+{fmt(m.dailyAmount)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {(tab === "home" || tab === "accounts") && (
        <div className="tbl-wrap section-gap">
          <div className="tbl-top">
            <h3>Accounts you manage</h3>
            <button className="btn btn-ghost" style={{ padding: "8px 14px" }}>+ New</button>
          </div>
          <table>
            <thead>
              <tr>
                <th>Member</th><th>Account #</th><th>Status</th>
                <th className="num">Balance</th><th className="num">Daily</th>
              </tr>
            </thead>
            <tbody>
              {myMembers.map((m) => (
                <tr key={m.id}>
                  <td>
                    <span className="avatar">{m.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}</span>
                    <span className="uname"><b>{m.name}</b><small>{m.phone}</small></span>
                  </td>
                  <td className="mono">{m.accountNo}</td>
                  <td><span className={`tag ${m.status}`}>{m.status[0].toUpperCase() + m.status.slice(1)}</span></td>
                  <td className="num">{fmt(m.principal + m.interest)}</td>
                  <td className="num">{fmt(m.dailyAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
