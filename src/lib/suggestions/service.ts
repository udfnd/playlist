// @MX:SPEC: SPEC-SOCIAL-001
// @MX:ANCHOR: createSuggestion / moderateSuggestion — fan-in: POST/PATCH route handlers
// @MX:REASON: csrf-surface
// @MX:NOTE: in-memory rate limiter is MVP-only; replace with Redis or Supabase Edge at scale.
//
// Pure service layer for the track-suggestion queue. Accepts a Supabase admin
// client so the same module is testable with a stub and usable from route
// handlers. Uses an untyped Supabase client because the new tables are not yet
// in the generated Database types.
//
// IMPORTANT: this module never calls external YouTube/Spotify endpoints.
// Approving a suggestion only writes to internal `room_extra_tracks`. The DoD
// grep for external playlist-track writes enforces this guarantee.

import type { SupabaseClient } from '@supabase/supabase-js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = SupabaseClient<any, 'public', any>;

export type SourceProvider = 'youtube' | 'spotify';
export type SuggestionStatus = 'pending' | 'approved' | 'rejected';

export interface SuggestionInput {
  roomId: string;
  suggestedBy: string;
  sourceProvider: SourceProvider;
  externalTrackId: string;
  title: string;
  artist: string;
  thumbnailUrl?: string | null;
  durationSec?: number | null;
}

export interface SuggestionRow {
  id: string;
  room_id: string;
  suggested_by: string;
  source_provider: SourceProvider;
  external_track_id: string;
  title: string;
  artist: string;
  thumbnail_url: string | null;
  duration_sec: number | null;
  status: SuggestionStatus;
  created_at?: string;
  resolved_at?: string | null;
}

export interface ExtraTrackRow {
  id: string;
  room_id: string;
  suggestion_id: string;
  position: number;
  created_at?: string;
}

export type CreateSuggestionResult =
  | { ok: true; suggestion: SuggestionRow }
  | {
      ok: false;
      code: 'provider_mismatch' | 'duplicate' | 'rate_limited' | 'room_not_found';
      retryAfter?: number;
    };

export type ModerateSuggestionResult =
  | { ok: true; row: SuggestionRow; extraTrack?: ExtraTrackRow }
  | { ok: false; code: 'not_found' | 'forbidden' | 'already_resolved' };

export interface RateLimitResult {
  ok: boolean;
  retryAfter?: number;
}

// -------- Rate limiter (in-memory, per-process) --------
// Sliding window: up to SUGGESTION_LIMIT pending creates per
// SUGGESTION_WINDOW_MS for the (userId, roomId) pair.

const SUGGESTION_LIMIT = 5;
const SUGGESTION_WINDOW_MS = 60 * 60 * 1000;
const suggestionBuckets = new Map<string, number[]>();

export function checkSuggestionRateLimit(
  actorUserId: string,
  roomId: string,
): RateLimitResult {
  const key = `${actorUserId}::${roomId}`;
  const now = Date.now();
  const cutoff = now - SUGGESTION_WINDOW_MS;
  const bucket = (suggestionBuckets.get(key) ?? []).filter((t) => t > cutoff);
  if (bucket.length >= SUGGESTION_LIMIT) {
    const retryAfter = Math.max(
      1,
      Math.ceil((bucket[0] + SUGGESTION_WINDOW_MS - now) / 1000),
    );
    suggestionBuckets.set(key, bucket);
    return { ok: false, retryAfter };
  }
  bucket.push(now);
  suggestionBuckets.set(key, bucket);
  return { ok: true };
}

/** Test-only reset. */
export function __resetSuggestionRateLimit(): void {
  suggestionBuckets.clear();
}

interface RoomLookupRow {
  id: string;
  user_id: string;
  source_provider: SourceProvider;
}

async function loadRoomMeta(
  supabase: AdminClient,
  roomId: string,
): Promise<RoomLookupRow | null> {
  const { data } = await supabase
    .from('rooms')
    .select('id, user_id, source_provider')
    .eq('id', roomId)
    .maybeSingle();
  return (data as RoomLookupRow | null) ?? null;
}

/**
 * Insert a new pending suggestion. Implements REQ-SOC-003: provider must
 * match the room's `source_provider`; rate limit is 5/hour/user/room; DB
 * UNIQUE(room_id, suggested_by, external_track_id) maps to `duplicate`.
 */
export async function createSuggestion(
  supabase: AdminClient,
  input: SuggestionInput,
): Promise<CreateSuggestionResult> {
  const room = await loadRoomMeta(supabase, input.roomId);
  if (!room) return { ok: false, code: 'room_not_found' };
  if (room.source_provider !== input.sourceProvider) {
    return { ok: false, code: 'provider_mismatch' };
  }

  const rate = checkSuggestionRateLimit(input.suggestedBy, input.roomId);
  if (!rate.ok) {
    return { ok: false, code: 'rate_limited', retryAfter: rate.retryAfter };
  }

  const insertRow = {
    room_id: input.roomId,
    suggested_by: input.suggestedBy,
    source_provider: input.sourceProvider,
    external_track_id: input.externalTrackId,
    title: input.title,
    artist: input.artist,
    thumbnail_url: input.thumbnailUrl ?? null,
    duration_sec: input.durationSec ?? null,
    status: 'pending' as SuggestionStatus,
  };

  const inserted = await supabase
    .from('track_suggestions')
    .insert(insertRow)
    .select('*')
    .maybeSingle();

  if (!inserted.data) {
    return { ok: false, code: 'duplicate' };
  }
  return { ok: true, suggestion: inserted.data as SuggestionRow };
}

/** REQ-SOC-005-adjacent: visitors only see what owners have approved. */
export async function listSuggestionsForVisitor(
  supabase: AdminClient,
  roomId: string,
): Promise<SuggestionRow[]> {
  const res = (await supabase
    .from('track_suggestions')
    .select('*')
    .eq('room_id', roomId)
    .eq('status', 'approved')) as unknown as { data: SuggestionRow[] | null };
  return res.data ?? [];
}

/** Owner queue view: pending + approved + rejected together. */
export async function listSuggestionsForOwner(
  supabase: AdminClient,
  roomId: string,
): Promise<SuggestionRow[]> {
  const res = (await supabase
    .from('track_suggestions')
    .select('*')
    .eq('room_id', roomId)) as unknown as { data: SuggestionRow[] | null };
  return res.data ?? [];
}

interface ModerateInput {
  suggestionId: string;
  ownerUserId: string;
  status: 'approved' | 'rejected';
}

/**
 * REQ-SOC-004 implementation. Owner-only PATCH; pending → terminal state;
 * on approve, append to `room_extra_tracks` with the next available position.
 * Never writes to external playlists.
 */
export async function moderateSuggestion(
  supabase: AdminClient,
  input: ModerateInput,
): Promise<ModerateSuggestionResult> {
  // Load suggestion first.
  const { data: sugData } = await supabase
    .from('track_suggestions')
    .select('*')
    .eq('id', input.suggestionId)
    .maybeSingle();
  const suggestion = sugData as SuggestionRow | null;
  if (!suggestion) return { ok: false, code: 'not_found' };

  // Owner check via the room.
  const room = await loadRoomMeta(supabase, suggestion.room_id);
  if (!room || room.user_id !== input.ownerUserId) {
    return { ok: false, code: 'forbidden' };
  }

  if (suggestion.status !== 'pending') {
    return { ok: false, code: 'already_resolved' };
  }

  const resolvedAt = new Date().toISOString();
  const updated = await supabase
    .from('track_suggestions')
    .update({ status: input.status, resolved_at: resolvedAt })
    .eq('id', input.suggestionId)
    .select('*')
    .maybeSingle();
  const updatedRow = (updated.data as SuggestionRow | null) ?? {
    ...suggestion,
    status: input.status,
    resolved_at: resolvedAt,
  };

  if (input.status === 'rejected') {
    return { ok: true, row: updatedRow };
  }

  // Approve: compute next position = max(position)+1, or 1 if none.
  const nextPosRow = await supabase
    .from('room_extra_tracks')
    .select('position')
    .eq('room_id', suggestion.room_id)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();
  const prevPos = (nextPosRow.data as { position: number } | null)?.position ?? 0;
  const nextPos = prevPos + 1;

  const extraInsert = await supabase
    .from('room_extra_tracks')
    .insert({
      room_id: suggestion.room_id,
      suggestion_id: suggestion.id,
      position: nextPos,
    })
    .select('*')
    .maybeSingle();

  return {
    ok: true,
    row: updatedRow,
    extraTrack: (extraInsert.data as ExtraTrackRow | undefined) ?? undefined,
  };
}
