// @MX:SPEC: SPEC-SOCIAL-001
// Unit tests for the root middleware that issues __Host-visitor cookies.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { signVisitorId, COOKIE_NAME } from '@/lib/visitor/cookie';

const SECRET = 'middleware-test-secret-value-xxx';

interface MockCookieStore {
  get: (name: string) => { value: string } | undefined;
}
interface MockRequest {
  cookies: MockCookieStore;
}

function makeReq(cookieValue: string | null): MockRequest {
  return {
    cookies: {
      get: (name: string) =>
        name === COOKIE_NAME && cookieValue ? { value: cookieValue } : undefined,
    },
  };
}

describe('root middleware — visitor cookie bootstrap', () => {
  const originalSecret = process.env.AUTH_SECRET;

  beforeEach(() => {
    process.env.AUTH_SECRET = SECRET;
    vi.resetModules();
  });

  afterEach(() => {
    process.env.AUTH_SECRET = originalSecret;
    vi.restoreAllMocks();
  });

  it('issues a fresh cookie when none is present', async () => {
    const { middleware } = await import('../../middleware');
    const req = makeReq(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res: any = await middleware(req as any);
    // NextResponse wraps a cookies API; check by inspecting Set-Cookie header.
    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toBeTruthy();
    expect(setCookie).toContain(`${COOKIE_NAME}=`);
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('Secure');
  });

  it('does not overwrite a valid cookie', async () => {
    const { middleware } = await import('../../middleware');
    const signed = await signVisitorId(
      '11111111-2222-3333-4444-555555555555',
      SECRET,
    );
    const req = makeReq(signed);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res: any = await middleware(req as any);
    const setCookie = res.headers.get('set-cookie');
    // No Set-Cookie should be issued for already-valid cookies.
    expect(setCookie).toBeFalsy();
  });

  it('replaces a tampered cookie with a fresh one', async () => {
    const { middleware } = await import('../../middleware');
    const req = makeReq('tampered.deadbeef');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res: any = await middleware(req as any);
    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toBeTruthy();
    expect(setCookie).toContain(`${COOKIE_NAME}=`);
  });

  it('is a no-op when AUTH_SECRET is missing', async () => {
    delete process.env.AUTH_SECRET;
    const { middleware } = await import('../../middleware');
    const req = makeReq(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res: any = await middleware(req as any);
    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toBeFalsy();
  });
});
