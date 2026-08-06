"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { createClient } from "@/lib/supabase/client";
import type { Role } from "@/lib/data";
import { Icon } from "@/components/Icons";

type ProfileRow = { id: string; name: string; phone: string | null; branch: string | null; role: Role };

export default function AdminUsers() {
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
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  const loadProfiles = useCallback(async () => {
    const { data } = await supabase.from("profiles").select("id, name, phone, branch, role").order("name");
    if (data) setProfiles((data as ProfileRow[]).filter((p) => p.id !== user?.id));
  }, [supabase, user]);

  const loadBranches = useCallback(async () => {
    const { data } = await supabase.from("branches").select("name").order("name");
    if (data) setBranches(data.map((b) => b.name));
  }, [supabase]);

  useEffect(() => {
    loadProfiles();
    loadBranches();
  }, [loadProfiles, loadBranches]);

  const filtered = profiles.filter(
    (p) => !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.role.includes(search.toLowerCase())
  );

  const select = async (p: ProfileRow) => {
    setSelected(p);
    setName(p.name);
    setPhone(p.phone ?? "");
    setRole(p.role);
    setOfficerBranch(p.branch ?? "");
    setIsMember(false);
    setMemberBranch("");
    setMemberNationalId("");
    setNotice("");

    if (p.role === "member") {
      const { data } = await supabase.from("members").select("branch, national_id").eq("id", p.id).maybeSingle();
      if (data) {
        setIsMember(true);
        setMemberBranch(data.branch);
        setMemberNationalId(data.national_id ?? "");
      }
    }
  };

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

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Users</h2>
          <p>Manage every account on the platform — profile details and role</p>
        </div>
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
                  background: selected?.id === p.id ? "var(--paper)" : "transparent",
                }}
              >
                <span>{p.name}</span>
                <span className={`tag ${p.role === "admin" ? "locked" : "active"}`}>{p.role}</span>
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
                  <p className="hint" style={{ marginBottom: 14 }}>
                    This account has a savings record — branch/national ID above update that record.
                  </p>
                </>
              )}

              <button className="btn btn-primary" onClick={save} disabled={saving}>
                {Icon.edit} {saving ? "Saving…" : "Save changes"}
              </button>
              {notice && (
                <p style={{ fontSize: 12.5, marginTop: 12, color: "var(--forest)", fontWeight: 600 }}>{notice}</p>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
