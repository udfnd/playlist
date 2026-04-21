// @MX:SPEC: SPEC-SPOTIFY-001
// Tests for fetchSpotifyPlaylist (T-003 / REQ-SPOT-002, REQ-SPOT-003,
// REQ-SPOT-004, E2).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock spotifyFetch — upstream (T-002) is tested in isolation elsewhere.
vi.mock('@/lib/spotify/client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/spotify/client')>(
    '@/lib/spotify/client',
  );
  return {
    ...actual,
    spotifyFetch: vi.fn(),
  };
});

import { spotifyFetch, SpotifyUnavailableError } from '@/lib/spotify/client';
import { generateColorFromId } from '@/lib/youtube';
import { fetchSpotifyPlaylist } from '@/lib/spotify/fetch-playlist';

const USER_ID = 'user-1';
const PLAYLIST_ID = '37i9dQZF1DXcBWIGoYBM5M';

function jsonRes(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });
}

function track(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    name: `Track ${id}`,
    duration_ms: 180_500,
    artists: [{ name: 'Alpha' }, { name: 'Beta' }],
    album: { images: [{ url: `https://img.example/${id}.jpg` }] },
    is_local: false,
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(spotifyFetch).mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('fetchSpotifyPlaylist', () => {
  it('normalizes metadata + tracks into Playlist, storing Spotify id in videoId', async () => {
    vi.mocked(spotifyFetch)
      .mockResolvedValueOnce(
        jsonRes({
          id: PLAYLIST_ID,
          name: 'Chill Vibes',
          description: 'Smooth tracks',
          images: [{ url: 'https://img.example/cover.jpg' }],
        }),
      )
      .mockResolvedValueOnce(
        jsonRes({
          items: [{ track: track('abc123') }, { track: track('def456') }],
          next: null,
        }),
      );

    const pl = await fetchSpotifyPlaylist(USER_ID, PLAYLIST_ID);

    expect(pl.id).toBe(PLAYLIST_ID);
    expect(pl.name).toBe('Chill Vibes');
    expect(pl.description).toBe('Smooth tracks');
    expect(pl.songs).toHaveLength(2);
    const first = pl.songs[0];
    expect(first.id).toBe('abc123');
    expect(first.videoId).toBe('abc123');
    expect(first.title).toBe('Track abc123');
    expect(first.artist).toBe('Alpha, Beta');
    expect(first.thumbnailUrl).toBe('https://img.example/abc123.jpg');
    expect(first.duration).toBe(181); // 180_500 ms → 181s (rounded)
    expect(first.color).toBe(generateColorFromId('abc123'));
  });

  it('follows `next` pagination across 3 pages', async () => {
    vi.mocked(spotifyFetch)
      .mockResolvedValueOnce(
        jsonRes({
          id: PLAYLIST_ID,
          name: 'P',
          description: '',
          images: [],
        }),
      )
      .mockResolvedValueOnce(
        jsonRes({
          items: [{ track: track('t1') }],
          next: 'https://api.spotify.com/v1/playlists/x/tracks?offset=100',
        }),
      )
      .mockResolvedValueOnce(
        jsonRes({
          items: [{ track: track('t2') }],
          next: 'https://api.spotify.com/v1/playlists/x/tracks?offset=200',
        }),
      )
      .mockResolvedValueOnce(
        jsonRes({
          items: [{ track: track('t3') }],
          next: null,
        }),
      );

    const pl = await fetchSpotifyPlaylist(USER_ID, PLAYLIST_ID);
    expect(pl.songs.map((s) => s.id)).toEqual(['t1', 't2', 't3']);
    expect(vi.mocked(spotifyFetch)).toHaveBeenCalledTimes(4); // 1 meta + 3 pages
  });

  it('filters is_local=true and null track entries', async () => {
    vi.mocked(spotifyFetch)
      .mockResolvedValueOnce(
        jsonRes({
          id: PLAYLIST_ID,
          name: 'P',
          description: '',
          images: [],
        }),
      )
      .mockResolvedValueOnce(
        jsonRes({
          items: [
            { track: track('keep') },
            { track: track('local', { is_local: true }) },
            { track: null },
          ],
          next: null,
        }),
      );

    const pl = await fetchSpotifyPlaylist(USER_ID, PLAYLIST_ID);
    expect(pl.songs.map((s) => s.id)).toEqual(['keep']);
  });

  it('throws SpotifyUnavailableError on 404', async () => {
    vi.mocked(spotifyFetch).mockResolvedValueOnce(
      new Response('{}', { status: 404 }),
    );
    await expect(fetchSpotifyPlaylist(USER_ID, PLAYLIST_ID)).rejects.toBeInstanceOf(
      SpotifyUnavailableError,
    );
  });

  it('accepts a full open.spotify.com URL via extractSpotifyPlaylistId', async () => {
    vi.mocked(spotifyFetch)
      .mockResolvedValueOnce(
        jsonRes({
          id: PLAYLIST_ID,
          name: 'From URL',
          description: '',
          images: [],
        }),
      )
      .mockResolvedValueOnce(jsonRes({ items: [], next: null }));

    const pl = await fetchSpotifyPlaylist(
      USER_ID,
      `https://open.spotify.com/playlist/${PLAYLIST_ID}`,
    );
    expect(pl.id).toBe(PLAYLIST_ID);

    // Verify the metadata call hit the extracted id, not the raw URL.
    const firstCallPath = vi.mocked(spotifyFetch).mock.calls[0][1] as string;
    expect(firstCallPath).toContain(PLAYLIST_ID);
  });

  it('color uses generateColorFromId deterministically', async () => {
    vi.mocked(spotifyFetch)
      .mockResolvedValueOnce(
        jsonRes({ id: PLAYLIST_ID, name: 'P', description: '', images: [] }),
      )
      .mockResolvedValueOnce(
        jsonRes({ items: [{ track: track('stable-id-xyz') }], next: null }),
      );

    const pl = await fetchSpotifyPlaylist(USER_ID, PLAYLIST_ID);
    expect(pl.songs[0].color).toBe(generateColorFromId('stable-id-xyz'));
  });
});
