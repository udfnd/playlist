// @MX:SPEC: SPEC-SPOTIFY-001
// GET /api/auth/spotify/callback — completes the Authorization Code flow.
// Verifies the HMAC-signed state cookie before touching the DB so a
// forged callback can never trigger an upsert (E4 / CSRF surface).
//
// Token storage: upserts `music_connections` keyed `(user_id, provider='spotify')`.
// The `provider_account_id` column is NOT NULL in the schema; for MVP we
// store a placeholder and defer a `/me` round-trip. TODO: fetch the real
// Spotify profile id and backfill on next refresh so it is queryable.

import { auth } from '@/auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import {
  exchangeCodeForToken,
  SpotifyAuthError,
  verifyState,
} from '@/lib/spotify/oauth';

const STATE_COOKIE_NAME = '__Host-spotify_oauth_state';

function clearStateCookie(): string {
  return `${STATE_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

function requireAuthSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error('AUTH_SECRET is not set.');
  }
  return secret;
}

function readStateCookie(request: Request): string | null {
  const raw = request.headers.get('cookie');
  if (!raw) return null;
  const parts = raw.split(';');
  for (const part of parts) {
    const [name, ...rest] = part.trim().split('=');
    if (name === STATE_COOKIE_NAME) {
      return decodeURIComponent(rest.join('='));
    }
  }
  return null;
}

function sanitizeReturnTo(raw: string | null | undefined): string {
  if (!raw) return '/home';
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/home';
  return raw;
}

function badRequest(): Response {
  return new Response(JSON.stringify({ error: '잘못된 요청입니다.' }), {
    status: 400,
    headers: {
      'content-type': 'application/json',
      'Set-Cookie': clearStateCookie(),
    },
  });
}

function redirectWithClear(location: string): Response {
  return new Response(null, {
    status: 302,
    headers: {
      Location: location,
      'Set-Cookie': clearStateCookie(),
    },
  });
}

// @MX:WARN: CSRF surface — HMAC state verification MUST run before any DB
// mutation. Any code path that reaches exchangeCodeForToken or upsert
// without a successful verifyState match is a vulnerability.
// @MX:REASON: csrf-surface
export async function GET(request: Request): Promise<Response> {
  const session = await auth();
  if (!session?.userId) {
    return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const cookieValue = readStateCookie(request);
  if (!cookieValue) return badRequest();

  const url = new URL(request.url);
  const queryState = url.searchParams.get('state');
  const code = url.searchParams.get('code');
  const spotifyError = url.searchParams.get('error');

  const verified = verifyState(cookieValue, requireAuthSecret());
  if (!verified) return badRequest();

  let payload: { nonce?: unknown; returnTo?: unknown };
  try {
    payload = JSON.parse(verified);
  } catch {
    return badRequest();
  }
  const nonce = typeof payload.nonce === 'string' ? payload.nonce : null;
  const returnTo = sanitizeReturnTo(
    typeof payload.returnTo === 'string' ? payload.returnTo : null,
  );
  if (!nonce || nonce !== queryState) return badRequest();

  if (spotifyError) {
    return redirectWithClear('/home?spotify_error=denied');
  }
  if (!code) return badRequest();

  let token;
  try {
    token = await exchangeCodeForToken(code);
  } catch (err) {
    if (err instanceof SpotifyAuthError) {
      return redirectWithClear('/home?spotify_error=token_exchange_failed');
    }
    throw err;
  }

  const expiresAt = new Date(Date.now() + token.expiresIn * 1000).toISOString();
  const supabase = getSupabaseAdmin();
  // TODO(SPEC-SPOTIFY-001): resolve real Spotify profile id via /me and
  // backfill provider_account_id; placeholder 'spotify' keeps the schema's
  // NOT NULL constraint satisfied for MVP.
  await supabase.from('music_connections').upsert(
    {
      user_id: session.userId,
      provider: 'spotify',
      provider_account_id: 'spotify',
      access_token: token.accessToken,
      refresh_token: token.refreshToken,
      expires_at: expiresAt,
      scope: token.scope,
    },
    { onConflict: 'user_id,provider' },
  );

  return redirectWithClear(returnTo);
}
