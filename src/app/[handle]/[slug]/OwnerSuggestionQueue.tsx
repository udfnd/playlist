'use client';

// @MX:SPEC: SPEC-SOCIAL-001
// Owner-only moderation panel. Lists pending/approved/rejected suggestions
// and PATCHes on approve/reject.

import { useCallback, useEffect, useState } from 'react';

interface SuggestionRow {
  id: string;
  title: string;
  artist: string;
  status: 'pending' | 'approved' | 'rejected';
  source_provider: 'youtube' | 'spotify';
  external_track_id: string;
  thumbnail_url: string | null;
  duration_sec: number | null;
}

interface OwnerSuggestionQueueProps {
  roomId: string;
}

export function OwnerSuggestionQueue({ roomId }: OwnerSuggestionQueueProps) {
  const [rows, setRows] = useState<SuggestionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/rooms/${roomId}/suggestions`, {
        method: 'GET',
      });
      if (!res.ok) {
        setError('추천 목록을 불러오지 못했습니다.');
        return;
      }
      const data = (await res.json()) as { suggestions: SuggestionRow[] };
      setRows(data.suggestions ?? []);
      setError(null);
    } catch {
      setError('네트워크 오류');
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const moderate = useCallback(
    async (id: string, status: 'approved' | 'rejected') => {
      setBusyId(id);
      try {
        const res = await fetch(`/api/rooms/${roomId}/suggestions/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        });
        if (!res.ok) {
          setError('처리에 실패했습니다.');
          return;
        }
        setRows((prev) =>
          prev.map((r) => (r.id === id ? { ...r, status } : r)),
        );
      } catch {
        setError('네트워크 오류');
      } finally {
        setBusyId(null);
      }
    },
    [roomId],
  );

  const pending = rows.filter((r) => r.status === 'pending');
  const approved = rows.filter((r) => r.status === 'approved');
  const rejected = rows.filter((r) => r.status === 'rejected');

  if (loading && rows.length === 0) {
    return (
      <p className="text-xs font-sans text-cream-white/50">불러오는 중…</p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <p className="text-xs font-sans text-red-400">{error}</p>}

      <section>
        <h3 className="text-xs font-sans font-semibold text-cream-white/70 mb-2">
          대기 중 {pending.length}건
        </h3>
        <ul className="flex flex-col gap-1.5">
          {pending.map((r) => (
            <li
              key={r.id}
              className="flex items-center gap-2 p-2 rounded-md bg-cream-white/5"
            >
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-sans text-cream-white truncate">
                  {r.title}
                </span>
                <span className="block text-xs font-sans text-cream-white/50 truncate">
                  {r.artist}
                </span>
              </span>
              <button
                type="button"
                disabled={busyId === r.id}
                onClick={() => moderate(r.id, 'approved')}
                className="px-2 py-1 rounded text-xs font-sans bg-warm-amber/90 text-matte-black hover:bg-warm-amber disabled:opacity-50"
              >
                승인
              </button>
              <button
                type="button"
                disabled={busyId === r.id}
                onClick={() => moderate(r.id, 'rejected')}
                className="px-2 py-1 rounded text-xs font-sans bg-cream-white/10 text-cream-white hover:bg-cream-white/20 disabled:opacity-50"
              >
                거절
              </button>
            </li>
          ))}
          {pending.length === 0 && (
            <li className="text-xs font-sans text-cream-white/40">
              대기 중인 추천이 없습니다.
            </li>
          )}
        </ul>
      </section>

      <section>
        <h3 className="text-xs font-sans font-semibold text-cream-white/70 mb-2">
          승인됨 {approved.length}건
        </h3>
        <p className="text-xs font-sans text-cream-white/50">
          승인된 추천 {approved.length}건이 방에 보입니다.
        </p>
        <ul className="flex flex-col gap-1">
          {approved.map((r) => (
            <li
              key={r.id}
              className="text-xs font-sans text-cream-white/70 truncate"
            >
              <span>{r.title}</span>
              <span className="text-cream-white/40"> — {r.artist}</span>
            </li>
          ))}
        </ul>
      </section>

      {rejected.length > 0 && (
        <section>
          <h3 className="text-xs font-sans font-semibold text-cream-white/70 mb-2">
            거절됨 {rejected.length}건
          </h3>
          <ul className="flex flex-col gap-1">
            {rejected.map((r) => (
              <li
                key={r.id}
                className="text-xs font-sans text-cream-white/40 truncate"
              >
                {r.title} — {r.artist}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
