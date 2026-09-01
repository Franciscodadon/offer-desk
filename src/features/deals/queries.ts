/**
 * React Query hooks for deals.
 *
 * Mutations update the cache optimistically. That is not a nicety here: PRD
 * principle 1 puts this app in a driveway on a phone, where a status change
 * that waits on a round trip feels broken and a dropped connection must not
 * lose the edit. On failure the previous cache is restored and the error
 * surfaces; on success the server row replaces the optimistic one.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Deal, DealWithRelations } from '@/domain/types';
import type { Inserts, Updates } from '@/lib/database.types';
import { queryKeys } from '@/lib/query';

import {
  createContact,
  createDeal,
  deleteDeal,
  getDeal,
  listContacts,
  listDeals,
  logActivity,
  saveProperty,
  updateContact,
  updateDeal,
} from './api';

export function useDeals(orgId: string | null) {
  return useQuery({
    queryKey: queryKeys.deals(orgId ?? 'none'),
    queryFn: () => listDeals(orgId as string),
    enabled: orgId != null,
  });
}

export function useDeal(dealId: string | null) {
  return useQuery({
    queryKey: queryKeys.deal(dealId ?? 'none'),
    queryFn: () => getDeal(dealId as string),
    enabled: dealId != null,
  });
}

export function useContacts(orgId: string | null) {
  return useQuery({
    queryKey: queryKeys.contacts(orgId ?? 'none'),
    queryFn: () => listContacts(orgId as string),
    enabled: orgId != null,
  });
}

export function useCreateDeal(orgId: string | null) {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (input: Omit<Inserts<'deals'>, 'org_id'>) =>
      createDeal({ ...input, org_id: orgId as string }),
    onSuccess: (deal) => {
      client.setQueryData<Deal[]>(queryKeys.deals(orgId ?? 'none'), (previous) =>
        previous ? [deal, ...previous] : [deal],
      );
      void logActivity({
        org_id: deal.org_id,
        deal_id: deal.id,
        type: 'deal_created',
        payload: { address: deal.address },
      });
    },
  });
}

type UpdateArgs = { dealId: string; patch: Updates<'deals'> };

export function useUpdateDeal(orgId: string | null) {
  const client = useQueryClient();
  const listKey = queryKeys.deals(orgId ?? 'none');

  return useMutation({
    mutationFn: ({ dealId, patch }: UpdateArgs) => updateDeal(dealId, patch),

    async onMutate({ dealId, patch }) {
      // Stop in-flight refetches from overwriting the optimistic value.
      await client.cancelQueries({ queryKey: listKey });
      await client.cancelQueries({ queryKey: queryKeys.deal(dealId) });

      const previousList = client.getQueryData<Deal[]>(listKey);
      const previousDeal = client.getQueryData<DealWithRelations | null>(
        queryKeys.deal(dealId),
      );

      client.setQueryData<Deal[]>(listKey, (deals) =>
        deals?.map((deal) => (deal.id === dealId ? { ...deal, ...patch } : deal)),
      );
      client.setQueryData<DealWithRelations | null>(queryKeys.deal(dealId), (deal) =>
        deal ? { ...deal, ...patch } : deal,
      );

      return { previousList, previousDeal };
    },

    onError(_error, { dealId }, context) {
      // Put the cache back exactly as it was, so a failed write never leaves a
      // value on screen that is not in the database.
      if (context?.previousList) client.setQueryData(listKey, context.previousList);
      if (context?.previousDeal !== undefined) {
        client.setQueryData(queryKeys.deal(dealId), context.previousDeal);
      }
    },

    onSuccess(deal, { patch }) {
      client.setQueryData<Deal[]>(listKey, (deals) =>
        deals?.map((row) => (row.id === deal.id ? deal : row)),
      );
      client.setQueryData<DealWithRelations | null>(queryKeys.deal(deal.id), (current) =>
        current ? { ...current, ...deal } : current,
      );

      if (patch.status) {
        void logActivity({
          org_id: deal.org_id,
          deal_id: deal.id,
          type: 'status_changed',
          payload: { status: patch.status },
        });
      }
    },
  });
}

export function useDeleteDeal(orgId: string | null) {
  const client = useQueryClient();
  const listKey = queryKeys.deals(orgId ?? 'none');

  return useMutation({
    mutationFn: (dealId: string) => deleteDeal(dealId),

    async onMutate(dealId) {
      await client.cancelQueries({ queryKey: listKey });
      const previousList = client.getQueryData<Deal[]>(listKey);
      client.setQueryData<Deal[]>(listKey, (deals) =>
        deals?.filter((deal) => deal.id !== dealId),
      );
      return { previousList };
    },

    onError(_error, _dealId, context) {
      if (context?.previousList) client.setQueryData(listKey, context.previousList);
    },
  });
}

export function useSaveProperty(orgId: string | null) {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (input: Omit<Inserts<'properties'>, 'org_id'>) =>
      saveProperty({ ...input, org_id: orgId as string }),
    onSuccess: (property) => {
      client.setQueryData<DealWithRelations | null>(
        queryKeys.deal(property.deal_id),
        (deal) => (deal ? { ...deal, property } : deal),
      );
    },
  });
}

export function useCreateContact(orgId: string | null) {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (input: Omit<Inserts<'contacts'>, 'org_id'>) =>
      createContact({ ...input, org_id: orgId as string }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.contacts(orgId ?? 'none') });
    },
  });
}

export function useUpdateContact(orgId: string | null) {
  const client = useQueryClient();

  return useMutation({
    mutationFn: ({ contactId, patch }: { contactId: string; patch: Updates<'contacts'> }) =>
      updateContact(contactId, patch),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.contacts(orgId ?? 'none') });
    },
  });
}
