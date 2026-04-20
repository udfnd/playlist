'use client';

import { useState } from 'react';

interface LandingProps {
  onSubmit: (url: string) => void;
  onSignIn: () => void;
  onUseDemo: () => void;
  isLoading: boolean;
  error: string | null;
}

/**
 * The anonymous-visitor landing screen. Sign-in with Google is the primary path;
 * pasting a YouTube playlist URL is kept as a disclosed secondary option so shared
 * links continue to work and users can try the experience without an account.
 */
export function Landing({
  onSubmit,
  onSignIn,
  onUseDemo,
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
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-matte-black px-6">
      <div className="w-full max-w-md flex flex-col items-center gap-8">
        <header className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-3xl font-sans font-bold text-cream-white tracking-tight">
            onrepeat
          </h1>
          <p className="text-sm font-sans text-cream-white/60 leading-6 max-w-xs">
            Turn a playlist into a 3D listening room you can share.
          </p>
        </header>

        <button
          type="button"
          onClick={onSignIn}
          disabled={isLoading}
          className="w-full py-3.5 bg-warm-amber text-matte-black font-sans font-semibold rounded-lg hover:bg-warm-amber/90 transition-colors flex items-center justify-center gap-3 disabled:opacity-50"
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
          Sign in with Google
        </button>

        <button
          type="button"
          onClick={onUseDemo}
          disabled={isLoading}
          className="text-sm font-sans text-cream-white/60 hover:text-cream-white transition-colors disabled:opacity-40"
        >
          Try with a demo playlist
        </button>

        {/* Secondary: paste a YouTube URL to view anonymously. Kept disclosed so the
            landing stays uncluttered but shared /?list= links still have a manual
            entry point for curious visitors. */}
        <details
          className="w-full group"
          open={pasteOpen}
          onToggle={(e) => setPasteOpen((e.target as HTMLDetailsElement).open)}
        >
          <summary className="text-xs font-sans text-cream-white/40 hover:text-cream-white/70 cursor-pointer list-none flex items-center justify-center gap-1 transition-colors">
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
          <form onSubmit={handleUrlSubmit} className="mt-3 flex flex-col gap-2">
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
          <p className="text-sm text-red-400 text-center -mt-2">{error}</p>
        )}
      </div>
    </div>
  );
}
