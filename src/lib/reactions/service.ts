// @MX:SPEC: SPEC-SOCIAL-001
// @MX:ANCHOR: upsertReaction — fan-in: route handler + room-page server component
// @MX:REASON: idempotency-and-rate-limit
// @MX:NOTE: in-memory rate limiter is MVP-only; replace with Redis or Supabase Edge at scale.

// Pure service functions for the reactions layer. Accept a Supabase admin
// client as a parameter so the same module is testable with a stub and usable
// from route handlers. Uses an untyped Supabase client because the new tables
// are not yet in the generated Database types.

import type { SupabaseClient } from '@supabase/supabase-js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = SupabaseClient<any, 'public', any>;

export type ActorKind = 'visitor' | 'user';

export interface ReactionActorKey {
  roomId: string;
  trackRef: string;
  actorKind: ActorKind;
  actorId: string;
  emoji: string;
}

export interface ReactionRow {
  id: string;
  room_id: string;
  track_ref: string;
  actor_kind: ActorKind;
  visitor_id: string | null;
  user_id: string | null;
  emoji: string;
  created_at?: string;
}

export interface UpsertReactionResult {
  reaction: ReactionRow;
  created: boolean;
}

/**
 * INSERT one reaction row. If the UNIQUE(room_id, track_ref, actor_kind,
 * coalesce(visitor_id,user_id), emoji) constraint fires (PG error 23505),
 * SELECT the existing row and return `{ created: false }`. Implements the
 * 201-vs-200 idempotent path required by REQ-SOC-002.
 */
export async function upsertReaction(
  supabase: AdminClient,
  key: ReactionActorKey,
): Promise<UpsertReactionResult> {
  const visitorId = key.actorKind === 'visitor' ? key.actorId : null;
  const userId = key.actorKind === 'user' ? key.actorId : null;

  const insertRow = {
    room_id: key.roomId,
    track_ref: key.trackRef,
    actor_kind: key.actorKind,
    visitor_id: visitorId,
    user_id: userId,
    emoji: key.emoji,
  };

  const inserted = await supabase
    .from('track_reactions')
    .insert(insertRow)
    .select('*')
    .maybeSingle();

  if (inserted.data) {
    return { reaction: inserted.data as ReactionRow, created: true };
  }

  // Assume unique-violation (or any INSERT that returns no row) — fetch existing.
  let q = supabase
    .from('track_reactions')
    .select('*')
    .eq('room_id', key.roomId)
    .eq('track_ref', key.trackRef)
    .eq('actor_kind', key.actorKind)
    .eq('emoji', key.emoji);
  q = key.actorKind === 'visitor' ? q.eq('visitor_id', visitorId) : q.eq('user_id', userId);
  const existing = await q.maybeSingle();
  if (!existing.data) {
    throw new Error('upsertReaction: insert failed and no existing row found');
  }
  return { reaction: existing.data as ReactionRow, created: false };
}

/**
 * DELETE reactions matching the exact actor. Non-matching rows are untouched
 * — DELETE is scoped to the caller's own identity.
 */
export async function deleteReaction(
  supabase: AdminClient,
  key: ReactionActorKey,
): Promise<{ deleted: number }> {
  const visitorId = key.actorKind === 'visitor' ? key.actorId : null;
  const userId = key.actorKind === 'user' ? key.actorId : null;

  let q = supabase
    .from('track_reactions')
    .delete()
    .eq('room_id', key.roomId)
    .eq('track_ref', key.trackRef)
    .eq('actor_kind', key.actorKind)
    .eq('emoji', key.emoji);
  q = key.actorKind === 'visitor' ? q.eq('visitor_id', visitorId) : q.eq('user_id', userId);
  const res = (await q) as unknown as { count?: number | null };
  return { deleted: res.count ?? 0 };
}

/** List all reactions for a room. Route handler aggregates counts. */
export async function listReactions(
  supabase: AdminClient,
  roomId: string,
): Promise<ReactionRow[]> {
  const res = (await supabase
    .from('track_reactions')
    .select('*')
    .eq('room_id', roomId)) as unknown as { data: ReactionRow[] | null };
  return res.data ?? [];
}

export interface VisibilityRoom {
  visibility: string;
  user_id: string;
}

/**
 * Returns true when the room's visibility permits the actor to interact.
 * Currently: private rooms are owner-only; public/unlisted allow any actor.
 */
export function visibilityAllows(
  room: VisibilityRoom,
  actorKind: ActorKind,
  actorId: string,
): boolean {
  if (room.visibility !== 'private') return true;
  return actorKind === 'user' && actorId === room.user_id;
}

// -------- Rate limiter (in-memory, per-process) --------
// Sliding window: up to REACTION_LIMIT mutations per REACTION_WINDOW_MS.

const REACTION_LIMIT = 30;
const REACTION_WINDOW_MS = 60_000;
const reactionBuckets = new Map<string, number[]>();

export interface RateLimitResult {
  ok: boolean;
  retryAfter?: number;
}

export function checkReactionRateLimit(actorKey: string): RateLimitResult {
  const now = Date.now();
  const cutoff = now - REACTION_WINDOW_MS;
  const bucket = (reactionBuckets.get(actorKey) ?? []).filter((t) => t > cutoff);
  if (bucket.length >= REACTION_LIMIT) {
    const retryAfter = Math.max(1, Math.ceil((bucket[0] + REACTION_WINDOW_MS - now) / 1000));
    reactionBuckets.set(actorKey, bucket);
    return { ok: false, retryAfter };
  }
  bucket.push(now);
  reactionBuckets.set(actorKey, bucket);
  return { ok: true };
}

/** Test-only reset. Not exported for production callers. */
export function __resetReactionRateLimit(): void {
  reactionBuckets.clear();
}
