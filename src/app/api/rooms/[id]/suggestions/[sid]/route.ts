// @MX:SPEC: SPEC-SOCIAL-001
// PATCH /api/rooms/[id]/suggestions/[sid] — owner moderation only.
// @MX:WARN: csrf-surface — mutation by authenticated owner; relies on NextAuth
// session cookie (SameSite=Lax). Body must be JSON, not form-urlencoded.
// @MX:REASON: csrf-surface

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { moderateSuggestion } from '@/lib/suggestions/service';

interface Context {
  params: Promise<{ id: string; sid: string }>;
}

interface PatchBody {
  status?: unknown;
}

function parsePatchBody(raw: unknown): { status: 'approved' | 'rejected' } | null {
  if (!raw || typeof raw !== 'object') return null;
  const b = raw as PatchBody;
  if (b.status !== 'approved' && b.status !== 'rejected') return null;
  return { status: b.status };
}

export async function PATCH(request: Request, ctx: Context): Promise<Response> {
  const { sid } = await ctx.params;
  const session = await auth();
  if (!session?.userId) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청 본문입니다.' }, { status: 400 });
  }
  const body = parsePatchBody(raw);
  if (!body) {
    return NextResponse.json(
      { error: 'status 는 approved 또는 rejected 여야 합니다.' },
      { status: 400 },
    );
  }

  const supabase = getSupabaseAdmin();
  const res = await moderateSuggestion(supabase, {
    suggestionId: sid,
    ownerUserId: session.userId,
    status: body.status,
  });

  if (!res.ok) {
    if (res.code === 'not_found') {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    if (res.code === 'forbidden') {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    if (res.code === 'already_resolved') {
      return NextResponse.json({ error: 'already_resolved' }, { status: 409 });
    }
  }

  if (res.ok) {
    return NextResponse.json(
      { suggestion: res.row, extraTrack: res.extraTrack },
      { status: 200 },
    );
  }
  return NextResponse.json({ error: 'unknown' }, { status: 500 });
}
