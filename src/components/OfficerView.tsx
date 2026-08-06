"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { RULES, fmt, isLocked, type Member } from "@/lib/data";
import { Icon } from "@/components/Icons";

type MemberRow = {
  id: string;
  account_no: string;
  branch: string;
  principal: number;
  interest: number;
  daily_amount: number;
  start_date: string;
  profiles: { name: string; phone: string | null } | null;
};

function mapRow(row: MemberRow, officerName: string): Member {
  return {
    id: row.id,
    name: row.profiles?.name ?? "Unknown",
    accountNo: row.account_no,
    phone: row.profiles?.phone ?? "",
    officer: officerName,
    branch: row.branch,
    status: isLocked(row.start_date) ? "locked" : "active",
    principal: row.principal,
    interest: row.interest,
    dailyAmount: row.daily_amount,
    startDate: row.start_date,
    transactions: [],
  };
}

type LoggedEntry = { id: string; memberName: string; accountNo: string; amount: number };

export default function OfficerView({ tab }: { tab: string }) {
  const { user } = useAuth();
  const supabase = createClient();

  const [myMembers, setMyMembers] = useState<Member[]>([]);
  const [branches, setBranches] = useState<string[]>([]);
  const [loggedToday, setLoggedToday] = useState<LoggedEntry[]>([]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [daily, setDaily] = useState("2,000");
  const [branch, setBranch] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [notice, setNotice] = useState("");
  const [creating, setCreating] = useState(false);

  const [search, setSearch] = useState("");
  const [depositAmount, setDepositAmount] = useState("2,000");
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [loggingDeposit, setLoggingDeposit] = useState(false);
  const [depositNotice, setDepositNotice] = useState("");

  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [editPhone, setEditPhone] = useState("");
  const [editBranch, setEditBranch] = useState("");
  const [editNationalId, setEditNationalId] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editNotice, setEditNotice] = useState("");

  const loadMembers = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("members")
      .select("id, account_no, branch, principal, interest, daily_amount, start_date, profiles!members_id_fkey(name, phone)")
      .eq("officer_id", user.id);
    if (data) setMyMembers((data as unknown as MemberRow[]).map((r) => mapRow(r, user.name)));
  }, [user, supabase]);

  const loadLoggedToday = useCallback(async () => {
    if (!user) return;
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const { data } = await supabase
      .from("transactions")
      .select("id, amount, members(account_no, profiles!members_id_fkey(name))")
      .eq("created_by", user.id)
      .eq("type", "deposit")
      .gte("occurred_at", startOfDay.toISOString())
      .order("occurred_at", { ascending: false });
    if (data) {
      setLoggedToday(
        (data as unknown as { id: string; amount: number; members: { account_no: string; profiles: { name: string } | null } | null }[]).map((r) => ({
          id: r.id,
          amount: r.amount,
          accountNo: r.members?.account_no ?? "",
          memberName: r.members?.profiles?.name ?? "",
        }))
      );
    }
  }, [user, supabase]);

  const loadBranches = useCallback(async () => {
    const { data } = await supabase.from("branches").select("name").order("name");
    if (data) {
      setBranches(data.map((b) => b.name));
      if (data.length && !branch) setBranch(data[0].name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  useEffect(() => {
    loadMembers();
    loadLoggedToday();
    loadBranches();
  }, [loadMembers, loadLoggedToday, loadBranches]);

  const handleCreate = async () => {
    const val = Number(daily.replace(/,/g, ""));
    if (val < RULES.MIN_DAILY) {
      setNotice(`Daily amount must be at least ${fmt(RULES.MIN_DAILY)} Ushs.`);
      return;
    }
    if (!name || !email || !branch) {
      setNotice("Full name, email, and branch are required.");
      return;
    }
    setCreating(true);
    setNotice("");
    const { data, error } = await supabase.functions.invoke("create-member", {
      body: { email, name, phone, nationalId, dailyAmount: val, branch, startDate },
    });
    setCreating(false);
    if (error || data?.error) {
      setNotice(data?.error ?? error?.message ?? "Could not create account.");
      return;
    }
    setNotice("Account created. The member has been emailed an invite to sign in.");
    setName("");
    setEmail("");
    setPhone("");
    setNationalId("");
    setDaily("2,000");
    loadMembers();
  };

  const filteredMembers = myMembers.filter(
    (m) =>
      !search ||
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.accountNo.toLowerCase().includes(search.toLowerCase())
  );

  const handleLogDeposit = async () => {
    const val = Number(depositAmount.replace(/,/g, ""));
    if (!selectedMemberId) {
      setDepositNotice("Pick a member first.");
      return;
    }
    if (val <= 0) {
      setDepositNotice("Enter a valid amount.");
      return;
    }
    setLoggingDeposit(true);
    setDepositNotice("");
    const { error } = await supabase.rpc("log_deposit", { p_member_id: selectedMemberId, p_amount: val });
    setLoggingDeposit(false);
    if (error) {
      setDepositNotice(error.message);
      return;
    }
    setDepositNotice("Deposit logged.");
    setSelectedMemberId("");
    setSearch("");
    loadMembers();
    loadLoggedToday();
  };

  const startEdit = async (m: Member) => {
    setEditingMember(m);
    setEditPhone(m.phone);
    setEditBranch(m.branch);
    setEditNationalId("");
    setEditNotice("");
    const { data } = await supabase.from("members").select("national_id").eq("id", m.id).single();
    setEditNationalId(data?.national_id ?? "");
  };

  const handleSaveMemberEdit = async () => {
    if (!editingMember) return;
    setEditSaving(true);
    setEditNotice("");
    const { error } = await supabase.rpc("update_member_details", {
      p_member_id: editingMember.id,
      p_phone: editPhone,
      p_branch: editBranch,
      p_national_id: editNationalId,
    });
    setEditSaving(false);
    if (error) {
      setEditNotice(error.message);
      return;
    }
    setEditingMember(null);
    loadMembers();
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
            <div className="val">{myMembers.length}</div>
            <div className="cur">you manage</div>
          </div>
          <div className="sum-card">
            <div className="row1">
              <div className="tile">{Icon.income}</div>
              <div className="lbl">Contributions logged</div>
              <div className="dots">···</div>
            </div>
            <div className="val">{loggedToday.length}</div>
            <div className="cur">across members today</div>
          </div>
          <div className="sum-card dark">
            <div className="row1">
              <div className="tile">{Icon.list}</div>
              <div className="lbl">Total under management</div>
              <div className="dots">···</div>
            </div>
            <div className="val">{fmt(myMembers.reduce((s, m) => s + m.principal + m.interest, 0))}</div>
            <div className="cur">Ushs</div>
          </div>
        </div>
      )}

      {(tab === "home" || tab === "new") && (
        <div className="grid g2 section-gap">
          <div className="panel">
            <h3>Open a new account</h3>
            <p className="hint">The member will be emailed an invite to set their own password and sign in.</p>
            <div className="form-row">
              <div className="field"><label>Full name</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Grace Nakato" /></div>
              <div className="field"><label>Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="member@example.com" /></div>
            </div>
            <div className="form-row">
              <div className="field"><label>Phone number</label><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+256 7XX XXX XXX" /></div>
              <div className="field"><label>National ID</label><input value={nationalId} onChange={(e) => setNationalId(e.target.value)} placeholder="CM..." /></div>
            </div>
            <div className="form-row">
              <div className="field">
                <label>Daily amount (min {fmt(RULES.MIN_DAILY)})</label>
                <input className="mono" value={daily} onChange={(e) => setDaily(e.target.value)} />
              </div>
              <div className="field">
                <label>Branch</label>
                <select value={branch} onChange={(e) => setBranch(e.target.value)}>
                  {branches.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="field"><label>Start date</label><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
            </div>
            <button
              className="btn btn-primary"
              style={{ width: "100%", justifyContent: "center" }}
              onClick={handleCreate}
              disabled={creating}
            >
              {Icon.plus} {creating ? "Creating…" : "Create account"}
            </button>
            {notice && (
              <p style={{ fontSize: 12.5, marginTop: 12, color: "var(--forest)", fontWeight: 600 }}>{notice}</p>
            )}
          </div>

          <div className="panel">
            <h3>Quick log contribution</h3>
            <p className="hint">Record a daily deposit against a member&apos;s account.</p>
            <div className="field" style={{ marginBottom: 14 }}>
              <label>Find member</label>
              <input
                placeholder="Search name or account #"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setSelectedMemberId(""); }}
              />
              {search && !selectedMemberId && (
                <div style={{ marginTop: 6, border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden" }}>
                  {filteredMembers.slice(0, 5).map((m) => (
                    <div
                      key={m.id}
                      style={{ padding: "8px 12px", fontSize: 13, cursor: "pointer" }}
                      onClick={() => { setSelectedMemberId(m.id); setSearch(`${m.name} · ${m.accountNo}`); }}
                    >
                      {m.name} · {m.accountNo}
                    </div>
                  ))}
                  {filteredMembers.length === 0 && (
                    <div style={{ padding: "8px 12px", fontSize: 13, color: "var(--muted)" }}>No matches</div>
                  )}
                </div>
              )}
            </div>
            <div className="field" style={{ marginBottom: 14 }}>
              <label>Amount</label>
              <input className="mono" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} />
            </div>
            <button
              className="btn btn-lime"
              style={{ width: "100%", justifyContent: "center" }}
              onClick={handleLogDeposit}
              disabled={loggingDeposit}
            >
              {loggingDeposit ? "Logging…" : "Log deposit"}
            </button>
            {depositNotice && (
              <p style={{ fontSize: 12.5, marginTop: 12, color: "var(--forest)", fontWeight: 600 }}>{depositNotice}</p>
            )}
            <div style={{ marginTop: 20, borderTop: "1px solid var(--line)", paddingTop: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".5px", color: "var(--muted)", marginBottom: 10 }}>
                Logged today
              </div>
              {loggedToday.slice(0, 5).map((l) => (
                <div key={l.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "7px 0" }}>
                  <span>{l.memberName} · {l.accountNo}</span>
                  <span className="mono" style={{ color: "var(--forest)" }}>+{fmt(l.amount)}</span>
                </div>
              ))}
              {loggedToday.length === 0 && (
                <p style={{ fontSize: 12.5, color: "var(--muted)" }}>Nothing logged yet today.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {(tab === "home" || tab === "accounts") && editingMember && (
        <div className="panel section-gap">
          <div className="panel-head">
            <div>
              <h3>Edit {editingMember.name}</h3>
              <p className="hint">Update contact and branch details. Name changes must be made by the member.</p>
            </div>
          </div>
          <div className="form-row">
            <div className="field">
              <label>Phone number</label>
              <input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="+256 7XX XXX XXX" />
            </div>
            <div className="field">
              <label>Branch</label>
              <select value={editBranch} onChange={(e) => setEditBranch(e.target.value)}>
                {branches.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="field">
              <label>National ID</label>
              <input value={editNationalId} onChange={(e) => setEditNationalId(e.target.value)} placeholder="CM..." />
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-primary" onClick={handleSaveMemberEdit} disabled={editSaving}>
              {editSaving ? "Saving…" : "Save changes"}
            </button>
            <button className="btn btn-ghost" onClick={() => setEditingMember(null)}>Cancel</button>
          </div>
          {editNotice && (
            <p style={{ fontSize: 12.5, marginTop: 12, color: "var(--danger)", fontWeight: 600 }}>{editNotice}</p>
          )}
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
                <th className="num">Balance</th><th className="num">Daily</th><th></th>
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
                  <td>
                    <button className="btn btn-ghost" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => startEdit(m)}>
                      {Icon.edit} Edit
                    </button>
                  </td>
                </tr>
              ))}
              {myMembers.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", color: "var(--muted)", padding: "24px 0" }}>
                    No accounts yet.
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
