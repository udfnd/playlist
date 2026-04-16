import { auth } from '@/auth';

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

interface PlaylistItem {
  id: string;
  snippet: {
    title: string;
    description: string;
    thumbnails: {
      default?: { url: string };
      medium?: { url: string };
      high?: { url: string };
    };
  };
  contentDetails: {
    itemCount: number;
  };
  status: {
    privacyStatus: string;
  };
}

interface PlaylistsResponse {
  items: PlaylistItem[];
  nextPageToken?: string;
}

export async function GET() {
  const session = await auth();

  if (!session?.accessToken) {
    return Response.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const allPlaylists: PlaylistItem[] = [];
    let pageToken: string | undefined;

    do {
      const params = new URLSearchParams({
        part: 'snippet,contentDetails,status',
        mine: 'true',
        maxResults: '50',
      });
      if (pageToken) {
        params.set('pageToken', pageToken);
      }

      const res = await fetch(`${YOUTUBE_API_BASE}/playlists?${params}`, {
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
        },
      });

      if (!res.ok) {
        const errorBody = await res.text();
        throw new Error(`YouTube API error (${res.status}): ${errorBody}`);
      }

      const data: PlaylistsResponse = await res.json();
      allPlaylists.push(...data.items);
      pageToken = data.nextPageToken;
    } while (pageToken);

    const playlists = allPlaylists.map((item) => ({
      id: item.id,
      title: item.snippet.title,
      description: item.snippet.description,
      thumbnailUrl:
        item.snippet.thumbnails.high?.url ||
        item.snippet.thumbnails.medium?.url ||
        item.snippet.thumbnails.default?.url ||
        '',
      itemCount: item.contentDetails.itemCount,
      privacyStatus: item.status.privacyStatus,
    }));

    return Response.json({ playlists });
  } catch (error) {
    console.error('Failed to fetch user playlists:', error);
    const message =
      error instanceof Error ? error.message : 'Unknown error';
    return Response.json({ error: message }, { status: 500 });
  }
}
