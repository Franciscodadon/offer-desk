import type { DealStatus } from '@/domain/status';
import type { Contact, Deal } from '@/domain/types';

import { applyFilters, countByStatus, defaultFilters, sortDeals } from '../filters';

const deal = (over: Partial<Deal> & { id: string; address: string }): Deal => ({
  org_id: 'org-1',
  city: null,
  state: null,
  zip: null,
  parcel_id: null,
  mls: null,
  agent_id: null,
  list_price: null,
  offer_price: null,
  status: 'loi_sent',
  submitted_at: null,
  next_action_at: null,
  assignee_id: null,
  notes: null,
  created_at: '2026-08-01T00:00:00Z',
  updated_at: '2026-08-01T00:00:00Z',
  deleted_at: null,
  ...over,
});

const contact = (over: Partial<Contact> & { id: string; name: string }): Contact => ({
  org_id: 'org-1',
  brokerage: null,
  phone: null,
  email: null,
  type: 'listing_agent',
  created_at: '2026-08-01T00:00:00Z',
  updated_at: '2026-08-01T00:00:00Z',
  deleted_at: null,
  ...over,
});

const deals: Deal[] = [
  deal({
    id: '1',
    address: '123 Main St',
    city: 'Fort Myers',
    zip: '33901',
    status: 'loi_sent',
    submitted_at: '2026-08-20',
    list_price: 300000,
    offer_price: 240000,
    agent_id: 'agent-1',
  }),
  deal({
    id: '2',
    address: '456 Oak Ave',
    city: 'Cape Coral',
    status: 'follow_up',
    submitted_at: '2026-08-25',
    list_price: 250000,
    offer_price: 225000,
    next_action_at: '2026-08-30',
  }),
  deal({
    id: '3',
    address: '789 Pine Rd',
    status: 'offer_accepted',
    submitted_at: '2026-08-10',
  }),
];

const contacts = [
  contact({ id: 'agent-1', name: 'Dana Reyes', brokerage: 'Gulf Coast Realty' }),
];

describe('applyFilters - status', () => {
  it('returns everything when no status is selected', () => {
    expect(applyFilters(deals, defaultFilters)).toHaveLength(3);
  });

  it('filters to the selected statuses', () => {
    const statuses = new Set<DealStatus>(['follow_up']);
    const result = applyFilters(deals, { ...defaultFilters, statuses });
    expect(result.map((d) => d.id)).toEqual(['2']);
  });

  it('treats multiple statuses as an OR', () => {
    const statuses = new Set<DealStatus>(['follow_up', 'offer_accepted']);
    const result = applyFilters(deals, { ...defaultFilters, statuses });
    expect(result.map((d) => d.id).sort()).toEqual(['2', '3']);
  });
});

describe('applyFilters - search', () => {
  it('matches on address', () => {
    const result = applyFilters(deals, { ...defaultFilters, search: 'oak' });
    expect(result.map((d) => d.id)).toEqual(['2']);
  });

  it('ignores case and punctuation', () => {
    const result = applyFilters(deals, { ...defaultFilters, search: '123 main st.' });
    expect(result.map((d) => d.id)).toEqual(['1']);
  });

  it('matches on the listing agent, per PRD 7.2', () => {
    const result = applyFilters(deals, { ...defaultFilters, search: 'dana' }, contacts);
    expect(result.map((d) => d.id)).toEqual(['1']);
  });

  it('matches on brokerage', () => {
    const result = applyFilters(deals, { ...defaultFilters, search: 'gulf coast' }, contacts);
    expect(result.map((d) => d.id)).toEqual(['1']);
  });

  it('requires every term, allowing terms to match different fields', () => {
    const result = applyFilters(deals, { ...defaultFilters, search: 'main 33901' }, contacts);
    expect(result.map((d) => d.id)).toEqual(['1']);
  });

  it('returns nothing when a term matches nothing', () => {
    const result = applyFilters(deals, { ...defaultFilters, search: 'main nonsense' });
    expect(result).toEqual([]);
  });

  it('ignores a whitespace-only search', () => {
    expect(applyFilters(deals, { ...defaultFilters, search: '   ' })).toHaveLength(3);
  });
});

describe('applyFilters - follow-up', () => {
  it('surfaces deals due on or before today, and those with no next action', () => {
    const result = applyFilters(
      deals,
      { ...defaultFilters, needsFollowUp: true },
      contacts,
      '2026-08-31',
    );
    // Deal 2 is due 8/30; deals 1 and 3 have no next action at all, which is
    // exactly the pipeline-hygiene gap this filter exists to show.
    expect(result.map((d) => d.id).sort()).toEqual(['1', '2', '3']);
  });

  it('excludes a deal whose next action is still in the future', () => {
    const result = applyFilters(
      [deal({ id: '9', address: '9 Future Ln', next_action_at: '2026-12-01' })],
      { ...defaultFilters, needsFollowUp: true },
      contacts,
      '2026-08-31',
    );
    expect(result).toEqual([]);
  });
});

describe('sortDeals', () => {
  it('sorts newest first by default', () => {
    expect(sortDeals(deals, 'newest').map((d) => d.id)).toEqual(['2', '1', '3']);
  });

  it('sorts oldest first', () => {
    expect(sortDeals(deals, 'oldest').map((d) => d.id)).toEqual(['3', '1', '2']);
  });

  it('sorts by address', () => {
    expect(sortDeals(deals, 'address').map((d) => d.id)).toEqual(['1', '2', '3']);
  });

  it('sorts by offer-to-list, putting unpriced deals last', () => {
    // Deal 1 is 80%, deal 2 is 90%, deal 3 has no ratio.
    expect(sortDeals(deals, 'offer_to_list').map((d) => d.id)).toEqual(['1', '2', '3']);
  });

  it('does not mutate the array it was given', () => {
    const original = [...deals];
    sortDeals(deals, 'address');
    expect(deals).toEqual(original);
  });

  it('falls back to created_at when a deal was never submitted', () => {
    const unsubmitted = deal({
      id: '4',
      address: '4 New St',
      created_at: '2026-09-01T00:00:00Z',
    });
    expect(sortDeals([...deals, unsubmitted], 'newest')[0].id).toBe('4');
  });
});

describe('countByStatus', () => {
  it('counts every status, including the empty ones', () => {
    const counts = countByStatus(deals);
    expect(counts.loi_sent).toBe(1);
    expect(counts.follow_up).toBe(1);
    expect(counts.offer_accepted).toBe(1);
    expect(counts.pass).toBe(0);
  });
});
