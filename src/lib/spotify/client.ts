// @MX:SPEC: SPEC-SPOTIFY-001
// Token-aware Spotify API client. Reads the per-user access/refresh tokens
// from `music_connections`, refreshes on near-expiry or 401, persists the
// refreshed tokens back to Supabase, and retries once on 429 / 401.
//
// Server-only module: depends on `getSupabaseAdmin()` which uses the service
// role key. Never import from a client component.

import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { refreshAccessToken, SpotifyAuthError } from '@/lib/spotify/oauth';

const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';
/** Refresh this many ms before the stored `expires_at` to give the network
 *  call time to complete before the old token is rejected. */
const REFRESH_LEEWAY_MS = 60_000;

/**
 * Signals that the owner's Spotify connection cannot be used right now —
 * typically because the refresh token was revoked (`invalid_grant`) or the
 * user deleted the app from their Spotify account. Room pages should map
 * this to the existing `{ reason: 'unavailable' }` UX (REQ-SPOT-005).
 *
 * IMPORTANT: we deliberately do NOT delete the `music_connections` row on
 * this error. Owner-initiated reconnect overwrites the row; automatic
 * deletion would hide the problem and bypass the owner-facing reconnect
 * banner.
 */
export class SpotifyUnavailableError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'SpotifyUnavailableError';
    this.code = code;
  }
}

interface ConnectionRow {
  user_id: string;
  access_token: string | null;
  refresh_token: string | null;
  expires_at: string | null;
  scope: string | null;
}

// @MX:ANCHOR: per-user in-flight refresh dedup map. Multiple concurrent
// spotifyFetch() callers for the same user coalesce onto the same refresh
// Promise (E5). Keyed by user_id. Cleared on resolve/reject.
// @MX:REASON: race-condition-and-external-dependency
const inflightRefreshes = new Map<string, Promise<string>>();

/** Test-only hook: reset module-level state between unit tests. */
export function __resetSpotifyClientState(): void {
  inflightRefreshes.clear();
}

/**
 * Perform a Spotify Web API request on behalf of `userId`, transparently
 * handling token refresh (proactive + on-401), 429 Retry-After, and
 * revocation. Returns the raw `Response` — caller decides how to parse.
 *
 * @param userId         Internal users.id of the row whose Spotify
 *                       connection should be used.
 * @param path           Path below `https://api.spotify.com/v1` (leading
 *                       slash optional).
 * @param init           Standard `fetch` init; Authorization header is
 *                       overwritten.
 */
// @MX:WARN: concurrent refresh + external HTTP; mutations serialized via
// `inflightRefreshes`. Retries are capped at 1 per failure class (401, 429)
// to avoid tight loops.
// @MX:REASON: race-condition-and-external-dependency
export async function spotifyFetch(
  userId: string,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const row = await readConnection(userId);
  let accessToken = row.access_token;

  if (needsProactiveRefresh(row.expires_at)) {
    accessToken = await refreshAndPersist(userId, row.refresh_token);
  }
  if (!accessToken) {
    throw new SpotifyUnavailableError('no_access_token', 'Spotify connection has no access token');
  }

  let res = await callSpotify(path, init, accessToken);

  if (res.status === 401) {
    accessToken = await refreshAndPersist(userId, row.refresh_token);
    res = await callSpotify(path, init, accessToken);
  }

  if (res.status === 429) {
    const retryAfterSec = Number(res.headers.get('retry-after') ?? '1');
    await sleep(Math.max(0, retryAfterSec) * 1000);
    res = await callSpotify(path, init, accessToken);
  }

  return res;
}

async function callSpotify(path: string, init: RequestInit, accessToken: string): Promise<Response> {
  const url = path.startsWith('http')
    ? path
    : `${SPOTIFY_API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${accessToken}`);
  return fetch(url, { ...init, headers });
}

async function readConnection(userId: string): Promise<ConnectionRow> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('music_connections')
    .select('user_id, access_token, refresh_token, expires_at, scope')
    .eq('user_id', userId)
    .eq('provider', 'spotify')
    .single();

  if (!data) {
    throw new SpotifyUnavailableError('no_connection', 'No Spotify connection for user');
  }
  return data as ConnectionRow;
}

function needsProactiveRefresh(expiresAt: string | null): boolean {
  if (!expiresAt) return true;
  const t = Date.parse(expiresAt);
  if (Number.isNaN(t)) return true;
  return t - Date.now() < REFRESH_LEEWAY_MS;
}

// @MX:WARN: concurrency-sensitive — uses a module-level Map to coalesce
// parallel refreshes for the same user.
// @MX:REASON: race-condition-and-external-dependency
async function refreshAndPersist(userId: string, refreshToken: string | null): Promise<string> {
  if (!refreshToken) {
    throw new SpotifyUnavailableError('no_refresh_token', 'Spotify refresh token missing');
  }
  const existing = inflightRefreshes.get(userId);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const token = await refreshAccessToken(refreshToken);
      const expiresAt = new Date(Date.now() + token.expiresIn * 1000).toISOString();
      const supabase = getSupabaseAdmin();
      await supabase
        .from('music_connections')
        .update({
          access_token: token.accessToken,
          expires_at: expiresAt,
          ...(token.refreshToken ? { refresh_token: token.refreshToken } : {}),
          ...(token.scope ? { scope: token.scope } : {}),
        })
        .eq('user_id', userId)
        .eq('provider', 'spotify');
      return token.accessToken;
    } catch (err) {
      if (err instanceof SpotifyAuthError && err.code === 'invalid_grant') {
        throw new SpotifyUnavailableError('invalid_grant', 'Spotify refresh token revoked');
      }
      throw err;
    } finally {
      inflightRefreshes.delete(userId);
    }
  })();

  inflightRefreshes.set(userId, promise);
  return promise;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
