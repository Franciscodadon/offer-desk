/**
 * Integration harness: talks to a real PostgREST server sitting on a real
 * Postgres that has the real migrations applied.
 *
 * This is the one layer unit tests cannot reach. Everything else in the suite
 * mocks the database away, which means it can prove the app's logic is right
 * but not that a policy, a grant, or a column name actually lets the app read
 * and write. That gap is where multi-tenant bugs live, so it is worth closing
 * against something real rather than a stub.
 *
 * Run `scripts/integration-up.sh` first; see that script for what it starts.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createHmac } from 'node:crypto';
import http from 'node:http';
import type { AddressInfo } from 'node:net';

import type { Database } from '@/lib/database.types';

/** Matches the jwt-secret the local PostgREST is configured with. */
export const JWT_SECRET =
  process.env.INTEGRATION_JWT_SECRET ??
  'super-secret-jwt-token-with-at-least-32-characters-long';

export const POSTGREST_PORT = Number(process.env.INTEGRATION_POSTGREST_PORT ?? 3999);

const base64url = (input: Buffer | string): string =>
  Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

/**
 * Mints the same shape of token Supabase Auth issues, so the policies see the
 * claims they would see in production. Signing locally rather than running
 * GoTrue keeps the harness small; what is under test is the database's
 * behaviour given a token, not the issuing of one.
 */
export function mintToken(userId: string, role = 'authenticated'): string {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64url(
    JSON.stringify({
      sub: userId,
      role,
      aud: 'authenticated',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  );
  const signature = base64url(
    createHmac('sha256', JWT_SECRET).update(`${header}.${payload}`).digest(),
  );
  return `${header}.${payload}.${signature}`;
}

/**
 * supabase-js addresses PostgREST under /rest/v1; a bare PostgREST serves at
 * the root. Hosted Supabase puts Kong in between to do exactly this rewrite,
 * so this stands in for Kong and keeps the client code under test unmodified.
 */
export async function startGateway(): Promise<{ url: string; close: () => Promise<void> }> {
  const server = http.createServer((req, res) => {
    const path = (req.url ?? '/').replace(/^\/rest\/v1/, '') || '/';
    const upstream = http.request(
      {
        host: '127.0.0.1',
        port: POSTGREST_PORT,
        path,
        method: req.method,
        headers: { ...req.headers, host: `127.0.0.1:${POSTGREST_PORT}` },
      },
      (response) => {
        res.writeHead(response.statusCode ?? 500, response.headers);
        response.pipe(res);
      },
    );
    upstream.on('error', () => {
      res.writeHead(502).end('gateway error');
    });
    req.pipe(upstream);
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

/**
 * A client authenticated as one user, for driving the real api layer.
 *
 * The token is passed as the client's key rather than as a global Authorization
 * header: supabase-js derives Authorization from the session or, absent one,
 * from the key, so a header set here is overwritten before the request goes
 * out. Handing it the token as the key is how it ends up on the wire.
 */
export function clientFor(url: string, userId: string): SupabaseClient<Database> {
  const token = mintToken(userId);
  return createClient<Database>(url, token, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: nodeFetch },
  });
}

/**
 * A real HTTP implementation, because jest-expo replaces global `fetch` with a
 * stub that resolves to an empty object. That stub is right for component
 * tests, which should never reach the network, and useless here, where
 * reaching the network is the entire point. supabase-js accepts an injected
 * fetch, so this is handed to it rather than patching the global back.
 *
 * Only the subset supabase-js uses is implemented.
 */
/**
 * Normalizes the several shapes fetch accepts for headers into the plain
 * object node:http wants. supabase-js passes a Headers instance, which casts to
 * an empty object if handled naively - and an empty object here means the
 * bearer token silently never leaves, which reads downstream as a permissions
 * bug rather than as a harness bug.
 */
function toHeaderObject(headers: HeadersInit | undefined): Record<string, string> {
  if (!headers) return {};
  if (Array.isArray(headers)) return Object.fromEntries(headers);
  if (typeof (headers as Headers).forEach === 'function') {
    const out: Record<string, string> = {};
    (headers as Headers).forEach((value, key) => {
      out[key] = value;
    });
    return out;
  }
  return { ...(headers as Record<string, string>) };
}

export const nodeFetch = ((input: string | URL | Request, init?: RequestInit) => {
  const url = new URL(typeof input === 'string' ? input : input.toString());

  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        host: url.hostname,
        port: url.port,
        path: `${url.pathname}${url.search}`,
        method: init?.method ?? 'GET',
        headers: toHeaderObject(init?.headers),
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8');
          const status = response.statusCode ?? 500;
          resolve({
            status,
            ok: status >= 200 && status < 300,
            statusText: response.statusMessage ?? '',
            headers: {
              get: (name: string) => response.headers[name.toLowerCase()] ?? null,
              forEach: () => {},
            },
            text: async () => body,
            json: async () => (body ? JSON.parse(body) : null),
          } as unknown as Response);
        });
      },
    );

    request.on('error', reject);
    if (init?.body) request.write(init.body);
    request.end();
  });
}) as unknown as typeof fetch;

export async function isPostgrestUp(): Promise<boolean> {
  try {
    const response = await nodeFetch(`http://127.0.0.1:${POSTGREST_PORT}/`);
    return response.ok;
  } catch {
    return false;
  }
}
