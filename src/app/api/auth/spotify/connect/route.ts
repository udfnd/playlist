// @MX:SPEC: SPEC-SPOTIFY-001
// GET /api/auth/spotify/connect — kicks off the Spotify Authorization Code
// flow. Requires an authenticated NextAuth session (userId carried on the
// signed cookie payload is redundant with the session, but keeps the
// callback self-contained). The state cookie is HMAC-signed via
// `signState` so tampering is detected even though cookies are untrusted
// transport.

import { randomBytes } from 'node:crypto';
import { auth } from '@/auth';
import { buildAuthorizeUrl, signState } from '@/lib/spotify/oauth';

const STATE_COOKIE_NAME = '__Host-spotify_oauth_state';
const STATE_COOKIE_MAX_AGE_SEC = 300;
const SPOTIFY_SCOPES = [
  'playlist-read-private',
  'playlist-read-collaborative',
  'user-read-email',
] as const;

function requireAuthSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error('AUTH_SECRET is not set. Required to sign the Spotify OAuth state cookie.');
  }
  return secret;
}

/** Only in-site paths are accepted for returnTo; anything else falls back to /home. */
function sanitizeReturnTo(raw: string | null): string {
  if (!raw) return '/home';
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/home';
  return raw;
}

export async function GET(request: Request): Promise<Response> {
  const session = await auth();
  if (!session?.userId) {
    return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const url = new URL(request.url);
  const returnTo = sanitizeReturnTo(url.searchParams.get('returnTo'));
  const reconnect = url.searchParams.get('reconnect') === '1';

  const nonce = randomBytes(32).toString('base64url');
  const payload = JSON.stringify({ nonce, returnTo });
  const signed = signState(payload, requireAuthSecret());

  const authorizeUrl = buildAuthorizeUrl({
    state: nonce,
    scopes: SPOTIFY_SCOPES,
    showDialog: reconnect,
  });

  const cookie = [
    `${STATE_COOKIE_NAME}=${encodeURIComponent(signed)}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    `Max-Age=${STATE_COOKIE_MAX_AGE_SEC}`,
  ].join('; ');

  return new Response(null, {
    status: 302,
    headers: {
      Location: authorizeUrl,
      'Set-Cookie': cookie,
    },
  });
}
