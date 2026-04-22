'use client';

// @MX:SPEC: SPEC-SOCIAL-001
// Per-track emoji reaction picker. Uses optimistic UI: toggles immediately
// and reverts on non-2xx response. Calls the existing reactions route with
// `trackRef + emoji`.

import { useCallback, useState } from 'react';
import { EMOJI_SET, type ReactionEmoji } from '@/data/reactions';

interface ReactionPickerProps {
  roomId: string;
  trackRef: string;
  initialMine: Set<ReactionEmoji>;
  onReactionChange?: () => void;
}

export function ReactionPicker({
  roomId,
  trackRef,
  initialMine,
  onReactionChange,
}: ReactionPickerProps) {
  const [mine, setMine] = useState<Set<ReactionEmoji>>(
    () => new Set(initialMine),
  );
  const [error, setError] = useState<string | null>(null);

  const toggle = useCallback(
    async (emoji: ReactionEmoji) => {
      const wasMine = mine.has(emoji);
      // Optimistic flip.
      setMine((prev) => {
        const next = new Set(prev);
        if (wasMine) next.delete(emoji);
        else next.add(emoji);
        return next;
      });
      try {
        const res = await fetch(`/api/rooms/${roomId}/reactions`, {
          method: wasMine ? 'DELETE' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trackRef, emoji }),
        });
        if (!res.ok) {
          // Revert.
          setMine((prev) => {
            const next = new Set(prev);
            if (wasMine) next.add(emoji);
            else next.delete(emoji);
            return next;
          });
          if (res.status === 429) {
            setError('잠시 후 다시 시도해 주세요');
          } else if (res.status === 401) {
            setError('반응을 남기려면 쿠키 허용이 필요합니다.');
          } else {
            setError('반응 저장에 실패했습니다.');
          }
          setTimeout(() => setError(null), 2500);
          return;
        }
        onReactionChange?.();
      } catch {
        setMine((prev) => {
          const next = new Set(prev);
          if (wasMine) next.add(emoji);
          else next.delete(emoji);
          return next;
        });
        setError('네트워크 오류');
        setTimeout(() => setError(null), 2500);
      }
    },
    [mine, roomId, trackRef, onReactionChange],
  );

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="flex flex-wrap gap-1.5 justify-center">
        {EMOJI_SET.map((emoji) => {
          const pressed = mine.has(emoji);
          return (
            <button
              key={emoji}
              type="button"
              aria-label={`반응 ${emoji}`}
              aria-pressed={pressed}
              onClick={() => toggle(emoji)}
              className={[
                'w-9 h-9 flex items-center justify-center rounded-full text-base transition-colors',
                pressed
                  ? 'bg-warm-amber/30 border border-warm-amber/60'
                  : 'bg-cream-white/5 border border-cream-white/10 hover:bg-cream-white/10',
              ].join(' ')}
            >
              <span aria-hidden>{emoji}</span>
            </button>
          );
        })}
      </div>
      {error && (
        <p className="text-[11px] font-sans text-red-400">{error}</p>
      )}
    </div>
  );
}
