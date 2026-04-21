// @MX:SPEC: SPEC-SPOTIFY-001
// Tests for GET /api/me/spotify/status (T-009 / REQ-SPOT-001).
// Lightweight boolean probe used by the wizard to decide whether to show
// "Connect Spotify" CTA or fetch /api/me/spotify/playlists.
// @vitest-environment node

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { makeSupabaseStub } from '@/lib/spotify/__tests__/_helpers';

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/supabase/admin', () => ({ getSupabaseAdmin: vi.fn() }));

import { auth } from '@/auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

const USER_ID = 'u-1';

async function loadRoute() {
  return await import('@/app/api/me/spotify/status/route');
}

beforeEach(() => {
  vi.resetModules();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('GET /api/me/spotify/status', () => {
  it('returns 401 when there is no session', async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    const { GET } = await loadRoute();
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns { connected: true } when a music_connections row exists', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: USER_ID } as never);
    const stub = makeSupabaseStub({ user_id: USER_ID, provider: 'spotify' });
    vi.mocked(getSupabaseAdmin).mockReturnValue(
      stub.client as unknown as ReturnType<typeof getSupabaseAdmin>,
    );
    const { GET } = await loadRoute();
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ connected: true });
  });

  it('returns { connected: false } when no row exists', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: USER_ID } as never);
    const stub = makeSupabaseStub(null);
    vi.mocked(getSupabaseAdmin).mockReturnValue(
      stub.client as unknown as ReturnType<typeof getSupabaseAdmin>,
    );
    const { GET } = await loadRoute();
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ connected: false });
  });
});
