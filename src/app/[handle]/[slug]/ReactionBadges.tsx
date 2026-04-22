'use client';

// @MX:SPEC: SPEC-SOCIAL-001
// Small per-track count pills. Renders only emojis with count > 0.

import type { ReactionEmoji } from '@/data/reactions';

interface ReactionBadgesProps {
  counts: Array<{ emoji: ReactionEmoji | string; count: number }>;
}

export function ReactionBadges({ counts }: ReactionBadgesProps) {
  const visible = counts.filter((c) => c.count > 0);
  if (visible.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 justify-center">
      {visible.map(({ emoji, count }) => (
        <span
          key={emoji}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cream-white/5 border border-cream-white/10 text-xs font-sans text-cream-white/80"
        >
          <span aria-hidden>{emoji}</span>
          <span className="font-mono text-cream-white/60">{count}</span>
        </span>
      ))}
    </div>
  );
}
