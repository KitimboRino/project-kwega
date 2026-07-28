"use client";

import { MEMBERS, BRANCHES, fmt } from "@/lib/data";
import { Icon } from "@/components/Icons";

// Income = deposits in, Expense = withdrawals/payouts — modeled per month
const FLOW = [
  { m: "Mar", inc: 62, exp: 26 },
  { m: "Apr", inc: 88, exp: 40 },
  { m: "May", inc: 74, exp: 34 },
  { m: "Jun", inc: 60, exp: 26 },
  { m: "Jul", inc: 90, exp: 40 },
  { m: "Aug", inc: 62, exp: 28 },
];

const CATS = [
  { name: "Kampala Central", pct: 41, color: "#16a34a", amt: "128.2M" },
  { name: "Nakawa", pct: 24, color: "#4ade80", amt: "74.0M" },
  { name: "Entebbe", pct: 20, color: "#fbbf24", amt: "61.5M" },
  { name: "Jinja", pct: 15, color: "#fef3c7", amt: "48.7M" },
];

export default function AdminView({ tab }: { tab: string }) {
  const totalFunds = MEMBERS.reduce((s, m) => s + m.principal + m.interest, 0);
  const totalInterest = MEMBERS.reduce((s, m) => s + m.interest, 0);

  // build conic-gradient for donut
  let acc = 0;
  const stops = CATS.map((c) => {
    const start = acc;
    acc += c.pct;
    return `${c.color} ${start}% ${acc}%`;
  }).join(", ");

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
              <div className="val">312.4M <span className="delta up">+12.4%</span></div>
              <div className="cur">Ushs · all branches</div>
            </div>
            <div className="sum-card">
              <div className="row1">
                <div className="tile">{Icon.expense}</div>
                <div className="lbl">Interest paid</div>
                <div className="dots">···</div>
              </div>
              <div className="val">21.8M <span className="delta down">−3.8%</span></div>
              <div className="cur">this cycle</div>
            </div>
            <div className="sum-card dark">
              <div className="row1">
                <div className="tile">{Icon.chart}</div>
                <div className="lbl">Net growth</div>
                <div className="dots">···</div>
              </div>
              <div className="val">290.6M <span className="delta up">+22.1%</span></div>
              <div className="cur">funds minus payouts</div>
            </div>
            <div className="sum-card">
              <div className="row1">
                <div className="tile">{Icon.users}</div>
                <div className="lbl">Active members</div>
                <div className="dots">···</div>
              </div>
              <div className="val">1,284 <span className="delta up">+48</span></div>
              <div className="cur">across 5 branches</div>
            </div>
          </div>

          <div className="grid g2 section-gap">
            <div className="panel">
              <div className="panel-head">
                <div>
                  <h3>Cash flow</h3>
                  <p className="hint">Contributions vs payouts over time</p>
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
              <div className="stat-strip">
                <div className="cell"><div className="k"><i className="dot g" /> Avg intake</div><div className="v">47.3M</div></div>
                <div className="cell"><div className="k"><i className="dot r" /> Avg payout</div><div className="v">27.1M</div></div>
                <div className="cell"><div className="k">Best month</div><div className="v">Jul · 90M</div></div>
                <div className="cell"><div className="k">Highest intake</div><div className="v">55.0M</div></div>
              </div>
            </div>

            <div className="panel">
              <h3>Funds by branch</h3>
              <p className="hint">Share of total under management</p>
              <div className="donut-wrap" style={{ marginTop: 8 }}>
                <div className="donut" style={{ background: `conic-gradient(${stops})` }}>
                  <div className="hole">
                    <div>
                      <b>312M</b>
                      <small>total</small>
                    </div>
                  </div>
                </div>
                <div className="donut-legend">
                  {CATS.map((c) => (
                    <div className="li" key={c.name}>
                      <i className="dot" style={{ background: c.color }} />
                      {c.name}
                      <span className="amt">{c.amt}</span>
                    </div>
                  ))}
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
            {MEMBERS.map((m) => (
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
          </tbody>
        </table>
        <p style={{ fontSize: 11.5, color: "var(--muted)", padding: "12px 22px" }}>
          Totals — funds {fmt(totalFunds)} Ushs · interest {fmt(totalInterest)} Ushs
        </p>
      </div>
    </>
  );
}
