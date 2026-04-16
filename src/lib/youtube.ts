/**
 * Extracts a YouTube playlist ID from various URL formats or a raw ID.
 *
 * Supported formats:
 * - https://www.youtube.com/playlist?list=PLxxxxxx
 * - https://music.youtube.com/playlist?list=PLxxxxxx
 * - https://youtube.com/watch?v=xxx&list=PLxxxxxx
 * - Raw playlist ID: PLxxxxxx
 *
 * @returns The playlist ID string, or null if extraction fails.
 */
export function extractPlaylistId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Try parsing as a URL first
  try {
    const url = new URL(trimmed);
    const hostname = url.hostname.replace(/^www\./, '');

    if (
      hostname === 'youtube.com' ||
      hostname === 'music.youtube.com' ||
      hostname === 'm.youtube.com' ||
      hostname === 'youtu.be'
    ) {
      const listParam = url.searchParams.get('list');
      return listParam || null;
    }
  } catch {
    // Not a valid URL -- fall through to raw ID check
  }

  // Treat as a raw playlist ID if it looks like one (starts with PL, OL, UU, RD, etc.)
  // YouTube playlist IDs are alphanumeric with hyphens and underscores
  if (/^[A-Za-z0-9_-]{10,}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

/**
 * Parses an ISO 8601 duration string (e.g. "PT1H2M30S") into total seconds.
 *
 * Handles:
 * - PT1H2M30S  -> 3750
 * - PT5M       -> 300
 * - PT30S      -> 30
 * - PT1H       -> 3600
 * - P0D        -> 0 (live streams sometimes)
 *
 * @returns Total duration in seconds, or 0 if parsing fails.
 */
export function parseISODuration(iso: string): number {
  if (!iso) return 0;

  const match = iso.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return 0;

  const days = parseInt(match[1] || '0', 10);
  const hours = parseInt(match[2] || '0', 10);
  const minutes = parseInt(match[3] || '0', 10);
  const seconds = parseInt(match[4] || '0', 10);

  return days * 86400 + hours * 3600 + minutes * 60 + seconds;
}

/**
 * Generates a deterministic hex color from a string (e.g. video ID).
 * Produces pleasant, saturated colors suitable for UI accents.
 */
export function generateColorFromId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash; // Convert to 32-bit integer
  }

  // Use the hash to generate HSL values for pleasant colors
  const hue = Math.abs(hash) % 360;
  const saturation = 50 + (Math.abs(hash >> 8) % 30); // 50-80%
  const lightness = 40 + (Math.abs(hash >> 16) % 20); // 40-60%

  return hslToHex(hue, saturation, lightness);
}

function hslToHex(h: number, s: number, l: number): string {
  const sNorm = s / 100;
  const lNorm = l / 100;

  const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lNorm - c / 2;

  let r = 0;
  let g = 0;
  let b = 0;

  if (h < 60) {
    r = c; g = x; b = 0;
  } else if (h < 120) {
    r = x; g = c; b = 0;
  } else if (h < 180) {
    r = 0; g = c; b = x;
  } else if (h < 240) {
    r = 0; g = x; b = c;
  } else if (h < 300) {
    r = x; g = 0; b = c;
  } else {
    r = c; g = 0; b = x;
  }

  const toHex = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, '0');

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
