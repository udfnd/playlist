// @MX:SPEC: SPEC-SPOTIFY-001
// Tests for GET /api/auth/spotify/connect (T-004 / REQ-SPOT-001).
// @vitest-environment node

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@/auth', () => ({
  auth: vi.fn(),
}));

import { auth } from '@/auth';
import { verifyState } from '@/lib/spotify/oauth';

const SECRET = 'test-secret';

async function loadRoute() {
  return await import('@/app/api/auth/spotify/connect/route');
}

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('SPOTIFY_CLIENT_ID', 'cid');
  vi.stubEnv('SPOTIFY_CLIENT_SECRET', 'csec');
  vi.stubEnv('SPOTIFY_REDIRECT_URI', 'http://127.0.0.1:3000/api/auth/spotify/callback');
  vi.stubEnv('AUTH_SECRET', SECRET);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

function getSetCookie(res: Response): string {
  const all = res.headers.getSetCookie?.() ?? [];
  if (all.length > 0) return all[0];
  const single = res.headers.get('set-cookie');
  if (!single) throw new Error('no set-cookie header');
  return single;
}

function parseCookie(res: Response): { name: string; value: string; attrs: string } {
  const setCookie = getSetCookie(res);
  const [pair, ...rest] = setCookie.split(';');
  const eq = pair.indexOf('=');
  return {
    name: pair.slice(0, eq),
    value: decodeURIComponent(pair.slice(eq + 1)),
    attrs: rest.join(';'),
  };
}

describe('GET /api/auth/spotify/connect', () => {
  it('returns 401 JSON when no session', async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    const { GET } = await loadRoute();

    const res = await GET(new Request('http://localhost/api/auth/spotify/connect'));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('로그인이 필요합니다.');
  });

  it('returns 302 with authorize URL, state cookie, and required scopes', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: 'u-1', handle: 'h' } as never);
    const { GET } = await loadRoute();

    const res = await GET(new Request('http://localhost/api/auth/spotify/connect'));
    expect(res.status).toBe(302);

    const location = res.headers.get('location');
    expect(location).toBeTruthy();
    const url = new URL(location!);
    expect(url.origin + url.pathname).toBe('https://accounts.spotify.com/authorize');
    const stateNonce = url.searchParams.get('state');
    expect(stateNonce).toBeTruthy();
    expect(url.searchParams.get('client_id')).toBe('cid');

    const scopes = (url.searchParams.get('scope') ?? '').split(' ');
    expect(scopes).toEqual(
      expect.arrayContaining([
        'playlist-read-private',
        'playlist-read-collaborative',
        'user-read-email',
      ]),
    );

    const cookie = parseCookie(res);
    expect(cookie.name).toBe('__Host-spotify_oauth_state');
    expect(cookie.attrs).toMatch(/HttpOnly/i);
    expect(cookie.attrs).toMatch(/Secure/i);
    expect(cookie.attrs).toMatch(/SameSite=Lax/i);
    expect(cookie.attrs).toMatch(/Path=\//);
    expect(cookie.attrs).toMatch(/Max-Age=300/);

    // The cookie value is the signed blob; verifying it yields back the JSON payload.
    const verified = verifyState(cookie.value, SECRET);
    expect(verified).toBeTruthy();
    const payload = JSON.parse(verified!);
    expect(payload.nonce).toBe(stateNonce);
    expect(payload.returnTo).toBe('/home');
  });

  it('preserves a safe ?returnTo=/home/new in the state payload', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: 'u-1' } as never);
    const { GET } = await loadRoute();

    const res = await GET(
      new Request('http://localhost/api/auth/spotify/connect?returnTo=%2Fhome%2Fnew'),
    );
    const cookie = parseCookie(res);
    const verified = verifyState(cookie.value, SECRET);
    const payload = JSON.parse(verified!);
    expect(payload.returnTo).toBe('/home/new');
  });

  it('rejects external returnTo and falls back to /home', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: 'u-1' } as never);
    const { GET } = await loadRoute();

    const res = await GET(
      new Request(
        'http://localhost/api/auth/spotify/connect?returnTo=https%3A%2F%2Fevil.example',
      ),
    );
    const cookie = parseCookie(res);
    const verified = verifyState(cookie.value, SECRET);
    const payload = JSON.parse(verified!);
    expect(payload.returnTo).toBe('/home');
  });

  it('adds show_dialog=true when ?reconnect=1', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: 'u-1' } as never);
    const { GET } = await loadRoute();

    const res = await GET(
      new Request('http://localhost/api/auth/spotify/connect?reconnect=1'),
    );
    const url = new URL(res.headers.get('location')!);
    expect(url.searchParams.get('show_dialog')).toBe('true');
  });
});
