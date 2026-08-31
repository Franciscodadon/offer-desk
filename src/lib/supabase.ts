/**
 * Supabase client - the single connection the app uses for auth, data, storage,
 * and realtime.
 *
 * The client is created lazily so the app still boots when no project is wired
 * up yet; callers that need it use `requireSupabase()` and are expected to be
 * behind an `isSupabaseConfigured` check.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import 'react-native-url-polyfill/auto';

import type { Database } from './database.types';
import { env, isSupabaseConfigured } from './env';
import { authStorage } from './secureStorage';

export type Client = SupabaseClient<Database>;

let client: Client | null = null;

export function getSupabase(): Client | null {
  if (!isSupabaseConfigured) return null;
  if (client) return client;

  client = createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
    auth: {
      storage: authStorage,
      autoRefreshToken: true,
      persistSession: true,
      // Only the web can read a session out of a redirect URL; on native the
      // OAuth callback is handled explicitly by the deep-link handler.
      detectSessionInUrl: Platform.OS === 'web',
    },
  });

  if (Platform.OS !== 'web') {
    // Supabase refreshes tokens on a timer, which the OS suspends in the
    // background. Tie refreshing to foreground state so a phone that has been
    // in a pocket all afternoon comes back with a live session.
    AppState.addEventListener('change', (state) => {
      if (!client) return;
      if (state === 'active') {
        void client.auth.startAutoRefresh();
      } else {
        void client.auth.stopAutoRefresh();
      }
    });
  }

  return client;
}

export function requireSupabase(): Client {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Copy .env.example to .env.local and set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.',
    );
  }
  return supabase;
}
