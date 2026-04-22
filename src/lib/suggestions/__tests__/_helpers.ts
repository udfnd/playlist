// @MX:SPEC: SPEC-SOCIAL-001
// Chainable Supabase stub for suggestions service tests. Mirrors the reactions
// stub but supports multiple tables (rooms, track_suggestions, room_extra_tracks)
// and update + ordered/limited selects (for next-position calc).

import { vi } from 'vitest';

export interface Row extends Record<string, unknown> {
  id: string;
}

export interface SuggestionStubOptions {
  rooms?: Row[];
  suggestions?: Row[];
  extraTracks?: Row[];
  /** Force the next INSERT into track_suggestions to conflict (unique violation). */
  insertConflict?: boolean;
}

export interface SuggestionStub {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any;
  state: {
    rooms: Row[];
    suggestions: Row[];
    extraTracks: Row[];
    inserts: { table: string; row: Row }[];
    updates: { table: string; patch: Record<string, unknown>; matched: Row[] }[];
    insertConflict: boolean;
  };
}

function matchEqFilters(row: Row, filters: Array<[string, unknown]>): boolean {
  return filters.every(([col, val]) => row[col] === val);
}

export function makeSuggestionStub(opts: SuggestionStubOptions = {}): SuggestionStub {
  const state = {
    rooms: [...(opts.rooms ?? [])],
    suggestions: [...(opts.suggestions ?? [])],
    extraTracks: [...(opts.extraTracks ?? [])],
    inserts: [] as { table: string; row: Row }[],
    updates: [] as {
      table: string;
      patch: Record<string, unknown>;
      matched: Row[];
    }[],
    insertConflict: Boolean(opts.insertConflict),
  };

  function tableRows(table: string): Row[] {
    if (table === 'rooms') return state.rooms;
    if (table === 'track_suggestions') return state.suggestions;
    if (table === 'room_extra_tracks') return state.extraTracks;
    return [];
  }

  function setTableRows(table: string, rows: Row[]): void {
    if (table === 'rooms') state.rooms = rows;
    else if (table === 'track_suggestions') state.suggestions = rows;
    else if (table === 'room_extra_tracks') state.extraTracks = rows;
  }

  function buildQuery(table: string) {
    const filters: Array<[string, unknown]> = [];
    let mode: 'select' | 'insert' | 'delete' | 'update' = 'select';
    let pendingInsert: Row | null = null;
    let pendingUpdate: Record<string, unknown> | null = null;
    let orderBy: { col: string; ascending: boolean } | null = null;
    let limitN: number | null = null;

    const api = {
      select: vi.fn((cols?: string) => {
        void cols;
        return api;
      }),
      insert: vi.fn((row: Row) => {
        mode = 'insert';
        pendingInsert = row;
        return api;
      }),
      update: vi.fn((patch: Record<string, unknown>) => {
        mode = 'update';
        pendingUpdate = patch;
        return api;
      }),
      delete: vi.fn(() => {
        mode = 'delete';
        return api;
      }),
      eq: vi.fn((col: string, val: unknown) => {
        filters.push([col, val]);
        return api;
      }),
      order: vi.fn((col: string, opts2?: { ascending?: boolean }) => {
        orderBy = { col, ascending: opts2?.ascending ?? true };
        return api;
      }),
      limit: vi.fn((n: number) => {
        limitN = n;
        return api;
      }),
      maybeSingle: vi.fn(async () => {
        if (mode === 'insert') {
          if (state.insertConflict && table === 'track_suggestions') {
            return { data: null, error: { code: '23505' } };
          }
          const withId: Row = {
            id: `stub-${table}-${state.inserts.length + 1}`,
            ...pendingInsert,
          } as Row;
          setTableRows(table, [...tableRows(table), withId]);
          state.inserts.push({ table, row: withId });
          return { data: withId, error: null };
        }
        if (mode === 'update') {
          const matched = tableRows(table).filter((r) =>
            matchEqFilters(r, filters),
          );
          for (const r of matched) Object.assign(r, pendingUpdate);
          state.updates.push({
            table,
            patch: pendingUpdate ?? {},
            matched,
          });
          return { data: matched[0] ?? null, error: null };
        }
        let rows = tableRows(table).filter((r) => matchEqFilters(r, filters));
        if (orderBy) {
          rows = [...rows].sort((a, b) => {
            const av = a[orderBy!.col] as number;
            const bv = b[orderBy!.col] as number;
            return orderBy!.ascending ? av - bv : bv - av;
          });
        }
        if (limitN !== null) rows = rows.slice(0, limitN);
        return { data: rows[0] ?? null, error: null };
      }),
      single: vi.fn(async () => {
        const res = await api.maybeSingle();
        return res;
      }),
      then: (
        resolve: (v: { data: unknown; error: null; count: number }) => void,
      ) => {
        if (mode === 'delete') {
          const before = tableRows(table).length;
          setTableRows(
            table,
            tableRows(table).filter((r) => !matchEqFilters(r, filters)),
          );
          const count = before - tableRows(table).length;
          resolve({ data: null, error: null, count });
          return;
        }
        if (mode === 'update') {
          const matched = tableRows(table).filter((r) =>
            matchEqFilters(r, filters),
          );
          for (const r of matched) Object.assign(r, pendingUpdate);
          state.updates.push({
            table,
            patch: pendingUpdate ?? {},
            matched,
          });
          resolve({ data: matched, error: null, count: matched.length });
          return;
        }
        let rows = tableRows(table).filter((r) => matchEqFilters(r, filters));
        if (orderBy) {
          rows = [...rows].sort((a, b) => {
            const av = a[orderBy!.col] as number;
            const bv = b[orderBy!.col] as number;
            return orderBy!.ascending ? av - bv : bv - av;
          });
        }
        if (limitN !== null) rows = rows.slice(0, limitN);
        resolve({
          data: rows,
          error: null,
          count: rows.length,
        });
      },
    };
    return api;
  }

  return {
    client: { from: vi.fn((table: string) => buildQuery(table)) },
    state,
  };
}
