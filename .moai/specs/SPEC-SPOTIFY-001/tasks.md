---
spec: SPEC-SPOTIFY-001
version: 1.0.0
created: 2026-04-21
methodology: TDD
---

# Task Decomposition — SPEC-SPOTIFY-001

SPEC: SPEC-SPOTIFY-001
Methodology: TDD (RED → GREEN → REFACTOR per `.moai/config/sections/quality.yaml`)
Coverage target: 85% overall, 80% per commit minimum.

## Task Decomposition

| Task ID | Description | Requirement | Dependencies | Planned Files | Status |
|---------|-------------|-------------|--------------|---------------|--------|
| T-001 | Spotify OAuth primitives: `buildAuthorizeUrl`, HMAC `signState`/`verifyState`, `exchangeCodeForToken`, `refreshAccessToken`, `extractPlaylistId` (ID-or-URL). Pure functions; no DB. | REQ-SPOT-001 | — | src/lib/spotify/oauth.ts, src/lib/spotify/__tests__/oauth.test.ts | pending |
| T-002 | `spotifyFetch(userId, path, init)`: reads `music_connections` (provider='spotify') via `getSupabaseAdmin()`, refreshes on `expires_at` near-expiry or 401 once, persists new tokens, per-user in-flight refresh dedup map, `Retry-After` aware single retry on 429, surfaces `invalid_grant` as typed error. | REQ-SPOT-002, REQ-SPOT-005, E1, E3, E5 | T-001 | src/lib/spotify/client.ts, src/lib/spotify/__tests__/client.test.ts | pending |
| T-003 | `fetchSpotifyPlaylist(userId, idOrUrl)`: metadata + paginated tracks → `Playlist` (src/data/types.ts). Maps `name→title`, `artists[].name→artist`, `album.images[0].url→thumbnailUrl/coverUrl`, `duration_ms→duration` (seconds), `id→videoId` reused as Spotify track id for embed. Follows `next` pagination. Returns typed `unavailable` error for 403/404. | REQ-SPOT-002, REQ-SPOT-003, REQ-SPOT-004, E2 | T-002 | src/lib/spotify/fetch-playlist.ts, src/lib/spotify/__tests__/fetch-playlist.test.ts | pending |
| T-004 | `GET /api/auth/spotify/connect`: NextAuth session gate, random state, HMAC-signed state cookie (`__Host-spotify_oauth_state`, httpOnly, SameSite=Lax, 5min TTL), 302 to Spotify authorize URL with scopes `playlist-read-private playlist-read-collaborative user-read-email`, optional `returnTo`. | REQ-SPOT-001 | T-001 | src/app/api/auth/spotify/connect/route.ts, src/app/api/auth/spotify/connect/__tests__/route.test.ts | pending |
| T-005 | `GET /api/auth/spotify/callback`: verify state cookie, delete cookie, exchange code, upsert `music_connections` keyed `(user_id, provider='spotify')`, redirect to `returnTo` or `/home`. 400 on state mismatch with no DB write. | REQ-SPOT-001, E4 | T-001, T-004 | src/app/api/auth/spotify/callback/route.ts, src/app/api/auth/spotify/callback/__tests__/route.test.ts | pending |
| T-006 | `POST /api/auth/spotify/disconnect`: authenticated, deletes `music_connections` row `(user_id, provider='spotify')`. | REQ-SPOT-001 | — (session only) | src/app/api/auth/spotify/disconnect/route.ts, src/app/api/auth/spotify/disconnect/__tests__/route.test.ts | pending |
| T-007 | `GET /api/me/spotify/playlists`: session-auth, `spotifyFetch` → `/me/playlists` paginated, maps to `{id,title,thumbnailUrl,itemCount,privacy}`. | REQ-SPOT-002 | T-002 | src/app/api/me/spotify/playlists/route.ts, src/app/api/me/spotify/playlists/__tests__/route.test.ts | pending |
| T-008 | `GET /api/spotify/playlist?list=…`: session-auth, accepts ID or URL, calls `fetchSpotifyPlaylist(session.userId, list)`, returns normalized `Playlist`. 404/403 mapped to user-friendly Korean error. | REQ-SPOT-003, E2 | T-003 | src/app/api/spotify/playlist/route.ts, src/app/api/spotify/playlist/__tests__/route.test.ts | pending |
| T-009 | Wizard source toggle + Spotify branch: add YouTube/Spotify tabs, fetch connection status from `/api/me/connections` or new lightweight endpoint, render `/api/me/spotify/playlists`, show "Connect Spotify" CTA when disconnected, disable Publish until playlist selected, submit `sourceProvider: 'spotify'` to `/api/me/rooms`. | REQ-SPOT-001, REQ-SPOT-002, REQ-SPOT-003, Scenario 5 | T-007, T-008 | src/app/home/new/NewRoomWizard.tsx, src/app/home/new/__tests__/NewRoomWizard.test.tsx | pending |
| T-010 | Room page provider branching in `loadRoomAndPlaylist`: `source_provider === 'spotify'` → `fetchSpotifyPlaylist(room.user_id, room.source_playlist_id)`; map `invalid_grant`/403/404 → `{ok:false, reason:'unavailable'}`. Ensure no tokens reach client props (only normalized `Playlist`). | REQ-SPOT-004, REQ-SPOT-005 | T-003 | src/app/[handle]/[slug]/page.tsx | pending |
| T-011 | `RoomCarousel` embed branch: add `playbackProvider: 'youtube' \| 'spotify'` prop, render `<iframe src="https://open.spotify.com/embed/track/{track.videoId}" allow="encrypted-media" loading="lazy">` when provider is spotify; preserve 3D visualization shell. | REQ-SPOT-004 | T-010 | src/app/[handle]/[slug]/RoomCarousel.tsx | pending |
| T-012 | `/home` connection chip + Connect/Reconnect/Disconnect controls: server-side read of `music_connections.provider='spotify'` state, render status, POST disconnect via `/api/auth/spotify/disconnect`, link to `/api/auth/spotify/connect`. Owner-facing reconnect banner when a room is unavailable due to revoked token. | REQ-SPOT-001, REQ-SPOT-005 | T-004, T-006 | src/app/home/page.tsx | pending |
| T-013 | CSP `frame-src` allowlist: add `https://open.spotify.com` to `Content-Security-Policy` response header via `next.config.ts` `headers()` (also keep existing YouTube origins if any). | REQ-SPOT-004, DoD | T-011 | next.config.ts | pending |
| T-014 | `.env.example` + README note for `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REDIRECT_URI`; Korean user-facing Dashboard setup steps. | DoD | — | .env.example, README.md | pending |

## Constraints

- No schema migrations: `supabase/migrations/` MUST be byte-identical after completion (DoD check).
- No Spotify tokens in client bundle: final grep `rg "access_token|refresh_token" src/app/\[handle\]/ src/app/home/new/` returns zero matches in client components. Only server components (page.tsx as Server Component, route handlers) touch tokens.
- Reuse `Playlist`/`Song` from `src/data/types.ts` verbatim — do NOT introduce a parallel Spotify-specific type. Spotify track ID is stored in the existing `videoId` field (rename deferred to a future SPEC).
- Directory symmetry: `src/lib/spotify/*` mirrors `src/lib/youtube/*` (`oauth.ts`, `client.ts`, `fetch-playlist.ts`) — do not collapse into a single mega-module.
- NextAuth providers array in `src/auth.ts` MUST remain unchanged (no Spotify provider added).
- TDD cycle per task: failing test first (RED), minimal implementation (GREEN), cleanup (REFACTOR). Tests colocated under `__tests__/` adjacent to the unit under test.
- Vitest: unit tests with module-level `vi.mock` for `@/lib/supabase/admin` and `@/auth`; route handlers tested by importing their `GET`/`POST` exports and invoking with `new Request(url, init)`, asserting on returned `Response` status / JSON / headers. Components tested in `happy-dom`.
- No real Spotify API calls in tests: mock global `fetch` (Vitest `vi.stubGlobal('fetch', ...)`).
- No real Supabase calls in tests: `getSupabaseAdmin()` returns a chainable stub (`from().upsert().select().single()`-style) pre-programmed per test.
- User-facing strings in Korean; all identifiers, function names, and file names in English per `.moai/config/sections/language.yaml`.
- Zero LSP errors: `npx tsc --noEmit` and `npm run lint` must pass at the end.
- MX tags applied per plan.md §MX Tag Plan during REFACTOR phase of T-002, T-003, T-005.
- All commits reference `SPEC-SPOTIFY-001`.

## Drift Guard

Planned files are restricted to those listed in the table. Any modification outside this list counts as drift. Expected drift ceiling: 0 new files outside `src/lib/spotify/`, `src/app/api/(auth/)?spotify/`, `src/app/api/me/spotify/`, `src/app/home/`, `src/app/[handle]/[slug]/`, plus `next.config.ts`, `.env.example`, `README.md`.

## Execution Order

T-001 → T-002 → T-003 (library core)
→ T-004 → T-005 → T-006 (OAuth routes; T-006 parallel to T-004/T-005)
→ T-007 and T-008 (parallel; depend only on T-002/T-003)
→ T-009 (wizard; depends on T-007, T-008)
→ T-010 → T-011 (room render; sequential)
→ T-012 (home chip; depends on T-004/T-006)
→ T-013 (CSP; after T-011 so browser can verify embed)
→ T-014 (docs; anytime, required before DoD)
