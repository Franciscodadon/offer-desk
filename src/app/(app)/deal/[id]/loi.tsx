/**
 * LOI generator - PRD 7.4, and the share-sheet half of 7.5.
 *
 * The screen exists to get a correct letter out fast, so it opens with terms
 * already filled from the deal and the org's defaults, and the only decisions
 * left are the ones that actually vary. Anything the letter needs and does not
 * have is named before the send button, not after.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Linking, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { Button, Card, Chip, Screen, Text, TextField } from '@/components/ui';
import { readDefaultTerms } from '@/domain/types';
import { useAuth } from '@/features/auth/AuthProvider';
import { useDeal, useUpdateDeal } from '@/features/deals/queries';
import { buildLoiDocument } from '@/features/loi/document';
import {
  canAttachFiles,
  generatePdf,
  mailtoUrl,
  sendViaMail,
  shareFile,
  type GeneratedFile,
} from '@/features/loi/generate';
import { renderTemplate, type LoiTerms, type MergeContext } from '@/features/loi/mergeFields';
import {
  describeVariant,
  EMAIL_BODY_TEMPLATE,
  EMAIL_SUBJECT_TEMPLATE,
  suggestVariant,
  templateFor,
  type LoiOccupancy,
  type LoiPricing,
} from '@/features/loi/templates';
import { parseNumericInput, toDateOnly } from '@/lib/format';
import { spacing } from '@/theme/tokens';

export default function LoiScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { orgId, org } = useAuth();

  const dealQuery = useDeal(id ?? null);
  const updateDeal = useUpdateDeal(orgId);
  const deal = dealQuery.data;

  const defaults = readDefaultTerms(org);

  const [occupancy, setOccupancy] = useState<LoiOccupancy | null>(null);
  const [pricing, setPricing] = useState<LoiPricing | null>(null);
  const [terms, setTerms] = useState<LoiTerms>({
    purchasePrice: null,
    earnestMoney: defaults.emd ?? 1000,
    inspectionDays: defaults.inspectionDays ?? 10,
    closeDays: defaults.closeDays ?? 21,
    additionalTerms: '',
    letterDate: toDateOnly(),
    offerValidDays: 5,
  });
  const [seeded, setSeeded] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<GeneratedFile | null>(null);

  // Seed the offer price from the deal once it has loaded, without writing
  // state during render.
  if (deal && !seeded) {
    setSeeded(true);
    if (deal.offer_price != null) {
      setTerms((previous) => ({ ...previous, purchasePrice: deal.offer_price }));
    }
  }

  const variant = useMemo(() => {
    const suggested = suggestVariant(
      deal?.property?.is_vacant ?? null,
      terms.purchasePrice != null,
    );
    return {
      occupancy: occupancy ?? suggested.occupancy,
      pricing: pricing ?? suggested.pricing,
    };
  }, [deal?.property?.is_vacant, occupancy, pricing, terms.purchasePrice]);

  const context = useMemo<MergeContext | null>(() => {
    if (!deal || !org) return null;
    return {
      org,
      deal,
      property: deal.property,
      agent: deal.agent,
      terms,
    };
  }, [deal, org, terms]);

  const document = useMemo(
    () => (context ? buildLoiDocument(templateFor(variant), context) : null),
    [context, variant],
  );

  if (!deal || !document || !context) {
    return (
      <Screen>
        <Text variant="body" tone="muted">
          {dealQuery.isLoading ? 'Loading...' : 'Deal not found.'}
        </Text>
      </Screen>
    );
  }

  const blockers = document.missing.filter((field) => field.required);
  const optionalGaps = document.missing.filter((field) => !field.required);
  const agentEmail = deal.agent?.email ?? null;

  function setTerm<K extends keyof LoiTerms>(key: K, value: LoiTerms[K]) {
    setTerms((previous) => ({ ...previous, [key]: value }));
    setFile(null);
    setStatus(null);
  }

  async function withBusy(label: string, work: () => Promise<void>) {
    setBusy(label);
    setError(null);
    try {
      await work();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Something went wrong.');
    } finally {
      setBusy(null);
    }
  }

  const handleGenerate = () =>
    withBusy('generate', async () => {
      const generated = await generatePdf(document);
      setFile(generated);
      setStatus(
        generated
          ? 'PDF ready.'
          : 'Opened your print dialog. Choose Save as PDF to keep a copy.',
      );
    });

  const handleShare = () =>
    withBusy('share', async () => {
      const generated = file ?? (await generatePdf(document));
      if (!generated) {
        setStatus('Use the print dialog to save the PDF on web.');
        return;
      }
      setFile(generated);
      await shareFile(generated);
    });

  /** Marks the deal LOI Sent, dated today (PRD 7.5). */
  async function markSent() {
    await updateDeal.mutateAsync({
      dealId: deal!.id,
      patch: { status: 'loi_sent', submitted_at: toDateOnly() },
    });
  }

  const handleEmail = () =>
    withBusy('email', async () => {
      const subject = renderTemplate(EMAIL_SUBJECT_TEMPLATE, context!).text;
      const body = renderTemplate(EMAIL_BODY_TEMPLATE, context!).text;
      const to = agentEmail ? [agentEmail] : [];

      if (!canAttachFiles) {
        await Linking.openURL(mailtoUrl({ to, subject, body }));
        setStatus(
          'Opened your mail client. Attach the PDF you saved: a mailto: link cannot carry one.',
        );
        return;
      }

      const generated = file ?? (await generatePdf(document));
      if (generated) setFile(generated);

      const outcome = await sendViaMail({
        to,
        subject,
        body,
        attachments: generated ? [generated.uri] : [],
      });

      if (outcome === 'sent') {
        await markSent();
        setStatus('Sent. This deal is now LOI Sent, dated today.');
      } else if (outcome === 'saved') {
        setStatus('Saved as a draft in your mail app.');
      } else if (outcome === 'unavailable') {
        await Linking.openURL(mailtoUrl({ to, subject, body }));
        setStatus('No mail app is set up, so this opened your default mail handler.');
      } else {
        setStatus('Cancelled. Nothing was sent and the deal was not changed.');
      }
    });

  return (
    <Screen>
      <View style={styles.header}>
        <Text variant="title">Letter of intent</Text>
        <Text variant="body" tone="muted">
          {deal.address}
        </Text>
      </View>

      <Card>
        <Text variant="label" tone="muted">
          Letter type
        </Text>
        <View style={styles.chipRow}>
          <Chip
            label="Vacant"
            selected={variant.occupancy === 'vacant'}
            onPress={() => setOccupancy('vacant')}
          />
          <Chip
            label="Occupied"
            selected={variant.occupancy === 'occupied'}
            onPress={() => setOccupancy('occupied')}
          />
        </View>
        <View style={styles.chipRow}>
          <Chip
            label="Priced offer"
            selected={variant.pricing === 'priced'}
            onPress={() => setPricing('priced')}
          />
          <Chip
            label="Preliminary"
            selected={variant.pricing === 'preliminary'}
            onPress={() => setPricing('preliminary')}
          />
        </View>
        <Text variant="caption" tone="subtle">
          {describeVariant(variant)}
        </Text>
      </Card>

      <Card>
        <Text variant="label" tone="muted">
          Terms
        </Text>
        <View style={styles.row}>
          <NumberField
            label="Purchase price"
            value={terms.purchasePrice}
            onChange={(value) => setTerm('purchasePrice', value)}
          />
          <NumberField
            label="Earnest money"
            value={terms.earnestMoney}
            onChange={(value) => setTerm('earnestMoney', value)}
          />
        </View>
        <View style={styles.row}>
          <NumberField
            label="Inspection days"
            value={terms.inspectionDays}
            onChange={(value) => setTerm('inspectionDays', value)}
          />
          <NumberField
            label="Days to close"
            value={terms.closeDays}
            onChange={(value) => setTerm('closeDays', value)}
          />
        </View>
        <TextField
          label="Letter date"
          value={terms.letterDate}
          onChangeText={(text) => setTerm('letterDate', text)}
          placeholder="YYYY-MM-DD"
          numeric
        />
      </Card>

      {blockers.length > 0 ? (
        <Card>
          <Text variant="bodyStrong" tone="negative">
            Not ready to send
          </Text>
          <Text variant="body" tone="muted">
            The letter needs these before it goes out:
          </Text>
          {blockers.map((field) => (
            <Text key={field.key} variant="body" tone="negative">
              {field.label}
            </Text>
          ))}
          {blockers.some((f) => f.key === 'signatory_name' || f.key === 'buyer_entity') ? (
            <Text variant="caption" tone="subtle">
              Signatory and buyer entity come from your workspace. Set them in
              Settings once and every future letter has them.
            </Text>
          ) : null}
        </Card>
      ) : null}

      {optionalGaps.length > 0 ? (
        <Card>
          <Text variant="label" tone="muted">
            Left out
          </Text>
          <Text variant="caption" tone="subtle">
            {optionalGaps.map((field) => field.label).join(', ')}. The letter reads
            correctly without them.
          </Text>
        </Card>
      ) : null}

      <Card>
        <Text variant="label" tone="muted">
          Preview
        </Text>
        <ScrollView style={styles.preview} nestedScrollEnabled>
          <Text variant="body">{document.text}</Text>
        </ScrollView>
      </Card>

      <Button
        label={Platform.OS === 'web' ? 'Print or save as PDF' : 'Generate PDF'}
        onPress={handleGenerate}
        loading={busy === 'generate'}
        disabled={blockers.length > 0}
      />
      {canAttachFiles ? (
        <Button
          label="Share PDF"
          variant="secondary"
          onPress={handleShare}
          loading={busy === 'share'}
          disabled={blockers.length > 0}
        />
      ) : null}
      <Button
        label={agentEmail ? `Email to ${agentEmail}` : 'Email LOI'}
        variant="secondary"
        onPress={handleEmail}
        loading={busy === 'email'}
        disabled={blockers.length > 0}
      />

      {status ? (
        <Text variant="body" tone="accent">
          {status}
        </Text>
      ) : null}
      {error ? (
        <Text variant="body" tone="negative">
          {error}
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

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <View style={styles.grow}>
      <TextField
        label={label}
        value={draft ?? (value == null ? '' : String(value))}
        onChangeText={(text) => {
          setDraft(text);
          onChange(parseNumericInput(text));
        }}
        onBlur={() => setDraft(null)}
        keyboardType="numeric"
        numeric
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.xs },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' },
  grow: { flexGrow: 1, flexBasis: 140 },
  preview: { maxHeight: 320 },
});
