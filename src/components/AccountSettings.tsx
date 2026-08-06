"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { createClient } from "@/lib/supabase/client";

export default function AccountSettings() {
  const { user, refreshUser } = useAuth();
  const supabase = createClient();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileNotice, setProfileNotice] = useState("");

  const [email, setEmail] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [securitySaving, setSecuritySaving] = useState(false);
  const [securityNotice, setSecurityNotice] = useState("");

  const load = useCallback(async () => {
    if (!user) return;
    const { data: profile } = await supabase.from("profiles").select("name, phone").eq("id", user.id).single();
    setName(profile?.name ?? user.name);
    setPhone(profile?.phone ?? "");
    const { data: authData } = await supabase.auth.getUser();
    setEmail(authData.user?.email ?? "");
    setNewEmail(authData.user?.email ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const saveProfile = async () => {
    setProfileSaving(true);
    setProfileNotice("");
    const { error } = await supabase.rpc("update_own_profile", { p_name: name, p_phone: phone });
    setProfileSaving(false);
    if (error) {
      setProfileNotice(error.message);
      return;
    }
    setProfileNotice("Saved.");
    await refreshUser();
  };

  const saveSecurity = async () => {
    if (newPassword && newPassword !== confirmPassword) {
      setSecurityNotice("Passwords do not match.");
      return;
    }
    const update: { email?: string; password?: string } = {};
    if (newEmail && newEmail !== email) update.email = newEmail;
    if (newPassword) update.password = newPassword;
    if (Object.keys(update).length === 0) {
      setSecurityNotice("Nothing to change.");
      return;
    }
    setSecuritySaving(true);
    setSecurityNotice("");
    const { error } = await supabase.auth.updateUser(update);
    setSecuritySaving(false);
    if (error) {
      setSecurityNotice(error.message);
      return;
    }
    setSecurityNotice(update.email ? "Check your inbox to confirm the new email address." : "Password updated.");
    setNewPassword("");
    setConfirmPassword("");
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Settings</h2>
          <p>Manage your profile and account credentials</p>
        </div>
      </div>

      <div className="grid g2 section-gap">
        <div className="panel">
          <h3>Your details</h3>
          <p className="hint">Visible to your officer/admin and shown across the app.</p>
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
          <button className="btn btn-primary" onClick={saveProfile} disabled={profileSaving}>
            {profileSaving ? "Saving…" : "Save details"}
          </button>
          {profileNotice && (
            <p style={{ fontSize: 12.5, marginTop: 12, color: "var(--forest)", fontWeight: 600 }}>{profileNotice}</p>
          )}
        </div>

        <div className="panel">
          <h3>Account &amp; security</h3>
          <p className="hint">Change your sign-in email or password. Leave password blank to keep it unchanged.</p>
          <div className="field" style={{ marginBottom: 14 }}>
            <label>Email</label>
            <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
          </div>
          <div className="form-row">
            <div className="field">
              <label>New password</label>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Leave blank to keep" />
            </div>
            <div className="field">
              <label>Confirm password</label>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </div>
          </div>
          <button className="btn btn-primary" onClick={saveSecurity} disabled={securitySaving}>
            {securitySaving ? "Saving…" : "Save changes"}
          </button>
          {securityNotice && (
            <p style={{ fontSize: 12.5, marginTop: 12, color: "var(--forest)", fontWeight: 600 }}>{securityNotice}</p>
          )}
        </div>
      </div>
    </>
  );
}
