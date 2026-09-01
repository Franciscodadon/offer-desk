-- Offer Desk - complete database schema.
--
-- GENERATED FILE. Do not edit: edit supabase/migrations/ and run
-- npm run db:bundle. CI checks that this file matches the migrations.
--
-- To apply: copy this whole file into the Supabase SQL Editor and Run.
-- It is one transaction, so it either all applies or none of it does.

begin;

-- ============================================================
-- 20260101000000_init.sql
-- ============================================================
-- Offer Desk - initial schema.
-- PRD section 9. Every table carries org_id for multi-tenancy, created_at /
-- updated_at timestamps, and deleted_at for soft delete. Built multi-tenant
-- from day one even while a single org is in practice (PRD principle 6).

-- Hosted Supabase installs extensions into the `extensions` schema, while a
-- plain Postgres puts them in `public`. Naming both here lets an operator class
-- like gin_trgm_ops resolve either way; a schema that does not exist is simply
-- ignored, so the same line is correct in both places.
set search_path = public, extensions;

create extension if not exists "pgcrypto";
-- Backs trigram address search on deals.
create extension if not exists "pg_trgm";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type org_role as enum ('owner', 'admin', 'member');

create type deal_status as enum (
  'loi_sent',
  'follow_up',
  'offer_accepted',
  'offer_rejected',
  'buyer_rejected',
  'pass'
);

create type contact_type as enum (
  'listing_agent', 'buyer', 'seller', 'lender', 'title', 'other'
);

create type analysis_strategy as enum ('wholesale', 'flip', 'brrrr', 'turnkey');
create type document_type as enum ('loi', 'pof', 'pitch', 'other');
create type template_kind as enum ('loi', 'email');
create type email_provider as enum ('gmail', 'outlook');
create type email_account_status as enum ('connected', 'needs_reauth', 'revoked');

-- ---------------------------------------------------------------------------
-- Shared trigger: keep updated_at honest
-- ---------------------------------------------------------------------------

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Workspaces and members
-- ---------------------------------------------------------------------------

create table orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  signatory_name text,
  signatory_title text,
  buyer_entity text,
  -- EMD, inspection days, close days, default MAO % - merged into new LOIs.
  default_terms jsonb not null default '{}'::jsonb,
  plan text not null default 'internal',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Application-level user profile. Mirrors auth.users, which Supabase owns.
create table users (
  id uuid primary key references auth.users (id) on delete cascade,
  org_id uuid not null references orgs (id) on delete cascade,
  email text not null,
  name text,
  role org_role not null default 'member',
  auth_provider text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index users_org_id_idx on users (org_id);

-- ---------------------------------------------------------------------------
-- Contacts
-- ---------------------------------------------------------------------------

create table contacts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs (id) on delete cascade,
  name text not null,
  brokerage text,
  phone text,
  email text,
  type contact_type not null default 'listing_agent',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index contacts_org_id_idx on contacts (org_id);
create index contacts_email_idx on contacts (org_id, lower(email));

-- ---------------------------------------------------------------------------
-- Deals - the core pipeline record
-- ---------------------------------------------------------------------------

create table deals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs (id) on delete cascade,
  address text not null,
  city text,
  state text,
  zip text,
  parcel_id text,
  mls text,
  agent_id uuid references contacts (id) on delete set null,
  list_price numeric(14, 2),
  offer_price numeric(14, 2),
  status deal_status not null default 'loi_sent',
  -- Date the offer went out. Drives the weekly KPI count (PRD 7.9).
  submitted_at date,
  next_action_at date,
  assignee_id uuid references users (id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Indexes named in PRD 12: org_id, status, submitted_at.
create index deals_org_id_idx on deals (org_id) where deleted_at is null;
create index deals_status_idx on deals (org_id, status) where deleted_at is null;
create index deals_submitted_at_idx on deals (org_id, submitted_at desc) where deleted_at is null;
create index deals_next_action_idx on deals (org_id, next_action_at) where deleted_at is null;
create index deals_assignee_idx on deals (org_id, assignee_id) where deleted_at is null;
-- Backs the address search in PRD 7.2.
create index deals_address_trgm_idx on deals using gin (address gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Property facts - 1:1 with a deal
-- ---------------------------------------------------------------------------

create table properties (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs (id) on delete cascade,
  deal_id uuid not null unique references deals (id) on delete cascade,
  beds numeric(4, 1),
  baths numeric(4, 1),
  sqft integer,
  lot_sqft integer,
  year_built integer,
  subdivision text,
  listing_url text,
  appraiser_url text,
  permit_no text,
  permit_url text,
  is_vacant boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index properties_org_id_idx on properties (org_id);

-- ---------------------------------------------------------------------------
-- Analyses - one saved state per strategy per deal
-- ---------------------------------------------------------------------------

create table analyses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs (id) on delete cascade,
  deal_id uuid not null references deals (id) on delete cascade,
  strategy analysis_strategy not null,
  arv numeric(14, 2),
  repairs numeric(14, 2),
  mao_pct numeric(6, 4),
  market text,
  purchase numeric(14, 2),
  target_profit numeric(14, 2),
  -- Strategy-specific inputs. Flip: loans[], holding, txn. BRRRR/turnkey:
  -- rent, expense_pct, ltv_pct, cap_rate. See PRD appendix D.
  inputs jsonb not null default '{}'::jsonb,
  -- Snapshot of computed outputs at save time, so a pitch generated last month
  -- still shows the numbers it was generated from.
  computed jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (deal_id, strategy)
);

create index analyses_org_id_idx on analyses (org_id);
create index analyses_deal_id_idx on analyses (deal_id);

-- ---------------------------------------------------------------------------
-- Comps
-- ---------------------------------------------------------------------------

create table comps (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs (id) on delete cascade,
  deal_id uuid not null references deals (id) on delete cascade,
  address text not null,
  beds numeric(4, 1),
  baths numeric(4, 1),
  sqft integer,
  distance_mi numeric(6, 2),
  sold_price numeric(14, 2),
  sold_date date,
  link text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index comps_org_id_idx on comps (org_id);
create index comps_deal_id_idx on comps (deal_id) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- Generated documents
-- ---------------------------------------------------------------------------

create table documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs (id) on delete cascade,
  -- Null for org-level documents such as a reusable proof of funds.
  deal_id uuid references deals (id) on delete cascade,
  type document_type not null,
  storage_path text not null,
  url text,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index documents_org_id_idx on documents (org_id);
create index documents_deal_id_idx on documents (deal_id, type);

-- ---------------------------------------------------------------------------
-- Merge-field templates
-- ---------------------------------------------------------------------------

create table templates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs (id) on delete cascade,
  kind template_kind not null,
  name text not null,
  body text not null,
  -- e.g. 'vacant', 'occupied', 'priced', 'preliminary' (PRD 7.4).
  variant text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index templates_org_kind_idx on templates (org_id, kind);

-- ---------------------------------------------------------------------------
-- Connected mailboxes (PRD 7.5)
-- ---------------------------------------------------------------------------

create table email_accounts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs (id) on delete cascade,
  user_id uuid not null references users (id) on delete cascade,
  provider email_provider not null,
  address text not null,
  display_name text,
  -- OAuth tokens. Encrypted at rest and readable only by Edge Functions using
  -- the service role; the RLS policies below never expose these columns to a
  -- client. Passwords are never stored, for any provider.
  refresh_token_enc text,
  access_token_enc text,
  token_expires_at timestamptz,
  is_default boolean not null default false,
  status email_account_status not null default 'connected',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, provider, address)
);

create index email_accounts_org_idx on email_accounts (org_id);
create index email_accounts_user_idx on email_accounts (user_id);

-- ---------------------------------------------------------------------------
-- Audit log (PRD 12: reliability)
-- ---------------------------------------------------------------------------

create table activities (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs (id) on delete cascade,
  deal_id uuid references deals (id) on delete cascade,
  user_id uuid references users (id) on delete set null,
  -- 'status_changed', 'loi_generated', 'email_sent', 'pitch_generated', ...
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index activities_org_idx on activities (org_id, at desc);
create index activities_deal_idx on activities (deal_id, at desc);

-- ---------------------------------------------------------------------------
-- Follow-up reminders (PRD 7.10)
-- ---------------------------------------------------------------------------

create table reminders (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs (id) on delete cascade,
  deal_id uuid not null references deals (id) on delete cascade,
  due_at timestamptz not null,
  done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index reminders_due_idx on reminders (org_id, due_at) where done = false;

-- ---------------------------------------------------------------------------
-- Billing (v3, table created now so the model does not change later)
-- ---------------------------------------------------------------------------

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null unique references orgs (id) on delete cascade,
  stripe_customer text,
  plan text not null default 'internal',
  seats integer not null default 1,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'orgs', 'users', 'contacts', 'deals', 'properties', 'analyses', 'comps',
    'documents', 'templates', 'email_accounts', 'activities', 'reminders',
    'subscriptions'
  ]
  loop
    execute format(
      'create trigger %I_set_updated_at before update on %I
         for each row execute function set_updated_at()',
      t, t
    );
  end loop;
end;
$$;

-- ============================================================
-- 20260101000100_rls.sql
-- ============================================================
-- Row-Level Security - the mechanism that makes Offer Desk multi-tenant.
-- PRD 12: "Supabase RLS enforces org_id isolation on every table."
--
-- Shape of the rules:
--   * Every table has RLS enabled and a policy keyed on the caller's org.
--   * current_org_id() resolves the signed-in user's org from public.users.
--     It is SECURITY DEFINER so reading it does not itself trigger a policy
--     check on users, which would recurse.
--   * search_path is pinned on every SECURITY DEFINER function so a caller
--     cannot shadow `public` with their own schema and redirect the lookup.

create or replace function current_org_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select org_id from public.users where id = auth.uid() and deleted_at is null;
$$;

create or replace function current_user_role()
returns org_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select role from public.users where id = auth.uid() and deleted_at is null;
$$;

grant execute on function current_org_id() to authenticated;
grant execute on function current_user_role() to authenticated;

-- ---------------------------------------------------------------------------
-- Table privileges.
--
-- A hosted Supabase project grants these to anon and authenticated by default,
-- but relying on a platform default leaves the security posture unstated and
-- unportable. Grant explicitly instead, so the repository is the record of who
-- may touch what:
--   * anon (signed out) gets nothing at all.
--   * authenticated gets CRUD, still filtered by the policies below.
--   * orgs and subscriptions are read-mostly; billing is written only by the
--     service role from a Stripe webhook.
-- email_accounts is granted column by column further down, because its token
-- columns must not be reachable even by their owner.
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array[
    'contacts', 'deals', 'properties', 'analyses', 'comps',
    'documents', 'templates', 'activities', 'reminders'
  ]
  loop
    execute format('grant select, insert, update, delete on %I to authenticated', t);
  end loop;
end;
$$;

grant select, update on orgs to authenticated;
grant select, update on users to authenticated;
grant select on subscriptions to authenticated;

alter table orgs            enable row level security;
alter table users           enable row level security;
alter table contacts        enable row level security;
alter table deals           enable row level security;
alter table properties      enable row level security;
alter table analyses        enable row level security;
alter table comps           enable row level security;
alter table documents       enable row level security;
alter table templates       enable row level security;
alter table email_accounts  enable row level security;
alter table activities      enable row level security;
alter table reminders       enable row level security;
alter table subscriptions   enable row level security;

-- ---------------------------------------------------------------------------
-- orgs: members read their own workspace; only owners and admins change it.
-- ---------------------------------------------------------------------------

create policy orgs_select on orgs
  for select to authenticated
  using (id = current_org_id());

create policy orgs_update on orgs
  for update to authenticated
  using (id = current_org_id() and current_user_role() in ('owner', 'admin'))
  with check (id = current_org_id());

-- ---------------------------------------------------------------------------
-- users: members see everyone in their org; a member may edit only their own
-- profile, while owners and admins may edit anyone in the org (v2 RBAC).
-- Inserts are handled by the signup trigger, not by clients.
-- ---------------------------------------------------------------------------

create policy users_select on users
  for select to authenticated
  using (org_id = current_org_id());

create policy users_update_self on users
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and org_id = current_org_id());

create policy users_update_as_admin on users
  for update to authenticated
  using (org_id = current_org_id() and current_user_role() in ('owner', 'admin'))
  with check (org_id = current_org_id());

-- ---------------------------------------------------------------------------
-- Org-scoped tables: full CRUD within your own org, nothing outside it.
-- Generated rather than written out thirteen times so no table is missed and
-- none can drift.
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'contacts', 'deals', 'properties', 'analyses', 'comps',
    'documents', 'templates', 'activities', 'reminders'
  ]
  loop
    execute format(
      'create policy %1$I_select on %1$I for select to authenticated
         using (org_id = current_org_id())', t);
    execute format(
      'create policy %1$I_insert on %1$I for insert to authenticated
         with check (org_id = current_org_id())', t);
    execute format(
      'create policy %1$I_update on %1$I for update to authenticated
         using (org_id = current_org_id())
         with check (org_id = current_org_id())', t);
    execute format(
      'create policy %1$I_delete on %1$I for delete to authenticated
         using (org_id = current_org_id())', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- email_accounts: a user manages only their own connected mailboxes, even
-- inside their own org. Nobody reads someone else's OAuth tokens.
-- ---------------------------------------------------------------------------

create policy email_accounts_select on email_accounts
  for select to authenticated
  using (org_id = current_org_id() and user_id = auth.uid());

create policy email_accounts_insert on email_accounts
  for insert to authenticated
  with check (org_id = current_org_id() and user_id = auth.uid());

create policy email_accounts_update on email_accounts
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and org_id = current_org_id());

create policy email_accounts_delete on email_accounts
  for delete to authenticated
  using (user_id = auth.uid());

-- Belt and braces on top of the policy above: revoke the token columns from
-- client roles entirely, so even a future policy mistake cannot leak them.
-- Edge Functions use the service role, which bypasses both.
revoke all on email_accounts from anon, authenticated;
grant select (
  id, org_id, user_id, provider, address, display_name,
  token_expires_at, is_default, status, created_at, updated_at, deleted_at
) on email_accounts to authenticated;
grant insert (
  id, org_id, user_id, provider, address, display_name, is_default, status
) on email_accounts to authenticated;
grant update (display_name, is_default, status, deleted_at) on email_accounts to authenticated;
grant delete on email_accounts to authenticated;

-- ---------------------------------------------------------------------------
-- subscriptions: read-only to the org. Only Stripe webhooks, running with the
-- service role, may write billing state.
-- ---------------------------------------------------------------------------

create policy subscriptions_select on subscriptions
  for select to authenticated
  using (org_id = current_org_id());

-- ============================================================
-- 20260101000200_signup.sql
-- ============================================================
-- Signup bootstrap.
--
-- When someone signs up, Supabase inserts into auth.users, which the app cannot
-- write to directly. This trigger creates the matching public.users profile and,
-- for a brand-new account, the org that owns it - so a user is never left
-- signed in with no workspace and no org_id for RLS to match on.
--
-- Invited teammates (v2) arrive with an org_id in their signup metadata and
-- join that org as a member instead of founding a new one.

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_org uuid;
  invited_org uuid;
  display_name text;
  org_name text;
begin
  display_name := nullif(trim(new.raw_user_meta_data ->> 'name'), '');
  org_name := nullif(trim(new.raw_user_meta_data ->> 'org_name'), '');

  begin
    invited_org := (new.raw_user_meta_data ->> 'org_id')::uuid;
  exception when others then
    -- Malformed metadata must not block signup; fall through to a new org.
    invited_org := null;
  end;

  if invited_org is not null and exists (select 1 from orgs where id = invited_org) then
    target_org := invited_org;
    insert into users (id, org_id, email, name, role, auth_provider)
    values (
      new.id, target_org, new.email, display_name, 'member',
      new.raw_app_meta_data ->> 'provider'
    );
  else
    insert into orgs (name)
    values (coalesce(org_name, split_part(new.email, '@', 1) || ' Workspace'))
    returning id into target_org;

    insert into users (id, org_id, email, name, role, auth_provider)
    values (
      new.id, target_org, new.email, display_name, 'owner',
      new.raw_app_meta_data ->> 'provider'
    );

    insert into subscriptions (org_id) values (target_org);
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================
-- 20260101000300_storage.sql
-- ============================================================
-- Private storage buckets for generated documents (PRD 12: "documents in
-- private buckets with signed URLs").
--
-- Objects are laid out as <org_id>/<deal_id>/<filename>, so the org check is a
-- prefix comparison on the object path.

insert into storage.buckets (id, name, public)
values
  ('documents', 'documents', false),
  ('branding', 'branding', false)
on conflict (id) do nothing;

create policy "documents readable within org"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = current_org_id()::text
  );

create policy "documents writable within org"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = current_org_id()::text
  );

create policy "documents updatable within org"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = current_org_id()::text
  );

create policy "documents deletable within org"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = current_org_id()::text
  );

create policy "branding readable within org"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'branding'
    and (storage.foldername(name))[1] = current_org_id()::text
  );

create policy "branding writable by admins"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'branding'
    and (storage.foldername(name))[1] = current_org_id()::text
    and current_user_role() in ('owner', 'admin')
  );

-- ============================================================
-- 20260101000400_default_terms_backfill.sql
-- ============================================================
-- Underwriting defaults: seed them for new workspaces, and backfill existing
-- ones.
--
-- This replaces handle_new_user rather than editing the migration that created
-- it. That migration has been applied to real databases, and an applied
-- migration is never edited: the change would be invisible to every project
-- that already ran it, since migrations are tracked by filename.

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_org uuid;
  invited_org uuid;
  display_name text;
  org_name text;
begin
  display_name := nullif(trim(new.raw_user_meta_data ->> 'name'), '');
  org_name := nullif(trim(new.raw_user_meta_data ->> 'org_name'), '');

  begin
    invited_org := (new.raw_user_meta_data ->> 'org_id')::uuid;
  exception when others then
    invited_org := null;
  end;

  if invited_org is not null and exists (select 1 from orgs where id = invited_org) then
    target_org := invited_org;
    insert into users (id, org_id, email, name, role, auth_provider)
    values (
      new.id, target_org, new.email, display_name, 'member',
      new.raw_app_meta_data ->> 'provider'
    );
  else
    -- A new workspace starts on the 70% rule rather than on zero, so the
    -- analyzer is usable before anyone visits settings.
    insert into orgs (name, default_terms)
    values (
      coalesce(org_name, split_part(new.email, '@', 1) || ' Workspace'),
      '{"maoPct": 0.7, "emd": 1000, "inspectionDays": 10, "closeDays": 21}'::jsonb
    )
    returning id into target_org;

    insert into users (id, org_id, email, name, role, auth_provider)
    values (
      new.id, target_org, new.email, display_name, 'owner',
      new.raw_app_meta_data ->> 'provider'
    );

    insert into subscriptions (org_id) values (target_org);
  end if;

  return new;
end;
$$;

-- Backfill workspaces created before the above. `||` is right-biased, so a
-- value a workspace has already chosen for itself survives; only absent keys
-- are filled.
update orgs
set default_terms =
  '{"maoPct": 0.7, "emd": 1000, "inspectionDays": 10, "closeDays": 21}'::jsonb
  || coalesce(default_terms, '{}'::jsonb)
where deleted_at is null;

commit;
