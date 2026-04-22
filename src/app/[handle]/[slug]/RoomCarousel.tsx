'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useState } from 'react';
import type { Playlist } from '@/data/types';
import type { GeneratedPreset } from '@/lib/presets/types';
import type { RoomReactionsMap } from './page';
import { SuggestTrackButton } from './SuggestTrackButton';
import { OwnerSuggestionQueue } from './OwnerSuggestionQueue';

const SongCarousel = dynamic(
  () => import('@/components/scene/SongCarousel'),
  { ssr: false },
);

interface RoomCarouselProps {
  playlist: Playlist;
  ownerHandle: string;
  roomTitle: string;
  /**
   * Which provider the track IDs belong to. YouTube uses the JS iframe API
   * (via `useYouTubePlayer`); Spotify uses a plain `<iframe>` embed at
   * `https://open.spotify.com/embed/track/{id}` with no token exposure.
   */
  playbackProvider: 'youtube' | 'spotify';
  presetKey: string | null;
  generatedPreset: GeneratedPreset | null;
  // @MX:SPEC: SPEC-SOCIAL-001
  roomId: string;
  reactions: RoomReactionsMap;
  viewerUserId: string | null;
  isOwner: boolean;
  isLoggedIn: boolean;
  isSpotifyConnected: boolean;
}

export function RoomCarousel({
  playlist,
  ownerHandle,
  roomTitle,
  playbackProvider,
  presetKey,
  generatedPreset,
  roomId,
  reactions,
  viewerUserId: _viewerUserId,
  isOwner,
  isLoggedIn,
  isSpotifyConnected,
}: RoomCarouselProps) {
  void _viewerUserId;
  const [copied, setCopied] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);

  const handleShare = useCallback(async () => {
    const url = window.location.href;
    // Prefer native share sheet when available (mobile) — falls back to clipboard
    // on desktop and non-secure contexts.
    if (navigator.share) {
      try {
        await navigator.share({ title: roomTitle, url });
        return;
      } catch {
        // Share was cancelled — fall through to clipboard as a graceful retry.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt('Copy this link:', url);
    }
  }, [roomTitle]);

  return (
    <div className="w-dvw h-dvh">
      <SongCarousel
        playlist={playlist}
        playbackProvider={playbackProvider}
        presetKey={presetKey}
        generatedPreset={generatedPreset}
        roomId={roomId}
        reactions={reactions}
      />

      {/* Room header — thin, translucent, sits on top of the 3D scene */}
      <div
        className="fixed top-[max(1rem,env(safe-area-inset-top))] left-0 right-0 z-[60] flex items-center justify-between gap-3 px-4 pointer-events-none"
      >
        <Link
          href="/"
          className="pointer-events-auto flex items-center gap-1.5 px-3 py-2 rounded-full bg-matte-black/60 backdrop-blur-md border border-cream-white/15 text-cream-white/80 hover:text-cream-white hover:bg-matte-black/80 hover:border-cream-white/30 transition-colors text-sm font-sans"
          aria-label="Back home"
        >
          <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
            <path
              fillRule="evenodd"
              d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z"
              clipRule="evenodd"
            />
          </svg>
          <span>Home</span>
        </Link>

        <div className="pointer-events-auto flex items-center gap-2 min-w-0">
          <div className="flex flex-col items-end text-right max-w-[50vw]">
            <h1 className="text-sm font-sans font-semibold text-cream-white truncate">
              {roomTitle}
            </h1>
            <Link
              href={`/${ownerHandle}`}
              className="text-xs font-mono text-cream-white/50 hover:text-cream-white/80 transition-colors truncate"
            >
              @{ownerHandle}
            </Link>
          </div>
          <button
            type="button"
            onClick={handleShare}
            aria-label="Share this room"
            className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-warm-amber/90 text-matte-black hover:bg-warm-amber transition-colors text-sm font-sans font-semibold flex-shrink-0"
          >
            <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
              <path d="M13 4.5a2.5 2.5 0 11.7 1.74L7.37 8.94a2.5 2.5 0 010 2.12l6.34 2.7a2.5 2.5 0 11-.6 1.41l-6.34-2.7a2.5 2.5 0 110-4.94l6.34-2.7A2.5 2.5 0 0113 4.5z" />
            </svg>
            <span>{copied ? 'Copied!' : 'Share'}</span>
          </button>
        </div>
      </div>

      {/* @MX:SPEC: SPEC-SOCIAL-001 — suggestion entry point + owner queue */}
      <div
        className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-0 right-0 z-[60] flex items-center justify-center gap-2 px-4 pointer-events-none"
      >
        <div className="pointer-events-auto flex items-center gap-2">
          <SuggestTrackButton
            roomId={roomId}
            sourceProvider={playbackProvider}
            isLoggedIn={isLoggedIn}
            isSpotifyConnected={isSpotifyConnected}
          />
          {isOwner && (
            <button
              type="button"
              onClick={() => setQueueOpen((v) => !v)}
              className="px-3 py-1.5 rounded-full bg-matte-black/60 backdrop-blur-md border border-cream-white/15 text-cream-white/80 hover:text-cream-white hover:border-cream-white/30 transition-colors text-xs font-sans"
            >
              {queueOpen ? '추천 닫기' : '추천 관리'}
            </button>
          )}
        </div>
      </div>

      {isOwner && queueOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-matte-black/70 backdrop-blur-md p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setQueueOpen(false);
          }}
        >
          <div className="w-full max-w-md bg-vinyl-black border border-cream-white/10 rounded-xl shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-cream-white/10">
              <h2 className="text-sm font-sans font-semibold text-cream-white">
                추천 관리
              </h2>
              <button
                type="button"
                onClick={() => setQueueOpen(false)}
                aria-label="닫기"
                className="text-cream-white/50 hover:text-cream-white"
              >
                ×
              </button>
            </div>
            <div className="overflow-y-auto p-4">
              <OwnerSuggestionQueue roomId={roomId} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
