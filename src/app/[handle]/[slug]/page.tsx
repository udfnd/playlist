import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { fetchYouTubePlaylist, type AuthMethod } from '@/lib/youtube/fetch-playlist';
import { RoomCarousel } from './RoomCarousel';
import type { Playlist } from '@/data/types';

interface RoomPageParams {
  handle: string;
  slug: string;
}

// URL format is /handle/slug (no leading "@"). Next.js App Router treats "@"-prefixed
// path segments as parallel route slot references, so a URL like /@seungmok/my-room
// never reaches this dynamic route. The UI surfaces the "@" only as display chrome.

async function loadRoomAndPlaylist(
  params: RoomPageParams,
): Promise<
  | {
      ok: true;
      title: string;
      ownerHandle: string;
      playlist: Playlist;
      presetKey: string | null;
    }
  | { ok: false; reason: 'not-found' | 'unavailable' }
> {
  const supabase = getSupabaseAdmin();

  const { data: owner } = await supabase
    .from('users')
    .select('id, handle')
    .eq('handle', params.handle)
    .maybeSingle();
  if (!owner) return { ok: false, reason: 'not-found' };

  const { data: room } = await supabase
    .from('rooms')
    .select(
      'id, user_id, slug, title, source_provider, source_playlist_id, visibility, preset_key',
    )
    .eq('user_id', owner.id)
    .eq('slug', params.slug)
    .maybeSingle();
  if (!room) return { ok: false, reason: 'not-found' };

  // Private rooms are visible only to the owner; unlisted rooms are public to anyone
  // who has the URL.
  if (room.visibility === 'private') {
    const session = await auth();
    if (!session?.userId || session.userId !== room.user_id) {
      return { ok: false, reason: 'not-found' };
    }
  }

  // Choose the strongest available YouTube auth: prefer an owner OAuth token (so even
  // unlisted-to-public-after-share works), fall back to API key for public playlists.
  let authMethod: AuthMethod | null = null;

  try {
    const { data: connection } = await supabase
      .from('music_connections')
      .select('access_token')
      .eq('user_id', room.user_id)
      .eq('provider', 'google')
      .maybeSingle();
    if (connection?.access_token) {
      authMethod = { type: 'oauth', accessToken: connection.access_token };
    }
  } catch {
    // fall through to API key
  }

  if (!authMethod) {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) return { ok: false, reason: 'unavailable' };
    authMethod = { type: 'apiKey', key: apiKey };
  }

  try {
    const playlist = await fetchYouTubePlaylist(room.source_playlist_id, authMethod);
    return {
      ok: true,
      title: room.title,
      ownerHandle: owner.handle!,
      playlist,
      presetKey: room.preset_key ?? null,
    };
  } catch (err) {
    console.error('[room] playlist fetch failed:', err);
    return { ok: false, reason: 'unavailable' };
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<RoomPageParams>;
}): Promise<Metadata> {
  const p = await params;
  const supabase = getSupabaseAdmin();
  const { data: owner } = await supabase
    .from('users')
    .select('id')
    .eq('handle', p.handle)
    .maybeSingle();
  if (!owner) return { title: 'Not found' };

  const { data: room } = await supabase
    .from('rooms')
    .select('title')
    .eq('user_id', owner.id)
    .eq('slug', p.slug)
    .maybeSingle();

  if (!room) return { title: 'Not found' };
  const description = `A listening room by @${p.handle} on onrepeat.cc`;
  return {
    title: `${room.title} — @${p.handle} · onrepeat`,
    description,
    // The opengraph-image.tsx neighbour is auto-wired as the og:image; we just need to
    // promote the Twitter card to the large variant so it matches the 1200×630 render.
    openGraph: {
      title: room.title,
      description,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: room.title,
      description,
    },
  };
}

export default async function RoomPage({
  params,
}: {
  params: Promise<RoomPageParams>;
}) {
  const p = await params;
  const result = await loadRoomAndPlaylist(p);

  if (!result.ok) {
    if (result.reason === 'not-found') notFound();
    return (
      <main className="min-h-dvh flex flex-col items-center justify-center bg-matte-black text-cream-white px-6 text-center">
        <h1 className="text-xl font-sans font-semibold mb-2">Room is unavailable</h1>
        <p className="text-sm font-sans text-cream-white/60 max-w-sm">
          The source playlist could not be loaded. It may be private, deleted, or
          temporarily out of reach.
        </p>
        <Link
          href="/"
          className="mt-6 text-sm font-sans text-warm-amber hover:text-warm-amber/80"
        >
          Back home
        </Link>
      </main>
    );
  }

  return (
    <RoomCarousel
      playlist={result.playlist}
      ownerHandle={result.ownerHandle}
      roomTitle={result.title}
      presetKey={result.presetKey}
    />
  );
}
