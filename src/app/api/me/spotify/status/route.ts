// @MX:SPEC: SPEC-SPOTIFY-001
// GET /api/me/spotify/status — lightweight boolean probe the wizard uses
// to decide between rendering the "Connect Spotify" CTA and fetching
// /api/me/spotify/playlists. Returns { connected: boolean }. Does NOT
// expose tokens or expiry details to the client.

import { auth } from '@/auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export async function GET(): Promise<Response> {
  const session = await auth();
  if (!session?.userId) {
    return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('music_connections')
    .select('user_id')
    .eq('user_id', session.userId)
    .eq('provider', 'spotify')
    .maybeSingle();

  return Response.json({ connected: Boolean(data) });
}
