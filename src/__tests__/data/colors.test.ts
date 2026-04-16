import { describe, it, expect } from 'vitest';
import {
  MATTE_BLACK,
  WARM_AMBER,
  CREAM_WHITE,
  VINYL_BLACK,
  MUTED_VIOLET,
} from '@/lib/colors';

describe('colors', () => {
  const allColors = {
    MATTE_BLACK,
    WARM_AMBER,
    CREAM_WHITE,
    VINYL_BLACK,
    MUTED_VIOLET,
  };

  it('all color constants should be valid 7-character hex strings', () => {
    const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;
    for (const [name, value] of Object.entries(allColors)) {
      expect(value, `${name} should be a valid hex color`).toMatch(hexColorRegex);
      expect(value.length, `${name} should be 7 characters long`).toBe(7);
    }
  });

  it('MATTE_BLACK should be defined', () => {
    expect(MATTE_BLACK).toBeDefined();
  });

  it('WARM_AMBER should be defined', () => {
    expect(WARM_AMBER).toBeDefined();
  });

  it('CREAM_WHITE should be defined', () => {
    expect(CREAM_WHITE).toBeDefined();
  });

  it('VINYL_BLACK should be defined', () => {
    expect(VINYL_BLACK).toBeDefined();
  });

  it('MUTED_VIOLET should be defined', () => {
    expect(MUTED_VIOLET).toBeDefined();
  });

  it('all required colors should exist', () => {
    expect(Object.keys(allColors)).toEqual(
      expect.arrayContaining([
        'MATTE_BLACK',
        'WARM_AMBER',
        'CREAM_WHITE',
        'VINYL_BLACK',
        'MUTED_VIOLET',
      ])
    );
  });
});
