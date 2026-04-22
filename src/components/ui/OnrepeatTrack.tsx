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

// Horizontal stadium geometry. viewBox 1400 × 600 (aspect ~2.33:1 — reads
// clearly as a running-track oval without collapsing too short
// vertically on 50vw columns). Semicircle radius = 300; straight legs
// span x = 300..1100 on the top (y=0) and bottom (y=600).
const TRACK_D = [
  'M 300 0',                 // top-left tangent of left semicircle
  'L 1100 0',                // top straight — left to right
  'A 300 300 0 0 1 1100 600',// right semicircle — top to bottom, clockwise
  'L 300 600',               // bottom straight — right to left
  'A 300 300 0 0 1 300 0',   // left semicircle — bottom to top, clockwise
  'Z',
].join(' ');

const PHRASE = 'onrepeat. ';
// Repeat enough copies that the concatenated string is always longer
// than the stadium circumference at any viewport size. 40 copies at
// 84px Geist-Black is comfortably over 20,000 user units; the stadium
// circumference is ~3,300.
const REPEAT_COUNT = 40;
const FULL_PHRASE = PHRASE.repeat(REPEAT_COUNT);

// Seconds per single-phrase cycle. Lower = faster scroll. Tuned so one
// "onrepeat." glides past per ~5 s — readable, not dizzying.
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
      viewBox="0 0 1400 600"
      preserveAspectRatio="xMidYMid meet"
      className="w-full h-auto max-h-[70vh] onrepeat-track"
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
          fontSize: '84px',
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
          fontSize: '84px',
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
