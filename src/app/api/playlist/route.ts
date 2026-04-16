import { extractPlaylistId, parseISODuration, generateColorFromId } from '@/lib/youtube';
import { auth } from '@/auth';
import type { Song, Playlist } from '@/data/types';

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

type AuthMethod =
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
  resourceId: {
    videoId: string;
  };
}

interface YouTubePlaylistItem {
  snippet: YouTubePlaylistItemSnippet;
  status?: {
    privacyStatus: string;
  };
}

interface YouTubePlaylistItemsResponse {
  items: YouTubePlaylistItem[];
  nextPageToken?: string;
  pageInfo: {
    totalResults: number;
  };
}

interface YouTubeVideoContentDetails {
  duration: string;
}

interface YouTubeVideo {
  id: string;
  contentDetails: YouTubeVideoContentDetails;
}

interface YouTubeVideosResponse {
  items: YouTubeVideo[];
}

interface YouTubePlaylistSnippet {
  title: string;
  description: string;
}

interface YouTubePlaylistResponse {
  items: Array<{
    id: string;
    snippet: YouTubePlaylistSnippet;
  }>;
}

/**
 * Fetches all playlist items across multiple pages.
 */
async function fetchAllPlaylistItems(
  playlistId: string,
  authMethod: AuthMethod,
): Promise<YouTubePlaylistItem[]> {
  const allItems: YouTubePlaylistItem[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      part: 'snippet,status',
      playlistId,
      maxResults: '50',
    });
    appendAuth(params, authMethod);
    if (pageToken) {
      params.set('pageToken', pageToken);
    }

    const res = await fetch(`${YOUTUBE_API_BASE}/playlistItems?${params}`, {
      headers: buildHeaders(authMethod),
    });
    if (!res.ok) {
      const errorBody = await res.text();
      throw new Error(`YouTube playlistItems API error (${res.status}): ${errorBody}`);
    }

    const data: YouTubePlaylistItemsResponse = await res.json();
    allItems.push(...data.items);
    pageToken = data.nextPageToken;
  } while (pageToken);

  return allItems;
}

/**
 * Fetches video details (duration) for a batch of video IDs.
 * YouTube allows max 50 IDs per request.
 */
async function fetchVideoDurations(
  videoIds: string[],
  authMethod: AuthMethod,
): Promise<Map<string, number>> {
  const durationMap = new Map<string, number>();

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
      const errorBody = await res.text();
      throw new Error(`YouTube videos API error (${res.status}): ${errorBody}`);
    }

    const data: YouTubeVideosResponse = await res.json();
    for (const video of data.items) {
      durationMap.set(video.id, parseISODuration(video.contentDetails.duration));
    }
  }

  return durationMap;
}

/**
 * Fetches playlist metadata (title, description).
 */
async function fetchPlaylistMetadata(
  playlistId: string,
  authMethod: AuthMethod,
): Promise<{ title: string; description: string }> {
  const params = new URLSearchParams({
    part: 'snippet',
    id: playlistId,
  });
  appendAuth(params, authMethod);

  const res = await fetch(`${YOUTUBE_API_BASE}/playlists?${params}`, {
    headers: buildHeaders(authMethod),
  });
  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`YouTube playlists API error (${res.status}): ${errorBody}`);
  }

  const data: YouTubePlaylistResponse = await res.json();
  if (!data.items || data.items.length === 0) {
    throw new Error('Playlist not found');
  }

  const snippet = data.items[0].snippet;
  return {
    title: snippet.title,
    description: snippet.description,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const listParam = searchParams.get('list');

  if (!listParam) {
    return Response.json(
      { error: 'Missing required query parameter: list' },
      { status: 400 },
    );
  }

  const playlistId = extractPlaylistId(listParam);
  if (!playlistId) {
    return Response.json(
      { error: 'Invalid playlist ID or URL' },
      { status: 400 },
    );
  }

  // Determine auth method: prefer OAuth if session exists, fall back to API key
  const session = await auth();
  let authMethod: AuthMethod;

  if (session?.accessToken) {
    authMethod = { type: 'oauth', accessToken: session.accessToken };
  } else {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      return Response.json(
        { error: 'YouTube API key is not configured' },
        { status: 500 },
      );
    }
    authMethod = { type: 'apiKey', key: apiKey };
  }

  try {
    // Fetch playlist metadata and items in parallel
    const [metadata, playlistItems] = await Promise.all([
      fetchPlaylistMetadata(playlistId, authMethod),
      fetchAllPlaylistItems(playlistId, authMethod),
    ]);

    // Filter out private/deleted videos and collect video IDs
    const validItems = playlistItems.filter(
      (item) =>
        item.status?.privacyStatus !== 'private' &&
        item.status?.privacyStatus !== 'privacyStatusUnspecified' &&
        item.snippet.title !== 'Private video' &&
        item.snippet.title !== 'Deleted video',
    );

    const videoIds = validItems.map((item) => item.snippet.resourceId.videoId);

    // Fetch durations for all valid videos
    const durationMap = await fetchVideoDurations(videoIds, authMethod);

    // Map to Song type
    const songs: Song[] = validItems.map((item) => {
      const videoId = item.snippet.resourceId.videoId;
      const thumbnails = item.snippet.thumbnails;
      const thumbnailUrl =
        thumbnails.maxres?.url ||
        thumbnails.high?.url ||
        thumbnails.medium?.url ||
        thumbnails.default?.url ||
        '';

      return {
        id: videoId,
        title: item.snippet.title,
        artist: (item.snippet.videoOwnerChannelTitle || item.snippet.channelTitle || '').replace(/ - Topic$/, ''),
        albumName: metadata.title,
        coverUrl: '',
        color: generateColorFromId(videoId),
        duration: durationMap.get(videoId) ?? 0,
        lyrics: '',
        videoId,
        thumbnailUrl,
      };
    });

    const playlist: Playlist = {
      id: playlistId,
      name: metadata.title,
      description: metadata.description,
      songs,
    };

    return Response.json(playlist);
  } catch (error) {
    console.error('Failed to fetch YouTube playlist:', error);

    const message =
      error instanceof Error ? error.message : 'Unknown error occurred';

    return Response.json({ error: message }, { status: 500 });
  }
}
