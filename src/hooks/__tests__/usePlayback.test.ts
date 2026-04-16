import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePlayback } from '@/hooks/usePlayback';

describe('usePlayback', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should have correct initial state', () => {
    const { result } = renderHook(() => usePlayback());

    expect(result.current.isPlaying).toBe(false);
    expect(result.current.progress).toBe(0);
  });

  it('play should set isPlaying to true', () => {
    const { result } = renderHook(() => usePlayback());

    act(() => {
      result.current.setDuration(200);
    });

    act(() => {
      result.current.play();
    });

    expect(result.current.isPlaying).toBe(true);
  });

  it('pause should set isPlaying to false', () => {
    const { result } = renderHook(() => usePlayback());

    act(() => {
      result.current.setDuration(200);
    });

    act(() => {
      result.current.play();
    });

    act(() => {
      result.current.pause();
    });

    expect(result.current.isPlaying).toBe(false);
  });

  it('toggle should switch isPlaying state', () => {
    const { result } = renderHook(() => usePlayback());

    act(() => {
      result.current.setDuration(200);
    });

    expect(result.current.isPlaying).toBe(false);

    act(() => {
      result.current.toggle();
    });

    expect(result.current.isPlaying).toBe(true);

    act(() => {
      result.current.toggle();
    });

    expect(result.current.isPlaying).toBe(false);
  });

  it('progress should advance with fake timers when playing', () => {
    const { result } = renderHook(() => usePlayback());

    act(() => {
      result.current.setDuration(100);
    });

    act(() => {
      result.current.play();
    });

    // duration 100s, so 1 second = 1/100 = 0.01 progress
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.progress).toBeCloseTo(0.01, 2);

    act(() => {
      vi.advanceTimersByTime(9000);
    });

    // 10 seconds total = 10/100 = 0.1
    expect(result.current.progress).toBeCloseTo(0.1, 2);
  });

  it('should stop when progress reaches 1.0', () => {
    const { result } = renderHook(() => usePlayback());

    act(() => {
      result.current.setDuration(100);
    });

    act(() => {
      result.current.play();
    });

    // Advance past full duration
    act(() => {
      vi.advanceTimersByTime(100000);
    });

    expect(result.current.isPlaying).toBe(false);
    expect(result.current.progress).toBe(0);
  });

  it('setDuration should reset state', () => {
    const { result } = renderHook(() => usePlayback());

    act(() => {
      result.current.setDuration(100);
    });

    act(() => {
      result.current.play();
    });

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    act(() => {
      result.current.setDuration(300);
    });

    expect(result.current.isPlaying).toBe(false);
    expect(result.current.progress).toBe(0);
  });

  it('play should not start without duration', () => {
    const { result } = renderHook(() => usePlayback());

    act(() => {
      result.current.play();
    });

    expect(result.current.isPlaying).toBe(false);
  });
});
