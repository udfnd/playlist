// Handle validation rules shared between the client modal (for instant feedback) and the
// server API route (as the authoritative check).

const HANDLE_PATTERN = /^[a-z0-9](?:[a-z0-9_-]{1,22}[a-z0-9])?$/;

const RESERVED_HANDLES = new Set([
  // Routing / platform conflicts
  'admin', 'api', 'app', 'auth', 'dashboard', 'help', 'home', 'inbox',
  'login', 'logout', 'me', 'new', 'privacy', 'profile', 'root', 'settings',
  'signin', 'signout', 'signup', 'static', 'support', 'terms', 'www',
  // Brand squatting guard
  'onrepeat', 'playlist', 'spotify', 'youtube',
  // Common-sense blocks
  'null', 'undefined', 'anonymous',
]);

export type HandleCheck =
  | { ok: true; handle: string }
  | { ok: false; reason: string };

export function validateHandle(raw: string): HandleCheck {
  const handle = raw.trim().toLowerCase();

  if (handle.length < 3) {
    return { ok: false, reason: 'Handle must be at least 3 characters.' };
  }
  if (handle.length > 24) {
    return { ok: false, reason: 'Handle must be 24 characters or fewer.' };
  }
  if (!HANDLE_PATTERN.test(handle)) {
    return {
      ok: false,
      reason:
        'Only lowercase letters, numbers, hyphens and underscores. Must start and end with a letter or number.',
    };
  }
  if (RESERVED_HANDLES.has(handle)) {
    return { ok: false, reason: 'That handle is reserved. Try another.' };
  }

  return { ok: true, handle };
}
