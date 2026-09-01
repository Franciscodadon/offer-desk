/**
 * The offer ladder - every MAO percentage priced at once.
 *
 * The question an operator is actually asking is not "what is my offer at
 * 70%", it is "how high can I go before this stops working". That is a
 * comparison, so the comparison is the screen rather than something reached by
 * tapping through percentages one at a time.
 *
 * Each row is a real run of the Fix & Flip model at that purchase price, not a
 * simplified stand-in, so the margin shown is the margin the full analyzer
 * would show if the price were typed in.
 */
import { Pressable, StyleSheet, View } from 'react-native';

import { Card, Text } from '@/components/ui';
import type { Ladder, LadderRung } from '@/domain/analyzer';
import { EMPTY_VALUE, formatMoney, formatPercent } from '@/lib/format';
import { radii, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

type Props = {
  ladder: Ladder;
  onSelect: (maoPct: number) => void;
};

export function OfferLadder({ ladder, onSelect }: Props) {
  const theme = useTheme();

  return (
    <Card>
      <View style={styles.headerRow}>
        <Text variant="label" tone="muted" style={styles.colMao}>
          Buyer MAO
        </Text>
        <Text variant="label" tone="muted" style={styles.colOffer}>
          Max offer
        </Text>
        <Text variant="label" tone="muted" style={styles.marginHeader}>
          Margin
        </Text>
      </View>

      {ladder.rungs.map((rung) => (
        <Rung key={rung.maoPct} rung={rung} onSelect={onSelect} />
      ))}

      <View style={[styles.note, { borderTopColor: theme.color.border }]}>
        <Text variant="caption" tone="muted">
          {ceilingNote(ladder)}
        </Text>
      </View>
    </Card>
  );
}

/** One line of plain language for what the ladder adds up to. */
function ceilingNote(ladder: Ladder): string {
  if (!ladder.ceiling) {
    return 'This deal does not clear your margin floor at any percentage. The numbers have to change before the offer does.';
  }
  if (!ladder.breaks) {
    return `Every percentage on the ladder clears your floor, up to ${ladder.ceiling.label}.`;
  }
  return `${ladder.ceiling.label} is as high as you can go. At ${ladder.breaks.label} the margin stops clearing your floor.`;
}

function Rung({
  rung,
  onSelect,
}: {
  rung: LadderRung;
  onSelect: (maoPct: number) => void;
}) {
  const theme = useTheme();

  const marginTone =
    rung.verdict === 'good'
      ? theme.color.success
      : rung.verdict === 'thin'
        ? theme.color.warning
        : theme.color.danger;

  const marginBackground =
    rung.verdict === 'good'
      ? theme.color.successMuted
      : rung.verdict === 'thin'
        ? theme.color.warningMuted
        : theme.color.dangerMuted;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: rung.isCurrent }}
      accessibilityLabel={
        rung.viable
          ? `${rung.label} of ARV, max offer ${formatMoney(rung.purchase)}, margin ${formatPercent(rung.margin, 1)}`
          : `${rung.label} of ARV, no offer possible: repairs exceed what a buyer would pay`
      }
      onPress={() => onSelect(rung.maoPct)}
      style={({ pressed }) => [
        styles.rung,
        rung.isCurrent && {
          backgroundColor: theme.color.accentMuted,
          borderRadius: radii.md,
        },
        { opacity: pressed ? 0.7 : rung.viable ? 1 : 0.55 },
      ]}
    >
      {rung.isCurrent ? (
        <View style={[styles.marker, { backgroundColor: theme.color.accent }]} />
      ) : null}

      <View style={styles.colMao}>
        <Text variant="mono" tone={rung.isCurrent ? 'default' : 'muted'}>
          {rung.label}
        </Text>
        {rung.isCurrent ? (
          <Text variant="caption" tone="accent">
            Your rule
          </Text>
        ) : null}
      </View>

      <Text
        variant="mono"
        tone={rung.viable ? (rung.isCurrent ? 'default' : 'muted') : 'subtle'}
        style={styles.colOffer}
      >
        {rung.viable ? formatMoney(rung.purchase) : EMPTY_VALUE}
      </Text>

      <View style={styles.colMargin}>
        {rung.viable ? (
          <View style={[styles.pill, { backgroundColor: marginBackground }]}>
            <Text variant="caption" style={{ color: marginTone }}>
              {formatPercent(rung.margin, 1)}
            </Text>
          </View>
        ) : (
          <Text variant="caption" tone="subtle">
            No offer
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.xs,
  },
  rung: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    paddingHorizontal: spacing.sm,
    position: 'relative',
  },
  marker: {
    position: 'absolute',
    left: 0,
    top: 8,
    bottom: 8,
    width: 3,
    borderRadius: radii.pill,
  },
  colMao: { flex: 1.4, gap: 1 },
  colOffer: { flex: 2, textAlign: 'right' },
  colMargin: { flex: 1.2, alignItems: 'flex-end' },
  // The header is a Text, so it needs textAlign; alignItems only positions the
  // pill in the rows below it.
  marginHeader: { flex: 1.2, textAlign: 'right' },
  pill: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  note: { borderTopWidth: 1, paddingTop: spacing.md, marginTop: spacing.xs },
});
