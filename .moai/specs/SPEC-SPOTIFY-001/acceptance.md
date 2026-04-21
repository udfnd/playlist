---
spec: SPEC-SPOTIFY-001
version: 1.0.0
created: 2026-04-21
---

# Acceptance Criteria — SPEC-SPOTIFY-001

## Scenario 1: Spotify 연결 성공 (REQ-SPOT-001)

**Given** Google 세션으로 로그인된 사용자가 `/home`에 있고 `music_connections`에 `provider='spotify'` 행이 없을 때,
**When** 사용자가 "Connect Spotify" 버튼을 클릭해 Spotify authorize 페이지에서 권한을 승인하고 콜백으로 돌아오면,
**Then**
- `music_connections` 테이블에 `(user_id=<현재 사용자>, provider='spotify')` 행이 정확히 1건 존재하고,
- 해당 행의 `access_token`, `refresh_token`, `expires_at`, `scope`이 비어있지 않으며 `scope`에는 `playlist-read-private`, `playlist-read-collaborative`가 포함되어 있고,
- `/home` 화면에 Spotify 상태가 "Connected"로 표시되며 "Disconnect" 버튼이 노출된다.

## Scenario 2: 위자드에서 Spotify 소스로 방 생성 (REQ-SPOT-002, REQ-SPOT-003)

**Given** Spotify 연결이 완료된 사용자가 `/home/new` 위자드에 진입했을 때,
**When** 소스 토글을 Spotify로 전환하면 `GET /api/me/spotify/playlists` 응답으로 본인의 비공개·협업·공개 플레이리스트가 나열되고, 사용자가 특정 플레이리스트를 선택한 뒤 방 이름을 입력하고 "Publish"를 클릭하면,
**Then**
- `POST /api/me/rooms`는 `sourceProvider='spotify'`와 선택된 Spotify 플레이리스트 ID를 포함해 호출되고,
- 서버는 저장된 Spotify 토큰으로 해당 플레이리스트의 접근 가능성을 검증한 후에만 `rooms` 행을 생성하며,
- 생성된 행의 `source_provider='spotify'`, `source_playlist_id=<선택한 플레이리스트 ID>`가 저장되고,
- 사용자는 `/{handle}/{slug}` 공개 방 URL로 리다이렉트된다.

## Scenario 3: 익명 방문자가 공개 Spotify 방 열람 (REQ-SPOT-004)

**Given** `source_provider='spotify'`인 공개 방이 존재하고 소유자의 Spotify `access_token`이 만료 5분 이내일 때,
**When** 로그인하지 않은 방문자가 해당 방의 공개 URL `/{handle}/{slug}`을 열면,
**Then**
- 서버는 소유자의 refresh token으로 access token을 갱신하고 `music_connections`의 `access_token`, `expires_at`을 업데이트하며,
- 플레이리스트 데이터가 `Playlist` 타입으로 정규화되어 `RoomCarousel`에 전달되고,
- 3D 캐러셀이 정상 렌더되며 각 트랙의 재생 영역은 `https://open.spotify.com/embed/track/{id}` iframe으로 표시되고,
- 방문자 클라이언트 번들에는 Spotify `access_token`/`refresh_token` 문자열이 전혀 포함되어 있지 않다.

## Scenario 4: Refresh token 취소 시 unavailable UX (REQ-SPOT-005)

**Given** 소유자가 Spotify 계정 설정에서 onrepeat.cc 앱 권한을 revoke한 상태이고, `music_connections`의 `expires_at`이 과거인 Spotify 소스 방이 존재할 때,
**When** 방문자가 그 방의 URL을 열어 서버가 토큰 갱신을 시도하면,
**Then**
- Spotify 토큰 엔드포인트가 `invalid_grant`를 반환하고,
- `loadRoomAndPlaylist`는 `{ reason: 'unavailable' }`을 반환하며,
- 방 페이지는 기존 YouTube unavailable과 동일한 "이 방은 현재 이용할 수 없습니다" UI를 렌더하고,
- 소유자가 본인 세션으로 방을 열 경우 "Reconnect Spotify" 링크(`/home` 또는 `/api/auth/spotify/connect`)가 추가로 표시되며,
- `rooms` 또는 `music_connections` 행은 자동 삭제되지 않는다.

## Scenario 5: Spotify 미연결 상태에서의 위자드 가드

**Given** Spotify 연결이 없는 사용자가 `/home/new` 위자드에서 소스 토글을 Spotify로 전환했을 때,
**When** 사용자가 플레이리스트를 선택하지 않은 상태로 "Publish" 버튼 영역을 보면,
**Then**
- 플레이리스트 리스트 대신 "Connect Spotify to continue" CTA가 노출되고,
- "Publish" 버튼은 비활성화(disabled) 상태이며,
- CTA를 클릭하면 `/api/auth/spotify/connect?returnTo=/home/new`로 이동하고 OAuth 완료 후 위자드로 복귀한다.

## Edge Cases

### E1. 액세스 토큰 자동 갱신 성공

**Given** 유효한 refresh token과 만료된 access token을 가진 사용자의 API 요청이 들어올 때,
**When** `spotifyFetch`가 Spotify API를 호출하면,
**Then** 만료를 감지하여 refresh를 수행한 뒤 원래 요청을 재시도하고, `music_connections.expires_at`과 `access_token`이 갱신되며, 호출자는 단일 성공 응답을 받는다(재시도 흔적이 외부 응답에 노출되지 않음).

### E2. 유효하지 않은 Spotify 플레이리스트 URL/ID

**Given** 사용자가 위자드 또는 `/api/spotify/playlist?list=<잘못된값>`에 존재하지 않거나 권한이 없는 플레이리스트를 넘길 때,
**When** 서버가 Spotify API에서 404 또는 403을 받으면,
**Then** 방 생성을 거부하고 사용자 친화적인 에러 메시지("플레이리스트를 불러올 수 없습니다")를 반환하며, `rooms` 행은 생성되지 않는다.

### E3. Spotify API 429 (Rate Limit)

**Given** 짧은 시간 동안 다수의 요청이 발생해 Spotify가 `429 Too Many Requests` 및 `Retry-After` 헤더로 응답할 때,
**When** `spotifyFetch`가 429를 감지하면,
**Then** `Retry-After` 값만큼 대기 후 1회 재시도하며, 재시도도 실패하면 상위 핸들러가 503 또는 "Spotify busy — please try again" UX를 반환한다. 절대 tight loop로 재시도하지 않는다.

### E4. OAuth state 불일치 / 쿠키 누락

**Given** `/api/auth/spotify/callback`에 도착한 요청의 state 쿼리 값이 쿠키의 서명된 state와 일치하지 않거나 쿠키가 없을 때,
**When** 콜백 핸들러가 검증을 수행하면,
**Then** 400 에러를 반환하고, `music_connections`에 어떤 쓰기도 수행하지 않으며, state 쿠키를 즉시 삭제한다.

### E5. 동시 다중 요청 시 토큰 갱신 경쟁

**Given** 동일 사용자에 대해 병렬로 여러 Spotify API 호출이 시작되고 모두 access token이 만료된 것을 감지할 때,
**When** `spotifyFetch`가 호출되면,
**Then** refresh는 사용자 단위 단일 in-flight 프라미스로 디듀플리케이션되어 한 번만 수행되고, 모든 호출은 동일한 새 access token으로 재시도된다(`music_connections` UPDATE도 1회만 발생).

## Definition of Done

- [ ] REQ-SPOT-001..005 각각에 대응하는 시나리오(위 1~5)가 수동 또는 자동 테스트로 통과한다.
- [ ] Edge case E1~E5 중 E1, E2, E4, E5에 대한 단위/통합 테스트가 존재한다(E3는 수동 검증 허용).
- [ ] `grep -r "access_token" src/app/\\[handle\\]` 결과에서 Spotify 토큰이 클라이언트 번들/props로 전달되는 경로가 없음을 확인한다.
- [ ] 스키마 마이그레이션이 추가되지 않았음을 확인한다(`ls supabase/migrations/`에 신규 파일 없음).
- [ ] 환경변수 3종이 `.env.example` 등 문서에 반영된다.
- [ ] CSP `frame-src`에 `https://open.spotify.com`이 포함되어 있다.
- [ ] MX 태그 계획(`@MX:ANCHOR`, `@MX:WARN @MX:REASON=...`)이 구현 파일에 실제로 부착된다.
- [ ] 모든 사용자-대면 에러 메시지가 한국어이고, 코드 식별자는 영어이다.

## Quality Gate Criteria (TRUST 5)

- **Tested**: Spotify OAuth, token refresh, 플레이리스트 정규화, 방 페이지 분기에 대한 테스트 커버리지 85% 이상.
- **Readable**: 모든 신규 파일이 ruff/eslint 통과, 변수/함수명이 `spotifyFetch`, `fetchSpotifyPlaylist`, `refreshSpotifyToken` 등 의도를 드러낸다.
- **Unified**: 기존 YouTube 경로와 구조·명명이 1:1 대응되어 `src/lib/youtube/*`와 `src/lib/spotify/*`의 디렉토리 레이아웃이 대칭이다.
- **Secured**: 토큰 클라이언트 미노출, state CSRF 방지, refresh token revocation 시 graceful degradation, OWASP Top 10 관련 점검 완료.
- **Trackable**: 모든 커밋이 `SPEC-SPOTIFY-001` 참조를 포함한다.
