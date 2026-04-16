---
name: SPEC-UI-001 Dependency Version Corrections
description: Critical version corrections for R3F ecosystem — SPEC pins v8/v9 but React 19 requires fiber v9, drei v10
type: project
---

SPEC-UI-001 specifies @react-three/fiber ^8.15 and @react-three/drei ^9.100, but the project uses React 19.2.4 which requires fiber v9+ and drei v10+.

**Why:** R3F v9 is a compatibility release specifically for React 19. The internal reconciler was rebundled to handle React 19.2.x's breaking reconciler version bump. Using v8 will cause runtime crashes.

**How to apply:** When implementing SPEC-UI-001, use these corrected versions:
- @react-three/fiber: ^9.5.0 (not ^8.15)
- @react-three/drei: ^10.7.0 (not ^9.100)
- three: ^0.170.0 (unchanged)
- @types/three: ^0.170.0 (unchanged)
