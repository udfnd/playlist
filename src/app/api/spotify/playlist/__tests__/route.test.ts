// @MX:SPEC: SPEC-SPOTIFY-001
// Tests for GET /api/spotify/playlist (T-008 / REQ-SPOT-003, E2).
// @vitest-environment node

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/spotify/fetch-playlist', () => ({
  fetchSpotifyPlaylist: vi.fn(),
}));
vi.mock('@/lib/spotify/client', () => ({
  SpotifyUnavailableError: class SpotifyUnavailableError extends Error {
    readonly code: string;
    constructor(code: string, message: string) {
      super(message);
      this.name = 'SpotifyUnavailableError';
      this.code = code;
    }
  },
}));

import { auth } from '@/auth';
import { fetchSpotifyPlaylist } from '@/lib/spotify/fetch-playlist';
import { SpotifyUnavailableError } from '@/lib/spotify/client';

const USER_ID = 'u-1';
const VALID_ID = 'a'.repeat(22); // 22 base62 chars

async function loadRoute() {
  return await import('@/app/api/spotify/playlist/route');
}

beforeEach(() => {
  vi.resetModules();
  vi.mocked(auth).mockResolvedValue({ userId: USER_ID } as never);
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('GET /api/spotify/playlist', () => {
  it('returns 401 when no session', async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    const { GET } = await loadRoute();
    const res = await GET(new Request('http://localhost/api/spotify/playlist?list=' + VALID_ID));
    expect(res.status).toBe(401);
  });

  it('returns 400 when ?list is missing', async () => {
    const { GET } = await loadRoute();
    const res = await GET(new Request('http://localhost/api/spotify/playlist'));
    expect(res.status).toBe(400);
  });

  it('returns 400 when list is not a valid Spotify playlist id/URL', async () => {
    const { GET } = await loadRoute();
    const res = await GET(new Request('http://localhost/api/spotify/playlist?list=not-a-valid-id'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('올바른 Spotify 플레이리스트 링크가 아닙니다.');
    expect(vi.mocked(fetchSpotifyPlaylist)).not.toHaveBeenCalled();
  });

  it('returns 404 on SpotifyUnavailableError', async () => {
    vi.mocked(fetchSpotifyPlaylist).mockRejectedValueOnce(
      new (SpotifyUnavailableError as unknown as new (c: string, m: string) => Error)(
        'playlist_unavailable',
        'gone',
      ),
    );
    const { GET } = await loadRoute();
    const res = await GET(new Request('http://localhost/api/spotify/playlist?list=' + VALID_ID));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('플레이리스트를 불러올 수 없습니다.');
  });

  it('returns the normalized Playlist on success', async () => {
    const playlist = { id: VALID_ID, name: 'Test', description: '', songs: [] };
    vi.mocked(fetchSpotifyPlaylist).mockResolvedValueOnce(playlist as never);

    const { GET } = await loadRoute();
    const res = await GET(new Request('http://localhost/api/spotify/playlist?list=' + VALID_ID));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(playlist);
    expect(vi.mocked(fetchSpotifyPlaylist)).toHaveBeenCalledWith(USER_ID, VALID_ID);
  });
});
