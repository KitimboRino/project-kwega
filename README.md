# Kwega Savings — Role-Based Savings System

One Next.js web app, role-gated (RBAC) across member/officer/admin, backed by Supabase (Postgres + Auth). Mobile responsive.

## Set up Supabase (one-time)

1. Create a free project at [supabase.com](https://supabase.com).
2. Copy `.env.local.example` to `.env.local` and fill in your project's URL and anon key (Dashboard → Project Settings → API).
3. In the Supabase Dashboard → **SQL Editor**, paste the entire contents of [`supabase/schema.sql`](supabase/schema.sql) and run it. This creates all tables, RLS policies, the money-movement RPCs (`log_deposit`, `request_withdrawal`), the profile-editing RPCs (`update_own_profile`, `update_member_details`, `admin_update_profile`), and the interest-accrual job (`credit_interest_cycle` + its daily `pg_cron` schedule).
4. In **Authentication → Providers → Email**, turn off "Confirm email" (simplifies local testing — re-enable before going to production).
5. In **Edge Functions**, create a new function named `create-member` and paste in [`supabase/functions/create-member/index.ts`](supabase/functions/create-member/index.ts). This is what lets an officer invite a real member login — it needs the service-role key, so it must run server-side, not in the browser.
   - **On this project specifically**, that function ended up deployed under the name `clever-function` instead (a dashboard-assigned name from troubleshooting a failed deploy — Supabase doesn't support renaming a function in place). `src/components/OfficerView.tsx` calls `clever-function` to match what's actually live. If you redeploy cleanly under the name `create-member`, update that `invoke()` call to match, and you can delete `clever-function`.

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
- The **real** enforcement is Postgres Row Level Security (`supabase/schema.sql`) — a member's queries can only ever return their own `members`/`transactions` rows, an officer's only the members they manage, regardless of what the UI does. Money movement (deposits, withdrawals, interest accrual) and every profile edit (self, officer-on-a-member, admin-on-anyone) go through `SECURITY DEFINER` RPCs, not raw client inserts/updates — this is what makes rules like the min-daily amount, the 1-year principal lock, "officers can't rename a member," and "admins can't self-demote" unbypassable, not just hidden in the UI.
- The dashboard renders **only** the view matching the user's role. The sidebar nav is also role-specific.
- **Global search (⌘K / Ctrl+K)** — officer and admin only (a member has just their own single account, nothing to search, so it's hidden for them rather than shipped as dead UI). Click the topbar search bar, or press ⌘K, to open it: officers search only the members they manage, admins search every account on the platform (member, officer, or admin) by name, role, or account #. Picking a result jumps straight to that person's edit panel (Accounts tab for an officer, Users tab for an admin) — no need to navigate and re-search manually.

## Who sees what

| Role    | Access |
|---------|--------|
| Member  | Their own account only — balance, principal (locked 1 yr), interest (withdrawable), contributions, activity |
| Officer | Opens accounts, logs daily contributions, sees only the members they manage |
| Admin   | Everyone and everything — all members, officers, branches, totals |

## Using the app

**Signing in**: go to `/`, enter email + password. New here? `/signup` creates a `member`-role login with no savings account attached (real member accounts are opened by an officer — see below). Forgot your password? Use the link on the sign-in page — it emails a reset link (subject to the email-sending caveat above).

### As a member

- **Overview** — total balance, principal (locked 1 yr from your start date), interest (withdrawable anytime), and this month's contribution progress.
- **Withdraw** — pick Interest or Principal, enter an amount (or click **Max** to fill your full available balance), confirm. Principal is disabled while locked.
- **Activity** — your transaction history; **Export** downloads it as a CSV.
- **Settings** — edit your own name/phone, or change your sign-in email/password.
- You can't log your own contributions — that's done by your officer when you make a deposit in person.

### As an officer

- **Officer desk** — your at-a-glance stats: accounts you manage, contributions logged today, total under your management.
- **New account** — open a real member account: name, email, phone, national ID, daily amount (min 2,000 Ushs), branch, start date. **For now, this creates the login with a temporary password shown on screen instead of emailing an invite** (see "Direct-password accounts" below) — give that password to the member so they can sign in immediately.
- **Quick log contribution** — search a member you manage by name/account #, enter an amount and a date (defaults to today, can be backdated), log the deposit.
- **Accounts** — every member you manage, with an **Edit** action per row to update their phone/branch/national ID (not their name — only they can change that, via their own Settings).

### As an admin

- **Overview** — platform-wide totals, the cash-flow chart (real deposits vs. withdrawals, last 6 months), and funds-by-branch breakdown.
- **All members** — every account on the platform, with **Export** to CSV.
- **Branches** — add or remove branches; each shows its member count and funds under management. A branch with anyone still assigned to it can't be deleted.
- **Users** — search any account (member, officer, or admin) and edit their name/phone/branch/role — this is how you promote someone to officer or admin, without touching SQL. Also where admin does what officers do: **Open a new account** (top of the page) opens a real member account the same way an officer does — same temporary-password behavior as the officer's form. Selecting a member also shows a **Start date** field — an admin-only correction for when a member's account genuinely started, since that drives their lock date and interest cycle — and **Set / reset password**, which generates a fresh, immediately-usable password on screen (no email involved), for accounts that never got a real login (e.g. members batch-imported with `silent: true`) or anyone who's simply locked out; optionally replace a placeholder/incorrect email in the same action, since that becomes what they sign in with. Below that, a full-width **{member}'s savings log** panel — the same edit/delete-capable log as the Savings tab (a shared `TransactionLog` component, so a fix behaves identically from either place), plus a **Log a contribution** field right above it — so an admin can review, correct, and log a deposit for one person without leaving the Users tab or bouncing over to Savings.
- **Savings** — every transaction on the platform in one table (date, member, type, amount, balance), searchable by name/account #, with **Export** to CSV. Each row has an **Edit** action (date always; amount adjusts the member's balance by the difference) and a **Delete** action (fully undoes its effect on the balance, then removes the row — asks for confirmation first, can't be undone). Both work for deposits, interest, and withdrawals — withdrawals now record which bucket (principal or interest) they drew from specifically so this can be done safely. Withdrawals logged before that tracking existed only allow a date correction, since there's no way to know which bucket to reconcile for those older rows.
- **Settings** — same self-edit (name/phone/email/password) every role gets.
- **"Run interest accrual"** button on Overview manually credits interest for any member whose 30-day cycle has elapsed, instead of waiting for the daily scheduled job.

## System rules (`src/lib/data.ts`)

- Minimum 2,000 Ushs/day contribution
- 7% compound interest per 30-day cycle (`projectInterest`)
- Interest withdrawable anytime; principal locked for 1 year (`isLocked`, `unlockDate`)

## Structure

```
src/
  app/
    page.tsx                    sign-in (split-screen design, shared with the other auth pages)
    signup/page.tsx             sign-up (bootstraps first admin/officer only)
    forgot-password/page.tsx    request a password-reset email
    reset-password/page.tsx     set a new password from the emailed link
    dashboard/page.tsx          shell, role-specific nav, tab routing
    layout.tsx                  wraps app in AuthProvider
    globals.css                 design tokens, component styles, responsive breakpoints
  components/
    MemberView.tsx        member dashboard — balance, withdraw, activity, export
    OfficerView.tsx        officer desk — open accounts, log deposits, edit members
    AdminView.tsx           admin reports — stats, cash-flow chart, branch donut, all members, export, interest accrual trigger
    AdminUsers.tsx          admin — search/edit any account, promote roles, open accounts, log deposits
    AdminBranches.tsx       admin — add/remove branches, per-branch stats
    AdminSavings.tsx        admin — every transaction platform-wide, search, export
    AccountSettings.tsx     shared self-service settings (name/phone/email/password) — every role
    AuthVisual.tsx          shared illustration panel reused by all four auth pages
    GlobalSearch.tsx        ⌘K search modal — officer/admin only, jumps to a member/user's edit panel
    Loader.tsx              shared loading indicator (branded full-page variant + inline panel variant)
    TransactionLog.tsx      shared editable transaction list — powers both AdminSavings and AdminUsers' per-member log
    PasswordInput.tsx       drop-in <input type="password"> replacement with a show/hide toggle — used everywhere a password is typed
    Icons.tsx
  context/AuthContext.tsx
  lib/
    data.ts               types, business rules (RULES, isLocked, projectInterest, fmt)
    csv.ts                CSV export helper (includes a formula-injection guard, see below)
    supabase/client.ts     browser Supabase client
    supabase/server.ts     server Supabase client (Server Components)
middleware.ts              session refresh + coarse route gating
supabase/
  schema.sql               tables, RLS policies, RPCs, interest-accrual job — run once in the SQL Editor
  functions/create-member/index.ts  Edge Function: officer invites a real member login
```

## Known gaps / future work

- **Contribution self-service**: members currently can't log their own deposits (by design — contributions are collected in person and logged by the officer). The "Add contribution" button is decorative.
- **Withdrawals** now support a partial amount (with a "Max" quick-fill) instead of always withdrawing the full balance.
- **Admin cash-flow chart** is now live (real `transactions` grouped by month, last 6 months) — it'll look sparse until there's real transaction volume, which is expected, not a bug.
- **Trend badges** (e.g. "+12%") were removed rather than left fake — true period-over-period trends need a snapshot table.
- **Export** (member activity, admin all-members) downloads a real CSV of what's on screen (`src/lib/csv.ts`). Guards against CSV/formula injection — a text cell starting with `=`, `+`, `-`, `@`, tab, or CR (e.g. a member setting their own name to a formula via Settings) is neutralized before export, so opening the file in Excel/Sheets can't execute anything.
- **Mobile responsive** — sidebar collapses to a horizontal icon strip, grids stack to one column, tables scroll horizontally instead of squeezing illegibly, and there's a dedicated `≤480px` breakpoint for phones on top of the `≤760px`/`≤1000px` tablet breakpoints (`src/app/globals.css`). Re-audited after every feature added since, including the ⌘K search modal, the Loader, and the newer Users-tab panels — all form inputs are 16px (below that, iOS Safari auto-zooms in on focus, which is a real mobile bug, not a style choice) and inline mini-forms that used to be one unwrapping flex row (Log a contribution, Set/reset password) now wrap on narrow screens instead of overflowing.
- **Domain verification for email** is still not done — password resets only reliably reach your own email until a custom domain is verified with the SMTP provider (see setup notes above). Member account creation currently works around this: **"Open a new account" (both officer and admin) now generates a temporary password shown on screen instead of emailing an invite** — the officer/admin relays it to the member directly (in person, SMS, WhatsApp), and the member is expected to change it via Settings after their first sign-in. This is a deliberate "for now" workaround (`directPassword: true` in `create-member`'s Edge Function) — once a domain is verified, switch both forms back to the plain invite flow by dropping that flag, since a real invite (member sets their own password, nobody else ever knows it) is the better long-term default.
- **No automated tests** exist anywhere in the project — RLS policies and RPCs (including all money-movement logic) have only been verified manually/via ad-hoc API calls. Worth setting up before this handles real money at any scale.
- **Branch manager role** was discussed but never scoped/built — still just member/officer/admin.
- **Interest accrual** is now automated: `credit_interest_cycle()` (`supabase/schema.sql`) credits every member's `interest` for each fully-elapsed 30-day cycle since their `last_interest_at` cursor, compounding on `principal + interest` — matches `projectInterest()`'s math when principal is static. Scheduled daily via `pg_cron` (`credit-interest-daily`). Admin can also trigger it on demand from the Reports page ("Run interest accrual") without waiting for a real cycle. Known simplification: if a single run has to catch multiple elapsed cycles at once (cron down 60+ days, or the first run against pre-existing members), it applies today's principal retroactively across the skipped cycles rather than the principal that existed at each historical boundary — correct only when principal was static across those cycles.
