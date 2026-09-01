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
