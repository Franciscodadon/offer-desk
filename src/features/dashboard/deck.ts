/**
 * Command-deck data - the four panels the dashboard leads with on a wide
 * screen, derived from the deals already in the cache.
 *
 * Same conventions as `kpis.ts`, and for the same reasons: pure functions,
 * `today` passed in rather than read from the clock, and a metric with nothing
 * to measure is null rather than zero.
 *
 * One thing worth stating plainly, because the funnel makes it look like more
 * than it is: this is a snapshot of where deals sit *now*, not a history of
 * how they moved. A deal that was rejected is counted as having been answered,
 * because it was; a deal that is live is counted as sent, because it was. What
 * the funnel cannot show is a deal that passed through follow-up on its way to
 * accepted - deals carry one status, not a trail. Stage-to-stage timing needs
 * the activity log (PRD 9), and that is a later phase.
 */
import {
  ACTIVE_STATUSES,
  DEAL_STATUSES,
  DEAL_STATUS_LABELS,
  DECIDED_STATUSES,
  type DealStatus,
} from '@/domain/status';
import type { Deal } from '@/domain/types';
import { parseDate, toDateOnly } from '@/lib/format';

/**
 * A live deal with no reply for this long is stalled: it is on the board but
 * nothing is happening to it. Two weeks is the point at which a seller who was
 * going to answer an LOI has generally answered it.
 */
export const STALL_DAYS = 14;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Whole days between two dates, floor'd, never negative. */
function daysBetween(from: Date, to: Date): number {
  const start = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const end = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.max(0, Math.round((end - start) / MS_PER_DAY));
}

/** Signed days from `today` to a date: negative once the date has passed. */
function daysUntil(target: Date, today: Date): number {
  const start = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const end = Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate());
  return Math.round((end - start) / MS_PER_DAY);
}

function notDeleted(deals: Deal[]): Deal[] {
  return deals.filter((deal) => deal.deleted_at == null);
}

/**
 * How long a deal has been waiting on someone else, in days. Measured from the
 * submission date, falling back to creation for a deal logged but never sent.
 * Null when neither date parses.
 */
export function silentDays(deal: Deal, today: Date): number | null {
  const stamp = deal.submitted_at ?? deal.created_at;
  const date = stamp == null ? null : parseDate(stamp);
  return date == null ? null : daysBetween(date, today);
}

/* -------------------------------------------------------------------------
 * The funnel
 * ---------------------------------------------------------------------- */

export type FunnelStage = {
  key: 'logged' | 'sent' | 'answered' | 'accepted';
  label: string;
  count: number;
  /** Sum of offer prices at this stage. Null once no deal here carries one. */
  amount: number | null;
  /** This stage's count over the first stage's, for the bar width. */
  share: number;
  /**
   * Share of the stage above. Null on the first stage, which has nothing to
   * convert from, and when the stage above is empty.
   */
  conversion: number | null;
};

export type FunnelDrop = {
  /** How many deals are accounted for between the stage above and below. */
  count: number;
  /** What happened to them, in the operator's words. */
  label: string;
};

export type Funnel = {
  stages: FunnelStage[];
  /** One entry between each pair of stages: `drops[0]` sits under `stages[0]`. */
  drops: FunnelDrop[];
  /** Accepted over sent - the number the whole screen exists to move. */
  offerToClose: number | null;
};

function sumOffers(deals: Deal[]): number | null {
  const priced = deals.filter((deal) => deal.offer_price != null);
  if (priced.length === 0) return null;
  return priced.reduce((total, deal) => total + (deal.offer_price as number), 0);
}

export function pipelineFunnel(deals: Deal[]): Funnel {
  const live = notDeleted(deals);

  const passed = live.filter((deal) => deal.status === 'pass');
  const sent = live.filter((deal) => deal.status !== 'pass');
  const answered = sent.filter((deal) => DECIDED_STATUSES.includes(deal.status));
  const accepted = answered.filter((deal) => deal.status === 'offer_accepted');
  const waiting = sent.filter((deal) => ACTIVE_STATUSES.includes(deal.status));
  const loiSent = waiting.filter((deal) => deal.status === 'loi_sent').length;
  const followUp = waiting.filter((deal) => deal.status === 'follow_up').length;
  const sellerNo = answered.filter((deal) => deal.status === 'offer_rejected').length;
  const buyerNo = answered.filter((deal) => deal.status === 'buyer_rejected').length;

  const logged = live.length;
  const share = (count: number) => (logged === 0 ? 0 : count / logged);
  const ratio = (part: number, whole: number) => (whole === 0 ? null : part / whole);

  const stages: FunnelStage[] = [
    {
      key: 'logged',
      label: 'Logged',
      count: logged,
      amount: sumOffers(live),
      share: logged === 0 ? 0 : 1,
      conversion: null,
    },
    {
      key: 'sent',
      label: 'Offer sent',
      count: sent.length,
      amount: sumOffers(sent),
      share: share(sent.length),
      conversion: ratio(sent.length, logged),
    },
    {
      key: 'answered',
      label: 'Answered',
      count: answered.length,
      amount: sumOffers(answered),
      share: share(answered.length),
      conversion: ratio(answered.length, sent.length),
    },
    {
      key: 'accepted',
      label: 'Accepted',
      count: accepted.length,
      amount: sumOffers(accepted),
      share: share(accepted.length),
      conversion: ratio(accepted.length, answered.length),
    },
  ];

  const drops: FunnelDrop[] = [
    {
      count: passed.length,
      label: 'passed before an offer went out',
    },
    {
      count: waiting.length,
      label:
        waiting.length === 0
          ? 'nothing waiting on a reply'
          : `waiting on a reply — ${loiSent} LOI sent, ${followUp} in follow up`,
    },
    {
      count: sellerNo + buyerNo,
      label:
        sellerNo + buyerNo === 0
          ? 'no rejections yet'
          : `${sellerNo} seller no · ${buyerNo} buyer passed`,
    },
  ];

  return { stages, drops, offerToClose: ratio(accepted.length, sent.length) };
}

/* -------------------------------------------------------------------------
 * Stage detail
 * ---------------------------------------------------------------------- */

export type StageRow = {
  status: DealStatus;
  label: string;
  count: number;
  /** Sum of offer prices in this stage. Null when no deal here is priced. */
  amount: number | null;
  /** Count over all deals, for the inline bar. */
  share: number;
  /**
   * Age of the longest-waiting deal in the stage, in days. Only meaningful for
   * a stage a deal is still sitting in, so it is null on decided stages: how
   * long a rejection has been rejected is not a number anyone acts on.
   */
  oldestDays: number | null;
};

export function stageDetail(deals: Deal[], today: Date = new Date()): StageRow[] {
  const live = notDeleted(deals);
  const total = live.length;

  return DEAL_STATUSES.map((status) => {
    const inStage = live.filter((deal) => deal.status === status);
    const ages = ACTIVE_STATUSES.includes(status)
      ? inStage
          .map((deal) => silentDays(deal, today))
          .filter((days): days is number => days != null)
      : [];

    return {
      status,
      label: DEAL_STATUS_LABELS[status],
      count: inStage.length,
      amount: sumOffers(inStage),
      share: total === 0 ? 0 : inStage.length / total,
      oldestDays: ages.length === 0 ? null : Math.max(...ages),
    };
  });
}

/* -------------------------------------------------------------------------
 * The work queue
 * ---------------------------------------------------------------------- */

/**
 * Why a deal is on the list. Ordered by how much it needs you: an action you
 * already promised and missed outranks one you never set.
 */
export type QueueReason = 'overdue' | 'stalled' | 'no_next_action';

export type QueueItem = {
  deal: Deal;
  reason: QueueReason;
  /** Days since the offer went out. Null when the deal has no usable date. */
  silentDays: number | null;
  /** Days past the next action, positive once it is late. Null when unset. */
  overdueDays: number | null;
};

const REASON_RANK: Record<QueueReason, number> = {
  overdue: 0,
  stalled: 1,
  no_next_action: 2,
};

/** One line saying what to do about it, shown under the address. */
export function queueReasonLabel(item: QueueItem): string {
  switch (item.reason) {
    case 'overdue':
      return item.overdueDays === 0
        ? 'Next action due today'
        : `Next action ${item.overdueDays}d overdue`;
    case 'stalled':
      return item.silentDays == null
        ? 'No reply yet'
        : `No reply in ${item.silentDays}d`;
    case 'no_next_action':
      return 'No next action set';
  }
}

/**
 * Live deals that need a human today, worst first.
 *
 * A deal qualifies three ways, and only the first that applies is reported, so
 * one deal never occupies two rows: its next action has come due, it has gone
 * quiet past `STALL_DAYS`, or it has no next action at all. A deal that is
 * merely young and scheduled is doing fine and stays off the list.
 */
export function workQueue(
  deals: Deal[],
  today: Date = new Date(),
  limit = 5,
): QueueItem[] {
  const active = notDeleted(deals).filter((deal) => ACTIVE_STATUSES.includes(deal.status));

  const items: QueueItem[] = [];

  for (const deal of active) {
    const silent = silentDays(deal, today);
    const nextAction = deal.next_action_at == null ? null : parseDate(deal.next_action_at);
    const until = nextAction == null ? null : daysUntil(nextAction, today);

    // Branches run in REASON_RANK order, so the reason reported for a deal
    // that qualifies twice is the more urgent of the two.
    let reason: QueueReason;
    if (until != null && until <= 0) {
      reason = 'overdue';
    } else if (silent != null && silent >= STALL_DAYS) {
      reason = 'stalled';
    } else if (deal.next_action_at == null) {
      reason = 'no_next_action';
    } else {
      continue;
    }

    items.push({
      deal,
      reason,
      silentDays: silent,
      overdueDays: until == null ? null : Math.max(0, -until),
    });
  }

  items.sort((a, b) => {
    const byReason = REASON_RANK[a.reason] - REASON_RANK[b.reason];
    if (byReason !== 0) return byReason;
    // Within a reason, the one that has been waiting longest goes first.
    const bySilence = (b.silentDays ?? -1) - (a.silentDays ?? -1);
    if (bySilence !== 0) return bySilence;
    // A stable tiebreak, so the list does not reshuffle between renders.
    return a.deal.id.localeCompare(b.deal.id);
  });

  return items.slice(0, limit);
}

/** Live deals that have gone quiet past `STALL_DAYS`. The KPI strip's alarm. */
export function stalledCount(deals: Deal[], today: Date = new Date()): number {
  return notDeleted(deals).filter((deal) => {
    if (!ACTIVE_STATUSES.includes(deal.status)) return false;
    const silent = silentDays(deal, today);
    return silent != null && silent >= STALL_DAYS;
  }).length;
}

/**
 * Acceptance rate week by week, over the same window as the offer chart, so
 * the KPI strip's sparkline is a real trend and not a decoration.
 *
 * A week is dated by when its offers were *sent*, and each point is the
 * acceptance rate among those offers as they stand today. Weeks with nothing
 * decided are null: an empty week is not a 0% week, and drawing it as one
 * would put a cliff in the line that never happened.
 */
export function weeklyAcceptance(
  deals: Deal[],
  weekStarts: string[],
): (number | null)[] {
  const live = notDeleted(deals);

  return weekStarts.map((weekStart) => {
    const inWeek = live.filter((deal) => {
      if (deal.submitted_at == null) return false;
      const date = parseDate(deal.submitted_at);
      if (date == null) return false;
      const start = new Date(
        Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
      );
      start.setUTCDate(start.getUTCDate() - start.getUTCDay());
      return toDateOnly(start) === weekStart;
    });

    const decided = inWeek.filter((deal) => DECIDED_STATUSES.includes(deal.status));
    if (decided.length === 0) return null;
    return decided.filter((deal) => deal.status === 'offer_accepted').length / decided.length;
  });
}
