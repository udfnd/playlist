import { auth } from '@/auth';

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.accessToken) {
    return Response.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await request.json();
  const { playlistId } = body;

  if (!playlistId) {
    return Response.json(
      { error: 'Missing required field: playlistId' },
      { status: 400 },
    );
  }

  try {
    // First, fetch the current playlist to get its snippet (needed for update)
    const getParams = new URLSearchParams({
      part: 'snippet,status',
      id: playlistId,
    });

    const getRes = await fetch(`${YOUTUBE_API_BASE}/playlists?${getParams}`, {
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
      },
    });

    if (!getRes.ok) {
      const errorBody = await getRes.text();
      throw new Error(`Failed to fetch playlist (${getRes.status}): ${errorBody}`);
    }

    const getData = await getRes.json();
    if (!getData.items || getData.items.length === 0) {
      return Response.json({ error: 'Playlist not found' }, { status: 404 });
    }

    const playlist = getData.items[0];

    // Update playlist privacy to "unlisted"
    const updateRes = await fetch(
      `${YOUTUBE_API_BASE}/playlists?part=snippet,status`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: playlistId,
          snippet: {
            title: playlist.snippet.title,
            description: playlist.snippet.description,
          },
          status: {
            privacyStatus: 'unlisted',
          },
        }),
      },
    );

    if (!updateRes.ok) {
      const errorBody = await updateRes.text();
      throw new Error(`Failed to update playlist (${updateRes.status}): ${errorBody}`);
    }

    const updated = await updateRes.json();

    return Response.json({
      success: true,
      playlistId,
      privacyStatus: updated.status.privacyStatus,
      shareUrl: `${process.env.NEXTAUTH_URL || 'http://localhost:3001'}?list=${playlistId}`,
      youtubeUrl: `https://youtube.com/playlist?list=${playlistId}`,
    });
  } catch (error) {
    console.error('Failed to share playlist:', error);
    const message =
      error instanceof Error ? error.message : 'Unknown error';
    return Response.json({ error: message }, { status: 500 });
  }
}
