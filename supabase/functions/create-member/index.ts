// supabase/functions/create-member/index.ts
//
// Deploy via Supabase Dashboard -> Edge Functions -> create a function
// named "create-member" -> paste this file's contents.
//
// NOTE: on this project, that function is actually deployed under the
// name "clever-function" (a dashboard-assigned name from an earlier
// attempt — Supabase doesn't support renaming a function in place, and
// a later attempt to create one literally named "create-member" never
// actually deployed). src/components/OfficerView.tsx invokes
// "clever-function" to match. If you ever redeploy this cleanly under
// the name "create-member", update that invoke() call back to match.
//
// Why this has to be an Edge Function and not a client-side call:
// creating a new auth user requires the service-role key, which must
// never reach the browser. A client-side supabase.auth.signUp() also
// can't create "someone else's" account without disrupting the caller's
// own session. So the officer's browser calls this function (with their
// normal user JWT), and this function — holding the service-role key —
// does the privileged work on their behalf after checking their role.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MIN_DAILY = 2000; // keep in sync with RULES.MIN_DAILY in src/lib/data.ts

// No 0/O/1/l/I — avoids anyone misreading the password when it's relayed verbally or by hand.
const PASSWORD_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
function generateTempPassword(length = 10) {
  let out = "";
  for (let i = 0; i < length; i++) out += PASSWORD_CHARS[Math.floor(Math.random() * PASSWORD_CHARS.length)];
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Client bound to the caller's own JWT — used only to find out who's calling.
    const callerClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: callerProfile } = await callerClient
      .from("profiles")
      .select("role")
      .eq("id", caller.id)
      .single();

    if (!callerProfile || !["officer", "admin"].includes(callerProfile.role)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const {
      email, name, phone, nationalId, dailyAmount, branch, startDate, silent, initialPrincipal, directPassword,
      resetPasswordFor, newEmail,
    } = await req.json();

    // Reset-password path: generates a fresh, immediately-usable password
    // for an EXISTING account (e.g. one of the batch-seeded members who
    // never got a real login) and optionally corrects a placeholder email
    // to a real one at the same time. Short-circuits before the "open a
    // new account" validation/creation logic below — nothing there applies.
    if (resetPasswordFor) {
      if (callerProfile.role === "officer") {
        const { data: managed } = await callerClient
          .from("members")
          .select("id")
          .eq("id", resetPasswordFor)
          .eq("officer_id", caller.id)
          .maybeSingle();
        if (!managed) {
          return new Response(JSON.stringify({ error: "You can only reset passwords for members you manage" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      const admin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      const tempPassword = generateTempPassword();
      const updatePayload: Record<string, unknown> = { password: tempPassword, email_confirm: true };
      if (newEmail) updatePayload.email = newEmail;

      const { error: updErr } = await admin.auth.admin.updateUserById(resetPasswordFor, updatePayload);
      if (updErr) {
        return new Response(JSON.stringify({ error: updErr.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ tempPassword }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!email || !name || !dailyAmount || dailyAmount < MIN_DAILY || !branch) {
      return new Response(
        JSON.stringify({ error: `Name, email, branch, and a daily amount of at least ${MIN_DAILY} are required.` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // silent + initialPrincipal is a bulk-import path (e.g. migrating an
    // existing paper/spreadsheet ledger): creates the account with no
    // invite email sent and an opening balance already on it. Restricted
    // to admin — this bypasses the normal "officer opens their own
    // account, member sets their own password" flow, so it's a
    // deliberately heavier-weight action than everyday account creation.
    if (silent && callerProfile.role !== "admin") {
      return new Response(JSON.stringify({ error: "Only admin can silently import accounts" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Admin client — holds the service-role key, only ever used inside
    // this trusted server context, never sent to any browser.
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let newUserId: string;
    let tempPassword: string | undefined;

    if (silent) {
      // No email sent at all — unlike inviteUserByEmail. The email only
      // needs to be well-formed, not deliverable; nobody can sign in with
      // it until an admin later resets it to a real address the person
      // controls (Users tab, or re-inviting them properly).
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        password: crypto.randomUUID() + crypto.randomUUID(), // unusable placeholder, nobody needs to know it
        user_metadata: { role: "member", name, phone, branch },
      });
      if (createErr) {
        return new Response(JSON.stringify({ error: createErr.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      newUserId = created.user.id;
    } else if (directPassword) {
      // Bypasses email entirely — no invite sent, no domain/SMTP
      // dependency. Creates the account with a real, immediately-usable
      // temporary password that this function hands back in the response
      // for the officer/admin to relay to the member directly (in person,
      // SMS, WhatsApp, whatever) — the member can sign in right away and
      // is expected to change it via Settings afterward. This is a "for
      // now" workaround for unreliable email delivery, not a replacement
      // for real invites once a verified sending domain is in place.
      tempPassword = generateTempPassword();
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        password: tempPassword,
        user_metadata: { role: "member", name, phone, branch },
      });
      if (createErr) {
        return new Response(JSON.stringify({ error: createErr.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      newUserId = created.user.id;
    } else {
      const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
        data: { role: "member", name, phone, branch },
      });
      if (inviteErr) {
        return new Response(JSON.stringify({ error: inviteErr.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      newUserId = invited.user.id;
    }

    const principal = silent && initialPrincipal > 0 ? Math.round(initialPrincipal) : 0;

    const { data: member, error: memberErr } = await admin
      .from("members")
      .insert({
        id: newUserId,
        officer_id: caller.id,
        branch,
        national_id: nationalId ?? null,
        daily_amount: dailyAmount,
        start_date: startDate,
        principal,
      })
      .select()
      .single();

    if (memberErr) {
      // Roll back the created/invited auth user so a retry doesn't collide on email.
      await admin.auth.admin.deleteUser(newUserId);
      return new Response(JSON.stringify({ error: memberErr.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Record the opening balance as a real transaction, backdated to the
    // account's start date rather than "now" — this is what makes it show
    // up honestly as historical activity instead of a deposit that
    // supposedly happened today.
    if (principal > 0) {
      await admin.from("transactions").insert({
        member_id: newUserId,
        type: "deposit",
        amount: principal,
        balance: principal,
        occurred_at: new Date(startDate).toISOString(),
        created_by: caller.id,
      });
    }

    return new Response(JSON.stringify({ member, tempPassword }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
