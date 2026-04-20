import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { validateHandle } from '@/lib/handle-validation';

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.userId) {
    return NextResponse.json(
      { error: 'Not authenticated, or Supabase is not configured.' },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const raw =
    body && typeof body === 'object' && 'handle' in body
      ? String((body as { handle: unknown }).handle ?? '')
      : '';

  const check = validateHandle(raw);
  if (!check.ok) {
    return NextResponse.json({ error: check.reason }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // Uniqueness guard. Race-free via the users.handle unique constraint below; this
  // pre-check just lets us return a nice error instead of a Postgres violation code.
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('handle', check.handle)
    .maybeSingle();

  if (existing && existing.id !== session.userId) {
    return NextResponse.json(
      { error: 'That handle is already taken.' },
      { status: 409 },
    );
  }

  const { error } = await supabase
    .from('users')
    .update({ handle: check.handle })
    .eq('id', session.userId);

  if (error) {
    // 23505 = unique_violation (race condition across the pre-check)
    const code = (error as { code?: string }).code;
    if (code === '23505') {
      return NextResponse.json(
        { error: 'That handle was just taken. Try another.' },
        { status: 409 },
      );
    }
    console.error('[handle] update failed:', error);
    return NextResponse.json({ error: 'Failed to save handle.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, handle: check.handle });
}
