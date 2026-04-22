---
title: Product Overview
project: playlist
updated: 2026-04-22
---

# Product Overview

## Project Name

onrepeat.cc (repo: playlist)

## Description

onrepeat.cc는 플레이리스트를 3D 리스닝 "방(room)"으로 출판하는 웹 애플리케이션이다. 사용자는 `/@handle/slug` 형태의 고유 URL에서 자신만의 방을 공개하고, 방문자는 3D 바이닐 크레이트 캐러셀로 트랙을 탐색하며 감상할 수 있다.

플레이리스트 소스로 **YouTube**(기본)와 **Spotify**(SPEC-SPOTIFY-001, OAuth 연결 방식)를 지원한다.

## Current State

| 영역 | 구현 상태 |
|---|---|
| 인증 | Google OAuth via NextAuth v5 |
| 사용자 핸들 | `@handle` 형식, 중복 검증 포함 |
| 방 CRUD | 공개/미공개/비공개 visibility, slug 자동 생성 |
| 3D 시각화 | React Three Fiber 바이닐 캐러셀 (SPEC-UI-001) |
| 컬러 프리셋 | 큐레이션 프리셋 + Anthropic SDK AI 생성 커스텀 팔레트 |
| YouTube 소스 | 플레이리스트 수집 및 방 생성 |
| Spotify 소스 | OAuth 연결, 플레이리스트 수집, Embed iframe 재생 (SPEC-SPOTIFY-001) |
| OG 이미지 | `/api/og` 동적 생성 |
| 공유 | 방 URL 공유, 공개 프로필 |
| 지속성 | Supabase (PostgreSQL) |

## Core Features

| Feature | Status | Notes |
|---|---|---|
| Auth (Google) | Done | NextAuth v5 |
| Handles | Done | `@handle` uniqueness enforced |
| Room CRUD | Done | public / unlisted / private |
| 3D Visualization | Done | React Three Fiber, SPEC-UI-001 |
| Presets (curated + AI) | Done | Anthropic SDK Haiku palette gen |
| YouTube source | Done | Playlist ingestion + room render |
| Spotify source | Done | OAuth link + ingestion + embed, SPEC-SPOTIFY-001 |
| OG images | Done | Dynamic generation |
| Sharing | Done | Public profile + share button |

## Planned Use Cases

- **Web Playback SDK**: Spotify Premium 풀-트랙 재생 (별도 SPEC 예정)
- **방문자 리액션 + 서비스 간 곡 추천**: Phase 2 SPEC
- `music_connections.provider_account_id` 백필 (Spotify 프로필 id 수집)
