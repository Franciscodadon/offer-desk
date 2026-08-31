/**
 * Storage adapter for the Supabase auth session.
 *
 * Native uses expo-secure-store (Keychain / Keystore) so refresh tokens are
 * encrypted at rest. SecureStore rejects values over about 2KB and a Supabase
 * session can exceed that, so values are split across numbered chunks and
 * reassembled on read. Web falls back to localStorage, which is what the
 * Supabase JS client uses on the web anyway.
 */
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const CHUNK_SIZE = 1800;
const COUNT_SUFFIX = '__chunks';

/** SecureStore keys allow alphanumerics, `.`, `-`, and `_` only. */
function safeKey(key: string): string {
  return key.replace(/[^A-Za-z0-9._-]/g, '_');
}

const webStorage = {
  getItem(key: string): string | null {
    try {
      return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },
  setItem(key: string, value: string): void {
    try {
      globalThis.localStorage?.setItem(key, value);
    } catch {
      // Private-mode browsers can refuse writes; the session then lasts only
      // for this tab, which is degraded but not broken.
    }
  },
  removeItem(key: string): void {
    try {
      globalThis.localStorage?.removeItem(key);
    } catch {
      // Ignore - see setItem.
    }
  },
};

async function clearChunks(base: string, count: number): Promise<void> {
  const deletions: Promise<void>[] = [];
  for (let i = 0; i < count; i += 1) {
    deletions.push(SecureStore.deleteItemAsync(`${base}.${i}`));
  }
  await Promise.all(deletions);
}

async function readChunkCount(base: string): Promise<number> {
  const raw = await SecureStore.getItemAsync(`${base}${COUNT_SUFFIX}`);
  const count = raw ? Number.parseInt(raw, 10) : 0;
  return Number.isFinite(count) && count > 0 ? count : 0;
}

export const authStorage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') return webStorage.getItem(key);

    const base = safeKey(key);
    const count = await readChunkCount(base);
    if (count === 0) return null;

    const parts = await Promise.all(
      Array.from({ length: count }, (_, i) => SecureStore.getItemAsync(`${base}.${i}`)),
    );
    // A missing chunk means a partial write; treat the whole value as absent
    // rather than handing back a truncated session.
    if (parts.some((part) => part == null)) return null;
    return parts.join('');
  },

  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') return webStorage.setItem(key, value);

    const base = safeKey(key);
    await clearChunks(base, await readChunkCount(base));

    const chunks: string[] = [];
    for (let i = 0; i < value.length; i += CHUNK_SIZE) {
      chunks.push(value.slice(i, i + CHUNK_SIZE));
    }
    await Promise.all(
      chunks.map((chunk, i) => SecureStore.setItemAsync(`${base}.${i}`, chunk)),
    );
    await SecureStore.setItemAsync(`${base}${COUNT_SUFFIX}`, String(chunks.length));
  },

  async removeItem(key: string): Promise<void> {
    if (Platform.OS === 'web') return webStorage.removeItem(key);

    const base = safeKey(key);
    await clearChunks(base, await readChunkCount(base));
    await SecureStore.deleteItemAsync(`${base}${COUNT_SUFFIX}`);
  },
};
