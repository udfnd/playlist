'use client';

import { WARM_AMBER } from '@/lib/colors';

export function Scene() {
  return (
    <>
      <directionalLight
        color={WARM_AMBER}
        position={[3, 8, 8]}
        intensity={1.8}
      />
      <directionalLight
        color="#FFFFFF"
        position={[-4, 5, -3]}
        intensity={0.4}
      />
      <ambientLight intensity={0.35} />
    </>
  );
}
