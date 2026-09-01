/**
 * Dashboard KPIs - PRD 7.9.
 *
 *   "Cards: offers this week, total, acceptance rate, avg offer-to-list,
 *    pipeline $; 8-week submission bar chart; status breakdown."
 *
 * Pure functions over already-fetched deals, with `today` passed in rather than
 * read from the clock, so every figure is testable at a fixed date.
 *
 * Two conventions worth stating once:
 *   - Weeks run Sunday to Saturday, which is what a US team means by "this
 *     week". The week a deal belongs to is its submitted date, not the date it
 *     was created, because the KPI counts offers sent.
 *   - A metric with nothing to measure is null, never zero. An acceptance rate
 *     of 0% and "no decided offers yet" are different facts, and showing the
 *     first for the second would misreport the team's performance.
 */
import { ACTIVE_STATUSES, DECIDED_STATUSES, DEAL_STATUSES, type DealStatus } from '@/domain/status';
import type { Deal } from '@/domain/types';
import { parseDate, toDateOnly } from '@/lib/format';

export type WeekBucket = {
  /** Sunday that starts the week, as YYYY-MM-DD. */
  weekStart: string;
  /** Offers submitted in that week. */
  count: number;
  /** True for the week containing `today`, which is still filling up. */
  isCurrent: boolean;
};

export type DashboardKpis = {
  offersThisWeek: number;
  totalOffers: number;
  /** Accepted over decided. Null when nothing has been decided yet. */
  acceptanceRate: number | null;
  /** Mean of offer/list across deals that have both. Null when none do. */
  averageOfferToList: number | null;
  /** Sum of offer prices on deals still live in the pipeline. */
  pipelineValue: number;
  /** Oldest to newest, always exactly `weeks` long, including empty weeks. */
  weekly: WeekBucket[];
  statusBreakdown: { status: DealStatus; count: number }[];
  /** Deals with a next action set, over active deals. PRD's pipeline hygiene. */
  pipelineHygiene: number | null;
};

/** Sunday that starts the week containing `date`. */
export function startOfWeek(date: Date): Date {
  const start = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  start.setUTCDate(start.getUTCDate() - start.getUTCDay());
  return start;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

/** Deals that count as an offer sent: those with a submission date. */
function submitted(deals: Deal[]): Deal[] {
  return deals.filter((deal) => deal.submitted_at != null);
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * Buckets submitted offers into the last `weeks` weeks, oldest first.
 * Empty weeks are present with a count of zero: a gap in the chart is a real
 * signal, and dropping the week would silently close it up.
 */
export function weeklyBuckets(
  deals: Deal[],
  today: Date = new Date(),
  weeks = 8,
): WeekBucket[] {
  const currentWeekStart = startOfWeek(today);
  const buckets: WeekBucket[] = [];

  for (let offset = weeks - 1; offset >= 0; offset -= 1) {
    const weekStart = addDays(currentWeekStart, -7 * offset);
    buckets.push({
      weekStart: toDateOnly(weekStart),
      count: 0,
      isCurrent: offset === 0,
    });
  }

  const earliest = buckets[0].weekStart;

  for (const deal of submitted(deals)) {
    const date = parseDate(deal.submitted_at as string);
    if (!date) continue;

    const bucketStart = toDateOnly(startOfWeek(date));
    // Ignore anything older than the window or dated in the future.
    if (bucketStart < earliest) continue;

    const bucket = buckets.find((candidate) => candidate.weekStart === bucketStart);
    if (bucket) bucket.count += 1;
  }

  return buckets;
}

export function computeKpis(
  deals: Deal[],
  today: Date = new Date(),
  weeks = 8,
): DashboardKpis {
  const live = deals.filter((deal) => deal.deleted_at == null);
  const withOffers = submitted(live);

  const weekly = weeklyBuckets(live, today, weeks);
  const thisWeek = weekly[weekly.length - 1]?.count ?? 0;

  const decided = live.filter((deal) => DECIDED_STATUSES.includes(deal.status));
  const accepted = decided.filter((deal) => deal.status === 'offer_accepted');

  const ratios = live
    .filter(
      (deal) =>
        deal.offer_price != null && deal.list_price != null && deal.list_price !== 0,
    )
    .map((deal) => (deal.offer_price as number) / (deal.list_price as number));

  const active = live.filter((deal) => ACTIVE_STATUSES.includes(deal.status));
  const pipelineValue = active.reduce((sum, deal) => sum + (deal.offer_price ?? 0), 0);

  const withNextAction = active.filter((deal) => deal.next_action_at != null);

  return {
    offersThisWeek: thisWeek,
    totalOffers: withOffers.length,
    acceptanceRate: decided.length === 0 ? null : accepted.length / decided.length,
    averageOfferToList: mean(ratios),
    pipelineValue,
    weekly,
    statusBreakdown: DEAL_STATUSES.map((status) => ({
      status,
      count: live.filter((deal) => deal.status === status).length,
    })),
    pipelineHygiene:
      active.length === 0 ? null : withNextAction.length / active.length,
  };
}

/** Short label for a week's x-axis tick, e.g. "Aug 24". */
export function weekLabel(weekStart: string): string {
  const date = parseDate(weekStart);
  if (!date) return '';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}
