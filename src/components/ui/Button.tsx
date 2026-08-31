/**
 * Button. Minimum 44pt tall so it stays usable one-thumbed in a driveway
 * (PRD principle 1).
 */
import { ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { radii, sizing, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

import { Text } from './Text';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  fullWidth = true,
  style,
}: Props) {
  const theme = useTheme();
  const inactive = disabled || loading;

  const surface: Record<Variant, { bg: string; border: string }> = {
    primary: { bg: theme.color.accent, border: theme.color.accent },
    secondary: { bg: theme.color.surface, border: theme.color.borderStrong },
    ghost: { bg: 'transparent', border: 'transparent' },
    danger: { bg: theme.color.danger, border: theme.color.danger },
  };

  const textTone = variant === 'primary' || variant === 'danger' ? 'onAccent' : 'default';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      accessibilityLabel={label}
      onPress={inactive ? undefined : onPress}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: surface[variant].bg,
          borderColor: surface[variant].border,
          opacity: inactive ? 0.5 : pressed ? 0.85 : 1,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' || variant === 'danger' ? theme.color.textOnAccent : theme.color.text}
        />
      ) : (
        <View style={styles.content}>
          <Text variant="bodyStrong" tone={textTone}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: sizing.controlHeight,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
});
