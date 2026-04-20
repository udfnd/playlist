// Tiny helper for turning "#RRGGBB" into "R, G, B" triples so we can feed
// runtime-chosen colors into rgba(var(--name), <alpha>) CSS gradients.

export function hexToRgbTriplet(hex: string, fallback = '232, 168, 76'): string {
  const match = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!match) return fallback;
  const n = parseInt(match[1], 16);
  return `${(n >> 16) & 0xff}, ${(n >> 8) & 0xff}, ${n & 0xff}`;
}
