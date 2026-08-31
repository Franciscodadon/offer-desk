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
