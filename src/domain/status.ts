/**
 * Deal statuses - PRD 7.2. Fixed set in v1; org-configurable later.
 * Order here is the pipeline order used by filters and the dashboard breakdown.
 */
import type { Theme } from '@/theme/themes';

export const DEAL_STATUSES = [
  'loi_sent',
  'follow_up',
  'offer_accepted',
  'offer_rejected',
  'buyer_rejected',
  'pass',
] as const;

export type DealStatus = (typeof DEAL_STATUSES)[number];

export const DEAL_STATUS_LABELS: Record<DealStatus, string> = {
  loi_sent: 'LOI Sent',
  follow_up: 'Follow Up',
  offer_accepted: 'Offer Accepted',
  offer_rejected: 'Offer Rejected',
  buyer_rejected: 'Buyer Rejected',
  pass: 'Pass',
};

/** Statuses that count as a decided offer for the acceptance-rate metric (PRD 4). */
export const DECIDED_STATUSES: readonly DealStatus[] = [
  'offer_accepted',
  'offer_rejected',
  'buyer_rejected',
];

/** Statuses still live in the pipeline. */
export const ACTIVE_STATUSES: readonly DealStatus[] = ['loi_sent', 'follow_up'];

export function isDealStatus(value: string): value is DealStatus {
  return (DEAL_STATUSES as readonly string[]).includes(value);
}

/** Color pill roles per status (PRD 7.2 "inline status change with color pills"). */
export function statusColors(status: DealStatus, theme: Theme): { bg: string; fg: string } {
  switch (status) {
    case 'loi_sent':
      return { bg: theme.color.infoMuted, fg: theme.color.info };
    case 'follow_up':
      return { bg: theme.color.warningMuted, fg: theme.color.warning };
    case 'offer_accepted':
      return { bg: theme.color.successMuted, fg: theme.color.success };
    case 'offer_rejected':
    case 'buyer_rejected':
      return { bg: theme.color.dangerMuted, fg: theme.color.danger };
    case 'pass':
      return { bg: theme.color.surfaceMuted, fg: theme.color.textMuted };
  }
}
