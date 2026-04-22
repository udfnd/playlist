## SPEC-SOCIAL-001 Progress

- Started: 2026-04-22
- Harness level: standard
- Development mode: tdd
- Execution mode: sub-agent (solo)
- Language skill: moai-lang-typescript
- Scale-based mode: Full Pipeline (14+ files, 2+ domains, complexity=7+)

## Strategy Decisions (resolved upfront to avoid DDD-time churn)

- **R1 (Next.js 16 Server Component cookie set)** resolved: use `middleware.ts` matching `/:handle/:slug*` and `/api/rooms/:path*`. HMAC via Web Crypto `crypto.subtle` so the same module runs in Edge and Node runtimes. A single helper `src/lib/visitor/cookie.ts` exports async `issue`/`verify` using Web Crypto. API routes also import the same helper.
- **Session split**: 3 sessions to keep each under quality-safe size.
  - Session 1 (now): T1 Schema migration, T2 Visitor cookie library + tests, T3 Reactions service + POST/GET/DELETE route + tests, middleware.ts for visitor bootstrap.
  - Session 2: T4 Suggestions service + POST/GET/PATCH routes + tests, T5 Provider search (YouTube + Spotify) + tests, T4 provider-mismatch guard.
  - Session 3: T6/T7/T8 UI (ReactionPicker, SuggestTrackButton, SearchTrackModal, OwnerSuggestionQueue, RoomCarousel extraTracks wiring, /home pending badge).

## Session 1 Completion — 2026-04-22

- T-1 complete: supabase/migrations/20260422_social_layer.sql + src/__tests__/migrations/social-schema.test.ts · tests 3/3 · drift 0
- T-2 complete: src/data/reactions.ts, src/lib/visitor/cookie.ts (+__tests__/cookie.test.ts), middleware.ts (+src/__tests__/middleware.test.ts) · tests 7/7 + 4/4 · drift 0
- T-3 complete: src/lib/reactions/service.ts (+__tests__/service.test.ts, _helpers.ts), src/app/api/rooms/[id]/reactions/route.ts (+__tests__/route.test.ts) · tests 12/12 + 7/7 · drift 0

Totals: 149/149 tests · tsc clean · lint 0 errors · 3 new-file warnings pre-existing in scripts/

## Session 2 Completion — 2026-04-22

- T-4 complete: src/lib/suggestions/service.ts (+__tests__/service.test.ts, _helpers.ts), src/app/api/rooms/[id]/suggestions/route.ts (+__tests__/route.test.ts), src/app/api/rooms/[id]/suggestions/[sid]/route.ts (+__tests__/route.test.ts) · tests 14/14 + 8/8 + 7/7 · drift 0
- T-5 complete: src/lib/search/spotify-search.ts (+__tests__/spotify-search.test.ts), src/lib/search/youtube-search.ts (+__tests__/youtube-search.test.ts), src/app/api/rooms/[id]/search/route.ts (+__tests__/route.test.ts) · tests 5/5 + 5/5 + 7/7 · drift 0

Totals: 195/195 tests · tsc clean · lint 0 errors · 3 pre-existing scripts/ warnings · DoD external-playlist-write grep 0 matches · EMOJI_SET single source verified

Middleware decision: chose `middleware.ts` at project root over API bootstrap. Web Crypto (crypto.subtle) used consistently in both Edge middleware and Node route handlers so the cookie module is runtime-agnostic. UUID visitor ids via `crypto.randomUUID()`.

## Session 3 Completion — 2026-04-22

- T-6 complete: src/app/[handle]/[slug]/ReactionPicker.tsx, ReactionBadges.tsx, SuggestTrackButton.tsx, SearchTrackModal.tsx, OwnerSuggestionQueue.tsx + __tests__ for each (ReactionPicker, SuggestTrackButton, SearchTrackModal, OwnerSuggestionQueue) · tests 4/4 + 3/3 + 3/3 + 3/3 · drift 0
- T-7 complete: src/app/[handle]/[slug]/page.tsx (loadExtrasAndReactions helper; append approved `room_extra_tracks` to playlist; aggregate reactions; viewerUserId / isOwner / Spotify connection presence), src/app/[handle]/[slug]/RoomCarousel.tsx (new props + SuggestTrackButton footer + owner queue modal), src/components/scene/SongCarousel.tsx (forward roomId + reactions), src/components/ui/SongView.tsx (mount ReactionPicker + ReactionBadges + "추천" badge for suggested tracks), src/data/types.ts (additive `isSuggested?: boolean`) · drift 0 (additive)
- T-8 complete: src/app/home/page.tsx (per-room pending count query), src/app/home/RoomCard.tsx (pendingCount prop + "대기 중 N건" pill) · drift 0

Totals: 208/208 tests (195 prior + 13 new) · tsc clean · lint 0 errors · 3 pre-existing scripts/ warnings · DoD token-leak grep confirms only server-component hits in page.tsx · Song.isSuggested is additive and all prior tests still pass.

## Sync — 2026-04-22
- Migration applied live (Supabase project wjzvyteukkybgsyttsym, `20260422033836_social_layer`)
- Schema fix 0b1e7aa (UNIQUE constraint → expression index)
- Env fallback f3bc884 (NEXTAUTH_SECRET accepted)
- spec.md status: draft → completed, version 1.0.0
