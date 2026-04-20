// A Preset captures the visual identity of a room — the CSS backdrop palette, the
// three.js lighting, and the cylinder base tint. The carousel LAYOUT (drum geometry,
// snap, click behaviour) is identical across presets; only the "dressing" changes.
//
// Each preset has a stable `key` that is persisted as rooms.preset_key. The key also
// drives a `[data-preset="..."]` attribute on the carousel backdrop so CSS can swap
// the gradient/noise palette without prop drilling styles into three.js.

export interface Preset {
  /** Stable identifier stored in rooms.preset_key. */
  key: string;
  /** Short human-readable label used in the picker UI. */
  label: string;
  /** One-line tagline shown beneath the label in the picker. */
  description: string;
  /** three.js light colors and intensities applied inside <Scene />. */
  lighting: {
    keyColor: string;
    keyIntensity: number;
    fillColor: string;
    fillIntensity: number;
    ambientIntensity: number;
  };
  /** Hex color for the rotating CylinderBase disc beneath the carousel. */
  cylinderColor: string;
  /** Swatch hexes used in the preset picker card (gradient sampling). */
  swatch: [string, string, string];
}
