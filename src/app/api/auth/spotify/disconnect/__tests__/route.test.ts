// @MX:SPEC: SPEC-SPOTIFY-001
// Tests for POST /api/auth/spotify/disconnect (T-006 / REQ-SPOT-001).
// @vitest-environment node

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { makeSupabaseStub } from '@/lib/spotify/__tests__/_helpers';

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/supabase/admin', () => ({ getSupabaseAdmin: vi.fn() }));

import { auth } from '@/auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

const USER_ID = 'u-1';

async function loadRoute() {
  return await import('@/app/api/auth/spotify/disconnect/route');
}

beforeEach(() => {
  vi.resetModules();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('POST /api/auth/spotify/disconnect', () => {
  it('returns 401 when no session', async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    const { POST } = await loadRoute();
    const res = await POST();
    expect(res.status).toBe(401);
  });

  it('deletes the music_connections row for the user and returns { ok: true }', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: USER_ID } as never);
    const stub = makeSupabaseStub({});
    vi.mocked(getSupabaseAdmin).mockReturnValue(
      stub.client as unknown as ReturnType<typeof getSupabaseAdmin>,
    );

    const { POST } = await loadRoute();
    const res = await POST();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });

    expect(stub.calls.find((c) => c.op === 'delete')).toBeDefined();
    const eqCalls = stub.calls.filter((c) => c.op === 'eq');
    const userEq = eqCalls.find((c) => c.args[0] === 'user_id' && c.args[1] === USER_ID);
    const providerEq = eqCalls.find((c) => c.args[0] === 'provider' && c.args[1] === 'spotify');
    expect(userEq).toBeDefined();
    expect(providerEq).toBeDefined();
  });
});
