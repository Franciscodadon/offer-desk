import { StyleSheet, View } from 'react-native';

import { spacing } from '@/theme/tokens';

import { Button } from './Button';
import { Text } from './Text';

type Props = {
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({ title, body, actionLabel, onAction }: Props) {
  return (
    <View style={styles.wrapper}>
      <Text variant="heading" style={styles.centered}>
        {title}
      </Text>
      <Text variant="body" tone="muted" style={styles.centered}>
        {body}
      </Text>
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} fullWidth={false} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing['3xl'],
    paddingHorizontal: spacing.lg,
  },
  centered: { textAlign: 'center' },
});
