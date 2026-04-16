'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Mesh } from 'three';
import { VINYL_BLACK } from '@/lib/colors';

interface CylinderBaseProps {
  isIdle: boolean;
}

export function CylinderBase({ isIdle }: CylinderBaseProps) {
  const meshRef = useRef<Mesh>(null);

  useFrame((state, delta) => {
    if (meshRef.current && isIdle) {
      meshRef.current.rotation.y += delta * 0.1;
      state.invalidate();
    }
  });

  return (
    <mesh ref={meshRef} position={[0, -1.2, 0]} receiveShadow>
      <cylinderGeometry args={[3.2, 3.2, 0.12, 48]} />
      <meshStandardMaterial color={VINYL_BLACK} roughness={0.9} metalness={0.1} />
    </mesh>
  );
}
