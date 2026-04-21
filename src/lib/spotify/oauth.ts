// @MX:SPEC: SPEC-SPOTIFY-001
// Pure helpers for the Spotify Authorization Code flow.
// Server-side only: never import this module from a client component — it
// touches SPOTIFY_CLIENT_SECRET. No DB, no Next/Request dependencies; see
// `client.ts` for the persistence layer and `fetch-playlist.ts` for the
// playlist normalizer.

import { createHmac, timingSafeEqual } from 'node:crypto';

const SPOTIFY_AUTHORIZE_URL = 'https://accounts.spotify.com/authorize';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';

/**
 * Spotify-specific error surfaced through the OAuth flow.
 *
 * `code` mirrors Spotify's documented `error` field from the token endpoint
 * (e.g. `invalid_grant`, `invalid_client`). Callers that care about the
 * "refresh_token revoked" UX match on `code === 'invalid_grant'`.
 */
export class SpotifyAuthError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'SpotifyAuthError';
    this.code = code;
  }
}

export interface AuthorizeUrlInput {
  state: string;
  scopes: readonly string[];
  showDialog?: boolean;
}

/**
 * Construct the `https://accounts.spotify.com/authorize` URL for the
 * Authorization Code flow. Reads client id / redirect URI from env at call
 * time (not module load) so tests can stub env vars per-case.
 */
export function buildAuthorizeUrl(input: AuthorizeUrlInput): string {
  const clientId = requireEnv('SPOTIFY_CLIENT_ID');
  const redirectUri = requireEnv('SPOTIFY_REDIRECT_URI');

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    state: input.state,
    scope: input.scopes.join(' '),
  });
  if (input.showDialog) params.set('show_dialog', 'true');

  return `${SPOTIFY_AUTHORIZE_URL}?${params.toString()}`;
}

/**
 * HMAC-sign a random nonce so we can round-trip state through an untrusted
 * cookie and still detect tampering on callback. Returns `<nonce>.<sigHex>`.
 */
export function signState(nonce: string, secret: string): string {
  const sig = createHmac('sha256', secret).update(nonce).digest('hex');
  return `${nonce}.${sig}`;
}

/**
 * Verify a signed state blob. Returns the original nonce on success, or
 * `null` for any shape mismatch / bad signature. Uses `timingSafeEqual` to
 * avoid timing-oracle leakage on the signature comparison.
 */
export function verifyState(signed: string, secret: string): string | null {
  const dot = signed.indexOf('.');
  if (dot <= 0 || dot === signed.length - 1) return null;
  const nonce = signed.slice(0, dot);
  const providedHex = signed.slice(dot + 1);
  if (!nonce || !providedHex) return null;

  const expectedHex = createHmac('sha256', secret).update(nonce).digest('hex');
  if (providedHex.length !== expectedHex.length) return null;

  try {
    const a = Buffer.from(providedHex, 'hex');
    const b = Buffer.from(expectedHex, 'hex');
    if (a.length !== b.length || a.length === 0) return null;
    return timingSafeEqual(a, b) ? nonce : null;
  } catch {
    return null;
  }
}

/**
 * Accepts either a raw Spotify playlist id (22 base62 chars) or an
 * `open.spotify.com/playlist/{id}` URL (with or without query params) and
 * returns the bare id. Returns `null` on anything we cannot confidently
 * parse.
 */
export function extractSpotifyPlaylistId(input: string): string | null {
  const trimmed = input?.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    if (url.hostname === 'open.spotify.com' || url.hostname === 'play.spotify.com') {
      const match = url.pathname.match(/^\/playlist\/([A-Za-z0-9]{22})$/);
      return match ? match[1] : null;
    }
  } catch {
    // Not a URL — fall through to raw-id check.
  }

  return /^[A-Za-z0-9]{22}$/.test(trimmed) ? trimmed : null;
}

export interface SpotifyTokenResponse {
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number;
  scope: string | null;
  tokenType: string;
}

interface RawTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
}

/**
 * Exchange an authorization code for tokens. Called from the callback route
 * handler; throws `SpotifyAuthError` on non-2xx or a malformed payload.
 */
export async function exchangeCodeForToken(code: string): Promise<SpotifyTokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: requireEnv('SPOTIFY_REDIRECT_URI'),
  });
  return postToken(body);
}

/**
 * Refresh an access token. Spotify *may* omit `refresh_token` on refresh; in
 * that case the persisted one is still valid and should be kept as-is.
 */
export async function refreshAccessToken(refreshToken: string): Promise<SpotifyTokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });
  return postToken(body);
}

async function postToken(body: URLSearchParams): Promise<SpotifyTokenResponse> {
  const clientId = requireEnv('SPOTIFY_CLIENT_ID');
  const clientSecret = requireEnv('SPOTIFY_CLIENT_SECRET');
  const auth = 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const res = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: auth,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  const payload = (await res.json().catch(() => ({}))) as RawTokenResponse;
  return parseTokenResponse(res.ok, payload);
}

function parseTokenResponse(ok: boolean, payload: RawTokenResponse): SpotifyTokenResponse {
  if (!ok || payload.error) {
    const code = payload.error ?? 'spotify_token_error';
    throw new SpotifyAuthError(code, payload.error_description ?? code);
  }
  if (!payload.access_token || typeof payload.expires_in !== 'number') {
    throw new SpotifyAuthError('invalid_response', 'Spotify token response missing required fields');
  }
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token ?? null,
    expiresIn: payload.expires_in,
    scope: payload.scope ?? null,
    tokenType: payload.token_type ?? 'Bearer',
  };
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set. See SPEC-SPOTIFY-001 plan for required env vars.`);
  }
  return value;
}
