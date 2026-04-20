import type { Preset } from './types';

// The original matte-black + warm amber + violet aurora treatment — the carousel's
// default identity since before presets existed. Named "late-night" because that's
// the mood: 2am vinyl rack, shop closed, light from a single lamp.
export const LATE_NIGHT: Preset = {
  key: 'late-night',
  label: 'Late Night',
  description: 'Matte black, warm amber lamp, violet aurora.',
  lighting: {
    keyColor: '#E8A84C',
    keyIntensity: 1.8,
    fillColor: '#FFFFFF',
    fillIntensity: 0.4,
    ambientIntensity: 0.35,
  },
  cylinderColor: '#1A1A1A',
  swatch: ['#0A0A0A', '#E8A84C', '#6B5B8A'],
  backdrop: {
    base: '#0A0A0A',
    glowPrimary: '#E8A84C',
    glowSecondary: '#6B5B8A',
  },
  aurora: {
    a: '#E8A84C',
    b: '#6B5B8A',
    c: '#E8A84C',
  },
};
