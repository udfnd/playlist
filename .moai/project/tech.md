---
title: Technology Stack
project: playlist
updated: 2026-04-22
---

# Technology Stack

## Core Dependencies

| Category | Technology | Version |
|---|---|---|
| Framework | Next.js | 16.x (App Router) |
| UI Library | React | 19.x |
| Language | TypeScript | ^5 (strict mode) |
| Styling | Tailwind CSS | ^4 |
| Linting | ESLint | ^9 |

## Runtime Dependencies

| Package | Version | Purpose |
|---|---|---|
| `next-auth` | ^5.0.0-beta.31 | Google OAuth primary auth |
| `@supabase/ssr` | ^0.10.2 | Supabase SSR client |
| `@supabase/supabase-js` | ^2.103.3 | Supabase JS client |
| `@anthropic-ai/sdk` | ^0.90.0 | LLM palette generation (Haiku) |
| `@react-three/fiber` | ^9.6.0 | 3D 캐러셀 렌더링 |
| `@react-three/drei` | ^10.7.7 | R3F helper components |
| `three` | ^0.170.0 | WebGL / 3D engine |

## Testing Infrastructure

| Package | Version | Purpose |
|---|---|---|
| `vitest` | ^3.2.4 | Unit / integration test runner |
| `@testing-library/react` | latest | React component testing |
| `@testing-library/user-event` | latest | User interaction simulation |
| `happy-dom` | latest | DOM environment for vitest |
| `playwright` | latest | E2E (수동 검증) |

## Framework Details

### Next.js (App Router)

- Server Components 기본, `"use client"` 명시 시 client component
- `next.config.ts`: CSP headers 포함 (`frame-src open.spotify.com`, YouTube)
- API Routes: `src/app/api/**` 아래 `route.ts` 파일

### TypeScript

- strict mode 활성화
- path alias: `@/*` → `./src/*`
- `isolatedModules: true`, `moduleResolution: bundler`

### Tailwind CSS 4

- CSS-first 설정 (`@theme` directive, `tailwind.config.js` 없음)
- `postcss.config.mjs`로 PostCSS 연동

## Integrations

### NextAuth v5 — Google OAuth (Primary Login)

사용자 로그인은 Google OAuth 단일화. `src/auth.ts`의 `syncUserAndConnection` 패턴으로 Supabase `users` 테이블에 upsert.

### Spotify OAuth — Secondary Connection

- 커스텀 라우트: `/api/auth/spotify/{connect,callback,disconnect}`
- CSRF 방어: HMAC-signed `__Host-` prefix state 쿠키 (short-lived)
- 토큰 저장: `music_connections` 테이블 (service-role Supabase upsert, 클라이언트 노출 없음)
- 자동 갱신: 요청당 per-user in-flight refresh dedup (`inflightRefreshes` Map, @MX:WARN)
- 스코프: `playlist-read-private playlist-read-collaborative user-read-email`

### Supabase

- Next.js 서버 사이드에서만 service-role 키 사용 (클라이언트 번들 미포함)
- `@supabase/ssr`로 SSR 세션 관리
- 마이그레이션: `supabase/migrations/` (2개 파일)

### Anthropic SDK

- `@anthropic-ai/sdk` Claude Haiku 모델로 AI 커스텀 팔레트 생성
- `/api/presets` 라우트에서 서버 사이드 호출

## Build and Scripts

| Script | Purpose |
|---|---|
| `dev` | 로컬 개발 서버 (hot reload) |
| `build` | 프로덕션 빌드 |
| `start` | 프로덕션 서버 |
| `lint` | ESLint 실행 |
| `test` | Vitest 단위/통합 테스트 (116개 green) |

## Key Configuration Files

| File | Purpose |
|---|---|
| `next.config.ts` | Next.js 설정 + CSP headers |
| `tsconfig.json` | TypeScript 컴파일러 옵션 |
| `eslint.config.mjs` | ESLint flat config |
| `postcss.config.mjs` | Tailwind CSS PostCSS |
| `.env.example` | 필수 환경변수 목록 |
| `src/test/setup.ts` | Vitest global setup |

## Environment Variables (Required)

| Variable | Purpose |
|---|---|
| `NEXTAUTH_SECRET` | NextAuth 세션 서명 |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 클라이언트 |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 서버 전용 |
| `ANTHROPIC_API_KEY` | Haiku 팔레트 생성 |
| `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` / `SPOTIFY_REDIRECT_URI` | Spotify OAuth |
