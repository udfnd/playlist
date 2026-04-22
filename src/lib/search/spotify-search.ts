// @MX:SPEC: SPEC-SOCIAL-001
// Spotify provider search adapter. Wraps `spotifyFetch` and normalizes the
// /v1/search?type=track response to the common SearchResult shape used by
// the suggestion UI.
//
// We deliberately do NOT swallow SpotifyUnavailableError; the route handler
// maps it to the existing `unavailable` UX so the owner sees a reconnect
// prompt instead of an empty list.

import { spotifyFetch } from '@/lib/spotify/client';

export interface SearchResult {
  externalTrackId: string;
  title: string;
  artist: string;
  thumbnailUrl: string | null;
  durationSec: number | null;
}

interface SpotifyTrack {
  id: string;
  name: string;
  artists?: Array<{ name?: string }>;
  album?: { images?: Array<{ url?: string }> };
  duration_ms?: number;
}

interface SpotifySearchResponse {
  tracks?: { items?: SpotifyTrack[] };
}

const HARD_LIMIT = 20;

export async function searchSpotifyTracks(
  userId: string,
  query: string,
  limit: number,
): Promise<SearchResult[]> {
  const safeLimit = Math.max(1, Math.min(HARD_LIMIT, Math.floor(limit)));
  const path = `/search?type=track&q=${encodeURIComponent(query)}&limit=${safeLimit}`;
  const res = await spotifyFetch(userId, path);
  if (!res.ok) {
    throw new Error(`Spotify search failed (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as SpotifySearchResponse;
  const items = data.tracks?.items ?? [];
  return items.map(normalizeTrack);
}

function normalizeTrack(t: SpotifyTrack): SearchResult {
  const artist =
    (t.artists ?? [])
      .map((a) => a.name)
      .filter((s): s is string => Boolean(s))
      .join(', ') || '';
  const thumb = t.album?.images?.[0]?.url ?? null;
  const durationSec =
    typeof t.duration_ms === 'number' ? Math.round(t.duration_ms / 1000) : null;
  return {
    externalTrackId: t.id,
    title: t.name,
    artist,
    thumbnailUrl: thumb,
    durationSec,
  };
}
