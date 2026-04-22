// @MX:SPEC: SPEC-SOCIAL-001
// Chainable Supabase stub for reactions service tests.
//
// Shape:
//   supabase.from('track_reactions')
//     .insert(row)
//     .select('*')
//     .maybeSingle() / .single()
//
//   supabase.from('track_reactions')
//     .select('*').eq(...).eq(...).eq(...).eq(...)
//     .order(...)  // optional
//     .maybeSingle() / then => data array
//
//   supabase.from('track_reactions')
//     .delete().eq(...).eq(...).eq(...)   // resolves to { count }

import { vi } from 'vitest';

export interface Row extends Record<string, unknown> {
  id: string;
}

export interface StubOptions {
  /** Rows currently in the table. */
  rows?: Row[];
  /** Force the next INSERT to conflict (simulate unique violation). */
  insertConflict?: boolean;
}

export interface ReactionStub {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any;
  state: {
    rows: Row[];
    inserts: Row[];
    deletes: number;
    insertConflict: boolean;
  };
}

function matchEqFilters(row: Row, filters: Array<[string, unknown]>): boolean {
  return filters.every(([col, val]) => row[col] === val);
}

export function makeReactionStub(opts: StubOptions = {}): ReactionStub {
  const state = {
    rows: [...(opts.rows ?? [])],
    inserts: [] as Row[],
    deletes: 0,
    insertConflict: Boolean(opts.insertConflict),
  };

  function buildQuery(table: string) {
    void table;
    const filters: Array<[string, unknown]> = [];
    let mode: 'select' | 'insert' | 'delete' = 'select';
    let pendingInsert: Row | null = null;

    const api = {
      select: vi.fn((cols?: string) => {
        void cols;
        return api;
      }),
      insert: vi.fn((row: Row) => {
        mode = 'insert';
        pendingInsert = row;
        return api;
      },
      ),
      delete: vi.fn(() => {
        mode = 'delete';
        return api;
      }),
      eq: vi.fn((col: string, val: unknown) => {
        filters.push([col, val]);
        return api;
      }),
      order: vi.fn(() => api),
      maybeSingle: vi.fn(async () => {
        if (mode === 'insert') {
          if (state.insertConflict) {
            return { data: null, error: { code: '23505' } };
          }
          const withId: Row = {
            id: `stub-${state.inserts.length + 1}`,
            ...pendingInsert,
          } as Row;
          state.rows.push(withId);
          state.inserts.push(withId);
          return { data: withId, error: null };
        }
        const match = state.rows.find((r) => matchEqFilters(r, filters)) ?? null;
        return { data: match, error: null };
      }),
      single: vi.fn(async () => {
        const res = await api.maybeSingle();
        return res;
      }),
      // Thenable for awaiting delete-chain.
      then: (resolve: (v: { data: null; error: null; count: number }) => void) => {
        if (mode === 'delete') {
          const before = state.rows.length;
          state.rows = state.rows.filter((r) => !matchEqFilters(r, filters));
          const deleted = before - state.rows.length;
          state.deletes += deleted;
          resolve({ data: null, error: null, count: deleted });
          return;
        }
        // Raw SELECT without maybeSingle => array
        const matching = state.rows.filter((r) => matchEqFilters(r, filters));
        resolve({
          data: matching,
          error: null,
          count: matching.length,
        } as unknown as { data: null; error: null; count: number });
      },
    };
    return api;
  }

  return {
    client: { from: vi.fn((table: string) => buildQuery(table)) },
    state,
  };
}
