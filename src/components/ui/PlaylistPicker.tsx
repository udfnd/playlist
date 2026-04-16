'use client';

import { useEffect, useState, useCallback } from 'react';

interface UserPlaylist {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  itemCount: number;
  privacyStatus: string;
}

interface PlaylistPickerProps {
  onSelect: (playlistId: string) => void;
  onSignOut: () => void;
  isLoading: boolean;
}

export function PlaylistPicker({ onSelect, onSignOut, isLoading }: PlaylistPickerProps) {
  const [playlists, setPlaylists] = useState<UserPlaylist[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [shareResult, setShareResult] = useState<{ id: string; url: string } | null>(null);

  useEffect(() => {
    fetch('/api/my-playlists')
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setPlaylists(data.playlists);
      })
      .catch((err) => setError(err.message))
      .finally(() => setFetching(false));
  }, []);

  const handleShare = useCallback(async (playlistId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSharingId(playlistId);
    setShareResult(null);

    try {
      const res = await fetch('/api/playlist/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playlistId }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setShareResult({ id: playlistId, url: data.shareUrl });

      // Update privacy status in the list
      setPlaylists((prev) =>
        prev.map((p) =>
          p.id === playlistId ? { ...p, privacyStatus: 'unlisted' } : p,
        ),
      );

      // Copy to clipboard
      await navigator.clipboard.writeText(data.shareUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to share');
    } finally {
      setSharingId(null);
    }
  }, []);

  const privacyLabel = (status: string) => {
    switch (status) {
      case 'private': return 'Private';
      case 'unlisted': return 'Unlisted';
      case 'public': return 'Public';
      default: return status;
    }
  };

  const privacyColor = (status: string) => {
    switch (status) {
      case 'private': return 'text-red-400';
      case 'unlisted': return 'text-yellow-400';
      case 'public': return 'text-green-400';
      default: return 'text-cream-white/40';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-matte-black">
      <div className="flex items-center justify-between p-4 border-b border-cream-white/10">
        <h1 className="text-lg font-sans font-bold text-cream-white">
          My Playlists
        </h1>
        <button
          type="button"
          onClick={onSignOut}
          className="text-sm font-sans text-cream-white/40 hover:text-cream-white/70 transition-colors"
        >
          Sign Out
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {fetching && (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-warm-amber/30 border-t-warm-amber rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <p className="text-sm text-red-400 text-center py-4">{error}</p>
        )}

        {!fetching && playlists.length === 0 && !error && (
          <p className="text-sm text-cream-white/40 text-center py-12">
            No playlists found
          </p>
        )}

        <div className="max-w-2xl mx-auto flex flex-col gap-2">
          {playlists.map((pl) => (
            <div
              key={pl.id}
              role="button"
              tabIndex={0}
              onClick={() => !isLoading && onSelect(pl.id)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !isLoading) onSelect(pl.id); }}
              className={`flex items-center gap-4 p-3 rounded-lg bg-vinyl-black hover:bg-vinyl-black/80 transition-colors text-left cursor-pointer ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={pl.thumbnailUrl}
                alt={pl.title}
                className="w-16 h-16 rounded object-cover flex-shrink-0 bg-matte-black"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-sans font-semibold text-cream-white truncate">
                  {pl.title}
                </p>
                <p className="text-xs font-sans text-cream-white/40 mt-0.5">
                  {pl.itemCount} songs
                </p>
                <span className={`text-xs font-mono ${privacyColor(pl.privacyStatus)}`}>
                  {privacyLabel(pl.privacyStatus)}
                </span>
              </div>

              <div className="flex-shrink-0 flex items-center gap-2">
                {/* Share button for private/unlisted playlists */}
                {pl.privacyStatus === 'private' && (
                  <button
                    type="button"
                    onClick={(e) => handleShare(pl.id, e)}
                    disabled={sharingId === pl.id}
                    className="px-3 py-1.5 text-xs font-sans font-medium bg-warm-amber text-matte-black rounded-md hover:bg-warm-amber/90 transition-colors disabled:opacity-50"
                  >
                    {sharingId === pl.id ? '...' : 'Share'}
                  </button>
                )}

                {shareResult?.id === pl.id && (
                  <span className="text-xs text-green-400">Copied!</span>
                )}

                {/* Arrow */}
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="text-cream-white/30"
                >
                  <path
                    fillRule="evenodd"
                    d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
