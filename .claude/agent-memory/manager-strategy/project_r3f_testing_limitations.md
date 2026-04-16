---
name: R3F Testing Limitations with Vitest
description: Known issues with @react-three/test-renderer and Vitest constructor equality — affects TDD approach for 3D components
type: project
---

@react-three/test-renderer has known Vitest compatibility issues (as of 2025): constructor equality checks for Three.js class instances (Vector3, Euler, etc.) fail under Vitest's module isolation.

**Why:** R3F does constructor equality checks when updating props to avoid unnecessary re-instantiation. Vitest's module isolation causes different constructor references, breaking these checks.

**How to apply:**
- Limit R3F test renderer usage to structural tests (child count, scene graph shape) — avoid tests that compare Three.js class instances
- Extract pure math (rotation calculations, circular arrangement formulas) into standalone utility functions and test those directly
- Use React Testing Library for all 2D UI components (PlaylistDetail, TrackList, PlaybackControls)
- Accept that visual quality, animation smoothness, and performance (30 FPS) require manual verification
- If R3F test renderer proves completely unusable, fall back to smoke tests only (render without crash)
