// @MX:SPEC: SPEC-SPOTIFY-001
// GET /api/spotify/playlist?list=… — returns a normalized `Playlist` for
// a Spotify playlist. Accepts either a raw 22-char id or an
// `open.spotify.com/playlist/…` URL. Requires an authenticated session
// because token lookup is keyed by `session.userId` (tokens never reach
// the client bundle).

import { auth } from '@/auth';
import { extractSpotifyPlaylistId } from '@/lib/spotify/oauth';
import { fetchSpotifyPlaylist } from '@/lib/spotify/fetch-playlist';
import { SpotifyUnavailableError } from '@/lib/spotify/client';

export async function GET(request: Request): Promise<Response> {
  const session = await auth();
  if (!session?.userId) {
    return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const list = searchParams.get('list');
  if (!list) {
    return Response.json({ error: 'Missing required query parameter: list' }, { status: 400 });
  }

  const playlistId = extractSpotifyPlaylistId(list);
  if (!playlistId) {
    return Response.json(
      { error: '올바른 Spotify 플레이리스트 링크가 아닙니다.' },
      { status: 400 },
    );
  }

  try {
    const playlist = await fetchSpotifyPlaylist(session.userId, playlistId);
    return Response.json(playlist);
  } catch (err) {
    if (err instanceof SpotifyUnavailableError) {
      return Response.json(
        { error: '플레이리스트를 불러올 수 없습니다.' },
        { status: 404 },
      );
    }
    console.error('Failed to fetch Spotify playlist:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ error: message }, { status: 500 });
  }
}
