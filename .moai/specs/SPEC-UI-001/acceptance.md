---
id: SPEC-UI-001
version: 1.0.0
status: Planned
created: 2026-04-14
updated: 2026-04-14
type: acceptance
---

# Acceptance Criteria: SPEC-UI-001 -- 3D Playlist Visualization

## Test Scenarios

### TS-01: 3D Scene Initial Render

**Given** the user navigates to the home page (`/`)
**When** the page finishes loading and the Canvas mounts
**Then**:
- A 3D scene is displayed with matte black (#0A0A0A) background
- A directional amber (#E8A84C) light illuminates the scene from above
- At least 8 album covers are visible, arranged in a circular formation
- A cylindrical base (turntable platter) is visible beneath the albums
- No server-side rendering errors appear in the console
- The R3F Canvas uses `frameloop="demand"`

### TS-02: Album Cover Textures

**Given** the 3D scene has loaded
**When** the albums are rendered
**Then**:
- Each album displays its unique cover art texture
- Inactive albums show a subtle translucent dust jacket overlay
- Albums facing the user are lit by the amber spotlight
- Albums receding from the user fall into shadow (natural light gradient)

### TS-03: Drag-to-Rotate (Mouse)

**Given** the carousel is in browsing state (no album selected)
**When** the user clicks and drags horizontally on the Canvas
**Then**:
- The album cylinder rotates in the direction of the drag
- Rotation has momentum (continues briefly after release with easing)
- Rotation speed is proportional to drag velocity
- Albums smoothly pass through the lit zone

### TS-04: Drag-to-Rotate (Touch)

**Given** the carousel is on a touch-capable device
**When** the user swipes horizontally on the Canvas
**Then**:
- The cylinder rotates with the same behavior as mouse drag
- Vertical scroll is not hijacked (only horizontal swipe triggers rotation)
- Multi-touch zoom does not interfere with rotation

### TS-05: Album Hover Effect

**Given** the carousel is in browsing state
**When** the user hovers over an album (pointer over the mesh)
**Then**:
- The dust jacket overlay fades to reveal the cover more clearly
- The album brightens slightly compared to its neighbors
- The cursor changes to indicate interactivity

### TS-06: Tilt-and-Pull Selection

**Given** the carousel is in browsing state
**When** the user clicks on an album cover
**Then**:
- The selected album tilts forward (X-axis rotation) out of the cylinder
- The album translates outward (Z-axis) toward the viewer
- The dust jacket is fully removed from the selected album
- A color-bleed glow appears behind the selected album (color from album's dominant color)
- Remaining albums dim (reduced opacity or darkened material)
- Cylinder drag-to-rotate is disabled
- Idle turntable rotation stops

### TS-07: Playlist Detail Panel Appearance

**Given** an album is selected via Tilt-and-Pull
**When** the selection animation completes
**Then**:
- A detail panel slides in from the right side of the viewport (desktop) or slides up from the bottom (mobile)
- The panel displays: album title (Geist Sans, cream white), artist name, total track count, total duration
- A scrollable tracklist shows each track with: track number, track name (Geist Sans), duration (Geist Mono)
- The panel background is vinyl black (#1A1A1A) with cream white (#F5F0E6) text

### TS-08: Album HUD Label

**Given** an album is selected
**When** the detail view is active
**Then**:
- A 2D text label (album title + artist) appears near the selected album's screen position
- The label is rendered in the DOM layer (not in WebGL)
- The label uses Geist Sans, cream white, medium weight
- The label position updates if the viewport is resized

### TS-09: Playback Play/Pause

**Given** an album is selected and the detail panel is visible
**When** the user clicks the play button
**Then**:
- The play icon changes to a pause icon
- The progress bar begins advancing from left to right
- The current track is highlighted with muted violet (#6B5B8A) in the tracklist
- Current track name and elapsed time are displayed

**When** the user clicks the pause button
**Then**:
- The pause icon changes back to a play icon
- The progress bar stops advancing
- The track highlight remains on the current track

### TS-10: Track Auto-Advance

**Given** playback is active and a track is playing
**When** the progress bar reaches 100% (track ends)
**Then**:
- Playback automatically advances to the next track in the tracklist
- The progress bar resets to 0% and begins advancing again
- The violet highlight moves to the new current track
- If the last track finishes, playback stops and resets to the first track

### TS-11: Deselection

**Given** an album is currently selected
**When** the user clicks on empty 3D space or a close/back control
**Then**:
- The selected album animates back to its original position in the cylinder
- The color-bleed glow disappears
- The detail panel slides out
- The HUD label fades away
- Remaining albums return to normal brightness
- Cylinder drag-to-rotate is re-enabled
- Idle turntable rotation resumes after a brief pause

### TS-12: Idle Turntable Animation

**Given** no album is selected and the user has not interacted for 2+ seconds
**When** the scene is idle
**Then**:
- The cylinder base rotates slowly and continuously
- The rotation is smooth (no stuttering at low RPM)
- Rotation stops immediately when the user begins a drag gesture
- Rotation stops when an album is selected

### TS-13: Performance Under Load

**Given** the scene is fully loaded with 8+ textured albums
**When** the user interacts with the carousel (drag, hover, select)
**Then**:
- Frame rate does not drop below 30 FPS on a mid-range device
- DPR scaling engages if performance drops below threshold
- No visible texture pop-in during normal interaction speed
- Memory usage remains stable (no leaks from texture loading)

### TS-14: Dynamic Import and Bundle Split

**Given** the application is built for production (`next build`)
**When** the user loads the home page
**Then**:
- The Three.js bundle is loaded asynchronously (not in the main JS bundle)
- A loading fallback is shown while the Canvas initializes
- The initial page load (before 3D assets) completes within acceptable bounds

## Edge Cases

### EC-01: Empty/Missing Cover Art

**Given** a mock album has a missing or invalid cover image path
**When** the scene renders
**Then** a fallback solid-color texture (vinyl black) is displayed for that album

### EC-02: Rapid Selection/Deselection

**Given** the user clicks an album to select it
**When** the user immediately clicks elsewhere before the Tilt-and-Pull animation completes
**Then** the animation cleanly reverses without visual glitches

### EC-03: Viewport Resize During Selection

**Given** an album is selected and the detail panel is open
**When** the browser window is resized
**Then** the detail panel adapts to the new layout, the HUD label repositions, and the 3D scene adjusts its camera aspect ratio

### EC-04: Very Small Viewport

**Given** the viewport width is below 360px
**When** the scene renders
**Then** the carousel remains functional with reduced album sizes and the detail panel uses full-width bottom sheet layout

## Quality Gate Criteria

| Gate | Requirement |
|------|------------|
| Build | `next build` completes without errors |
| Lint | `eslint` passes with zero errors |
| Type Check | `tsc --noEmit` passes with zero errors |
| SSR Safety | No "window is not defined" or hydration mismatch errors |
| Performance | 30+ FPS on mid-range device with 8 textured albums |
| Bundle | Three.js is code-split from main bundle (verified via build output) |
| Responsiveness | Functional on viewports from 360px to 2560px wide |

## Definition of Done

- [ ] All 14 test scenarios pass via manual verification
- [ ] All 4 edge cases handled
- [ ] All 7 quality gate criteria met
- [ ] Mock data contains at least 8 albums with complete tracklists
- [ ] All 3D components use `"use client"` directive
- [ ] No actual audio playback (controls are visual simulation only)
- [ ] No external API calls (all data from mock modules)
- [ ] `frameloop="demand"` configured on Canvas
- [ ] `transpilePackages: ['three']` in next.config.ts
- [ ] Cover textures are WebP format, max 2048x2048
