// A Preset captures the visual identity of a room — the CSS backdrop palette, the
// three.js lighting, and the cylinder base tint. The carousel LAYOUT (drum geometry,
// snap, click behaviour) is identical across presets; only the "dressing" changes.
//
// Each preset has a stable `key` that is persisted as rooms.preset_key. The key is a
// human-readable tag; the actual RENDERING is driven by the fields below, which are
// applied through CSS variables and three.js props. This lets both curated presets
// and LLM-generated ones share the exact same render pipeline.

export interface Preset {
  /** Stable identifier stored in rooms.preset_key. 'custom' for AI-generated. */
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
  /**
   * Colors that drive the CSS backdrop gradients and aurora blobs. Every preset
   * — curated or LLM-generated — supplies the same shape, and SongCarousel turns
   * them into CSS custom properties on the backdrop element.
   */
  backdrop: {
    /** Solid base color behind the gradients (matte-black-family). */
    base: string;
    /** Primary radial-glow color (the centerpiece mood light). */
    glowPrimary: string;
    /** Secondary radial-glow color (bottom tint). */
    glowSecondary: string;
  };
  aurora: {
    /** Center blob color. */
    a: string;
    /** Lower-left blob color. */
    b: string;
    /** Upper-right blob color. */
    c: string;
  };
}

/**
 * The serializable shape an LLM returns when generating a custom preset. Same
 * rendering pipeline as Preset, minus `key` (the server stamps that as 'custom').
 */
export type GeneratedPreset = Omit<Preset, 'key'>;
