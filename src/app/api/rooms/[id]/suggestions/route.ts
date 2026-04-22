// @MX:SPEC: SPEC-SOCIAL-001
// POST /api/rooms/[id]/suggestions — submit a suggestion (auth required)
// GET  /api/rooms/[id]/suggestions — list (owner sees all, others see approved)

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import {
  createSuggestion,
  listSuggestionsForOwner,
  listSuggestionsForVisitor,
  type SourceProvider,
} from '@/lib/suggestions/service';

interface Context {
  params: Promise<{ id: string }>;
}

interface PostBody {
  externalTrackId?: unknown;
  title?: unknown;
  artist?: unknown;
  thumbnailUrl?: unknown;
  durationSec?: unknown;
}

interface ParsedBody {
  externalTrackId: string;
  title: string;
  artist: string;
  thumbnailUrl: string | null;
  durationSec: number | null;
}

function parsePostBody(raw: unknown): ParsedBody | null {
  if (!raw || typeof raw !== 'object') return null;
  const b = raw as PostBody;
  if (typeof b.externalTrackId !== 'string' || !b.externalTrackId) return null;
  if (typeof b.title !== 'string' || !b.title) return null;
  if (typeof b.artist !== 'string' || !b.artist) return null;
  return {
    externalTrackId: b.externalTrackId,
    title: b.title,
    artist: b.artist,
    thumbnailUrl: typeof b.thumbnailUrl === 'string' ? b.thumbnailUrl : null,
    durationSec: typeof b.durationSec === 'number' ? b.durationSec : null,
  };
}

async function loadRoomProvider(
  roomId: string,
): Promise<{ provider: SourceProvider; ownerId: string } | null> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('rooms')
    .select('user_id, source_provider')
    .eq('id', roomId)
    .maybeSingle();
  if (!data) return null;
  const row = data as { user_id: string; source_provider: SourceProvider };
  return { provider: row.source_provider, ownerId: row.user_id };
}

export async function POST(request: Request, ctx: Context): Promise<Response> {
  const { id: roomId } = await ctx.params;
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
  const body = parsePostBody(raw);
  if (!body) {
    return NextResponse.json(
      { error: '필수 필드가 누락되었습니다.' },
      { status: 400 },
    );
  }

  const room = await loadRoomProvider(roomId);
  if (!room) {
    return NextResponse.json({ error: '방을 찾을 수 없습니다.' }, { status: 404 });
  }

  const supabase = getSupabaseAdmin();
  const result = await createSuggestion(supabase, {
    roomId,
    suggestedBy: session.userId,
    sourceProvider: room.provider,
    externalTrackId: body.externalTrackId,
    title: body.title,
    artist: body.artist,
    thumbnailUrl: body.thumbnailUrl,
    durationSec: body.durationSec,
  });

  if (!result.ok) {
    if (result.code === 'provider_mismatch') {
      return NextResponse.json({ error: 'provider_mismatch' }, { status: 400 });
    }
    if (result.code === 'duplicate') {
      return NextResponse.json({ error: 'duplicate' }, { status: 409 });
    }
    if (result.code === 'rate_limited') {
      return new NextResponse(
        JSON.stringify({ error: '잠시 후 다시 시도해 주세요.' }),
        {
          status: 429,
          headers: {
            'content-type': 'application/json',
            'Retry-After': String(result.retryAfter ?? 60),
          },
        },
      );
    }
    if (result.code === 'room_not_found') {
      return NextResponse.json({ error: '방을 찾을 수 없습니다.' }, { status: 404 });
    }
  }

  return NextResponse.json(
    { suggestion: (result as { suggestion: unknown }).suggestion },
    { status: 201 },
  );
}

export async function GET(request: Request, ctx: Context): Promise<Response> {
  void request;
  const { id: roomId } = await ctx.params;
  const session = await auth();

  const room = await loadRoomProvider(roomId);
  if (!room) {
    return NextResponse.json({ error: '방을 찾을 수 없습니다.' }, { status: 404 });
  }

  const supabase = getSupabaseAdmin();
  const isOwner = Boolean(session?.userId && session.userId === room.ownerId);
  const suggestions = isOwner
    ? await listSuggestionsForOwner(supabase, roomId)
    : await listSuggestionsForVisitor(supabase, roomId);

  return NextResponse.json({ suggestions });
}
