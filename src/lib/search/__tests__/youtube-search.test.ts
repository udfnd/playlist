// @MX:SPEC: SPEC-SOCIAL-001
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { searchYouTubeTracks } from '../youtube-search';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

function ok(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

describe('searchYouTubeTracks', () => {
  it('happy path: combines /search and /videos and normalizes results', async () => {
    fetchMock
      .mockResolvedValueOnce(
        ok({
          items: [
            {
              id: { videoId: 'vid-1' },
              snippet: {
                title: 'Song A',
                channelTitle: 'Artist A - Topic',
                thumbnails: {
                  default: { url: 'd1' },
                  medium: { url: 'm1' },
                },
              },
            },
            {
              id: { videoId: 'vid-2' },
              snippet: {
                title: 'Song B',
                channelTitle: 'Channel B',
                thumbnails: { default: { url: 'd2' } },
              },
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        ok({
          items: [
            { id: 'vid-1', contentDetails: { duration: 'PT3M30S' } },
            { id: 'vid-2', contentDetails: { duration: 'PT4M0S' } },
          ],
        }),
      );

    const out = await searchYouTubeTracks(
      { kind: 'apiKey', key: 'KEY' },
      'lofi',
      10,
    );

    expect(out).toEqual([
      {
        externalTrackId: 'vid-1',
        title: 'Song A',
        artist: 'Artist A',
        thumbnailUrl: 'm1',
        durationSec: 210,
      },
      {
        externalTrackId: 'vid-2',
        title: 'Song B',
        artist: 'Channel B',
        thumbnailUrl: 'd2',
        durationSec: 240,
      },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const searchUrl = fetchMock.mock.calls[0][0] as string;
    expect(searchUrl).toContain('/search?');
    expect(searchUrl).toContain('q=lofi');
    expect(searchUrl).toContain('maxResults=10');
    expect(searchUrl).toContain('key=KEY');
    const videosUrl = fetchMock.mock.calls[1][0] as string;
    expect(videosUrl).toContain('/videos?');
    expect(videosUrl).toContain('id=vid-1%2Cvid-2');
  });

  it('returns [] when /search has no items (no /videos call)', async () => {
    fetchMock.mockResolvedValueOnce(ok({ items: [] }));
    const out = await searchYouTubeTracks(
      { kind: 'apiKey', key: 'KEY' },
      'asdf',
      10,
    );
    expect(out).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws on /search 4xx error', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('forbidden', { status: 403 }),
    );
    await expect(
      searchYouTubeTracks({ kind: 'apiKey', key: 'KEY' }, 'x', 10),
    ).rejects.toThrow();
  });

  it('clamps limit to 20 (maxResults)', async () => {
    fetchMock.mockResolvedValueOnce(ok({ items: [] }));
    await searchYouTubeTracks({ kind: 'apiKey', key: 'KEY' }, 'q', 99);
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('maxResults=20');
  });

  it('uses Authorization header for OAuth auth (no key= in query)', async () => {
    fetchMock.mockResolvedValueOnce(ok({ items: [] }));
    await searchYouTubeTracks(
      { kind: 'oauth', accessToken: 'tok-abc' },
      'q',
      5,
    );
    const url = fetchMock.mock.calls[0][0] as string;
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(url).not.toContain('key=');
    const headers = new Headers(init.headers);
    expect(headers.get('Authorization')).toBe('Bearer tok-abc');
  });
});
