import { useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { fontFamily, fontSize, radii, sizing, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

import { Text } from './Text';

type Props = TextInputProps & {
  label: string;
  /** Shown under the field in the danger tone; also flags the border. */
  error?: string | null;
  hint?: string;
  /** Monospace input for money and other figures. */
  numeric?: boolean;
};

export function TextField({ label, error, hint, numeric = false, style, ...rest }: Props) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  const borderColor = error
    ? theme.color.danger
    : focused
      ? theme.color.accent
      : theme.color.border;

  return (
    <View style={styles.wrapper}>
      <Text variant="label" tone="muted">
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={theme.color.textSubtle}
        onFocus={(e) => {
          setFocused(true);
          rest.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          rest.onBlur?.(e);
        }}
        style={[
          styles.input,
          {
            backgroundColor: theme.color.surface,
            borderColor,
            color: theme.color.text,
            fontFamily: numeric ? fontFamily.mono : fontFamily.body,
          },
          numeric && styles.numeric,
          style,
        ]}
        {...rest}
      />
      {error ? (
        <Text variant="caption" tone="negative">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" tone="subtle">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.xs,
  },
  input: {
    minHeight: sizing.inputHeight,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    fontSize: fontSize.md,
  },
  numeric: {
    fontVariant: ['tabular-nums'],
  },
});
