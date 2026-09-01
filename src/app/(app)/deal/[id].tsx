/**
 * Deal detail. Shows the record, allows an inline status change (PRD 7.2), and
 * flips into the same form used to create the deal when editing.
 *
 * Tapping the agent's phone or email opens the dialer or mail client, per the
 * PRD 7.3 acceptance criterion.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Platform, StyleSheet, View } from 'react-native';

import { Button, Card, Chip, Screen, StatusPill, Text } from '@/components/ui';
import { DEAL_STATUSES, DEAL_STATUS_LABELS, statusColors, type DealStatus } from '@/domain/status';
import { offerToList } from '@/domain/types';
import { useAuth } from '@/features/auth/AuthProvider';
import { DealForm, valuesFromDeal, type DealFormPayload } from '@/features/deals/DealForm';
import {
  useCreateContact,
  useDeal,
  useDeleteDeal,
  useSaveProperty,
  useUpdateContact,
  useUpdateDeal,
} from '@/features/deals/queries';
import { EMPTY_VALUE, formatDate, formatMoney, formatNumber, formatPercent } from '@/lib/format';
import { spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

export default function DealDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTheme();
  const { orgId } = useAuth();

  const dealQuery = useDeal(id ?? null);
  const updateDeal = useUpdateDeal(orgId);
  const deleteDeal = useDeleteDeal(orgId);
  const saveProperty = useSaveProperty(orgId);
  const createContact = useCreateContact(orgId);
  const updateContact = useUpdateContact(orgId);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deal = dealQuery.data;

  if (dealQuery.isLoading) {
    return (
      <Screen>
        <Text variant="body" tone="muted">
          Loading deal...
        </Text>
      </Screen>
    );
  }

  if (!deal) {
    return (
      <Screen>
        <Text variant="heading">Deal not found</Text>
        <Text variant="body" tone="muted">
          It may have been deleted, or it belongs to another workspace.
        </Text>
        <Button label="Back to pipeline" onPress={() => router.replace('/pipeline')} />
      </Screen>
    );
  }

  const ratio = offerToList(deal);
  const { property, agent } = deal;

  async function handleSave(payload: DealFormPayload) {
    if (!deal) return;
    setSaving(true);
    setError(null);

    try {
      let agentId = deal.agent_id;

      if (payload.agent) {
        if (agentId) {
          await updateContact.mutateAsync({ contactId: agentId, patch: payload.agent });
        } else {
          const created = await createContact.mutateAsync({
            ...payload.agent,
            type: 'listing_agent',
          });
          agentId = created.id;
        }
      }

      await updateDeal.mutateAsync({
        dealId: deal.id,
        patch: { ...payload.deal, agent_id: agentId },
      });

      if (payload.property) {
        await saveProperty.mutateAsync({ ...payload.property, deal_id: deal.id });
      }

      await dealQuery.refetch();
      setEditing(false);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Could not save. Try again.',
      );
    } finally {
      setSaving(false);
    }
  }

  function changeStatus(status: DealStatus) {
    if (!deal || status === deal.status) return;
    updateDeal.mutate({ dealId: deal.id, patch: { status } });
  }

  function confirmDelete() {
    if (!deal) return;
    const remove = () => {
      deleteDeal.mutate(deal.id, { onSuccess: () => router.replace('/pipeline') });
    };

    // Alert is not implemented on web, so fall back to the browser confirm.
    if (Platform.OS === 'web') {
      if (globalThis.confirm?.('Delete this deal?')) remove();
      return;
    }

    Alert.alert('Delete this deal?', 'It is removed from your pipeline and can be restored by support.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: remove },
    ]);
  }

  if (editing) {
    return (
      <Screen>
        <Text variant="title">Edit deal</Text>
        <DealForm
          initial={valuesFromDeal(deal, property, agent)}
          submitLabel="Save changes"
          submitting={saving}
          error={error}
          onSubmit={handleSave}
          onCancel={() => {
            setEditing(false);
            setError(null);
          }}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text variant="title">{deal.address}</Text>
        {[deal.city, deal.state, deal.zip].filter(Boolean).length > 0 ? (
          <Text variant="body" tone="muted">
            {[deal.city, deal.state].filter(Boolean).join(', ')} {deal.zip ?? ''}
          </Text>
        ) : null}
        <StatusPill status={deal.status} />
      </View>

      <Card>
        <Text variant="label" tone="muted">
          Change status
        </Text>
        <View style={styles.chipRow}>
          {DEAL_STATUSES.map((status) => {
            const colors = statusColors(status, theme);
            return (
              <Chip
                key={status}
                label={DEAL_STATUS_LABELS[status]}
                selected={deal.status === status}
                selectedColor={colors.bg}
                selectedTextColor={colors.fg}
                onPress={() => changeStatus(status)}
              />
            );
          })}
        </View>
      </Card>

      <Card>
        <Text variant="label" tone="muted">
          Numbers
        </Text>
        <Row label="List price" value={formatMoney(deal.list_price)} mono />
        <Row label="Offer price" value={formatMoney(deal.offer_price)} mono />
        <Row label="Offer to list" value={formatPercent(ratio, 1)} mono />
        <Row label="Offer sent" value={formatDate(deal.submitted_at)} />
        <Row label="Next action" value={formatDate(deal.next_action_at)} />
      </Card>

      {property ? (
        <Card>
          <Text variant="label" tone="muted">
            Property
          </Text>
          <Row label="Beds / baths" value={`${formatNumber(property.beds)} / ${formatNumber(property.baths)}`} />
          <Row label="Sqft" value={formatNumber(property.sqft)} mono />
          <Row label="Year built" value={property.year_built ? String(property.year_built) : EMPTY_VALUE} mono />
          {property.listing_url ? (
            <Button
              label="Open listing"
              variant="secondary"
              onPress={() => void Linking.openURL(property.listing_url as string)}
            />
          ) : null}
        </Card>
      ) : null}

      {agent ? (
        <Card>
          <Text variant="label" tone="muted">
            Listing agent
          </Text>
          <Row label="Name" value={agent.name} />
          {agent.brokerage ? <Row label="Brokerage" value={agent.brokerage} /> : null}
          <View style={styles.actions}>
            {agent.phone ? (
              <Button
                label="Call"
                variant="secondary"
                fullWidth={false}
                onPress={() => void Linking.openURL(`tel:${agent.phone}`)}
              />
            ) : null}
            {agent.email ? (
              <Button
                label="Email"
                variant="secondary"
                fullWidth={false}
                onPress={() => void Linking.openURL(`mailto:${agent.email}`)}
              />
            ) : null}
          </View>
        </Card>
      ) : null}

      {deal.notes ? (
        <Card>
          <Text variant="label" tone="muted">
            Notes
          </Text>
          <Text variant="body">{deal.notes}</Text>
        </Card>
      ) : null}

      <Button label="Edit deal" onPress={() => setEditing(true)} />
      <Button label="Back to pipeline" variant="ghost" onPress={() => router.replace('/pipeline')} />
      <Button label="Delete deal" variant="ghost" onPress={confirmDelete} />
    </Screen>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={styles.row}>
      <Text variant="body" tone="muted">
        {label}
      </Text>
      <Text variant={mono ? 'mono' : 'body'} style={styles.rowValue}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  rowValue: { flexShrink: 1, textAlign: 'right' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
});
