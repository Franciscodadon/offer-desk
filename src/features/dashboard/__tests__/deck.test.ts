import type { Deal } from '@/domain/types';
import type { DealStatus } from '@/domain/status';

import {
  pipelineFunnel,
  queueReasonLabel,
  silentDays,
  stageDetail,
  stalledCount,
  weeklyAcceptance,
  workQueue,
  STALL_DAYS,
} from '../deck';

const TODAY = new Date('2026-03-15T12:00:00Z');

let sequence = 0;

function deal(overrides: Partial<Deal> & { status: DealStatus }): Deal {
  sequence += 1;
  return {
    id: `deal-${String(sequence).padStart(3, '0')}`,
    org_id: 'org-1',
    address: `${sequence} Test St`,
    city: null,
    state: null,
    zip: null,
    parcel_id: null,
    mls: null,
    agent_id: null,
    list_price: null,
    offer_price: null,
    submitted_at: null,
    next_action_at: null,
    assignee_id: null,
    notes: null,
    created_at: '2026-03-01T00:00:00Z',
    updated_at: '2026-03-01T00:00:00Z',
    deleted_at: null,
    ...overrides,
  } as Deal;
}

beforeEach(() => {
  sequence = 0;
});

describe('silentDays', () => {
  it('measures from the submission date', () => {
    expect(silentDays(deal({ status: 'loi_sent', submitted_at: '2026-03-05' }), TODAY)).toBe(10);
  });

  it('falls back to creation for a deal logged but never sent', () => {
    const logged = deal({ status: 'pass', submitted_at: null, created_at: '2026-03-10' });
    expect(silentDays(logged, TODAY)).toBe(5);
  });

  it('never reports negative days for a future date', () => {
    expect(silentDays(deal({ status: 'loi_sent', submitted_at: '2026-04-01' }), TODAY)).toBe(0);
  });
});

describe('pipelineFunnel', () => {
  const deals = [
    deal({ status: 'loi_sent', offer_price: 100_000 }),
    deal({ status: 'loi_sent', offer_price: 120_000 }),
    deal({ status: 'follow_up', offer_price: 90_000 }),
    deal({ status: 'offer_accepted', offer_price: 150_000 }),
    deal({ status: 'offer_rejected', offer_price: 80_000 }),
    deal({ status: 'buyer_rejected', offer_price: 70_000 }),
    deal({ status: 'pass' }),
    deal({ status: 'pass' }),
  ];

  it('counts each stage from the statuses that belong to it', () => {
    const { stages } = pipelineFunnel(deals);
    expect(stages.map((stage) => [stage.key, stage.count])).toEqual([
      ['logged', 8],
      ['sent', 6],
      ['answered', 3],
      ['accepted', 1],
    ]);
  });

  it('sums offer prices per stage', () => {
    const { stages } = pipelineFunnel(deals);
    expect(stages[1].amount).toBe(610_000);
    expect(stages[2].amount).toBe(300_000);
    expect(stages[3].amount).toBe(150_000);
  });

  it('converts each stage against the one above it, not against the total', () => {
    const { stages } = pipelineFunnel(deals);
    expect(stages[0].conversion).toBeNull();
    expect(stages[1].conversion).toBeCloseTo(6 / 8);
    expect(stages[2].conversion).toBeCloseTo(3 / 6);
    expect(stages[3].conversion).toBeCloseTo(1 / 3);
  });

  it('reports offer to close against offers sent, not against everything logged', () => {
    expect(pipelineFunnel(deals).offerToClose).toBeCloseTo(1 / 6);
  });

  it('accounts for every deal between the stages', () => {
    const { drops } = pipelineFunnel(deals);
    expect(drops.map((drop) => drop.count)).toEqual([2, 3, 2]);
    expect(drops[1].label).toContain('2 LOI sent, 1 in follow up');
    expect(drops[2].label).toContain('1 seller no · 1 buyer passed');
  });

  it('ignores deleted deals', () => {
    const withDeleted = [...deals, deal({ status: 'offer_accepted', deleted_at: '2026-03-02' })];
    expect(pipelineFunnel(withDeleted).stages[3].count).toBe(1);
  });

  it('is all zeroes and nulls on an empty pipeline rather than dividing by zero', () => {
    const { stages, offerToClose } = pipelineFunnel([]);
    expect(stages.every((stage) => stage.count === 0 && stage.share === 0)).toBe(true);
    expect(stages.every((stage) => stage.amount === null)).toBe(true);
    expect(offerToClose).toBeNull();
  });

  it('leaves the amount null rather than showing $0 when no deal is priced', () => {
    expect(pipelineFunnel([deal({ status: 'loi_sent' })]).stages[1].amount).toBeNull();
  });
});

describe('stageDetail', () => {
  it('gives every status a row, including the empty ones', () => {
    const rows = stageDetail([deal({ status: 'loi_sent' })], TODAY);
    expect(rows).toHaveLength(6);
    expect(rows.filter((row) => row.count === 0)).toHaveLength(5);
  });

  it('shares are of all deals, so they sum to one', () => {
    const rows = stageDetail(
      [deal({ status: 'loi_sent' }), deal({ status: 'pass' }), deal({ status: 'pass' })],
      TODAY,
    );
    expect(rows.reduce((total, row) => total + row.share, 0)).toBeCloseTo(1);
  });

  it('ages only the stages a deal is still sitting in', () => {
    const rows = stageDetail(
      [
        deal({ status: 'loi_sent', submitted_at: '2026-03-01' }),
        deal({ status: 'loi_sent', submitted_at: '2026-03-11' }),
        deal({ status: 'offer_rejected', submitted_at: '2026-01-01' }),
      ],
      TODAY,
    );
    const byStatus = Object.fromEntries(rows.map((row) => [row.status, row]));
    expect(byStatus.loi_sent.oldestDays).toBe(14);
    expect(byStatus.offer_rejected.oldestDays).toBeNull();
  });
});

describe('workQueue', () => {
  it('leaves out a young deal with a next action still ahead of it', () => {
    const healthy = deal({
      status: 'loi_sent',
      submitted_at: '2026-03-13',
      next_action_at: '2026-03-20',
    });
    expect(workQueue([healthy], TODAY)).toEqual([]);
  });

  it('leaves out deals that are not live', () => {
    const decided = deal({ status: 'offer_rejected', submitted_at: '2026-01-01' });
    expect(workQueue([decided], TODAY)).toEqual([]);
  });

  it('picks an overdue next action up on the day it comes due', () => {
    const due = deal({ status: 'follow_up', submitted_at: '2026-03-14', next_action_at: '2026-03-15' });
    const [item] = workQueue([due], TODAY);
    expect(item.reason).toBe('overdue');
    expect(item.overdueDays).toBe(0);
    expect(queueReasonLabel(item)).toBe('Next action due today');
  });

  it('counts how late a missed action is', () => {
    const late = deal({ status: 'follow_up', submitted_at: '2026-03-01', next_action_at: '2026-03-11' });
    const [item] = workQueue([late], TODAY);
    expect(item.overdueDays).toBe(4);
    expect(queueReasonLabel(item)).toBe('Next action 4d overdue');
  });

  it('reports the more urgent reason when a deal qualifies twice', () => {
    const both = deal({ status: 'loi_sent', submitted_at: '2026-02-01', next_action_at: null });
    const [item] = workQueue([both], TODAY);
    expect(item.reason).toBe('stalled');
  });

  it('orders overdue before stalled before missing an action', () => {
    const missing = deal({ status: 'loi_sent', submitted_at: '2026-03-14' });
    const stalled = deal({
      status: 'loi_sent',
      submitted_at: '2026-02-20',
      next_action_at: '2026-03-25',
    });
    const overdue = deal({
      status: 'follow_up',
      submitted_at: '2026-03-12',
      next_action_at: '2026-03-13',
    });
    expect(workQueue([missing, stalled, overdue], TODAY).map((item) => item.reason)).toEqual([
      'overdue',
      'stalled',
      'no_next_action',
    ]);
  });

  it('puts the longest wait first within one reason', () => {
    const recent = deal({ status: 'loi_sent', submitted_at: '2026-03-14' });
    const older = deal({ status: 'loi_sent', submitted_at: '2026-03-09' });
    expect(workQueue([recent, older], TODAY).map((item) => item.silentDays)).toEqual([6, 1]);
  });

  it('caps the list at the limit, keeping the worst', () => {
    const deals = [1, 2, 3, 4, 5, 6].map((offset) =>
      deal({ status: 'loi_sent', submitted_at: `2026-03-0${offset}` }),
    );
    const queue = workQueue(deals, TODAY, 3);
    expect(queue).toHaveLength(3);
    expect(queue[0].silentDays).toBe(14);
  });
});

describe('stalledCount', () => {
  it('counts a live deal from the day it crosses the threshold, not before', () => {
    const justUnder = new Date(TODAY);
    const at = deal({ status: 'loi_sent', submitted_at: '2026-03-01' });
    const under = deal({ status: 'loi_sent', submitted_at: '2026-03-02' });
    expect(silentDays(at, justUnder)).toBe(STALL_DAYS);
    expect(stalledCount([at, under], TODAY)).toBe(1);
  });

  it('ignores decided deals however long ago they were sent', () => {
    expect(stalledCount([deal({ status: 'pass', submitted_at: '2025-01-01' })], TODAY)).toBe(0);
  });
});

describe('weeklyAcceptance', () => {
  const weeks = ['2026-03-01', '2026-03-08'];

  it('rates each week by the offers sent in it', () => {
    const deals = [
      deal({ status: 'offer_accepted', submitted_at: '2026-03-03' }),
      deal({ status: 'offer_rejected', submitted_at: '2026-03-04' }),
      deal({ status: 'offer_accepted', submitted_at: '2026-03-09' }),
    ];
    expect(weeklyAcceptance(deals, weeks)).toEqual([0.5, 1]);
  });

  it('is null, not zero, for a week with nothing decided', () => {
    const deals = [deal({ status: 'loi_sent', submitted_at: '2026-03-03' })];
    expect(weeklyAcceptance(deals, weeks)).toEqual([null, null]);
  });
});
