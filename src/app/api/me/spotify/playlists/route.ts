// @MX:SPEC: SPEC-SPOTIFY-001
// GET /api/me/spotify/playlists — returns the signed-in user's Spotify
// playlists in the shared wizard shape (`{ id, title, thumbnailUrl,
// itemCount, privacy }`), mirroring `/api/my-playlists` for YouTube so the
// wizard can swap data sources without branching the UI contract.

import { auth } from '@/auth';
import { spotifyFetch, SpotifyUnavailableError } from '@/lib/spotify/client';

interface SpotifyPlaylistItem {
  id: string;
  name: string;
  public: boolean | null;
  collaborative: boolean;
  images: Array<{ url: string }>;
  tracks: { total: number };
}

interface SpotifyMePlaylistsPage {
  items: SpotifyPlaylistItem[];
  next: string | null;
}

type Privacy = 'public' | 'private' | 'collaborative';

function classify(item: SpotifyPlaylistItem): Privacy {
  if (item.public) return 'public';
  if (item.collaborative) return 'collaborative';
  return 'private';
}

export async function GET(): Promise<Response> {
  const session = await auth();
  if (!session?.userId) {
    return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  try {
    const all: SpotifyPlaylistItem[] = [];
    let nextPath: string | null = '/me/playlists?limit=50';
    while (nextPath) {
      const res = await spotifyFetch(session.userId, nextPath);
      if (!res.ok) {
        throw new Error(`Spotify /me/playlists error (${res.status})`);
      }
      const page = (await res.json()) as SpotifyMePlaylistsPage;
      all.push(...(page.items ?? []));
      nextPath = page.next ?? null;
    }

    const playlists = all.map((item) => ({
      id: item.id,
      title: item.name,
      thumbnailUrl: item.images?.[0]?.url ?? '',
      itemCount: item.tracks?.total ?? 0,
      privacy: classify(item),
    }));

    return Response.json({ playlists });
  } catch (err) {
    if (err instanceof SpotifyUnavailableError) {
      return Response.json(
        { error: 'Spotify 연결이 만료되었습니다. 다시 연결해 주세요.' },
        { status: 401 },
      );
    }
    console.error('Failed to fetch Spotify playlists:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ error: message }, { status: 500 });
  }
}
