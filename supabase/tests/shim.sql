-- Local-only shim that stands in for the parts of a Supabase project the
-- migrations depend on: the auth and storage schemas, the auth.uid() helper,
-- and the anon / authenticated roles.
--
-- This file is NOT a migration and is never applied to a real project - a
-- hosted Supabase database already provides all of it. It exists so the
-- migrations can be run and the RLS policies exercised against a plain
-- Postgres, in CI or on a laptop, without Docker.

create schema if not exists auth;
create schema if not exists storage;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end;
$$;

grant usage on schema public to anon, authenticated, service_role;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb default '{}'::jsonb,
  raw_app_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- Supabase derives this from the request JWT. This mirrors the real
-- definition, which reads both the legacy per-claim setting and the JSON
-- claims blob:
--   * `request.jwt.claim.sub` is what a psql test sets directly to impersonate
--     a user, and what PostgREST set before v9.
--   * `request.jwt.claims` is the JSON blob PostgREST v9+ sets from the bearer
--     token, so the same policies work under a real API server.
-- Reading only the first is what makes RLS silently deny everything when the
-- policies are exercised through PostgREST rather than through psql.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid;
$$;

-- PostgREST connects as `authenticator` and switches into anon or
-- authenticated per request, based on the token's role claim.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then
    create role authenticator noinherit login password 'postgres';
  end if;
end;
$$;

grant anon, authenticated, service_role to authenticator;
grant usage on schema auth, storage to anon, authenticated, service_role;

create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false
);

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text not null,
  owner uuid,
  created_at timestamptz default now()
);

alter table storage.objects enable row level security;

create or replace function storage.foldername(name text)
returns text[]
language sql
immutable
as $$
  select string_to_array(name, '/');
$$;
