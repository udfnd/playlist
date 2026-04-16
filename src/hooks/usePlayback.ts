import { useState, useCallback, useRef, useEffect } from 'react';

interface PlaybackState {
  isPlaying: boolean;
  progress: number;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  setDuration: (duration: number) => void;
}

export function usePlayback(): PlaybackState {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressRef = useRef(0);
  const durationRef = useRef(0);

  const clearTimer = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    clearTimer();
    if (durationRef.current <= 0) return;

    intervalRef.current = setInterval(() => {
      const increment = 1 / durationRef.current;
      const newProgress = progressRef.current + increment;

      if (newProgress >= 1.0) {
        clearInterval(intervalRef.current!);
        intervalRef.current = null;
        progressRef.current = 0;
        setIsPlaying(false);
        setProgress(0);
      } else {
        progressRef.current = newProgress;
        setProgress(newProgress);
      }
    }, 1000);
  }, [clearTimer]);

  const play = useCallback(() => {
    if (durationRef.current <= 0) return;
    setIsPlaying(true);
    startTimer();
  }, [startTimer]);

  const pause = useCallback(() => {
    setIsPlaying(false);
    clearTimer();
  }, [clearTimer]);

  const toggle = useCallback(() => {
    setIsPlaying((prev) => {
      if (prev) {
        clearTimer();
        return false;
      } else {
        if (durationRef.current <= 0) return false;
        startTimer();
        return true;
      }
    });
  }, [clearTimer, startTimer]);

  const setDuration = useCallback((duration: number) => {
    clearTimer();
    durationRef.current = duration;
    progressRef.current = 0;
    setIsPlaying(false);
    setProgress(0);
  }, [clearTimer]);

  useEffect(() => {
    return () => {
      clearTimer();
    };
  }, [clearTimer]);

  return {
    isPlaying,
    progress,
    play,
    pause,
    toggle,
    setDuration,
  };
}
