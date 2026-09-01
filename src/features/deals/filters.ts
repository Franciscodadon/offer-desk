/**
 * Pipeline filtering, search, and sorting - PRD 7.2.
 *
 *   "List + filter by status, search by address/agent, sort by date; each row
 *    shows offer-to-list %."
 *
 * Pure functions over already-fetched rows. Filtering happens on the client
 * because the whole pipeline is already in the offline cache: a search that
 * needs a network round trip would stop working in the exact situation the
 * app is built for.
 */
import type { DealStatus } from '@/domain/status';
import type { Contact, Deal } from '@/domain/types';

export type DealSort = 'newest' | 'oldest' | 'address' | 'offer_to_list';

export type DealFilters = {
  /** Empty set means no status filter, not "match nothing". */
  statuses: Set<DealStatus>;
  search: string;
  sort: DealSort;
  /** Restricts to deals with a next action due on or before today. */
  needsFollowUp: boolean;
};

export const defaultFilters: DealFilters = {
  statuses: new Set(),
  search: '',
  sort: 'newest',
  needsFollowUp: false,
};

/** Case- and punctuation-insensitive, so "123 main st" finds "123 Main St.". */
function normalize(value: string): string {
  return value.toLowerCase().replace(/[.,#]/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Matches every whitespace-separated term independently, so "main 33901"
 * finds a deal on Main Street in that zip. Terms may match different fields.
 */
function matchesSearch(haystack: string, search: string): boolean {
  const terms = normalize(search).split(' ').filter(Boolean);
  if (terms.length === 0) return true;
  const target = normalize(haystack);
  return terms.every((term) => target.includes(term));
}

/** The text a deal is searchable by: its address, plus its agent (PRD 7.2). */
function searchableText(deal: Deal, agent: Contact | undefined): string {
  return [
    deal.address,
    deal.city,
    deal.state,
    deal.zip,
    deal.mls,
    deal.parcel_id,
    agent?.name,
    agent?.brokerage,
    agent?.email,
  ]
    .filter(Boolean)
    .join(' ');
}

function offerToListRatio(deal: Deal): number | null {
  if (deal.offer_price == null || deal.list_price == null || deal.list_price === 0) {
    return null;
  }
  return deal.offer_price / deal.list_price;
}

/** Sort key for date ordering: submitted date if set, otherwise created. */
function dateKey(deal: Deal): number {
  const value = deal.submitted_at ?? deal.created_at;
  const parsed = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function applyFilters(
  deals: Deal[],
  filters: DealFilters,
  contacts: Contact[] = [],
  today: string = new Date().toISOString().slice(0, 10),
): Deal[] {
  const contactsById = new Map(contacts.map((contact) => [contact.id, contact]));

  const filtered = deals.filter((deal) => {
    if (filters.statuses.size > 0 && !filters.statuses.has(deal.status)) return false;

    if (filters.needsFollowUp) {
      // A deal with no next action is exactly what this filter is meant to
      // surface, so it counts as needing follow-up rather than being excluded.
      if (deal.next_action_at != null && deal.next_action_at > today) return false;
    }

    if (filters.search.trim().length > 0) {
      const agent = deal.agent_id ? contactsById.get(deal.agent_id) : undefined;
      if (!matchesSearch(searchableText(deal, agent), filters.search)) return false;
    }

    return true;
  });

  return sortDeals(filtered, filters.sort);
}

export function sortDeals(deals: Deal[], sort: DealSort): Deal[] {
  // Copy first: callers pass cached arrays that React Query owns.
  const sorted = [...deals];

  switch (sort) {
    case 'newest':
      return sorted.sort((a, b) => dateKey(b) - dateKey(a));
    case 'oldest':
      return sorted.sort((a, b) => dateKey(a) - dateKey(b));
    case 'address':
      return sorted.sort((a, b) => a.address.localeCompare(b.address));
    case 'offer_to_list':
      return sorted.sort((a, b) => {
        const left = offerToListRatio(a);
        const right = offerToListRatio(b);
        // Deals with no ratio sort last rather than reading as 0%.
        if (left == null && right == null) return 0;
        if (left == null) return 1;
        if (right == null) return -1;
        return left - right;
      });
  }
}

/** Counts per status, for the filter chips and the dashboard breakdown. */
export function countByStatus(deals: Deal[]): Record<DealStatus, number> {
  const counts = {
    loi_sent: 0,
    follow_up: 0,
    offer_accepted: 0,
    offer_rejected: 0,
    buyer_rejected: 0,
    pass: 0,
  } satisfies Record<DealStatus, number>;

  for (const deal of deals) counts[deal.status] += 1;
  return counts;
}
