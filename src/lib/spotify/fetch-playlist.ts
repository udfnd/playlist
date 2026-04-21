// @MX:SPEC: SPEC-SPOTIFY-001
// Spotify playlist fetch + normalization to the shared `Playlist` shape
// (src/data/types.ts). Mirrors the structure of
// `src/lib/youtube/fetch-playlist.ts` so the UI/API layers can treat the
// two providers uniformly.
//
// Server-only: relies on `spotifyFetch` which holds user tokens. The
// Spotify track id is reused in the existing `videoId` field to avoid
// branching the shared `Song` type (see SPEC §Constraints); the embed URL
// at `https://open.spotify.com/embed/track/{videoId}` resolves correctly.

import { spotifyFetch, SpotifyUnavailableError } from '@/lib/spotify/client';
import { extractSpotifyPlaylistId } from '@/lib/spotify/oauth';
import { generateColorFromId } from '@/lib/youtube';
import type { Playlist, Song } from '@/data/types';

interface SpotifyImage {
  url: string;
}

interface SpotifyArtist {
  name: string;
}

interface SpotifyTrack {
  id: string;
  name: string;
  duration_ms: number;
  artists: SpotifyArtist[];
  album: { images: SpotifyImage[] };
  is_local?: boolean;
}

interface SpotifyPlaylistItem {
  track: SpotifyTrack | null;
}

interface SpotifyPlaylistPage {
  items: SpotifyPlaylistItem[];
  next: string | null;
}

interface SpotifyPlaylistMeta {
  id: string;
  name: string;
  description: string | null;
  images: SpotifyImage[];
}

/**
 * Fetch a Spotify playlist and normalize it into the shared `Playlist`
 * type. Follows `next` pagination across all pages. Throws
 * `SpotifyUnavailableError` when Spotify returns 403/404 so upstream can
 * render the YouTube-parity "unavailable" UX.
 */
// @MX:ANCHOR: called from wizard playlist preview, `/api/spotify/playlist`,
// and the server-rendered room page — fan_in anticipated = 3.
// @MX:REASON: provider boundary used by multiple call sites; signature
// changes ripple across the UI/API layer.
export async function fetchSpotifyPlaylist(
  userId: string,
  idOrUrl: string,
): Promise<Playlist> {
  const playlistId = extractSpotifyPlaylistId(idOrUrl);
  if (!playlistId) {
    throw new Error('Invalid Spotify playlist ID or URL');
  }

  // Metadata and the first tracks page are independent Spotify calls.
  // Mirror `src/lib/youtube/fetch-playlist.ts` and fan out; subsequent
  // tracks pages must still be sequential because each `next` URL is only
  // known after the previous page resolves.
  const [meta, items] = await Promise.all([
    fetchMetadata(userId, playlistId),
    fetchAllTracks(userId, playlistId),
  ]);

  const songs: Song[] = items
    .map((item) => item.track)
    .filter((t): t is SpotifyTrack => t !== null && !t.is_local && typeof t.id === 'string')
    .map((t) => mapTrack(t, meta.name));

  return {
    id: meta.id,
    name: meta.name,
    description: meta.description ?? '',
    songs,
  };
}

async function fetchMetadata(userId: string, playlistId: string): Promise<SpotifyPlaylistMeta> {
  const res = await spotifyFetch(
    userId,
    `/playlists/${encodeURIComponent(playlistId)}?fields=id,name,description,images`,
  );
  if (res.status === 403 || res.status === 404) {
    throw new SpotifyUnavailableError(
      'playlist_unavailable',
      `Spotify playlist unavailable (status ${res.status})`,
    );
  }
  if (!res.ok) {
    throw new Error(`Spotify playlist metadata error (${res.status})`);
  }
  return (await res.json()) as SpotifyPlaylistMeta;
}

async function fetchAllTracks(
  userId: string,
  playlistId: string,
): Promise<SpotifyPlaylistItem[]> {
  const items: SpotifyPlaylistItem[] = [];
  let nextPath: string | null =
    `/playlists/${encodeURIComponent(playlistId)}/tracks?fields=items(track(id,name,duration_ms,is_local,artists(name),album(images))),next&limit=100`;
  while (nextPath) {
    const res = await spotifyFetch(userId, nextPath);
    if (res.status === 403 || res.status === 404) {
      throw new SpotifyUnavailableError(
        'playlist_unavailable',
        `Spotify playlist tracks unavailable (status ${res.status})`,
      );
    }
    if (!res.ok) {
      throw new Error(`Spotify playlist tracks error (${res.status})`);
    }
    const page = (await res.json()) as SpotifyPlaylistPage;
    items.push(...(page.items ?? []));
    nextPath = page.next ?? null;
  }
  return items;
}

function mapTrack(t: SpotifyTrack, albumName: string): Song {
  return {
    id: t.id,
    title: t.name,
    artist: t.artists.map((a) => a.name).join(', '),
    albumName,
    coverUrl: '',
    color: generateColorFromId(t.id),
    duration: Math.round((t.duration_ms ?? 0) / 1000),
    lyrics: '',
    videoId: t.id,
    thumbnailUrl: t.album?.images?.[0]?.url ?? '',
  };
}
