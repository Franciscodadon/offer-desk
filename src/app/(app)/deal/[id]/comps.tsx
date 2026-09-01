/**
 * Comps - PRD 7.7.
 *
 *   "Add comp rows: address, beds/baths, sqft, sold price, distance, listing
 *    link. Auto-compute $/sqft per comp and averages. ARV suggestion = comp
 *    average, with an upside note when the subject is larger than comps."
 *
 * Rows save on blur rather than on every keystroke, so typing a price does not
 * fire a write per character; the optimistic cache keeps the value on screen
 * in the meantime.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { Button, Card, Screen, Text, TextField } from '@/components/ui';
import { suggestArv, summarizeComps, type CompInput } from '@/domain/comps';
import { useAuth } from '@/features/auth/AuthProvider';
import { useCreateComp, useDeleteComp, useUpdateComp } from '@/features/comps/queries';
import { useDeal } from '@/features/deals/queries';
import { EMPTY_VALUE, formatMoney, formatMoneyCents, formatNumber, parseNumericInput } from '@/lib/format';
import { spacing } from '@/theme/tokens';

export default function CompsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { orgId } = useAuth();

  const dealQuery = useDeal(id ?? null);
  const createComp = useCreateComp(orgId, id as string);
  const updateComp = useUpdateComp(id as string);
  const deleteComp = useDeleteComp(id as string);

  const deal = dealQuery.data;
  const comps = deal?.comps ?? [];
  const subjectSqft = deal?.property?.sqft ?? null;

  const asInputs: CompInput[] = comps.map((comp) => ({
    id: comp.id,
    address: comp.address,
    sqft: comp.sqft,
    soldPrice: comp.sold_price,
    distanceMi: comp.distance_mi,
  }));

  const summary = summarizeComps(asInputs);
  const suggestion = suggestArv(asInputs, subjectSqft);

  if (!deal) {
    return (
      <Screen>
        <Text variant="body" tone="muted">
          {dealQuery.isLoading ? 'Loading comps...' : 'Deal not found.'}
        </Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text variant="title">Comps</Text>
        <Text variant="body" tone="muted">
          {deal.address}
          {subjectSqft ? ` · subject ${formatNumber(subjectSqft)} sqft` : ''}
        </Text>
      </View>

      <Card>
        <Text variant="label" tone="muted">
          Suggested ARV
        </Text>
        <Text variant="monoLarge">{formatMoney(suggestion.suggested)}</Text>
        <Text variant="caption" tone="subtle">
          {suggestion.basis === 0
            ? 'Add comps to get a suggestion.'
            : `Average of ${suggestion.basis} ${suggestion.basis === 1 ? 'comp' : 'comps'}.`}
        </Text>

        {summary.averagePricePerSqft != null ? (
          <Text variant="body" tone="muted">
            Comp average {formatMoneyCents(summary.averagePricePerSqft)}/sqft
          </Text>
        ) : null}

        {suggestion.upside != null ? (
          <View style={styles.upside}>
            <Text variant="bodyStrong" tone="positive">
              Upside {formatMoney(suggestion.upside)}
            </Text>
            <Text variant="caption" tone="muted">
              The subject is larger than the comps. At the comps&apos; rate per sqft it
              would be worth {formatMoney(suggestion.bySqft)}. Weigh it, do not
              assume it.
            </Text>
          </View>
        ) : null}
      </Card>

      {comps.map((comp) => (
        <CompCard
          key={comp.id}
          address={comp.address}
          beds={comp.beds}
          baths={comp.baths}
          sqft={comp.sqft}
          soldPrice={comp.sold_price}
          distanceMi={comp.distance_mi}
          link={comp.link}
          onChange={(patch) => updateComp.mutate({ compId: comp.id, patch })}
          onDelete={() => deleteComp.mutate(comp.id)}
        />
      ))}

      <Button
        label="Add comp"
        variant="secondary"
        onPress={() => createComp.mutate({ address: 'New comp' })}
        loading={createComp.isPending}
      />

      <Button
        label="Back to deal"
        variant="ghost"
        onPress={() => router.replace(`/deal/${deal.id}`)}
      />
    </Screen>
  );
}

type CompCardProps = {
  address: string;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  soldPrice: number | null;
  distanceMi: number | null;
  link: string | null;
  onChange: (patch: Record<string, unknown>) => void;
  onDelete: () => void;
};

function CompCard(props: CompCardProps) {
  const pricePerSqft =
    props.soldPrice != null && props.sqft != null && props.sqft > 0
      ? props.soldPrice / props.sqft
      : null;

  return (
    <Card>
      <View style={styles.compHeader}>
        <Text variant="label" tone="muted">
          Comp
        </Text>
        <Text variant="mono" tone={pricePerSqft == null ? 'subtle' : 'accent'}>
          {pricePerSqft == null ? EMPTY_VALUE : `${formatMoneyCents(pricePerSqft)}/sqft`}
        </Text>
      </View>

      <DraftField
        label="Address"
        value={props.address}
        onCommit={(text) => props.onChange({ address: text.trim() || 'New comp' })}
      />

      <View style={styles.row}>
        <NumberField
          label="Sold price"
          value={props.soldPrice}
          onCommit={(value) => props.onChange({ sold_price: value })}
        />
        <NumberField
          label="Sqft"
          value={props.sqft}
          onCommit={(value) => props.onChange({ sqft: value })}
        />
      </View>

      <View style={styles.row}>
        <NumberField
          label="Beds"
          value={props.beds}
          onCommit={(value) => props.onChange({ beds: value })}
        />
        <NumberField
          label="Baths"
          value={props.baths}
          onCommit={(value) => props.onChange({ baths: value })}
        />
        <NumberField
          label="Miles away"
          value={props.distanceMi}
          onCommit={(value) => props.onChange({ distance_mi: value })}
        />
      </View>

      <DraftField
        label="Listing link"
        value={props.link ?? ''}
        onCommit={(text) => props.onChange({ link: text.trim() || null })}
        autoCapitalize="none"
        keyboardType="url"
      />

      <View style={styles.compActions}>
        {props.link ? (
          <Button
            label="Open"
            variant="secondary"
            fullWidth={false}
            onPress={() => void Linking.openURL(props.link as string)}
          />
        ) : null}
        <Button label="Remove" variant="ghost" fullWidth={false} onPress={props.onDelete} />
      </View>
    </Card>
  );
}

/**
 * A field that holds its own draft while focused and commits on blur, so a
 * write is not issued per keystroke and the cursor never jumps mid-edit.
 */
function DraftField({
  label,
  value,
  onCommit,
  ...rest
}: {
  label: string;
  value: string;
  onCommit: (text: string) => void;
  autoCapitalize?: 'none' | 'words';
  keyboardType?: 'url' | 'numeric';
}) {
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <TextField
      label={label}
      value={draft ?? value}
      onChangeText={setDraft}
      onBlur={() => {
        if (draft != null && draft !== value) onCommit(draft);
        setDraft(null);
      }}
      {...rest}
    />
  );
}

function NumberField({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: number | null;
  onCommit: (value: number | null) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (value == null ? '' : String(value));

  return (
    <View style={styles.grow}>
      <TextField
        label={label}
        value={shown}
        onChangeText={setDraft}
        onBlur={() => {
          if (draft != null) {
            // parseNumericInput returns null for a blank or partial entry, so
            // clearing a field genuinely clears it rather than writing zero.
            onCommit(parseNumericInput(draft));
          }
          setDraft(null);
        }}
        keyboardType="numeric"
        numeric
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.xs },
  row: { flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' },
  grow: { flexGrow: 1, flexBasis: 100 },
  compHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  compActions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  upside: { gap: spacing.xs },
});
