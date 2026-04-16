## Task Decomposition
SPEC: SPEC-UI-001

| Task ID | Description | Requirement | Dependencies | Planned Files | Status |
|---------|-------------|-------------|--------------|---------------|--------|
| TAG-01 | Setup test infrastructure (Vitest + RTL + happy-dom) | Pre-req | - | vitest.config.ts | pending |
| TAG-02 | Create data foundation (types, mock data, colors) | R12 | TAG-01 | src/data/types.ts, src/data/mock-playlists.ts, src/lib/colors.ts | pending |
| TAG-03 | Implement carousel state hook (select/deselect) | R4 | TAG-02 | src/hooks/useCarouselState.ts | pending |
| TAG-04 | Implement playback hook (play/pause/progress) | R6 | TAG-02 | src/hooks/usePlayback.ts | pending |
| TAG-05 | Implement carousel controls + rotation math | R3, R13 | TAG-01 | src/hooks/useCarouselControls.ts | pending |
| TAG-06 | Setup 3D scene foundation + Next.js config | R1, R9, R11 | TAG-02 | src/components/scene/AlbumCarousel.tsx, src/components/scene/Scene.tsx, next.config.ts, src/app/globals.css | pending |
| TAG-07 | Build album carousel with circular arrangement | R2, R8 | TAG-05, TAG-06 | src/components/scene/Album.tsx, src/components/scene/CylinderBase.tsx | pending |
| TAG-08 | Implement Tilt-and-Pull interaction + glow | R4, R8, R9 | TAG-03, TAG-07 | src/components/scene/AlbumGlow.tsx | pending |
| TAG-09 | Build 2D UI components (detail panel, playback, HUD) | R5, R6, R10 | TAG-03, TAG-04 | src/components/ui/PlaylistDetail.tsx, src/components/ui/PlaybackControls.tsx, src/components/ui/AlbumHUD.tsx, src/components/ui/TrackList.tsx | pending |
| TAG-10 | Polish: responsive, idle animation, touch, performance | R7, R13, R14 | TAG-08, TAG-09 | src/app/page.tsx, src/app/layout.tsx | pending |
