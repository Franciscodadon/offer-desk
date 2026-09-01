/**
 * Loading and saving analyses. One row per (deal, strategy), enforced by a
 * unique constraint, so saving is an upsert on that pair rather than a
 * create-or-update dance in application code.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { AnalysisStrategy } from '@/domain/analyzer';
import type { Analysis } from '@/domain/types';
import type { Json } from '@/lib/database.types';
import { queryKeys } from '@/lib/query';
import { requireSupabase } from '@/lib/supabase';

export async function listAnalyses(dealId: string): Promise<Analysis[]> {
  const { data, error } = await requireSupabase()
    .from('analyses')
    .select('*')
    .eq('deal_id', dealId)
    .is('deleted_at', null);

  if (error) throw error;
  return data ?? [];
}

export type SaveAnalysisInput = {
  strategy: AnalysisStrategy;
  arv: number | null;
  repairs: number | null;
  mao_pct: number | null;
  purchase: number | null;
  target_profit: number | null;
  inputs: Json;
  computed: Json;
};

export function useAnalyses(dealId: string | null) {
  return useQuery({
    queryKey: queryKeys.analyses(dealId ?? 'none'),
    queryFn: () => listAnalyses(dealId as string),
    enabled: dealId != null,
  });
}

export function useSaveAnalysis(orgId: string | null, dealId: string) {
  const client = useQueryClient();
  const key = queryKeys.analyses(dealId);

  return useMutation({
    mutationFn: async (input: SaveAnalysisInput) => {
      const { data, error } = await requireSupabase()
        .from('analyses')
        .upsert(
          { ...input, org_id: orgId as string, deal_id: dealId },
          { onConflict: 'deal_id,strategy' },
        )
        .select('*')
        .single();

      if (error) throw error;
      return data;
    },

    onSuccess(saved) {
      client.setQueryData<Analysis[]>(key, (analyses) => {
        if (!analyses) return [saved];
        const index = analyses.findIndex((row) => row.strategy === saved.strategy);
        if (index === -1) return [...analyses, saved];
        const next = [...analyses];
        next[index] = saved;
        return next;
      });
      // The deal detail screen embeds analyses, so it has to see the new one.
      void client.invalidateQueries({ queryKey: queryKeys.deal(dealId) });
    },
  });
}
