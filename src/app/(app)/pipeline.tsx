/**
 * Pipeline - the app's home screen.
 *
 * Phase 0 renders the shell and confirms the workspace is live. The deal list,
 * filters, search, and inline status changes land with PRD 7.2 in phase 1.
 */
import { StyleSheet, View } from 'react-native';

import { Card, Screen, StatusPill, Text } from '@/components/ui';
import { DEAL_STATUSES } from '@/domain/status';
import { useAuth } from '@/features/auth/AuthProvider';
import { spacing } from '@/theme/tokens';

export default function PipelineScreen() {
  const { org, profile } = useAuth();

  return (
    <Screen>
      <View style={styles.header}>
        <Text variant="title">Pipeline</Text>
        <Text variant="body" tone="muted">
          {org?.name ?? 'Your workspace'}
          {profile?.name ? ` · ${profile.name}` : ''}
        </Text>
      </View>

      <Card>
        <Text variant="bodyStrong">No deals yet</Text>
        <Text variant="body" tone="muted">
          The foundations are in place: your workspace exists, your session syncs across
          devices, and the database enforces that only this workspace can read its deals.
          Deal capture arrives next.
        </Text>
      </Card>

      <Card>
        <Text variant="label" tone="muted">
          Statuses this pipeline tracks
        </Text>
        <View style={styles.pills}>
          {DEAL_STATUSES.map((status) => (
            <StatusPill key={status} status={status} />
          ))}
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.xs },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
