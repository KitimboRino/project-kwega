# Kwega Savings — Role-Based Savings System

One Next.js web app, three views gated by user role (RBAC), backed by Supabase (Postgres + Auth).

## Set up Supabase (one-time)

1. Create a free project at [supabase.com](https://supabase.com).
2. Copy `.env.local.example` to `.env.local` and fill in your project's URL and anon key (Dashboard → Project Settings → API).
3. In the Supabase Dashboard → **SQL Editor**, paste the entire contents of [`supabase/schema.sql`](supabase/schema.sql) and run it. This creates all tables, RLS policies, and the `log_deposit` / `request_withdrawal` RPCs.
4. In **Authentication → Providers → Email**, turn off "Confirm email" (simplifies local testing — re-enable before going to production).
5. In **Edge Functions**, create a new function named `create-member` and paste in [`supabase/functions/create-member/index.ts`](supabase/functions/create-member/index.ts). This is what lets an officer invite a real member login — it needs the service-role key, so it must run server-side, not in the browser.

### Bootstrap the first admin

There's no officer yet to invite one, so the first admin is promoted manually:

1. Run the app (`yarn dev`) and sign up at `/signup` with a real email + password.
2. In the SQL Editor: `update public.profiles set role = 'admin' where id = (select id from auth.users where email = 'you@example.com');`
3. Sign out and back in — you're now an admin. Repeat the same promote-via-SQL step (with `role = 'officer'`) to bootstrap the first savings officer.

## Run it

```bash
yarn install
yarn dev
```

Open http://localhost:3000

## How access control works

- **Real email/password auth** via Supabase Auth (`/` to sign in, `/signup` to create an account). Every signup defaults to the `member` role with no savings account attached — real member accounts are created by an officer (see below).
- `AuthContext` (`src/context/AuthContext.tsx`) holds the signed-in Supabase user, joined with their `profiles` row (name, role, branch).
- `middleware.ts` refreshes the session on every request and redirects signed-out users away from `/dashboard`. This is UX-level only.
- The **real** enforcement is Postgres Row Level Security (`supabase/schema.sql`) — a member's queries can only ever return their own `members`/`transactions` rows, an officer's only the members they manage, regardless of what the UI does. Money movement (deposits, withdrawals) goes through `SECURITY DEFINER` RPCs, not raw client inserts, so the min-daily and 1-year-lock rules can't be bypassed client-side.
- The dashboard renders **only** the view matching the user's role. The sidebar nav is also role-specific.

## Who sees what

| Role    | Access |
|---------|--------|
| Member  | Their own account only — balance, principal (locked 1 yr), interest (withdrawable), contributions, activity |
| Officer | Opens accounts, logs daily contributions, sees only the members they manage |
| Admin   | Everyone and everything — all members, officers, branches, totals |

## System rules (`src/lib/data.ts`)

- Minimum 2,000 Ushs/day contribution
- 7% compound interest per 30-day cycle (`projectInterest`)
- Interest withdrawable anytime; principal locked for 1 year (`isLocked`, `unlockDate`)

## Structure

```
src/
  app/
    page.tsx            sign-in
    signup/page.tsx     sign-up (bootstraps first admin/officer only)
    dashboard/page.tsx  shell + role gate
    layout.tsx          wraps app in AuthProvider
    globals.css         design tokens + styles
  components/
    MemberView.tsx  OfficerView.tsx  AdminView.tsx  Icons.tsx
  context/AuthContext.tsx
  lib/
    data.ts             types, business rules (RULES, isLocked, projectInterest, fmt)
    supabase/client.ts   browser Supabase client
    supabase/server.ts   server Supabase client (Server Components)
middleware.ts            session refresh + coarse route gating
supabase/
  schema.sql             tables, RLS policies, RPCs — run once in the SQL Editor
  functions/create-member/index.ts  Edge Function: officer invites a real member login
```

## Known gaps / future work

- **Contribution self-service**: members currently can't log their own deposits (by design — contributions are collected in person and logged by the officer). The "Add contribution" button is decorative.
- **Withdrawals** always withdraw the full available balance (no partial-amount input yet) — the `request_withdrawal` RPC already supports partial amounts, so this is a small UI addition.
- **Admin cash-flow chart** is still illustrative placeholder data — a real version needs enough transaction volume to be meaningful.
- **Trend badges** (e.g. "+12%") were removed rather than left fake — true period-over-period trends need a snapshot table.
- **Interest accrual** (`projectInterest` in `src/lib/data.ts`) is not yet scheduled — it's the natural hook for a future monthly cron/Edge Function that credits interest automatically.
