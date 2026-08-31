import { StyleSheet, View } from 'react-native';

import { DEAL_STATUS_LABELS, statusColors, type DealStatus } from '@/domain/status';
import { radii, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

import { Text } from './Text';

export function StatusPill({ status }: { status: DealStatus }) {
  const theme = useTheme();
  const { bg, fg } = statusColors(status, theme);

  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text variant="caption" style={{ color: fg }}>
        {DEAL_STATUS_LABELS[status]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
});
