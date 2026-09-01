/**
 * Multi-strategy deal analyzer - PRD 7.6.
 *
 * Four exit strategies over one deal. The screen owns loading, seeding, and
 * saving; the arithmetic lives in `src/domain/analyzer`, which is verified
 * against the PRD's own acceptance case.
 *
 * Each editor is mounted with a key derived from the strategy and the stored
 * row, so switching tabs or loading a saved analysis re-seeds inputs through a
 * remount rather than by writing state during render.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Card, Chip, Screen, Text } from '@/components/ui';
import { suggestArv, type CompInput } from '@/domain/comps';
import type { AnalysisStrategy } from '@/domain/analyzer';
import { readDefaultTerms } from '@/domain/types';
import { useAuth } from '@/features/auth/AuthProvider';
import {
  BrrrrEditor,
  FlipEditor,
  TurnkeyEditor,
  WholesaleEditor,
} from '@/features/analyzer/editors';
import { useAnalyses, useSaveAnalysis } from '@/features/analyzer/queries';
import {
  readBrrrrInputs,
  readFlipInputs,
  readTurnkeyInputs,
  readWholesaleInputs,
  toAnalysisRow,
  type AnalysisSeed,
} from '@/features/analyzer/serialize';
import { useDeal } from '@/features/deals/queries';
import { formatMoney } from '@/lib/format';
import { spacing } from '@/theme/tokens';

const STRATEGIES: { value: AnalysisStrategy; label: string }[] = [
  { value: 'wholesale', label: 'Wholesale' },
  { value: 'flip', label: 'Fix & Flip' },
  { value: 'brrrr', label: 'BRRRR' },
  { value: 'turnkey', label: 'Turnkey' },
];

export default function AnalyzerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { orgId, org } = useAuth();

  const dealQuery = useDeal(id ?? null);
  const analysesQuery = useAnalyses(id ?? null);
  const saveAnalysis = useSaveAnalysis(orgId, id as string);

  const [strategy, setStrategy] = useState<AnalysisStrategy>('flip');
  const [saved, setSaved] = useState<AnalysisStrategy | null>(null);

  // Holds the editor's live state without re-rendering this screen on every
  // keystroke; only the save button reads it.
  const live = useRef<{ inputs: unknown; computed: Record<string, unknown> } | null>(null);

  const handleChange = useCallback(
    (state: { inputs: unknown; computed: Record<string, unknown> }) => {
      live.current = state;
      setSaved(null);
    },
    [],
  );

  const deal = dealQuery.data;

  if (!deal) {
    return (
      <Screen>
        <Text variant="body" tone="muted">
          {dealQuery.isLoading ? 'Loading analyzer...' : 'Deal not found.'}
        </Text>
      </Screen>
    );
  }

  if (analysesQuery.isLoading) {
    return (
      <Screen>
        <Text variant="body" tone="muted">
          Loading saved analyses...
        </Text>
      </Screen>
    );
  }

  const stored = (analysesQuery.data ?? []).find((row) => row.strategy === strategy) ?? null;

  // ARV defaults to the comp average, per PRD 7.6 and 7.7.
  const compInputs: CompInput[] = deal.comps.map((comp) => ({
    id: comp.id,
    address: comp.address,
    sqft: comp.sqft,
    soldPrice: comp.sold_price,
    distanceMi: comp.distance_mi,
  }));
  const suggestion = suggestArv(compInputs, deal.property?.sqft ?? null);

  const seed: AnalysisSeed = {
    arv: suggestion.suggested ?? 0,
    repairs: 0,
    purchase: deal.offer_price ?? deal.list_price ?? 0,
    terms: readDefaultTerms(org),
  };

  // Remounts the editor whenever the strategy or the stored row changes, which
  // is what re-seeds its internal state.
  const editorKey = `${strategy}:${stored?.id ?? 'new'}:${stored?.updated_at ?? ''}`;

  function handleSave() {
    if (!live.current) return;
    const row = toAnalysisRow(
      strategy,
      live.current.inputs as never,
      live.current.computed,
    );
    saveAnalysis.mutate(row, { onSuccess: () => setSaved(strategy) });
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text variant="title">Analyzer</Text>
        <Text variant="body" tone="muted">
          {deal.address}
        </Text>
      </View>

      <View style={styles.chipRow}>
        {STRATEGIES.map((option) => (
          <Chip
            key={option.value}
            label={option.label}
            selected={strategy === option.value}
            onPress={() => setStrategy(option.value)}
          />
        ))}
      </View>

      {suggestion.suggested != null ? (
        <Card>
          <Text variant="label" tone="muted">
            From comps
          </Text>
          <Text variant="body">
            ARV seeded at {formatMoney(suggestion.suggested)} from{' '}
            {suggestion.basis} {suggestion.basis === 1 ? 'comp' : 'comps'}.
          </Text>
          <Button
            label="Edit comps"
            variant="secondary"
            fullWidth={false}
            onPress={() => router.push(`/deal/${deal.id}/comps`)}
          />
        </Card>
      ) : (
        <Card>
          <Text variant="body" tone="muted">
            No comps yet, so ARV starts at zero. Add comps and it will seed itself.
          </Text>
          <Button
            label="Add comps"
            variant="secondary"
            fullWidth={false}
            onPress={() => router.push(`/deal/${deal.id}/comps`)}
          />
        </Card>
      )}

      {strategy === 'wholesale' ? (
        <WholesaleEditor
          key={editorKey}
          initial={readWholesaleInputs(stored, seed)}
          onChange={handleChange}
        />
      ) : null}
      {strategy === 'flip' ? (
        <FlipEditor key={editorKey} initial={readFlipInputs(stored, seed)} onChange={handleChange} />
      ) : null}
      {strategy === 'brrrr' ? (
        <BrrrrEditor key={editorKey} initial={readBrrrrInputs(stored, seed)} onChange={handleChange} />
      ) : null}
      {strategy === 'turnkey' ? (
        <TurnkeyEditor key={editorKey} initial={readTurnkeyInputs(stored, seed)} onChange={handleChange} />
      ) : null}

      <Button
        label={saved === strategy ? 'Saved' : 'Save analysis'}
        onPress={handleSave}
        loading={saveAnalysis.isPending}
        disabled={saved === strategy}
      />
      {saveAnalysis.isError ? (
        <Text variant="caption" tone="negative">
          Could not save. The numbers on screen are still correct; try again when
          you have a connection.
        </Text>
      ) : null}

      <Button
        label="Back to deal"
        variant="ghost"
        onPress={() => router.replace(`/deal/${deal.id}`)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.xs },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
