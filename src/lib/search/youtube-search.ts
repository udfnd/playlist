// @MX:SPEC: SPEC-SOCIAL-001
// YouTube provider search adapter. Mirrors the auth-method pattern in
// src/lib/youtube/fetch-playlist.ts (OAuth Bearer header OR ?key= query),
// then performs a /search → /videos round-trip to backfill durations
// because the /search endpoint only returns snippet metadata.
//
// @MX:NOTE: /videos backfill is intentional — YouTube Data API v3 /search
// does not include contentDetails.duration. This costs an extra API call
// per request; for production scale, cache (videoId → duration) for ~24h.

import { parseISODuration } from '@/lib/youtube';
import type { SearchResult } from './spotify-search';

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';
const HARD_LIMIT = 20;

export type YtAuth =
  | { kind: 'oauth'; accessToken: string }
  | { kind: 'apiKey'; key: string };

interface YtSearchSnippet {
  title: string;
  channelTitle: string;
  thumbnails: {
    default?: { url: string };
    medium?: { url: string };
    high?: { url: string };
  };
}

interface YtSearchItem {
  id: { videoId: string };
  snippet: YtSearchSnippet;
}

interface YtSearchResponse {
  items: YtSearchItem[];
}

interface YtVideosResponse {
  items: Array<{ id: string; contentDetails: { duration: string } }>;
}

function buildHeaders(auth: YtAuth): HeadersInit {
  if (auth.kind === 'oauth') {
    return { Authorization: `Bearer ${auth.accessToken}` };
  }
  return {};
}

function appendAuth(params: URLSearchParams, auth: YtAuth): void {
  if (auth.kind === 'apiKey') params.set('key', auth.key);
}

export async function searchYouTubeTracks(
  auth: YtAuth,
  query: string,
  limit: number,
): Promise<SearchResult[]> {
  const safeLimit = Math.max(1, Math.min(HARD_LIMIT, Math.floor(limit)));

  const searchParams = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    q: query,
    maxResults: String(safeLimit),
  });
  appendAuth(searchParams, auth);

  const searchRes = await fetch(`${YOUTUBE_API_BASE}/search?${searchParams}`, {
    headers: buildHeaders(auth),
  });
  if (!searchRes.ok) {
    throw new Error(
      `YouTube search API error (${searchRes.status}): ${await searchRes.text()}`,
    );
  }
  const searchData = (await searchRes.json()) as YtSearchResponse;
  const items = searchData.items ?? [];
  if (items.length === 0) return [];

  const ids = items.map((i) => i.id.videoId);
  const videosParams = new URLSearchParams({
    part: 'contentDetails,snippet',
    id: ids.join(','),
  });
  appendAuth(videosParams, auth);
  const videosRes = await fetch(`${YOUTUBE_API_BASE}/videos?${videosParams}`, {
    headers: buildHeaders(auth),
  });
  if (!videosRes.ok) {
    throw new Error(
      `YouTube videos API error (${videosRes.status}): ${await videosRes.text()}`,
    );
  }
  const videosData = (await videosRes.json()) as YtVideosResponse;
  const durations = new Map<string, number>();
  for (const v of videosData.items ?? []) {
    durations.set(v.id, parseISODuration(v.contentDetails.duration));
  }

  return items.map((it) => normalizeItem(it, durations));
}

function normalizeItem(
  item: YtSearchItem,
  durations: Map<string, number>,
): SearchResult {
  const vid = item.id.videoId;
  const t = item.snippet.thumbnails;
  const thumb = t.medium?.url ?? t.default?.url ?? t.high?.url ?? null;
  const artist = (item.snippet.channelTitle || '').replace(/ - Topic$/, '');
  const dur = durations.get(vid);
  return {
    externalTrackId: vid,
    title: item.snippet.title,
    artist,
    thumbnailUrl: thumb,
    durationSec: typeof dur === 'number' ? dur : null,
  };
}
