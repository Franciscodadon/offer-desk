/**
 * Where the pipeline stands - PRD 7.9, rebuilt as a conversion funnel.
 *
 * This replaces a list of status pills with a count beside each. A count
 * beside a colored tag is a legend, not a reading: it says how many deals wear
 * a label without saying whether that is good, where the deals went, or what
 * they are worth. The funnel answers all three - the bar carries magnitude,
 * the line between two bars says where the missing deals went, and the
 * conversion chips say which step is leaking.
 *
 * Single-hue bars, so there is no legend: the stage names are the identity and
 * the length is the only variable.
 */
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { EMPTY_VALUE, formatMoney, formatNumber, formatPercent } from '@/lib/format';
import { radii, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

import type { Funnel } from './deck';

/** Even an empty stage keeps a visible stub, so the row reads as a zero. */
const MIN_BAR = 0.015;

export function PipelineFunnel({
  funnel,
  dense,
  showAmounts,
}: {
  funnel: Funnel;
  dense: boolean;
  /**
   * Dollars per stage. Dropped on a narrow screen, where the column costs the
   * bar most of its length and the stage table below carries the same figures.
   */
  showAmounts: boolean;
}) {
  const theme = useTheme();

  return (
    <View style={styles.wrapper}>
      {funnel.stages.map((stage, index) => {
        const drop = funnel.drops[index];
        const fillShare = Math.min(1, Math.max(stage.share, MIN_BAR));

        return (
          <View key={stage.key}>
            <View
              style={styles.row}
              accessibilityRole="text"
              accessibilityLabel={`${stage.label}: ${formatNumber(stage.count)} ${
                stage.count === 1 ? 'deal' : 'deals'
              }${stage.amount == null ? '' : `, ${formatMoney(stage.amount)} offered`}${
                stage.conversion == null
                  ? ''
                  : `, ${formatPercent(stage.conversion, 0)} of the step above`
              }`}
            >
              <Text
                variant="label"
                numberOfLines={1}
                style={dense ? styles.nameDense : styles.name}
              >
                {stage.label}
              </Text>

              <View style={[styles.track, { backgroundColor: theme.color.surfaceMuted }]}>
                {/* Two flex weights that add to 1, so the bar is a share of
                    whatever width the column gets rather than a measured
                    pixel count. */}
                <View
                  style={[
                    styles.fill,
                    { flex: fillShare, backgroundColor: theme.chart.bar },
                  ]}
                />
                <View style={{ flex: 1 - fillShare }} />
              </View>

              <Text variant="mono" style={styles.count}>
                {formatNumber(stage.count)}
              </Text>
              {showAmounts ? (
                <Text variant="mono" tone="muted" style={styles.money} numberOfLines={1}>
                  {stage.amount == null ? EMPTY_VALUE : formatMoney(stage.amount)}
                </Text>
              ) : null}
            </View>

            {drop && drop.count > 0 ? (
              <View style={styles.dropRow}>
                <Text
                  variant="caption"
                  tone="subtle"
                  style={dense ? styles.dropCountDense : styles.dropCount}
                >
                  {`▼ ${formatNumber(drop.count)}`}
                </Text>
                <Text
                  variant="caption"
                  tone="subtle"
                  numberOfLines={dense ? 1 : 2}
                  style={styles.dropLabel}
                >
                  {drop.label}
                </Text>
              </View>
            ) : null}
          </View>
        );
      })}

      <View style={[styles.footer, { borderTopColor: theme.color.border }]}>
        {funnel.stages.slice(1).map((stage) => (
          <View
            key={stage.key}
            style={[styles.chip, { backgroundColor: theme.color.surfaceMuted }]}
          >
            <Text variant="caption" tone="muted">
              {stage.conversion == null ? EMPTY_VALUE : formatPercent(stage.conversion, 0)}
            </Text>
          </View>
        ))}
        <View style={[styles.chip, { backgroundColor: theme.color.accentMuted }]}>
          <Text variant="caption" tone="accent">
            {`offer → close  ${
              funnel.offerToClose == null ? EMPTY_VALUE : formatPercent(funnel.offerToClose, 1)
            }`}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  name: { width: 96 },
  nameDense: { width: 84 },
  track: {
    flex: 1,
    flexDirection: 'row',
    height: 22,
    borderRadius: radii.sm,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: radii.sm },
  count: { width: 34, textAlign: 'right' },
  money: { width: 86, textAlign: 'right', fontSize: 13 },
  dropRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dropCount: { width: 96, textAlign: 'right' },
  dropCountDense: { width: 84, textAlign: 'right' },
  dropLabel: { flex: 1 },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
  },
  chip: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
});
