/**
 * One row of the pipeline. Shows what a decision needs at a glance: where the
 * property is, where the offer stands, and what the offer was as a share of
 * list (PRD 7.2, "each row shows offer-to-list %").
 */
import { Pressable, StyleSheet, View } from 'react-native';

import { StatusPill, Text } from '@/components/ui';
import { offerToList, type Deal } from '@/domain/types';
import { formatDate, formatMoney, formatPercent } from '@/lib/format';
import { radii, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

type Props = {
  deal: Deal;
  onPress: () => void;
};

export function DealRow({ deal, onPress }: Props) {
  const theme = useTheme();
  const ratio = offerToList(deal);

  const locality = [deal.city, deal.state].filter(Boolean).join(', ');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${deal.address}, ${deal.status.replace(/_/g, ' ')}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: theme.color.surface,
          borderColor: theme.color.border,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <View style={styles.header}>
        <View style={styles.headingText}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {deal.address}
          </Text>
          {locality ? (
            <Text variant="caption" tone="subtle" numberOfLines={1}>
              {locality}
            </Text>
          ) : null}
        </View>
        <StatusPill status={deal.status} />
      </View>

      <View style={styles.figures}>
        <Figure label="List" value={formatMoney(deal.list_price)} />
        <Figure label="Offer" value={formatMoney(deal.offer_price)} />
        <Figure
          label="Offer/List"
          value={formatPercent(ratio, 0)}
          // A low ratio is a strong offer for a buyer, so it is not colored as
          // good or bad here; the number speaks and the analyzer judges.
          tone={ratio == null ? 'subtle' : 'default'}
        />
      </View>

      {deal.submitted_at || deal.next_action_at ? (
        <View style={styles.meta}>
          {deal.submitted_at ? (
            <Text variant="caption" tone="subtle">
              Sent {formatDate(deal.submitted_at)}
            </Text>
          ) : null}
          {deal.next_action_at ? (
            <Text variant="caption" tone="accent">
              Next {formatDate(deal.next_action_at)}
            </Text>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}

function Figure({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'subtle';
}) {
  return (
    <View style={styles.figure}>
      <Text variant="caption" tone="muted">
        {label}
      </Text>
      <Text variant="mono" tone={tone === 'subtle' ? 'subtle' : 'default'}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headingText: { flex: 1, gap: 2 },
  figures: { flexDirection: 'row', gap: spacing.md },
  // Equal-width columns so List, Offer, and Offer/List line up from row to
  // row and the pipeline can be scanned down a column.
  figure: { flex: 1, gap: 2 },
  meta: { flexDirection: 'row', gap: spacing.lg, flexWrap: 'wrap' },
});
