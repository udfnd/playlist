# SPEC-SOCIAL-001 (Compact)

**Status:** draft | **Priority:** High | **Author:** manager-spec | **Created:** 2026-04-21

## REQ IDs

- **REQ-SOC-001** (Event-driven): Issue HMAC-signed `__Host-visitor` cookie on public room first-visit; upsert `visitors`.
- **REQ-SOC-002** (Event-driven): Idempotent reaction POST/DELETE from visitor or user; 30/min rate limit.
- **REQ-SOC-003** (Event-driven): Authenticated user submits suggestion; 5/hour/room; provider must match room.
- **REQ-SOC-004** (Event-driven): Owner-only PATCH moderation; approval appends to `room_extra_tracks`; no external playlist write. Non-owner → 403. Already-resolved → 409.
- **REQ-SOC-005** (State-driven): Auth-gated `GET /search` proxies to YouTube Data API v3 or Spotify `/search` matching `room.source_provider`.

## Acceptance (Summary)

- S1 Visitor first-visit → signed cookie + `visitors` row
- S2 Reaction idempotency (201 then 200 on duplicate)
- S3 Suggestion submission (pending row, no external write)
- S4 Owner approval → `room_extra_tracks` + "추천" badge (no external playlist mutation)
- S5 Non-owner PATCH → 403, row unchanged
- S6 Provider-scoped search returns normalized 5-field track shape
- Edges: E1 invalid cookie / E2 rate-limit 429 / E3 provider mismatch 400 / E4 concurrent idempotent / E5 already-resolved 409

## Files to Modify

**New**
- `supabase/migrations/20260422_social_layer.sql`
- `src/lib/visitor/cookie.ts` (+ test)
- `src/lib/reactions/service.ts` (+ test)
- `src/lib/suggestions/service.ts` (+ test)
- `src/lib/search/youtube-search.ts` (+ test)
- `src/lib/search/spotify-search.ts` (+ test)
- `src/app/api/rooms/[id]/reactions/route.ts` (+ test)
- `src/app/api/rooms/[id]/suggestions/route.ts` (+ test)
- `src/app/api/rooms/[id]/suggestions/[sid]/route.ts` (+ test)
- `src/app/api/rooms/[id]/search/route.ts` (+ test)
- `src/app/[handle]/[slug]/{ReactionPicker,SuggestTrackButton,OwnerSuggestionQueue,SearchTrackModal}.tsx`
- `src/data/reactions.ts` (EMOJI_SET single source of truth)

**Modify**
- `src/app/[handle]/[slug]/page.tsx` (cookie bootstrap + load reactions/extraTracks)
- `src/app/[handle]/[slug]/RoomCarousel.tsx` (accept extraTracks + reactions props)
- `src/app/home/page.tsx` (pending-suggestions count badge)

## Exclusions

- Spotify Web Playback SDK — separate SPEC
- YouTube Music / ytmusicapi — rejected
- Free-text comments, mentions, DMs
- External playlist writes (YouTube or Spotify) — read-only policy preserved
- Spotify as login method (Google-only)
- Moderator / co-owner roles
- Realtime push, email/push notifications — follow-up SPEC
- Visitor display names (truly anonymous)
- Cross-device reaction merging

## Env Vars

No new env vars. Reuses `AUTH_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `YOUTUBE_API_KEY`.
