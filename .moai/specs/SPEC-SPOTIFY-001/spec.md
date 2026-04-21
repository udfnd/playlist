---
id: SPEC-SPOTIFY-001
version: 1.0.0
status: draft
created: 2026-04-21
updated: 2026-04-21
author: manager-spec
priority: High
issue_number: 0
---

# SPEC-SPOTIFY-001: Spotify를 플레이리스트 소스로 추가

## HISTORY

- 2026-04-21: 초안 작성 (manager-spec). 내부 페이즈 닉네임은 `F4-Spotify-Source`이며, SPEC ID는 MoAI `DOMAIN-NNN` 컨벤션에 맞춰 `SPEC-SPOTIFY-001`로 명명함. 기존 YouTube 흐름을 미러링하여 Spotify를 **보조 연결(secondary connection)** 방식으로 추가.

## Overview

onrepeat.cc는 현재 Google 로그인을 1차 인증으로, YouTube 플레이리스트를 유일한 소스로 사용한다. 본 SPEC은 **Spotify를 두 번째 플레이리스트 소스로 추가**하되, 로그인 수단은 기존 Google/NextAuth 세션을 그대로 유지하고 Spotify는 별도의 OAuth 연결(`music_connections.provider='spotify'`)로만 취급한다.

핵심 디자인 원칙:

1. **로그인은 Google 단일화**: Spotify는 NextAuth 2차 provider가 아니라, 로그인 완료 후 사용자가 명시적으로 "Connect Spotify"를 눌러 연결하는 부가 기능이다.
2. **서버 사이드 토큰 관리**: Spotify access/refresh token은 `music_connections` 테이블에만 저장되며, 클라이언트 세션(`session.accessToken`)에는 절대 노출되지 않는다. 모든 Spotify API 호출은 서버에서 수행된다.
3. **YouTube 흐름 미러링**: 기존 `/api/playlist`, `/api/my-playlists`, `src/lib/youtube/fetch-playlist.ts`, 위자드, 방 페이지 구조를 그대로 복제하여 Spotify 경로를 만든다. `Playlist` 타입(`src/data/types.ts`)은 두 소스가 공유한다.
4. **재생은 Spotify Embed iframe**: 본 SPEC 범위에서는 Web Playback SDK를 도입하지 않고, `https://open.spotify.com/embed/track/{id}` 임베드로 재생 UI를 제공한다. 풀-트랙 SDK 재생은 별도 SPEC으로 분리된다.
5. **스키마 변경 없음**: `supabase/migrations/20260420_init_foundation.sql`의 `music_connections.provider check ('google','spotify')` 및 `rooms.source_provider check ('youtube','spotify')`가 이미 Spotify를 수용한다.

## EARS Requirements

### REQ-SPOT-001 (Event-driven): Spotify OAuth 연결

**WHEN** 인증된 사용자가 `/home` 또는 위자드에서 "Connect Spotify" 버튼을 클릭하면, 시스템은 `SPOTIFY_CLIENT_ID`, `SPOTIFY_REDIRECT_URI`, 그리고 스코프 `playlist-read-private playlist-read-collaborative user-read-email`을 포함한 Spotify Authorize URL로 리다이렉트**한다(shall)**. CSRF 방지를 위해 state 파라미터는 짧은 수명의 서명된 쿠키에 보관**한다(shall)**. 콜백 수신 시 시스템은 Authorization Code를 토큰으로 교환하고, 현재 세션의 `user_id`를 키로 `music_connections` 테이블에 `provider='spotify'`, `access_token`, `refresh_token`, `expires_at`, `scope` 값을 upsert**한다(shall)**.

### REQ-SPOT-002 (State-driven): 사용자의 Spotify 플레이리스트 조회

**WHILE** 사용자가 유효한 `music_connections` 행(`provider='spotify'`)을 보유한 상태에서, 시스템은 `GET /api/me/spotify/playlists` 엔드포인트를 통해 해당 사용자의 비공개·협업·공개 플레이리스트 목록을 반환**한다(shall)**. 반환 필드는 최소한 `id`, `title`, `thumbnailUrl`, `itemCount`, `privacy`를 포함**한다(shall)**. 액세스 토큰이 만료된 경우 요청 처리 중에 refresh token으로 자동 갱신**한다(shall)**.

### REQ-SPOT-003 (Event-driven): Spotify 소스로 방 생성 검증

**WHEN** 사용자가 `POST /api/me/rooms` 요청에 `sourceProvider='spotify'`와 Spotify 플레이리스트 ID(또는 URL)를 담아 제출하면, 시스템은 저장된 Spotify 토큰(필요 시 자동 갱신)으로 해당 플레이리스트가 접근 가능한지 검증**한 후에만(shall)** 방 레코드를 저장**한다(shall)**. 검증 실패 시 방을 생성하지 않고 에러를 반환**한다(shall)**.

### REQ-SPOT-004 (Ubiquitous): Spotify 소스 방 렌더링

`/{handle}/{slug}` 경로의 방 페이지는 `room.source_provider='spotify'`인 경우 Spotify 소스로 플레이리스트를 로드하고, 기존 `RoomCarousel`의 3D 비주얼라이제이션을 유지하면서 각 트랙의 재생을 Spotify Embed iframe(`https://open.spotify.com/embed/track/{trackId}`)으로 렌더링**한다(shall)**.

### REQ-SPOT-005 (Unwanted behavior): 토큰 만료·취소 시 UX

**IF** 방 소유자의 Spotify access token이 만료되었고 refresh token이 없거나 Spotify로부터 거부(revoked) 응답을 받는 경우, **THEN** 시스템은 방 페이지를 YouTube의 `reason: 'unavailable'`과 동일한 "unavailable" 상태로 렌더링**하고(shall)**, 소유자에게는 `/home`에서 Spotify를 재연결하라는 안내를 노출**한다(shall)**. 시스템은 `music_connections`의 유효하지 않은 자격증명을 기준으로 방을 삭제하지 **않는다(shall not)**.

## Exclusions (What NOT to Build)

- **Spotify Web Playback SDK (풀-트랙 재생, Premium 사용자 전용)** — 별도 SPEC에서 다룬다. 본 SPEC은 Embed iframe만 사용한다.
- **방문자 리액션 및 서비스 간 곡 추천 기능** — 이미 계획된 Phase 2 SPEC에서 처리한다.
- **YouTube Music 전용 API 연동** — 범위 외.
- **한 서비스의 플레이리스트를 다른 서비스로 변환/복제하는 기능** — 범위 외.
- **Spotify를 1차 로그인 수단으로 사용하는 것** — Spotify는 항상 Google 로그인 위의 부가 연결이다. NextAuth에 두 번째 provider를 추가하지 않는다.
- **`rooms` 또는 `music_connections` 테이블의 스키마 변경** — 기존 마이그레이션이 이미 Spotify를 수용하므로 신규 마이그레이션을 생성하지 않는다.
- **`user-read-playback-state`, `streaming` 등 재생 관련 스코프** — 본 SPEC의 스코프는 `playlist-read-private`, `playlist-read-collaborative`, `user-read-email`로 제한된다.
- **Spotify 토큰을 클라이언트 번들/세션 쿠키에 노출하는 구현** — 모든 토큰 접근은 서버 사이드에서만 이루어진다.

## Related References

- 기존 Google OAuth & `syncUserAndConnection` 패턴: `src/auth.ts`
- 공개 플레이리스트 리졸버: `src/app/api/playlist/route.ts`
- YouTube 서버 라이브러리: `src/lib/youtube/fetch-playlist.ts`
- 사용자 YouTube 플레이리스트: `src/app/api/my-playlists/route.ts`
- 공유 타입(`Playlist`, `Track`): `src/data/types.ts`
- 위자드: `src/app/home/new/NewRoomWizard.tsx`
- 방 생성 API: `src/app/api/me/rooms/route.ts`
- 방 페이지 & 캐러셀: `src/app/[handle]/[slug]/page.tsx`, `src/app/[handle]/[slug]/RoomCarousel.tsx`
- 스키마: `supabase/migrations/20260420_init_foundation.sql`
