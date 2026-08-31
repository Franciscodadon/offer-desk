-- RLS isolation tests.
--
-- Verifies the property the whole multi-tenant model rests on: a signed-in user
-- can reach their own org's rows and nothing else. Run against a scratch
-- database that has had shim.sql plus every migration applied.
--
--   psql -d offerdesk -v ON_ERROR_STOP=1 -f supabase/tests/rls_test.sql
--
-- Any failed assertion raises and aborts, so a clean run means all pass.

begin;

-- Two accounts signing up independently. The signup trigger gives each its own
-- org, which is exactly the situation RLS has to keep apart.
insert into auth.users (id, email, raw_user_meta_data)
values
  ('11111111-1111-1111-1111-111111111111', 'alice@example.com',
   '{"name": "Alice", "org_name": "Alpha Acquisitions"}'::jsonb),
  ('22222222-2222-2222-2222-222222222222', 'bob@example.com',
   '{"name": "Bob", "org_name": "Bravo Holdings"}'::jsonb);

do $$
declare
  alice_org uuid;
  bob_org uuid;
  n int;
begin
  select org_id into alice_org from users where id = '11111111-1111-1111-1111-111111111111';
  select org_id into bob_org from users where id = '22222222-2222-2222-2222-222222222222';

  -- The signup trigger did its job.
  if alice_org is null or bob_org is null then
    raise exception 'FAIL: signup trigger did not create a profile with an org';
  end if;
  if alice_org = bob_org then
    raise exception 'FAIL: two independent signups landed in the same org';
  end if;

  -- Each founder owns their workspace.
  if (select role from users where id = '11111111-1111-1111-1111-111111111111') <> 'owner' then
    raise exception 'FAIL: first user of a new org is not the owner';
  end if;

  -- A subscription row was seeded for each new org (v3 billing).
  select count(*) into n from subscriptions where org_id in (alice_org, bob_org);
  if n <> 2 then
    raise exception 'FAIL: expected a subscription row per new org, got %', n;
  end if;

  -- Seed one deal in each org, as the owning user would.
  insert into deals (org_id, address, list_price, offer_price, status, submitted_at)
  values
    (alice_org, '123 Alpha St, Fort Myers, FL', 300000, 240000, 'loi_sent', current_date),
    (bob_org,   '456 Bravo Ave, Cape Coral, FL', 250000, 200000, 'follow_up', current_date);

  -- Stash Bob's org id for the cross-org write attempt below, which runs after
  -- RLS has already hidden the row it would otherwise be read from.
  perform set_config('test.bob_org', bob_org::text, true);
end;
$$;

-- --------------------------------------------------------------------------
-- Now act as Alice, through the `authenticated` role with RLS enforced.
-- --------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

do $$
declare
  n int;
  visible_address text;
begin
  -- Sees exactly her own deal.
  select count(*) into n from deals;
  if n <> 1 then
    raise exception 'FAIL: Alice sees % deals, expected only her own 1', n;
  end if;

  select address into visible_address from deals;
  if visible_address not like '%Alpha%' then
    raise exception 'FAIL: Alice sees the wrong org''s deal: %', visible_address;
  end if;

  -- Sees exactly her own org.
  select count(*) into n from orgs;
  if n <> 1 then
    raise exception 'FAIL: Alice sees % orgs, expected 1', n;
  end if;

  -- Sees only members of her own org.
  select count(*) into n from users;
  if n <> 1 then
    raise exception 'FAIL: Alice sees % users, expected 1', n;
  end if;

  -- current_org_id() resolves for the impersonated user.
  if current_org_id() is null then
    raise exception 'FAIL: current_org_id() is null for a signed-in user';
  end if;
end;
$$;

-- Writing into another org must not succeed. The WITH CHECK clause rejects it.
do $$
declare
  bob_org uuid;
begin
  bob_org := current_setting('test.bob_org')::uuid;

  begin
    insert into deals (org_id, address) values (bob_org, 'Should not exist');
    raise exception 'FAIL: cross-org insert was allowed';
  exception
    when insufficient_privilege then
      null; -- expected: RLS rejected the write
  end;
end;
$$;

-- Updating a row in another org is a no-op rather than an error: the row is
-- invisible, so zero rows match.
do $$
declare
  affected int;
begin
  update deals set offer_price = 1 where address like '%Bravo%';
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'FAIL: Alice updated % rows in another org', affected;
  end if;
end;
$$;

reset role;

-- --------------------------------------------------------------------------
-- An unauthenticated caller sees nothing at all.
-- --------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claim.sub = '';

do $$
declare
  n int;
begin
  select count(*) into n from deals;
  if n <> 0 then
    raise exception 'FAIL: a caller with no user id sees % deals', n;
  end if;
end;
$$;

reset role;

rollback;
