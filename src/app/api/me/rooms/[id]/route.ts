import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

const ALLOWED_VISIBILITY = new Set(['public', 'unlisted', 'private']);

interface Context {
  params: Promise<{ id: string }>;
}

async function requireOwner(id: string, userId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('rooms')
    .select('id, user_id')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { ok: false as const, status: 404, reason: 'Room not found.' };
  if (data.user_id !== userId) {
    return { ok: false as const, status: 404, reason: 'Room not found.' };
  }
  return { ok: true as const };
}

export async function PATCH(request: Request, { params }: Context) {
  const session = await auth();
  if (!session?.userId) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  const { id } = await params;
  const gate = await requireOwner(id, session.userId);
  if (!gate.ok) return NextResponse.json({ error: gate.reason }, { status: gate.status });

  let body: { visibility?: string; title?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const update: { visibility?: string; title?: string } = {};
  if (body.visibility !== undefined) {
    if (typeof body.visibility !== 'string' || !ALLOWED_VISIBILITY.has(body.visibility)) {
      return NextResponse.json(
        { error: 'visibility must be one of public, unlisted, private.' },
        { status: 400 },
      );
    }
    update.visibility = body.visibility;
  }
  if (body.title !== undefined) {
    const trimmed = typeof body.title === 'string' ? body.title.trim() : '';
    if (!trimmed || trimmed.length > 120) {
      return NextResponse.json(
        { error: 'title must be 1-120 characters.' },
        { status: 400 },
      );
    }
    update.title = trimmed;
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('rooms')
    .update(update)
    .eq('id', id)
    .select('id, slug, title, visibility')
    .single();

  if (error || !data) {
    console.error('[rooms] update failed:', error);
    return NextResponse.json({ error: 'Failed to update room.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, room: data });
}

export async function DELETE(_request: Request, { params }: Context) {
  const session = await auth();
  if (!session?.userId) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  const { id } = await params;
  const gate = await requireOwner(id, session.userId);
  if (!gate.ok) return NextResponse.json({ error: gate.reason }, { status: gate.status });

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('rooms').delete().eq('id', id);
  if (error) {
    console.error('[rooms] delete failed:', error);
    return NextResponse.json({ error: 'Failed to delete room.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
