import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { fetchYouTubePlaylist, type AuthMethod } from '@/lib/youtube/fetch-playlist';
import { fetchSpotifyPlaylist } from '@/lib/spotify/fetch-playlist';
import { SpotifyUnavailableError } from '@/lib/spotify/client';
import { RoomCarousel } from './RoomCarousel';
import type { Playlist, Song } from '@/data/types';
import type { GeneratedPreset } from '@/lib/presets/types';
import type { ReactionEmoji } from '@/data/reactions';

type PlaybackProvider = 'youtube' | 'spotify';

// @MX:SPEC: SPEC-SOCIAL-001
export interface TrackReactionAggregate {
  emoji: ReactionEmoji | string;
  count: number;
}
export type RoomReactionsMap = Record<string, TrackReactionAggregate[]>;

interface RoomPageParams {
  handle: string;
  slug: string;
}

// URL format is /handle/slug (no leading "@"). Next.js App Router treats "@"-prefixed
// path segments as parallel route slot references, so a URL like /@seungmok/my-room
// never reaches this dynamic route. The UI surfaces the "@" only as display chrome.

async function loadExtrasAndReactions(
  roomId: string,
): Promise<{ extras: Song[]; reactions: RoomReactionsMap }> {
  // Cast to untyped client — new social-layer tables are not yet in the
  // generated Database types. Same pattern used in src/lib/reactions/service.ts.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = getSupabaseAdmin() as unknown as any;
  // @MX:SPEC: SPEC-SOCIAL-001 — approved suggestions appended to playlist.
  const [extrasRes, reactionsRes] = await Promise.all([
    supabase
      .from('room_extra_tracks')
      .select(
        'position, suggestion_id, track_suggestions!inner(id, status, external_track_id, title, artist, thumbnail_url, duration_sec)',
      )
      .eq('room_id', roomId)
      .order('position', { ascending: true }),
    supabase
      .from('track_reactions')
      .select('track_ref, emoji')
      .eq('room_id', roomId),
  ]);

  const extras: Song[] = [];
  const extraRows = (extrasRes.data ?? []) as unknown as Array<{
    position: number;
    suggestion_id: string;
    track_suggestions: {
      id: string;
      status: string;
      external_track_id: string;
      title: string;
      artist: string;
      thumbnail_url: string | null;
      duration_sec: number | null;
    } | null;
  }>;
  for (const row of extraRows) {
    const s = row.track_suggestions;
    if (!s || s.status !== 'approved') continue;
    extras.push({
      id: `extra-${s.id}`,
      title: s.title,
      artist: s.artist,
      albumName: '',
      coverUrl: s.thumbnail_url ?? '',
      color: '#B8860B',
      duration: s.duration_sec ?? 0,
      lyrics: '',
      videoId: s.external_track_id,
      thumbnailUrl: s.thumbnail_url ?? undefined,
      isSuggested: true,
    });
  }

  const reactions: RoomReactionsMap = {};
  const reactionRows = (reactionsRes.data ?? []) as unknown as Array<{
    track_ref: string;
    emoji: string;
  }>;
  const counts = new Map<string, number>();
  for (const row of reactionRows) {
    const key = `${row.track_ref}::${row.emoji}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  for (const [key, count] of counts) {
    const [trackRef, emoji] = key.split('::');
    (reactions[trackRef] ??= []).push({ emoji, count });
  }

  return { extras, reactions };
}

async function loadRoomAndPlaylist(
  params: RoomPageParams,
): Promise<
  | {
      ok: true;
      roomId: string;
      ownerUserId: string;
      title: string;
      ownerHandle: string;
      playlist: Playlist;
      playbackProvider: PlaybackProvider;
      presetKey: string | null;
      generatedPreset: GeneratedPreset | null;
      reactions: RoomReactionsMap;
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
      'id, user_id, slug, title, source_provider, source_playlist_id, visibility, preset_key, generated_preset',
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

  // Provider branching: rooms keep their original provider. We never fall back
  // across providers — a Spotify room with a revoked token is "unavailable",
  // not "try the YouTube API key". This preserves owner-facing reconnect UX.
  if (room.source_provider === 'spotify') {
    try {
      const [playlist, extrasAndReactions] = await Promise.all([
        fetchSpotifyPlaylist(room.user_id, room.source_playlist_id),
        loadExtrasAndReactions(room.id),
      ]);
      return {
        ok: true,
        roomId: room.id,
        ownerUserId: room.user_id,
        title: room.title,
        ownerHandle: owner.handle!,
        playlist: {
          ...playlist,
          songs: [...playlist.songs, ...extrasAndReactions.extras],
        },
        playbackProvider: 'spotify',
        presetKey: room.preset_key ?? null,
        generatedPreset: (room.generated_preset as GeneratedPreset | null) ?? null,
        reactions: extrasAndReactions.reactions,
      };
    } catch (err) {
      if (err instanceof SpotifyUnavailableError) {
        return { ok: false, reason: 'unavailable' };
      }
      console.error('[room] spotify playlist fetch failed:', err);
      return { ok: false, reason: 'unavailable' };
    }
  }

  // YouTube branch — prefer owner OAuth, fall back to server API key for
  // public playlists.
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
    const [playlist, extrasAndReactions] = await Promise.all([
      fetchYouTubePlaylist(room.source_playlist_id, authMethod),
      loadExtrasAndReactions(room.id),
    ]);
    return {
      ok: true,
      roomId: room.id,
      ownerUserId: room.user_id,
      title: room.title,
      ownerHandle: owner.handle!,
      playlist: {
        ...playlist,
        songs: [...playlist.songs, ...extrasAndReactions.extras],
      },
      playbackProvider: 'youtube',
      presetKey: room.preset_key ?? null,
      generatedPreset: (room.generated_preset as GeneratedPreset | null) ?? null,
      reactions: extrasAndReactions.reactions,
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
  const [result, session] = await Promise.all([
    loadRoomAndPlaylist(p),
    auth(),
  ]);
  const viewerUserId = session?.userId ?? null;

  // @MX:SPEC: SPEC-SOCIAL-001 — determine Spotify connection presence server-side
  // so the SuggestTrackButton can show the right gate label. Presence only, no token.
  let isSpotifyConnected = false;
  if (viewerUserId) {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from('music_connections')
      .select('user_id')
      .eq('user_id', viewerUserId)
      .eq('provider', 'spotify')
      .maybeSingle();
    isSpotifyConnected = Boolean(data);
  }

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

  const isOwner = Boolean(viewerUserId && viewerUserId === result.ownerUserId);

  return (
    <RoomCarousel
      playlist={result.playlist}
      ownerHandle={result.ownerHandle}
      roomTitle={result.title}
      playbackProvider={result.playbackProvider}
      presetKey={result.presetKey}
      generatedPreset={result.generatedPreset}
      roomId={result.roomId}
      reactions={result.reactions}
      viewerUserId={viewerUserId}
      isOwner={isOwner}
      isLoggedIn={Boolean(viewerUserId)}
      isSpotifyConnected={isSpotifyConnected}
    />
  );
}
