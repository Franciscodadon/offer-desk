/**
 * The MAO percentage picker.
 *
 * Eight buttons rather than a number field: the percentage a cash buyer pays
 * is a rule of thumb chosen from a short list, and typing 0.7 is the wrong
 * gesture for a value with eight real options.
 *
 * The field stays underneath for a percentage that is not on the list, since
 * a picker that forbids 72% would be worse than the field it replaced.
 */
import { StyleSheet, View } from 'react-native';

import { Chip, Text } from '@/components/ui';
import { isPreset, MAO_PRESETS, maoLabel } from '@/domain/analyzer';
import { formatMoney } from '@/lib/format';
import { spacing } from '@/theme/tokens';

import { PercentInput } from './fields';

type Props = {
  value: number;
  onChange: (ratio: number) => void;
  /** When given, shows what a buyer pays at the selected percentage. */
  buyerPrice?: number | null;
  label?: string;
};

export function MaoPresets({
  value,
  onChange,
  buyerPrice,
  label = 'Buyer MAO',
}: Props) {
  const custom = !isPreset(value);

  return (
    <View style={styles.wrapper}>
      <View style={styles.header}>
        <Text variant="label" tone="muted">
          {label}
        </Text>
        <Text variant="mono" tone="accent">
          {maoLabel(value)}
        </Text>
      </View>

      <View style={styles.row}>
        {MAO_PRESETS.map((preset) => (
          <Chip
            key={preset}
            label={maoLabel(preset)}
            selected={Math.abs(preset - value) < 0.0005}
            onPress={() => onChange(preset)}
          />
        ))}
      </View>

      {buyerPrice != null ? (
        <Text variant="caption" tone="subtle">
          A buyer pays {formatMoney(buyerPrice)} at {maoLabel(value)} of ARV, after
          repairs.
        </Text>
      ) : null}

      {custom ? (
        <PercentInput
          label="Custom percentage"
          value={value}
          onChange={onChange}
          hint="Off the standard ladder. Tap a button above to go back to one."
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
