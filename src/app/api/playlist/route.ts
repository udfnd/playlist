import { auth } from '@/auth';
import { fetchYouTubePlaylist, type AuthMethod } from '@/lib/youtube/fetch-playlist';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const listParam = searchParams.get('list');

  if (!listParam) {
    return Response.json(
      { error: 'Missing required query parameter: list' },
      { status: 400 },
    );
  }

  // Determine auth method: prefer OAuth if session exists, fall back to API key.
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
    const playlist = await fetchYouTubePlaylist(listParam, authMethod);
    return Response.json(playlist);
  } catch (error) {
    console.error('Failed to fetch YouTube playlist:', error);
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    return Response.json({ error: message }, { status: 500 });
  }
}
