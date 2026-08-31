/**
 * Environment configuration.
 *
 * Only EXPO_PUBLIC_* variables reach the client bundle, and only the Supabase
 * URL and anon key belong there - both are safe to ship because Row-Level
 * Security is what actually protects the data. Service-role keys, OAuth client
 * secrets, and data-provider keys live in Edge Function secrets and must never
 * appear in this file or anywhere under src/.
 */

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const env = {
  supabaseUrl: url,
  supabaseAnonKey: anonKey,
} as const;

/**
 * True once a Supabase project is wired up. The app runs without one - it shows
 * a setup screen instead of failing to boot - so the scaffold is usable before
 * the project exists.
 */
export const isSupabaseConfigured: boolean =
  url.startsWith('http') && anonKey.length > 20;

export function describeMissingEnv(): string[] {
  const missing: string[] = [];
  if (!url.startsWith('http')) missing.push('EXPO_PUBLIC_SUPABASE_URL');
  if (anonKey.length <= 20) missing.push('EXPO_PUBLIC_SUPABASE_ANON_KEY');
  return missing;
}
