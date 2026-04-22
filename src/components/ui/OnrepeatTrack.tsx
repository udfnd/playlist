'use client';

/**
 * Kinetic wordmark — "onrepeat." flowing along a stadium (running-track)
 * shaped path, looping forever. The repetition itself is the message:
 * this site is about playlists on repeat.
 *
 * Implementation:
 * - SVG `<textPath>` binds the text string to a stadium-shaped path.
 * - SMIL `<animate>` shifts `startOffset` from 0→100% linearly, producing
 *   a continuous marquee along the track.
 * - The stadium path is two vertical straights + two horizontal
 *   semicircles so on common desktop/tablet viewports the oval reads as
 *   a race-track oriented vertically within the left column.
 * - `prefers-reduced-motion: reduce` pauses the animation via CSS.
 * - Screen readers get a single "onrepeat" label via <title>; the visual
 *   text is marked aria-hidden so they don't hear the repeated string.
 */
export function OnrepeatTrack() {
  // Stadium path geometry. viewBox is 500×620 so the oval is taller than
  // wide, matching the typical aspect of the left column on desktop.
  // Straight legs: y from 130 to 490 on x=50 (left) and x=450 (right).
  // Semicircles: radius 200 on top (center 250,130) and bottom (250,490).
  const trackPath = [
    // start at top of right straight (just under the top semicircle)
    'M 450 130',
    // right straight going down
    'L 450 490',
    // bottom semicircle, sweeping clockwise from right to left
    'A 200 200 0 0 1 50 490',
    // left straight going up
    'L 50 130',
    // top semicircle, sweeping clockwise from left to right, closes the loop
    'A 200 200 0 0 1 450 130',
    'Z',
  ].join(' ');

  // The phrase is repeated enough times so the marquee has visible
  // "onrepeat." segments everywhere on the track at once. Exact count is
  // tuned with fontSize so roughly 4–6 copies fit along the circumference.
  const phrase = Array(6).fill('onrepeat. ').join('');

  return (
    <svg
      viewBox="0 0 500 620"
      preserveAspectRatio="xMidYMid meet"
      className="w-full h-full max-h-[min(85vh,720px)] onrepeat-track"
      aria-labelledby="onrepeat-title"
      role="img"
    >
      <title id="onrepeat-title">onrepeat</title>

      <defs>
        <path id="onrepeat-stadium" d={trackPath} fill="none" />
      </defs>

      {/* Faint track outline. Pure decoration — helps the eye read the
          shape when the text is sparse on the curves. */}
      <use
        href="#onrepeat-stadium"
        className="fill-none stroke-cream-white/5"
        strokeWidth={1}
      />

      <text
        aria-hidden
        className="fill-cream-white font-sans font-black select-none"
        style={{
          // Sized so roughly two "onrepeat." words span each straight leg.
          fontSize: '84px',
          letterSpacing: '-0.04em',
          fontFamily: 'var(--font-geist-sans)',
        }}
      >
        <textPath href="#onrepeat-stadium" startOffset="0%">
          {phrase}
          <animate
            attributeName="startOffset"
            from="0%"
            to="100%"
            dur="22s"
            repeatCount="indefinite"
          />
        </textPath>
      </text>
    </svg>
  );
}
