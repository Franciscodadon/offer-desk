/**
 * The deck itself: the KPI strip and the four panels, with no idea where the
 * deals came from.
 *
 * Split out from the screen so the layout can be rendered against fixed data -
 * in a test, and in a browser at a real width. Layout bugs live in geometry
 * (a column that will not shrink, a label that collides with the number beside
 * it), and geometry is not something a passing assertion can see.
 */
import { StyleSheet, View } from 'react-native';

import { Button, Card, Text } from '@/components/ui';
import { EMPTY_VALUE, formatMoney, formatNumber, formatPercent } from '@/lib/format';
import { spacing } from '@/theme/tokens';

import type { Funnel, QueueItem, StageRow } from './deck';
import { KpiStrip, type KpiTile } from './KpiStrip';
import type { DashboardKpis } from './kpis';
import { weekLabel } from './kpis';
import { PipelineFunnel } from './PipelineFunnel';
import { StageDetail } from './StageDetail';
import { WeeklyOffersChart } from './WeeklyOffersChart';
import { WorkQueue } from './WorkQueue';

export type DeckData = {
  kpis: DashboardKpis;
  funnel: Funnel;
  stages: StageRow[];
  queue: QueueItem[];
  stalled: number;
  /** Acceptance rate per week, aligned to `kpis.weekly`. Null where undecided. */
  acceptanceTrend: (number | null)[];
};

type Props = DeckData & {
  /** Wide enough for two columns of panels. */
  isWide: boolean;
  onOpenDeal: (dealId: string) => void;
  onOpenPipeline: () => void;
};

/** The six headline figures, in the order they are read. */
export function deckTiles({
  kpis,
  funnel,
  stalled,
  acceptanceTrend,
}: Pick<DeckData, 'kpis' | 'funnel' | 'stalled' | 'acceptanceTrend'>): KpiTile[] {
  const offerTrend = kpis.weekly.map((week) => week.count);
  const weekSpan = `${weekLabel(kpis.weekly[0]?.weekStart ?? '')} to now`;
  // Deals waiting on a reply. The funnel accounts for them between "offer
  // sent" and "answered", which is the same set pipeline value is summed over.
  const liveCount = funnel.drops[1]?.count ?? 0;

  return [
    {
      key: 'offers',
      label: 'Offers / wk',
      value: formatNumber(kpis.offersThisWeek),
      trend: {
        values: offerTrend,
        accessibilityLabel: `Offers sent each week, ${weekSpan}: ${offerTrend.join(', ')}`,
      },
    },
    {
      key: 'accepted',
      label: 'Accepted',
      value: formatPercent(kpis.acceptanceRate, 0),
      trend: {
        values: acceptanceTrend,
        accessibilityLabel: `Acceptance rate each week, ${weekSpan}: ${acceptanceTrend
          .map((rate) => (rate == null ? 'no decisions' : formatPercent(rate, 0)))
          .join(', ')}`,
      },
    },
    {
      key: 'pipeline',
      label: 'Pipeline',
      value: formatMoney(kpis.pipelineValue),
      hint: `${formatNumber(liveCount)} live`,
    },
    {
      key: 'offer-to-list',
      label: 'Offer / list',
      value: formatPercent(kpis.averageOfferToList, 0),
      hint: 'across priced deals',
    },
    {
      key: 'hygiene',
      label: 'Hygiene',
      value: formatPercent(kpis.pipelineHygiene, 0),
      hint: kpis.pipelineHygiene == null ? 'no active deals' : 'live deals with an action',
    },
    {
      key: 'stalled',
      label: 'Stalled',
      value: stalled === 0 ? EMPTY_VALUE : formatNumber(stalled),
      alarm: stalled > 0,
      hint: 'no reply in 14d+',
    },
  ];
}

export function DashboardDeck({
  kpis,
  funnel,
  stages,
  queue,
  stalled,
  acceptanceTrend,
  isWide,
  onOpenDeal,
  onOpenPipeline,
}: Props) {
  const tiles = deckTiles({ kpis, funnel, stalled, acceptanceTrend });

  return (
    <>
      <KpiStrip tiles={tiles} dense={isWide} />

      {/* The funnel and the call list read together - what is happening, and
          what to do about it. So do the stage table and the trend. On one
          column they simply stack in the same order. */}
      <View style={isWide ? styles.deckRow : styles.stack}>
        <View style={isWide ? styles.wide : undefined}>
          <Card style={styles.panel}>
            <View style={styles.panelHead}>
              <Text variant="label">Where the pipeline stands</Text>
              <Text variant="caption" tone="subtle">
                {`${formatNumber(funnel.stages[0].count)} deals`}
              </Text>
            </View>
            <PipelineFunnel funnel={funnel} dense={isWide} showAmounts={isWide} />
          </Card>
        </View>

        <View style={isWide ? styles.narrow : undefined}>
          <Card style={styles.panel}>
            <View style={styles.panelHead}>
              <Text variant="label">Needs you today</Text>
              <Text variant="caption" tone="subtle">
                {queue.length === 0 ? 'all clear' : `${formatNumber(queue.length)} deals`}
              </Text>
            </View>
            <WorkQueue items={queue} onOpen={onOpenDeal} />
            <Button label="Open pipeline" variant="secondary" onPress={onOpenPipeline} />
          </Card>
        </View>
      </View>

      <View style={isWide ? styles.deckRow : styles.stack}>
        <View style={isWide ? styles.wide : undefined}>
          <Card style={styles.panel}>
            <Text variant="label">Stage detail</Text>
            <StageDetail rows={stages} showShare={isWide} />
          </Card>
        </View>

        <View style={isWide ? styles.narrow : undefined}>
          <Card style={styles.panel}>
            <View style={styles.panelHead}>
              <Text variant="label">Offers sent, 8 weeks</Text>
              <Text variant="caption" tone="subtle">
                {`${formatNumber(kpis.totalOffers)} all time`}
              </Text>
            </View>
            <WeeklyOffersChart weeks={kpis.weekly} />
          </Card>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  deckRow: { flexDirection: 'row', gap: spacing.lg, alignItems: 'stretch' },
  stack: { gap: spacing.lg },
  // The panel carrying the most numbers gets the wider column.
  wide: { flex: 1.35 },
  narrow: { flex: 1 },
  panel: { flex: 1, gap: spacing.md },
  panelHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
});
