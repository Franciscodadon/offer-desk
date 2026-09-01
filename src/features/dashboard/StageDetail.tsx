/**
 * Stage detail - the per-status numbers the funnel rolls up.
 *
 * A table, deliberately. Six stages that all carry meaning is past the point
 * where more color helps; the reader wants the figures, and figures in aligned
 * columns are easier to compare than six more bars. The share column keeps one
 * inline bar so the row still scans, and the numbers are tabular so the
 * columns line up rather than merely being right-aligned.
 *
 * Color here is the one place the deck uses more than a single hue, because
 * the stages are states rather than series: won, lost to the seller, lost to
 * the buyer, never offered. Every row is labelled, so the color is a second
 * reading and never the only one.
 */
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import type { DealStatus } from '@/domain/status';
import { EMPTY_VALUE, formatMoney, formatNumber, formatPercent } from '@/lib/format';
import { radii, spacing } from '@/theme/tokens';
import type { Theme } from '@/theme/themes';
import { useTheme } from '@/theme/ThemeProvider';

import { STALL_DAYS, type StageRow } from './deck';

/**
 * The share bar's fill per stage. Validated against the light chart surface:
 * worst adjacent CVD delta-E 9.0, every step clears 3:1. The slate is a
 * de-emphasis step rather than a fourth hue - a deal nobody offered on is
 * context, not a category competing for attention.
 */
function shareColor(status: DealStatus, theme: Theme): string {
  switch (status) {
    case 'loi_sent':
    case 'follow_up':
    case 'offer_accepted':
      return theme.chart.bar;
    case 'offer_rejected':
      return theme.color.danger;
    case 'buyer_rejected':
      return theme.color.textSubtle;
    case 'pass':
      return theme.chart.barMuted;
  }
}

export function StageDetail({
  rows,
  showShare,
}: {
  rows: StageRow[];
  /**
   * The share column. Dropped on a narrow screen: it is the one column that
   * restates something - a count over a total already on the row - and it is
   * the widest, so it is what a phone gives up first.
   */
  showShare: boolean;
}) {
  const theme = useTheme();

  return (
    <View>
      <View style={[styles.row, styles.head, { borderBottomColor: theme.color.border }]}>
        <Text variant="caption" tone="subtle" style={styles.stage}>
          Stage
        </Text>
        <Text variant="caption" tone="subtle" style={styles.count}>
          Deals
        </Text>
        <Text variant="caption" tone="subtle" style={styles.amount}>
          Offered
        </Text>
        {showShare ? (
          <Text variant="caption" tone="subtle" style={styles.shareHead}>
            Share
          </Text>
        ) : null}
        <Text variant="caption" tone="subtle" style={styles.oldest}>
          Oldest
        </Text>
      </View>

      {rows.map((row) => {
        const stalled = row.oldestDays != null && row.oldestDays >= STALL_DAYS;

        return (
          <View
            key={row.status}
            style={[styles.row, { borderBottomColor: theme.color.border }]}
            accessibilityRole="text"
            accessibilityLabel={`${row.label}: ${formatNumber(row.count)} ${
              row.count === 1 ? 'deal' : 'deals'
            }, ${row.amount == null ? 'nothing priced' : `${formatMoney(row.amount)} offered`}, ${
              formatPercent(row.share, 1)
            } of the pipeline${
              row.oldestDays == null ? '' : `, oldest ${row.oldestDays} days`
            }`}
          >
            <Text variant="label" numberOfLines={1} style={styles.stage}>
              {row.label}
            </Text>
            <Text
              variant="mono"
              tone={row.count === 0 ? 'subtle' : 'default'}
              style={styles.count}
            >
              {row.count === 0 ? EMPTY_VALUE : formatNumber(row.count)}
            </Text>
            <Text
              variant="mono"
              tone={row.amount == null ? 'subtle' : 'muted'}
              style={styles.amount}
              numberOfLines={1}
            >
              {row.amount == null ? EMPTY_VALUE : formatMoney(row.amount)}
            </Text>

            {showShare ? (
              <View style={styles.shareCell}>
                <View style={[styles.track, { backgroundColor: theme.color.surfaceMuted }]}>
                  <View
                    style={{ flex: row.share, backgroundColor: shareColor(row.status, theme) }}
                  />
                  <View style={{ flex: 1 - row.share }} />
                </View>
                <Text variant="mono" tone="muted" style={styles.sharePct}>
                  {formatPercent(row.share, 1)}
                </Text>
              </View>
            ) : null}

            <Text
              variant="mono"
              tone={row.oldestDays == null ? 'subtle' : 'default'}
              style={[styles.oldest, stalled ? { color: theme.color.warning } : null]}
            >
              {row.oldestDays == null ? EMPTY_VALUE : `${row.oldestDays}d`}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  head: { paddingTop: 0, paddingBottom: spacing.xs },
  stage: { flex: 1, minWidth: 80 },
  count: { width: 44, textAlign: 'right', fontSize: 14 },
  amount: { width: 96, textAlign: 'right', fontSize: 13 },
  shareCell: {
    width: 108,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  track: {
    flex: 1,
    flexDirection: 'row',
    height: 7,
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  shareHead: { width: 108, textAlign: 'right' },
  sharePct: { width: 44, textAlign: 'right', fontSize: 13 },
  oldest: { width: 52, textAlign: 'right', fontSize: 14 },
});
