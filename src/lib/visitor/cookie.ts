// @MX:SPEC: SPEC-SOCIAL-001
// @MX:ANCHOR: issueVisitorCookie/signVisitorId — fan-in: middleware + reaction route + suggestion route
// @MX:REASON: idempotency-and-rate-limit

// Runtime-agnostic (Edge + Node) HMAC helpers for the __Host-visitor cookie.
// Uses Web Crypto (crypto.subtle) so the exact same module can run in a
// Next.js middleware (Edge) and API route handlers (Node). Never import
// node:crypto here.

import type { SupabaseClient } from '@supabase/supabase-js';

export const COOKIE_NAME = '__Host-visitor';
export const COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 365;

/** Constant-time compare for hex strings of equal length. */
function constantTimeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  const bytes = new Uint8Array(sig);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * Sign a visitor id and return `{visitorId}.{hmacHex}`. The id is carried
 * verbatim because it is already a UUID and contains no PII.
 */
export async function signVisitorId(visitorId: string, secret: string): Promise<string> {
  const sig = await hmacSha256Hex(secret, visitorId);
  return `${visitorId}.${sig}`;
}

/**
 * Verify a signed cookie value. Returns the visitor id on success, null on
 * any shape/signature mismatch. Constant-time comparison avoids timing leaks
 * on the HMAC portion.
 */
export async function verifyVisitorCookie(
  value: string | null | undefined,
  secret: string,
): Promise<string | null> {
  if (!value) return null;
  const parts = value.split('.');
  if (parts.length !== 2) return null;
  const [id, providedSig] = parts;
  if (!id || !providedSig) return null;
  const expectedSig = await hmacSha256Hex(secret, id);
  return constantTimeEqualHex(providedSig, expectedSig) ? id : null;
}

/**
 * Build the full `Set-Cookie` header line for the visitor cookie. Used by
 * API routes that may need to lazily issue the cookie when middleware did
 * not run (e.g. direct API calls from a fresh client).
 */
export async function issueVisitorCookieHeader(
  visitorId: string,
  secret: string,
): Promise<string> {
  const signed = await signVisitorId(visitorId, secret);
  return [
    `${COOKIE_NAME}=${signed}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    `Max-Age=${COOKIE_MAX_AGE_SEC}`,
  ].join('; ');
}

/**
 * Lazy-upsert a visitor row. Called from API routes after the cookie is
 * verified; "insert or do nothing" semantics keep the DB row count at exactly
 * 1 per visitor id without caring about concurrent first-request races.
 *
 * The Supabase client is the service-role admin client; we do not constrain
 * the generic because `visitors` is not yet present in the generated
 * `Database` types (the migration is applied out-of-band).
 */
export async function upsertVisitorRow(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, 'public', any>,
  visitorId: string,
): Promise<void> {
  await supabase
    .from('visitors')
    .upsert(
      { id: visitorId, last_seen: new Date().toISOString() },
      { onConflict: 'id' },
    );
}
