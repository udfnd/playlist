'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Mesh } from 'three';
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
  const dimRef = useRef(1);
  const isFrontRef = useRef(true);
  const worldPosTemp = useMemo(() => new THREE.Vector3(), []);

  const coverTexture = useMemo(
    () =>
      song.thumbnailUrl
        ? loadThumbnailTexture(song.thumbnailUrl)
        : generateCoverTexture(song.title, song.artist, song.color, index),
    [song.thumbnailUrl, song.title, song.artist, song.color, index],
  );

  useFrame((threeState) => {
    if (!meshRef.current) return;

    if (hidden) {
      meshRef.current.visible = false;
      return;
    }

    // Determine front/back from world-space Z (camera looks along +Z)
    meshRef.current.getWorldPosition(worldPosTemp);
    const zNorm = THREE.MathUtils.clamp(worldPosTemp.z / 4, -1, 1);
    const raw = zNorm * 0.5 + 0.5; // 0 (back) to 1 (front)
    const frontBrightness = 0.1 + 0.9 * Math.pow(raw, 1.5);
    isFrontRef.current = worldPosTemp.z > 0;

    // No card dimming on selection — SongView backdrop handles all darkening
    const selectionTarget = 1;
    const lerpSpeed = LERP_SPEED;
    dimRef.current = THREE.MathUtils.lerp(dimRef.current, selectionTarget, lerpSpeed);
    meshRef.current.visible = true;

    const mat = meshRef.current.material as THREE.MeshBasicMaterial;
    const d = frontBrightness * dimRef.current;
    mat.color.setRGB(d, d, d);

    const eps = 0.001;
    if (Math.abs(dimRef.current - selectionTarget) > eps) {
      threeState.invalidate();
    }
  });

  const faceAngle = Math.atan2(position[0], position[2]);

  return (
    <group position={position} rotation={[0, faceAngle + Math.PI / 2, 0]}>
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
