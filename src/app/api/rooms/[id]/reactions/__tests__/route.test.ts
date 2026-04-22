// @vitest-environment node
// @MX:SPEC: SPEC-SOCIAL-001
// Route handler tests for POST/DELETE/GET /api/rooms/[id]/reactions.
// Uses node env because happy-dom's Request silently drops the Cookie header
// (per fetch spec it is a forbidden header; node fetch preserves it).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { signVisitorId, COOKIE_NAME } from '@/lib/visitor/cookie';
import { __resetReactionRateLimit } from '@/lib/reactions/service';

const SECRET = 'route-test-secret-value-longer__';
const ROOM_ID = 'room-abc';
const OWNER_ID = 'owner-uuid';
const OTHER_USER_ID = 'other-uuid';
const VISITOR_ID = 'vvvv1111-2222-3333-4444-555555555555';
const TRACK_REF = 'track-111';

// ---- Mocks ----
// Mutable state the mocks read from per-test.
type RoomState = {
  visibility: 'public' | 'unlisted' | 'private';
  user_id: string;
};

let roomState: RoomState = { visibility: 'public', user_id: OWNER_ID };
let reactionsTable: Array<Record<string, unknown>> = [];
let sessionUserId: string | null = null;

vi.mock('@/auth', () => ({
  auth: vi.fn(async () => (sessionUserId ? { userId: sessionUserId } : null)),
}));

vi.mock('@/lib/supabase/admin', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function fakeFrom(table: string): any {
    const filters: Array<[string, unknown]> = [];
    let mode: 'select' | 'insert' | 'delete' = 'select';
    let pendingInsert: Record<string, unknown> | null = null;

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
      delete: () => {
        mode = 'delete';
        return api;
      },
      eq: (c: string, v: unknown) => {
        filters.push([c, v]);
        return api;
      },
      order: () => api,
      maybeSingle: async () => {
        if (table === 'rooms') {
          const matchRoom =
            filters.find(([c]) => c === 'id')?.[1] === ROOM_ID
              ? { id: ROOM_ID, ...roomState }
              : null;
          return { data: matchRoom, error: null };
        }
        if (mode === 'insert' && table === 'track_reactions') {
          const existing = reactionsTable.find((r) =>
            r.room_id === pendingInsert?.room_id &&
            r.track_ref === pendingInsert?.track_ref &&
            r.actor_kind === pendingInsert?.actor_kind &&
            r.visitor_id === pendingInsert?.visitor_id &&
            r.user_id === pendingInsert?.user_id &&
            r.emoji === pendingInsert?.emoji,
          );
          if (existing) return { data: null, error: { code: '23505' } };
          const row = { id: `rx-${reactionsTable.length + 1}`, ...pendingInsert };
          reactionsTable.push(row);
          return { data: row, error: null };
        }
        const row = reactionsTable.find(match) ?? null;
        return { data: row, error: null };
      },
      single: async () => ({ data: null, error: null }),
      then: (
        resolve: (v: { data: unknown; error: null; count: number }) => void,
      ) => {
        if (mode === 'delete' && table === 'track_reactions') {
          const before = reactionsTable.length;
          reactionsTable = reactionsTable.filter((r) => !match(r));
          const count = before - reactionsTable.length;
          resolve({ data: null, error: null, count });
          return;
        }
        const rows = table === 'track_reactions' ? reactionsTable.filter(match) : [];
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
    getSupabaseAdmin: () => ({ from: (table: string) => fakeFrom(table) }),
  };
});

// ---- Request helpers ----
async function validVisitorCookie(): Promise<string> {
  return signVisitorId(VISITOR_ID, SECRET);
}

async function makeRequest(
  method: 'GET' | 'POST' | 'DELETE',
  body: Record<string, unknown> | null,
  cookies: Record<string, string> = {},
): Promise<Request> {
  const init: RequestInit = {
    method,
    headers: {
      'content-type': 'application/json',
      ...(Object.keys(cookies).length
        ? {
            cookie: Object.entries(cookies)
              .map(([k, v]) => `${k}=${v}`)
              .join('; '),
          }
        : {}),
    },
  };
  if (body !== null) init.body = JSON.stringify(body);
  return new Request(`http://test/api/rooms/${ROOM_ID}/reactions`, init);
}

// ---- Suite ----

describe('POST /api/rooms/[id]/reactions', () => {
  beforeEach(() => {
    process.env.AUTH_SECRET = SECRET;
    roomState = { visibility: 'public', user_id: OWNER_ID };
    reactionsTable = [];
    sessionUserId = null;
    __resetReactionRateLimit();
  });
  afterEach(() => vi.resetAllMocks());

  it('returns 401 when no session and no cookie', async () => {
    const { POST } = await import('../route');
    const req = await makeRequest('POST', { trackRef: TRACK_REF, emoji: '❤️' });
    const res = await POST(req, { params: Promise.resolve({ id: ROOM_ID }) });
    expect(res.status).toBe(401);
  });

  it('returns 403 for private room non-owner (visitor)', async () => {
    roomState = { visibility: 'private', user_id: OWNER_ID };
    const { POST } = await import('../route');
    const req = await makeRequest(
      'POST',
      { trackRef: TRACK_REF, emoji: '❤️' },
      { [COOKIE_NAME]: await validVisitorCookie() },
    );
    const res = await POST(req, { params: Promise.resolve({ id: ROOM_ID }) });
    expect(res.status).toBe(403);
  });

  it('returns 201 then 200 on repeated identical request (idempotent)', async () => {
    const { POST } = await import('../route');
    const cookie = await validVisitorCookie();
    const req1 = await makeRequest(
      'POST',
      { trackRef: TRACK_REF, emoji: '❤️' },
      { [COOKIE_NAME]: cookie },
    );
    const res1 = await POST(req1, { params: Promise.resolve({ id: ROOM_ID }) });
    expect(res1.status).toBe(201);

    const req2 = await makeRequest(
      'POST',
      { trackRef: TRACK_REF, emoji: '❤️' },
      { [COOKIE_NAME]: cookie },
    );
    const res2 = await POST(req2, { params: Promise.resolve({ id: ROOM_ID }) });
    expect(res2.status).toBe(200);
  });

  it('returns 400 for invalid emoji', async () => {
    const { POST } = await import('../route');
    const req = await makeRequest(
      'POST',
      { trackRef: TRACK_REF, emoji: '💩' },
      { [COOKIE_NAME]: await validVisitorCookie() },
    );
    const res = await POST(req, { params: Promise.resolve({ id: ROOM_ID }) });
    expect(res.status).toBe(400);
  });

  it('returns 429 with Retry-After on the 31st mutation', async () => {
    const { POST } = await import('../route');
    const cookie = await validVisitorCookie();
    // Burn 30 calls (each with a unique emoji or trackRef so the unique
    // constraint doesn't short-circuit; but rate limiter counts regardless).
    for (let i = 0; i < 30; i++) {
      const req = await makeRequest(
        'POST',
        { trackRef: `track-${i}`, emoji: '❤️' },
        { [COOKIE_NAME]: cookie },
      );
      await POST(req, { params: Promise.resolve({ id: ROOM_ID }) });
    }
    const req31 = await makeRequest(
      'POST',
      { trackRef: 'track-30', emoji: '❤️' },
      { [COOKIE_NAME]: cookie },
    );
    const res = await POST(req31, { params: Promise.resolve({ id: ROOM_ID }) });
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBeTruthy();
  });
});

describe('DELETE /api/rooms/[id]/reactions', () => {
  beforeEach(() => {
    process.env.AUTH_SECRET = SECRET;
    roomState = { visibility: 'public', user_id: OWNER_ID };
    reactionsTable = [
      {
        id: 'rx-seeded',
        room_id: ROOM_ID,
        track_ref: TRACK_REF,
        actor_kind: 'user',
        visitor_id: null,
        user_id: OTHER_USER_ID,
        emoji: '❤️',
      },
    ];
    sessionUserId = null;
    __resetReactionRateLimit();
  });

  it('returns deleted:0 when actor does not own the reaction (not 403)', async () => {
    const { DELETE } = await import('../route');
    const req = await makeRequest(
      'DELETE',
      { trackRef: TRACK_REF, emoji: '❤️' },
      { [COOKIE_NAME]: await signVisitorId(VISITOR_ID, SECRET) },
    );
    const res = await DELETE(req, { params: Promise.resolve({ id: ROOM_ID }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deleted).toBe(0);
  });
});

describe('GET /api/rooms/[id]/reactions', () => {
  beforeEach(() => {
    process.env.AUTH_SECRET = SECRET;
    roomState = { visibility: 'public', user_id: OWNER_ID };
    reactionsTable = [
      {
        id: 'rx-1',
        room_id: ROOM_ID,
        track_ref: TRACK_REF,
        actor_kind: 'visitor',
        visitor_id: VISITOR_ID,
        user_id: null,
        emoji: '❤️',
      },
      {
        id: 'rx-2',
        room_id: ROOM_ID,
        track_ref: TRACK_REF,
        actor_kind: 'visitor',
        visitor_id: 'other-visitor',
        user_id: null,
        emoji: '❤️',
      },
      {
        id: 'rx-3',
        room_id: ROOM_ID,
        track_ref: TRACK_REF,
        actor_kind: 'visitor',
        visitor_id: VISITOR_ID,
        user_id: null,
        emoji: '🔥',
      },
    ];
    sessionUserId = null;
  });

  it('aggregates reactions into { trackRef, emoji, count, byMe }', async () => {
    const { GET } = await import('../route');
    const cookie = await signVisitorId(VISITOR_ID, SECRET);
    const req = await makeRequest('GET', null, { [COOKIE_NAME]: cookie });
    const res = await GET(req, { params: Promise.resolve({ id: ROOM_ID }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.reactions)).toBe(true);
    const heart = body.reactions.find(
      (r: { trackRef: string; emoji: string }) =>
        r.trackRef === TRACK_REF && r.emoji === '❤️',
    );
    expect(heart.count).toBe(2);
    expect(heart.byMe).toBe(true);
    const fire = body.reactions.find(
      (r: { trackRef: string; emoji: string }) =>
        r.trackRef === TRACK_REF && r.emoji === '🔥',
    );
    expect(fire.count).toBe(1);
    expect(fire.byMe).toBe(true);
  });
});
