'use client';

import { useRef, useCallback, useEffect, useState } from 'react';

interface YouTubePlayerState {
  isReady: boolean;
  isPlaying: boolean;
  progress: number;
  duration: number;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  loadVideo: (videoId: string) => void;
  containerRef: (el: HTMLDivElement | null) => void;
}

// YouTube IFrame API types (avoid UMD global import issues)
interface YTPlayer {
  destroy(): void;
  cueVideoById(videoId: string): void;
  playVideo(): void;
  pauseVideo(): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
}

interface YTPlayerEvent {
  data: number;
}

interface YTAPI {
  Player: new (
    element: HTMLDivElement,
    config: {
      height: string;
      width: string;
      playerVars: Record<string, number>;
      events: {
        onReady: () => void;
        onStateChange: (event: YTPlayerEvent) => void;
      };
    },
  ) => YTPlayer;
  PlayerState: {
    UNSTARTED: number;
    ENDED: number;
    PLAYING: number;
    PAUSED: number;
    BUFFERING: number;
    CUED: number;
  };
}

declare global {
  interface Window {
    YT: YTAPI;
    onYouTubeIframeAPIReady: (() => void) | undefined;
  }
}

let apiLoaded = false;
let apiReady = false;
const readyCallbacks: (() => void)[] = [];

function loadYouTubeAPI(): Promise<void> {
  if (apiReady) return Promise.resolve();

  return new Promise((resolve) => {
    readyCallbacks.push(resolve);

    if (apiLoaded) return;
    apiLoaded = true;

    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);

    window.onYouTubeIframeAPIReady = () => {
      apiReady = true;
      readyCallbacks.forEach((cb) => cb());
      readyCallbacks.length = 0;
    };
  });
}

export function useYouTubePlayer(): YouTubePlayerState {
  const playerRef = useRef<YTPlayer | null>(null);
  const containerElRef = useRef<HTMLDivElement | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingVideoRef = useRef<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  const clearTimer = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    clearTimer();
    intervalRef.current = setInterval(() => {
      const player = playerRef.current;
      if (!player || typeof player.getCurrentTime !== 'function') return;

      const current = player.getCurrentTime();
      const total = player.getDuration();
      if (total > 0) {
        setProgress(current / total);
        setDuration(total);
      }
    }, 500);
  }, [clearTimer]);

  const initPlayer = useCallback((el: HTMLDivElement) => {
    loadYouTubeAPI().then(() => {
      if (playerRef.current) return;

      playerRef.current = new window.YT.Player(el, {
        height: '360',
        width: '640',
        playerVars: {
          autoplay: 0,
          controls: 1,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
        },
        events: {
          onReady: () => {
            setIsReady(true);
            if (pendingVideoRef.current) {
              const vid = pendingVideoRef.current;
              pendingVideoRef.current = null;
              if (typeof playerRef.current?.cueVideoById === 'function') {
                playerRef.current.cueVideoById(vid);
              }
            }
          },
          onStateChange: (event: YTPlayerEvent) => {
            if (event.data === window.YT.PlayerState.PLAYING) {
              setIsPlaying(true);
              startTimer();
            } else if (
              event.data === window.YT.PlayerState.PAUSED ||
              event.data === window.YT.PlayerState.ENDED
            ) {
              setIsPlaying(false);
              clearTimer();
              if (event.data === window.YT.PlayerState.ENDED) {
                setProgress(0);
              }
            }
          },
        },
      });
    });
  }, [startTimer, clearTimer]);

  const containerRef = useCallback((el: HTMLDivElement | null) => {
    if (el) {
      // New div mounted — destroy old player if any, then create fresh
      if (playerRef.current) {
        try { playerRef.current.destroy(); } catch { /* already gone */ }
        playerRef.current = null;
      }
      containerElRef.current = el;
      setIsReady(false);
      initPlayer(el);
    } else {
      // Div unmounted — clean up
      clearTimer();
      if (playerRef.current) {
        try { playerRef.current.destroy(); } catch { /* already gone */ }
        playerRef.current = null;
      }
      containerElRef.current = null;
      setIsReady(false);
      setIsPlaying(false);
      setProgress(0);
    }
  }, [initPlayer, clearTimer]);

  useEffect(() => {
    return () => {
      clearTimer();
      if (playerRef.current) {
        try { playerRef.current.destroy(); } catch { /* noop */ }
        playerRef.current = null;
      }
    };
  }, [clearTimer]);

  const loadVideo = useCallback((videoId: string) => {
    if (playerRef.current && typeof playerRef.current.cueVideoById === 'function') {
      playerRef.current.cueVideoById(videoId);
      setProgress(0);
      setIsPlaying(false);
    } else {
      pendingVideoRef.current = videoId;
    }
  }, []);

  const play = useCallback(() => {
    if (!playerRef.current || typeof playerRef.current.playVideo !== 'function') return;
    playerRef.current.playVideo();
  }, []);

  const pause = useCallback(() => {
    if (!playerRef.current || typeof playerRef.current.pauseVideo !== 'function') return;
    playerRef.current.pauseVideo();
  }, []);

  const toggle = useCallback(() => {
    if (!playerRef.current || typeof playerRef.current.getPlayerState !== 'function') return;
    const state = playerRef.current.getPlayerState();
    if (state === window.YT.PlayerState.PLAYING) {
      playerRef.current.pauseVideo();
    } else {
      playerRef.current.playVideo();
    }
  }, []);

  return { isReady, isPlaying, progress, duration, play, pause, toggle, loadVideo, containerRef };
}
