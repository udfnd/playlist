# SPEC-SOCIAL-001 Acceptance Criteria

## Given-When-Then Scenarios

### Scenario 1 — Visitor first-visit issues a signed cookie

**Given** a browser with no `__Host-visitor` cookie
**And** a public room exists at `/alice/chill-mix` with `visibility='public'`
**When** the visitor navigates to `/alice/chill-mix`
**Then** the response includes a `Set-Cookie: __Host-visitor=<id>.<hmac>` header with `HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=31536000`
**And** a new row appears in `public.visitors` with `id = <decoded id>`
**And** the room page renders normally (no auth wall)

### Scenario 2 — Visitor adds a ❤️ reaction idempotently

**Given** a visitor with a valid `__Host-visitor` cookie
**And** a public room `R` containing track `T`
**When** the visitor sends `POST /api/rooms/R/reactions` with `{ trackRef: "T", emoji: "❤️" }`
**Then** the response is HTTP 201 with the inserted row
**When** the same visitor repeats the identical request
**Then** the response is HTTP 200 with the same `id` (idempotent)
**And** `SELECT count(*) FROM track_reactions WHERE room_id='R' AND track_ref='T' AND emoji='❤️' AND visitor_id=<id>` returns 1

### Scenario 3 — Logged-in user submits a suggestion to a Spotify room

**Given** an authenticated Google user `U`
**And** a room `R` with `source_provider='spotify'`
**And** `U` has 0 pending suggestions in `R` within the last hour
**When** `U` sends `POST /api/rooms/R/suggestions` with a valid Spotify `externalTrackId` and metadata
**Then** the response is HTTP 201
**And** a row exists in `track_suggestions` with `status='pending'`, `suggested_by=U`, `source_provider='spotify'`
**And** no write is made against Spotify's external playlist (verified by grep DoD)

### Scenario 4 — Owner approves a pending suggestion

**Given** a room `R` owned by user `O`
**And** a `track_suggestions` row `S` with `status='pending'` for `R`
**When** `O` sends `PATCH /api/rooms/R/suggestions/S` with `{ status: 'approved' }`
**Then** the response is HTTP 200
**And** `track_suggestions.status='approved'` and `resolved_at` is set
**And** a new row in `room_extra_tracks(room_id=R, suggestion_id=S, position=<next>)` exists
**And** the next render of `/O.handle/R.slug` includes the approved track at the end of the carousel with a "추천" badge
**And** no HTTP request is issued to `api.spotify.com/*/playlists/*/tracks` (verified by test spy + grep DoD)

### Scenario 5 — Non-owner PATCH is rejected

**Given** a room `R` owned by `O` with a `pending` suggestion `S`
**And** an authenticated user `U` where `U ≠ O`
**When** `U` sends `PATCH /api/rooms/R/suggestions/S` with `{ status: 'approved' }`
**Then** the response is HTTP 403
**And** `track_suggestions` row `S` is unchanged (status still `pending`, `resolved_at` still null)
**And** no row is inserted into `room_extra_tracks`

### Scenario 6 — Provider-scoped search for Spotify room

**Given** an authenticated user with the "Suggest a track" modal open on a room with `source_provider='spotify'`
**When** the user sends `GET /api/rooms/R/search?q=Radiohead&limit=10`
**Then** the response is HTTP 200 with an array of at most 10 items, each shaped `{ externalTrackId, title, artist, thumbnailUrl, durationSec }`
**And** `spotifyFetch` was invoked with `/search?type=track&q=Radiohead&limit=10`
**And** `youtube-search` module was NOT invoked

## Edge Cases

### E1 — Invalid cookie signature

**Given** a browser with `__Host-visitor` whose HMAC fails verification
**When** the visitor calls any reactions endpoint
**Then** the server discards the incoming cookie, issues a fresh cookie in the response, and creates a new `visitors` row
**And** no reactions previously made under the invalid id are exposed to or merged with the new id

### E2 — Visitor rate limit exceeded

**Given** a visitor who has performed 30 reaction mutations in the last 60 seconds
**When** they submit the 31st mutation
**Then** the response is HTTP 429 with `Retry-After` header
**And** no row is inserted

### E3 — Provider mismatch suggestion

**Given** a room with `source_provider='youtube'`
**And** an authenticated user
**When** the user submits `POST /api/rooms/R/suggestions` with a Spotify-shaped `externalTrackId` (e.g. 22-char base62) that server-side provider lookup resolves against Spotify
**Then** the response is HTTP 400 with `{ error: 'provider_mismatch' }`
**And** no row is inserted into `track_suggestions`

### E4 — Parallel duplicate reactions from same visitor

**Given** a visitor `V` and track `T` in room `R`
**When** two concurrent `POST` requests with `{ trackRef:T, emoji:'❤️' }` arrive
**Then** exactly one row exists in `track_reactions` for `(R, T, visitor, V, ❤️)`
**And** one response is HTTP 201 and the other is HTTP 200 (idempotent); no 500s

### E5 — Approving an already-resolved suggestion

**Given** a `track_suggestions` row `S` with `status='rejected'`
**When** the owner sends `PATCH .../S` with `{ status: 'approved' }`
**Then** the response is HTTP 409 with `{ error: 'already_resolved' }`
**And** `S.status` remains `rejected`
**And** no row is inserted into `room_extra_tracks`

## Definition of Done (DoD)

Checklist (all must pass before `/moai:3-sync`):

- [ ] `ls supabase/migrations/ | grep 20260422_social_layer.sql` returns the new migration file
- [ ] `grep -rn "playlists/.*/tracks" src/lib/reactions src/lib/suggestions` returns zero matches (no external playlist writes)
- [ ] `grep -rn "access_token\|refresh_token" src/app/\[handle\]/ src/components` returns only server-component lines (tokens remain server-only)
- [ ] `EMOJI_SET` constant is defined in exactly one file (`src/data/reactions.ts`) — verified by `grep -rn "EMOJI_SET =" src/ | wc -l` = 1
- [ ] All 4 new API route files have RED-GREEN-REFACTOR unit tests
- [ ] Migration applied cleanly against a fresh Supabase instance (no CREATE TABLE errors)
- [ ] Visitor cookie module has dedicated HMAC tamper-detection test (`src/__tests__/visitor-cookie.test.ts`)
- [ ] Idempotency verified with concurrent-request test (E4)
- [ ] All 5 scenarios + 5 edge cases have corresponding automated tests
- [ ] Rate limiter tests cover 429 transition boundaries (30th vs 31st, 5th vs 6th)
- [ ] RoomCarousel renders `extraTracks` with distinguishable "추천" badge (visual regression via existing snapshot pattern if present, otherwise DOM assertion test)

## TRUST 5 Quality Gate

| Pillar | Criterion |
|--------|-----------|
| **Tested** | ≥85% coverage for `src/lib/visitor/**`, `src/lib/reactions/**`, `src/lib/suggestions/**`, `src/lib/search/**`; all API routes have at least 1 happy-path + 1 auth-failure + 1 validation-failure test |
| **Readable** | All service functions use explicit return types; no `any`; EARS REQ IDs referenced in JSDoc (`/** Implements REQ-SOC-002 */`) |
| **Unified** | Matches Phase 1 patterns: service-role Supabase client in `src/lib/supabase/admin.ts`, NextAuth guard pattern from `src/app/api/auth/spotify/connect/route.ts`, HMAC pattern from `src/lib/spotify/oauth.ts` |
| **Secured** | HMAC verification uses constant-time comparison; `__Host-` prefix enforced; rate limits enforced server-side; non-owner PATCH returns 403 (not 404 — intentional per REQ-SOC-004); no PII in cookie payload |
| **Trackable** | Every commit references `SPEC-SOCIAL-001`; MX tags applied per plan.md; migration file date-prefixed (`20260422_`) |
