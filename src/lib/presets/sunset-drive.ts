import type { Preset } from './types';

// Coral-to-magenta horizon — the room reads like a playlist cued up for a sunset drive
// with the windows down. Warmer key light + deep mauve fill + a darker wine-tinted
// cylinder make the carousel feel like it's sitting inside a dashboard at golden hour.
export const SUNSET_DRIVE: Preset = {
  key: 'sunset-drive',
  label: 'Sunset Drive',
  description: 'Coral horizon, warm dashboard glow, windows down.',
  lighting: {
    keyColor: '#FF8C5A',
    keyIntensity: 2.1,
    fillColor: '#C47AA1',
    fillIntensity: 0.55,
    ambientIntensity: 0.45,
  },
  cylinderColor: '#2A131F',
  swatch: ['#1A0B1A', '#FF8C5A', '#C47AA1'],
  backdrop: {
    base: '#1A0B1A',
    glowPrimary: '#FF8C5A',
    glowSecondary: '#C47AA1',
  },
  aurora: {
    a: '#FF8C5A',
    b: '#C47AA1',
    c: '#FFC878',
  },
};
