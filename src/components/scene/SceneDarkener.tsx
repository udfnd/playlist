'use client';

import { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface SceneDarkenerProps {
  active: boolean;
}

const TARGET_OPACITY = 0.8;
const FADE_IN_RATE = TARGET_OPACITY / 0.5;   // reach 0.8 in 0.5s
const FADE_OUT_RATE = TARGET_OPACITY / 0.15;  // reach 0 in 0.15s

export function SceneDarkener({ active }: SceneDarkenerProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const { camera } = useThree();
  const tempDir = useMemo(() => new THREE.Vector3(), []);

  useFrame((state, delta) => {
    if (!meshRef.current || !matRef.current) return;

    // Keep plane in front of camera
    camera.getWorldDirection(tempDir);
    meshRef.current.position.copy(camera.position);
    meshRef.current.position.addScaledVector(tempDir, 1);
    meshRef.current.quaternion.copy(camera.quaternion);

    // Animate opacity
    const target = active ? TARGET_OPACITY : 0;
    const current = matRef.current.opacity;

    if (current < target) {
      matRef.current.opacity = Math.min(target, current + delta * FADE_IN_RATE);
    } else if (current > target) {
      matRef.current.opacity = Math.max(0, current - delta * FADE_OUT_RATE);
    }

    meshRef.current.visible = matRef.current.opacity > 0.001;

    if (Math.abs(matRef.current.opacity - target) > 0.001) {
      state.invalidate();
    }
  });

  return (
    <mesh ref={meshRef} renderOrder={998}>
      <planeGeometry args={[50, 50]} />
      <meshBasicMaterial
        ref={matRef}
        color="#0A0A0A"
        transparent
        opacity={0}
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  );
}
