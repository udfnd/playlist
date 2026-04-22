---
id: SPEC-SOCIAL-001
version: 1.0.0
status: completed
created: 2026-04-21
updated: 2026-04-22
author: manager-spec
priority: High
issue_number: 0
---

# SPEC-SOCIAL-001: onrepeat.cc 방문자 소셜 레이어 (Phase 2)

## HISTORY

- 2026-04-21 / v0.1.0 / manager-spec / 초안 작성 — 하이브리드 방문자 식별(쿠키 + NextAuth), 이모지 리액션, 승인제 곡 추천, provider-specific 검색 요구사항 정의

## Overview

onrepeat.cc의 공개 방 페이지에 **가벼운 소셜 레이어**를 추가한다. 핵심 목표는 두 가지다.

1. **로그인 없는 감상자**도 곡 단위로 이모지 리액션을 남길 수 있게 한다 (쿠키 기반 익명 식별).
2. **로그인한 사용자**는 방에 곡을 추천할 수 있으며, **방 소유자의 승인을 받은 곡만** 해당 방에서만 추가로 재생 목록에 표시된다 (외부 YouTube/Spotify 플레이리스트는 건드리지 않는다).

본 SPEC은 Phase 1에서 구축된 단일 사용자용 방 구조(SPEC-UI-001, SPEC-SPOTIFY-001) 위에 **읽기 전용 외부 provider 정책**을 유지하면서 **내부 DB에 별도 소셜 데이터**를 누적하는 방식으로 설계된다.

**설계 원칙**
- 외부 플레이리스트는 완전 read-only — 승인된 추천은 `room_extra_tracks`에만 기록
- 방문자 익명성 보장 — 쿠키 id는 서버 발급·HMAC 서명, 개인정보 없음
- Provider 일관성 — 방의 `source_provider`와 추천 곡 provider 반드시 일치
- 남용 방지 — 서버 측 idempotency + rate limit

## Requirements (EARS)

### REQ-SOC-001 (Event-driven) — Visitor Identity Cookie

**WHEN** a visitor without a valid `__Host-visitor` cookie opens a public room page `/{handle}/{slug}`, the system **SHALL** issue a newly generated HMAC-signed `__Host-visitor` cookie with flags `HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=31536000` and **SHALL** upsert a row into `visitors(id, created_at, last_seen)` keyed on the decoded visitor id.

**IF** an incoming `__Host-visitor` cookie fails HMAC verification, **THEN** the system **SHALL** discard it, issue a freshly generated cookie, and **SHALL NOT** merge reactions previously made under the invalid id.

### REQ-SOC-002 (Event-driven) — Add / Remove Reaction

**WHEN** an authenticated user OR a visitor with a valid `__Host-visitor` cookie submits `POST /api/rooms/{roomId}/reactions` with payload `{ trackRef, emoji }` where `emoji ∈ EMOJI_SET` AND the room is not `private` (or the actor is the owner), the system **SHALL** insert one row into `track_reactions` keyed by `(room_id, track_ref, actor_kind, actor_id, emoji)` and **SHALL** return HTTP 201 with the row. **IF** the same tuple already exists, **THEN** the system **SHALL** return HTTP 200 idempotently with the existing row.

**WHEN** the same actor submits `DELETE /api/rooms/{roomId}/reactions` with `{ trackRef, emoji }`, the system **SHALL** delete only rows whose `actor_kind` and `actor_id` match the caller's identity.

**IF** the actor exceeds 30 reaction mutations per minute, **THEN** the system **SHALL** return HTTP 429.

### REQ-SOC-003 (Event-driven) — Submit Song Suggestion

**WHEN** an authenticated user submits `POST /api/rooms/{roomId}/suggestions` with `{ externalTrackId, title, artist, thumbnailUrl, durationSec }` AND the user has fewer than 5 suggestions with `status='pending'` for this room in the last hour, the system **SHALL** insert a `track_suggestions` row with `status='pending'`, `suggested_by = current user`, and **SHALL** return HTTP 201.

**IF** the room's `source_provider` does not match the resolved provider of the suggested track, **THEN** the system **SHALL** reject the request with HTTP 400.

**IF** the hourly rate limit (5/hour/user/room) is exceeded, **THEN** the system **SHALL** return HTTP 429.

**IF** an unauthenticated caller submits this endpoint, **THEN** the system **SHALL** return HTTP 401.

### REQ-SOC-004 (Event-driven) — Owner Moderation of Suggestions

**WHEN** the authenticated room owner submits `PATCH /api/rooms/{roomId}/suggestions/{id}` with `{ status: 'approved' | 'rejected' }`, the system **SHALL** update `track_suggestions.status`, set `resolved_at = now()`, and **IF** approving, **THEN** **SHALL** append a row to `room_extra_tracks(room_id, suggestion_id, position)` where `position` is the next available integer for the room. The system **SHALL NOT** perform any write against external YouTube or Spotify playlists.

**IF** a non-owner authenticated user attempts this PATCH, **THEN** the system **SHALL** return HTTP 403 and leave the row unchanged.

**IF** the target suggestion is already in a terminal state (`approved` or `rejected`), **THEN** the system **SHALL** return HTTP 409 and leave the row unchanged.

### REQ-SOC-005 (State-driven) — Provider-Scoped Track Search

**WHILE** an authenticated user has an open "Suggest a track" modal for a room with `source_provider = X`, the system **SHALL** expose `GET /api/rooms/{roomId}/search?q={query}&limit={n<=20}` that proxies a search to provider X:

- YouTube rooms: call YouTube Data API v3 `/search` (part=snippet, type=video) using owner OAuth when available, API-key fallback otherwise (mirrors `src/app/[handle]/[slug]/page.tsx#loadRoomAndPlaylist`).
- Spotify rooms: call `spotifyFetch(userId, '/search?type=track&q=...')` from `src/lib/spotify/client.ts`.

Results **SHALL** be normalized to `{ externalTrackId, title, artist, thumbnailUrl, durationSec }`.

**IF** the caller is not authenticated, **THEN** the system **SHALL** return HTTP 401.

## Exclusions (What NOT to Build)

- Spotify Web Playback SDK (deferred — separate SPEC)
- YouTube Music InnerTube / ytmusicapi integration (explicitly rejected)
- Free-text comments, mentions, DMs
- Any write against external YouTube or Spotify playlists (external providers remain read-only)
- Spotify as a primary login method (Google-only policy preserved)
- Moderator roles, co-ownership, bulk moderation
- Real-time push updates (Supabase Realtime / WebSocket / WebPush) — follow-up SPEC
- Email / push notifications for pending suggestions — follow-up SPEC
- Free-form display names for anonymous visitors (visitors remain truly anonymous beyond cookie id)
- Cross-device reaction merging (losing a cookie means losing that session's reactions — by design)

## Related References

- Phase 1 방 구조: SPEC-UI-001 (`.moai/specs/SPEC-UI-001/spec.md`)
- Spotify 통합: SPEC-SPOTIFY-001 (`.moai/specs/SPEC-SPOTIFY-001/spec.md`)
- HMAC 서명 패턴: `src/lib/spotify/oauth.ts` (`signState` / `verifyState`)
- Service-role Supabase 클라이언트: `src/lib/supabase/admin.ts`
- NextAuth 세션 가드 예시: `src/app/api/auth/spotify/connect/route.ts`
- Spotify 검색 호출 래퍼: `src/lib/spotify/client.ts` (`spotifyFetch`)
- YouTube OAuth fallback 로직: `src/app/[handle]/[slug]/page.tsx` (`loadRoomAndPlaylist`)
- 방 렌더링: `src/app/[handle]/[slug]/RoomCarousel.tsx`

## Constants

```ts
// src/data/reactions.ts (single source of truth)
export const EMOJI_SET = ['❤️', '🔥', '✨', '🎧', '👍', '😭', '⭐', '🔁'] as const;
export type ReactionEmoji = typeof EMOJI_SET[number];
```

## Implementation Notes

**구현 완료**: 2026-04-22
- `07ecbf2` — 본체 구현 (28 신규 + 8 수정 파일)
- `0b1e7aa` — 마이그레이션 스키마 버그 수정
- `f3bc884` — NEXTAUTH_SECRET 폴백 추가

**Supabase 마이그레이션**: `20260422033836_social_layer` Live 적용 완료 (project `wjzvyteukkybgsyttsym`). 4개 테이블(`visitors`, `track_reactions`, `track_suggestions`, `room_extra_tracks`) 확인.

### 3세션 TDD 분할

| Session | 범위 | 테스트 |
|---|---|---|
| 1 | 스키마 + 방문자 쿠키(Web Crypto) + 리액션 서비스/라우트 + middleware.ts | 149/149 |
| 2 | 제안 서비스/라우트 + 주인 승인 + 프로바이더 검색(YouTube/Spotify) | 195/195 |
| 3 | UI (ReactionPicker · SuggestTrackButton · SearchTrackModal · OwnerSuggestionQueue) + RoomCarousel/SongCarousel/SongView 배선 + `/home` 대기 건수 뱃지 | 208/208 |

### 계획 대비 차이

1. **스키마 표현**: plan.md의 `UNIQUE (…, coalesce(…), …)` 제약이 Postgres에서 syntax error → `CREATE UNIQUE INDEX` 표현 인덱스로 전환. 의미 동일, Apply 시점에 발견.
2. **`AUTH_SECRET` 환경변수**: 실제 `.env.local`은 NextAuth v4 시절 명명인 `NEXTAUTH_SECRET`만 보유. HMAC 리더 4곳(`middleware.ts`, `connect/route.ts`, `callback/route.ts`, `reactions/route.ts`)에 `process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET` 폴백 추가.
3. **Next.js 16 Server Component 쿠키 쓰기 제약 해결**: `middleware.ts` + Web Crypto 조합 선택. Edge/Node 양쪽에서 동일 `src/lib/visitor/cookie.ts` 모듈이 동작.
4. **`Song.isSuggested?: boolean`** 옵셔널 필드 추가 (비파괴). RoomCarousel이 "추천" 배지 렌더링에 사용.
5. **UI prop-drill**: `reactions`/`viewerUserId`/`isOwner`를 RoomCarousel → SongCarousel → SongView로 3단 전달. MVP 허용, 추후 context 승격 검토.
6. **`/home` pending 카운트**: `track_suggestions`가 생성된 Supabase 타입에 아직 없어 `any` 캐스트 사용. `npx supabase gen types typescript`로 재생성하면 해소됨.

### 수락 기준 대응
- Scenario 1 (방문자 쿠키 발급) → middleware.test.ts (fresh/valid/tampered)
- Scenario 2 (idempotent ❤️) → reactions/service.test.ts + route.test.ts
- Scenario 3 (로그인 유저 Spotify 방 제안) → suggestions route.test.ts + service provider-mismatch 케이스
- Scenario 4 (승인 → room_extra_tracks + 추천 배지) → moderateSuggestion approve 분기 + RoomCarousel/SongView UI 테스트
- Scenario 5 (비소유자 403) → PATCH route.test.ts forbidden 케이스
- Scenario 6 (provider-scoped 검색) → search route.test.ts YouTube/Spotify 분기
- E1–E5 엣지 → 해당 각 테스트에 포함 (E2 rate limit 31st, E3 provider 불일치, E4 병렬 idempotency, E5 409 already_resolved)

### MX 태그 인벤토리
- `@MX:WARN @MX:REASON=idempotency-and-rate-limit` — reactions POST 핸들러
- `@MX:WARN @MX:REASON=csrf-surface` — suggestions PATCH 핸들러
- `@MX:ANCHOR` — `createSuggestion`, `moderateSuggestion`, `upsertReaction`, `issueVisitorCookieHeader`
- `@MX:NOTE` — in-memory rate limiter Map (MVP, 프로덕션 Redis 권장), YouTube `/search` 이후 `/videos?part=contentDetails` duration 보강

### 배포 전 남은 것
- **수동 E2E**: Google OAuth + 실제 Spotify 계정 필요 — AI가 대신할 수 없음. spec.md의 7단계 수동 체크리스트(별도 대화에 이미 전달) 참조.
- **타입 재생성**(옵션): `npx supabase gen types typescript --project-id wjzvyteukkybgsyttsym > src/lib/supabase/database.types.ts` — `/home` 페이지의 `any` 캐스트 제거 가능.

### 후속 SPEC 후보
- 실시간 반응 업데이트 (Supabase Realtime)
- 방 주인 알림 (이메일/푸시)
- 방문자 차단·모더레이션 고급 기능
- Rate limiter Redis 이전
