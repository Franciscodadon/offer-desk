import type { Deal } from '@/domain/types';

import { computeKpis, startOfWeek, weeklyBuckets, weekLabel } from '../kpis';

const deal = (over: Partial<Deal> & { id: string }): Deal => ({
  org_id: 'org-1',
  address: `${over.id} Test St`,
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

// A Tuesday. The week containing it runs Sun 2026-08-30 to Sat 2026-09-05.
const TODAY = new Date('2026-09-01T12:00:00Z');

describe('startOfWeek', () => {
  it('returns the Sunday that starts the week', () => {
    expect(startOfWeek(new Date('2026-09-01T12:00:00Z')).toISOString().slice(0, 10)).toBe(
      '2026-08-30',
    );
  });

  it('treats Sunday as the start of its own week', () => {
    expect(startOfWeek(new Date('2026-08-30T00:00:00Z')).toISOString().slice(0, 10)).toBe(
      '2026-08-30',
    );
  });

  it('keeps Saturday in the week that began the previous Sunday', () => {
    expect(startOfWeek(new Date('2026-09-05T23:00:00Z')).toISOString().slice(0, 10)).toBe(
      '2026-08-30',
    );
  });
});

describe('weeklyBuckets', () => {
  it('always returns exactly eight weeks, oldest first', () => {
    const buckets = weeklyBuckets([], TODAY);
    expect(buckets).toHaveLength(8);
    expect(buckets[0].weekStart).toBe('2026-07-12');
    expect(buckets[7].weekStart).toBe('2026-08-30');
    expect(buckets[7].isCurrent).toBe(true);
    expect(buckets[0].isCurrent).toBe(false);
  });

  it('keeps empty weeks rather than closing the gap', () => {
    // A quiet week is a real signal; dropping it would hide a stall.
    const buckets = weeklyBuckets([deal({ id: '1', submitted_at: '2026-08-31' })], TODAY);
    expect(buckets).toHaveLength(8);
    expect(buckets.filter((bucket) => bucket.count === 0)).toHaveLength(7);
  });

  it('counts an offer into the week of its submitted date', () => {
    const buckets = weeklyBuckets(
      [
        deal({ id: '1', submitted_at: '2026-08-31' }),
        deal({ id: '2', submitted_at: '2026-09-01' }),
        deal({ id: '3', submitted_at: '2026-08-25' }),
      ],
      TODAY,
    );
    expect(buckets[7].count).toBe(2);
    expect(buckets[6].count).toBe(1);
  });

  it('ignores deals with no submitted date', () => {
    const buckets = weeklyBuckets([deal({ id: '1' })], TODAY);
    expect(buckets.every((bucket) => bucket.count === 0)).toBe(true);
  });

  it('ignores offers older than the window instead of piling them into week one', () => {
    const buckets = weeklyBuckets([deal({ id: '1', submitted_at: '2026-01-05' })], TODAY);
    expect(buckets[0].count).toBe(0);
  });
});

describe('computeKpis', () => {
  const deals = [
    deal({
      id: '1',
      submitted_at: '2026-09-01',
      status: 'loi_sent',
      list_price: 300000,
      offer_price: 240000,
      next_action_at: '2026-09-08',
    }),
    deal({
      id: '2',
      submitted_at: '2026-08-31',
      status: 'follow_up',
      list_price: 200000,
      offer_price: 180000,
    }),
    deal({ id: '3', submitted_at: '2026-08-20', status: 'offer_accepted' }),
    deal({ id: '4', submitted_at: '2026-08-18', status: 'offer_rejected' }),
    deal({ id: '5', submitted_at: '2026-08-17', status: 'buyer_rejected' }),
    deal({ id: '6', status: 'pass' }),
  ];

  it('counts offers sent this week', () => {
    expect(computeKpis(deals, TODAY).offersThisWeek).toBe(2);
  });

  it('counts total offers as those actually submitted', () => {
    // Deal 6 was never sent, so it is not an offer.
    expect(computeKpis(deals, TODAY).totalOffers).toBe(5);
  });

  it('computes acceptance over decided offers only', () => {
    // 1 accepted of 3 decided; the two live deals are not counted against it.
    expect(computeKpis(deals, TODAY).acceptanceRate).toBeCloseTo(1 / 3, 6);
  });

  it('averages offer-to-list across deals that have both prices', () => {
    // 80% and 90%.
    expect(computeKpis(deals, TODAY).averageOfferToList).toBeCloseTo(0.85, 6);
  });

  it('sums pipeline value from live deals only', () => {
    expect(computeKpis(deals, TODAY).pipelineValue).toBe(420000);
  });

  it('reports pipeline hygiene as the share of active deals with a next action', () => {
    expect(computeKpis(deals, TODAY).pipelineHygiene).toBeCloseTo(0.5, 6);
  });

  it('breaks down every status, including the empty ones', () => {
    const breakdown = computeKpis(deals, TODAY).statusBreakdown;
    expect(breakdown).toHaveLength(6);
    expect(breakdown.find((row) => row.status === 'offer_accepted')?.count).toBe(1);
    expect(breakdown.find((row) => row.status === 'pass')?.count).toBe(1);
  });

  it('excludes soft-deleted deals from every figure', () => {
    const withDeleted = [
      ...deals,
      deal({
        id: '7',
        submitted_at: '2026-09-01',
        status: 'offer_accepted',
        deleted_at: '2026-09-01T00:00:00Z',
      }),
    ];
    const kpis = computeKpis(withDeleted, TODAY);
    expect(kpis.offersThisWeek).toBe(2);
    expect(kpis.acceptanceRate).toBeCloseTo(1 / 3, 6);
  });

  it('reports null rather than zero when there is nothing to measure', () => {
    // "0% acceptance" and "nothing decided yet" are different facts, and
    // reporting the first for the second misstates the team's performance.
    const kpis = computeKpis([deal({ id: '1', status: 'loi_sent' })], TODAY);
    expect(kpis.acceptanceRate).toBeNull();
    expect(kpis.averageOfferToList).toBeNull();
    expect(kpis.offersThisWeek).toBe(0);
    expect(kpis.pipelineValue).toBe(0);
  });

  it('handles an empty pipeline without dividing by zero', () => {
    const kpis = computeKpis([], TODAY);
    expect(kpis.acceptanceRate).toBeNull();
    expect(kpis.pipelineHygiene).toBeNull();
    expect(kpis.weekly).toHaveLength(8);
  });
});

describe('weekLabel', () => {
  it('renders a short tick label without shifting the date', () => {
    expect(weekLabel('2026-08-30')).toBe('Aug 30');
  });
});
