# SPEC-SOCIAL-001 Implementation Plan

## Scope Snapshot

- 방문자 쿠키 기반 익명 식별 + NextAuth 세션 기반 작성자 식별의 **하이브리드** 모델
- 이모지 리액션 API 3개 (POST / GET / DELETE)
- 승인제 곡 추천 API 4개 (POST suggestion / GET list / PATCH moderate / GET search)
- 외부 플레이리스트 writer 0개 (read-only 정책 유지)
- 신규 Supabase migration 1개 (`20260422_social_layer.sql`)

## Task Decomposition Preview

> 상세 Task 분해는 `/moai:2-run` 진입 시 manager-ddd가 확정한다. 아래는 writer 레벨 preview일 뿐이다.

| # | 영역 | 예상 산출물 |
|---|------|-------------|
| T1 | Schema | `supabase/migrations/20260422_social_layer.sql` |
| T2 | Visitor cookie | `src/lib/visitor/cookie.ts` + tests |
| T3 | Reaction service + routes | `src/lib/reactions/**`, `src/app/api/rooms/[id]/reactions/route.ts` |
| T4 | Suggestion service + routes | `src/lib/suggestions/**`, `src/app/api/rooms/[id]/suggestions/**` |
| T5 | Provider search | `src/lib/search/{youtube,spotify}-search.ts` + `GET /search` route |
| T6 | Room page integration | ReactionPicker, SuggestTrackButton, OwnerSuggestionQueue, SearchTrackModal |
| T7 | RoomCarousel props wiring | extraTracks + reactions map |
| T8 | Home 페이지 배지 | pending suggestions count |

Priority order: T1 → T2 → (T3, T5 병렬) → T4 → T6/T7/T8.

## Technical Approach

### Cookie / Security Design

- Cookie name: `__Host-visitor` (Host- 프리픽스 강제)
- Value format: `{visitorIdBase64url}.{hmacHex}`
  - `visitorId`: `node:crypto`의 `randomBytes(16)` base64url 인코딩 (128bit, UUID-호환)
  - `hmacHex`: `createHmac('sha256', AUTH_SECRET).update(visitorId).digest('hex')`
- Flags: `Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31_536_000`
- Issuing 지점:
  1. 공개 방 페이지 `/{handle}/{slug}` 서버 렌더 진입 시 (없으면 발급)
  2. reaction/suggestion API 콜 진입 시 (누락되어 있으면 즉시 발급 후 응답 쿠키 세팅)
- Next.js 16 서버 컴포넌트에서 쿠키 쓰기 제약:
  - Server Component 내에서 `cookies().set(...)`은 허용되지 않음. 방 페이지에서는 route segment의 `generateMetadata` 또는 `middleware.ts`를 통해 쿠키 발급 wrapper를 제공한다.
  - Plan: `middleware.ts`에 `/[handle]/[slug]` 매처를 추가하여 `__Host-visitor` 부재 시 쿠키를 발급. `middleware`는 Edge runtime이므로 HMAC은 `crypto.subtle`로 이식 필요 — 대안으로 Node runtime의 API route `POST /api/visitor/init`을 room page가 호출하게 하는 방법도 있음. 구현 단계(DDD phase)에서 manager-ddd가 최종 선택.
- 참고 구현: `src/lib/spotify/oauth.ts`의 `signState` / `verifyState` 패턴을 재사용 (동일한 HMAC-SHA256 + constant-time compare).

### Rate Limits (MVP)

- Reactions: **30 mutations/min per actor** (visitor_id 또는 user_id 기준)
- Suggestions: **5 pending/hour per user per room**
- 구현: per-process in-memory `Map<string, number[]>` (sliding window)
- `@MX:NOTE` 주석으로 "replace with Redis or Supabase Edge at scale" 명시

### Idempotency

- Reactions 테이블 `UNIQUE (room_id, track_ref, actor_kind, coalesce(visitor_id, user_id), emoji)`로 DB 레벨 보장
- 서비스 레이어는 `INSERT ... ON CONFLICT DO NOTHING RETURNING *`; 반환 행이 비면 기존 행을 SELECT하여 200으로 반환

### Provider Mismatch Guard (REQ-SOC-003)

- `track_suggestions.source_provider`는 클라이언트가 보내지 않음. 서버가 `rooms.source_provider`를 읽어 **유도**한다.
- 검색 API가 이미 provider-specific이므로, 실제 악용 경로는 클라이언트가 임의 externalTrackId를 직접 POST하는 경우. 기본 검증은 길이/형식 정도만 수행하고, 불일치 검출은 "provider의 해당 id가 실제로 존재하는가"를 별도 provider fetch로 확인하는 대신, **suggestion 제출 시에도 provider-specific lookup 1회**를 수행해 metadata를 서버가 재확인한다. 이는 REQ-SOC-003의 400 조건이 된다.

### Approved Suggestion Rendering

- `room_extra_tracks`는 `(room_id, suggestion_id, position)` 로 정렬되며, RoomCarousel에는 원본 playlist 뒤에 append되어 "추천" 배지로 표시된다.
- 외부 API write는 절대 수행하지 않음 — DoD grep 체크로 강제.

## Risk Analysis

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|------------|
| R1 | Next.js 16 Server Component에서 쿠키 set 불가 | High | Medium | middleware.ts 도입 또는 `/api/visitor/init` 부트스트랩. DDD phase에서 결정 |
| R2 | In-memory rate limiter가 서버리스 환경에서 리셋 | High | Low (MVP 한정) | `@MX:NOTE` 문서화, 프로덕션 스케일 이전에 Redis로 교체 |
| R3 | HMAC key(`AUTH_SECRET`) 교체 시 모든 방문자 쿠키 무효화 | Low | Medium | 의도된 동작 — 세션 무효화와 동일한 성격. 롤오버 시에는 old/new key dual-verify 기간 도입 고려 |
| R4 | Provider-specific 검색 결과의 durationSec 누락 (YouTube `/search`는 duration 제공 안 함) | High | Medium | YouTube는 `/search` 후 `/videos?part=contentDetails`로 duration 보강; 캐시 고려 |
| R5 | 방문자가 쿠키 차단 브라우저 사용 | Medium | Low | 리액션 UI에 "쿠키 허용 필요" 안내. 기능 없이도 재생은 정상 |
| R6 | 소유자가 대량 pending을 가진 채 방치 → UX 저하 | Medium | Low | Home 페이지 배지(T8) + 향후 알림 SPEC (Exclusions에 명시) |
| R7 | suggestion PATCH CSRF | Medium | High | NextAuth 세션 쿠키는 SameSite=Lax이지만 mutation은 POST/PATCH이고 동일 origin 검증 강화 필요. `@MX:WARN @MX:REASON=csrf-surface` 태그 |
| R8 | 동일 user가 다른 방에서 같은 externalTrackId 중복 제안 | Low | Low | `UNIQUE (room_id, suggested_by, external_track_id)`로 DB 레벨 차단 |

## Environment Variables

**새로 추가되는 env 없음** — `AUTH_SECRET` (NextAuth용 기존), `SUPABASE_SERVICE_ROLE_KEY` (기존), `YOUTUBE_API_KEY` (기존 fallback)만 재사용.

## Schema Migration (새 파일)

파일: `supabase/migrations/20260422_social_layer.sql`

```sql
-- Visitors: anonymous cookie-signed identity
create table public.visitors (
  id          uuid primary key,
  created_at  timestamptz not null default now(),
  last_seen   timestamptz not null default now()
);

-- Track reactions
create table public.track_reactions (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid not null references public.rooms(id) on delete cascade,
  track_ref    text not null,
  actor_kind   text not null check (actor_kind in ('visitor','user')),
  visitor_id   uuid references public.visitors(id) on delete cascade,
  user_id      uuid references public.users(id)    on delete cascade,
  emoji        text not null,
  created_at   timestamptz not null default now(),
  check (
    (actor_kind = 'visitor' and visitor_id is not null and user_id is null)
    or
    (actor_kind = 'user'    and user_id    is not null and visitor_id is null)
  ),
  unique (
    room_id, track_ref, actor_kind,
    coalesce(visitor_id::text, user_id::text),
    emoji
  )
);
create index track_reactions_room_track_idx
  on public.track_reactions (room_id, track_ref);

-- Track suggestions (auth-required queue)
create table public.track_suggestions (
  id                   uuid primary key default gen_random_uuid(),
  room_id              uuid not null references public.rooms(id) on delete cascade,
  suggested_by         uuid not null references public.users(id) on delete cascade,
  source_provider      text not null check (source_provider in ('youtube','spotify')),
  external_track_id    text not null,
  title                text not null,
  artist               text not null,
  thumbnail_url        text,
  duration_sec         int,
  status               text not null default 'pending'
                         check (status in ('pending','approved','rejected')),
  created_at           timestamptz not null default now(),
  resolved_at          timestamptz,
  unique (room_id, suggested_by, external_track_id)
);
create index track_suggestions_room_status_idx
  on public.track_suggestions (room_id, status);

-- Room extra tracks (approved suggestions, room-scoped only)
create table public.room_extra_tracks (
  id              uuid primary key default gen_random_uuid(),
  room_id         uuid not null references public.rooms(id) on delete cascade,
  suggestion_id   uuid not null references public.track_suggestions(id) on delete cascade,
  position        int not null,
  created_at      timestamptz not null default now(),
  unique (room_id, suggestion_id),
  unique (room_id, position)
);

-- RLS: service-role-only initial access (mirrors Phase 1)
alter table public.visitors          enable row level security;
alter table public.track_reactions   enable row level security;
alter table public.track_suggestions enable row level security;
alter table public.room_extra_tracks enable row level security;
```

**Schema churn 없음** — 기존 테이블 변경 0건.

## Files to Create / Modify

### New

- `supabase/migrations/20260422_social_layer.sql`
- `src/lib/visitor/cookie.ts` (`issueVisitorCookie`, `verifyVisitorCookie`)
- `src/lib/reactions/service.ts` + `src/lib/reactions/__tests__/service.test.ts`
- `src/lib/suggestions/service.ts` + `src/lib/suggestions/__tests__/service.test.ts`
- `src/lib/search/youtube-search.ts` + tests
- `src/lib/search/spotify-search.ts` + tests
- `src/app/api/rooms/[id]/reactions/route.ts` (POST + GET + DELETE) + `__tests__`
- `src/app/api/rooms/[id]/suggestions/route.ts` (POST + GET) + `__tests__`
- `src/app/api/rooms/[id]/suggestions/[sid]/route.ts` (PATCH) + `__tests__`
- `src/app/api/rooms/[id]/search/route.ts` (GET) + `__tests__`
- `src/app/[handle]/[slug]/ReactionPicker.tsx`
- `src/app/[handle]/[slug]/SuggestTrackButton.tsx`
- `src/app/[handle]/[slug]/OwnerSuggestionQueue.tsx`
- `src/app/[handle]/[slug]/SearchTrackModal.tsx`
- `src/data/reactions.ts` (EMOJI_SET + types)
- `src/__tests__/visitor-cookie.test.ts`

### Modify

- `src/app/[handle]/[slug]/page.tsx` — 방문자 쿠키 부트스트랩(R1 결정에 따라 middleware 또는 init route 호출), 서버 측에서 reactions + approved extra tracks 로드 후 RoomCarousel에 props 전달.
- `src/app/[handle]/[slug]/RoomCarousel.tsx` — `extraTracks` prop 수용(원본 뒤 append + "추천" 배지), `reactions` map 수용(트랙별 카운트 + 현재 actor의 토글 상태), ReactionPicker 마운트.
- `src/app/home/page.tsx` — 소유한 방별 pending suggestions count 배지.

### Reference Implementations (읽기만, 수정 금지)

- HMAC 서명: `src/lib/spotify/oauth.ts` (`signState`, `verifyState`)
- Service-role query 패턴: `src/lib/supabase/admin.ts`, `src/app/api/me/rooms/route.ts`
- NextAuth session guard: `src/app/api/auth/spotify/connect/route.ts`
- Spotify fetch helper: `src/lib/spotify/client.ts` (`spotifyFetch`)
- YouTube auth 선택 로직: `src/app/[handle]/[slug]/page.tsx` (`loadRoomAndPlaylist`)

## MX Tag Plan

- `@MX:ANCHOR` on `src/lib/visitor/cookie.ts#issueVisitorCookie` — fan_in ≥ 2 (room page, reaction/suggestion routes)
- `@MX:ANCHOR` on `src/lib/reactions/service.ts#upsertReaction` — fan_in ≥ 2 (route + UI-side server action)
- `@MX:WARN @MX:REASON=csrf-surface` on `PATCH /api/rooms/[id]/suggestions/[sid]` handler
- `@MX:WARN @MX:REASON=idempotency-and-rate-limit` on `POST /api/rooms/[id]/reactions` handler
- `@MX:NOTE` on rate-limit in-memory `Map` (MVP only — replace at scale)
- `@MX:NOTE` on YouTube search duration backfill (`/videos?part=contentDetails` round-trip)
