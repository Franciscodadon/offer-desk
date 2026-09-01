/**
 * Dashboard - PRD 7.9. The weekly scoreboard.
 *
 * Headline figures are stat tiles rather than charts: a single current number
 * is not a chart, and a one-bar bar chart says less than the number itself.
 * The only chart here is the one that earns it - offer volume over eight weeks,
 * where the shape of the trend is the point.
 */
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, EmptyState, Screen, StatusPill, Text } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { computeKpis } from '@/features/dashboard/kpis';
import { WeeklyOffersChart } from '@/features/dashboard/WeeklyOffersChart';
import { useDeals } from '@/features/deals/queries';
import { EMPTY_VALUE, formatMoney, formatNumber, formatPercent } from '@/lib/format';
import { spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';
export default function DashboardScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { orgId } = useAuth();
  const deals = useDeals(orgId);
  const kpis = useMemo(() => computeKpis(deals.data ?? []), [deals.data]);
  const hasDeals = (deals.data ?? []).length > 0;
  return (
    <Screen scroll={false}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={deals.isRefetching}
            onRefresh={() => void deals.refetch()}
            tintColor={theme.color.accent}
          />
        }
      >
        <View style={styles.header}>
          <Text variant="title">Dashboard</Text>
          <Text variant="body" tone="muted">
            This week at a glance.
          </Text>
        </View>
        {!hasDeals && !deals.isLoading ? (
          <EmptyState
            title="Nothing to measure yet"
            body="Log a deal and send an offer, and the weekly scoreboard fills in from there."
            actionLabel="Log a deal"
            onAction={() => router.push('/deal/new')}
          />
        ) : (
          <>
            <View style={styles.grid}>
              <StatTile
                label="Offers this week"
                value={formatNumber(kpis.offersThisWeek)}
                hint="The North Star metric"
              />
              <StatTile
                label="Total offers"
                value={formatNumber(kpis.totalOffers)}
                hint="All time"
              />
              <StatTile
                label="Acceptance rate"
                value={formatPercent(kpis.acceptanceRate, 0)}
                hint={
                  kpis.acceptanceRate == null
                    ? 'No decided offers yet'
                    : 'Accepted of decided'
                }
              />
              <StatTile
                label="Avg offer to list"
                value={formatPercent(kpis.averageOfferToList, 0)}
                hint="Across priced deals"
              />
              <StatTile
                label="Pipeline value"
                value={formatMoney(kpis.pipelineValue)}
                hint="Offers still live"
              />
              <StatTile
                label="Pipeline hygiene"
                value={formatPercent(kpis.pipelineHygiene, 0)}
                hint={
                  kpis.pipelineHygiene == null
                    ? 'No active deals'
                    : 'Active deals with a next action'
                }
              />
            </View>
            <Card>
              <Text variant="label" tone="muted">
                Offers sent, last 8 weeks
              </Text>
              <WeeklyOffersChart weeks={kpis.weekly} />
            </Card>
            <Card>
              <Text variant="label" tone="muted">
                Where the pipeline stands
              </Text>
              {kpis.statusBreakdown.map((row) => (
                <View key={row.status} style={styles.statusRow}>
                  <StatusPill status={row.status} />
                  <Text variant="mono" tone={row.count === 0 ? 'subtle' : 'default'}>
                    {row.count === 0 ? EMPTY_VALUE : formatNumber(row.count)}
                  </Text>
                </View>
              ))}
            </Card>
            <Button
              label="Open pipeline"
              variant="secondary"
              onPress={() => router.push('/pipeline')}
            />
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
/**
 * A single headline number. Uses the proportional `figure` variant, not the
 * tabular one: equal-width digits exist so columns line up, and on one large
 * standalone number they only make it read loose.
 */
function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Card style={styles.tile}>
      <Text variant="label" tone="muted">
        {label}
      </Text>
      <Text variant="figure" tone={value === EMPTY_VALUE ? 'subtle' : 'default'}>
        {value}
      </Text>
      <Text variant="caption" tone="subtle">
        {hint}
      </Text>
    </Card>
  );
}
const styles = StyleSheet.create({
  content: { gap: spacing.lg, paddingBottom: spacing.xl },
  header: { gap: spacing.xs },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  tile: { flexGrow: 1, flexBasis: 150, gap: spacing.xs },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
});
