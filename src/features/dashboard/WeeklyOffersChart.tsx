/**
 * Eight-week offer volume - PRD 7.9.
 *
 * A single series, so there is no legend: the card's title says what is
 * plotted, and a one-swatch legend would only restate it.
 *
 * Mark specs followed deliberately:
 *   - bars capped at 24px wide, so the band keeps air rather than being filled
 *   - a 4px rounded cap at the data end, square at the baseline
 *   - a 2px gap in the surface color between touching bars, rather than a
 *     border drawn around each one
 *   - a hairline solid baseline, one step off the surface, never dashed
 *   - labels are selective: only the peak week carries a number. A value on
 *     every bar is noise, and the axis plus the accessible label carry the rest
 *
 * Phones have no hover, so the per-bar value that a tooltip would carry on the
 * web is exposed through each bar's accessibility label instead. Nothing is
 * available only by pointing at it.
 */
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { radii, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

import { weekLabel, type WeekBucket } from './kpis';

const PLOT_HEIGHT = 120;
const MAX_BAR_WIDTH = 24;
/** The gap is painted by the surface, not by a stroke on the bar. */
const BAR_GAP = 2;

export function WeeklyOffersChart({ weeks }: { weeks: WeekBucket[] }) {
  const theme = useTheme();

  const counts = weeks.map((week) => week.count);
  const peak = Math.max(...counts, 0);
  const total = counts.reduce((sum, count) => sum + count, 0);

  // A flat zero series would divide by zero and draw full-height bars.
  const scaleMax = peak > 0 ? peak : 1;
  const peakIndex = counts.lastIndexOf(peak);

  return (
    <View style={styles.wrapper}>
      {total === 0 ? (
        <Text variant="body" tone="muted">
          No offers sent in the last eight weeks. Send one and it shows up here.
        </Text>
      ) : null}

      <View style={styles.plot}>
        {weeks.map((week, index) => {
          const height = week.count === 0 ? 2 : (week.count / scaleMax) * PLOT_HEIGHT;
          const showValue = week.count > 0 && index === peakIndex;

          return (
            <View
              key={week.weekStart}
              style={styles.band}
              accessibilityRole="text"
              // The value a tooltip would carry on a pointer device.
              accessibilityLabel={`Week of ${weekLabel(week.weekStart)}: ${week.count} ${
                week.count === 1 ? 'offer' : 'offers'
              }`}
            >
              <View style={styles.valueSlot}>
                {showValue ? (
                  <Text variant="caption" tone="muted">
                    {week.count}
                  </Text>
                ) : null}
              </View>

              <View style={styles.barSlot}>
                <View
                  style={[
                    styles.bar,
                    {
                      height,
                      backgroundColor:
                        week.count === 0
                          ? theme.chart.grid
                          : week.isCurrent
                            ? theme.chart.barMuted
                            : theme.chart.bar,
                    },
                  ]}
                />
              </View>
            </View>
          );
        })}
      </View>

      {/* Hairline baseline, solid and recessive. */}
      <View style={[styles.baseline, { backgroundColor: theme.chart.grid }]} />

      <View style={styles.axis}>
        {weeks.map((week) => (
          <View key={week.weekStart} style={styles.tick}>
            <Text variant="caption" tone="subtle" numberOfLines={1}>
              {weekLabel(week.weekStart)}
            </Text>
          </View>
        ))}
      </View>

      <Text variant="caption" tone="subtle">
        The last bar is this week, still filling up.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.sm },
  plot: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    // Room for the plot plus the value label above the tallest bar, so the
    // card never crops its own chart.
    height: PLOT_HEIGHT + 20,
  },
  band: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    // Half the gap on each side adds up to the 2px surface gap between
    // neighbouring bars.
    paddingHorizontal: BAR_GAP / 2,
  },
  valueSlot: { height: 18, justifyContent: 'flex-end' },
  barSlot: { width: '100%', maxWidth: MAX_BAR_WIDTH, justifyContent: 'flex-end' },
  bar: {
    width: '100%',
    // Rounded at the data end, square where it meets the baseline.
    borderTopLeftRadius: radii.sm,
    borderTopRightRadius: radii.sm,
  },
  baseline: { height: 1 },
  axis: { flexDirection: 'row' },
  tick: { flex: 1, alignItems: 'center', paddingHorizontal: BAR_GAP / 2 },
});
