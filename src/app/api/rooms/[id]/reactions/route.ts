// @MX:SPEC: SPEC-SOCIAL-001
// POST / GET / DELETE /api/rooms/[id]/reactions
//
// Hybrid identity: authenticated users use their NextAuth session; anonymous
// visitors use the HMAC-signed __Host-visitor cookie issued by middleware.ts.
// The POST handler enforces DB-level idempotency (unique constraint) plus an
// in-memory sliding-window rate limit — see service.ts for details.

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { EMOJI_SET, isReactionEmoji } from '@/data/reactions';
import { COOKIE_NAME, verifyVisitorCookie } from '@/lib/visitor/cookie';
import {
  type ActorKind,
  type ReactionRow,
  checkReactionRateLimit,
  deleteReaction,
  listReactions,
  upsertReaction,
  visibilityAllows,
} from '@/lib/reactions/service';

interface Context {
  params: Promise<{ id: string }>;
}

interface Actor {
  kind: ActorKind;
  id: string;
}

async function resolveActor(request: Request): Promise<Actor | null> {
  const session = await auth();
  if (session?.userId) {
    return { kind: 'user', id: session.userId };
  }
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) return null;
  // Parse cookies from the header. Next-native Request doesn't expose a
  // typed `.cookies`, so we fall back to the Cookie header.
  const cookieHeader = request.headers.get('cookie') ?? '';
  const match = cookieHeader
    .split(';')
    .map((s) => s.trim())
    .find((s) => s.startsWith(`${COOKIE_NAME}=`));
  if (!match) return null;
  const raw = decodeURIComponent(match.slice(COOKIE_NAME.length + 1));
  const visitorId = await verifyVisitorCookie(raw, secret);
  if (!visitorId) return null;
  return { kind: 'visitor', id: visitorId };
}

async function loadRoom(
  roomId: string,
): Promise<{ id: string; visibility: string; user_id: string } | null> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('rooms')
    .select('id, visibility, user_id')
    .eq('id', roomId)
    .maybeSingle();
  if (!data) return null;
  return data as { id: string; visibility: string; user_id: string };
}

interface MutationBody {
  trackRef?: unknown;
  emoji?: unknown;
}

function parseMutationBody(raw: unknown): { trackRef: string; emoji: string } | null {
  if (!raw || typeof raw !== 'object') return null;
  const body = raw as MutationBody;
  if (typeof body.trackRef !== 'string' || !body.trackRef) return null;
  if (!isReactionEmoji(body.emoji)) return null;
  return { trackRef: body.trackRef, emoji: body.emoji };
}

// @MX:WARN: idempotency-and-rate-limit hot path — DB unique handles duplicates, sliding
// @MX:REASON: idempotency-and-rate-limit
export async function POST(request: Request, ctx: Context): Promise<Response> {
  const { id: roomId } = await ctx.params;
  const actor = await resolveActor(request);
  if (!actor) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청 본문입니다.' }, { status: 400 });
  }
  const parsed = parseMutationBody(raw);
  if (!parsed) {
    const allowed = (EMOJI_SET as readonly string[]).join(', ');
    return NextResponse.json(
      { error: `유효하지 않은 이모지입니다. 허용: ${allowed}` },
      { status: 400 },
    );
  }

  const room = await loadRoom(roomId);
  if (!room) {
    return NextResponse.json({ error: '방을 찾을 수 없습니다.' }, { status: 404 });
  }
  if (!visibilityAllows(room, actor.kind, actor.id)) {
    return NextResponse.json({ error: '이 방에는 리액션을 남길 수 없습니다.' }, { status: 403 });
  }

  const rate = checkReactionRateLimit(`${actor.kind}:${actor.id}`);
  if (!rate.ok) {
    return new NextResponse(
      JSON.stringify({ error: '잠시 후 다시 시도해 주세요.' }),
      {
        status: 429,
        headers: {
          'content-type': 'application/json',
          'Retry-After': String(rate.retryAfter ?? 60),
        },
      },
    );
  }

  const supabase = getSupabaseAdmin();
  try {
    const { reaction, created } = await upsertReaction(supabase, {
      roomId,
      trackRef: parsed.trackRef,
      actorKind: actor.kind,
      actorId: actor.id,
      emoji: parsed.emoji,
    });
    return NextResponse.json({ reaction }, { status: created ? 201 : 200 });
  } catch (err) {
    console.error('[reactions] upsert failed:', err);
    return NextResponse.json({ error: '리액션 저장에 실패했습니다.' }, { status: 500 });
  }
}

export async function DELETE(request: Request, ctx: Context): Promise<Response> {
  const { id: roomId } = await ctx.params;
  const actor = await resolveActor(request);
  if (!actor) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청 본문입니다.' }, { status: 400 });
  }
  const parsed = parseMutationBody(raw);
  if (!parsed) {
    return NextResponse.json({ error: '유효하지 않은 이모지입니다.' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { deleted } = await deleteReaction(supabase, {
    roomId,
    trackRef: parsed.trackRef,
    actorKind: actor.kind,
    actorId: actor.id,
    emoji: parsed.emoji,
  });
  return NextResponse.json({ deleted }, { status: 200 });
}

interface AggregatedReaction {
  trackRef: string;
  emoji: string;
  count: number;
  byMe: boolean;
}

export async function GET(request: Request, ctx: Context): Promise<Response> {
  const { id: roomId } = await ctx.params;
  const actor = await resolveActor(request);

  const supabase = getSupabaseAdmin();
  const rows = await listReactions(supabase, roomId);

  const url = new URL(request.url);
  const filterTrack = url.searchParams.get('trackRef');

  const buckets = new Map<string, AggregatedReaction>();
  for (const row of rows as ReactionRow[]) {
    if (filterTrack && row.track_ref !== filterTrack) continue;
    const key = `${row.track_ref}::${row.emoji}`;
    const bucket =
      buckets.get(key) ??
      ({ trackRef: row.track_ref, emoji: row.emoji, count: 0, byMe: false } as AggregatedReaction);
    bucket.count += 1;
    if (
      actor &&
      row.actor_kind === actor.kind &&
      (actor.kind === 'visitor'
        ? row.visitor_id === actor.id
        : row.user_id === actor.id)
    ) {
      bucket.byMe = true;
    }
    buckets.set(key, bucket);
  }

  return NextResponse.json({ reactions: Array.from(buckets.values()) });
}
