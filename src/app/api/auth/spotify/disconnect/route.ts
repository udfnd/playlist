// @MX:SPEC: SPEC-SPOTIFY-001
// POST /api/auth/spotify/disconnect — deletes the user's Spotify
// music_connections row. Idempotent: calling on a non-existent row is a
// no-op that still returns { ok: true }. The existing refresh token is
// irrecoverable after this call; reconnecting goes through the normal
// OAuth flow and issues a fresh one.

import { auth } from '@/auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export async function POST(): Promise<Response> {
  const session = await auth();
  if (!session?.userId) {
    return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  await supabase
    .from('music_connections')
    .delete()
    .eq('user_id', session.userId)
    .eq('provider', 'spotify');

  return Response.json({ ok: true });
}
