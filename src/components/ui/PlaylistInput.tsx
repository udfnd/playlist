'use client';

import { useState } from 'react';

interface PlaylistInputProps {
  onSubmit: (url: string) => void;
  onSignIn: () => void;
  isLoading: boolean;
  error: string | null;
}

export function PlaylistInput({ onSubmit, onSignIn, isLoading, error }: PlaylistInputProps) {
  const [url, setUrl] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim() && !isLoading) {
      onSubmit(url.trim());
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-matte-black">
      <div className="w-full max-w-md px-6">
        <h1 className="text-2xl font-sans font-bold text-cream-white text-center mb-2">
          Playlist Viewer
        </h1>
        <p className="text-sm font-sans text-cream-white/50 text-center mb-8">
          YouTube playlist URL to get started
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://youtube.com/playlist?list=..."
            disabled={isLoading}
            className="w-full px-4 py-3 bg-vinyl-black border border-cream-white/10 rounded-lg text-cream-white placeholder:text-cream-white/30 font-mono text-sm focus:outline-none focus:border-warm-amber/50 transition-colors disabled:opacity-50"
          />

          <button
            type="submit"
            disabled={!url.trim() || isLoading}
            className="w-full py-3 bg-warm-amber text-matte-black font-sans font-semibold rounded-lg hover:bg-warm-amber/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-matte-black/30 border-t-matte-black rounded-full animate-spin" />
                Loading...
              </span>
            ) : (
              'Load Playlist'
            )}
          </button>
        </form>

        {error && (
          <p className="mt-4 text-sm text-red-400 text-center">{error}</p>
        )}

        <div className="mt-8 flex items-center gap-4">
          <div className="flex-1 h-px bg-cream-white/10" />
          <span className="text-xs text-cream-white/30 font-sans">or</span>
          <div className="flex-1 h-px bg-cream-white/10" />
        </div>

        <button
          type="button"
          onClick={onSignIn}
          disabled={isLoading}
          className="mt-4 w-full py-3 bg-vinyl-black border border-cream-white/10 text-cream-white font-sans font-medium rounded-lg hover:bg-vinyl-black/80 hover:border-cream-white/20 transition-colors flex items-center justify-center gap-3 disabled:opacity-50"
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
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

        <p className="mt-4 text-xs text-cream-white/30 text-center">
          Sign in to access your private playlists
        </p>
      </div>
    </div>
  );
}
