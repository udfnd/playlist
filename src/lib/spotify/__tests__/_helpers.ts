// @MX:SPEC: SPEC-SPOTIFY-001
// Test-only helpers for Spotify unit tests. Provides:
//   - makeSupabaseStub(rows): chainable Supabase mock that records upsert /
//     update / delete calls
//   - stubFetchSequence(responses): deterministic `fetch` mock
//   - mockAuth(session): placeholder for route-handler tests (T-004+)
// Keep in sync with `src/lib/supabase/admin.ts` call patterns used by
// client.ts / fetch-playlist.ts.

import { vi } from 'vitest';

export interface SupabaseCall {
  op: 'select' | 'upsert' | 'update' | 'delete' | 'eq' | 'single' | 'maybeSingle' | 'from';
  args: unknown[];
}

export interface SupabaseStub {
  client: {
    from: (table: string) => ChainableQuery;
  };
  calls: SupabaseCall[];
  // Mutable row the stub pretends lives in music_connections. Tests can swap
  // it between refresh attempts to simulate DB state changes.
  row: Record<string, unknown> | null;
}

interface ChainableQuery {
  select: (...args: unknown[]) => ChainableQuery;
  upsert: (...args: unknown[]) => ChainableQuery;
  update: (...args: unknown[]) => ChainableQuery;
  delete: (...args: unknown[]) => ChainableQuery;
  eq: (...args: unknown[]) => ChainableQuery;
  single: () => Promise<{ data: unknown; error: null }>;
  maybeSingle: () => Promise<{ data: unknown; error: null }>;
  then: (...args: unknown[]) => Promise<{ data: null; error: null }>;
}

/**
 * Build a chainable Supabase stub seeded with a single `music_connections`
 * row. The stub records every call so tests can assert on it via `calls`.
 */
export function makeSupabaseStub(row: Record<string, unknown> | null): SupabaseStub {
  const state: SupabaseStub = {
    calls: [],
    row,
    client: { from: () => null as unknown as ChainableQuery },
  };

  const record = (op: SupabaseCall['op'], args: unknown[]) => {
    state.calls.push({ op, args });
  };

  const build = (): ChainableQuery => {
    const chain: ChainableQuery = {
      select: (...args) => {
        record('select', args);
        return chain;
      },
      upsert: (...args) => {
        record('upsert', args);
        const next = args[0] as Record<string, unknown>;
        state.row = { ...(state.row ?? {}), ...next };
        return chain;
      },
      update: (...args) => {
        record('update', args);
        const next = args[0] as Record<string, unknown>;
        state.row = { ...(state.row ?? {}), ...next };
        return chain;
      },
      delete: (...args) => {
        record('delete', args);
        state.row = null;
        return chain;
      },
      eq: (...args) => {
        record('eq', args);
        return chain;
      },
      single: async () => ({ data: state.row, error: null }),
      maybeSingle: async () => ({ data: state.row, error: null }),
      // eq()/update() chains are awaited directly in some callsites; make
      // the chain thenable so `await supabase.from(x).update(y).eq(...)` works.
      then: (...args) => Promise.resolve({ data: null, error: null }).then(...(args as [never])),
    };
    return chain;
  };

  state.client = {
    from: (table: string) => {
      record('from', [table]);
      return build();
    },
  };
  return state;
}

/**
 * Pop-front `fetch` mock: each call returns the next entry. A response entry
 * can be either a `Response` or a factory returning one (useful for timing
 * assertions tied to vi.useFakeTimers()).
 */
export function stubFetchSequence(
  responses: Array<Response | (() => Response | Promise<Response>)>,
) {
  const queue = [...responses];
  const fn = vi.fn(
    async (_url: string | URL | Request, _init?: RequestInit): Promise<Response> => {
      void _url;
      void _init;
      const next = queue.shift();
      if (!next) throw new Error('stubFetchSequence: no more responses queued');
      return typeof next === 'function' ? await next() : next;
    },
  );
  vi.stubGlobal('fetch', fn);
  return fn;
}

export function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });
}
