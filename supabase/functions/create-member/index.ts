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

    const { email, name, phone, nationalId, dailyAmount, branch, startDate } = await req.json();

    if (!email || !name || !dailyAmount || dailyAmount < MIN_DAILY || !branch) {
      return new Response(
        JSON.stringify({ error: `Name, email, branch, and a daily amount of at least ${MIN_DAILY} are required.` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Admin client — holds the service-role key, only ever used inside
    // this trusted server context, never sent to any browser.
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { role: "member", name, phone, branch },
    });
    if (inviteErr) {
      return new Response(JSON.stringify({ error: inviteErr.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: member, error: memberErr } = await admin
      .from("members")
      .insert({
        id: invited.user.id,
        officer_id: caller.id,
        branch,
        national_id: nationalId ?? null,
        daily_amount: dailyAmount,
        start_date: startDate,
      })
      .select()
      .single();

    if (memberErr) {
      // Roll back the invited auth user so a retry doesn't collide on email.
      await admin.auth.admin.deleteUser(invited.user.id);
      return new Response(JSON.stringify({ error: memberErr.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ member }), {
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
