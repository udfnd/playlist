import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { generateSlugCandidate, pickAvailableSlug } from '@/lib/slug';

export async function GET() {
  const session = await auth();
  if (!session?.userId) {
    return NextResponse.json(
      { error: 'Not authenticated, or Supabase is not configured.' },
      { status: 401 },
    );
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('rooms')
    .select(
      'id, slug, title, preset_key, visibility, source_provider, source_playlist_id, created_at',
    )
    .eq('user_id', session.userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[rooms] list failed:', error);
    return NextResponse.json({ error: 'Failed to load rooms.' }, { status: 500 });
  }

  return NextResponse.json({ rooms: data ?? [] });
}

interface CreateRoomBody {
  title?: string;
  sourceProvider?: 'youtube' | 'spotify';
  sourcePlaylistId?: string;
  presetKey?: string;
  visibility?: 'public' | 'unlisted' | 'private';
}

const ALLOWED_PRESETS = new Set(['late-night']); // expands with A-track work
const ALLOWED_VISIBILITY = new Set(['public', 'unlisted', 'private']);

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.userId) {
    return NextResponse.json(
      { error: 'Not authenticated, or Supabase is not configured.' },
      { status: 401 },
    );
  }
  if (!session.handle) {
    return NextResponse.json(
      { error: 'Pick a handle before creating a room.' },
      { status: 409 },
    );
  }

  let body: CreateRoomBody;
  try {
    body = (await request.json()) as CreateRoomBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const title = body.title?.trim();
  if (!title || title.length > 120) {
    return NextResponse.json(
      { error: 'Title is required and must be 120 characters or fewer.' },
      { status: 400 },
    );
  }

  const sourceProvider = body.sourceProvider;
  if (sourceProvider !== 'youtube' && sourceProvider !== 'spotify') {
    return NextResponse.json(
      { error: 'sourceProvider must be "youtube" or "spotify".' },
      { status: 400 },
    );
  }

  const sourcePlaylistId = body.sourcePlaylistId?.trim();
  if (!sourcePlaylistId) {
    return NextResponse.json(
      { error: 'sourcePlaylistId is required.' },
      { status: 400 },
    );
  }

  const presetKey = body.presetKey ?? 'late-night';
  if (!ALLOWED_PRESETS.has(presetKey)) {
    return NextResponse.json(
      { error: `presetKey "${presetKey}" is not available yet.` },
      { status: 400 },
    );
  }

  const visibility = body.visibility ?? 'public';
  if (!ALLOWED_VISIBILITY.has(visibility)) {
    return NextResponse.json(
      { error: 'visibility must be one of public, unlisted, private.' },
      { status: 400 },
    );
  }

  const supabase = getSupabaseAdmin();

  // Pick a unique slug within this user's namespace. Read all existing slugs that
  // share the same base prefix once, then compute a non-colliding candidate in memory.
  const base = generateSlugCandidate(title);
  const { data: existingRows, error: existingErr } = await supabase
    .from('rooms')
    .select('slug')
    .eq('user_id', session.userId)
    .like('slug', `${base}%`);
  if (existingErr) {
    console.error('[rooms] slug scan failed:', existingErr);
    return NextResponse.json(
      { error: 'Could not generate a unique slug.' },
      { status: 500 },
    );
  }
  const slug = pickAvailableSlug(
    base,
    (existingRows ?? []).map((r) => r.slug),
  );

  const { data: room, error: insertErr } = await supabase
    .from('rooms')
    .insert({
      user_id: session.userId,
      slug,
      title,
      preset_key: presetKey,
      source_provider: sourceProvider,
      source_playlist_id: sourcePlaylistId,
      visibility,
    })
    .select('id, slug, title, preset_key, visibility, created_at')
    .single();

  if (insertErr || !room) {
    // 23505 = unique_violation (race with another concurrent insert)
    const code = (insertErr as { code?: string } | null)?.code;
    if (code === '23505') {
      return NextResponse.json(
        { error: 'A room with this slug was just created — try again.' },
        { status: 409 },
      );
    }
    console.error('[rooms] insert failed:', insertErr);
    return NextResponse.json(
      { error: 'Failed to create room.' },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    room,
    url: `/@${session.handle}/${room.slug}`,
  });
}
