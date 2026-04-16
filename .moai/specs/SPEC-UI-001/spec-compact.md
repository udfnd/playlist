---
id: SPEC-UI-001
version: 1.0.0
status: Planned
compact: true
---

# SPEC-UI-001: 3D Playlist Visualization (Compact)

## Requirements

### R1: Scene Rendering (Ubiquitous)
The system **shall** render a 3D scene containing a cylindrical album carousel using WebGL via React Three Fiber, displayed as the primary content of the home page.

### R2: Album Circular Arrangement (Ubiquitous)
The system **shall** arrange album covers in a circular formation within a cylindrical container.

### R3: Drag-to-Rotate (Event-Driven)
**When** the user drags on the 3D scene, the system **shall** rotate the cylinder in the direction of the drag gesture.

### R4: Album Selection (Event-Driven)
**When** the user clicks/taps an album, the system **shall** execute the Tilt-and-Pull animation: the selected album tilts forward out of the cylinder, the cylinder behind dims, and the playlist detail panel becomes visible.

### R5: Playlist Detail Display (Event-Driven)
**When** an album is selected, the system **shall** display a playlist detail panel containing album title, artist name, tracklist with track names and durations.

### R6: Playback Controls (Event-Driven)
**When** the user activates playback, the system **shall** display play/pause and track progress controls using muted violet (#6B5B8A) accent.

### R7: Idle Animation (State-Driven)
**While** no album is selected and no interaction is occurring, the system **shall** slowly rotate the cylinder base.

### R8: Inactive Album Appearance (State-Driven)
**While** an album is not selected or hovered, the system **shall** render a subtle translucent "dust jacket" overlay.

### R9: Lighting and Atmosphere (Ubiquitous)
The system **shall** use a single directional amber (#E8A84C) light from above with shadow gradients. Album cover colors **shall** bleed as a glow behind the focused item.

### R10: Typography Rendering (Ubiquitous)
The system **shall** render all text in a 2D HUD layer, using Geist Sans for UI text and Geist Mono for metadata, in cream white (#F5F0E6).

### R11: Client-Side Rendering (Ubiquitous)
All 3D components **shall** use the `"use client"` directive.

### R12: Mock Data Source (Ubiquitous)
The system **shall** source all data from a local mock data module with at least 8 albums.

### R13: Mobile Touch Support (Optional)
**Where** the device supports touch input, the system **shall** respond to touch gestures equivalently to mouse interaction.

### R14: Performance Baseline (Unwanted Behavior)
**If** the scene drops below 30 FPS, **then** the system **shall** reduce rendering quality via DPR scaling.

## Acceptance Criteria

### AC1: Scene renders with dark background, amber lighting, 8+ albums in circular formation
### AC2: Drag rotates cylinder with momentum easing
### AC3: Click triggers Tilt-and-Pull; remaining albums dim; glow appears
### AC4: Detail panel slides in with album info and scrollable tracklist
### AC5: Play/pause toggles simulated playback; progress bar advances
### AC6: Clicking empty space deselects; album returns; panel slides out
### AC7: Idle rotation activates after 2 seconds of no interaction
### AC8: Touch drag/tap works equivalently to mouse on mobile

## Files to Create/Modify

- `next.config.ts` (modify: add transpilePackages)
- `src/app/page.tsx` (modify: replace boilerplate)
- `src/app/layout.tsx` (modify: update metadata)
- `src/app/globals.css` (modify: add palette tokens)
- `src/data/types.ts` (new)
- `src/data/mock-playlists.ts` (new)
- `src/lib/colors.ts` (new)
- `src/components/scene/AlbumCarousel.tsx` (new)
- `src/components/scene/Scene.tsx` (new)
- `src/components/scene/Album.tsx` (new)
- `src/components/scene/CylinderBase.tsx` (new)
- `src/components/scene/AlbumGlow.tsx` (new)
- `src/components/ui/PlaylistDetail.tsx` (new)
- `src/components/ui/PlaybackControls.tsx` (new)
- `src/components/ui/AlbumHUD.tsx` (new)
- `src/components/ui/TrackList.tsx` (new)
- `src/hooks/useCarouselControls.ts` (new)
- `src/hooks/useCarouselState.ts` (new)
- `src/hooks/usePlayback.ts` (new)

## Exclusions

1. No YouTube Music API integration (separate SPEC)
2. No user authentication
3. No server-side data persistence
4. No actual audio playback (visual simulation only)
5. No search or filtering
6. No carousel pagination arrows
