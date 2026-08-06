-- ============================================================
-- Kwega Savings — Supabase schema
--
-- Run this whole file once, top to bottom, in the Supabase
-- Dashboard → SQL Editor, right after creating the project (brand
-- new project only — `create table` will error if it already exists).
--
-- On an EXISTING project, when new sections get appended later, only
-- paste/run the NEW section you haven't run yet — not the whole file —
-- since the `create table` statements near the top are not re-runnable
-- once the tables exist. Everything below the tables (functions,
-- triggers, grants, alter/add-column-if-not-exists) IS safe to
-- re-run individually.
-- ============================================================

create extension if not exists pgcrypto; -- gen_random_uuid()

-- ------------------------------------------------------------
-- Tables
-- ------------------------------------------------------------

-- One row per auth.users row, for every role (member/officer/admin).
create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  role       text not null default 'member' check (role in ('member', 'officer', 'admin')),
  name       text not null,
  phone      text,
  branch     text, -- officer's home branch; null for admin
  created_at timestamptz not null default now()
);

-- Canonical branch list (officer "New account" dropdown, admin filtering).
-- funds/pct are intentionally NOT stored — always computed from members
-- at query time so they can never go stale.
create table public.branches (
  name       text primary key,
  created_at timestamptz not null default now()
);

insert into public.branches (name) values
  ('Kampala Central'), ('Nakawa'), ('Entebbe'), ('Jinja')
on conflict do nothing;

-- Savings-account fields only. id = profiles.id (1:1, shared PK), so
-- "auth.uid() = members.id" is a direct ownership check with no join.
create sequence public.members_account_seq start 500;

create table public.members (
  id           uuid primary key references public.profiles(id) on delete cascade,
  account_no   text not null unique,
  officer_id   uuid not null references public.profiles(id),
  branch       text not null references public.branches(name),
  national_id  text,
  principal    bigint not null default 0,
  interest     bigint not null default 0,
  daily_amount bigint not null default 2000 check (daily_amount >= 2000), -- RULES.MIN_DAILY in src/lib/data.ts
  start_date   date not null default current_date,
  created_at   timestamptz not null default now()
);

create index members_officer_id_idx on public.members(officer_id);
create index members_branch_idx on public.members(branch);

-- Auto-generate "KW-00500" style account numbers on insert.
create or replace function public.set_member_account_no()
returns trigger language plpgsql as $$
begin
  if new.account_no is null then
    new.account_no := 'KW-' || lpad(nextval('public.members_account_seq')::text, 5, '0');
  end if;
  return new;
end;
$$;

create trigger members_set_account_no
  before insert on public.members
  for each row execute function public.set_member_account_no();

create table public.transactions (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references public.members(id) on delete cascade,
  type        text not null check (type in ('deposit', 'interest', 'withdrawal')),
  amount      bigint not null, -- negative for withdrawal
  balance     bigint not null, -- principal+interest snapshot after this txn
  occurred_at timestamptz not null default now(),
  created_by  uuid references public.profiles(id) -- officer/admin/member who triggered it
);

create index transactions_member_id_idx on public.transactions(member_id);
create index transactions_occurred_at_idx on public.transactions(occurred_at desc);

-- ------------------------------------------------------------
-- handle_new_user — creates the profiles row on signup/invite.
-- Serves both public self-signup (role omitted -> defaults to
-- 'member') and the officer's create-member Edge Function call
-- (role explicitly 'member' in metadata, plus name/phone/branch).
-- ------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, role, name, phone, branch)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'member'),
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'branch'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------

-- SECURITY DEFINER helper so policies can check "is caller an admin"
-- without recursing into profiles' own RLS.
create or replace function public.get_my_role()
returns text
language sql security definer stable
set search_path = public
as $$ select role from public.profiles where id = auth.uid() $$;

alter table public.profiles enable row level security;
alter table public.branches enable row level security;
alter table public.members enable row level security;
alter table public.transactions enable row level security;

-- ---- profiles ----
create policy "profiles_select_self_or_managed_or_admin" on public.profiles
  for select using (
    id = auth.uid()
    or get_my_role() = 'admin'
    or id in (select id from public.members where officer_id = auth.uid())
  );

create policy "profiles_update_admin_only" on public.profiles
  for update using (get_my_role() = 'admin');

-- No client-side INSERT policy: profiles rows are created exclusively by
-- handle_new_user (SECURITY DEFINER, bypasses RLS), so a client can never
-- insert an arbitrary profiles row.

-- ---- branches ----
create policy "branches_select_all" on public.branches
  for select using (auth.role() = 'authenticated');

create policy "branches_admin_write" on public.branches
  for all using (get_my_role() = 'admin') with check (get_my_role() = 'admin');

-- ---- members ----
create policy "members_select_self_or_officer_or_admin" on public.members
  for select using (
    id = auth.uid()
    or officer_id = auth.uid()
    or get_my_role() = 'admin'
  );

create policy "members_admin_write" on public.members
  for all using (get_my_role() = 'admin') with check (get_my_role() = 'admin');

-- Deliberately no insert/update policy for 'officer' or 'member'. All member
-- creation and all principal/interest mutation happens through the
-- SECURITY DEFINER RPCs below or the create-member Edge Function — never a
-- raw client insert/update. This is what makes the lock/min-daily rules
-- unbypassable, not just hidden in the UI.

-- ---- transactions ----
create policy "transactions_select_own_or_managed_or_admin" on public.transactions
  for select using (
    member_id = auth.uid()
    or member_id in (select id from public.members where officer_id = auth.uid())
    or get_my_role() = 'admin'
  );

create policy "transactions_admin_write" on public.transactions
  for all using (get_my_role() = 'admin') with check (get_my_role() = 'admin');

-- ------------------------------------------------------------
-- Money-moving RPCs — the only way principal/interest/transactions
-- ever change from officer/member roles. SECURITY DEFINER (bypasses
-- RLS internally) but re-checks auth.uid() authorization and business
-- rules inside the function body, so the RLS bypass never becomes a
-- privilege escalation.
-- ------------------------------------------------------------

create or replace function public.log_deposit(p_member_id uuid, p_amount bigint)
returns public.transactions
language plpgsql security definer set search_path = public as $$
declare
  v_member public.members;
  v_txn public.transactions;
begin
  select * into v_member from public.members where id = p_member_id;
  if v_member is null then raise exception 'Member not found'; end if;
  if not (v_member.officer_id = auth.uid() or get_my_role() = 'admin') then
    raise exception 'Not authorized to log deposits for this member';
  end if;
  if p_amount <= 0 then raise exception 'Amount must be positive'; end if;

  update public.members set principal = principal + p_amount where id = p_member_id;

  insert into public.transactions (member_id, type, amount, balance, created_by)
  select p_member_id, 'deposit', p_amount, principal + interest, auth.uid()
  from public.members where id = p_member_id
  returning * into v_txn;

  return v_txn;
end;
$$;

create or replace function public.request_withdrawal(p_member_id uuid, p_kind text, p_amount bigint)
returns public.transactions
language plpgsql security definer set search_path = public as $$
declare
  v_member public.members;
  v_txn public.transactions;
  v_locked boolean;
begin
  if p_kind not in ('interest', 'principal') then raise exception 'Invalid kind'; end if;
  select * into v_member from public.members where id = p_member_id;
  if v_member is null then raise exception 'Member not found'; end if;
  if not (p_member_id = auth.uid() or get_my_role() = 'admin') then
    raise exception 'Not authorized';
  end if;
  if p_amount <= 0 then raise exception 'Amount must be positive'; end if;

  -- Mirrors isLocked()/unlockDate() in src/lib/data.ts — keep in sync.
  v_locked := now() < (v_member.start_date + interval '12 months');
  if p_kind = 'principal' and v_locked then
    raise exception 'Principal is locked until %', (v_member.start_date + interval '12 months');
  end if;

  if p_kind = 'interest' then
    if p_amount > v_member.interest then raise exception 'Insufficient interest balance'; end if;
    update public.members set interest = interest - p_amount where id = p_member_id;
  else
    if p_amount > v_member.principal then raise exception 'Insufficient principal balance'; end if;
    update public.members set principal = principal - p_amount where id = p_member_id;
  end if;

  insert into public.transactions (member_id, type, amount, balance, created_by)
  select p_member_id, 'withdrawal', -p_amount, principal + interest, auth.uid()
  from public.members where id = p_member_id
  returning * into v_txn;

  return v_txn;
end;
$$;

revoke all on function public.log_deposit(uuid, bigint) from public;
revoke all on function public.request_withdrawal(uuid, text, bigint) from public;
grant execute on function public.log_deposit(uuid, bigint) to authenticated;
grant execute on function public.request_withdrawal(uuid, text, bigint) to authenticated;

-- ------------------------------------------------------------
-- Profile-editing RPCs — same convention as log_deposit /
-- request_withdrawal: SECURITY DEFINER (bypasses RLS internally)
-- but re-checks auth.uid() authorization inside the function body.
-- ------------------------------------------------------------

-- Any authenticated user, their own row only. No role check needed —
-- the WHERE clause is hardcoded to auth.uid(), never a client-supplied id.
create or replace function public.update_own_profile(p_name text, p_phone text)
returns public.profiles
language plpgsql security definer set search_path = public as $$
declare
  v_profile public.profiles;
begin
  if p_name is null or trim(p_name) = '' then
    raise exception 'Name is required';
  end if;

  update public.profiles
  set name = trim(p_name), phone = p_phone
  where id = auth.uid()
  returning * into v_profile;

  return v_profile;
end;
$$;

-- The member's own managing officer, or admin. Deliberately does NOT
-- accept a name param — officers can never rename a member, full stop,
-- not just in the UI.
create or replace function public.update_member_details(
  p_member_id uuid, p_phone text, p_branch text, p_national_id text
)
returns public.members
language plpgsql security definer set search_path = public as $$
declare
  v_member public.members;
begin
  select * into v_member from public.members where id = p_member_id;
  if v_member is null then raise exception 'Member not found'; end if;
  if not (v_member.officer_id = auth.uid() or get_my_role() = 'admin') then
    raise exception 'Not authorized to edit this member';
  end if;

  update public.members
  set branch = p_branch, national_id = p_national_id
  where id = p_member_id
  returning * into v_member;

  -- Member's phone lives in profiles (shared PK with members), not here.
  update public.profiles set phone = p_phone where id = p_member_id;

  return v_member;
end;
$$;

-- Admin only. Retargets any profiles row, including role. Refuses to
-- touch the caller's own row so an admin can never self-demote by
-- accident — self profile edits go through update_own_profile like
-- everyone else, which cannot change role.
create or replace function public.admin_update_profile(
  p_user_id uuid, p_name text, p_phone text, p_branch text, p_role text
)
returns public.profiles
language plpgsql security definer set search_path = public as $$
declare
  v_profile public.profiles;
begin
  if get_my_role() <> 'admin' then
    raise exception 'Not authorized';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'Use your own Settings page to edit your profile; role cannot be self-changed';
  end if;
  if p_role not in ('member', 'officer', 'admin') then
    raise exception 'Invalid role';
  end if;
  if p_name is null or trim(p_name) = '' then
    raise exception 'Name is required';
  end if;

  update public.profiles
  set name = trim(p_name), phone = p_phone, branch = p_branch, role = p_role
  where id = p_user_id
  returning * into v_profile;

  if v_profile is null then raise exception 'Profile not found'; end if;
  return v_profile;
end;
$$;

revoke all on function public.update_own_profile(text, text) from public;
revoke all on function public.update_member_details(uuid, text, text, text) from public;
revoke all on function public.admin_update_profile(uuid, text, text, text, text) from public;
grant execute on function public.update_own_profile(text, text) to authenticated;
grant execute on function public.update_member_details(uuid, text, text, text) to authenticated;
grant execute on function public.admin_update_profile(uuid, text, text, text, text) to authenticated;

-- ------------------------------------------------------------
-- Interest accrual — credits members.interest for every fully
-- elapsed 30-day cycle, compounding on (principal + interest already
-- credited). principal itself is never touched here — only
-- log_deposit/request_withdrawal change it.
-- ------------------------------------------------------------

-- last_interest_at tracks the cursor up to which interest has been
-- credited, so credit_interest_cycle() below only credits NEW cycles
-- instead of re-crediting from start_date every run.
alter table public.members add column if not exists last_interest_at timestamptz;
update public.members set last_interest_at = start_date::timestamptz where last_interest_at is null;
alter table public.members alter column last_interest_at set not null;

-- DEFAULT can't reference a sibling column (start_date), so this
-- mirrors the members_set_account_no trigger above.
create or replace function public.set_member_last_interest_at()
returns trigger language plpgsql as $$
begin
  if new.last_interest_at is null then
    new.last_interest_at := new.start_date::timestamptz;
  end if;
  return new;
end;
$$;

drop trigger if exists members_set_last_interest_at on public.members;
create trigger members_set_last_interest_at
  before insert on public.members
  for each row execute function public.set_member_last_interest_at();

create or replace function public.credit_interest_cycle()
returns integer
language plpgsql security definer set search_path = public as $$
declare
  m record;
  v_cycles integer;
  v_new_interest bigint;
  v_delta bigint;
  v_credited integer := 0;
begin
  -- anon has no EXECUTE grant at all (see revoke/grant below), so this
  -- guard only has to distinguish an authenticated non-admin (rejected)
  -- from pg_cron's unattended invocation, where auth.uid() is NULL
  -- because there's no PostgREST/JWT context.
  if auth.uid() is not null and get_my_role() <> 'admin' then
    raise exception 'Not authorized';
  end if;

  for m in select * from public.members loop
    v_cycles := floor((now()::date - m.last_interest_at::date) / 30)::int;
    if v_cycles > 0 then
      -- RULES.MONTHLY_RATE in src/lib/data.ts — keep in sync.
      -- Reproduces projectInterest()'s compounding exactly when principal
      -- is static: interest = (principal+interest)*(1+rate)^n - principal.
      -- NOTE: if v_cycles > 1 in a single run (cron down 60+ days, or the
      -- first run against pre-existing members), this applies today's
      -- principal across all skipped cycles rather than the principal at
      -- each historical boundary — a known simplification, not fixable
      -- without replaying transactions chronologically per member.
      v_new_interest := round((m.principal + m.interest) * power(1.07, v_cycles)) - m.principal;
      v_delta := v_new_interest - m.interest;

      update public.members
      set interest = v_new_interest,
          last_interest_at = m.last_interest_at + (v_cycles * 30 || ' days')::interval
      where id = m.id;

      if v_delta > 0 then
        insert into public.transactions (member_id, type, amount, balance, created_by)
        values (m.id, 'interest', v_delta, m.principal + v_new_interest, null);
        v_credited := v_credited + 1;
      end if;
    end if;
  end loop;

  return v_credited;
end;
$$;

revoke all on function public.credit_interest_cycle() from public;
grant execute on function public.credit_interest_cycle() to authenticated;

-- ------------------------------------------------------------
-- Schedule credit_interest_cycle() daily rather than monthly, so it
-- catches up cycles as they complete instead of depending on a single
-- scheduled instant that might be missed; a no-op for any member whose
-- cycle hasn't completed, so daily runs are cheap.
--
-- If `create extension` fails with a permission error, enable pg_cron
-- via Dashboard -> Database -> Extensions instead, then re-run just the
-- cron.schedule(...) call below — it works identically either way.
-- cron.schedule() upserts by job name, so this whole block is safe to
-- re-run.
-- ------------------------------------------------------------

create extension if not exists pg_cron with schema extensions;

select cron.schedule(
  'credit-interest-daily',
  '0 1 * * *',
  $$select public.credit_interest_cycle();$$
);
