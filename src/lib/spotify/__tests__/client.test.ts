// @MX:SPEC: SPEC-SPOTIFY-001
// Tests for spotifyFetch (T-002 / REQ-SPOT-002, REQ-SPOT-005, E1, E3, E5).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { makeSupabaseStub, stubFetchSequence, jsonResponse } from './_helpers';

// Module-level mock for @/lib/supabase/admin; each test rewires via vi.mocked.
vi.mock('@/lib/supabase/admin', () => ({
  getSupabaseAdmin: vi.fn(),
}));

import { getSupabaseAdmin } from '@/lib/supabase/admin';
import {
  spotifyFetch,
  SpotifyUnavailableError,
  __resetSpotifyClientState,
} from '@/lib/spotify/client';

const USER_ID = 'user-1';

beforeEach(() => {
  process.env.SPOTIFY_CLIENT_ID = 'client-id-123';
  process.env.SPOTIFY_CLIENT_SECRET = 'client-secret-xyz';
  process.env.SPOTIFY_REDIRECT_URI = 'https://example.test/api/auth/spotify/callback';
  __resetSpotifyClientState();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function seedConnection(row: Record<string, unknown>) {
  const stub = makeSupabaseStub(row);
  vi.mocked(getSupabaseAdmin).mockReturnValue(
    stub.client as unknown as ReturnType<typeof getSupabaseAdmin>,
  );
  return stub;
}

describe('spotifyFetch', () => {
  it('refreshes proactively when expires_at is in the near-future, updates DB, retries request', async () => {
    const stub = seedConnection({
      user_id: USER_ID,
      provider: 'spotify',
      access_token: 'old-at',
      refresh_token: 'rt',
      expires_at: new Date(Date.now() + 10_000).toISOString(), // < 60s buffer
    });

    const tokenRes = jsonResponse({
      access_token: 'new-at',
      expires_in: 3600,
      token_type: 'Bearer',
      scope: 'playlist-read-private',
    });
    const apiRes = jsonResponse({ items: [] });
    const fetchMock = stubFetchSequence([tokenRes, apiRes]);

    const res = await spotifyFetch(USER_ID, '/me/playlists');
    expect(res.status).toBe(200);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0])).toBe('https://accounts.spotify.com/api/token');
    expect(String(fetchMock.mock.calls[1][0])).toBe('https://api.spotify.com/v1/me/playlists');
    const apiInit = fetchMock.mock.calls[1][1] as RequestInit;
    const apiHeaders = apiInit.headers as Headers;
    expect(apiHeaders.get('Authorization')).toBe('Bearer new-at');

    const updateCall = stub.calls.find((c) => c.op === 'update');
    expect(updateCall).toBeDefined();
    expect((updateCall!.args[0] as Record<string, unknown>).access_token).toBe('new-at');
  });

  it('on 401 once: refresh then retry succeeds (single retry)', async () => {
    seedConnection({
      user_id: USER_ID,
      provider: 'spotify',
      access_token: 'good-looking-at',
      refresh_token: 'rt',
      expires_at: new Date(Date.now() + 3_600_000).toISOString(), // not near expiry
    });

    const unauthorized = new Response(JSON.stringify({ error: { status: 401 } }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
    const tokenRes = jsonResponse({
      access_token: 'new-at',
      expires_in: 3600,
      token_type: 'Bearer',
    });
    const ok = jsonResponse({ ok: true });
    const fetchMock = stubFetchSequence([unauthorized, tokenRes, ok]);

    const res = await spotifyFetch(USER_ID, '/me/playlists');
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[1][0])).toBe('https://accounts.spotify.com/api/token');
  });

  it('on 429 with Retry-After: 1, sleeps then retries once', async () => {
    vi.useFakeTimers();
    seedConnection({
      user_id: USER_ID,
      provider: 'spotify',
      access_token: 'at',
      refresh_token: 'rt',
      expires_at: new Date(Date.now() + 3_600_000).toISOString(),
    });

    const rate = new Response('{}', {
      status: 429,
      headers: { 'content-type': 'application/json', 'retry-after': '1' },
    });
    const ok = jsonResponse({ ok: true });
    const fetchMock = stubFetchSequence([rate, ok]);

    const pending = spotifyFetch(USER_ID, '/me/playlists');
    // Allow the initial fetch microtask chain to settle before timer advance.
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000);
    const res = await pending;
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('invalid_grant during refresh throws SpotifyUnavailableError and does NOT delete the row', async () => {
    const stub = seedConnection({
      user_id: USER_ID,
      provider: 'spotify',
      access_token: 'old-at',
      refresh_token: 'rt',
      expires_at: new Date(Date.now() - 1000).toISOString(), // expired
    });

    const invalidGrant = new Response(JSON.stringify({ error: 'invalid_grant' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
    stubFetchSequence([invalidGrant]);

    await expect(spotifyFetch(USER_ID, '/me/playlists')).rejects.toBeInstanceOf(
      SpotifyUnavailableError,
    );

    const deleteCall = stub.calls.find((c) => c.op === 'delete');
    expect(deleteCall).toBeUndefined();
  });

  it('deduplicates concurrent refreshes: parallel calls with expired token trigger ONE token request', async () => {
    seedConnection({
      user_id: USER_ID,
      provider: 'spotify',
      access_token: 'old-at',
      refresh_token: 'rt',
      expires_at: new Date(Date.now() - 1000).toISOString(),
    });

    const tokenRes = jsonResponse({
      access_token: 'new-at',
      expires_in: 3600,
      token_type: 'Bearer',
    });
    const fetchMock = stubFetchSequence([
      tokenRes,
      jsonResponse({ a: 1 }),
      jsonResponse({ b: 2 }),
    ]);

    const [r1, r2] = await Promise.all([
      spotifyFetch(USER_ID, '/me/playlists'),
      spotifyFetch(USER_ID, '/me'),
    ]);

    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);

    const tokenCalls = fetchMock.mock.calls.filter(
      ([u]) => String(u) === 'https://accounts.spotify.com/api/token',
    );
    expect(tokenCalls).toHaveLength(1);
  });
});
