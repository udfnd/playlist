# Research: 3D Playlist Visualization (SPEC-UI-001)

## Recommended Technology: React Three Fiber (R3F) + Three.js

**Rationale:**
- R3F v8+ supports React 19 and works with Next.js 16 (requires `transpilePackages: ['three']`)
- Declarative JSX-based 3D scene composition, natural React patterns
- Superior performance over CSS 3D for 10-20 textured objects (GPU-accelerated WebGL)
- Native raycasting and pointer events for click, drag, hover
- Drei library provides OrbitControls, texture loading, and utility helpers

**Why NOT CSS 3D?** Hits performance ceiling with texture-heavy elements. R3F offers better control and smoother drag-to-rotate physics.

## Architecture Approach

```
src/
├── components/
│   ├── AlbumCarousel/
│   │   ├── AlbumCarousel.tsx (Canvas container, "use client")
│   │   ├── useCarouselControls.ts (drag/rotation logic)
│   │   ├── Album.tsx (individual mesh + interactivity)
│   │   └── Scene.tsx (lighting, camera setup)
│   └── PlaylistDetail.tsx (overlay UI for selected album)
└── hooks/
    └── useCarouselState.ts (state for selected album)
```

**Key Pattern:**
- Wrap `<Canvas>` in `"use client"` directive (required for R3F in Next.js)
- Use `useFrame` for smooth rotation animation
- Circular arrangement: `angle = (index / count) * Math.PI * 2`
- Position: `x = radius * cos(angle)`, `z = radius * sin(angle)`
- Drag-to-rotate via pointer events

## Key Libraries

| Library | Version | Purpose |
|---------|---------|---------|
| three | ^0.170 | 3D rendering engine |
| @react-three/fiber | ^8.15+ | React renderer for Three.js |
| @react-three/drei | ^9.100+ | Utility helpers (controls, loaders) |

**Next.js Config Required:**
```typescript
const nextConfig: NextConfig = {
  transpilePackages: ['three'],
};
```

## Performance Considerations

1. **Texture Loading**: Lazy load with `THREE.TextureLoader`, cap at 2048x2048, WebP format
2. **Render Mode**: `frameloop="demand"` to reduce GPU load during static scenes
3. **DPR Scaling**: `performance={{ min: 0.5, max: 1 }}` for low-end devices
4. **Instance Count**: 10-20 albums fine with standard meshes; instancedMesh only for 100+

## Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| Three.js bundle size (500KB+) | Tree-shake unused modules; dynamic import Canvas |
| SSR incompatibility | Wrap R3F in "use client"; no server-side 3D |
| Mobile touch handling | Use pointer events with fallbacks |
| Texture CORS | Self-host textures or CORS-enabled CDN |
| Drag jank | Enable performance regression; cap album count in MVP |

## Reference Implementations

- Codrops: WebGL Carousel with R3F + GSAP (circular arrangement pattern)
- Caroumesh (GitHub): Open-source 3D carousel component
- react-circular-carousel (GitHub): Circular arrangement with drag/click
- Codrops: Wavy infinite carousels with GLSL shaders (2025)

## Current Project State

- No existing 3D libraries in package.json
- Fresh Create Next App boilerplate (src/app/page.tsx, layout.tsx)
- Tailwind CSS 4, TypeScript strict mode
- next.config.ts is empty/default — needs transpilePackages addition
