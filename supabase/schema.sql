-- Phase 1: auth/org/role foundation.
-- See INTELLIGENT_LOG_ANALYZER_ENTERPRISE_REBUILD.md §12-13 for the full target schema.
-- credits_ledger, subscriptions, and a Postgres `incidents` table are Phase 6/billing
-- scope and are intentionally not created here — incidents currently live in MongoDB
-- (backend/models/incident.py) and stay there until a later phase says otherwise.

create extension if not exists "pgcrypto";

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
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
grant select, insert, update, delete on organizations, user_profiles, detection_rules, audit_logs to authenticated, service_role;
