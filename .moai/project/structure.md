---
title: Project Structure
project: playlist
updated: 2026-04-22
---

# Project Structure

## Directory Tree

```
playlist/
├── public/                         # Static assets
├── supabase/
│   └── migrations/                 # 2 SQL migration files
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout (font, metadata)
│   │   ├── page.tsx                # Landing page (/)
│   │   ├── globals.css
│   │   ├── auth/                   # NextAuth sign-in UI
│   │   ├── home/
│   │   │   ├── page.tsx            # Authenticated home (Server Component)
│   │   │   ├── SpotifyStatus.tsx   # Client subcomponent (Connect/Disconnect)
│   │   │   └── new/
│   │   │       └── NewRoomWizard.tsx
│   │   ├── [handle]/
│   │   │   ├── page.tsx            # Public user profile
│   │   │   └── [slug]/
│   │   │       ├── page.tsx        # Room page
│   │   │       └── RoomCarousel.tsx
│   │   └── api/
│   │       ├── auth/
│   │       │   └── spotify/        # connect / callback / disconnect
│   │       ├── me/
│   │       │   ├── rooms/          # Room CRUD
│   │       │   └── spotify/
│   │       │       ├── playlists/  # User's Spotify playlists
│   │       │       └── status/     # Connection probe
│   │       ├── my-playlists/       # YouTube playlists
│   │       ├── playlist/           # YouTube public playlist resolver
│   │       ├── spotify/
│   │       │   └── playlist/       # Spotify public playlist resolver
│   │       ├── presets/            # AI palette generation
│   │       └── og/                 # OG image generation
│   ├── components/
│   │   ├── scene/
│   │   │   ├── SongCarousel.tsx    # R3F 3D carousel
│   │   │   └── ...
│   │   └── ui/
│   │       ├── SongView.tsx        # Track view + embed iframe (YouTube/Spotify)
│   │       └── ...
│   ├── lib/
│   │   ├── youtube/
│   │   │   └── fetch-playlist.ts
│   │   ├── spotify/
│   │   │   ├── oauth.ts
│   │   │   ├── client.ts           # @MX:WARN race-condition
│   │   │   └── fetch-playlist.ts   # @MX:ANCHOR
│   │   ├── presets/
│   │   ├── supabase/
│   │   ├── colors.ts
│   │   ├── cover-generator.ts
│   │   ├── format.ts
│   │   ├── handle-validation.ts
│   │   └── slug.ts
│   ├── data/
│   │   └── types.ts                # Playlist, Track, Room shared types
│   ├── types/                      # Additional TypeScript types
│   └── test/
│       └── setup.ts                # Vitest global setup
├── next.config.ts                  # CSP headers, Next.js config
├── .env.example
└── package.json
```

## Route Map

| URL | File | Type |
|---|---|---|
| `/` | `src/app/page.tsx` | Server Component (landing) |
| `/home` | `src/app/home/page.tsx` | Server Component (authenticated) |
| `/home/new` | `src/app/home/new/NewRoomWizard.tsx` | Client Component |
| `/@:handle` | `src/app/[handle]/page.tsx` | Server Component (public profile) |
| `/@:handle/:slug` | `src/app/[handle]/[slug]/page.tsx` | Server Component (room) |
| `/api/auth/spotify/connect` | route.ts | OAuth redirect initiation |
| `/api/auth/spotify/callback` | route.ts | OAuth code exchange + upsert |
| `/api/auth/spotify/disconnect` | route.ts | Token deletion |
| `/api/me/spotify/playlists` | route.ts | User's Spotify playlists |
| `/api/me/spotify/status` | route.ts | Connection probe for wizard |
| `/api/me/rooms` | route.ts | Room CRUD (authenticated) |
| `/api/my-playlists` | route.ts | User's YouTube playlists |
| `/api/playlist` | route.ts | YouTube public playlist resolver |
| `/api/spotify/playlist` | route.ts | Spotify public playlist resolver |
| `/api/presets` | route.ts | AI palette generation |
| `/api/og` | route.ts | Dynamic OG image |

## Architecture Conventions

- **Server Components 기본**: `src/app/` 내 모든 컴포넌트는 `"use client"` 없으면 RSC
- **서버/클라이언트 경계**: `SpotifyStatus.tsx`처럼 인터랙션이 필요한 부분만 client subcomponent로 분리
- **토큰 보안**: Spotify/Google OAuth 토큰은 서버 사이드(`service-role`)에서만 접근
- **공유 타입**: `src/data/types.ts`의 `Playlist`, `Track`을 YouTube/Spotify 양쪽이 공유
- **Path alias**: `@/*` → `./src/*`
