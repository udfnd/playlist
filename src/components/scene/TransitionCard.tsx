'use client';

import { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { Mesh } from 'three';
import type { Song } from '@/data/types';
import { generateCoverTexture, loadThumbnailTexture } from '@/lib/cover-generator';

interface TransitionCardProps {
  song: Song;
  songIndex: number;
  startPosition: [number, number, number];
  startQuaternion: [number, number, number, number];
  onComplete: () => void;
}

const CARD_SIZE = 1.8;
const DURATION = 0.5;
const CLOSE_BTN_HEIGHT = 72;

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

export function TransitionCard({
  song,
  songIndex,
  startPosition,
  startQuaternion,
  onComplete,
}: TransitionCardProps) {
  const meshRef = useRef<Mesh>(null);
  const progressRef = useRef(0);
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const { camera: rawCamera, size } = useThree();
  const camera = rawCamera as THREE.PerspectiveCamera;

  const coverTexture = useMemo(
    () =>
      song.thumbnailUrl
        ? loadThumbnailTexture(song.thumbnailUrl)
        : generateCoverTexture(song.title, song.artist, song.color, songIndex),
    [song.thumbnailUrl, song.title, song.artist, song.color, songIndex],
  );

  const startPos = useMemo(
    () => new THREE.Vector3(...startPosition),
    [startPosition],
  );
  const startQuat = useMemo(
    () => new THREE.Quaternion(...startQuaternion),
    [startQuaternion],
  );

  const { targetPos, targetQuat } = useMemo(() => {
    // Target: SongView cover position — centered, top = 72px
    const isMd = size.width >= 768;
    const coverPx = isMd ? 256 : 224;
    const screenCenterX = size.width / 2;
    const screenCenterY = CLOSE_BTN_HEIGHT + coverPx / 2;

    // Convert to NDC
    const ndcX = (screenCenterX / size.width) * 2 - 1;
    const ndcY = -(screenCenterY / size.height) * 2 + 1;

    // Ray from camera through target screen point
    const near = new THREE.Vector3(ndcX, ndcY, 0).unproject(camera);
    const far = new THREE.Vector3(ndcX, ndcY, 1).unproject(camera);
    const rayDir = far.clone().sub(near).normalize();

    // Distance along view axis where CARD_SIZE projects to coverPx
    const vFov = (camera.fov * Math.PI) / 180;
    const tanHalf = Math.tan(vFov / 2);
    const viewDist = (CARD_SIZE * size.height) / (2 * coverPx * tanHalf);

    // Convert view-axis distance to ray distance
    const viewDir = new THREE.Vector3();
    camera.getWorldDirection(viewDir);
    const cosAngle = rayDir.dot(viewDir);
    const rayDist = viewDist / cosAngle;

    const pos = camera.position.clone().add(rayDir.clone().multiplyScalar(rayDist));

    // Align parallel to camera's image plane (no tilt)
    const quat = camera.quaternion.clone();

    return { targetPos: pos, targetQuat: quat };
  }, [camera, size]);

  useFrame((state, delta) => {
    if (!meshRef.current || completedRef.current) return;

    progressRef.current = Math.min(1, progressRef.current + delta / DURATION);
    const t = easeOutCubic(progressRef.current);

    meshRef.current.position.lerpVectors(startPos, targetPos, t);
    meshRef.current.quaternion.slerpQuaternions(startQuat, targetQuat, t);

    state.invalidate();

    if (progressRef.current >= 1) {
      completedRef.current = true;
      onCompleteRef.current();
    }
  });

  return (
    <mesh ref={meshRef} position={startPosition} renderOrder={999}>
      <planeGeometry args={[CARD_SIZE, CARD_SIZE]} />
      <meshBasicMaterial map={coverTexture} side={THREE.DoubleSide} transparent />
    </mesh>
  );
}
