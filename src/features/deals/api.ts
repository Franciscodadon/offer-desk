/**
 * Deal data access. Every function here is a thin, typed wrapper over Supabase;
 * caching, retries, and optimistic updates belong to the hooks in queries.ts.
 *
 * Two rules hold throughout:
 *   - Soft-deleted rows are filtered on read. Nothing hard-deletes, so a
 *     mis-tap is always recoverable from the database.
 *   - org_id is written explicitly on insert even though RLS also enforces it,
 *     because the WITH CHECK policy rejects the row otherwise.
 */
import type { Contact, Deal, DealWithRelations, Property } from '@/domain/types';
import type { Inserts, Updates } from '@/lib/database.types';
import { requireSupabase } from '@/lib/supabase';

/** Rows are ordered newest-submitted first, with unsubmitted deals on top. */
export async function listDeals(orgId: string): Promise<Deal[]> {
  const { data, error } = await requireSupabase()
    .from('deals')
    .select('*')
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .order('submitted_at', { ascending: false, nullsFirst: true })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getDeal(dealId: string): Promise<DealWithRelations | null> {
  const supabase = requireSupabase();

  const { data: deal, error } = await supabase
    .from('deals')
    .select('*')
    .eq('id', dealId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) throw error;
  if (!deal) return null;

  // Fetched in parallel rather than as one embedded select: the related rows
  // are independent, and separate queries keep the RLS story simple to reason
  // about per table.
  const [property, agent, comps, analyses] = await Promise.all([
    supabase
      .from('properties')
      .select('*')
      .eq('deal_id', dealId)
      .is('deleted_at', null)
      .maybeSingle()
      .then(({ data }) => data),
    deal.agent_id
      ? supabase
          .from('contacts')
          .select('*')
          .eq('id', deal.agent_id)
          .is('deleted_at', null)
          .maybeSingle()
          .then(({ data }) => data)
      : Promise.resolve(null),
    supabase
      .from('comps')
      .select('*')
      .eq('deal_id', dealId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .then(({ data }) => data ?? []),
    supabase
      .from('analyses')
      .select('*')
      .eq('deal_id', dealId)
      .is('deleted_at', null)
      .then(({ data }) => data ?? []),
  ]);

  return { ...deal, property: property ?? null, agent: agent ?? null, comps, analyses };
}

export async function createDeal(input: Inserts<'deals'>): Promise<Deal> {
  const { data, error } = await requireSupabase()
    .from('deals')
    .insert(input)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function updateDeal(dealId: string, patch: Updates<'deals'>): Promise<Deal> {
  const { data, error } = await requireSupabase()
    .from('deals')
    .update(patch)
    .eq('id', dealId)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

/** Soft delete. The row stays for the audit trail and can be restored. */
export async function deleteDeal(dealId: string): Promise<void> {
  const { error } = await requireSupabase()
    .from('deals')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', dealId);

  if (error) throw error;
}

/**
 * Writes the 1:1 property row for a deal, creating it on first save.
 * `deal_id` is unique, so this is an upsert on that column.
 */
export async function saveProperty(
  input: Inserts<'properties'>,
): Promise<Property> {
  const { data, error } = await requireSupabase()
    .from('properties')
    .upsert(input, { onConflict: 'deal_id' })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function listContacts(orgId: string): Promise<Contact[]> {
  const { data, error } = await requireSupabase()
    .from('contacts')
    .select('*')
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .order('name', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function createContact(input: Inserts<'contacts'>): Promise<Contact> {
  const { data, error } = await requireSupabase()
    .from('contacts')
    .insert(input)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function updateContact(
  contactId: string,
  patch: Updates<'contacts'>,
): Promise<Contact> {
  const { data, error } = await requireSupabase()
    .from('contacts')
    .update(patch)
    .eq('id', contactId)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

/**
 * Appends to the audit log (PRD 9: activities). Deliberately never throws:
 * failing to write a log line must not fail the action it describes.
 */
export async function logActivity(input: Inserts<'activities'>): Promise<void> {
  try {
    await requireSupabase().from('activities').insert(input);
  } catch {
    // Swallowed on purpose - see above.
  }
}
