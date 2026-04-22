'use client';

// @MX:SPEC: SPEC-SOCIAL-001
// Entry point for the suggest-a-track flow. Guards auth + Spotify connection
// before opening the search modal.

import { useCallback, useState } from 'react';
import { signIn } from 'next-auth/react';
import { SearchTrackModal } from './SearchTrackModal';

interface SuggestTrackButtonProps {
  roomId: string;
  sourceProvider: 'youtube' | 'spotify';
  isLoggedIn: boolean;
  isSpotifyConnected: boolean;
}

export function SuggestTrackButton({
  roomId,
  sourceProvider,
  isLoggedIn,
  isSpotifyConnected,
}: SuggestTrackButtonProps) {
  const [open, setOpen] = useState(false);

  const needsSpotify = sourceProvider === 'spotify' && !isSpotifyConnected;

  const label = !isLoggedIn
    ? '곡 추천하기 (로그인 필요)'
    : needsSpotify
      ? '곡 추천하기 (Spotify 연결 필요)'
      : '곡 추천하기';

  const handleClick = useCallback(() => {
    if (!isLoggedIn) {
      signIn('google', {
        callbackUrl:
          typeof window !== 'undefined' ? window.location.href : '/',
      });
      return;
    }
    if (needsSpotify) {
      const returnTo =
        typeof window !== 'undefined' ? window.location.href : '/';
      window.location.href = `/api/auth/spotify/connect?returnTo=${encodeURIComponent(returnTo)}`;
      return;
    }
    setOpen(true);
  }, [isLoggedIn, needsSpotify]);

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="px-3 py-1.5 rounded-full bg-warm-amber/90 text-matte-black hover:bg-warm-amber transition-colors text-xs font-sans font-semibold"
      >
        {label}
      </button>
      {open && (
        <SearchTrackModal
          roomId={roomId}
          sourceProvider={sourceProvider}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
