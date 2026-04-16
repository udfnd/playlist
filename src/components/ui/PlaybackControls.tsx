'use client';

import { formatDuration } from '@/lib/format';

interface PlaybackControlsProps {
  isPlaying: boolean;
  duration: number;
  progress: number;
  onToggle: () => void;
}

function PlayIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M6.3 2.84A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.27l9.34-5.89a1.5 1.5 0 000-2.54L6.3 2.84z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M5.75 3a.75.75 0 00-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 00.75-.75V3.75A.75.75 0 007.25 3h-1.5zM12.75 3a.75.75 0 00-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 00.75-.75V3.75a.75.75 0 00-.75-.75h-1.5z" />
    </svg>
  );
}

export function PlaybackControls({
  isPlaying,
  duration,
  progress,
  onToggle,
}: PlaybackControlsProps) {
  const elapsed = Math.floor(progress * duration);
  const percentComplete = Math.round(progress * 100);

  return (
    <div className="flex flex-col gap-3 w-full max-w-xs">
      <div
        role="progressbar"
        aria-valuenow={percentComplete}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-1 w-full rounded-full bg-vinyl-black overflow-hidden"
      >
        <div
          className="h-full bg-muted-violet transition-[width] duration-300"
          style={{ width: `${percentComplete}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="font-mono text-cream-white/50">
          {formatDuration(elapsed)}
        </span>
        <span className="font-mono text-cream-white/50">
          {formatDuration(duration)}
        </span>
      </div>

      <div className="flex items-center justify-center">
        <button
          type="button"
          onClick={onToggle}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          className="p-3 text-cream-white hover:text-warm-amber transition-colors"
        >
          {isPlaying ? <PauseIcon /> : <PlayIcon />}
        </button>
      </div>
    </div>
  );
}
