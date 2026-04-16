---
title: Technology Stack
project: playlist
updated: 2026-04-14
---

# Technology Stack

## Overview

| Category | Technology | Version |
|---|---|---|
| Framework | Next.js | 16.2.3 |
| UI Library | React | 19.2.4 |
| DOM Renderer | react-dom | 19.2.4 |
| Language | TypeScript | ^5 (strict mode) |
| Styling | Tailwind CSS | ^4 |
| PostCSS Plugin | @tailwindcss/postcss | ^4 |
| Linting | ESLint | ^9 |
| ESLint Config | eslint-config-next | 16.2.3 |
| Node Types | @types/node | ^20 |
| React Types | @types/react | ^19 |
| React DOM Types | @types/react-dom | ^19 |

## Framework Details

### Next.js 16

- **Architecture**: App Router (file-based routing under `src/app/`)
- **Rendering**: Server Components by default, opt-in client components with `"use client"`
- **Fonts**: `next/font/google` for zero-layout-shift Google Font loading (Geist Sans, Geist Mono)
- **Images**: `next/image` component used in the default home page
- **Config file**: `next.config.ts` (TypeScript format, currently default/empty)

### React 19

- **Server Components**: Components in `src/app/` render on the server by default
- **Actions**: Form actions and server mutations available for future use
- **JSX Transform**: Configured via `tsconfig.json` `"jsx": "react-jsx"` (no manual React import required)

## Styling

### Tailwind CSS 4

Tailwind 4 introduces CSS-first configuration. There is no `tailwind.config.js` file. Configuration is done inline in CSS using the `@theme` directive.

Current token definitions in `src/app/globals.css`:

```css
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}
```

Dark mode is implemented via a CSS media query (`prefers-color-scheme: dark`) on `:root` custom properties, not via Tailwind's `darkMode` class strategy.

PostCSS integration is provided by `@tailwindcss/postcss`, configured in `postcss.config.mjs`.

## TypeScript Configuration

Key `tsconfig.json` settings:

| Option | Value | Effect |
|---|---|---|
| `target` | `ES2017` | Transpile to ES2017 syntax |
| `strict` | `true` | All strict type checks enabled |
| `noEmit` | `true` | TypeScript checks only; Next.js handles emit |
| `module` | `esnext` | ESM module syntax |
| `moduleResolution` | `bundler` | Bundler-aware resolution (supports exports field) |
| `isolatedModules` | `true` | Each file is treated as an isolated module |
| `incremental` | `true` | Enable incremental compilation cache |
| `paths` | `@/* -> ./src/*` | Path alias for cleaner imports |

## Linting

ESLint 9 flat config (`eslint.config.mjs`) applies two rulesets:

- `eslint-config-next/core-web-vitals`: Next.js best practices and Core Web Vitals performance rules
- `eslint-config-next/typescript`: TypeScript-aware rules via the Next.js ESLint config

The `.next/`, `out/`, `build/`, and `next-env.d.ts` paths are explicitly ignored.

## Development Environment Requirements

| Requirement | Minimum Version | Notes |
|---|---|---|
| Node.js | 20.x LTS | `@types/node@^20` indicates Node 20+ expected |
| npm | 10.x | Ships with Node.js 20 |

No additional global tools are required.

## Build and Scripts

All scripts are defined in `package.json`:

| Script | Command | Purpose |
|---|---|---|
| `dev` | `next dev` | Start local development server with hot reload |
| `build` | `next build` | Produce optimized production build in `.next/` |
| `start` | `next start` | Serve the production build locally |
| `lint` | `eslint` | Run ESLint across the project |

## Key Configuration Files

| File | Format | Purpose |
|---|---|---|
| `next.config.ts` | TypeScript | Next.js runtime and build configuration |
| `tsconfig.json` | JSON | TypeScript compiler options and path aliases |
| `eslint.config.mjs` | ESM JS | ESLint flat config with Next.js presets |
| `postcss.config.mjs` | ESM JS | PostCSS pipeline (Tailwind CSS plugin) |
| `src/app/globals.css` | CSS | Global styles, Tailwind import, theme tokens |

## Testing Infrastructure

No test framework is currently configured. Test infrastructure (Vitest, Jest, Playwright, or React Testing Library) needs to be added before writing tests.
