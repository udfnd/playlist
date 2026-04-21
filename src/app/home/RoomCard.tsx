'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type Visibility = 'public' | 'unlisted' | 'private';

export interface RoomCardData {
  id: string;
  slug: string;
  title: string;
  visibility: Visibility;
  created_at: string;
  handle: string;
}

interface RoomCardProps {
  room: RoomCardData;
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const diffMs = Date.now() - then;
  const days = Math.floor(diffMs / 86_400_000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return new Date(iso).toLocaleDateString();
}

function visibilityBadge(visibility: Visibility) {
  switch (visibility) {
    case 'public':
      return {
        label: 'Public',
        dot: 'bg-green-400',
        text: 'text-green-400/90',
      };
    case 'unlisted':
      return {
        label: 'Unlisted',
        dot: 'bg-yellow-400',
        text: 'text-yellow-400/90',
      };
    case 'private':
      return {
        label: 'Private',
        dot: 'bg-red-400',
        text: 'text-red-400/90',
      };
  }
}

export function RoomCard({ room }: RoomCardProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState<null | 'delete' | 'visibility' | 'copy'>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const roomPath = `/${room.handle}/${room.slug}`;
  const fullUrl = typeof window === 'undefined'
    ? `https://onrepeat.cc${roomPath}`
    : `${window.location.origin}${roomPath}`;
  const badge = visibilityBadge(room.visibility);

  // Dismiss the menu on outside click.
  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  const copyLink = useCallback(async () => {
    setBusy('copy');
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API may fail in non-secure contexts — fall back to a prompt.
      window.prompt('Copy this link:', fullUrl);
    } finally {
      setBusy(null);
      setMenuOpen(false);
    }
  }, [fullUrl]);

  const changeVisibility = useCallback(
    async (next: Visibility) => {
      if (next === room.visibility) {
        setMenuOpen(false);
        return;
      }
      setBusy('visibility');
      setError(null);
      try {
        const res = await fetch(`/api/me/rooms/${room.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ visibility: next }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Failed to update visibility.');
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error.');
      } finally {
        setBusy(null);
        setMenuOpen(false);
      }
    },
    [room.id, room.visibility, router],
  );

  const deleteRoom = useCallback(async () => {
    const confirmed = window.confirm(
      `Delete "${room.title}"? This cannot be undone.`,
    );
    if (!confirmed) return;
    setBusy('delete');
    setError(null);
    try {
      const res = await fetch(`/api/me/rooms/${room.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Failed to delete room.');
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error.');
      setBusy(null);
    }
  }, [room.id, room.title, router]);

  return (
    <div
      className="group relative rounded-xl bg-vinyl-black border border-cream-white/5 hover:border-cream-white/20 transition-colors"
      style={busy === 'delete' ? { opacity: 0.4, pointerEvents: 'none' } : undefined}
    >
      {/* Clickable surface. pr-10 reserves 40px on the right edge so the top row
          never collides with the absolutely-positioned menu button. */}
      <Link
        href={roomPath}
        className="flex flex-col gap-3 p-4 pr-10 min-w-0 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-warm-amber/60"
      >
        <h3 className="text-[15px] font-sans font-semibold text-cream-white truncate leading-tight">
          {room.title}
        </h3>
        <p className="text-xs font-mono text-cream-white/40 truncate">
          onrepeat.cc/{room.handle}/{room.slug}
        </p>
        <div className="flex items-center gap-2 text-xs font-sans">
          <span className={`inline-flex items-center gap-1.5 ${badge.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} aria-hidden />
            {badge.label}
          </span>
          <span className="text-cream-white/20" aria-hidden>·</span>
          <span className="text-cream-white/40">
            {formatRelative(room.created_at)}
          </span>
        </div>
      </Link>

      {/* Menu button — absolutely positioned, sized to exactly fit the reserved
          pr-10 space so it never overlaps content. */}
      <div ref={menuRef} className="absolute top-3 right-3">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((v) => !v);
          }}
          aria-label="Room actions"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className="w-8 h-8 flex items-center justify-center rounded-full text-cream-white/40 bg-matte-black/40 backdrop-blur-sm hover:text-cream-white hover:bg-matte-black/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-warm-amber/60 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
            <path d="M10 3a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm0 5.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm0 5.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3z" />
          </svg>
        </button>

        {menuOpen && (
          <div
            role="menu"
            className="absolute right-0 top-8 w-52 bg-vinyl-black border border-cream-white/10 rounded-lg shadow-xl overflow-hidden z-10"
          >
            <button
              type="button"
              role="menuitem"
              onClick={copyLink}
              disabled={busy !== null}
              className="w-full px-3 py-2.5 text-left text-xs font-sans text-cream-white hover:bg-cream-white/5 transition-colors flex items-center justify-between disabled:opacity-40"
            >
              <span>{copied ? 'Link copied!' : 'Copy link'}</span>
              <span className="font-mono text-cream-white/30">⌘C</span>
            </button>

            <div className="border-t border-cream-white/5 py-1">
              <p className="px-3 py-1 text-[10px] font-sans uppercase tracking-wider text-cream-white/30">
                Visibility
              </p>
              {(['public', 'unlisted', 'private'] as const).map((v) => (
                <button
                  type="button"
                  role="menuitem"
                  key={v}
                  onClick={() => changeVisibility(v)}
                  disabled={busy !== null}
                  className="w-full px-3 py-2 text-left text-xs font-sans text-cream-white hover:bg-cream-white/5 transition-colors flex items-center justify-between disabled:opacity-40"
                >
                  <span className="capitalize">{v}</span>
                  {room.visibility === v && (
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="text-warm-amber"
                      aria-hidden
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.7 5.3a1 1 0 010 1.4l-8 8a1 1 0 01-1.4 0l-4-4a1 1 0 111.4-1.4L8 12.58l7.3-7.3a1 1 0 011.4 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </button>
              ))}
            </div>

            <div className="border-t border-cream-white/5">
              <button
                type="button"
                role="menuitem"
                onClick={deleteRoom}
                disabled={busy !== null}
                className="w-full px-3 py-2.5 text-left text-xs font-sans text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-40"
              >
                Delete room
              </button>
            </div>
          </div>
        )}
      </div>

      {error && (
        <p className="text-[11px] font-sans text-red-400 mt-1">{error}</p>
      )}
    </div>
  );
}
