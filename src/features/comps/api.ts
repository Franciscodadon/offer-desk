/**
 * Comp data access - PRD 7.7. Comps belong to a deal and are org-scoped like
 * everything else, so RLS keeps one workspace's comps out of another's.
 */
import type { Comp } from '@/domain/types';
import type { Inserts, Updates } from '@/lib/database.types';
import { requireSupabase } from '@/lib/supabase';

export async function listComps(dealId: string): Promise<Comp[]> {
  const { data, error } = await requireSupabase()
    .from('comps')
    .select('*')
    .eq('deal_id', dealId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function createComp(input: Inserts<'comps'>): Promise<Comp> {
  const { data, error } = await requireSupabase()
    .from('comps')
    .insert(input)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function updateComp(compId: string, patch: Updates<'comps'>): Promise<Comp> {
  const { data, error } = await requireSupabase()
    .from('comps')
    .update(patch)
    .eq('id', compId)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

/** Soft delete, consistent with deals: a mis-tap is always recoverable. */
export async function deleteComp(compId: string): Promise<void> {
  const { error } = await requireSupabase()
    .from('comps')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', compId);

  if (error) throw error;
}
