import { LATE_NIGHT } from './late-night';
import { SUNSET_DRIVE } from './sunset-drive';
import type { Preset } from './types';

export type { Preset } from './types';

/**
 * Ordered list of shippable presets. The FIRST entry is the MVP default used whenever
 * a preset key is missing, unknown, or not yet supported (e.g. legacy rooms).
 */
export const PRESETS: Preset[] = [LATE_NIGHT, SUNSET_DRIVE];

const REGISTRY = new Map(PRESETS.map((p) => [p.key, p]));

export const DEFAULT_PRESET_KEY = PRESETS[0].key;

/** Resolve a stored preset_key back to a Preset, defaulting to the first if unknown. */
export function getPreset(key: string | null | undefined): Preset {
  return REGISTRY.get(key ?? '') ?? PRESETS[0];
}

/** Keys allowed by the /api/me/rooms POST validator. */
export const VALID_PRESET_KEYS: Set<string> = new Set(PRESETS.map((p) => p.key));
