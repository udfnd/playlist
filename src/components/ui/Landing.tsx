'use client';

import { useState } from 'react';

interface LandingProps {
  onSubmit: (url: string) => void;
  onSignIn: () => void;
  isLoading: boolean;
  error: string | null;
}

/**
 * Anonymous-visitor landing screen. Split layout: hero wordmark on the left,
 * sign-in CTAs on the right. The Spotify CTA currently funnels into the same
 * Google OAuth flow — real Spotify-primary sign-in is tracked as a follow-up
 * SPEC; until then both buttons hand the user off to Google, and Spotify is
 * linked as a secondary connection via the existing wizard / /home flow.
 */
export function Landing({
  onSubmit,
  onSignIn,
  isLoading,
  error,
}: LandingProps) {
  const [pasteOpen, setPasteOpen] = useState(false);
  const [url, setUrl] = useState('');

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim() && !isLoading) onSubmit(url.trim());
  };

  return (
    <div className="fixed inset-0 z-50 bg-matte-black overflow-hidden">
      <div className="h-full w-full flex flex-col md:flex-row">
        {/*
          Left half — oversized wordmark framed by two angular "repeat"
          hooks. The hooks carry the classic repeat-icon semantic (two
          arrows chasing each other around the text) but with 90° corners
          instead of arcs so they fit the geometric Geist Black type.
        */}
        <section className="flex-1 flex items-center justify-center md:justify-start md:pl-[8vw] px-6 py-10 md:py-0">
          <div className="relative inline-block">
            <h1
              className="font-sans font-black text-cream-white tracking-[-0.04em] leading-[0.85] select-none"
              style={{ fontSize: 'clamp(88px, 18vw, 260px)' }}
            >
              on
              <br />
              repeat.
            </h1>

            {/*
              Angular repeat mark. Two rotationally-symmetric L-hooks
              with arrowheads, wrapping around the wordmark:

                ──────────────────→┐
                                   ▼
                (wordmark sits here)
                ▲
                └──────────────────

              Design notes:
              - `preserveAspectRatio="none"` lets the hooks flex with the
                wordmark's bounding box (which varies with the clamp'd
                font size across viewport widths).
              - `vector-effect="non-scaling-stroke"` keeps the stroke
                width exactly at its CSS value regardless of that stretch,
                so we can match the hook thickness to the Geist-Black
                stem via `clamp(14px, 2.8vw, 42px)`.
              - Arrowheads are filled polygons (they scale with the SVG
                like any fill; kept small enough that the mild horizontal
                stretch does not distort them much).
              - `overflow: visible` is set so the thick miter corners,
                which extend beyond the viewBox at the L-junction, do
                not get clipped.
              - 15% inset on every side gives the strokes enough breathing
                room above/below and beside the wordmark that they never
                overlap the glyphs even at the smallest font size.
            */}
            <svg
              aria-hidden
              viewBox="0 0 200 100"
              preserveAspectRatio="none"
              className="absolute text-cream-white pointer-events-none"
              // Asymmetric inset on purpose. The first line is "on"
              // (all lowercase, no ascenders) so the h1 line box leaves
              // significant empty space above the visible glyph tops —
              // if the top inset matched the bottom, the upper hook
              // would sit visibly further from the text than the lower
              // one. Pulling the top inset in from -15% to -6% brings
              // the upper hook down closer to the "on" glyphs so the
              // visual gap matches the bottom.
              style={{
                top: '-6%',
                right: '-15%',
                bottom: '-15%',
                left: '-15%',
                overflow: 'visible',
              }}
            >
              {/* Upper L hook: across the top, then down on the right. */}
              <path
                d="M 5 3 L 195 3 L 195 44"
                fill="none"
                stroke="currentColor"
                strokeLinecap="butt"
                strokeLinejoin="miter"
                vectorEffect="non-scaling-stroke"
                style={{ strokeWidth: 'clamp(14px, 2.8vw, 42px)' }}
              />
              {/* Upper arrowhead — tip pointing down, sitting flush
                  beneath the descending stroke's end. */}
              <polygon points="188,44 202,44 195,58" fill="currentColor" />

              {/* Lower L hook: rotationally mirrored. Across the bottom
                  (right → left), then up on the left. */}
              <path
                d="M 195 97 L 5 97 L 5 56"
                fill="none"
                stroke="currentColor"
                strokeLinecap="butt"
                strokeLinejoin="miter"
                vectorEffect="non-scaling-stroke"
                style={{ strokeWidth: 'clamp(14px, 2.8vw, 42px)' }}
              />
              {/* Lower arrowhead — tip pointing up, sitting flush above
                  the ascending stroke's end. */}
              <polygon points="12,56 -2,56 5,42" fill="currentColor" />
            </svg>
          </div>
        </section>

        {/*
          Right half — auth CTAs. The CTA stack + URL-paste disclosure are
          treated as a single group that is centered vertically and
          horizontally in the column. The disclosure wrapper reserves a
          fixed height that fits the expanded form, so toggling open /
          closed never shifts any sibling and the group's center stays
          put.
        */}
        <section className="flex-1 flex flex-col items-center justify-center gap-5 px-6 py-10 md:py-0">
          <div className="w-full max-w-sm flex flex-col gap-3">
            <button
              type="button"
              onClick={onSignIn}
              disabled={isLoading}
              className="w-full py-3.5 bg-cream-white text-matte-black font-sans font-semibold rounded-full hover:bg-cream-white/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-cream-white focus-visible:ring-offset-2 focus-visible:ring-offset-matte-black transition-colors flex items-center justify-center gap-3 disabled:opacity-50"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Start with Google
            </button>

            {/*
              Spotify CTA — routes to Google sign-in for now. Once the user
              lands in /home or the wizard, they can "Connect Spotify" for
              the secondary OAuth. Full Spotify-as-primary login is a
              follow-up SPEC.
            */}
            <button
              type="button"
              onClick={onSignIn}
              disabled={isLoading}
              className="w-full py-3.5 bg-[#1DB954] text-matte-black font-sans font-semibold rounded-full hover:bg-[#1ed760] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1DB954] focus-visible:ring-offset-2 focus-visible:ring-offset-matte-black transition-colors flex items-center justify-center gap-3 disabled:opacity-50"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12s5.37 12 12 12 12-5.37 12-12S18.63 0 12 0zm5.5 17.31c-.22.36-.69.47-1.05.25-2.88-1.76-6.5-2.16-10.77-1.18-.41.09-.82-.16-.91-.57-.09-.41.16-.82.57-.91 4.66-1.07 8.67-.61 11.9 1.36.36.22.47.69.26 1.05zm1.47-3.27c-.28.45-.87.59-1.32.31-3.29-2.02-8.31-2.61-12.2-1.43-.51.15-1.05-.13-1.2-.64-.15-.51.13-1.05.64-1.2 4.45-1.35 10-.68 13.77 1.64.45.28.59.87.31 1.32zm.13-3.4c-3.95-2.35-10.47-2.56-14.24-1.42-.61.18-1.25-.16-1.43-.77-.18-.61.16-1.25.77-1.43 4.34-1.32 11.53-1.06 16.08 1.64.55.33.73 1.04.4 1.59-.33.55-1.04.73-1.58.4z" />
              </svg>
              Start with Spotify
            </button>
          </div>

          {/*
            Secondary: paste a YouTube URL to view anonymously. The container
            is `relative`, and the expanded form is absolutely positioned
            beneath the summary. That way the container's flex height is
            always just the summary — the closed state is the true center
            of the group — while opening the disclosure merely reveals the
            form below without reflowing any sibling.
          */}
          <div className="relative w-full max-w-sm">
            <details
              className="w-full group"
              open={pasteOpen}
              onToggle={(e) => setPasteOpen((e.target as HTMLDetailsElement).open)}
            >
              <summary className="text-xs font-sans text-cream-white/40 hover:text-cream-white/70 cursor-pointer list-none flex items-center gap-1 transition-colors">
                <span>Have a YouTube playlist URL?</span>
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden
                  className="group-open:rotate-180 transition-transform"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                    clipRule="evenodd"
                  />
                </svg>
              </summary>
              <form
                onSubmit={handleUrlSubmit}
                className="absolute top-full left-0 right-0 mt-3 flex flex-col gap-2"
              >
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://youtube.com/playlist?list=..."
                  disabled={isLoading}
                  className="w-full px-3 py-2 bg-vinyl-black border border-cream-white/10 rounded-lg text-cream-white placeholder:text-cream-white/30 font-mono text-xs focus:outline-none focus:border-warm-amber/50 transition-colors disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!url.trim() || isLoading}
                  className="w-full py-2 bg-vinyl-black border border-cream-white/10 text-cream-white/80 font-sans font-medium rounded-lg hover:border-cream-white/20 transition-colors text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-3 h-3 border-2 border-cream-white/30 border-t-cream-white rounded-full animate-spin" />
                      Loading…
                    </span>
                  ) : (
                    'View anonymously'
                  )}
                </button>
              </form>
            </details>

            {error && (
              <p className="absolute top-full left-0 right-0 mt-1 text-sm text-red-400">{error}</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
