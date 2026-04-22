'use client';

import { useMemo, useEffect } from 'react';
import type { Song } from '@/data/types';
import { PlaybackControls } from '@/components/ui/PlaybackControls';
import { generateCoverDataUrl } from '@/lib/cover-generator';
import { formatDuration } from '@/lib/format';
import { ReactionPicker } from '@/app/[handle]/[slug]/ReactionPicker';
import { ReactionBadges } from '@/app/[handle]/[slug]/ReactionBadges';
import type { ReactionEmoji } from '@/data/reactions';

interface SongViewProps {
  song: Song;
  songIndex: number;
  onClose: () => void;
  /**
   * Which provider the track ID belongs to. 'spotify' renders the
   * open.spotify.com embed iframe in place of the YouTube player slot.
   */
  playbackProvider?: 'youtube' | 'spotify';
  // YouTube player integration (optional — falls back to mock playback)
  youtubePlayer?: {
    isPlaying: boolean;
    progress: number;
    duration: number;
    toggle: () => void;
    loadVideo: (videoId: string) => void;
    containerRef: (el: HTMLDivElement | null) => void;
  };
  // Legacy mock playback (used when no YouTube player)
  isPlaying?: boolean;
  progress?: number;
  onToggle?: () => void;
  // @MX:SPEC: SPEC-SOCIAL-001 — reactions (optional, only shown when roomId is given)
  roomId?: string;
  trackReactions?: Array<{ emoji: string; count: number }>;
}

export function SongView({
  song,
  songIndex,
  onClose,
  playbackProvider = 'youtube',
  youtubePlayer,
  isPlaying: mockIsPlaying,
  progress: mockProgress,
  onToggle: mockOnToggle,
  roomId,
  trackReactions,
}: SongViewProps) {
  const coverUrl = useMemo(
    () =>
      song.thumbnailUrl ||
      generateCoverDataUrl(song.title, song.artist, song.color, songIndex),
    [song.thumbnailUrl, song.title, song.artist, song.color, songIndex],
  );

  // Load video when song changes
  useEffect(() => {
    if (youtubePlayer && song.videoId) {
      youtubePlayer.loadVideo(song.videoId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [song.videoId]);

  const isPlaying = youtubePlayer ? youtubePlayer.isPlaying : (mockIsPlaying ?? false);
  const progress = youtubePlayer ? youtubePlayer.progress : (mockProgress ?? 0);
  const duration = youtubePlayer ? youtubePlayer.duration : song.duration;
  const handleToggle = youtubePlayer ? youtubePlayer.toggle : mockOnToggle;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-matte-black/80 backdrop-blur-md">
      {/* Close button */}
      <div className="flex justify-end p-4">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="p-2 text-cream-white/50 hover:text-cream-white transition-colors"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
          </svg>
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-6 pb-4">
        <div className="max-w-md mx-auto flex flex-col items-center gap-6">
          {/* Cover art */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={coverUrl}
            alt={song.title}
            className="w-56 h-56 md:w-64 md:h-64 shadow-2xl object-cover rounded-xl"
          />

          {/* Song info */}
          <div className="text-center">
            <h1 className="text-2xl font-sans font-bold text-cream-white">
              {song.title}
            </h1>
            <p className="text-sm font-sans text-cream-white/60 mt-1">
              {song.artist}
            </p>
            <p className="text-xs font-mono text-cream-white/40 mt-1">
              {formatDuration(duration)}
            </p>
            {song.isSuggested && (
              <span className="inline-flex items-center mt-2 px-2 py-0.5 rounded-full bg-warm-amber/20 border border-warm-amber/40 text-[11px] font-sans text-warm-amber">
                추천
              </span>
            )}
          </div>

          {/* @MX:SPEC: SPEC-SOCIAL-001 — per-track reaction UI */}
          {roomId && (
            <div className="w-full flex flex-col items-center gap-2">
              <ReactionBadges counts={trackReactions ?? []} />
              <ReactionPicker
                roomId={roomId}
                trackRef={song.videoId ?? song.id}
                initialMine={new Set<ReactionEmoji>()}
              />
            </div>
          )}

          {/* Playback controls */}
          {handleToggle && (
            <PlaybackControls
              isPlaying={isPlaying}
              duration={duration}
              progress={progress}
              onToggle={handleToggle}
            />
          )}

          {/* Player — YouTube uses the JS iframe API injected into the
              container ref; Spotify uses a plain embed iframe. Only one of
              the two is ever rendered per room. */}
          {song.videoId && playbackProvider === 'youtube' && (
            <div className="w-full mt-2">
              <div
                ref={youtubePlayer?.containerRef}
                className="relative w-full rounded-lg overflow-hidden [aspect-ratio:16/9] [&>iframe]:absolute [&>iframe]:inset-0 [&>iframe]:w-full [&>iframe]:h-full"
              />
            </div>
          )}
          {song.videoId && playbackProvider === 'spotify' && (
            <div className="w-full mt-2">
              <iframe
                src={`https://open.spotify.com/embed/track/${encodeURIComponent(song.videoId)}`}
                title={song.title}
                allow="encrypted-media; clipboard-write"
                loading="lazy"
                className="w-full rounded-lg [aspect-ratio:16/9]"
              />
            </div>
          )}

          {/* Lyrics */}
          {song.lyrics && (
            <div className="w-full mt-2">
              <h2 className="text-xs font-sans font-semibold text-cream-white/40 uppercase tracking-wider mb-3">
                Lyrics
              </h2>
              <p className="text-sm font-sans text-cream-white/70 leading-7 whitespace-pre-line">
                {song.lyrics}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
