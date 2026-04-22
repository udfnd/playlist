'use client';

// @MX:SPEC: SPEC-SOCIAL-001
// Debounced provider-scoped search modal. Posts the selected result to the
// suggestions queue. Does not write to external playlists.

import { useCallback, useEffect, useRef, useState } from 'react';

interface SearchResult {
  externalTrackId: string;
  title: string;
  artist: string;
  thumbnailUrl: string | null;
  durationSec: number | null;
}

interface SearchTrackModalProps {
  roomId: string;
  sourceProvider: 'youtube' | 'spotify';
  onClose: () => void;
  onSubmitted?: () => void;
}

function formatDuration(sec: number | null): string {
  if (sec == null || !Number.isFinite(sec)) return '';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function SearchTrackModal({
  roomId,
  sourceProvider,
  onClose,
  onSubmitted,
}: SearchTrackModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/rooms/${roomId}/search?q=${encodeURIComponent(q)}&limit=20`,
          { method: 'GET' },
        );
        if (!res.ok) {
          setError('검색에 실패했습니다.');
          setResults([]);
        } else {
          const data = (await res.json()) as { results: SearchResult[] };
          setResults(data.results ?? []);
        }
      } catch {
        setError('네트워크 오류');
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, roomId]);

  const submit = useCallback(
    async (r: SearchResult) => {
      setSubmittingId(r.externalTrackId);
      setError(null);
      try {
        const res = await fetch(`/api/rooms/${roomId}/suggestions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            externalTrackId: r.externalTrackId,
            title: r.title,
            artist: r.artist,
            thumbnailUrl: r.thumbnailUrl,
            durationSec: r.durationSec,
          }),
        });
        if (res.status === 429) {
          setError('추천은 시간당 5건까지만 가능합니다.');
          return;
        }
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(
            (data as { error?: string }).error ?? '추천을 보내지 못했습니다.',
          );
          return;
        }
        setSuccess('추천을 보냈습니다. 방 주인이 승인하면 방에 추가됩니다.');
        onSubmitted?.();
        setTimeout(onClose, 1200);
      } catch {
        setError('네트워크 오류');
      } finally {
        setSubmittingId(null);
      }
    },
    [roomId, onClose, onSubmitted],
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[80] flex items-center justify-center bg-matte-black/80 backdrop-blur-md p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md bg-vinyl-black border border-cream-white/10 rounded-xl shadow-2xl flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-cream-white/10">
          <h2 className="text-sm font-sans font-semibold text-cream-white">
            곡 추천하기 ·{' '}
            <span className="text-cream-white/50 font-mono">
              {sourceProvider === 'spotify' ? 'Spotify' : 'YouTube'}
            </span>
          </h2>
          <button
            type="button"
            aria-label="닫기"
            onClick={onClose}
            className="text-cream-white/50 hover:text-cream-white"
          >
            ×
          </button>
        </div>
        <div className="p-3">
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="검색어를 입력하세요"
            className="w-full px-3 py-2 rounded-md bg-matte-black/60 border border-cream-white/10 text-sm font-sans text-cream-white placeholder:text-cream-white/30 focus:outline-none focus:border-warm-amber/50"
          />
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-3">
          {loading && (
            <p className="px-3 py-2 text-xs font-sans text-cream-white/50">
              검색 중…
            </p>
          )}
          {!loading && results.length === 0 && query.trim() && !error && (
            <p className="px-3 py-2 text-xs font-sans text-cream-white/50">
              결과가 없습니다.
            </p>
          )}
          <ul className="flex flex-col gap-1">
            {results.map((r) => (
              <li key={r.externalTrackId}>
                <button
                  type="button"
                  disabled={submittingId !== null}
                  onClick={() => submit(r)}
                  className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-cream-white/5 text-left disabled:opacity-50"
                >
                  {r.thumbnailUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={r.thumbnailUrl}
                      alt=""
                      className="w-10 h-10 object-cover rounded"
                    />
                  )}
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-sans text-cream-white truncate">
                      {r.title}
                    </span>
                    <span className="block text-xs font-sans text-cream-white/50 truncate">
                      {r.artist}
                    </span>
                  </span>
                  <span className="text-xs font-mono text-cream-white/40">
                    {formatDuration(r.durationSec)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        {error && (
          <p className="px-4 pb-3 text-xs font-sans text-red-400">{error}</p>
        )}
        {success && (
          <p className="px-4 pb-3 text-xs font-sans text-warm-amber">
            {success}
          </p>
        )}
      </div>
    </div>
  );
}
