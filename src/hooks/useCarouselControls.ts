import { useState, useCallback, useRef, useEffect } from 'react';

interface AlbumPosition {
  x: number;
  z: number;
  angle: number;
}

interface CarouselControls {
  rotation: number;
  isDragging: boolean;
  onPointerDown: (event: React.PointerEvent) => void;
  onPointerMove: (event: React.PointerEvent) => void;
  onPointerUp: () => void;
}

export function calculateAlbumPosition(
  index: number,
  total: number,
  radius: number,
): AlbumPosition {
  const angle = (index / total) * 2 * Math.PI;
  const x = radius * Math.sin(angle);
  const z = radius * Math.cos(angle);

  return { x, z, angle };
}

export function calculateRotationDelta(
  startX: number,
  currentX: number,
  sensitivity: number,
): number {
  return (currentX - startX) * sensitivity;
}

const DEFAULT_SENSITIVITY = 0.01;

export function useCarouselControls(
  sensitivity: number = DEFAULT_SENSITIVITY,
): CarouselControls {
  const [rotation, setRotation] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const startXRef = useRef(0);
  const baseRotationRef = useRef(0);
  const rotationRef = useRef(0);
  const isDraggingRef = useRef(false);

  // Keep refs in sync with state
  useEffect(() => {
    rotationRef.current = rotation;
  }, [rotation]);
  useEffect(() => {
    isDraggingRef.current = isDragging;
  }, [isDragging]);

  const onPointerDown = useCallback((event: React.PointerEvent) => {
    isDraggingRef.current = true;
    setIsDragging(true);
    startXRef.current = event.clientX;
    baseRotationRef.current = rotationRef.current;
  }, []);

  const onPointerMove = useCallback((event: React.PointerEvent) => {
    if (!isDraggingRef.current) return;

    const delta = calculateRotationDelta(
      startXRef.current,
      event.clientX,
      sensitivity,
    );

    const newRotation = baseRotationRef.current + delta;
    rotationRef.current = newRotation;
    setRotation(newRotation);
  }, [sensitivity]);

  const onPointerUp = useCallback(() => {
    isDraggingRef.current = false;
    setIsDragging(false);
  }, []);

  return {
    rotation,
    isDragging,
    onPointerDown,
    onPointerMove,
    onPointerUp,
  };
}
