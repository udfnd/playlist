---
id: SPEC-UI-001
version: 1.0.0
status: Planned
created: 2026-04-14
updated: 2026-04-14
type: plan
---

# Implementation Plan: SPEC-UI-001 -- 3D Playlist Visualization

## Technology Stack

### New Dependencies to Install

| Package | Version | Purpose |
|---------|---------|---------|
| three | ^0.170 | Core 3D rendering engine (WebGL) |
| @react-three/fiber | ^8.15 | React reconciler for Three.js -- declarative JSX scene composition |
| @react-three/drei | ^9.100 | Helper library: OrbitControls, texture utilities, environment presets |
| @types/three | ^0.170 | TypeScript type definitions for Three.js |

### Configuration Changes

| File | Change | Reason |
|------|--------|--------|
| `next.config.ts` | Add `transpilePackages: ['three']` | Three.js uses ESM that Next.js must transpile |
| `src/app/globals.css` | Update `@theme` tokens with vinyl palette colors | Align Tailwind tokens with design direction |

### Existing Stack (No Changes)

- Next.js 16.2.3 (App Router, server components by default)
- React 19.2.4
- TypeScript 5 (strict mode)
- Tailwind CSS 4 (CSS-first config via `@theme`)
- Geist Sans + Geist Mono fonts (already loaded in layout.tsx)

---

## Proposed File Structure

```
src/
├── app/
│   ├── page.tsx                        # Replace boilerplate with carousel scene entry point
│   ├── layout.tsx                      # Update metadata; keep existing font loading
│   └── globals.css                     # Add vinyl palette tokens to @theme block
│
├── components/
│   ├── scene/                          # 3D scene components (all "use client")
│   │   ├── AlbumCarousel.tsx           # Top-level Canvas container + Suspense boundary
│   │   ├── Scene.tsx                   # Camera, lighting, environment configuration
│   │   ├── Album.tsx                   # Individual album mesh: cover texture, dust jacket, interaction
│   │   ├── CylinderBase.tsx            # Turntable platter mesh with idle rotation
│   │   └── AlbumGlow.tsx               # Color-bleed glow effect behind focused album
│   │
│   └── ui/                             # 2D overlay components (HUD layer)
│       ├── PlaylistDetail.tsx          # Side panel: album info + tracklist + metadata
│       ├── PlaybackControls.tsx        # Play/pause button + progress bar
│       ├── AlbumHUD.tsx                # 2D text overlay anchored to selected album screen position
│       └── TrackList.tsx               # Individual track items with duration (Geist Mono)
│
├── data/
│   ├── types.ts                        # Album, Track, Playlist TypeScript interfaces
│   └── mock-playlists.ts              # 8+ mock albums with tracklists and cover paths
│
├── hooks/
│   ├── useCarouselControls.ts          # Drag-to-rotate logic: pointer events, rotation velocity
│   ├── useCarouselState.ts             # Selected album state, selection/deselection transitions
│   └── usePlayback.ts                  # Playback state: current track, play/pause, progress
│
└── lib/
    └── colors.ts                       # Palette constants, color extraction utility for album glow
```

### Component Purposes

| Component | Layer | Responsibility |
|-----------|-------|---------------|
| `AlbumCarousel.tsx` | 3D | Canvas mount point, Suspense fallback, dynamic import wrapper |
| `Scene.tsx` | 3D | Directional amber light, camera position, shadow config |
| `Album.tsx` | 3D | Box/plane mesh with cover texture, Tilt-and-Pull animation, dust jacket shader, hover state |
| `CylinderBase.tsx` | 3D | Circular platter mesh, slow idle rotation via `useFrame` |
| `AlbumGlow.tsx` | 3D | Point light or emissive plane behind focused album, color sampled from cover |
| `PlaylistDetail.tsx` | 2D | Slide-in panel with album title, artist, track count, total duration |
| `PlaybackControls.tsx` | 2D | Play/pause toggle, progress bar, current track info |
| `AlbumHUD.tsx` | 2D | Floating label anchored to album screen coordinates via `project()` |
| `TrackList.tsx` | 2D | Scrollable track list with name + duration in Geist Mono |

---

## Implementation Milestones

### M1: Data Foundation (Priority: High)

**Goal**: Establish TypeScript types, mock data, and color constants.

Tasks:
1. Define `Album`, `Track`, and `Playlist` interfaces in `src/data/types.ts`
   - Album: id, title, artist, coverUrl, color (dominant), tracks
   - Track: id, title, duration (seconds), trackNumber
   - Playlist: id, name, description, albums
2. Create mock dataset in `src/data/mock-playlists.ts`
   - Minimum 8 albums with 5-12 tracks each
   - Include diverse cover art placeholder paths (`/covers/album-N.webp`)
   - Each album has a `color` field (dominant color hex for glow effect)
3. Define palette constants in `src/lib/colors.ts`
   - MATTE_BLACK: `#0A0A0A` (background)
   - WARM_AMBER: `#E8A84C` (accent spotlight)
   - CREAM_WHITE: `#F5F0E6` (text)
   - VINYL_BLACK: `#1A1A1A` (surfaces)
   - MUTED_VIOLET: `#6B5B8A` (playback state)
4. Add placeholder WebP cover images to `public/covers/`

**Acceptance**: Types compile with strict mode. Mock data imports without errors. At least 8 albums with complete tracklists.

---

### M2: 3D Scene Foundation (Priority: High)

**Goal**: Render a working R3F Canvas with correct lighting and camera on the home page.

Tasks:
1. Install dependencies: `three`, `@react-three/fiber`, `@react-three/drei`, `@types/three`
2. Update `next.config.ts` to add `transpilePackages: ['three']`
3. Update `src/app/globals.css` to add vinyl palette tokens to `@theme` block
4. Create `src/components/scene/AlbumCarousel.tsx`
   - `"use client"` directive at top
   - Dynamic import of R3F `Canvas` (avoid SSR)
   - `frameloop="demand"` for render efficiency
   - `Suspense` boundary with loading fallback
   - DPR scaling: `dpr={[1, 2]}`
5. Create `src/components/scene/Scene.tsx`
   - `"use client"` directive
   - Directional light: warm amber color, positioned above, casting shadows
   - Camera: perspective, positioned to view the cylinder at a slight angle
   - Background: matte black (#0A0A0A)
6. Replace `src/app/page.tsx` default content with `AlbumCarousel` component
7. Update `src/app/layout.tsx` metadata (title, description)

**Acceptance**: Home page renders a dark 3D canvas with amber directional lighting. No SSR errors. No console warnings from R3F.

---

### M3: Album Carousel (Priority: High)

**Goal**: Arrange albums in a circular formation inside the cylinder, with drag-to-rotate.

Tasks:
1. Create `src/components/scene/Album.tsx`
   - `"use client"` directive
   - Render each album as a plane/box mesh with cover texture
   - Position using circular math: `angle = (index / count) * Math.PI * 2`
   - Orient each album to face outward from the circle center
   - Apply cover texture via `useTexture` from drei or `THREE.TextureLoader`
2. Create `src/components/scene/CylinderBase.tsx`
   - `"use client"` directive
   - Circular platter mesh (low cylinder or torus geometry)
   - Vinyl black (#1A1A1A) material
3. Create `src/hooks/useCarouselControls.ts`
   - Track pointer/touch start, move, end events
   - Calculate rotation delta from horizontal drag distance
   - Apply rotation to the album group with easing/momentum
   - Expose `rotation` value and `isDragging` state
4. Wire albums and base into `AlbumCarousel.tsx` scene
   - Map mock data to `Album` components in a `<group>` with shared rotation
   - Place `CylinderBase` beneath the album ring

**Acceptance**: 8+ albums visible arranged in a circle. Dragging rotates the entire cylinder. Album cover textures load and display. Cylinder base visible beneath albums.

---

### M4: Album Interaction -- Tilt-and-Pull (Priority: High)

**Goal**: Implement the signature Tilt-and-Pull selection, hover effects, and dust jacket overlay.

Tasks:
1. Create `src/hooks/useCarouselState.ts`
   - State: `selectedAlbumId | null`
   - Actions: `selectAlbum(id)`, `deselectAlbum()`
   - Derive: `isAlbumSelected`, `selectedAlbum` data
2. Enhance `Album.tsx` with interaction states:
   - **Default**: Dust jacket overlay (translucent material layer on top of cover)
   - **Hover**: Dust jacket fades, album brightens slightly
   - **Selected (Tilt-and-Pull)**: Album tilts forward (X-axis rotation) and translates outward (Z-axis), cover fully revealed, dust jacket removed
   - Use `useSpring` from `@react-three/drei` or manual `useFrame` interpolation for smooth animation
3. When an album is selected:
   - Dim remaining albums (reduce opacity or darken material)
   - Pause cylinder rotation
   - Pause idle turntable rotation
4. Create `src/components/scene/AlbumGlow.tsx`
   - `"use client"` directive
   - Render a subtle color-bleed glow behind the selected album
   - Color sourced from the album's `color` field
   - Implemented as a point light or emissive plane behind the mesh
5. Click on empty space or a "back" gesture deselects the album

**Acceptance**: Clicking an album triggers Tilt-and-Pull animation. Hovering shows visual feedback. Dust jacket visible on inactive albums. Selected album has color-bleed glow. Clicking away deselects.

---

### M5: Playlist Detail Panel (Priority: Medium)

**Goal**: Display album details and tracklist in a 2D side panel when an album is selected.

Tasks:
1. Create `src/components/ui/PlaylistDetail.tsx`
   - `"use client"` directive
   - Slide-in panel from the right side of the viewport
   - Content: album cover (2D image), title, artist, track count, total duration
   - Animate entrance/exit tied to album selection state
   - Styled with Tailwind: vinyl black background, cream white text, amber accents
2. Create `src/components/ui/TrackList.tsx`
   - Scrollable list of tracks
   - Track number, track name (Geist Sans), duration (Geist Mono)
   - Highlight currently "playing" track with muted violet
3. Create `src/components/ui/AlbumHUD.tsx`
   - `"use client"` directive
   - 2D floating label showing album title + artist
   - Positioned relative to the selected album's projected screen coordinates
   - Uses `THREE.Vector3.project()` to convert 3D position to screen position
   - Geist Sans, cream white, medium weight

**Acceptance**: Selecting an album slides in the detail panel. Tracklist displays all tracks with durations. HUD label appears near the selected album. Panel slides out on deselection.

---

### M6: Playback UI (Priority: Medium)

**Goal**: Simulate playback with visual play/pause and progress controls.

Tasks:
1. Create `src/hooks/usePlayback.ts`
   - State: `isPlaying`, `currentTrackIndex`, `progress` (0-1), `currentTrack`
   - Actions: `play()`, `pause()`, `toggle()`, `nextTrack()`, `previousTrack()`
   - Simulate progress advancement via `setInterval` when playing
   - Auto-advance to next track when progress reaches 1.0
2. Create `src/components/ui/PlaybackControls.tsx`
   - `"use client"` directive
   - Play/pause toggle button
   - Progress bar (muted violet fill on vinyl black track)
   - Current track name and elapsed time display
   - Previous/next track buttons
   - Positioned at the bottom of the viewport or within the detail panel
3. Connect playback state to `TrackList.tsx` for active track highlighting

**Acceptance**: Play/pause toggles simulated playback. Progress bar advances over time. Track auto-advances. Current track highlighted in tracklist. Muted violet accent used for playback state.

---

### M7: Polish and Responsiveness (Priority: Medium)

**Goal**: Optimize for mobile, ensure performance, and refine visual details.

Tasks:
1. Implement `src/components/scene/CylinderBase.tsx` idle animation
   - Slow continuous rotation via `useFrame` when no album is selected and no drag active
   - Stop rotation during drag or selection
2. Add touch gesture support in `useCarouselControls.ts`
   - Touch start/move/end mapped to same logic as mouse
   - Prevent default scroll behavior while dragging the scene
3. Responsive layout adjustments
   - Detail panel: full-width bottom sheet on mobile, side panel on desktop
   - Camera FOV/position adjustment for smaller viewports
   - Album size scaling for mobile screens
4. Performance guardrails
   - Dynamic import of `AlbumCarousel` to code-split Three.js from initial bundle
   - `performance={{ min: 0.5, max: 1 }}` on Canvas for DPR scaling on low-end devices
   - Lazy texture loading with low-res placeholders
5. Verify `frameloop="demand"` activates renders only on interaction or animation
6. Test with browser DevTools throttling (4x CPU slowdown)

**Acceptance**: Touch drag works on mobile. Detail panel adapts to viewport. No janky frame drops on mid-range devices. Idle rotation smooth at 60fps. Three.js bundle is code-split.

---

## Technical Approach

### Rendering Architecture

```
src/app/page.tsx (Server Component)
  |
  +-- dynamic(() => import('@/components/scene/AlbumCarousel'))  [Client, Code-Split]
        |
        +-- <Canvas frameloop="demand" dpr={[1,2]}>
              |
              +-- <Scene />          [Lighting, Camera, Background]
              +-- <group rotation>   [Rotatable album ring]
              |     +-- <Album />    [x8, circular positions]
              |     +-- <CylinderBase />
              +-- <AlbumGlow />      [Conditional, selected album only]
        |
        +-- <PlaylistDetail />       [2D overlay, conditional]
        +-- <PlaybackControls />     [2D overlay, conditional]
        +-- <AlbumHUD />             [2D overlay, conditional]
```

### State Flow

```
useCarouselState (selected album)
  --> Album.tsx (tilt-and-pull animation)
  --> PlaylistDetail.tsx (show/hide panel)
  --> AlbumHUD.tsx (show/hide label)
  --> AlbumGlow.tsx (show/hide glow)

useCarouselControls (rotation)
  --> <group> rotation (cylinder spin)
  --> CylinderBase.tsx (idle animation pause/resume)

usePlayback (playback simulation)
  --> PlaybackControls.tsx (play/pause, progress)
  --> TrackList.tsx (active track highlight)
```

### Key Implementation Decisions

1. **Dynamic import for Canvas**: The R3F Canvas and Three.js must be dynamically imported in `page.tsx` to prevent SSR failures and to code-split the ~500KB Three.js bundle away from the initial page load.

2. **frameloop="demand"**: The Canvas renders only when `invalidate()` is called (via pointer events, animations, or state changes), keeping GPU usage near zero when the scene is idle.

3. **2D HUD over 3D text**: All text stays in the DOM layer, positioned relative to projected 3D coordinates. This ensures crisp text at all resolutions and avoids the complexity of SDF text rendering in WebGL.

4. **Pointer events for input**: R3F provides built-in raycasting for `onClick`, `onPointerOver`, `onPointerOut` on meshes. Drag-to-rotate uses pointer events on the Canvas element itself.

5. **No external animation library**: Animations (Tilt-and-Pull, dust jacket fade, glow) use `useFrame` interpolation with `THREE.MathUtils.lerp` or `THREE.MathUtils.damp`. This avoids adding another dependency.

---

## Risk Analysis

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Three.js bundle size (~500KB) degrades initial load | High | Medium | Dynamic import + code splitting; lazy Canvas mount behind Suspense |
| SSR mismatch errors with R3F components | High | High | All R3F components use `"use client"`; Canvas dynamically imported with `ssr: false` |
| Touch drag conflicts with browser scroll/zoom | Medium | Medium | `touch-action: none` on Canvas element; `preventDefault` on touch events |
| Album textures cause memory pressure on mobile | Medium | Medium | Cap textures at 2048x2048; use WebP; lazy load with placeholders |
| Tilt-and-Pull animation feels wrong or breaks immersion | Medium | High | Iterative tuning of rotation angles, timing curves, and easing; reference real vinyl pulling motion |
| Frame drops on low-end mobile devices | Medium | High | DPR scaling with `performance` prop; reduce geometry complexity; test with CPU throttling |
| `frameloop="demand"` causes missed renders during animation | Low | Medium | Ensure `invalidate()` is called every frame during active animations via `useFrame` |
| Color-bleed glow appears garish or distracting | Low | Low | Use low-intensity point light or emissive material; sample muted version of album color |
| Next.js 16 breaking changes affect R3F integration | Low | High | Verify `transpilePackages` config; test with `next build` early in M2 |

---

## Exclusions (What NOT to Build)

1. **No YouTube Music API integration** -- Data comes exclusively from mock modules. API connectivity is a separate SPEC.
2. **No user authentication** -- No login, signup, sessions, or personalized content.
3. **No server-side data persistence** -- No database, no API routes for saving data. Pure client-side state.
4. **No actual audio playback** -- Playback controls simulate state (play/pause/progress) without producing audio.
5. **No search or filtering** -- Albums are presented in a fixed order; no search bar or filter controls.
6. **No carousel pagination arrows** -- Rotation is drag/swipe only per design direction.
7. **No accessibility features beyond basic keyboard support** -- Screen reader support for 3D WebGL content is deferred.

---

## Acceptance Criteria Preview

### AC1: Scene Renders on Load

**Given** the user navigates to the home page
**When** the page finishes loading
**Then** a 3D scene is displayed with a dark background, amber lighting, and 8+ album covers arranged in a circular formation inside a cylinder

### AC2: Drag-to-Rotate

**Given** the 3D carousel is visible and no album is selected
**When** the user clicks and drags horizontally (or swipe on touch)
**Then** the cylinder rotates in the drag direction with momentum easing

### AC3: Tilt-and-Pull Selection

**Given** the carousel is in its default browsing state
**When** the user clicks on an album cover
**Then** the selected album tilts forward out of the cylinder, remaining albums dim, the cylinder stops rotating, and a color-bleed glow appears behind the selected album

### AC4: Playlist Detail Display

**Given** an album has been selected via Tilt-and-Pull
**When** the selection animation completes
**Then** a detail panel slides in showing the album title, artist name, and a scrollable tracklist with track names and durations

### AC5: Playback Simulation

**Given** an album is selected and the detail panel is visible
**When** the user clicks the play button
**Then** the progress bar begins advancing, the current track is highlighted in violet in the tracklist, and the play button changes to a pause icon

### AC6: Deselection

**Given** an album is currently selected with the detail panel open
**When** the user clicks on empty space or a back/close control
**Then** the album returns to its position in the cylinder, the detail panel slides out, the glow disappears, and idle rotation resumes

### AC7: Idle Turntable Rotation

**Given** no album is selected and the user is not interacting
**When** the scene is idle for more than 2 seconds
**Then** the cylinder base slowly rotates, giving the scene a living quality

### AC8: Mobile Touch Support

**Given** the user is on a touch device
**When** the user swipes horizontally on the 3D scene
**Then** the cylinder rotates with the same behavior as desktop mouse drag
