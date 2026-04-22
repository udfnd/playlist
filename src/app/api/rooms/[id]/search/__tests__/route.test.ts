// @vitest-environment node
// @MX:SPEC: SPEC-SOCIAL-001
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const ROOM_ID = 'room-abc';
const OWNER_ID = 'owner-uuid';
const CALLER_ID = 'caller-uuid';

let roomState: { user_id: string; source_provider: 'youtube' | 'spotify' } = {
  user_id: OWNER_ID,
  source_provider: 'spotify',
};
let sessionUserId: string | null = null;
let callerHasSpotify = true;
let ownerHasGoogle = true;

vi.mock('@/auth', () => ({
  auth: vi.fn(async () => (sessionUserId ? { userId: sessionUserId } : null)),
}));

const spotifySearchMock = vi.fn();
const youtubeSearchMock = vi.fn();

vi.mock('@/lib/search/spotify-search', () => ({
  searchSpotifyTracks: (...args: unknown[]) => spotifySearchMock(...args),
}));

vi.mock('@/lib/search/youtube-search', () => ({
  searchYouTubeTracks: (...args: unknown[]) => youtubeSearchMock(...args),
}));

vi.mock('@/lib/supabase/admin', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function fakeFrom(table: string): any {
    const filters: Array<[string, unknown]> = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api: any = {
      select: () => api,
      eq: (c: string, v: unknown) => {
        filters.push([c, v]);
        return api;
      },
      maybeSingle: async () => {
        if (table === 'rooms') {
          const idMatches = filters.find(([c]) => c === 'id')?.[1] === ROOM_ID;
          return {
            data: idMatches ? { id: ROOM_ID, ...roomState } : null,
            error: null,
          };
        }
        if (table === 'music_connections') {
          const provider = filters.find(([c]) => c === 'provider')?.[1];
          const userId = filters.find(([c]) => c === 'user_id')?.[1];
          if (provider === 'spotify' && userId === CALLER_ID && callerHasSpotify) {
            return {
              data: { user_id: CALLER_ID, access_token: 'tok' },
              error: null,
            };
          }
          if (provider === 'google' && userId === OWNER_ID && ownerHasGoogle) {
            return {
              data: { user_id: OWNER_ID, access_token: 'g-tok' },
              error: null,
            };
          }
          return { data: null, error: null };
        }
        return { data: null, error: null };
      },
    };
    return api;
  }
  return { getSupabaseAdmin: () => ({ from: (t: string) => fakeFrom(t) }) };
});

function makeReq(qs: string): Request {
  return new Request(`http://test/api/rooms/${ROOM_ID}/search?${qs}`, {
    method: 'GET',
  });
}

describe('GET /api/rooms/[id]/search', () => {
  beforeEach(() => {
    roomState = { user_id: OWNER_ID, source_provider: 'spotify' };
    sessionUserId = null;
    callerHasSpotify = true;
    ownerHasGoogle = true;
    spotifySearchMock.mockReset();
    youtubeSearchMock.mockReset();
  });
  afterEach(() => vi.resetAllMocks());

  it('returns 401 when no session', async () => {
    const { GET } = await import('../route');
    const res = await GET(makeReq('q=foo'), {
      params: Promise.resolve({ id: ROOM_ID }),
    });
    expect(res.status).toBe(401);
  });

  it('returns 400 when q is missing', async () => {
    sessionUserId = CALLER_ID;
    const { GET } = await import('../route');
    const res = await GET(makeReq(''), {
      params: Promise.resolve({ id: ROOM_ID }),
    });
    expect(res.status).toBe(400);
  });

  it('Spotify branch happy path: 200 with normalized results', async () => {
    sessionUserId = CALLER_ID;
    spotifySearchMock.mockResolvedValueOnce([
      {
        externalTrackId: 'sp-1',
        title: 'A',
        artist: 'B',
        thumbnailUrl: null,
        durationSec: 100,
      },
    ]);
    const { GET } = await import('../route');
    const res = await GET(makeReq('q=foo&limit=5'), {
      params: Promise.resolve({ id: ROOM_ID }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results.length).toBe(1);
    expect(spotifySearchMock).toHaveBeenCalledWith(CALLER_ID, 'foo', 5);
    expect(youtubeSearchMock).not.toHaveBeenCalled();
  });

  it('Spotify branch returns 401 when caller has no Spotify connection', async () => {
    sessionUserId = CALLER_ID;
    callerHasSpotify = false;
    const { GET } = await import('../route');
    const res = await GET(makeReq('q=foo'), {
      params: Promise.resolve({ id: ROOM_ID }),
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('spotify_connection_required');
  });

  it('YouTube branch uses owner OAuth when present', async () => {
    sessionUserId = CALLER_ID;
    roomState = { user_id: OWNER_ID, source_provider: 'youtube' };
    youtubeSearchMock.mockResolvedValueOnce([]);
    const { GET } = await import('../route');
    const res = await GET(makeReq('q=foo'), {
      params: Promise.resolve({ id: ROOM_ID }),
    });
    expect(res.status).toBe(200);
    const callArgs = youtubeSearchMock.mock.calls[0];
    expect(callArgs[0]).toEqual({ kind: 'oauth', accessToken: 'g-tok' });
  });

  it('YouTube branch falls back to API key when owner has no OAuth', async () => {
    sessionUserId = CALLER_ID;
    roomState = { user_id: OWNER_ID, source_provider: 'youtube' };
    ownerHasGoogle = false;
    process.env.YOUTUBE_API_KEY = 'env-key';
    youtubeSearchMock.mockResolvedValueOnce([]);
    const { GET } = await import('../route');
    const res = await GET(makeReq('q=foo'), {
      params: Promise.resolve({ id: ROOM_ID }),
    });
    expect(res.status).toBe(200);
    expect(youtubeSearchMock.mock.calls[0][0]).toEqual({
      kind: 'apiKey',
      key: 'env-key',
    });
  });

  it('YouTube branch returns 500 youtube_unavailable when no auth available', async () => {
    sessionUserId = CALLER_ID;
    roomState = { user_id: OWNER_ID, source_provider: 'youtube' };
    ownerHasGoogle = false;
    delete process.env.YOUTUBE_API_KEY;
    const { GET } = await import('../route');
    const res = await GET(makeReq('q=foo'), {
      params: Promise.resolve({ id: ROOM_ID }),
    });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('youtube_unavailable');
  });
});
