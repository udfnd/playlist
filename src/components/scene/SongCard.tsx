'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Mesh, Group } from 'three';
import type { Song } from '@/data/types';
import { generateCoverTexture, loadThumbnailTexture } from '@/lib/cover-generator';

export interface CardTransform {
  position: [number, number, number];
  quaternion: [number, number, number, number];
  scale: number;
}

interface SongCardProps {
  song: Song;
  index: number;
  originalIndex: number;
  totalCards: number;
  rotation: number;
  radius: number;
  hidden?: boolean;
  /**
   * True when another card has been selected and the scene is transitioning to/displaying
   * the detail view. This card should recede — shrink toward side-thumbnail size and fade
   * to a low opacity — so it doesn't visually compete with the moving TransitionCard.
   */
  isGhost?: boolean;
  onSelect: (id: string, transform: CardTransform) => void;
}

const CARD_SIZE = 1.8;

// Layout is driven by continuous slot offset s = angle / slotStep (wrapped to (-N/2, N/2]).
// At any instant AT MOST ONE card has |s| < CENTER_HANDOFF_S, so at most one card is pulled
// toward the center — the other cards stay on the side arc. No center overlap is possible.
// Weight uses a cosine ramp (0 at boundary → 1 at s=0) with NO plateau, so the card is in
// smooth motion throughout the entire approach rather than popping into place near center.
const CENTER_HANDOFF_S = 0.5; // |s| at/above this → card stays on side arc (weight=0)

// Side strip arc:
//   first side slot sits at SIDE_START_ANGLE from front, subsequent slots SIDE_STEP_ANGLE apart.
//   cards past SIDE_FADE_START fade out as they wrap to the back of the drum.
const SIDE_START_ANGLE = (20 * Math.PI) / 180;
const SIDE_STEP_ANGLE = (10 * Math.PI) / 180;
const SIDE_FADE_START = (70 * Math.PI) / 180;
const SIDE_FADE_END = (90 * Math.PI) / 180;

const CENTER_SCALE = 1.4;
const SIDE_SCALE = 0.68;
const CENTER_OPACITY = 1.0;
const SIDE_OPACITY = 0.78;

const FEATURED_RENDER_ORDER = 100;

// How much the billboard lookAt target is pulled from the camera toward the scene origin.
// 0 = pure billboard (current baseline), 1 = look straight at origin (cards would show backs).
// Small values just nudge side cards to face the center a bit more than baseline.
const CENTER_PULL = 0.3;

// Ghost-mode targets — values the card's scale / opacity collapse to while another card
// is taking over the scene. Tuned to match the visual weight of a side thumbnail, so the
// clicked side card doesn't feel like it's launching over a frozen center card.
const GHOST_SCALE = SIDE_SCALE;
const GHOST_OPACITY = 0.18;
// Damping "speed" constant for THREE.MathUtils.damp — ≈ 140ms time constant so the center
// card collapses briskly the moment a side card is selected.
const GHOST_DAMP_SPEED = 12;

export function SongCard({
  song,
  index,
  originalIndex,
  totalCards,
  rotation,
  radius,
  hidden,
  isGhost,
  onSelect,
}: SongCardProps) {
  const meshRef = useRef<Mesh>(null);
  const groupRef = useRef<Group>(null);
  const cameraTargetRef = useRef(new THREE.Vector3());
  const worldPosRef = useRef(new THREE.Vector3());
  const ghostAmountRef = useRef(0);

  const coverTexture = useMemo(
    () =>
      song.thumbnailUrl
        ? loadThumbnailTexture(song.thumbnailUrl)
        : generateCoverTexture(
            song.title,
            song.artist,
            song.color,
            originalIndex,
          ),
    [song.thumbnailUrl, song.title, song.artist, song.color, originalIndex],
  );

  useFrame((threeState, delta) => {
    if (!meshRef.current || !groupRef.current) return;

    if (hidden) {
      meshRef.current.visible = false;
      return;
    }

    // Damp the ghost-mode blend toward 1 while another card is taking over, back to 0 when
    // that card returns. Using damp (critically-damped exponential) keeps the motion
    // framerate-independent and free of overshoot.
    const ghostTarget = isGhost ? 1 : 0;
    ghostAmountRef.current = THREE.MathUtils.damp(
      ghostAmountRef.current,
      ghostTarget,
      GHOST_DAMP_SPEED,
      delta,
    );

    const slotStep = (2 * Math.PI) / totalCards;

    // Signed angle from front slot, wrapped to (-π, π].
    const baseAngle = index * slotStep;
    let angle = (baseAngle + rotation) % (2 * Math.PI);
    if (angle > Math.PI) angle -= 2 * Math.PI;
    if (angle <= -Math.PI) angle += 2 * Math.PI;

    // Continuous signed slot offset — exactly one card satisfies |s| < 0.5 at any time.
    const s = angle / slotStep;
    const sAbs = Math.abs(s);
    const sSign = s === 0 ? 1 : Math.sign(s);

    // Cosine-squared ramp: weight = cos²(π|s| / (2·handoff)). Derivative is zero at both
    // endpoints (s=0 and s=handoff), giving a natural ease-in-ease-out motion for position,
    // scale and opacity simultaneously. Equivalent to (1 + cos(π|s|/handoff)) / 2.
    const centerWeight =
      sAbs >= CENTER_HANDOFF_S
        ? 0
        : 0.5 * (1 + Math.cos((Math.PI * sAbs) / CENTER_HANDOFF_S));

    // Side slot position — independent of centerWeight so the side arc never moves into center.
    const sideSlotOffset = Math.max(0, sAbs - CENTER_HANDOFF_S);
    const sideAngleMag = SIDE_START_ANGLE + sideSlotOffset * SIDE_STEP_ANGLE;
    const sideAngle = sSign * sideAngleMag;
    const sidePosX = radius * Math.sin(sideAngle);
    const sidePosZ = radius * Math.cos(sideAngle);

    // Blend between side arc position and center; only the card with centerWeight>0 is pulled in.
    const px = THREE.MathUtils.lerp(sidePosX, 0, centerWeight);
    const pz = THREE.MathUtils.lerp(sidePosZ, radius, centerWeight);
    groupRef.current.position.set(px, 0, pz);

    // Billboard toward the camera, vertically aligned. The target is pulled slightly from
    // the camera position toward the scene origin so side cards face a touch more toward
    // the carousel center than pure billboard would.
    // IMPORTANT: camera.position is WORLD-space, but groupRef.current.position is local to
    // the parent. We must clamp the target's Y to the card's WORLD Y so the card stays
    // vertical — otherwise the parent offset (y=1) causes a forward bow.
    const worldPos = worldPosRef.current;
    groupRef.current.getWorldPosition(worldPos);
    const tgt = cameraTargetRef.current;
    tgt.copy(threeState.camera.position);
    tgt.multiplyScalar(1 - CENTER_PULL);
    tgt.y = worldPos.y;
    groupRef.current.lookAt(tgt);

    // Scale lerps naturally because rotation itself is smooth (drag + snap easing).
    const targetScale = THREE.MathUtils.lerp(
      SIDE_SCALE,
      CENTER_SCALE,
      centerWeight,
    );
    // When ghosted (another card was selected), recede toward the small side-thumbnail size
    // so the clicked card doesn't fly over a full-size center card.
    const appliedScale = THREE.MathUtils.lerp(
      targetScale,
      GHOST_SCALE,
      ghostAmountRef.current,
    );
    groupRef.current.scale.setScalar(appliedScale);

    // Side cards that have wrapped past ~70° fade out as they drift to the back.
    const sideVisibility =
      1 -
      THREE.MathUtils.smoothstep(
        Math.abs(sideAngle),
        SIDE_FADE_START,
        SIDE_FADE_END,
      );

    const sideOpacityPart = (1 - centerWeight) * SIDE_OPACITY * sideVisibility;
    const centerOpacityPart = centerWeight * CENTER_OPACITY;
    const targetOpacity = centerOpacityPart + sideOpacityPart;

    // Ghost fade — collapse opacity toward GHOST_OPACITY, but clamp the ghost target to
    // the card's current targetOpacity so cards that were ALREADY invisible (wrapped to the
    // back of the drum) don't suddenly gain visibility during transition.
    const ghostOpacityTarget = Math.min(targetOpacity, GHOST_OPACITY);
    const appliedOpacity = THREE.MathUtils.lerp(
      targetOpacity,
      ghostOpacityTarget,
      ghostAmountRef.current,
    );

    const mat = meshRef.current.material as THREE.MeshBasicMaterial;
    mat.opacity = appliedOpacity;
    meshRef.current.visible = appliedOpacity > 0.01;

    const brightness = THREE.MathUtils.lerp(0.72, 1.0, centerWeight);
    mat.color.setRGB(brightness, brightness, brightness);

    // Center card always wins the render order so the crossfade never shows a side card
    // blending on top of the incoming center card.
    const depthOrder = Math.round(pz * 100);
    if (centerWeight > 0.01) {
      meshRef.current.renderOrder =
        FEATURED_RENDER_ORDER + depthOrder + Math.round(centerWeight * 1000);
    } else {
      meshRef.current.renderOrder = depthOrder;
    }
    mat.depthWrite = centerWeight > 0.05;

    threeState.invalidate();
  });

  return (
    <group ref={groupRef}>
      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation();
          // All visible cards are clickable. Faded cards have mesh.visible=false and are
          // automatically skipped by the raycaster, so no extra gate is needed here.
          const wp = new THREE.Vector3();
          e.object.getWorldPosition(wp);
          const wq = new THREE.Quaternion();
          e.object.getWorldQuaternion(wq);
          const ws = new THREE.Vector3();
          e.object.getWorldScale(ws);
          onSelect(song.id, {
            position: [wp.x, wp.y, wp.z],
            quaternion: [wq.x, wq.y, wq.z, wq.w],
            scale: ws.x,
          });
        }}
      >
        <planeGeometry args={[CARD_SIZE, CARD_SIZE]} />
        <meshBasicMaterial
          map={coverTexture}
          side={THREE.DoubleSide}
          transparent
        />
      </mesh>
    </group>
  );
}
