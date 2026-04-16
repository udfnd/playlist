'use client';

import { useState, useCallback, useEffect } from 'react';
import { signIn, signOut, useSession } from 'next-auth/react';
import dynamic from 'next/dynamic';
import { PlaylistInput } from '@/components/ui/PlaylistInput';
import { PlaylistPicker } from '@/components/ui/PlaylistPicker';
import { defaultPlaylist } from '@/data/mock-playlists';
import type { Playlist } from '@/data/types';

const SongCarousel = dynamic(
  () => import('@/components/scene/SongCarousel'),
  { ssr: false },
);

type View = 'input' | 'picker' | 'carousel';

export default function Home() {
  const { data: session, status } = useSession();
  const [view, setView] = useState<View>('input');
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check URL params for shared playlist links
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const listParam = params.get('list');
    if (listParam) {
      loadPlaylist(listParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When user signs in, show their playlists
  useEffect(() => {
    if (status === 'authenticated' && view === 'input') {
      setView('picker');
    }
  }, [status, view]);

  const loadPlaylist = useCallback(async (listIdOrUrl: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/playlist?list=${encodeURIComponent(listIdOrUrl)}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to load playlist');
      }

      if (!data.songs || data.songs.length === 0) {
        throw new Error('Playlist is empty or contains only private videos');
      }

      setPlaylist(data as Playlist);
      setView('carousel');

      // Update URL so refresh reloads the same playlist
      const url = new URL(window.location.href);
      url.searchParams.set('list', data.id);
      window.history.replaceState(null, '', url.toString());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSignIn = useCallback(() => {
    signIn('google');
  }, []);

  const handleSignOut = useCallback(() => {
    signOut({ redirect: false });
    setView('input');
  }, []);

  const handleSelectPlaylist = useCallback(
    (playlistId: string) => {
      loadPlaylist(playlistId);
    },
    [loadPlaylist],
  );

  const handleUseDemo = useCallback(() => {
    setPlaylist(defaultPlaylist);
    setView('carousel');
  }, []);

  const handleBack = useCallback(() => {
    setPlaylist(null);
    setView(session ? 'picker' : 'input');
    setError(null);

    const url = new URL(window.location.href);
    url.searchParams.delete('list');
    window.history.replaceState(null, '', url.toString());
  }, [session]);

  if (view === 'carousel' && playlist) {
    return (
      <div className="w-screen h-screen">
        <SongCarousel playlist={playlist} />
        <button
          type="button"
          onClick={handleBack}
          className="fixed top-4 left-4 z-[60] p-2 text-cream-white/30 hover:text-cream-white/70 transition-colors"
          aria-label="Back"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>
    );
  }

  if (view === 'picker' && session) {
    return (
      <PlaylistPicker
        onSelect={handleSelectPlaylist}
        onSignOut={handleSignOut}
        isLoading={isLoading}
      />
    );
  }

  return (
    <div className="w-screen h-screen">
      <PlaylistInput
        onSubmit={loadPlaylist}
        onSignIn={handleSignIn}
        isLoading={isLoading}
        error={error}
      />
      <div className="fixed bottom-8 left-0 right-0 flex justify-center">
        <button
          type="button"
          onClick={handleUseDemo}
          className="text-sm font-sans text-cream-white/30 hover:text-cream-white/60 transition-colors"
        >
          or try with demo playlist
        </button>
      </div>
    </div>
  );
}
