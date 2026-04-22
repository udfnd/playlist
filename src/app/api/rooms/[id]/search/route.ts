// @MX:SPEC: SPEC-SOCIAL-001
// GET /api/rooms/[id]/search?q=…&limit=… — provider-scoped track search.
//
// REQ-SOC-005: route delegates to `searchSpotifyTracks` for Spotify rooms
// (using the caller's own Spotify connection — they need to be connected
// themselves to search Spotify) or `searchYouTubeTracks` for YouTube rooms
// (preferring the room owner's stored OAuth, falling back to YOUTUBE_API_KEY).

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { searchSpotifyTracks } from '@/lib/search/spotify-search';
import { searchYouTubeTracks, type YtAuth } from '@/lib/search/youtube-search';
import { SpotifyUnavailableError } from '@/lib/spotify/client';

interface Context {
  params: Promise<{ id: string }>;
}

const HARD_LIMIT = 20;

async function loadRoom(
  roomId: string,
): Promise<{ source_provider: 'youtube' | 'spotify'; user_id: string } | null> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('rooms')
    .select('user_id, source_provider')
    .eq('id', roomId)
    .maybeSingle();
  return (data as
    | { source_provider: 'youtube' | 'spotify'; user_id: string }
    | null) ?? null;
}

async function resolveYouTubeAuth(ownerUserId: string): Promise<YtAuth | null> {
  const supabase = getSupabaseAdmin();
  try {
    const { data } = await supabase
      .from('music_connections')
      .select('access_token')
      .eq('user_id', ownerUserId)
      .eq('provider', 'google')
      .maybeSingle();
    if (data && (data as { access_token?: string }).access_token) {
      return {
        kind: 'oauth',
        accessToken: (data as { access_token: string }).access_token,
      };
    }
  } catch {
    // fall through to API key
  }
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (apiKey) return { kind: 'apiKey', key: apiKey };
  return null;
}

async function callerHasSpotifyConnection(userId: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('music_connections')
    .select('user_id')
    .eq('user_id', userId)
    .eq('provider', 'spotify')
    .maybeSingle();
  return Boolean(data);
}

export async function GET(request: Request, ctx: Context): Promise<Response> {
  const { id: roomId } = await ctx.params;
  const session = await auth();
  if (!session?.userId) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const url = new URL(request.url);
  const q = url.searchParams.get('q')?.trim() ?? '';
  if (!q) {
    return NextResponse.json(
      { error: '검색어가 필요합니다.' },
      { status: 400 },
    );
  }
  const limitRaw = Number(url.searchParams.get('limit') ?? '20');
  const limit = Math.max(
    1,
    Math.min(HARD_LIMIT, Number.isFinite(limitRaw) ? limitRaw : HARD_LIMIT),
  );

  const room = await loadRoom(roomId);
  if (!room) {
    return NextResponse.json({ error: '방을 찾을 수 없습니다.' }, { status: 404 });
  }

  if (room.source_provider === 'spotify') {
    const connected = await callerHasSpotifyConnection(session.userId);
    if (!connected) {
      return NextResponse.json(
        { error: 'spotify_connection_required' },
        { status: 401 },
      );
    }
    try {
      const results = await searchSpotifyTracks(session.userId, q, limit);
      return NextResponse.json({ results });
    } catch (err) {
      if (err instanceof SpotifyUnavailableError) {
        return NextResponse.json(
          { error: 'spotify_unavailable' },
          { status: 503 },
        );
      }
      console.error('[search] spotify failed:', err);
      return NextResponse.json({ error: 'search_failed' }, { status: 500 });
    }
  }

  // YouTube branch
  const ytAuth = await resolveYouTubeAuth(room.user_id);
  if (!ytAuth) {
    return NextResponse.json({ error: 'youtube_unavailable' }, { status: 500 });
  }
  try {
    const results = await searchYouTubeTracks(ytAuth, q, limit);
    return NextResponse.json({ results });
  } catch (err) {
    console.error('[search] youtube failed:', err);
    return NextResponse.json({ error: 'search_failed' }, { status: 500 });
  }
}
