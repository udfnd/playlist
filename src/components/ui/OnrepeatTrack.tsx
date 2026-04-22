'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Kinetic wordmark — "onrepeat." flowing continuously along a horizontal
 * stadium (running-track) path, looping forever.
 *
 * Seamless loop trick:
 *   - The SVG text contains many copies of the phrase ("onrepeat. "), so
 *     the string is longer than the path circumference and textPath always
 *     has characters to render across the entire visible oval.
 *   - After first render we measure the path's total length and the width
 *     of a single phrase (via a hidden reference <text>), then animate
 *     `startOffset` from 0% to -(phraseWidth / pathLength × 100)%.
 *   - Because the phrase is repeated and identical, shifting by exactly
 *     one phrase's worth of path length produces a visual state identical
 *     to the starting state — so the animation restart is invisible.
 *
 * Accessibility:
 *   - <title> exposes a single "onrepeat" label to screen readers.
 *   - The repeated visual text is `aria-hidden` so assistive tech doesn't
 *     announce "onrepeat. onrepeat. onrepeat..." ad nauseam.
 *   - `prefers-reduced-motion: reduce` freezes the marquee (see globals.css).
 */

// Horizontal stadium geometry. Path itself lives in the x ∈ [0,1400],
// y ∈ [0,600] rectangle; the viewBox below is padded so glyph ascenders
// and descenders rendered *outside* the path (which is unavoidable when
// text sits on the path's baseline) are not clipped at the frame edges.
// Semicircle radius = 300, straight legs 800 long → aspect ~2.33:1.
const TRACK_D = [
  'M 300 0',                 // top-left tangent of left semicircle
  'L 1100 0',                // top straight — left to right
  'A 300 300 0 0 1 1100 600',// right semicircle — top to bottom, clockwise
  'L 300 600',               // bottom straight — right to left
  'A 300 300 0 0 1 300 0',   // left semicircle — bottom to top, clockwise
  'Z',
].join(' ');

// Padding around the stadium, in user units, large enough to contain
// the glyph ascent (~0.75 × fontSize) + a little breathing room. With
// FONT_SIZE_USER_UNITS = 140 that's ~105 units; we round to 150.
const GLYPH_PADDING = 150;
const TRACK_INNER_W = 1400;
const TRACK_INNER_H = 600;
const VIEWBOX = [
  -GLYPH_PADDING,
  -GLYPH_PADDING,
  TRACK_INNER_W + GLYPH_PADDING * 2,
  TRACK_INNER_H + GLYPH_PADDING * 2,
].join(' ');

const PHRASE = 'onrepeat. ';
// Repeat enough copies that the concatenated string is always longer
// than the stadium circumference at any viewport size. 20 copies at
// 140px Geist-Black easily exceeds the ~3,300-unit circumference while
// keeping the DOM string small.
const REPEAT_COUNT = 20;
const FULL_PHRASE = PHRASE.repeat(REPEAT_COUNT);

// Type size in SVG user units. With the 1400×600 viewBox this fills
// enough of the stadium height that the wordmark reads as "the brand"
// rather than "decorative text around an oval".
const FONT_SIZE_USER_UNITS = 140;

// Seconds per single-phrase cycle. Lower = faster scroll.
const SECONDS_PER_PHRASE = 5;

export function OnrepeatTrack() {
  const pathRef = useRef<SVGPathElement>(null);
  const phraseMeasureRef = useRef<SVGTextElement>(null);

  // Percentage of the path length that ONE "onrepeat. " phrase occupies.
  // Null until we have measured; we render an initial reasonable default
  // (~15%) so the animation looks correct even before JS measurement lands.
  const [shiftPct, setShiftPct] = useState<number>(15);

  useEffect(() => {
    const path = pathRef.current;
    const measure = phraseMeasureRef.current;
    if (!path || !measure) return;

    try {
      const pathLen = path.getTotalLength();
      const phraseWidth = measure.getBBox().width;
      if (pathLen > 0 && phraseWidth > 0) {
        setShiftPct((phraseWidth / pathLen) * 100);
      }
    } catch {
      // getBBox throws if the text hasn't laid out yet (rare). Keep
      // the default shift — the animation still looks natural, just
      // with a minor seam every cycle.
    }
  }, []);

  return (
    <svg
      viewBox={VIEWBOX}
      preserveAspectRatio="xMidYMid meet"
      // Cap both dimensions so the track reads as a decorative mark
      // rather than a full-bleed wall of text. The viewBox already
      // includes GLYPH_PADDING around the stadium so ascenders /
      // descenders laid out on the path are not clipped.
      className="w-full max-w-[720px] h-auto max-h-[48vh] onrepeat-track"
      aria-labelledby="onrepeat-title"
      role="img"
    >
      <title id="onrepeat-title">onrepeat</title>

      <defs>
        <path
          ref={pathRef}
          id="onrepeat-stadium"
          d={TRACK_D}
          fill="none"
        />
      </defs>

      {/* Hidden measurement element — one phrase, same font/size/spacing
          as the marquee. We read its bbox width in useEffect to compute
          the seamless-loop shift. Rendered at a safe offscreen-ish
          position with visibility hidden so it still lays out. */}
      <text
        ref={phraseMeasureRef}
        x={-10000}
        y={-10000}
        visibility="hidden"
        aria-hidden
        style={{
          fontSize: `${FONT_SIZE_USER_UNITS}px`,
          letterSpacing: '-0.04em',
          fontFamily: 'var(--font-geist-sans)',
          fontWeight: 900,
        }}
      >
        {PHRASE}
      </text>

      {/* Faint track outline — decorative, helps read the shape when
          viewport is narrow and the stadium compresses. */}
      <use
        href="#onrepeat-stadium"
        className="fill-none stroke-cream-white/5"
        strokeWidth={1}
      />

      {/* The marquee itself. */}
      <text
        aria-hidden
        className="fill-cream-white select-none"
        style={{
          fontSize: `${FONT_SIZE_USER_UNITS}px`,
          letterSpacing: '-0.04em',
          fontFamily: 'var(--font-geist-sans)',
          fontWeight: 900,
        }}
      >
        <textPath href="#onrepeat-stadium" startOffset="0%">
          {FULL_PHRASE}
          {/* SMIL animate: shift by exactly one-phrase worth of path
              length each cycle so the restart is invisible. `key` on
              the React element ensures the animation reinitialises
              when `shiftPct` updates after measurement. */}
          <animate
            key={shiftPct}
            attributeName="startOffset"
            from="0%"
            to={`-${shiftPct}%`}
            dur={`${SECONDS_PER_PHRASE}s`}
            repeatCount="indefinite"
          />
        </textPath>
      </text>
    </svg>
  );
}
