/**
 * Input and output primitives for the analyzer.
 *
 * Every numeric field holds a local draft string while it is being typed and
 * only pushes a parsed number up on change, so a field can be cleared or half
 * typed without the model seeing a bogus value. Percent fields display whole
 * percentages and store ratios, which is the one place the 12.5 / 0.125
 * conversion happens.
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text, TextField } from '@/components/ui';
import { VERDICT_LABELS, type Verdict } from '@/domain/analyzer';
import { EMPTY_VALUE, parseNumericInput } from '@/lib/format';
import { radii, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

type NumericProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  hint?: string;
  /** Shown when the field is cleared, since the model always needs a number. */
  emptyValue?: number;
};

/** A plain number field: months, years, counts. */
export function NumberInput({
  label,
  value,
  onChange,
  hint,
  emptyValue = 0,
}: NumericProps) {
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <View style={styles.field}>
      <TextField
        label={label}
        value={draft ?? String(value)}
        onChangeText={(text) => {
          setDraft(text);
          onChange(parseNumericInput(text) ?? emptyValue);
        }}
        onBlur={() => setDraft(null)}
        keyboardType="numeric"
        numeric
        hint={hint}
      />
    </View>
  );
}

/** A dollar field. Accepts "$357,244" and stores 357244. */
export function MoneyInput(props: NumericProps) {
  return <NumberInput {...props} />;
}

/**
 * A percentage field. The user types 12.5; the model receives 0.125.
 * Keeping the conversion here means no other code has to remember which
 * convention it is holding.
 */
export function PercentInput({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  onChange: (ratio: number) => void;
  hint?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  // Round-trip through display to avoid 0.06 rendering as 6.000000000000001.
  const shown = draft ?? String(Number((value * 100).toFixed(4)));

  return (
    <View style={styles.field}>
      <TextField
        label={label}
        value={shown}
        onChangeText={(text) => {
          setDraft(text);
          const parsed = parseNumericInput(text);
          onChange(parsed == null ? 0 : parsed / 100);
        }}
        onBlur={() => setDraft(null)}
        keyboardType="numeric"
        numeric
        hint={hint}
      />
    </View>
  );
}

/** One line of analyzer output. */
export function ResultRow({
  label,
  value,
  tone = 'default',
  emphasis = false,
}: {
  label: string;
  value: string;
  tone?: 'default' | 'positive' | 'negative' | 'muted';
  emphasis?: boolean;
}) {
  return (
    <View style={styles.resultRow}>
      <Text variant="body" tone="muted">
        {label}
      </Text>
      <Text
        variant={emphasis ? 'monoLarge' : 'mono'}
        tone={tone === 'muted' ? 'subtle' : tone}
      >
        {value || EMPTY_VALUE}
      </Text>
    </View>
  );
}

/** Good / thin / pass coloring on a headline ratio (PRD 7.6). */
export function VerdictPill({ verdict }: { verdict: Verdict | null }) {
  const theme = useTheme();
  if (!verdict) return null;

  const colors = {
    good: { bg: theme.color.successMuted, fg: theme.color.success },
    thin: { bg: theme.color.warningMuted, fg: theme.color.warning },
    pass: { bg: theme.color.dangerMuted, fg: theme.color.danger },
  }[verdict];

  return (
    <View style={[styles.pill, { backgroundColor: colors.bg }]}>
      <Text variant="caption" style={{ color: colors.fg }}>
        {VERDICT_LABELS[verdict]}
      </Text>
    </View>
  );
}

export const fieldStyles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' },
});

const styles = StyleSheet.create({
  field: { flexGrow: 1, flexBasis: 140 },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  pill: {
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
});
