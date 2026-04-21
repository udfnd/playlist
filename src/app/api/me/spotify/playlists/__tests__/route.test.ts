// @MX:SPEC: SPEC-SPOTIFY-001
// Tests for GET /api/me/spotify/playlists (T-007 / REQ-SPOT-002).
// @vitest-environment node

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/spotify/client', () => ({
  spotifyFetch: vi.fn(),
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
import { spotifyFetch, SpotifyUnavailableError } from '@/lib/spotify/client';

const USER_ID = 'u-1';

async function loadRoute() {
  return await import('@/app/api/me/spotify/playlists/route');
}

function jsonRes(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  vi.resetModules();
  vi.mocked(auth).mockResolvedValue({ userId: USER_ID } as never);
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('GET /api/me/spotify/playlists', () => {
  it('returns 401 when no session', async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    const { GET } = await loadRoute();
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('maps a single page to the unified shape', async () => {
    vi.mocked(spotifyFetch).mockResolvedValueOnce(
      jsonRes({
        next: null,
        items: [
          {
            id: 'p1',
            name: 'My Mix',
            public: true,
            collaborative: false,
            images: [{ url: 'https://img.example/p1.jpg' }],
            tracks: { total: 42 },
          },
          {
            id: 'p2',
            name: 'Private',
            public: false,
            collaborative: false,
            images: [],
            tracks: { total: 5 },
          },
          {
            id: 'p3',
            name: 'Collab',
            public: false,
            collaborative: true,
            images: [{ url: 'c.jpg' }],
            tracks: { total: 10 },
          },
        ],
      }),
    );

    const { GET } = await loadRoute();
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.playlists).toEqual([
      { id: 'p1', title: 'My Mix', thumbnailUrl: 'https://img.example/p1.jpg', itemCount: 42, privacy: 'public' },
      { id: 'p2', title: 'Private', thumbnailUrl: '', itemCount: 5, privacy: 'private' },
      { id: 'p3', title: 'Collab', thumbnailUrl: 'c.jpg', itemCount: 10, privacy: 'collaborative' },
    ]);
    expect(vi.mocked(spotifyFetch)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(spotifyFetch).mock.calls[0][1]).toContain('/me/playlists');
  });

  it('follows `next` pagination across two pages', async () => {
    vi.mocked(spotifyFetch)
      .mockResolvedValueOnce(
        jsonRes({
          next: 'https://api.spotify.com/v1/me/playlists?offset=50&limit=50',
          items: [
            { id: 'a', name: 'A', public: true, collaborative: false, images: [], tracks: { total: 1 } },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonRes({
          next: null,
          items: [
            { id: 'b', name: 'B', public: false, collaborative: false, images: [], tracks: { total: 2 } },
          ],
        }),
      );

    const { GET } = await loadRoute();
    const res = await GET();
    const body = await res.json();
    expect(body.playlists.map((p: { id: string }) => p.id)).toEqual(['a', 'b']);
    expect(vi.mocked(spotifyFetch)).toHaveBeenCalledTimes(2);
    expect(String(vi.mocked(spotifyFetch).mock.calls[1][1])).toBe(
      'https://api.spotify.com/v1/me/playlists?offset=50&limit=50',
    );
  });

  it('returns 401 with Korean message on SpotifyUnavailableError', async () => {
    vi.mocked(spotifyFetch).mockRejectedValueOnce(
      new (SpotifyUnavailableError as unknown as new (code: string, message: string) => Error)(
        'invalid_grant',
        'revoked',
      ),
    );
    const { GET } = await loadRoute();
    const res = await GET();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Spotify 연결이 만료되었습니다. 다시 연결해 주세요.');
  });
});
