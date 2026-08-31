/**
 * TanStack Query client with on-device persistence.
 *
 * This is the offline layer required by PRD 5.3 and 12: reads come from the
 * cache instantly and keep working with no connection, and writes are retried
 * when the device comes back online. Deal records are small, so a single
 * AsyncStorage-backed cache is enough at this stage; if the pipeline ever grows
 * past a few thousand rows, swap the persister for SQLite without touching
 * calling code.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient } from '@tanstack/react-query';

/** Cached data stays usable for a week offline before it is discarded. */
const MAX_CACHE_AGE_MS = 1000 * 60 * 60 * 24 * 7;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Serve cached data immediately, then refresh in the background.
      staleTime: 1000 * 30,
      gcTime: MAX_CACHE_AGE_MS,
      retry: 2,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 3,
    },
  },
});

export const queryPersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'offerdesk.query-cache',
  throttleTime: 1000,
});

export const persistOptions = {
  persister: queryPersister,
  maxAge: MAX_CACHE_AGE_MS,
  // Bump when a cached shape changes so stale entries are dropped rather than
  // deserialized into the wrong type.
  buster: 'v1',
};

/** Query keys. Centralized so cache invalidation cannot drift from reads. */
export const queryKeys = {
  session: ['session'] as const,
  org: (orgId: string) => ['org', orgId] as const,
  profile: (userId: string) => ['profile', userId] as const,
  deals: (orgId: string) => ['deals', orgId] as const,
  deal: (dealId: string) => ['deal', dealId] as const,
  comps: (dealId: string) => ['comps', dealId] as const,
  analyses: (dealId: string) => ['analyses', dealId] as const,
  contacts: (orgId: string) => ['contacts', orgId] as const,
  activities: (dealId: string) => ['activities', dealId] as const,
};
