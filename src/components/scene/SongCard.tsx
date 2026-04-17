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
  position: [number, number, number];
  rotation: number;
  isSelected: boolean;
  isAnySelected: boolean;
  hidden?: boolean;
  onSelect: (id: string, transform: CardTransform) => void;
}

const LERP_SPEED = 0.08;
const CARD_SIZE = 1.8;
const CAROUSEL_RADIUS = 4.8;

// Layout zones based on angular distance from front slot (|atan2(worldX, worldZ)|):
//
//   [0 … FEATURED_END]          Center slot — big face-on card, the selection target.
//   [FEATURED_END … GAP_END]    Gap — invisible breathing space.
//   [GAP_END … SIDE_FADE_START] Side strip — small face-on thumbnails that preview
//                               the rest of the playlist.
//   [SIDE_FADE_START … SIDE_END] Soft fade as cards wrap to the back.
//   [SIDE_END … π]              Hidden (behind the drum).
//
// The featured cap at 11° is just under the half-slot (11.25° for 16 cards), which guarantees
// that at most ONE card can ever be inside the center zone.
const FEATURED_END = (11 * Math.PI) / 180; // 11°
const GAP_END = (18 * Math.PI) / 180; // 18°
const SIDE_FADE_START = (70 * Math.PI) / 180; // 70°
const SIDE_END = (88 * Math.PI) / 180; // 88°

const FEATURED_SCALE = 1.4;
const SIDE_SCALE = 0.7;

const FEATURED_OPACITY = 1.0;
const SIDE_OPACITY = 0.75;

const SCALE_LERP = 0.22;
const OPACITY_LERP = 0.3;
const BASE_RENDER_ORDER = 0;
const FEATURED_RENDER_ORDER = 100;

export function SongCard({
  song,
  index,
  position,
  rotation,
  isSelected,
  isAnySelected,
  hidden,
  onSelect,
}: SongCardProps) {
  const meshRef = useRef<Mesh>(null);
  const groupRef = useRef<Group>(null);
  const dimRef = useRef(1);
  const scaleRef = useRef(SIDE_SCALE);
  const isFrontRef = useRef(true);
  const worldPosTemp = useMemo(() => new THREE.Vector3(), []);
  const cameraTargetTemp = useMemo(() => new THREE.Vector3(), []);

  const coverTexture = useMemo(
    () =>
      song.thumbnailUrl
        ? loadThumbnailTexture(song.thumbnailUrl)
        : generateCoverTexture(song.title, song.artist, song.color, index),
    [song.thumbnailUrl, song.title, song.artist, song.color, index],
  );

  useFrame((threeState) => {
    if (!meshRef.current || !groupRef.current) return;

    if (hidden) {
      meshRef.current.visible = false;
      return;
    }

    groupRef.current.getWorldPosition(worldPosTemp);
    const worldAngDist = Math.abs(
      Math.atan2(worldPosTemp.x, worldPosTemp.z),
    );
    isFrontRef.current = worldPosTemp.z > 0 && worldAngDist <= FEATURED_END;

    // --- Billboard: always face the camera ---
    // lookAt works in world space. Using the camera's X/Z but keeping the card
    // vertically aligned (no pitch) feels more like a real rotating rack.
    cameraTargetTemp.copy(threeState.camera.position);
    cameraTargetTemp.y = worldPosTemp.y;
    groupRef.current.lookAt(cameraTargetTemp);

    // --- Zone-based scale + opacity ---
    // featuredAmount ramps up inside the center zone, then fades out through the gap.
    const featuredAmount =
      1 - THREE.MathUtils.smoothstep(worldAngDist, 0, FEATURED_END);
    const gapAmount = THREE.MathUtils.smoothstep(
      worldAngDist,
      FEATURED_END,
      GAP_END,
    );
    const sideVisibleAmount =
      1 -
      THREE.MathUtils.smoothstep(worldAngDist, SIDE_FADE_START, SIDE_END);

    // Scale: interpolate between side thumbnail size and featured full size.
    const targetScale = THREE.MathUtils.lerp(
      SIDE_SCALE,
      FEATURED_SCALE,
      featuredAmount,
    );
    scaleRef.current = THREE.MathUtils.lerp(
      scaleRef.current,
      targetScale,
      SCALE_LERP,
    );
    groupRef.current.scale.setScalar(scaleRef.current);

    // Opacity has three regions:
    //   featured (inside FEATURED_END)           → 1.0
    //   gap (FEATURED_END … GAP_END)              → fades 1.0 → 0 → SIDE_OPACITY
    //   side (GAP_END … SIDE_FADE_START)          → SIDE_OPACITY
    //   side fade (SIDE_FADE_START … SIDE_END)    → SIDE_OPACITY → 0
    //   back (beyond SIDE_END)                    → 0
    let targetOpacity: number;
    if (worldAngDist <= FEATURED_END) {
      targetOpacity = FEATURED_OPACITY;
    } else if (worldAngDist <= GAP_END) {
      // Dip to zero in the middle of the gap, then rise back to side opacity.
      const gapMid = gapAmount < 0.5 ? gapAmount * 2 : (1 - gapAmount) * 2;
      targetOpacity =
        worldAngDist < (FEATURED_END + GAP_END) / 2
          ? THREE.MathUtils.lerp(FEATURED_OPACITY, 0, gapAmount * 2)
          : THREE.MathUtils.lerp(0, SIDE_OPACITY, (gapAmount - 0.5) * 2);
      // Unused helper kept above in case of future tuning.
      void gapMid;
    } else if (worldAngDist <= SIDE_FADE_START) {
      targetOpacity = SIDE_OPACITY;
    } else {
      targetOpacity = SIDE_OPACITY * sideVisibleAmount;
    }

    const mat = meshRef.current.material as THREE.MeshBasicMaterial;
    mat.opacity = THREE.MathUtils.lerp(
      mat.opacity,
      targetOpacity,
      OPACITY_LERP,
    );
    meshRef.current.visible = mat.opacity > 0.005;

    // Render ordering has TWO tiers so that:
    //   (1) within each tier, closer-to-camera (higher worldZ) wins,
    //   (2) any card inside the featured zone always beats cards in the side strip — no ambiguity
    //       during the fade-in/fade-out crossover between two neighbouring cards.
    // This guarantees the single card currently entering the center is visibly on top.
    const depthOrder = Math.round(worldPosTemp.z * 100); // -480..+480 for radius 4.8
    if (featuredAmount > 0) {
      meshRef.current.renderOrder =
        FEATURED_RENDER_ORDER + depthOrder + Math.round(featuredAmount * 1000);
    } else {
      meshRef.current.renderOrder = depthOrder;
    }
    mat.depthWrite = featuredAmount > 0.05;

    // Subtle brightness dimming so side cards feel slightly recessed.
    const selectionTarget = 1;
    dimRef.current = THREE.MathUtils.lerp(dimRef.current, selectionTarget, LERP_SPEED);
    const brightness = THREE.MathUtils.lerp(0.65, 1.0, featuredAmount);
    const d = brightness * dimRef.current;
    mat.color.setRGB(d, d, d);

    const eps = 0.002;
    if (
      Math.abs(dimRef.current - selectionTarget) > eps ||
      Math.abs(scaleRef.current - targetScale) > eps ||
      Math.abs(mat.opacity - targetOpacity) > eps
    ) {
      threeState.invalidate();
    }
  });

  return (
    <group ref={groupRef} position={position}>
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
        <meshBasicMaterial map={coverTexture} side={THREE.DoubleSide} transparent />
      </mesh>
    </group>
  );
}
