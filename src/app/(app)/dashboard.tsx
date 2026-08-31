/**
 * Dashboard - PRD 7.9. Phase 0 renders the KPI frame with the metrics the PRD
 * defines; the values light up once deals exist in phase 1.
 */
import { StyleSheet, View } from 'react-native';

import { Card, Screen, Text } from '@/components/ui';
import { spacing } from '@/theme/tokens';

const KPIS = [
  { label: 'Offers this week', hint: 'The North Star metric' },
  { label: 'Total offers', hint: 'All time' },
  { label: 'Acceptance rate', hint: 'Accepted / decided' },
  { label: 'Avg offer-to-list', hint: 'Offer / list price' },
  { label: 'Pipeline value', hint: 'Sum of active offers' },
];

export default function DashboardScreen() {
  return (
    <Screen>
      <View style={styles.header}>
        <Text variant="title">Dashboard</Text>
        <Text variant="body" tone="muted">
          Weekly scoreboard for the acquisitions team.
        </Text>
      </View>

      <View style={styles.grid}>
        {KPIS.map((kpi) => (
          <Card key={kpi.label} style={styles.kpi}>
            <Text variant="label" tone="muted">
              {kpi.label}
            </Text>
            <Text variant="monoLarge" tone="subtle">
              --
            </Text>
            <Text variant="caption" tone="subtle">
              {kpi.hint}
            </Text>
          </Card>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.xs },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  kpi: { flexGrow: 1, flexBasis: 160, gap: spacing.xs },
});
