import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useCarouselControls,
  calculateAlbumPosition,
  calculateRotationDelta,
} from '@/hooks/useCarouselControls';

describe('calculateAlbumPosition', () => {
  it('should return correct position for first album in a set of 4', () => {
    const result = calculateAlbumPosition(0, 4, 5);
    // index 0, total 4: angle = (0 / 4) * 2PI = 0
    // x = 5 * sin(0) = 0, z = 5 * cos(0) = 5
    expect(result.x).toBeCloseTo(0, 5);
    expect(result.z).toBeCloseTo(5, 5);
    expect(result.angle).toBeCloseTo(0, 5);
  });

  it('should return correct position for second album in a set of 4', () => {
    const result = calculateAlbumPosition(1, 4, 5);
    // index 1, total 4: angle = (1/4) * 2PI = PI/2
    // x = 5 * sin(PI/2) = 5, z = 5 * cos(PI/2) = 0
    expect(result.x).toBeCloseTo(5, 5);
    expect(result.z).toBeCloseTo(0, 3);
    expect(result.angle).toBeCloseTo(Math.PI / 2, 5);
  });

  it('should place all albums equidistant from center', () => {
    const total = 8;
    const radius = 10;

    for (let i = 0; i < total; i++) {
      const pos = calculateAlbumPosition(i, total, radius);
      const distance = Math.sqrt(pos.x * pos.x + pos.z * pos.z);
      expect(distance).toBeCloseTo(radius, 5);
    }
  });

  it('should distribute albums evenly around the circle', () => {
    const total = 6;
    const radius = 5;
    const expectedAngleStep = (2 * Math.PI) / total;

    for (let i = 0; i < total; i++) {
      const pos = calculateAlbumPosition(i, total, radius);
      expect(pos.angle).toBeCloseTo(i * expectedAngleStep, 5);
    }
  });

  it('should handle single album', () => {
    const result = calculateAlbumPosition(0, 1, 5);
    expect(result.x).toBeCloseTo(0, 5);
    expect(result.z).toBeCloseTo(5, 5);
    expect(result.angle).toBeCloseTo(0, 5);
  });
});

describe('calculateRotationDelta', () => {
  it('should return positive delta for rightward drag', () => {
    const delta = calculateRotationDelta(100, 200, 0.01);
    expect(delta).toBeGreaterThan(0);
  });

  it('should return negative delta for leftward drag', () => {
    const delta = calculateRotationDelta(200, 100, 0.01);
    expect(delta).toBeLessThan(0);
  });

  it('should return zero delta for no movement', () => {
    const delta = calculateRotationDelta(100, 100, 0.01);
    expect(delta).toBe(0);
  });

  it('should be proportional to distance', () => {
    const sensitivity = 0.01;
    const delta1 = calculateRotationDelta(100, 200, sensitivity);
    const delta2 = calculateRotationDelta(100, 300, sensitivity);

    expect(delta2).toBeCloseTo(delta1 * 2, 5);
  });

  it('should scale with sensitivity', () => {
    const delta1 = calculateRotationDelta(100, 200, 0.01);
    const delta2 = calculateRotationDelta(100, 200, 0.02);

    expect(delta2).toBeCloseTo(delta1 * 2, 5);
  });
});

describe('useCarouselControls', () => {
  it('should have initial rotation of 0 and not dragging', () => {
    const { result } = renderHook(() => useCarouselControls());

    expect(result.current.rotation).toBe(0);
    expect(result.current.isDragging).toBe(false);
  });

  it('should set isDragging to true on pointer down', () => {
    const { result } = renderHook(() => useCarouselControls());

    act(() => {
      result.current.onPointerDown({ clientX: 100 } as React.PointerEvent);
    });

    expect(result.current.isDragging).toBe(true);
  });

  it('should set isDragging to false on pointer up', () => {
    const { result } = renderHook(() => useCarouselControls());

    act(() => {
      result.current.onPointerDown({ clientX: 100 } as React.PointerEvent);
    });

    act(() => {
      result.current.onPointerUp();
    });

    expect(result.current.isDragging).toBe(false);
  });

  it('should update rotation on drag (pointer move while dragging)', () => {
    const { result } = renderHook(() => useCarouselControls());

    act(() => {
      result.current.onPointerDown({ clientX: 100 } as React.PointerEvent);
    });

    act(() => {
      result.current.onPointerMove({ clientX: 200 } as React.PointerEvent);
    });

    expect(result.current.rotation).not.toBe(0);
  });

  it('should not update rotation on pointer move when not dragging', () => {
    const { result } = renderHook(() => useCarouselControls());

    act(() => {
      result.current.onPointerMove({ clientX: 200 } as React.PointerEvent);
    });

    expect(result.current.rotation).toBe(0);
  });
});
