'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import type { Playlist } from '@/data/types';

const SongCarousel = dynamic(
  () => import('@/components/scene/SongCarousel'),
  { ssr: false },
);

interface RoomCarouselProps {
  playlist: Playlist;
  ownerHandle: string;
  roomTitle: string;
}

export function RoomCarousel({
  playlist,
  ownerHandle,
  roomTitle,
}: RoomCarouselProps) {
  return (
    <div className="w-dvw h-dvh">
      <SongCarousel playlist={playlist} />

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

        <div className="pointer-events-auto flex flex-col items-end text-right max-w-[60vw]">
          <h1 className="text-sm font-sans font-semibold text-cream-white truncate">
            {roomTitle}
          </h1>
          <span className="text-xs font-mono text-cream-white/50 truncate">
            @{ownerHandle}
          </span>
        </div>
      </div>
    </div>
  );
}
