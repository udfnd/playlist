// @MX:SPEC: SPEC-SOCIAL-001
// Tests for the runtime-agnostic (Edge + Node) visitor cookie helpers.

import { describe, it, expect } from 'vitest';
import {
  COOKIE_NAME,
  signVisitorId,
  verifyVisitorCookie,
  issueVisitorCookieHeader,
} from '../cookie';

const SECRET = 'test-secret-value-32chars-or-more__';
const VISITOR_ID = '11111111-2222-3333-4444-555555555555';

describe('visitor cookie helpers', () => {
  it('COOKIE_NAME enforces the __Host- prefix', () => {
    expect(COOKIE_NAME).toBe('__Host-visitor');
  });

  it('round-trip: signVisitorId then verifyVisitorCookie returns the original id', async () => {
    const signed = await signVisitorId(VISITOR_ID, SECRET);
    expect(signed.startsWith(`${VISITOR_ID}.`)).toBe(true);
    expect(await verifyVisitorCookie(signed, SECRET)).toBe(VISITOR_ID);
  });

  it('detects signature tampering (flip a byte in the HMAC)', async () => {
    const signed = await signVisitorId(VISITOR_ID, SECRET);
    const dot = signed.indexOf('.');
    const body = signed.slice(0, dot);
    const sig = signed.slice(dot + 1);
    // flip one hex nibble
    const flipped = (sig[0] === '0' ? '1' : '0') + sig.slice(1);
    expect(await verifyVisitorCookie(`${body}.${flipped}`, SECRET)).toBeNull();
  });

  it('detects id tampering (flip a byte in the id portion)', async () => {
    const signed = await signVisitorId(VISITOR_ID, SECRET);
    const dot = signed.indexOf('.');
    const body = signed.slice(0, dot);
    const sig = signed.slice(dot + 1);
    const flippedBody = 'a' + body.slice(1);
    expect(await verifyVisitorCookie(`${flippedBody}.${sig}`, SECRET)).toBeNull();
  });

  it('rejects malformed inputs', async () => {
    expect(await verifyVisitorCookie(null, SECRET)).toBeNull();
    expect(await verifyVisitorCookie('', SECRET)).toBeNull();
    expect(await verifyVisitorCookie('no-dot-here', SECRET)).toBeNull();
    expect(await verifyVisitorCookie('.justsig', SECRET)).toBeNull();
    expect(await verifyVisitorCookie('idonly.', SECRET)).toBeNull();
    expect(await verifyVisitorCookie('a.b.c', SECRET)).toBeNull();
  });

  it('returns null when secrets differ', async () => {
    const signed = await signVisitorId(VISITOR_ID, SECRET);
    expect(await verifyVisitorCookie(signed, 'a-different-secret-value')).toBeNull();
  });

  it('issueVisitorCookieHeader includes every required flag', async () => {
    const header = await issueVisitorCookieHeader(VISITOR_ID, SECRET);
    expect(header.startsWith(`${COOKIE_NAME}=`)).toBe(true);
    expect(header).toContain('Path=/');
    expect(header).toContain('HttpOnly');
    expect(header).toContain('Secure');
    expect(header).toContain('SameSite=Lax');
    expect(header).toContain('Max-Age=31536000');
  });
});
