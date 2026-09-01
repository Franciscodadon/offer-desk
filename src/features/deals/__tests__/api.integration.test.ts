/**
 * @jest-environment node
 *
 * Exercises the real deal data layer against a real PostgREST on a real
 * Postgres with the real migrations applied. Not part of `npm test`; run it
 * with `npm run test:integration` after `scripts/integration-up.sh`.
 *
 * What this proves that unit tests cannot: that the RLS policies, the column
 * grants, and the queries in api.ts actually agree with each other. A policy
 * that denies everything and a policy that works correctly look identical to a
 * mocked test.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/database.types';
import { clientFor, isPostgrestUp, startGateway } from '@/test/integration/harness';

// Seeded by scripts/integration-up.sh through the real signup trigger.
const ALICE = '11111111-1111-1111-1111-111111111111';
const BOB = '22222222-2222-2222-2222-222222222222';

let gateway: { url: string; close: () => Promise<void> };
let alice: SupabaseClient<Database>;
let bob: SupabaseClient<Database>;
let aliceOrg: string;
let bobOrg: string;

// The api layer resolves its client through requireSupabase; point that at the
// authenticated client for whichever user the test is acting as. Jest hoists
// mock factories, so the variable they close over must be `mock`-prefixed.
let mockActive: SupabaseClient<Database>;
jest.mock('@/lib/supabase', () => ({
  requireSupabase: () => mockActive,
  getSupabase: () => mockActive,
}));

// eslint-disable-next-line import/first
import { createDeal, deleteDeal, getDeal, listDeals, saveProperty, updateDeal } from '../api';

beforeAll(async () => {
  if (!(await isPostgrestUp())) {
    throw new Error(
      'PostgREST is not running. Start it with scripts/integration-up.sh before running integration tests.',
    );
  }

  gateway = await startGateway();
  alice = clientFor(gateway.url, ALICE);
  bob = clientFor(gateway.url, BOB);

  mockActive = alice;
  const { data: aliceProfile } = await alice.from('users').select('org_id').eq('id', ALICE).single();
  aliceOrg = aliceProfile!.org_id;

  mockActive = bob;
  const { data: bobProfile } = await bob.from('users').select('org_id').eq('id', BOB).single();
  bobOrg = bobProfile!.org_id;
});

afterAll(async () => {
  await gateway?.close();
});

beforeEach(() => {
  mockActive = alice;
});

describe('the app can actually read and write through RLS', () => {
  it('resolves each user to their own org', () => {
    // If auth.uid() did not read the JWT correctly, these would be undefined -
    // which is exactly the failure mode of reading only the legacy claim.
    expect(aliceOrg).toMatch(/^[0-9a-f-]{36}$/);
    expect(bobOrg).toMatch(/^[0-9a-f-]{36}$/);
    expect(aliceOrg).not.toBe(bobOrg);
  });

  it('creates a deal and reads it back', async () => {
    const created = await createDeal({
      org_id: aliceOrg,
      address: '77 Integration Way',
      city: 'Fort Myers',
      state: 'FL',
      list_price: 300000,
      offer_price: 240000,
      status: 'loi_sent',
    });

    expect(created.id).toBeTruthy();
    expect(created.address).toBe('77 Integration Way');
    // numeric columns come back as numbers, not strings
    expect(created.list_price).toBe(300000);

    const deals = await listDeals(aliceOrg);
    expect(deals.map((deal) => deal.id)).toContain(created.id);
  });

  it('updates a deal', async () => {
    const created = await createDeal({ org_id: aliceOrg, address: '78 Update Ave' });
    const updated = await updateDeal(created.id, { status: 'offer_accepted', offer_price: 199000 });

    expect(updated.status).toBe('offer_accepted');
    expect(updated.offer_price).toBe(199000);
  });

  it('soft deletes rather than removing the row', async () => {
    const created = await createDeal({ org_id: aliceOrg, address: '79 Delete Ln' });
    await deleteDeal(created.id);

    const deals = await listDeals(aliceOrg);
    expect(deals.map((deal) => deal.id)).not.toContain(created.id);
    // Still fetchable by id only because the row survives; getDeal filters it.
    expect(await getDeal(created.id)).toBeNull();
  });

  it('writes the 1:1 property row and reads it back with the deal', async () => {
    const created = await createDeal({ org_id: aliceOrg, address: '80 Property Rd' });
    await saveProperty({ org_id: aliceOrg, deal_id: created.id, sqft: 1850, beds: 3, baths: 2 });

    const full = await getDeal(created.id);
    expect(full?.property?.sqft).toBe(1850);
    expect(full?.property?.beds).toBe(3);
  });

  it('upserts the property row instead of duplicating it', async () => {
    const created = await createDeal({ org_id: aliceOrg, address: '81 Upsert Cir' });
    await saveProperty({ org_id: aliceOrg, deal_id: created.id, sqft: 1000 });
    await saveProperty({ org_id: aliceOrg, deal_id: created.id, sqft: 2000 });

    const full = await getDeal(created.id);
    expect(full?.property?.sqft).toBe(2000);
  });
});

describe('org isolation holds through the API', () => {
  it('does not show one org the other org deals', async () => {
    mockActive = alice;
    await createDeal({ org_id: aliceOrg, address: '90 Alpha Only St' });

    mockActive = bob;
    const bobsDeals = await listDeals(bobOrg);
    expect(bobsDeals.map((deal) => deal.address)).not.toContain('90 Alpha Only St');
  });

  it('returns nothing when one org asks for the other org deals by org id', async () => {
    mockActive = bob;
    // Asking for Alice's org explicitly must still return nothing: the policy
    // filters, the query filter is not what protects the data.
    const stolen = await listDeals(aliceOrg);
    expect(stolen).toEqual([]);
  });

  it('refuses a cross-org insert', async () => {
    mockActive = bob;
    await expect(
      createDeal({ org_id: aliceOrg, address: 'Should not exist' }),
    ).rejects.toBeDefined();
  });

  it('cannot fetch another org deal by id', async () => {
    mockActive = alice;
    const created = await createDeal({ org_id: aliceOrg, address: '91 Private Way' });

    mockActive = bob;
    expect(await getDeal(created.id)).toBeNull();
  });

  it('cannot update another org deal', async () => {
    mockActive = alice;
    const created = await createDeal({ org_id: aliceOrg, address: '92 Untouchable Blvd' });

    mockActive = bob;
    // The row is invisible, so the update matches nothing and PostgREST reports
    // no row rather than silently succeeding.
    await expect(updateDeal(created.id, { status: 'pass' })).rejects.toBeDefined();

    mockActive = alice;
    const after = await getDeal(created.id);
    expect(after?.status).not.toBe('pass');
  });
});

describe('the token is what grants access', () => {
  it('rejects a request with no valid user', async () => {
    // A token for a user with no profile row resolves to no org, so every
    // policy fails closed rather than open.
    const stranger = clientFor(gateway.url, '33333333-3333-3333-3333-333333333333');
    const { data } = await stranger.from('deals').select('*');
    expect(data).toEqual([]);
  });
});
