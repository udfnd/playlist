// @MX:SPEC: SPEC-SOCIAL-001
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { searchSpotifyTracks } from '../spotify-search';
import { SpotifyUnavailableError } from '@/lib/spotify/client';

const spotifyFetchMock = vi.fn();

vi.mock('@/lib/spotify/client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/spotify/client')>(
    '@/lib/spotify/client',
  );
  return {
    ...actual,
    spotifyFetch: (...args: unknown[]) => spotifyFetchMock(...args),
  };
});

function makeOk(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

describe('searchSpotifyTracks', () => {
  beforeEach(() => spotifyFetchMock.mockReset());
  afterEach(() => vi.resetAllMocks());

  it('returns normalized SearchResult[] on happy path', async () => {
    spotifyFetchMock.mockResolvedValueOnce(
      makeOk({
        tracks: {
          items: [
            {
              id: 'sp-1',
              name: 'Karma Police',
              artists: [{ name: 'Radiohead' }],
              album: {
                images: [{ url: 'http://img/sp-1.jpg' }],
              },
              duration_ms: 264000,
            },
            {
              id: 'sp-2',
              name: 'Creep',
              artists: [{ name: 'Radiohead' }, { name: 'TLC' }],
              album: { images: [] },
              duration_ms: 238000,
            },
          ],
        },
      }),
    );

    const out = await searchSpotifyTracks('user-1', 'Radiohead', 10);
    expect(out.length).toBe(2);
    expect(out[0]).toEqual({
      externalTrackId: 'sp-1',
      title: 'Karma Police',
      artist: 'Radiohead',
      thumbnailUrl: 'http://img/sp-1.jpg',
      durationSec: 264,
    });
    expect(out[1].artist).toBe('Radiohead, TLC');
    expect(out[1].thumbnailUrl).toBeNull();
    expect(out[1].durationSec).toBe(238);
  });

  it('returns [] when Spotify returns empty items', async () => {
    spotifyFetchMock.mockResolvedValueOnce(
      makeOk({ tracks: { items: [] } }),
    );
    const out = await searchSpotifyTracks('user-1', 'asdfghjkl', 10);
    expect(out).toEqual([]);
  });

  it('clamps limit to 20 max', async () => {
    spotifyFetchMock.mockResolvedValueOnce(makeOk({ tracks: { items: [] } }));
    await searchSpotifyTracks('user-1', 'foo', 99);
    const calledPath = spotifyFetchMock.mock.calls[0][1] as string;
    expect(calledPath).toContain('limit=20');
  });

  it('URL-encodes the query', async () => {
    spotifyFetchMock.mockResolvedValueOnce(makeOk({ tracks: { items: [] } }));
    await searchSpotifyTracks('user-1', 'hello world & friends', 5);
    const calledPath = spotifyFetchMock.mock.calls[0][1] as string;
    expect(calledPath).toContain('q=hello%20world%20%26%20friends');
    expect(calledPath).toContain('type=track');
    expect(calledPath).toContain('limit=5');
  });

  it('propagates SpotifyUnavailableError without swallowing', async () => {
    spotifyFetchMock.mockRejectedValueOnce(
      new SpotifyUnavailableError('invalid_grant', 'revoked'),
    );
    await expect(
      searchSpotifyTracks('user-1', 'x', 5),
    ).rejects.toBeInstanceOf(SpotifyUnavailableError);
  });
});
