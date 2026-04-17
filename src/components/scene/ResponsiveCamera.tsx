'use client';

import { useMemo, useRef, useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { PerspectiveCamera as DreiPerspectiveCamera } from '@react-three/drei';
import type { PerspectiveCamera } from 'three';

export function ResponsiveCamera() {
  const size = useThree((state) => state.size);
  const invalidate = useThree((state) => state.invalidate);
  const ref = useRef<PerspectiveCamera>(null);

  const { position, fov } = useMemo(() => {
    const aspect = size.width / size.height;

    if (aspect < 0.7) {
      // narrow portrait (phones)
      const distance = 12 + (0.7 - aspect) * 12;
      return {
        position: [0, 2.3, distance] as [number, number, number],
        fov: 55,
      };
    }

    if (aspect < 1.2) {
      // tablet portrait or square-ish
      return {
        position: [0, 2.7, 12] as [number, number, number],
        fov: 52,
      };
    }

    if (aspect < 2) {
      // desktop and short landscape
      return {
        position: [0, 3.0, 11] as [number, number, number],
        fov: 50,
      };
    }

    // very wide landscape (phones rotated)
    return {
      position: [0, 2.5, 9.5] as [number, number, number],
      fov: 48,
    };
  }, [size.width, size.height]);

  useEffect(() => {
    const cam = ref.current;
    if (!cam) return;
    cam.lookAt(0, 1, 0);
    cam.updateProjectionMatrix();
    invalidate();
  }, [position, fov, invalidate]);

  return (
    <DreiPerspectiveCamera
      ref={ref}
      makeDefault
      position={position}
      fov={fov}
    />
  );
}
