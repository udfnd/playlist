// @MX:SPEC: SPEC-SPOTIFY-001
// Specification tests for Spotify OAuth primitives (T-001 / REQ-SPOT-001).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  buildAuthorizeUrl,
  signState,
  verifyState,
  extractSpotifyPlaylistId,
  exchangeCodeForToken,
  refreshAccessToken,
  SpotifyAuthError,
} from '@/lib/spotify/oauth';

const SECRET = 'test-secret-never-used-in-prod';

beforeEach(() => {
  process.env.SPOTIFY_CLIENT_ID = 'client-id-123';
  process.env.SPOTIFY_CLIENT_SECRET = 'client-secret-xyz';
  process.env.SPOTIFY_REDIRECT_URI = 'https://example.test/api/auth/spotify/callback';
  process.env.SPOTIFY_STATE_SECRET = SECRET;
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('buildAuthorizeUrl', () => {
  it('includes client_id, redirect_uri, state, space-joined scopes, response_type=code', () => {
    const url = buildAuthorizeUrl({
      state: 'abc.def',
      scopes: ['playlist-read-private', 'playlist-read-collaborative', 'user-read-email'],
    });

    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe('https://accounts.spotify.com/authorize');
    expect(parsed.searchParams.get('client_id')).toBe('client-id-123');
    expect(parsed.searchParams.get('redirect_uri')).toBe(
      'https://example.test/api/auth/spotify/callback',
    );
    expect(parsed.searchParams.get('state')).toBe('abc.def');
    expect(parsed.searchParams.get('response_type')).toBe('code');
    // Space-joined; URLSearchParams decodes %20 → ' '.
    expect(parsed.searchParams.get('scope')).toBe(
      'playlist-read-private playlist-read-collaborative user-read-email',
    );
  });
});

describe('signState / verifyState', () => {
  it('round-trips a signed state', () => {
    const signed = signState('nonce-123', SECRET);
    expect(signed).toContain('.');
    const result = verifyState(signed, SECRET);
    expect(result).toBe('nonce-123');
  });

  it('detects tampering when a byte is flipped', () => {
    const signed = signState('nonce-123', SECRET);
    // Flip first character of nonce portion → invalid signature.
    const [nonce, sig] = signed.split('.');
    const tampered = (nonce[0] === 'a' ? 'b' : 'a') + nonce.slice(1) + '.' + sig;
    expect(verifyState(tampered, SECRET)).toBeNull();
  });

  it('returns null on malformed input (no dot)', () => {
    expect(verifyState('no-dot-here', SECRET)).toBeNull();
  });

  it('returns null when nonce is empty', () => {
    expect(verifyState('.somesig', SECRET)).toBeNull();
  });
});

describe('extractSpotifyPlaylistId', () => {
  it('extracts id from full open.spotify.com /playlist/{id} URL', () => {
    expect(
      extractSpotifyPlaylistId('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M'),
    ).toBe('37i9dQZF1DXcBWIGoYBM5M');
  });

  it('extracts id from URL with query parameters', () => {
    expect(
      extractSpotifyPlaylistId(
        'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=abc123',
      ),
    ).toBe('37i9dQZF1DXcBWIGoYBM5M');
  });

  it('accepts raw 22-char base62 id', () => {
    expect(extractSpotifyPlaylistId('37i9dQZF1DXcBWIGoYBM5M')).toBe('37i9dQZF1DXcBWIGoYBM5M');
  });

  it('returns null for invalid input', () => {
    expect(extractSpotifyPlaylistId('')).toBeNull();
    expect(extractSpotifyPlaylistId('not a playlist id')).toBeNull();
    expect(extractSpotifyPlaylistId('https://example.com/foo/bar')).toBeNull();
  });
});

describe('exchangeCodeForToken', () => {
  it('POSTs to accounts.spotify.com with Basic auth and grant_type=authorization_code', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: 'at',
          refresh_token: 'rt',
          expires_in: 3600,
          scope: 'playlist-read-private',
          token_type: 'Bearer',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const token = await exchangeCodeForToken('auth-code-123');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('https://accounts.spotify.com/api/token');
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    const expectedAuth =
      'Basic ' + Buffer.from('client-id-123:client-secret-xyz').toString('base64');
    expect(headers.Authorization).toBe(expectedAuth);
    expect(headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    const body = init.body as URLSearchParams;
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('code')).toBe('auth-code-123');
    expect(body.get('redirect_uri')).toBe(
      'https://example.test/api/auth/spotify/callback',
    );
    expect(token.accessToken).toBe('at');
    expect(token.refreshToken).toBe('rt');
    expect(token.expiresIn).toBe(3600);
  });
});

describe('refreshAccessToken', () => {
  it('throws SpotifyAuthError with code=invalid_grant on revoked refresh token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'invalid_grant' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(refreshAccessToken('old-rt')).rejects.toMatchObject({
      name: 'SpotifyAuthError',
      code: 'invalid_grant',
    });
  });

  it('exposes SpotifyAuthError as an instanceof Error', async () => {
    const err = new SpotifyAuthError('invalid_grant', 'bad');
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe('invalid_grant');
  });
});
