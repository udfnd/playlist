---
id: SPEC-AUTH-001
version: 0.1.0
status: backlog
created: 2026-04-22
updated: 2026-04-22
author: MoAI orchestrator
priority: Medium
issue_number: 0
---

# SPEC-AUTH-001: Spotify를 1차 로그인 수단으로 승격

## HISTORY

- 2026-04-22 / v0.1.0 / 초안 — 랜딩의 "Start with Spotify" CTA가 현재는 Google OAuth로 라우팅됨. 사용자 요청에 따라 실제 Spotify-as-primary-login을 지원하도록 백엔드 구조 변경 예정.

## Context

현재(2026-04-22 기준) `onrepeat.cc`는 Google을 유일한 1차 로그인 수단으로 사용한다. 이 결정은 SPEC-SPOTIFY-001의 Exclusions에 다음과 같이 명시되었다:

> "Spotify를 1차 로그인 수단으로 사용하는 것 — Spotify는 항상 Google 로그인 위의 부가 연결이다. NextAuth에 두 번째 provider를 추가하지 않는다."

랜딩 페이지 리디자인 이후 "Start with Spotify" 버튼이 UI에 등장하지만, 실제 클릭 시 Google OAuth로 이동한다(option C). 본 SPEC은 그 격차를 메운다 — Spotify 계정만으로도 신규 사용자가 가입·로그인할 수 있게 하는 것이 목표.

## Overview

NextAuth v5의 다중 provider 구성을 활성화하여 Spotify를 Google과 동등한 1차 로그인 수단으로 승격한다. 기존 `users` 테이블 스키마는 `google_id NOT NULL UNIQUE`로 강결합되어 있으므로 **스키마 변경이 필요**하다.

## Requirements (EARS)

### REQ-AUTH-001 (Event-driven) — Spotify로 신규 가입

**WHEN** an anonymous visitor clicks "Start with Spotify" on the landing page, the system **SHALL** redirect to Spotify Authorize URL with scopes `playlist-read-private playlist-read-collaborative user-read-email` and, on successful callback, **SHALL** upsert a `users` row keyed on `spotify_id` (creating a new identity if none exists) and **SHALL** sign the user into a NextAuth session.

### REQ-AUTH-002 (Event-driven) — Google로 신규 가입 (회귀 방지)

**WHEN** a visitor clicks "Start with Google", the system **SHALL** continue to behave exactly as it does today: OAuth with YouTube-readonly scope, `users` upsert on `google_id`, NextAuth session created. No regression from SPEC-SPOTIFY-001 Exclusions beyond the explicit scope of this SPEC.

### REQ-AUTH-003 (State-driven) — 다중 provider 계정 병합

**WHILE** a user is authenticated via one provider (e.g. Google) and navigates to `/home`, the system **SHALL** expose a "Connect Spotify" action that links the current `users` row to their Spotify account (existing SPEC-SPOTIFY-001 flow). **IF** a separate `users` row already exists for that Spotify account, **THEN** the system **SHALL** present a merge/choose-primary prompt (manual resolution), **SHALL NOT** silently merge.

### REQ-AUTH-004 (Unwanted behavior) — 스키마 호환성

**IF** any existing `users` row has `google_id = NULL`, **THEN** the system **SHALL** fail the migration with a clear error. All pre-existing accounts today have `google_id` populated, so the migration must assert this invariant before making the column nullable.

### REQ-AUTH-005 (Event-driven) — 핸들 선택 일관성

**WHEN** a new user signs in via Spotify for the first time, the system **SHALL** present the same one-time HandlePickerModal currently used after Google sign-in. Handle rules (uniqueness, charset) remain identical.

## Exclusions (What NOT to Build)

- **자동 계정 병합** — 한 사람이 Google과 Spotify로 별도 가입한 경우 자동 통합은 하지 않는다. 사용자 명시적 결정 필요(`REQ-AUTH-003`).
- **Apple / Facebook / Twitter 등 추가 provider** — 본 SPEC은 Spotify만 승격한다.
- **Passwordless email / magic link** — 별도 SPEC 후보. 이메일 인프라(발송/수신) 필요.
- **기존 `music_connections` 테이블 구조 변경** — 연결 토큰 저장은 현 구조 유지. `users.spotify_id`는 **identity 기반**, `music_connections`는 **API 호출용 토큰**으로 역할 분리 유지.
- **Spotify OAuth scope 확장** — 현재 SPEC-SPOTIFY-001의 3개 scope(`playlist-read-private`, `playlist-read-collaborative`, `user-read-email`)만 사용. 재생(SDK) scope는 별도.
- **Team accounts / 조직 계정** — 개인 계정만 지원.

## Scope Notes

### 스키마 변경 계획 (새 마이그레이션)

```sql
-- 새 파일: supabase/migrations/YYYYMMDD_auth_spotify_primary.sql

-- 0. Invariant check: no existing user should have NULL google_id
do $$
begin
  if exists (select 1 from public.users where google_id is null) then
    raise exception 'Pre-existing users with NULL google_id found; aborting';
  end if;
end $$;

-- 1. Allow google_id nullable
alter table public.users alter column google_id drop not null;

-- 2. Add spotify_id column (nullable, unique)
alter table public.users add column spotify_id text unique;
create index users_spotify_id_idx on public.users (spotify_id) where spotify_id is not null;

-- 3. Assert at least one identity must be present
alter table public.users add constraint users_has_identity
  check (google_id is not null or spotify_id is not null);
```

### NextAuth v5 provider 추가

```ts
// src/auth.ts
import Spotify from 'next-auth/providers/spotify';

providers: [
  Google({ /* 기존 설정 유지 */ }),
  Spotify({
    clientId: process.env.SPOTIFY_CLIENT_ID!,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET!,
    authorization: {
      params: {
        scope: 'playlist-read-private playlist-read-collaborative user-read-email',
      },
    },
  }),
]
```

### `syncUserAndConnection` 확장

`src/auth.ts`의 upsert 로직이 **provider별 분기**를 수행해야 한다:
- `account.provider === 'google'`: `upsert onConflict: 'google_id'`
- `account.provider === 'spotify'`: `upsert onConflict: 'spotify_id'` + `music_connections` row 생성

### UI 변경

- `src/components/ui/Landing.tsx` "Start with Spotify" 버튼의 `onClick`을 새로운 `onSpotifySignIn` prop으로 전환
- `src/app/page.tsx`에서 `signIn('spotify')` 호출 핸들러 추가
- Handle picker 모달은 provider 무관하게 동일 동작

## Open Questions

1. 같은 이메일로 Google/Spotify 모두 가입한 경우 힌트로 병합 제안할 것인가? → REQ-AUTH-003 manual merge prompt에 이메일 매칭 힌트 추가 고려.
2. Spotify 계정 가입 시점에 YouTube fallback(공개 플레이리스트 조회용 API key) 접근은 어떻게? → 유지. `rooms.source_provider='youtube'`로 발행하려면 본인 소유 YouTube 플레이리스트가 아니어도 URL 붙여넣기 + 공개 플레이리스트는 가능.
3. Existing SPEC-SPOTIFY-001 Exclusions 문서 갱신? → 본 SPEC 완료 시 SPEC-SPOTIFY-001 HISTORY에 supersedes 기록.

## Related References

- `src/auth.ts` — 현재 Google provider 설정 + `syncUserAndConnection`
- `supabase/migrations/20260420_init_foundation.sql` — 현재 `users` 스키마
- `src/components/ui/Landing.tsx` — "Start with Spotify" UI (현재 Google로 라우팅)
- SPEC-SPOTIFY-001 — Spotify를 secondary connection으로 제한한 선행 SPEC

## Rough Plan (상세는 `/moai plan` 시 manager-spec이 확정)

1. Migration + invariant check
2. NextAuth config 확장 (Google + Spotify)
3. `syncUserAndConnection` provider 분기
4. `session` 타입 확장 (`spotifyId?`, `primaryProvider: 'google' | 'spotify'`)
5. Landing 버튼 분기 (`signIn('google')` / `signIn('spotify')`)
6. Handle picker 무결성 테스트
7. 수동 계정 병합 UX (REQ-AUTH-003) — 최소 MVP는 "이미 다른 provider로 가입된 이메일입니다" 에러 메시지

## Estimated Complexity

Medium. 핵심 리스크는 다중 provider 식별 병합 UX이며, 데이터 모델 변경은 단일 마이그레이션으로 끝난다.
