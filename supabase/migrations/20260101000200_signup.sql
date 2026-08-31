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
