---
title: Project Structure
project: playlist
updated: 2026-04-14
---

# Project Structure

## Directory Tree

```
playlist/
├── public/                     # Static assets served at root path
│   ├── file.svg
│   ├── globe.svg
│   ├── next.svg
│   ├── vercel.svg
│   └── window.svg
├── src/
│   └── app/                    # Next.js App Router root
│       ├── favicon.ico         # Browser tab icon
│       ├── globals.css         # Global styles and Tailwind 4 theme tokens
│       ├── layout.tsx          # Root layout (font loading, HTML shell)
│       └── page.tsx            # Home page route (/)
├── .moai/                      # MoAI project workspace (non-source)
├── .claude/                    # Claude Code configuration and agents
├── eslint.config.mjs           # ESLint 9 flat config
├── next.config.ts              # Next.js configuration (TypeScript)
├── next-env.d.ts               # Next.js TypeScript declarations (auto-generated)
├── package.json                # npm dependencies and scripts
├── postcss.config.mjs          # PostCSS configuration (Tailwind plugin)
└── tsconfig.json               # TypeScript compiler options
```

## Key File Locations

| File | Purpose |
|---|---|
| `src/app/layout.tsx` | Root layout: HTML shell, font CSS variables, global metadata |
| `src/app/page.tsx` | Home route (`/`): currently the default Create Next App page |
| `src/app/globals.css` | Global styles: Tailwind import, CSS custom properties, dark mode |
| `next.config.ts` | Next.js configuration (currently default/empty) |
| `tsconfig.json` | TypeScript compiler settings including path alias |
| `eslint.config.mjs` | ESLint rules (flat config with Next.js and TypeScript presets) |
| `postcss.config.mjs` | PostCSS pipeline with Tailwind CSS 4 plugin |

## Architecture Pattern

The project uses the **Next.js App Router** architecture introduced in Next.js 13 and now the default in Next.js 16.

Key conventions:

- **Server Components by default**: all components in `src/app/` are React Server Components unless marked with `"use client"`.
- **File-based routing**: each `page.tsx` file under `src/app/` defines a route. Nested directories create nested URL paths.
- **Layouts**: `layout.tsx` wraps all child routes at the same level and below, persisting across navigations.
- **Special files**: `loading.tsx`, `error.tsx`, `not-found.tsx`, and `route.ts` have reserved purposes and can be added as needed.

Current route map:

| URL | File | Type |
|---|---|---|
| `/` | `src/app/page.tsx` | Server Component |

## Module Organization

No domain modules exist yet. As features are added, the recommended convention is:

```
src/
├── app/          # Routes and layouts (Next.js convention)
├── components/   # Shared UI components (to be created)
├── lib/          # Utilities, helpers, API clients (to be created)
└── types/        # Shared TypeScript type definitions (to be created)
```

## Path Alias Configuration

TypeScript and the Next.js bundler are configured with the `@/*` alias:

```
@/* -> ./src/*
```

This allows imports such as `import { Button } from "@/components/Button"` instead of relative paths.

Configured in:
- `tsconfig.json` under `compilerOptions.paths`
- Automatically resolved by Next.js without additional bundler configuration
