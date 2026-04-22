// @vitest-environment node
// @MX:SPEC: SPEC-SOCIAL-001
// Route handler tests for POST/GET /api/rooms/[id]/suggestions.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { __resetSuggestionRateLimit } from '@/lib/suggestions/service';

const ROOM_ID = 'room-abc';
const OWNER_ID = 'owner-uuid';
const OTHER_USER_ID = 'other-uuid';

let roomState: { user_id: string; source_provider: 'youtube' | 'spotify' } = {
  user_id: OWNER_ID,
  source_provider: 'spotify',
};
let suggestionsTable: Array<Record<string, unknown>> = [];
let extraTracksTable: Array<Record<string, unknown>> = [];
let sessionUserId: string | null = null;

vi.mock('@/auth', () => ({
  auth: vi.fn(async () => (sessionUserId ? { userId: sessionUserId } : null)),
}));

vi.mock('@/lib/supabase/admin', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function fakeFrom(table: string): any {
    const filters: Array<[string, unknown]> = [];
    let mode: 'select' | 'insert' | 'delete' | 'update' = 'select';
    let pendingInsert: Record<string, unknown> | null = null;
    let pendingUpdate: Record<string, unknown> | null = null;
    let orderBy: { col: string; ascending: boolean } | null = null;
    let limitN: number | null = null;

    const tableRows = (): Array<Record<string, unknown>> => {
      if (table === 'rooms')
        return [{ id: ROOM_ID, ...roomState }];
      if (table === 'track_suggestions') return suggestionsTable;
      if (table === 'room_extra_tracks') return extraTracksTable;
      return [];
    };

    const setTable = (rows: Array<Record<string, unknown>>) => {
      if (table === 'track_suggestions') suggestionsTable = rows;
      if (table === 'room_extra_tracks') extraTracksTable = rows;
    };

    const match = (row: Record<string, unknown>) =>
      filters.every(([c, v]) => row[c] === v);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api: any = {
      select: () => api,
      insert: (row: Record<string, unknown>) => {
        mode = 'insert';
        pendingInsert = row;
        return api;
      },
      update: (patch: Record<string, unknown>) => {
        mode = 'update';
        pendingUpdate = patch;
        return api;
      },
      delete: () => {
        mode = 'delete';
        return api;
      },
      eq: (c: string, v: unknown) => {
        filters.push([c, v]);
        return api;
      },
      order: (c: string, opts2?: { ascending?: boolean }) => {
        orderBy = { col: c, ascending: opts2?.ascending ?? true };
        return api;
      },
      limit: (n: number) => {
        limitN = n;
        return api;
      },
      maybeSingle: async () => {
        if (mode === 'insert') {
          if (table === 'track_suggestions') {
            const dup = suggestionsTable.find(
              (r) =>
                r.room_id === pendingInsert?.room_id &&
                r.suggested_by === pendingInsert?.suggested_by &&
                r.external_track_id === pendingInsert?.external_track_id,
            );
            if (dup) return { data: null, error: { code: '23505' } };
          }
          const id = `${table}-${Math.random().toString(36).slice(2, 8)}`;
          const row = { id, ...pendingInsert };
          if (table === 'track_suggestions') suggestionsTable.push(row);
          else if (table === 'room_extra_tracks') extraTracksTable.push(row);
          return { data: row, error: null };
        }
        if (mode === 'update') {
          const matched = tableRows().filter(match);
          for (const r of matched) Object.assign(r, pendingUpdate);
          return { data: matched[0] ?? null, error: null };
        }
        let rows = tableRows().filter(match);
        if (orderBy) {
          rows = [...rows].sort((a, b) => {
            const av = a[orderBy!.col] as number;
            const bv = b[orderBy!.col] as number;
            return orderBy!.ascending ? av - bv : bv - av;
          });
        }
        if (limitN !== null) rows = rows.slice(0, limitN);
        return { data: rows[0] ?? null, error: null };
      },
      single: async () => api.maybeSingle(),
      then: (
        resolve: (v: { data: unknown; error: null; count: number }) => void,
      ) => {
        if (mode === 'delete') {
          const before = tableRows().length;
          setTable(tableRows().filter((r) => !match(r)));
          resolve({ data: null, error: null, count: before - tableRows().length });
          return;
        }
        const rows = tableRows().filter(match);
        resolve({ data: rows, error: null, count: rows.length });
      },
    };
    return api;
  }
  return {
    getSupabaseAdmin: () => ({ from: (t: string) => fakeFrom(t) }),
  };
});

function makeReq(
  method: 'GET' | 'POST',
  body: Record<string, unknown> | null = null,
): Request {
  const init: RequestInit = {
    method,
    headers: { 'content-type': 'application/json' },
  };
  if (body !== null) init.body = JSON.stringify(body);
  return new Request(`http://test/api/rooms/${ROOM_ID}/suggestions`, init);
}

describe('POST /api/rooms/[id]/suggestions', () => {
  beforeEach(() => {
    roomState = { user_id: OWNER_ID, source_provider: 'spotify' };
    suggestionsTable = [];
    extraTracksTable = [];
    sessionUserId = null;
    __resetSuggestionRateLimit();
  });
  afterEach(() => vi.resetAllMocks());

  it('returns 401 when no session', async () => {
    const { POST } = await import('../route');
    const res = await POST(
      makeReq('POST', {
        externalTrackId: 'sp-1',
        title: 'X',
        artist: 'Y',
      }),
      { params: Promise.resolve({ id: ROOM_ID }) },
    );
    expect(res.status).toBe(401);
  });

  it('returns 400 when body missing required fields', async () => {
    sessionUserId = OTHER_USER_ID;
    const { POST } = await import('../route');
    const res = await POST(makeReq('POST', { title: 'X' }), {
      params: Promise.resolve({ id: ROOM_ID }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 201 on happy path', async () => {
    sessionUserId = OTHER_USER_ID;
    const { POST } = await import('../route');
    const res = await POST(
      makeReq('POST', {
        externalTrackId: 'sp-1',
        title: 'Hello',
        artist: 'Adele',
      }),
      { params: Promise.resolve({ id: ROOM_ID }) },
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.suggestion.status).toBe('pending');
    expect(suggestionsTable.length).toBe(1);
  });

  it('returns 409 on duplicate (same user + externalTrackId)', async () => {
    sessionUserId = OTHER_USER_ID;
    const { POST } = await import('../route');
    await POST(
      makeReq('POST', {
        externalTrackId: 'sp-1',
        title: 'Hello',
        artist: 'Adele',
      }),
      { params: Promise.resolve({ id: ROOM_ID }) },
    );
    const res = await POST(
      makeReq('POST', {
        externalTrackId: 'sp-1',
        title: 'Hello',
        artist: 'Adele',
      }),
      { params: Promise.resolve({ id: ROOM_ID }) },
    );
    expect(res.status).toBe(409);
  });

  it('returns 429 with Retry-After on 6th submission', async () => {
    sessionUserId = OTHER_USER_ID;
    const { POST } = await import('../route');
    for (let i = 0; i < 5; i++) {
      const r = await POST(
        makeReq('POST', {
          externalTrackId: `sp-${i}`,
          title: 'X',
          artist: 'Y',
        }),
        { params: Promise.resolve({ id: ROOM_ID }) },
      );
      expect(r.status).toBe(201);
    }
    const sixth = await POST(
      makeReq('POST', {
        externalTrackId: 'sp-6',
        title: 'X',
        artist: 'Y',
      }),
      { params: Promise.resolve({ id: ROOM_ID }) },
    );
    expect(sixth.status).toBe(429);
    expect(sixth.headers.get('Retry-After')).toBeTruthy();
  });

  it('returns 404 when room does not exist', async () => {
    sessionUserId = OTHER_USER_ID;
    // Re-mock to return null room.
    const { POST } = await import('../route');
    const res = await POST(
      new Request(`http://test/api/rooms/missing/suggestions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          externalTrackId: 'sp-x',
          title: 'X',
          artist: 'Y',
        }),
      }),
      { params: Promise.resolve({ id: 'missing' }) },
    );
    expect(res.status).toBe(404);
  });
});

describe('GET /api/rooms/[id]/suggestions', () => {
  beforeEach(() => {
    roomState = { user_id: OWNER_ID, source_provider: 'spotify' };
    suggestionsTable = [
      { id: 's1', room_id: ROOM_ID, status: 'pending' },
      { id: 's2', room_id: ROOM_ID, status: 'approved' },
      { id: 's3', room_id: ROOM_ID, status: 'rejected' },
    ];
    sessionUserId = null;
    __resetSuggestionRateLimit();
  });

  it('returns approved-only when caller is anonymous / non-owner', async () => {
    const { GET } = await import('../route');
    const res = await GET(makeReq('GET'), {
      params: Promise.resolve({ id: ROOM_ID }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.suggestions.map((r: { id: string }) => r.id)).toEqual(['s2']);
  });

  it('returns all when caller is the room owner', async () => {
    sessionUserId = OWNER_ID;
    const { GET } = await import('../route');
    const res = await GET(makeReq('GET'), {
      params: Promise.resolve({ id: ROOM_ID }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.suggestions.length).toBe(3);
  });
});
