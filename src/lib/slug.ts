// Slug generation for room URLs. Kebab-case ASCII derived from a title.
// Korean / emoji / non-ASCII input collapses to empty — in that case we fall back
// to a generic base so the server can still find an available unique slug.

const FALLBACK_BASE = 'room';
const MAX_LENGTH = 60;

export function generateSlugCandidate(title: string): string {
  const ascii = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip combining marks
    .replace(/[^a-z0-9\s-]+/g, ' ')  // drop everything not kebab-friendly
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, MAX_LENGTH)
    .replace(/-+$/g, ''); // trim a trailing hyphen from slicing mid-word

  return ascii || FALLBACK_BASE;
}

/**
 * Given a base slug and the caller's existing slugs, pick the first non-colliding name.
 *  base, base-2, base-3, ...
 */
export function pickAvailableSlug(base: string, existing: Iterable<string>): string {
  const taken = new Set(existing);
  if (!taken.has(base)) return base;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${base}-${i}`;
    if (!taken.has(candidate)) return candidate;
  }
  // Extreme fallback — should be unreachable for any normal user.
  return `${base}-${Date.now().toString(36)}`;
}
