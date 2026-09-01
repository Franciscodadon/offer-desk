/**
 * Toggleable filter chip. Used for the pipeline's status filters, where the
 * whole row must stay reachable one-thumbed, so the hit area is padded out to
 * the minimum tap target even though the chip reads as small.
 */
import { Pressable, StyleSheet, View } from 'react-native';

import { radii, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

import { Text } from './Text';

type Props = {
  label: string;
  selected?: boolean;
  count?: number;
  onPress?: () => void;
  /** Overrides the selected background, so status chips can carry their color. */
  selectedColor?: string;
  selectedTextColor?: string;
};

export function Chip({
  label,
  selected = false,
  count,
  onPress,
  selectedColor,
  selectedTextColor,
}: Props) {
  const theme = useTheme();

  const background = selected
    ? (selectedColor ?? theme.color.accentMuted)
    : theme.color.surface;
  const foreground = selected
    ? (selectedTextColor ?? theme.color.accentText)
    : theme.color.textMuted;
  const border = selected ? 'transparent' : theme.color.border;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={count == null ? label : `${label}, ${count}`}
      onPress={onPress}
      hitSlop={spacing.sm}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: background, borderColor: border, opacity: pressed ? 0.75 : 1 },
      ]}
    >
      <View style={styles.content}>
        <Text variant="label" style={{ color: foreground }}>
          {label}
        </Text>
        {count != null ? (
          <Text variant="caption" style={{ color: foreground, opacity: 0.75 }}>
            {count}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 36,
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
});
