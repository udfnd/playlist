---
spec: SPEC-SPOTIFY-001
version: 1.0.0
created: 2026-04-21
---

# Implementation Plan — SPEC-SPOTIFY-001

## Scope Confirmation

- 스키마 변경 없음. 확인 방법: `grep -n source_provider supabase/migrations/20260420_init_foundation.sql` 및 `grep -n "provider check" supabase/migrations/20260420_init_foundation.sql`에서 `('youtube','spotify')`, `('google','spotify')` 체크 제약이 이미 존재해야 한다.
- NextAuth `src/auth.ts`의 providers 배열에는 Spotify를 추가하지 **않는다**. Spotify 연결은 커스텀 OAuth 라우트가 직접 `music_connections`에 기록한다.

## New Environment Variables

`.env.local`(로컬) 및 배포 플랫폼 시크릿에 다음 3개 추가:

- `SPOTIFY_CLIENT_ID` — Spotify Developer Dashboard 앱의 Client ID
- `SPOTIFY_CLIENT_SECRET` — 서버 전용 시크릿
- `SPOTIFY_REDIRECT_URI` — 예: `https://onrepeat.cc/api/auth/spotify/callback` (로컬에서는 `http://127.0.0.1:3000/api/auth/spotify/callback`)

Spotify Developer Dashboard에서 동일한 redirect URI를 화이트리스트에 등록해야 한다.

## Milestones (Priority-Based)

### Priority High (필수, 순서대로)

**M1. OAuth 모듈 & 클라이언트 라이브러리**
- 파일 생성:
  - `src/lib/spotify/oauth.ts` — authorize URL builder, authorization code ↔ token 교환, refresh token 갱신, state 서명/검증 유틸
  - `src/lib/spotify/client.ts` — `music_connections`에서 토큰을 읽고, 만료 시 자동 갱신 후 재시도하는 공용 `spotifyFetch(userId, path, init)` 헬퍼
  - `src/lib/spotify/fetch-playlist.ts` — Spotify 플레이리스트 메타데이터 + 트랙 목록을 조회하여 `Playlist` (from `src/data/types.ts`)로 정규화
- 의존 참고:
  - `src/auth.ts` — `syncUserAndConnection` upsert 패턴을 Spotify 버전으로 복제
  - `src/lib/youtube/fetch-playlist.ts` — 정규화 매핑 규약

**M2. OAuth 엔드포인트**
- `src/app/api/auth/spotify/connect/route.ts` (GET) — 현재 세션 확인 → state 쿠키 세팅 → Spotify authorize URL로 302
- `src/app/api/auth/spotify/callback/route.ts` (GET) — state 검증, code → token 교환, `music_connections` upsert, `/home` 또는 returnTo URL로 리다이렉트
- `src/app/api/auth/spotify/disconnect/route.ts` (POST) — 현재 사용자의 `music_connections` 행 삭제 (MVP에 포함)

**M3. 사용자 플레이리스트 API 라우트**
- `src/app/api/me/spotify/playlists/route.ts` — `src/app/api/my-playlists/route.ts` 미러. `spotifyFetch`로 `/me/playlists` 호출 후 YouTube 응답과 동일한 스키마로 매핑
- `src/app/api/spotify/playlist/route.ts` — `src/app/api/playlist/route.ts` 미러. `?list=` 파라미터로 ID 또는 URL 수용, `fetchSpotifyPlaylist` 호출

**M4. 위자드 UI 수정**
- `src/app/home/new/NewRoomWizard.tsx`
  - 소스 토글 추가 (YouTube | Spotify)
  - Spotify 선택 시: 연결 여부 조회 → 미연결 시 "Connect Spotify" CTA(`/api/auth/spotify/connect?returnTo=...`로 이동) 노출, 연결 시 플레이리스트 선택 UI 렌더
  - 미연결 상태에서는 publish 버튼 비활성화
  - `POST /api/me/rooms` 호출 시 `sourceProvider: 'spotify'` 전달 (API는 이미 수용)

**M5. 방 페이지 분기**
- `src/app/[handle]/[slug]/page.tsx` `loadRoomAndPlaylist`에 `room.source_provider` 분기 추가:
  - `youtube` → 기존 `fetchYouTubePlaylist`
  - `spotify` → `fetchSpotifyPlaylist(room.owner_user_id, room.source_playlist_id)`
- 토큰 갱신 실패 시 `{ reason: 'unavailable' }` 반환 (기존 YouTube의 unavailable UX 재사용)

**M6. RoomCarousel 재생 소스 분기**
- `src/app/[handle]/[slug]/RoomCarousel.tsx`에 `playbackProvider: 'youtube' | 'spotify'` prop 추가
- Spotify일 때 트랙 카드의 재생 영역을 `<iframe src="https://open.spotify.com/embed/track/{id}" />`로 스위치 (크기·스타일 디테일은 디자이너/구현자 재량)

**M7. /home 연결 상태 노출**
- `src/app/home/page.tsx` — Spotify 연결 상태 뱃지(Connected/Not connected) + Connect/Reconnect/Disconnect 버튼 렌더

### Priority Medium (권장, M1~M7 완료 후)

**M8. E2E 회귀 테스트**
- Connect → 위자드 Spotify 탭 → 방 생성 → 공개 URL 방문 시나리오
- 토큰 만료 → 자동 갱신 성공 경로
- refresh token 무효화 → unavailable UX

### Priority Low (선택)

- Disconnect 후 남아있는 Spotify 소스 방에 대한 소유자 알림 배너

## Technical Approach

### OAuth 플로우 (Authorization Code, server-side secret)

1. `GET /api/auth/spotify/connect`:
   - 현재 NextAuth 세션 확인(미인증이면 `/auth/signin`으로 리다이렉트)
   - 랜덤 `state` 생성 → HMAC 서명 → httpOnly, SameSite=Lax, `__Host-spotify_oauth_state` 쿠키 저장(5분 TTL)
   - `https://accounts.spotify.com/authorize` 쿼리: `response_type=code`, `client_id`, `redirect_uri`, `scope=playlist-read-private playlist-read-collaborative user-read-email`, `state`, `show_dialog=true`(재연결 시에만)
2. `GET /api/auth/spotify/callback`:
   - state 쿠키 값과 쿼리 state 일치 확인, 불일치 시 400
   - `code` → `POST https://accounts.spotify.com/api/token` (grant_type=authorization_code, Basic auth with client_id:client_secret)
   - 응답의 `access_token`, `refresh_token`, `expires_in`, `scope`로 `music_connections` upsert (keyed on `(user_id, provider='spotify')`)
   - `returnTo`가 있으면 그곳, 없으면 `/home`으로 리다이렉트

### 토큰 자동 갱신 (`spotifyFetch`)

- `music_connections` 행 조회 → `expires_at` 여유(예: 60초) 이내면 refresh token으로 갱신 → 행 업데이트 후 요청 수행
- 갱신 응답이 `invalid_grant`면 `refresh_token`을 null 처리(혹은 행 보존 + 플래그)하여 REQ-SPOT-005 UX 트리거

### Playlist 정규화

Spotify `GET /playlists/{id}` → `Playlist` 매핑:

- `id` → `playlistId`
- `name` → `title`
- `owner.display_name` → `channelTitle` (또는 별도 필드)
- `images[0].url` → `thumbnailUrl`
- `tracks.items[].track` → `Track[]`: `id`, `title=name`, `artist=artists.map(a=>a.name).join(', ')`, `thumbnailUrl=album.images[0].url`, `durationMs=duration_ms`, `externalUrl=external_urls.spotify`
- 트랙이 100개 초과 시 `next` 페이지네이션 따라 루프

## Risk Analysis

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Refresh token 외부 취소(사용자가 Spotify 계정에서 앱 revoke) | Medium | Medium | REQ-SPOT-005대로 unavailable UX + `/home` 재연결 CTA |
| Spotify API rate limit(429) | Medium | Medium | `Retry-After` 헤더 존중, 플레이리스트 메타데이터 short-cache(예: 30초 in-memory or Supabase edge cache) |
| 토큰 자동 갱신 경쟁 조건(동시 요청) | Low | Medium | 갱신 구간에 per-user mutex(예: in-process Map<userId, Promise>) 사용. `@MX:WARN @MX:REASON=race-condition` 태그로 표시 |
| Embed iframe CORS/CSP | Low | Low | `next.config.js`의 CSP `frame-src` allowlist에 `https://open.spotify.com` 추가 |
| OAuth state CSRF | Low | High | httpOnly SameSite=Lax + HMAC 서명 쿠키, 5분 TTL, 1회 사용 후 삭제 |
| Spotify 플레이리스트가 100+ 트랙인 경우 페이지네이션 누락 | Medium | Low | `fetchSpotifyPlaylist`에서 `next` 루프 필수 구현, 단위 테스트로 검증 |
| 로컬 개발 HTTPS redirect URI 미스매치 | High | Low | README에 `http://127.0.0.1:3000/...` redirect 등록 절차 명시 |
| `user-read-email` 스코프 PII 저장 | Low | Medium | email은 저장하지 않거나 해시만 저장(이미 Google로 확보됨) |

## MX Tag Plan

- `src/lib/spotify/fetch-playlist.ts`의 정규화 헬퍼(`mapSpotifyTrack`, `fetchSpotifyPlaylist`): 방 페이지/위자드/API 3곳 이상에서 호출 예정 → `@MX:ANCHOR`
- `src/lib/spotify/client.ts`의 `refreshAccessToken` / `spotifyFetch`: 동시성·외부 종속 호출 → `@MX:WARN @MX:REASON=race-condition-and-external-dependency`
- `src/app/api/auth/spotify/callback/route.ts`: state 검증 로직 → `@MX:WARN @MX:REASON=csrf-surface`
- 초기 구현 시 테스트가 부족한 공용 함수 → `@MX:TODO`

## Environment Variables Checklist

- [ ] `SPOTIFY_CLIENT_ID` — 로컬 `.env.local`, 프로덕션 시크릿
- [ ] `SPOTIFY_CLIENT_SECRET` — 서버 전용, 클라이언트 번들 유출 금지
- [ ] `SPOTIFY_REDIRECT_URI` — 환경별 값, Spotify Dashboard에 동일하게 등록
- [ ] Next.js CSP `frame-src` 에 `https://open.spotify.com` 추가
- [ ] 로컬 개발용 `http://127.0.0.1:3000/api/auth/spotify/callback` Dashboard 등록

## Reference Implementations (Cite Specific Files)

- NextAuth `syncUserAndConnection` upsert 패턴 → `src/auth.ts` (callbacks.signIn / jwt 근처)
- YouTube 플레이리스트 리졸버 흐름 → `src/app/api/playlist/route.ts`
- YouTube 정규화 결과 형태 → `src/lib/youtube/fetch-playlist.ts` 반환 타입과 동일한 `Playlist` (`src/data/types.ts`)
- 사용자 플레이리스트 API 패턴(세션 + provider 토큰 사용) → `src/app/api/my-playlists/route.ts`
- 위자드 기존 구조 → `src/app/home/new/NewRoomWizard.tsx`
- 방 생성 API가 이미 `sourceProvider`를 수용함 → `src/app/api/me/rooms/route.ts`
- 방 페이지 `loadRoomAndPlaylist` 분기 지점 → `src/app/[handle]/[slug]/page.tsx`
- 스키마 제약 확인 → `supabase/migrations/20260420_init_foundation.sql`

## Task Decomposition Summary

1. OAuth 모듈(`oauth.ts`) → 2. client 헬퍼(`client.ts`) → 3. `fetch-playlist.ts` → 4. API 라우트 3종(connect/callback/disconnect) → 5. 사용자 플레이리스트 & public 플레이리스트 라우트 → 6. 위자드 UI → 7. 방 페이지 분기 → 8. RoomCarousel embed 분기 → 9. `/home` 연결 상태 → 10. E2E 회귀.
