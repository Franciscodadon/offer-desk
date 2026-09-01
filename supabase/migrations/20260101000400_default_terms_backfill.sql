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
