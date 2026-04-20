'use client';

import type { Preset } from '@/lib/presets';

interface SceneProps {
  preset: Preset;
}

export function Scene({ preset }: SceneProps) {
  const { lighting } = preset;
  return (
    <>
      <directionalLight
        color={lighting.keyColor}
        position={[3, 8, 8]}
        intensity={lighting.keyIntensity}
      />
      <directionalLight
        color={lighting.fillColor}
        position={[-4, 5, -3]}
        intensity={lighting.fillIntensity}
      />
      <ambientLight intensity={lighting.ambientIntensity} />
    </>
  );
}
