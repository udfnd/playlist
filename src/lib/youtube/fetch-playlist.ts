// Shared YouTube playlist fetch logic — used by both the /api/playlist handler (for the
// user-input flow) and the server-rendered room page at /@handle/slug.
//
// Extracted into a library function so a server component can call it directly without
// an extra internal HTTP hop.

import { extractPlaylistId, parseISODuration, generateColorFromId } from '@/lib/youtube';
import type { Song, Playlist } from '@/data/types';

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

export type AuthMethod =
  | { type: 'apiKey'; key: string }
  | { type: 'oauth'; accessToken: string };

function buildHeaders(authMethod: AuthMethod): HeadersInit {
  if (authMethod.type === 'oauth') {
    return { Authorization: `Bearer ${authMethod.accessToken}` };
  }
  return {};
}

function appendAuth(params: URLSearchParams, authMethod: AuthMethod) {
  if (authMethod.type === 'apiKey') {
    params.set('key', authMethod.key);
  }
}

interface YouTubePlaylistItemSnippet {
  title: string;
  channelTitle: string;
  videoOwnerChannelTitle?: string;
  thumbnails: {
    default?: { url: string };
    medium?: { url: string };
    high?: { url: string };
    maxres?: { url: string };
  };
  resourceId: { videoId: string };
}

interface YouTubePlaylistItem {
  snippet: YouTubePlaylistItemSnippet;
  status?: { privacyStatus: string };
}

interface YouTubePlaylistItemsResponse {
  items: YouTubePlaylistItem[];
  nextPageToken?: string;
}

interface YouTubeVideo {
  id: string;
  contentDetails: { duration: string };
}

interface YouTubeVideosResponse {
  items: YouTubeVideo[];
}

interface YouTubePlaylistResponse {
  items: Array<{
    id: string;
    snippet: { title: string; description: string };
  }>;
}

async function fetchAllPlaylistItems(
  playlistId: string,
  authMethod: AuthMethod,
): Promise<YouTubePlaylistItem[]> {
  const items: YouTubePlaylistItem[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({
      part: 'snippet,status',
      playlistId,
      maxResults: '50',
    });
    appendAuth(params, authMethod);
    if (pageToken) params.set('pageToken', pageToken);

    const res = await fetch(`${YOUTUBE_API_BASE}/playlistItems?${params}`, {
      headers: buildHeaders(authMethod),
    });
    if (!res.ok) {
      throw new Error(
        `YouTube playlistItems API error (${res.status}): ${await res.text()}`,
      );
    }
    const data: YouTubePlaylistItemsResponse = await res.json();
    items.push(...data.items);
    pageToken = data.nextPageToken;
  } while (pageToken);
  return items;
}

async function fetchVideoDurations(
  videoIds: string[],
  authMethod: AuthMethod,
): Promise<Map<string, number>> {
  const durations = new Map<string, number>();
  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);
    const params = new URLSearchParams({
      part: 'contentDetails',
      id: batch.join(','),
    });
    appendAuth(params, authMethod);
    const res = await fetch(`${YOUTUBE_API_BASE}/videos?${params}`, {
      headers: buildHeaders(authMethod),
    });
    if (!res.ok) {
      throw new Error(
        `YouTube videos API error (${res.status}): ${await res.text()}`,
      );
    }
    const data: YouTubeVideosResponse = await res.json();
    for (const v of data.items) {
      durations.set(v.id, parseISODuration(v.contentDetails.duration));
    }
  }
  return durations;
}

async function fetchPlaylistMetadata(
  playlistId: string,
  authMethod: AuthMethod,
): Promise<{ title: string; description: string }> {
  const params = new URLSearchParams({ part: 'snippet', id: playlistId });
  appendAuth(params, authMethod);
  const res = await fetch(`${YOUTUBE_API_BASE}/playlists?${params}`, {
    headers: buildHeaders(authMethod),
  });
  if (!res.ok) {
    throw new Error(
      `YouTube playlists API error (${res.status}): ${await res.text()}`,
    );
  }
  const data: YouTubePlaylistResponse = await res.json();
  const snippet = data.items[0]?.snippet;
  if (!snippet) throw new Error('Playlist not found');
  return { title: snippet.title, description: snippet.description };
}

/**
 * Fetch a YouTube playlist and map it to our Playlist shape, discarding private/deleted
 * entries. Accepts either a raw playlist ID or a full YouTube URL.
 */
export async function fetchYouTubePlaylist(
  listParam: string,
  authMethod: AuthMethod,
): Promise<Playlist> {
  const playlistId = extractPlaylistId(listParam);
  if (!playlistId) throw new Error('Invalid playlist ID or URL');

  const [metadata, items] = await Promise.all([
    fetchPlaylistMetadata(playlistId, authMethod),
    fetchAllPlaylistItems(playlistId, authMethod),
  ]);

  const validItems = items.filter(
    (item) =>
      item.status?.privacyStatus !== 'private' &&
      item.status?.privacyStatus !== 'privacyStatusUnspecified' &&
      item.snippet.title !== 'Private video' &&
      item.snippet.title !== 'Deleted video',
  );

  const videoIds = validItems.map((i) => i.snippet.resourceId.videoId);
  const durations = await fetchVideoDurations(videoIds, authMethod);

  const songs: Song[] = validItems.map((item) => {
    const vid = item.snippet.resourceId.videoId;
    const t = item.snippet.thumbnails;
    return {
      id: vid,
      title: item.snippet.title,
      artist: (item.snippet.videoOwnerChannelTitle || item.snippet.channelTitle || '').replace(
        / - Topic$/,
        '',
      ),
      albumName: metadata.title,
      coverUrl: '',
      color: generateColorFromId(vid),
      duration: durations.get(vid) ?? 0,
      lyrics: '',
      videoId: vid,
      thumbnailUrl: t.maxres?.url || t.high?.url || t.medium?.url || t.default?.url || '',
    };
  });

  return {
    id: playlistId,
    name: metadata.title,
    description: metadata.description,
    songs,
  };
}
