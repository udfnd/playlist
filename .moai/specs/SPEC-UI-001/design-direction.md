# Design Direction: 3D Playlist Visualization

## 1. Intent Statement

**Who:** Music lovers who treat listening as a ritual, not background noise.
**What:** A spatial, hands-on way to browse and play playlists through a 3D vinyl cylinder.
**Feel:** Tactile nostalgia meets low-lit modernism. The sensation of flipping through a crate of records at a late-night shop -- fingertips on spines, warm overhead light, the anticipation before the needle drops.

---

## 2. Domain Concepts

| Vinyl/Record Store Concept | UI Translation |
|---|---|
| **Record crate** | The cylindrical container itself -- albums stand upright inside it like vinyl in a bin |
| **Spine browsing** | Albums show spine-edge by default; the facing album rotates outward to reveal full cover |
| **Needle drop** | The transition from browsing to playback -- a deliberate, weighted moment |
| **Liner notes** | Playlist detail panel: tracklist, duration, mood metadata |
| **Dust jacket** | Subtle translucent overlay on inactive albums, implying they are sleeved and waiting |
| **Turntable platter** | The circular base of the cylinder, slowly rotating when idle |

---

## 3. Color World

| Association | Role | Notes |
|---|---|---|
| **Matte black (#0A0A0A)** | Scene background | Deep void for 3D depth; eliminates visual edges |
| **Warm amber (#E8A84C)** | Primary accent / spotlight | Simulates a single overhead bulb in a record shop |
| **Cream white (#F5F0E6)** | Typography, UI chrome | Analog warmth; never clinical pure-white |
| **Vinyl black (#1A1A1A)** | Cylinder surface, card backgrounds | Distinguishable from void, suggests physical material |
| **Muted violet (#6B5B8A)** | Playback state / progress | Cooler counterpoint to amber; indicates active audio |
| **Highlight bleed** | Album cover colors sampled at runtime | Subtle color-bleed glow behind the focused album, unique per cover |

Lighting: A single directional amber light from above. Albums facing the user catch the light; receding albums fall into shadow. This gradient replaces any need for borders or separators.

---

## 4. Signature Element

**The Tilt-and-Pull.** When a user selects an album, it does not simply enlarge. It tilts forward out of the cylinder -- the way you would pull a record halfway out of a crate to inspect the cover. The album hangs at an angle, cover art now fully visible, while the cylinder behind dims and halts. This single interaction is the identity of the entire UI: physical, intentional, unmistakably about records.

---

## 5. Defaults to Avoid

1. **Flat grid of album covers.** Eliminates the spatial metaphor entirely. This is a Spotify clone, not what we are building.
2. **Generic left/right carousel arrows.** Breaks the "crate digging" physicality. Rotation must be driven by drag/swipe gesture, never by pagination buttons.
3. **Modal overlay for album details.** A centered modal kills the 3D scene. Details should emerge within the spatial context -- a panel that slides in from the side or unfolds from the album itself.
4. **Glossy/skeuomorphic textures.** Photorealistic wood grain or chrome would age immediately. Stay matte, geometric, and restrained.

---

## 6. Typography

**Geist Sans** for all UI text: tracklist, album titles, controls. Set in cream white, medium weight, with generous letter-spacing to breathe against dark backgrounds.

**Geist Mono** reserved for metadata that benefits from fixed-width alignment: track durations, timestamps, playback position.

Inside the 3D scene, avoid rendering HTML text on 3D surfaces. Album titles appear in a 2D HUD layer anchored to the selected album's screen position -- always crisp, never warped by perspective.
