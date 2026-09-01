/**
 * Needs you today - the live deals that have gone wrong in a way a person can
 * fix this morning.
 *
 * The rest of the deck is a report; this is the one panel you act from, so
 * every row is a link straight into the deal rather than a number to read.
 * The reason line is the whole point of the row: "no reply in 21d" tells you
 * what to do, where a status pill saying "Follow Up" does not.
 */
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { EMPTY_VALUE, formatMoney } from '@/lib/format';
import { radii, sizing, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

import { queueReasonLabel, type QueueItem } from './deck';

export function WorkQueue({
  items,
  onOpen,
}: {
  items: QueueItem[];
  onOpen: (dealId: string) => void;
}) {
  const theme = useTheme();

  if (items.length === 0) {
    return (
      <Text variant="body" tone="muted">
        Nothing is overdue and nothing has gone quiet. Every live deal has a next
        action ahead of it.
      </Text>
    );
  }

  return (
    <View>
      {items.map((item, index) => {
        const reason = queueReasonLabel(item);
        const days = item.silentDays == null ? EMPTY_VALUE : `${item.silentDays}d`;
        const urgent = item.reason !== 'no_next_action';

        return (
          <Pressable
            key={item.deal.id}
            onPress={() => onOpen(item.deal.id)}
            accessibilityRole="button"
            accessibilityLabel={`${item.deal.address}. ${reason}. Silent ${days}.`}
            style={({ pressed }) => [
              styles.row,
              index > 0 ? { borderTopWidth: 1, borderTopColor: theme.color.border } : null,
              pressed ? { backgroundColor: theme.color.surfaceMuted } : null,
            ]}
          >
            <View style={styles.text}>
              <Text variant="label" numberOfLines={1}>
                {item.deal.address}
              </Text>
              <Text variant="caption" tone="subtle" numberOfLines={1}>
                {item.deal.offer_price == null
                  ? reason
                  : `${reason} · ${formatMoney(item.deal.offer_price)}`}
              </Text>
            </View>
            <Text
              variant="mono"
              style={[styles.days, urgent ? { color: theme.color.warning } : null]}
              tone={urgent ? 'default' : 'muted'}
            >
              {days}
            </Text>
          </Pressable>
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
    // A row is a link, so it keeps the same tap target as a button.
    minHeight: sizing.minTapTarget,
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
  },
  text: { flex: 1, gap: 2 },
  days: { width: 44, textAlign: 'right', fontSize: 14 },
});
