// @vitest-environment node
// @MX:SPEC: SPEC-SOCIAL-001
// Route handler tests for PATCH /api/rooms/[id]/suggestions/[sid].

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const ROOM_ID = 'room-abc';
const OWNER_ID = 'owner-uuid';
const OTHER_USER_ID = 'other-uuid';
const SID = 'sug-1';

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
    let mode: 'select' | 'insert' | 'update' | 'delete' = 'select';
    let pendingInsert: Record<string, unknown> | null = null;
    let pendingUpdate: Record<string, unknown> | null = null;
    let orderBy: { col: string; ascending: boolean } | null = null;
    let limitN: number | null = null;

    const tableRows = (): Array<Record<string, unknown>> => {
      if (table === 'rooms') return [{ id: ROOM_ID, ...roomState }];
      if (table === 'track_suggestions') return suggestionsTable;
      if (table === 'room_extra_tracks') return extraTracksTable;
      return [];
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
          const id = `${table}-${Math.random().toString(36).slice(2, 8)}`;
          const row = { id, ...pendingInsert };
          if (table === 'room_extra_tracks') extraTracksTable.push(row);
          else if (table === 'track_suggestions') suggestionsTable.push(row);
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

function makeReq(body: unknown, sidOverride: string = SID): Request {
  return new Request(
    `http://test/api/rooms/${ROOM_ID}/suggestions/${sidOverride}`,
    {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
}

describe('PATCH /api/rooms/[id]/suggestions/[sid]', () => {
  beforeEach(() => {
    roomState = { user_id: OWNER_ID, source_provider: 'spotify' };
    suggestionsTable = [
      {
        id: SID,
        room_id: ROOM_ID,
        suggested_by: OTHER_USER_ID,
        status: 'pending',
        external_track_id: 'sp-x',
        title: 'X',
        artist: 'Y',
        thumbnail_url: null,
        duration_sec: null,
        source_provider: 'spotify',
      },
    ];
    extraTracksTable = [];
    sessionUserId = null;
  });
  afterEach(() => vi.resetAllMocks());

  it('returns 401 when no session', async () => {
    const { PATCH } = await import('../route');
    const res = await PATCH(makeReq({ status: 'approved' }), {
      params: Promise.resolve({ id: ROOM_ID, sid: SID }),
    });
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid status payload', async () => {
    sessionUserId = OWNER_ID;
    const { PATCH } = await import('../route');
    const res = await PATCH(makeReq({ status: 'maybe' }), {
      params: Promise.resolve({ id: ROOM_ID, sid: SID }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 404 when suggestion id missing', async () => {
    sessionUserId = OWNER_ID;
    const { PATCH } = await import('../route');
    const res = await PATCH(makeReq({ status: 'approved' }, 'missing'), {
      params: Promise.resolve({ id: ROOM_ID, sid: 'missing' }),
    });
    expect(res.status).toBe(404);
  });

  it('returns 403 when caller is not the room owner', async () => {
    sessionUserId = OTHER_USER_ID;
    const { PATCH } = await import('../route');
    const res = await PATCH(makeReq({ status: 'approved' }), {
      params: Promise.resolve({ id: ROOM_ID, sid: SID }),
    });
    expect(res.status).toBe(403);
    expect(suggestionsTable[0].status).toBe('pending');
    expect(extraTracksTable.length).toBe(0);
  });

  it('approve happy path: 200, status updated, extra-track row inserted', async () => {
    sessionUserId = OWNER_ID;
    const { PATCH } = await import('../route');
    const res = await PATCH(makeReq({ status: 'approved' }), {
      params: Promise.resolve({ id: ROOM_ID, sid: SID }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.suggestion.status).toBe('approved');
    expect(body.extraTrack.position).toBe(1);
    expect(extraTracksTable.length).toBe(1);
  });

  it('reject happy path: 200, no extra-track inserted', async () => {
    sessionUserId = OWNER_ID;
    const { PATCH } = await import('../route');
    const res = await PATCH(makeReq({ status: 'rejected' }), {
      params: Promise.resolve({ id: ROOM_ID, sid: SID }),
    });
    expect(res.status).toBe(200);
    expect(suggestionsTable[0].status).toBe('rejected');
    expect(extraTracksTable.length).toBe(0);
  });

  it('returns 409 when re-approving an already-resolved row', async () => {
    suggestionsTable[0].status = 'rejected';
    sessionUserId = OWNER_ID;
    const { PATCH } = await import('../route');
    const res = await PATCH(makeReq({ status: 'approved' }), {
      params: Promise.resolve({ id: ROOM_ID, sid: SID }),
    });
    expect(res.status).toBe(409);
  });
});
