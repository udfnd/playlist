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
}

interface SongCardProps {
  song: Song;
  index: number;
  originalIndex: number;
  totalCards: number;
  rotation: number;
  radius: number;
  hidden?: boolean;
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

export function SongCard({
  song,
  index,
  originalIndex,
  totalCards,
  rotation,
  radius,
  hidden,
  onSelect,
}: SongCardProps) {
  const meshRef = useRef<Mesh>(null);
  const groupRef = useRef<Group>(null);
  const isFrontRef = useRef(false);
  const cameraTargetRef = useRef(new THREE.Vector3());

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

  useFrame((threeState) => {
    if (!meshRef.current || !groupRef.current) return;

    if (hidden) {
      meshRef.current.visible = false;
      return;
    }

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

    // Billboard toward the camera, vertically aligned.
    const tgt = cameraTargetRef.current;
    tgt.copy(threeState.camera.position);
    tgt.y = groupRef.current.position.y;
    groupRef.current.lookAt(tgt);

    // Scale lerps naturally because rotation itself is smooth (drag + snap easing).
    const targetScale = THREE.MathUtils.lerp(
      SIDE_SCALE,
      CENTER_SCALE,
      centerWeight,
    );
    groupRef.current.scale.setScalar(targetScale);

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

    const mat = meshRef.current.material as THREE.MeshBasicMaterial;
    mat.opacity = targetOpacity;
    meshRef.current.visible = targetOpacity > 0.01;

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

    isFrontRef.current = centerWeight > 0.8;

    threeState.invalidate();
  });

  return (
    <group ref={groupRef}>
      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation();
          if (!isFrontRef.current) return;
          const wp = new THREE.Vector3();
          e.object.getWorldPosition(wp);
          const wq = new THREE.Quaternion();
          e.object.getWorldQuaternion(wq);
          onSelect(song.id, {
            position: [wp.x, wp.y, wp.z],
            quaternion: [wq.x, wq.y, wq.z, wq.w],
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
