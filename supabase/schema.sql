-- ============================================================
-- Kwega Savings — Supabase schema
--
-- Run this whole file once, top to bottom, in the Supabase
-- Dashboard → SQL Editor, right after creating the project.
-- Safe to re-run individual sections if you tweak something,
-- but a full re-run from a clean project is the intended path.
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
