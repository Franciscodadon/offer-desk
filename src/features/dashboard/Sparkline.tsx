/**
 * The trend line inside a KPI tile.
 *
 * Drawn as micro-columns rather than a polyline: there is no SVG in this
 * project, and a line built from rotated Views would be a worse drawing than
 * bars are, not a better one. The columns follow the same mark specs as the
 * full chart - a surface-colored gap between neighbours rather than a stroke,
 * and the current period in the accent while the rest recede.
 *
 * A null value is a period with nothing to measure. It renders as a baseline
 * stub, not as zero: a rate nobody has data for is not a rate of zero, and
 * drawing it as one would put a cliff in the trend that never happened.
 */
import { StyleSheet, View } from 'react-native';

import { radii } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

const GAP = 2;
/** Marks the baseline for a period with no data, without claiming a value. */
const STUB_HEIGHT = 2;

type Props = {
  values: (number | null)[];
  height?: number;
  /** What the line is, in words, for a screen reader. */
  accessibilityLabel: string;
};

export function Sparkline({ values, height = 18, accessibilityLabel }: Props) {
  const theme = useTheme();

  const present = values.filter((value): value is number => value != null);
  const peak = Math.max(...present, 0);
  // A flat-zero or all-null series would divide by zero and draw full columns.
  const scale = peak > 0 ? peak : 1;
  const lastIndex = values.length - 1;

  return (
    <View
      style={[styles.row, { height }]}
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      {values.map((value, index) => (
        <View key={index} style={styles.band}>
          <View
            style={[
              styles.bar,
              {
                height: value == null ? STUB_HEIGHT : Math.max(STUB_HEIGHT, (value / scale) * height),
                backgroundColor:
                  value == null
                    ? theme.chart.grid
                    : index === lastIndex
                      ? theme.chart.bar
                      : theme.chart.barMuted,
              },
            ]}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end' },
  // Half the gap either side adds up to one surface-colored gap between bars.
  band: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: GAP / 2 },
  bar: {
    width: '100%',
    borderTopLeftRadius: radii.sm / 2,
    borderTopRightRadius: radii.sm / 2,
  },
});
