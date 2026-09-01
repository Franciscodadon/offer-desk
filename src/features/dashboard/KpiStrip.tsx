/**
 * The row of headline figures across the top of the deck.
 *
 * Each tile is a number, not a chart: a single current value is a stat tile,
 * and a one-bar bar chart says less than the number itself. The sparkline
 * under it is context for that number, not a second reading of it.
 *
 * Tiles wrap rather than scroll, so nothing is reachable only by swiping a row
 * sideways - on a phone the six become two columns of three.
 */
import { StyleSheet, View } from 'react-native';

import { Card, Text } from '@/components/ui';
import { EMPTY_VALUE } from '@/lib/format';
import { spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

import { Sparkline } from './Sparkline';

export type KpiTile = {
  key: string;
  label: string;
  value: string;
  /** One line under the value. Omitted when a trend takes its place. */
  hint?: string;
  trend?: {
    values: (number | null)[];
    accessibilityLabel: string;
  };
  /** Draws the value in the warning role. For a count that means "act". */
  alarm?: boolean;
};

export function KpiStrip({ tiles, dense }: { tiles: KpiTile[]; dense: boolean }) {
  const theme = useTheme();

  return (
    <View style={styles.strip}>
      {tiles.map((tile) => (
        <Card key={tile.key} style={[styles.tile, dense ? styles.tileDense : styles.tileRoomy]}>
          <Text variant="caption" tone="subtle" numberOfLines={1}>
            {tile.label}
          </Text>
          <Text
            variant="figure"
            tone={tile.value === EMPTY_VALUE ? 'subtle' : 'default'}
            style={[
              dense ? styles.figureDense : null,
              // The alarm color sits on top of a number the label already
              // names; it is never the only thing carrying the meaning.
              tile.alarm && tile.value !== EMPTY_VALUE
                ? { color: theme.color.warning }
                : null,
            ]}
          >
            {tile.value}
          </Text>
          {tile.trend ? (
            <Sparkline
              values={tile.trend.values}
              accessibilityLabel={tile.trend.accessibilityLabel}
              height={16}
            />
          ) : null}
          {tile.hint ? (
            <Text variant="caption" tone="subtle" numberOfLines={1}>
              {tile.hint}
            </Text>
          ) : null}
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: { gap: spacing.xs, padding: spacing.md },
  // Six across on the deck; two across on a phone.
  tileDense: { flexGrow: 1, flexBasis: 132 },
  tileRoomy: { flexGrow: 1, flexBasis: 150 },
  figureDense: { fontSize: 22, lineHeight: 28 },
});
