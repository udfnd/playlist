---
spec: SPEC-SPOTIFY-001
version: 1.0.0
status: draft
priority: High
---

# SPEC-SPOTIFY-001 (Compact)

Spotify를 두 번째 플레이리스트 소스로 추가. 로그인은 Google 유지, Spotify는 `music_connections.provider='spotify'` 보조 연결. 재생은 Spotify Embed iframe. 스키마 변경 없음.

## Requirements (EARS)

- **REQ-SPOT-001** (Event): WHEN "Connect Spotify" 클릭 → Spotify authorize 리다이렉트(scopes: `playlist-read-private playlist-read-collaborative user-read-email`) + state 서명 쿠키; 콜백 시 `music_connections` upsert.
- **REQ-SPOT-002** (State): WHILE 유효한 Spotify 연결 보유 → `GET /api/me/spotify/playlists`가 사용자의 private/collaborative/public 플레이리스트 반환(만료 시 자동 refresh).
- **REQ-SPOT-003** (Event): WHEN `POST /api/me/rooms` with `sourceProvider='spotify'` → 저장 전에 토큰으로 플레이리스트 접근 가능성 검증.
- **REQ-SPOT-004** (Ubiquitous): `/{handle}/{slug}`는 `source_provider='spotify'`일 때 `fetchSpotifyPlaylist` 사용 + `RoomCarousel` 3D + Spotify Embed iframe 재생.
- **REQ-SPOT-005** (Unwanted): IF refresh token 거부/부재 → 방 페이지 `unavailable` 렌더 + 소유자에게 `/home`에서 재연결 안내. 행 자동 삭제 금지.

## Acceptance (요약)

1. Connect Spotify → `music_connections(provider='spotify')` 행 생성.
2. 위자드 Spotify 탭 → 본인 플레이리스트 선택 → 방 생성 `source_provider='spotify'`.
3. 익명 방문자 → 토큰 자동 갱신 → 3D 캐러셀 + Spotify embed 정상 렌더, 클라이언트 번들에 토큰 미노출.
4. 외부에서 앱 권한 취소 → `invalid_grant` → unavailable UX + 소유자 Reconnect CTA, 행 삭제 없음.
5. Spotify 미연결 상태로 Spotify 탭 선택 → Connect CTA, Publish 버튼 비활성화.

Edge: E1 토큰 자동 갱신 · E2 잘못된 플레이리스트 · E3 429 Retry-After · E4 state 불일치 · E5 동시 refresh 디듀플리케이션.

## Files to Create

- `src/lib/spotify/oauth.ts`
- `src/lib/spotify/client.ts`
- `src/lib/spotify/fetch-playlist.ts`
- `src/app/api/auth/spotify/connect/route.ts`
- `src/app/api/auth/spotify/callback/route.ts`
- `src/app/api/auth/spotify/disconnect/route.ts`
- `src/app/api/me/spotify/playlists/route.ts`
- `src/app/api/spotify/playlist/route.ts`

## Files to Modify

- `src/app/home/new/NewRoomWizard.tsx` — 소스 토글 + Spotify 픽커 + Connect CTA
- `src/app/[handle]/[slug]/page.tsx` — `loadRoomAndPlaylist` provider 분기
- `src/app/[handle]/[slug]/RoomCarousel.tsx` — `playbackProvider` prop, Spotify embed 렌더
- `src/app/home/page.tsx` — Spotify 연결 상태 + Connect/Reconnect/Disconnect
- Next.js CSP `frame-src` — `https://open.spotify.com` 추가
- `.env.example` — `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REDIRECT_URI`

## Not Modified

- `src/auth.ts` providers 배열 (Spotify는 NextAuth provider가 아님)
- `src/app/api/me/rooms/route.ts` (이미 `sourceProvider` 수용)
- `supabase/migrations/*` (스키마가 이미 `'spotify'` 허용)

## Exclusions (What NOT to Build)

- Spotify Web Playback SDK (풀-트랙 재생, Premium) — 별도 SPEC
- 방문자 리액션 / 서비스 간 곡 추천 — Phase 2 SPEC
- YouTube Music API 연동
- 플레이리스트 서비스 간 변환/복제
- Spotify를 1차 로그인 수단으로 사용
- `rooms` 또는 `music_connections` 스키마 변경
- `user-read-playback-state`, `streaming` 스코프
- Spotify 토큰을 클라이언트 세션/번들에 노출
