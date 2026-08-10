-- Phase 1: auth/org/role foundation.
-- See INTELLIGENT_LOG_ANALYZER_ENTERPRISE_REBUILD.md §12-13 for the full target schema.
-- Phase 6 adds credits_ledger + subscriptions below. A Postgres `incidents`
-- table is still not created — incidents live in MongoDB
-- (backend/models/incident.py) and stay there until a later phase says otherwise.

create extension if not exists "pgcrypto";

-- credits_current_period / free_credits_remaining implement a lazy-reset
-- monthly free tier, separate from purchased credits (credits_ledger).
-- There's no scheduled job resetting every org at month boundaries —
-- whichever balance check happens to run first after a new month starts
-- notices the stored period is stale and resets right then
-- (backend/billing/credits.py). No rollover: a stale reset always sets
-- free_credits_remaining to exactly 20, never adds to whatever was left.
-- credits_current_period starts null so a brand-new org's first balance
-- check naturally triggers initialization through the same code path,
-- rather than needing special-cased logic at signup.
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  credits_current_period text,
  free_credits_remaining integer not null default 20,
  created_at timestamptz default now()
);

create table user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  org_id uuid references organizations(id) on delete cascade,
  full_name text,
  role text not null default 'viewer' check (role in ('admin', 'analyst', 'viewer')),
  created_at timestamptz default now()
);

create table detection_rules (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  rule_key text not null,
  weight integer not null,
  enabled boolean default true
);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  actor_id uuid,
  action text not null,
  ip_address text,
  user_agent text,
  created_at timestamptz default now()
);

-- credits_ledger is append-only: current balance = SUM(delta) for an org,
-- never mutate a past entry to "correct" it — insert an offsetting entry
-- instead, same as any real accounting ledger.
--
-- razorpay_payment_id is nullable (the signup bonus and any other
-- non-Razorpay entries have none) but unique when present — Razorpay
-- retries webhook deliveries, and without this, a retried payment_link.paid
-- event would double-credit the org. A retry hits the unique constraint and
-- is treated as an idempotent no-op instead of a duplicate top-up.
create table credits_ledger (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  delta integer not null,       -- +100 top-up, -1 per AI report (Phase 9, not wired yet)
  reason text not null,
  razorpay_payment_id text unique,
  created_at timestamptz default now()
);

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  razorpay_customer_id text,
  razorpay_subscription_id text,
  plan text not null default 'free',
  status text not null default 'active'
);

-- Row Level Security ---------------------------------------------------------
--
-- org_id/role are read from the caller's JWT `app_metadata` claim, which only
-- the service role can set (see backend/db/supabase.py: admin_set_app_metadata,
-- called once at signup). Policies deliberately do NOT use `user_metadata` —
-- that's user-editable and would let anyone grant themselves any org/role.
--
-- Org + profile provisioning at signup happens server-side with the service
-- role key, which bypasses RLS by default in Supabase — that's intentional
-- and is the only way a brand-new user (who doesn't have an org yet) can end
-- up with one. Regular reads/writes from the app use the caller's own JWT and
-- are subject to every policy below.

alter table organizations enable row level security;
alter table user_profiles enable row level security;
alter table detection_rules enable row level security;
alter table audit_logs enable row level security;
alter table credits_ledger enable row level security;
alter table subscriptions enable row level security;

-- organizations: members can read their own org. No INSERT/UPDATE/DELETE
-- policy exists for regular users — default-deny, provisioning is service-role only.
create policy "org members can read own org"
  on organizations for select
  using (id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

-- user_profiles: members can read profiles within their own org (so teammates
-- are visible later). No UPDATE policy is defined on purpose: allowing
-- self-service updates on this table risks a user editing their own `role`
-- column to escalate privileges. Role changes should go through an
-- admin-only, server-validated endpoint in a later phase — not a direct
-- RLS-gated write.
create policy "org members can read own org profiles"
  on user_profiles for select
  using (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

-- detection_rules: any org member can read; only admins can write. No
-- endpoint calls the write path yet (Phase 4 builds it) but the policy is
-- correct from day one so the table is never open for editing in the meantime.
create policy "org members can read own detection rules"
  on detection_rules for select
  using (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

create policy "org admins can write own detection rules"
  on detection_rules for all
  using (
    org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
    and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  )
  with check (
    org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
    and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- audit_logs: admins only, and read-only from the API — no UPDATE/DELETE
-- policy is defined anywhere, on purpose. Audit trails must be immutable
-- once written. Inserts happen via the service role from backend code.
create policy "org admins can read own audit logs"
  on audit_logs for select
  using (
    org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
    and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- credits_ledger: org members can read their own ledger (to see balance and
-- history). No INSERT/UPDATE/DELETE policy for regular users, on purpose —
-- every entry is either the signup bonus or a webhook-verified Razorpay
-- top-up, both written server-side via the service role. A ledger that
-- users could write to directly would let anyone grant themselves credits.
create policy "org members can read own credits ledger"
  on credits_ledger for select
  using (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

-- subscriptions: org members can read their own subscription/plan status.
-- No user-facing write policy — plan changes go through Razorpay Payment
-- Links + webhook (service role), not a direct table edit.
create policy "org members can read own subscription"
  on subscriptions for select
  using (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

-- Data API grants --------------------------------------------------------------
--
-- This project was created with "Automatically expose new tables" OFF
-- (Supabase's own recommendation), so these tables need explicit grants to
-- be reachable via the Data API at all — RLS above still decides which rows
-- are visible per request; this just makes the tables reachable in the
-- first place.
--
-- service_role also needs an explicit grant here — bypassing RLS
-- (BYPASSRLS) and holding ordinary table-level SELECT/INSERT/UPDATE/DELETE
-- privileges are two separate Postgres permission layers. With automatic
-- exposure off, neither role gets either layer for free.

grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on organizations, user_profiles, detection_rules, audit_logs, credits_ledger, subscriptions to authenticated, service_role;
