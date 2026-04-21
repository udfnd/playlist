'use client';

// @MX:SPEC: SPEC-SPOTIFY-001
// Small client component for the /home Spotify connection chip. Server
// component cannot bind a client `onClick`, so the disconnect button
// lives in this dedicated client subcomponent; the connect CTA (server-
// rendered link) lives inline in page.tsx.

import { useState, useTransition } from 'react';

interface SpotifyStatusProps {
  connected: boolean;
}

export function SpotifyStatus({ connected }: SpotifyStatusProps) {
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function handleDisconnect() {
    setError(null);
    try {
      const res = await fetch('/api/auth/spotify/disconnect', { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? '연결 해제 실패');
      }
      startTransition(() => {
        window.location.reload();
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
    }
  }

  if (!connected) {
    // Plain button: the OAuth start route is a server redirect handler,
    // not a page, so next/link would still need full navigation. We use a
    // button triggering window.location to keep OAuth state cookies in
    // the single top-level navigation.
    return (
      <button
        type="button"
        onClick={() => {
          window.location.href = '/api/auth/spotify/connect?returnTo=/home';
        }}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-warm-amber/40 bg-warm-amber/10 text-warm-amber text-xs font-sans font-semibold hover:bg-warm-amber/20 transition-colors"
      >
        Spotify 연결하기
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-cream-white/15 bg-vinyl-black text-cream-white/80 text-xs font-sans font-semibold">
        <span
          className="w-1.5 h-1.5 rounded-full bg-green-400"
          aria-hidden
        />
        Spotify 연결됨
      </span>
      <button
        type="button"
        onClick={handleDisconnect}
        className="text-xs font-sans text-cream-white/50 hover:text-cream-white transition-colors"
      >
        연결 해제
      </button>
      {error && <span className="text-xs font-sans text-red-400">{error}</span>}
    </div>
  );
}
