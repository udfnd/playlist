---
id: SPEC-UI-001
version: 1.0.0
status: Planned
created: 2026-04-14
updated: 2026-04-14
author: manager-spec
priority: High
issue_number: null
---

# SPEC-UI-001: 3D Playlist Visualization

## HISTORY

| Version | Date | Author | Change |
|---------|------|--------|--------|
| 1.0.0 | 2026-04-14 | manager-spec | Initial specification |

## Overview

A creative 3D visualization of music playlists using a vinyl-crate metaphor. Albums are displayed as upright covers inside a cylindrical container, arranged in a circle and rendered with WebGL via React Three Fiber. Users rotate the cylinder by dragging and select an album to view playlist details and a simple playback UI.

## Requirements

### R1: Scene Rendering (Ubiquitous)

The system **shall** render a 3D scene containing a cylindrical album carousel using WebGL via React Three Fiber, displayed as the primary content of the home page.

### R2: Album Circular Arrangement (Ubiquitous)

The system **shall** arrange album covers in a circular formation within a cylindrical container, with each album positioned using the formula `angle = (index / count) * PI * 2`, `x = radius * cos(angle)`, `z = radius * sin(angle)`.

### R3: Drag-to-Rotate (Event-Driven)

**When** the user drags (mouse or touch) on the 3D scene, the system **shall** rotate the cylinder in the direction of the drag gesture, allowing the user to browse through albums.

### R4: Album Selection (Event-Driven)

**When** the user clicks/taps an album, the system **shall** execute the Tilt-and-Pull animation: the selected album tilts forward out of the cylinder (like pulling a record from a crate), the cylinder behind dims, and the playlist detail panel becomes visible.

### R5: Playlist Detail Display (Event-Driven)

**When** an album is selected, the system **shall** display a playlist detail panel containing the album title, artist name, tracklist with track names and durations, and total playlist duration.

### R6: Playback Controls (Event-Driven)

**When** the user activates playback from a selected album, the system **shall** display play/pause and track progress controls using the muted violet (#6B5B8A) accent color for active playback state.

### R7: Idle Animation (State-Driven)

**While** no album is selected and no user interaction is occurring, the system **shall** slowly rotate the cylinder base (turntable platter) to create a living, idle state.

### R8: Inactive Album Appearance (State-Driven)

**While** an album is not selected or hovered, the system **shall** render a subtle translucent "dust jacket" overlay on the album, implying the album is sleeved and waiting.

### R9: Lighting and Atmosphere (Ubiquitous)

The system **shall** use a single directional amber (#E8A84C) light from above with shadow gradients replacing borders, and album cover colors **shall** bleed as a glow behind the focused item.

### R10: Typography Rendering (Ubiquitous)

The system **shall** render all text in a 2D HUD layer (never on 3D surfaces), using Geist Sans for UI text and Geist Mono for metadata, in cream white (#F5F0E6).

### R11: Client-Side Rendering (Ubiquitous)

The system **shall** render all 3D components as client components using the `"use client"` directive, as React Three Fiber is incompatible with server-side rendering.

### R12: Mock Data Source (Ubiquitous)

The system **shall** source all album and playlist data from a local mock data module containing at least 8 albums with tracklists, cover image paths, and metadata.

### R13: Mobile Touch Support (Optional)

**Where** the device supports touch input, the system **shall** respond to touch drag gestures for cylinder rotation and touch tap for album selection, with equivalent behavior to mouse interaction.

### R14: Performance Baseline (Unwanted Behavior)

**If** the 3D scene drops below 30 FPS on a mid-range device, **then** the system **shall** reduce rendering quality via DPR scaling to maintain acceptable frame rates.

## Non-Functional Requirements

### NFR1: Bundle Size

Three.js adds approximately 500KB to the bundle. The Canvas component and 3D dependencies must be dynamically imported to avoid blocking initial page load.

### NFR2: Texture Constraints

Album cover textures must be capped at 2048x2048 pixels and use WebP format where possible.

### NFR3: Render Efficiency

The R3F Canvas must use `frameloop="demand"` to minimize GPU load when the scene is static.

## Exclusions (What NOT to Build)

1. **No YouTube Music API integration** -- External API connectivity is deferred to a separate SPEC (SPEC-API-xxx). This SPEC uses mock data exclusively.
2. **No user authentication or accounts** -- No login, signup, or personalized data. The visualization operates anonymously with static data.
3. **No server-side data persistence** -- No database, no API routes for saving state. All data is client-side mock data.
4. **No actual audio playback** -- Playback controls are visual-only (UI state simulation). Wiring to a real audio source is out of scope.
5. **No carousel pagination arrows** -- Per design direction, rotation is driven exclusively by drag/swipe gesture.
6. **No modal overlays** -- Album details emerge within the spatial context (side panel), never as a centered modal that obscures the 3D scene.

## Dependencies

| Dependency | Type | Notes |
|-----------|------|-------|
| three ^0.170 | npm package | 3D rendering engine |
| @react-three/fiber ^8.15 | npm package | React renderer for Three.js |
| @react-three/drei ^9.100 | npm package | Utility helpers (controls, loaders) |
| next.config.ts update | Configuration | `transpilePackages: ['three']` |
