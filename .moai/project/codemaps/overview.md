---
title: Architecture Overview
project: playlist
updated: 2026-04-14
---

# Architecture Overview

## System Type

Single-page web application using Next.js 16 App Router with Server Components.

## Architecture Pattern

File-based routing via Next.js App Router. Server Components by default with opt-in Client Components.

## Current State

Fresh Create Next App scaffold. No domain modules, API routes, or business logic implemented.

## Entry Points

| Entry Point | File | Description |
|---|---|---|
| Root Layout | `src/app/layout.tsx` | HTML shell, font loading, global metadata |
| Home Route | `src/app/page.tsx` | Default landing page (`/`) |

## Design Decisions

- **Rendering**: Server Components by default (Next.js 16 App Router convention)
- **Styling**: Tailwind CSS 4 with CSS-first configuration (no tailwind.config.js)
- **Dark Mode**: CSS media query (`prefers-color-scheme`) via CSS custom properties
- **Fonts**: Google Fonts (Geist) loaded via `next/font` for zero layout shift
- **Path Alias**: `@/*` maps to `./src/*` for clean imports

## Module Boundaries

No domain modules exist yet. Architecture documentation will be expanded as features are implemented through the SPEC workflow.
