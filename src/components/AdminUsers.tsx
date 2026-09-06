"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { RULES, fmt, type Role } from "@/lib/data";
import { Icon } from "@/components/Icons";

type ProfileRow = { id: string; name: string; phone: string | null; branch: string | null; role: Role };
type TxnRow = { id: string; type: string; amount: number; balance: number; occurred_at: string };

export default function AdminUsers({
  jumpToUserId,
  jumpNonce,
}: {
  jumpToUserId?: string | null;
  jumpNonce?: number | null;
}) {
  const { user } = useAuth();
  const supabase = createClient();

  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [branches, setBranches] = useState<string[]>([]);
  const [search, setSearch] = useState("");

  const [selected, setSelected] = useState<ProfileRow | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [officerBranch, setOfficerBranch] = useState("");
  const [isMember, setIsMember] = useState(false);
  const [memberBranch, setMemberBranch] = useState("");
  const [memberNationalId, setMemberNationalId] = useState("");
  const [memberStartDate, setMemberStartDate] = useState("");
  const [memberTxns, setMemberTxns] = useState<TxnRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const selectRequestId = useRef(0);

  // Give an existing account (e.g. one of the batch-seeded members who
  // never got a real login) a fresh, immediately-usable password.
  const [resetEmail, setResetEmail] = useState("");
  const [resetting, setResetting] = useState(false);
  const [resetNotice, setResetNotice] = useState("");
  const [resetTempPassword, setResetTempPassword] = useState("");

  // Log a contribution against whichever user is currently selected below.
  const [depositAmount, setDepositAmount] = useState("2,000");
  const [depositDate, setDepositDate] = useState(new Date().toISOString().slice(0, 10));
  const [loggingDeposit, setLoggingDeposit] = useState(false);
  const [depositNotice, setDepositNotice] = useState("");

  // Open a brand-new account — same fields/flow as the officer's "New account" form.
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newNationalId, setNewNationalId] = useState("");
  const [newDaily, setNewDaily] = useState("2,000");
  const [newBranch, setNewBranch] = useState("");
  const [newStartDate, setNewStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [createNotice, setCreateNotice] = useState("");
  const [newTempPassword, setNewTempPassword] = useState("");

  const loadProfiles = useCallback(async () => {
    const { data } = await supabase.from("profiles").select("id, name, phone, branch, role").order("name");
    if (data) setProfiles((data as ProfileRow[]).filter((p) => p.id !== user?.id));
  }, [supabase, user]);

  const loadBranches = useCallback(async () => {
    const { data } = await supabase.from("branches").select("name").order("name");
    if (data) {
      setBranches(data.map((b) => b.name));
      if (data.length) setNewBranch((cur) => cur || data[0].name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  useEffect(() => {
    loadProfiles();
    loadBranches();
  }, [loadProfiles, loadBranches]);

  const filtered = profiles.filter(
    (p) => !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.role.includes(search.toLowerCase())
  );

  const select = async (p: ProfileRow) => {
    const requestId = ++selectRequestId.current;
    setSelected(p);
    setName(p.name);
    setPhone(p.phone ?? "");
    setRole(p.role);
    setOfficerBranch(p.branch ?? "");
    setIsMember(false);
    setMemberBranch("");
    setMemberNationalId("");
    setMemberStartDate("");
    setMemberTxns([]);
    setNotice("");
    setDepositAmount("2,000");
    setDepositDate(new Date().toISOString().slice(0, 10));
    setDepositNotice("");
    setResetEmail("");
    setResetNotice("");
    setResetTempPassword("");

    if (p.role === "member") {
      const [memberRes, txnsRes] = await Promise.all([
        supabase.from("members").select("branch, national_id, start_date").eq("id", p.id).maybeSingle(),
        supabase
          .from("transactions")
          .select("id, type, amount, balance, occurred_at")
          .eq("member_id", p.id)
          .order("occurred_at", { ascending: false }),
      ]);
      if (requestId !== selectRequestId.current) return; // a newer selection happened while this was in flight
      if (memberRes.data) {
        setIsMember(true);
        setMemberBranch(memberRes.data.branch);
        setMemberNationalId(memberRes.data.national_id ?? "");
        setMemberStartDate(memberRes.data.start_date);
      }
      if (txnsRes.data) setMemberTxns(txnsRes.data as TxnRow[]);
    }
  };

  // Landed here from the global search (⌘K) with a specific user to jump
  // to — fetch that profile fresh rather than relying on `profiles` having
  // finished loading yet (this component only mounts once the Users tab
  // is active, so a jump can arrive at the same moment as the initial load).
  useEffect(() => {
    if (!jumpToUserId) return;
    (async () => {
      const { data } = await supabase.from("profiles").select("id, name, phone, branch, role").eq("id", jumpToUserId).maybeSingle();
      if (data) select(data as ProfileRow);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jumpNonce]);

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    setNotice("");

    const { error: profileErr } = await supabase.rpc("admin_update_profile", {
      p_user_id: selected.id,
      p_name: name,
      p_phone: isMember ? null : phone,
      p_branch: role === "officer" ? officerBranch : null,
      p_role: role,
    });
    if (profileErr) {
      setSaving(false);
      setNotice(profileErr.message);
      return;
    }

    if (isMember) {
      const { error: memberErr } = await supabase.rpc("update_member_details", {
        p_member_id: selected.id,
        p_phone: phone,
        p_branch: memberBranch,
        p_national_id: memberNationalId,
        p_start_date: memberStartDate || null,
      });
      if (memberErr) {
        setSaving(false);
        setNotice(memberErr.message);
        return;
      }
    }

    setSaving(false);
    setNotice("Saved.");
    loadProfiles();
  };

  const handleLogDeposit = async () => {
    if (!selected) return;
    const val = Number(depositAmount.replace(/,/g, ""));
    if (!val || val <= 0) {
      setDepositNotice("Enter a valid amount.");
      return;
    }
    setLoggingDeposit(true);
    setDepositNotice("");
    const { error } = await supabase.rpc("log_deposit", {
      p_member_id: selected.id,
      p_amount: val,
      p_occurred_at: new Date(depositDate).toISOString(),
    });
    setLoggingDeposit(false);
    if (error) {
      setDepositNotice(error.message);
      return;
    }
    setDepositNotice(`Logged ${fmt(val)} Ushs for ${selected.name}.`);
    setDepositAmount("2,000");
    setDepositDate(new Date().toISOString().slice(0, 10));
    const { data } = await supabase
      .from("transactions")
      .select("id, type, amount, balance, occurred_at")
      .eq("member_id", selected.id)
      .order("occurred_at", { ascending: false });
    if (data) setMemberTxns(data as TxnRow[]);
  };

  const handleResetPassword = async () => {
    if (!selected) return;
    setResetting(true);
    setResetNotice("");
    setResetTempPassword("");
    const { data, error } = await supabase.functions.invoke("clever-function", {
      body: {
        resetPasswordFor: selected.id,
        newEmail: resetEmail.trim() || undefined,
      },
    });
    setResetting(false);
    if (error || data?.error) {
      setResetNotice(data?.error ?? error?.message ?? "Could not set a password.");
      return;
    }
    setResetNotice(`New password for ${selected.name}${resetEmail.trim() ? ` (signs in as ${resetEmail.trim()} now)` : ""}:`);
    setResetTempPassword(data?.tempPassword ?? "");
    setResetEmail("");
  };

  const handleCreateAccount = async () => {
    const val = Number(newDaily.replace(/,/g, ""));
    if (val < RULES.MIN_DAILY) {
      setCreateNotice(`Daily amount must be at least ${fmt(RULES.MIN_DAILY)} Ushs.`);
      return;
    }
    if (!newName || !newEmail || !newBranch) {
      setCreateNotice("Full name, email, and branch are required.");
      return;
    }
    setCreatingAccount(true);
    setCreateNotice("");
    setNewTempPassword("");
    // directPassword: true — bypasses the invite email (unreliable while
    // no verified sending domain is set up) and creates a real,
    // immediately-usable login instead. Switch back to a plain invite
    // once that's sorted (drop this flag).
    const { data, error } = await supabase.functions.invoke("clever-function", {
      body: {
        email: newEmail,
        name: newName,
        phone: newPhone,
        nationalId: newNationalId,
        dailyAmount: val,
        branch: newBranch,
        startDate: newStartDate,
        directPassword: true,
      },
    });
    setCreatingAccount(false);
    if (error || data?.error) {
      setCreateNotice(data?.error ?? error?.message ?? "Could not create account.");
      return;
    }
    setCreateNotice(data?.tempPassword ? `Account created for ${newName}. Give them this password to sign in:` : "Account created.");
    setNewTempPassword(data?.tempPassword ?? "");
    setNewName("");
    setNewEmail("");
    setNewPhone("");
    setNewNationalId("");
    setNewDaily("2,000");
    loadProfiles();
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Users</h2>
          <p>Manage every account on the platform — profile details and role</p>
        </div>
      </div>

      <div className="panel">
        <h3>Open a new account</h3>
        <p className="hint">You&apos;ll get a temporary password after creating — give it to the member so they can sign in right away.</p>
        <div className="form-row">
          <div className="field"><label>Full name</label><input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Grace Nakato" /></div>
          <div className="field"><label>Email</label><input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="member@example.com" /></div>
        </div>
        <div className="form-row">
          <div className="field"><label>Phone number</label><input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="+256 7XX XXX XXX" /></div>
          <div className="field"><label>National ID</label><input value={newNationalId} onChange={(e) => setNewNationalId(e.target.value)} placeholder="CM..." /></div>
        </div>
        <div className="form-row">
          <div className="field">
            <label>Daily amount (min {fmt(RULES.MIN_DAILY)})</label>
            <input className="mono" value={newDaily} onChange={(e) => setNewDaily(e.target.value)} />
          </div>
          <div className="field">
            <label>Branch</label>
            <select value={newBranch} onChange={(e) => setNewBranch(e.target.value)}>
              {branches.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="field"><label>Start date</label><input type="date" value={newStartDate} onChange={(e) => setNewStartDate(e.target.value)} /></div>
        </div>
        <button className="btn btn-primary" onClick={handleCreateAccount} disabled={creatingAccount}>
          {Icon.plus} {creatingAccount ? "Creating…" : "Create account"}
        </button>
        {createNotice && (
          <p style={{ fontSize: 12.5, marginTop: 12, color: "var(--forest)", fontWeight: 600 }}>{createNotice}</p>
        )}
        {newTempPassword && (
          <div
            className="mono"
            style={{
              marginTop: 8, padding: "10px 14px", background: "var(--paper)", border: "1px solid var(--line)",
              borderRadius: 10, fontSize: 15, fontWeight: 700, letterSpacing: 1, textAlign: "center",
            }}
          >
            {newTempPassword}
          </div>
        )}
      </div>

      <div className="grid g2 section-gap">
        <div className="panel">
          <h3>Find a user</h3>
          <p className="hint">Search by name or role, then edit their details below.</p>
          <div className="field" style={{ marginBottom: 14 }}>
            <label>Search</label>
            <input placeholder="Search name or role" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div style={{ maxHeight: 320, overflowY: "auto", border: "1px solid var(--line)", borderRadius: 10 }}>
            {filtered.map((p) => (
              <div
                key={p.id}
                onClick={() => select(p)}
                style={{
                  padding: "10px 12px",
                  fontSize: 13,
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                  background: selected?.id === p.id ? "var(--paper)" : "transparent",
                }}
              >
                <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {p.name}
                </span>
                <span className={`tag ${p.role === "admin" ? "locked" : "active"}`} style={{ flexShrink: 0 }}>
                  {p.role}
                </span>
              </div>
            ))}
            {filtered.length === 0 && (
              <div style={{ padding: "10px 12px", fontSize: 13, color: "var(--muted)" }}>No matches</div>
            )}
          </div>
        </div>

        <div className="panel">
          <h3>{selected ? `Edit ${selected.name}` : "Select a user"}</h3>
          {!selected && <p className="hint">Pick someone from the list to edit their profile and role.</p>}
          {selected && (
            <>
              <div className="form-row">
                <div className="field">
                  <label>Full name</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="field">
                  <label>Phone number</label>
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+256 7XX XXX XXX" />
                </div>
              </div>
              <div className="form-row">
                <div className="field">
                  <label>Role</label>
                  <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
                    <option value="member">member</option>
                    <option value="officer">officer</option>
                    <option value="admin">admin</option>
                  </select>
                </div>
                {role === "officer" && (
                  <div className="field">
                    <label>Home branch</label>
                    <select value={officerBranch} onChange={(e) => setOfficerBranch(e.target.value)}>
                      {branches.map((b) => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                )}
              </div>

              {isMember && (
                <>
                  <div className="form-row">
                    <div className="field">
                      <label>Member branch</label>
                      <select value={memberBranch} onChange={(e) => setMemberBranch(e.target.value)}>
                        {branches.map((b) => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </div>
                    <div className="field">
                      <label>National ID</label>
                      <input value={memberNationalId} onChange={(e) => setMemberNationalId(e.target.value)} placeholder="CM..." />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="field">
                      <label>Start date</label>
                      <input
                        type="date"
                        max={new Date().toISOString().slice(0, 10)}
                        value={memberStartDate}
                        onChange={(e) => setMemberStartDate(e.target.value)}
                      />
                    </div>
                  </div>
                  <p className="hint" style={{ marginBottom: 14 }}>
                    Branch/national ID/start date above update this member&apos;s savings record. Correcting the
                    start date also resets when their interest cycle counts from — it doesn&apos;t reverse
                    interest already credited under the old date; use the Savings tab for that.
                  </p>

                  <div style={{ borderTop: "1px solid var(--line)", paddingTop: 16, marginBottom: 16 }}>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--muted-ink)", marginBottom: 10 }}>
                      Savings log
                    </label>
                    <div style={{ maxHeight: 220, overflowY: "auto", border: "1px solid var(--line)", borderRadius: 10 }}>
                      {memberTxns.map((t) => (
                        <div
                          key={t.id}
                          style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "8px 12px", fontSize: 13, borderBottom: "1px solid var(--line-soft)" }}
                        >
                          <span style={{ color: "var(--muted)" }}>
                            {new Date(t.occurred_at).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })}
                          </span>
                          <span
                            className={`tag ${t.type === "deposit" ? "dep" : t.type === "interest" ? "int" : "wd"}`}
                            style={{ flexShrink: 0 }}
                          >
                            {t.type[0].toUpperCase() + t.type.slice(1)}
                          </span>
                          <span
                            className="mono"
                            style={{ marginLeft: "auto", flexShrink: 0, color: t.amount < 0 ? "var(--danger)" : "var(--forest)" }}
                          >
                            {t.amount < 0 ? "−" : "+"}{fmt(Math.abs(t.amount))}
                          </span>
                        </div>
                      ))}
                      {memberTxns.length === 0 && (
                        <div style={{ padding: "10px 12px", fontSize: 13, color: "var(--muted)" }}>No activity yet.</div>
                      )}
                    </div>
                    <p className="hint" style={{ marginTop: 8, marginBottom: 0 }}>
                      To correct a mistake in this log, use the Savings tab.
                    </p>
                  </div>

                  <div style={{ borderTop: "1px solid var(--line)", paddingTop: 16, marginBottom: 16 }}>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--muted-ink)", marginBottom: 6 }}>
                      Log a contribution
                    </label>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <input
                        className="inline-input mono"
                        style={{ flex: 1, minWidth: 120 }}
                        value={depositAmount}
                        onChange={(e) => setDepositAmount(e.target.value)}
                      />
                      <input
                        type="date"
                        max={new Date().toISOString().slice(0, 10)}
                        className="inline-input"
                        value={depositDate}
                        onChange={(e) => setDepositDate(e.target.value)}
                      />
                      <button className="btn btn-lime" onClick={handleLogDeposit} disabled={loggingDeposit}>
                        {loggingDeposit ? "Logging…" : "Log deposit"}
                      </button>
                    </div>
                    {depositNotice && (
                      <p style={{ fontSize: 12.5, marginTop: 10, color: "var(--forest)", fontWeight: 600 }}>{depositNotice}</p>
                    )}
                  </div>
                </>
              )}

              <button className="btn btn-primary" onClick={save} disabled={saving}>
                {Icon.edit} {saving ? "Saving…" : "Save changes"}
              </button>
              {notice && (
                <p style={{ fontSize: 12.5, marginTop: 12, color: "var(--forest)", fontWeight: 600 }}>{notice}</p>
              )}

              <div style={{ borderTop: "1px solid var(--line)", paddingTop: 16, marginTop: 20 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--muted-ink)", marginBottom: 6 }}>
                  Set / reset password
                </label>
                <p className="hint" style={{ marginBottom: 10 }}>
                  For accounts that never got a real login (e.g. batch-imported members) — generates a new password
                  shown on screen, no email needed. Optionally fix a placeholder email first, since that&apos;s what
                  they&apos;ll sign in with.
                </p>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <input
                    type="email"
                    placeholder="Replace placeholder email (optional)"
                    className="inline-input"
                    style={{ flex: 1, minWidth: 220 }}
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                  />
                  <button className="btn btn-ghost" onClick={handleResetPassword} disabled={resetting}>
                    {resetting ? "Setting…" : "Set new password"}
                  </button>
                </div>
                {resetNotice && (
                  <p style={{ fontSize: 12.5, marginTop: 10, color: "var(--forest)", fontWeight: 600 }}>{resetNotice}</p>
                )}
                {resetTempPassword && (
                  <div
                    className="mono"
                    style={{
                      marginTop: 8, padding: "10px 14px", background: "var(--paper)", border: "1px solid var(--line)",
                      borderRadius: 10, fontSize: 15, fontWeight: 700, letterSpacing: 1, textAlign: "center",
                    }}
                  >
                    {resetTempPassword}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
