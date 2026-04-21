// @MX:SPEC: SPEC-SPOTIFY-001
// Tests for GET /api/auth/spotify/callback (T-005 / REQ-SPOT-001, E4).
// @vitest-environment node

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { makeSupabaseStub } from '@/lib/spotify/__tests__/_helpers';

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/supabase/admin', () => ({ getSupabaseAdmin: vi.fn() }));

import { auth } from '@/auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { signState } from '@/lib/spotify/oauth';

const SECRET = 'test-secret';
const USER_ID = 'u-1';

async function loadRoute() {
  return await import('@/app/api/auth/spotify/callback/route');
}

function makeStateCookie(nonce: string, returnTo: string): string {
  const payload = JSON.stringify({ nonce, returnTo });
  return signState(payload, SECRET);
}

function reqWith(cookie: string | null, query: Record<string, string>): Request {
  const url = new URL('http://localhost/api/auth/spotify/callback');
  Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v));
  const headers: Record<string, string> = {};
  if (cookie) headers['cookie'] = `__Host-spotify_oauth_state=${encodeURIComponent(cookie)}`;
  return new Request(url.toString(), { headers });
}

function seedSupabase() {
  const stub = makeSupabaseStub({});
  vi.mocked(getSupabaseAdmin).mockReturnValue(
    stub.client as unknown as ReturnType<typeof getSupabaseAdmin>,
  );
  return stub;
}

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('SPOTIFY_CLIENT_ID', 'cid');
  vi.stubEnv('SPOTIFY_CLIENT_SECRET', 'csec');
  vi.stubEnv('SPOTIFY_REDIRECT_URI', 'http://127.0.0.1:3000/api/auth/spotify/callback');
  vi.stubEnv('AUTH_SECRET', SECRET);
  vi.mocked(auth).mockResolvedValue({ userId: USER_ID } as never);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('GET /api/auth/spotify/callback', () => {
  it('returns 400 with clear cookie when state cookie is missing', async () => {
    const stub = seedSupabase();
    const { GET } = await loadRoute();
    const res = await GET(reqWith(null, { code: 'abc', state: 'nonce' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('잘못된 요청입니다.');
    expect(stub.calls.find((c) => c.op === 'upsert')).toBeUndefined();
    const setCookie = res.headers.getSetCookie?.()[0] ?? res.headers.get('set-cookie');
    expect(setCookie).toMatch(/Max-Age=0/);
  });

  it('returns 400 when cookie signature is tampered (no DB write, clears cookie)', async () => {
    const stub = seedSupabase();
    const good = makeStateCookie('nonce-1', '/home');
    const bad = good.slice(0, -1) + (good.slice(-1) === 'a' ? 'b' : 'a');
    const { GET } = await loadRoute();
    const res = await GET(reqWith(bad, { code: 'abc', state: 'nonce-1' }));
    expect(res.status).toBe(400);
    expect(stub.calls.find((c) => c.op === 'upsert')).toBeUndefined();
    const setCookie = res.headers.getSetCookie?.()[0] ?? res.headers.get('set-cookie');
    expect(setCookie).toMatch(/Max-Age=0/);
  });

  it('returns 400 when nonce in payload does not match query state (no DB write)', async () => {
    const stub = seedSupabase();
    const cookie = makeStateCookie('nonce-A', '/home');
    const { GET } = await loadRoute();
    const res = await GET(reqWith(cookie, { code: 'abc', state: 'nonce-B' }));
    expect(res.status).toBe(400);
    expect(stub.calls.find((c) => c.op === 'upsert')).toBeUndefined();
  });

  it('on ?error=access_denied: redirects to /home?spotify_error=denied without DB write', async () => {
    const stub = seedSupabase();
    const cookie = makeStateCookie('nonce-1', '/home/new');
    const { GET } = await loadRoute();
    const res = await GET(reqWith(cookie, { error: 'access_denied', state: 'nonce-1' }));
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/home?spotify_error=denied');
    expect(stub.calls.find((c) => c.op === 'upsert')).toBeUndefined();
  });

  it('valid flow: exchanges code, upserts music_connections, redirects to returnTo, clears cookie', async () => {
    const stub = seedSupabase();
    const tokenRes = new Response(
      JSON.stringify({
        access_token: 'new-at',
        refresh_token: 'new-rt',
        expires_in: 3600,
        scope: 'playlist-read-private',
        token_type: 'Bearer',
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
    vi.stubGlobal('fetch', vi.fn(async () => tokenRes));

    const cookie = makeStateCookie('nonce-1', '/home/new');
    const { GET } = await loadRoute();
    const res = await GET(reqWith(cookie, { code: 'auth-code', state: 'nonce-1' }));

    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/home/new');

    const upsert = stub.calls.find((c) => c.op === 'upsert');
    expect(upsert).toBeDefined();
    const row = upsert!.args[0] as Record<string, unknown>;
    expect(row.user_id).toBe(USER_ID);
    expect(row.provider).toBe('spotify');
    expect(row.access_token).toBe('new-at');
    expect(row.refresh_token).toBe('new-rt');
    expect(row.scope).toBe('playlist-read-private');
    expect(typeof row.expires_at).toBe('string');
    const conflictOpt = upsert!.args[1] as { onConflict?: string } | undefined;
    expect(conflictOpt?.onConflict).toBe('user_id,provider');

    const setCookie = res.headers.getSetCookie?.()[0] ?? res.headers.get('set-cookie');
    expect(setCookie).toMatch(/Max-Age=0/);
  });
});
