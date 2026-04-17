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

const DEFAULT_SENSITIVITY = 0.0065;
const DEFAULT_SLOTS = 16;

// Snap animation — length scales with travel distance so short corrections feel snappy
// and long flicks feel like a real flywheel slowing down.
const MIN_SNAP_DURATION_MS = 300;
const MAX_SNAP_DURATION_MS = 680;
const PER_SLOT_DURATION_MS = 150;

// Fling / momentum — release velocity projects further rotation before snapping.
const VELOCITY_SAMPLE_WINDOW_MS = 90;
const VELOCITY_PROJECTION_MS = 260;
const MAX_FLING_SLOTS = 4;

function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}

interface VelocitySample {
  t: number;
  x: number;
}

export function useCarouselControls(
  sensitivity: number = DEFAULT_SENSITIVITY,
  slotCount: number = DEFAULT_SLOTS,
): CarouselControls {
  const [rotation, setRotation] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const startXRef = useRef(0);
  const baseRotationRef = useRef(0);
  const rotationRef = useRef(0);
  const isDraggingRef = useRef(false);
  const snapRafRef = useRef<number | null>(null);
  const velocitySamplesRef = useRef<VelocitySample[]>([]);

  useEffect(() => {
    rotationRef.current = rotation;
  }, [rotation]);
  useEffect(() => {
    isDraggingRef.current = isDragging;
  }, [isDragging]);

  const cancelSnap = useCallback(() => {
    if (snapRafRef.current !== null) {
      cancelAnimationFrame(snapRafRef.current);
      snapRafRef.current = null;
    }
  }, []);

  useEffect(() => () => cancelSnap(), [cancelSnap]);

  const startSnapTo = useCallback(
    (target: number, durationMs: number) => {
      cancelSnap();
      const start = rotationRef.current;
      const delta = target - start;
      if (Math.abs(delta) < 1e-4) return;
      const startTime = performance.now();
      const step = (now: number) => {
        const elapsed = now - startTime;
        const t = Math.min(1, elapsed / durationMs);
        const eased = easeOutQuart(t);
        const next = start + delta * eased;
        rotationRef.current = next;
        setRotation(next);
        if (t < 1) {
          snapRafRef.current = requestAnimationFrame(step);
        } else {
          snapRafRef.current = null;
        }
      };
      snapRafRef.current = requestAnimationFrame(step);
    },
    [cancelSnap],
  );

  const onPointerDown = useCallback(
    (event: React.PointerEvent) => {
      cancelSnap();
      isDraggingRef.current = true;
      setIsDragging(true);
      startXRef.current = event.clientX;
      baseRotationRef.current = rotationRef.current;
      velocitySamplesRef.current = [
        { t: performance.now(), x: event.clientX },
      ];
    },
    [cancelSnap],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent) => {
      if (!isDraggingRef.current) return;

      const delta = calculateRotationDelta(
        startXRef.current,
        event.clientX,
        sensitivity,
      );

      const newRotation = baseRotationRef.current + delta;
      rotationRef.current = newRotation;
      setRotation(newRotation);

      const now = performance.now();
      const samples = velocitySamplesRef.current;
      samples.push({ t: now, x: event.clientX });
      // Keep only samples inside the velocity window so fling estimation reflects the latest motion.
      while (
        samples.length > 1 &&
        now - samples[0].t > VELOCITY_SAMPLE_WINDOW_MS
      ) {
        samples.shift();
      }
    },
    [sensitivity],
  );

  const onPointerUp = useCallback(() => {
    isDraggingRef.current = false;
    setIsDragging(false);

    const slotStep = (2 * Math.PI) / slotCount;
    const current = rotationRef.current;

    // Estimate pointer velocity from the last few samples -> project into rotation velocity.
    // CRITICAL: re-prune samples using release-time. If the user held the pointer still before
    // releasing, pointermove stopped firing long ago and the sample buffer still contains the
    // motion from before the pause — using those would produce a phantom fling.
    const releaseTime = performance.now();
    const samples = velocitySamplesRef.current.filter(
      (sample) => releaseTime - sample.t <= VELOCITY_SAMPLE_WINDOW_MS,
    );
    let rotationVelocity = 0; // radians per millisecond
    if (samples.length >= 2) {
      const first = samples[0];
      const last = samples[samples.length - 1];
      const dt = last.t - first.t;
      if (dt > 0) {
        const dxPerMs = (last.x - first.x) / dt;
        rotationVelocity = dxPerMs * sensitivity;
      }
    }
    velocitySamplesRef.current = [];

    // Projected rest position if the drum kept coasting at release velocity, clamped so a
    // single hard flick cannot spin past a reasonable number of slots.
    const projected = current + rotationVelocity * VELOCITY_PROJECTION_MS;
    const maxProjectedTravel = MAX_FLING_SLOTS * slotStep;
    const clampedProjected =
      Math.max(
        -maxProjectedTravel,
        Math.min(maxProjectedTravel, projected - current),
      ) + current;

    const snapped = Math.round(clampedProjected / slotStep) * slotStep;

    // Duration scales with how far the drum actually has to travel.
    const travel = Math.abs(snapped - current);
    const travelSlots = travel / slotStep;
    const duration = Math.max(
      MIN_SNAP_DURATION_MS,
      Math.min(
        MAX_SNAP_DURATION_MS,
        MIN_SNAP_DURATION_MS + travelSlots * PER_SLOT_DURATION_MS,
      ),
    );

    startSnapTo(snapped, duration);
  }, [slotCount, sensitivity, startSnapTo]);

  return {
    rotation,
    isDragging,
    onPointerDown,
    onPointerMove,
    onPointerUp,
  };
}
