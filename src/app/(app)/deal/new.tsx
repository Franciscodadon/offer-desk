/**
 * Log a new deal - PRD flow A.
 *
 * The agent, property, and deal rows are written in that order because a deal
 * references its agent. If the agent write fails the deal is still created
 * without one, since losing the whole capture over a contact detail would be
 * the worse outcome in a driveway.
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Screen, Text } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { DealForm, type DealFormPayload } from '@/features/deals/DealForm';
import { useCreateContact, useCreateDeal, useSaveProperty } from '@/features/deals/queries';
import { spacing } from '@/theme/tokens';

export default function NewDealScreen() {
  const router = useRouter();
  const { orgId } = useAuth();

  const createDeal = useCreateDeal(orgId);
  const createContact = useCreateContact(orgId);
  const saveProperty = useSaveProperty(orgId);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(payload: DealFormPayload) {
    setSubmitting(true);
    setError(null);

    try {
      let agentId: string | null = null;
      if (payload.agent) {
        try {
          const agent = await createContact.mutateAsync({
            ...payload.agent,
            type: 'listing_agent',
          });
          agentId = agent.id;
        } catch {
          // Keep going: the deal matters more than the contact record, and the
          // agent can be added from the deal later.
        }
      }

      const deal = await createDeal.mutateAsync({ ...payload.deal, agent_id: agentId });

      if (payload.property) {
        await saveProperty.mutateAsync({ ...payload.property, deal_id: deal.id });
      }

      router.replace(`/deal/${deal.id}`);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Could not save this deal. Check your connection and try again.',
      );
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text variant="title">New deal</Text>
        <Text variant="body" tone="muted">
          Address is the only thing required. Everything else can come later.
        </Text>
      </View>

      <DealForm
        submitLabel="Save deal"
        submitting={submitting}
        error={error}
        onSubmit={handleSubmit}
        onCancel={() => router.back()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.xs },
});
