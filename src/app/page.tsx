'use client';

import { useState, useCallback, useEffect } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Landing } from '@/components/ui/Landing';
import { SaveAsRoomButton } from '@/components/ui/SaveAsRoomButton';
import type { Playlist } from '@/data/types';

const SongCarousel = dynamic(
  () => import('@/components/scene/SongCarousel'),
  { ssr: false },
);

type View = 'landing' | 'carousel';

/**
 * Routing intent for "/":
 *   • ?list=X in URL  → carousel view (shared/anonymous listen)
 *   • authenticated and no ?list=  → redirect to /home (the new dashboard)
 *   • unauthenticated and no ?list= → landing with Google CTA, demo, and
 *     a disclosed YouTube-URL fallback
 */
export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [view, setView] = useState<View>('landing');
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasListParam, setHasListParam] = useState(false);

  const loadPlaylist = useCallback(async (listIdOrUrl: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/playlist?list=${encodeURIComponent(listIdOrUrl)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load playlist');
      if (!data.songs || data.songs.length === 0) {
        throw new Error('Playlist is empty or contains only private videos');
      }

      setPlaylist(data as Playlist);
      setView('carousel');

      // Mirror the id into the URL so refresh keeps the same state.
      const url = new URL(window.location.href);
      url.searchParams.set('list', data.id);
      window.history.replaceState(null, '', url.toString());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // On first mount, resolve any ?list= in the URL into a carousel view.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const listParam = params.get('list');
    if (listParam) {
      setHasListParam(true);
      loadPlaylist(listParam);
    }
  }, [loadPlaylist]);

  // Once authenticated and a handle is chosen, the dashboard at /home becomes the true
  // home for signed-in users. Only redirect when there's no ?list= — otherwise the
  // visitor is here specifically to view a shared playlist.
  useEffect(() => {
    if (
      status === 'authenticated' &&
      session?.handle &&
      !hasListParam &&
      view === 'landing'
    ) {
      router.replace('/home');
    }
  }, [status, session?.handle, hasListParam, view, router]);

  const handleSignIn = useCallback(() => {
    signIn('google', { callbackUrl: '/home' });
  }, []);

  const handleBack = useCallback(() => {
    setPlaylist(null);
    setView('landing');
    setError(null);
    setHasListParam(false);
    const url = new URL(window.location.href);
    url.searchParams.delete('list');
    window.history.replaceState(null, '', url.toString());
    // If signed in with a handle, take them to their dashboard; otherwise stay on /.
    if (session?.handle) router.push('/home');
  }, [session?.handle, router]);

  if (view === 'carousel' && playlist) {
    const canPublish = Boolean(session?.handle);
    return (
      <div className="w-dvw h-dvh">
        <SongCarousel playlist={playlist} />
        <button
          type="button"
          onClick={handleBack}
          className="fixed top-[max(1rem,env(safe-area-inset-top))] left-4 z-[60] flex items-center gap-1.5 px-3 py-2 rounded-full bg-matte-black/60 backdrop-blur-md border border-cream-white/15 text-cream-white/80 hover:text-cream-white hover:bg-matte-black/80 hover:border-cream-white/30 transition-colors text-sm font-sans"
          aria-label="Back"
        >
          <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path
              fillRule="evenodd"
              d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z"
              clipRule="evenodd"
            />
          </svg>
          <span>Back</span>
        </button>
        {canPublish && (
          <SaveAsRoomButton
            sourcePlaylistId={playlist.id}
            defaultTitle={playlist.name}
          />
        )}
      </div>
    );
  }

  return (
    <div className="w-dvw h-dvh">
      <Landing
        onSubmit={loadPlaylist}
        onSignIn={handleSignIn}
        isLoading={isLoading}
        error={error}
      />
      <div
        className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] left-0 right-0 z-[60] flex justify-center pointer-events-none"
      >
        <div className="pointer-events-auto flex items-center gap-3 text-xs font-sans text-cream-white/30">
          <Link href="/privacy" className="hover:text-cream-white/60 transition-colors">
            Privacy
          </Link>
          <span aria-hidden>·</span>
          <Link href="/terms" className="hover:text-cream-white/60 transition-colors">
            Terms
          </Link>
        </div>
      </div>
    </div>
  );
}
