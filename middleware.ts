// @MX:SPEC: SPEC-SOCIAL-001
// Root middleware that issues an HMAC-signed __Host-visitor cookie on first
// visit to any HTML/API route. Runs in Edge runtime, so it relies on the
// runtime-agnostic helpers in src/lib/visitor/cookie.ts (Web Crypto, not
// node:crypto). The matcher excludes static assets to avoid unnecessary work.

import { NextResponse, type NextRequest } from 'next/server';
import { COOKIE_NAME, signVisitorId, verifyVisitorCookie } from '@/lib/visitor/cookie';

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return NextResponse.next();

  const existing = req.cookies.get(COOKIE_NAME)?.value ?? null;
  const valid = existing ? await verifyVisitorCookie(existing, secret) : null;

  const res = NextResponse.next();
  if (!valid) {
    const newId = crypto.randomUUID();
    const signed = await signVisitorId(newId, secret);
    res.cookies.set(COOKIE_NAME, signed, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  return res;
}

export const config = {
  // Match all paths except Next internals and static file extensions.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
