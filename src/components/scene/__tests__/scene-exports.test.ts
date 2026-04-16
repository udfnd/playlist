import { Scene } from '@/components/scene/Scene';
import { SongCard } from '@/components/scene/SongCard';
import { CylinderBase } from '@/components/scene/CylinderBase';

describe('3D Scene component exports', () => {
  it('Scene is a function component', () => {
    expect(typeof Scene).toBe('function');
  });

  it('SongCard is a function component', () => {
    expect(typeof SongCard).toBe('function');
  });

  it('CylinderBase is a function component', () => {
    expect(typeof CylinderBase).toBe('function');
  });
});

describe('SongCarousel default export', () => {
  it('exports a default function component', async () => {
    const mod = await import('@/components/scene/SongCarousel');
    expect(typeof mod.default).toBe('function');
  });
});
