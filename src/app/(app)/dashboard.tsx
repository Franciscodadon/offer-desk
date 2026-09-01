/**
 * Dashboard - PRD 7.9. The weekly scoreboard, laid out as a command deck.
 *
 * On a wide screen this is the whole operation above the fold: a strip of
 * headline figures, then the funnel beside the call list, then the stage table
 * beside the trend. The extra width goes to a second column of panels rather
 * than to a wider single column - a laptop showing one phone-width stack of
 * cards is the layout this screen replaced.
 *
 * Narrow screens get the same panels in one column, in the same order. Nothing
 * here is desktop-only: the deck is a rearrangement, not a second feature set.
 *
 * This file is the wiring - fetch, derive, route. The layout itself lives in
 * DashboardDeck so it can be rendered against fixed data at a real width.
 */
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { Button, EmptyState, Screen, Text } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { DashboardDeck } from '@/features/dashboard/DashboardDeck';
import {
  pipelineFunnel,
  stageDetail,
  stalledCount,
  weeklyAcceptance,
  workQueue,
} from '@/features/dashboard/deck';
import { computeKpis } from '@/features/dashboard/kpis';
import { useDeals } from '@/features/deals/queries';
import { formatNumber } from '@/lib/format';
import { spacing } from '@/theme/tokens';
import { useIsDeck } from '@/theme/ContentWidth';
import { useTheme } from '@/theme/ThemeProvider';

/** Wide enough for two columns of panels without crowding either. */
const DECK_MAX_WIDTH = 1280;

export default function DashboardScreen() {
  const router = useRouter();
  const theme = useTheme();
  const isWide = useIsDeck();
  const { orgId } = useAuth();
  const deals = useDeals(orgId);

  const rows = useMemo(() => deals.data ?? [], [deals.data]);
  const kpis = useMemo(() => computeKpis(rows), [rows]);
  const funnel = useMemo(() => pipelineFunnel(rows), [rows]);
  const stages = useMemo(() => stageDetail(rows), [rows]);
  const queue = useMemo(() => workQueue(rows, new Date(), isWide ? 4 : 5), [rows, isWide]);
  const stalled = useMemo(() => stalledCount(rows), [rows]);
  const acceptanceTrend = useMemo(
    () => weeklyAcceptance(rows, kpis.weekly.map((week) => week.weekStart)),
    [rows, kpis.weekly],
  );

  const hasDeals = rows.length > 0;

  return (
    <Screen scroll={false} maxWidth={isWide ? DECK_MAX_WIDTH : undefined}>
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
          <View style={styles.headerText}>
            <Text variant="title">Dashboard</Text>
            <Text variant="body" tone="muted">
              {stalled === 0
                ? `${formatNumber(kpis.offersThisWeek)} offers out this week.`
                : `${formatNumber(kpis.offersThisWeek)} offers out this week · ${formatNumber(
                    stalled,
                  )} ${stalled === 1 ? 'deal has' : 'deals have'} gone quiet.`}
            </Text>
          </View>
          {/* The action the whole product exists for, reachable from the first
              screen without a detour through the pipeline. */}
          <Button
            label="Log a new deal"
            fullWidth={false}
            onPress={() => router.push('/deal/new')}
          />
        </View>

        {!hasDeals && !deals.isLoading ? (
          <EmptyState
            title="Nothing to measure yet"
            body="Log a deal and send an offer, and the weekly scoreboard fills in from there."
            actionLabel="Log a deal"
            onAction={() => router.push('/deal/new')}
          />
        ) : (
          <DashboardDeck
            kpis={kpis}
            funnel={funnel}
            stages={stages}
            queue={queue}
            stalled={stalled}
            acceptanceTrend={acceptanceTrend}
            isWide={isWide}
            onOpenDeal={(id) => router.push(`/deal/${id}`)}
            onOpenPipeline={() => router.push('/pipeline')}
          />
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg, paddingBottom: spacing.xl },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    flexWrap: 'wrap',
  },
  headerText: { gap: spacing.xs, flexShrink: 1 },
});
