import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Comp } from '@/domain/types';
import type { Inserts, Updates } from '@/lib/database.types';
import { queryKeys } from '@/lib/query';

import { createComp, deleteComp, listComps, updateComp } from './api';

export function useComps(dealId: string | null) {
  return useQuery({
    queryKey: queryKeys.comps(dealId ?? 'none'),
    queryFn: () => listComps(dealId as string),
    enabled: dealId != null,
  });
}

export function useCreateComp(orgId: string | null, dealId: string) {
  const client = useQueryClient();
  const key = queryKeys.comps(dealId);

  return useMutation({
    mutationFn: (input: Omit<Inserts<'comps'>, 'org_id' | 'deal_id'>) =>
      createComp({ ...input, org_id: orgId as string, deal_id: dealId }),
    onSuccess: (comp) => {
      client.setQueryData<Comp[]>(key, (comps) => (comps ? [...comps, comp] : [comp]));
    },
  });
}

export function useUpdateComp(dealId: string) {
  const client = useQueryClient();
  const key = queryKeys.comps(dealId);

  return useMutation({
    mutationFn: ({ compId, patch }: { compId: string; patch: Updates<'comps'> }) =>
      updateComp(compId, patch),

    async onMutate({ compId, patch }) {
      // Comps are edited cell by cell while reading a listing, so the value
      // has to stay put the instant it is typed.
      await client.cancelQueries({ queryKey: key });
      const previous = client.getQueryData<Comp[]>(key);
      client.setQueryData<Comp[]>(key, (comps) =>
        comps?.map((comp) => (comp.id === compId ? { ...comp, ...patch } : comp)),
      );
      return { previous };
    },

    onError(_error, _args, context) {
      if (context?.previous) client.setQueryData(key, context.previous);
    },

    onSuccess(comp) {
      client.setQueryData<Comp[]>(key, (comps) =>
        comps?.map((row) => (row.id === comp.id ? comp : row)),
      );
    },
  });
}

export function useDeleteComp(dealId: string) {
  const client = useQueryClient();
  const key = queryKeys.comps(dealId);

  return useMutation({
    mutationFn: (compId: string) => deleteComp(compId),

    async onMutate(compId) {
      await client.cancelQueries({ queryKey: key });
      const previous = client.getQueryData<Comp[]>(key);
      client.setQueryData<Comp[]>(key, (comps) => comps?.filter((comp) => comp.id !== compId));
      return { previous };
    },

    onError(_error, _compId, context) {
      if (context?.previous) client.setQueryData(key, context.previous);
    },
  });
}
