'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Scene } from '@/components/scene/Scene';
import { ResponsiveCamera } from '@/components/scene/ResponsiveCamera';
import { SongCard } from '@/components/scene/SongCard';
import type { CardTransform } from '@/components/scene/SongCard';
import { CylinderBase } from '@/components/scene/CylinderBase';
import { TransitionCard } from '@/components/scene/TransitionCard';
import { SceneDarkener } from '@/components/scene/SceneDarkener';
import { SongView } from '@/components/ui/SongView';
import { useCarouselState } from '@/hooks/useCarouselState';
import { useCarouselControls } from '@/hooks/useCarouselControls';
import { usePlayback } from '@/hooks/usePlayback';
import { useYouTubePlayer } from '@/hooks/useYouTubePlayer';
import type { Song, Playlist } from '@/data/types';

const CAROUSEL_RADIUS = 4.8;
const MIN_CARDS = 16;

type TransitionPhase = 'idle' | 'animating' | 'open';

interface SongCarouselProps {
  playlist: Playlist;
}

export default function SongCarousel({ playlist }: SongCarouselProps) {
  const { songs } = playlist;
  const hasYouTube = songs.some((s) => s.videoId);

  // Repeat songs to fill the carousel if fewer than MIN_CARDS
  const displayCards = useMemo(() => {
    if (songs.length >= MIN_CARDS) {
      return songs.map((song, i) => ({ song, originalIndex: i }));
    }
    const cards: { song: Song; originalIndex: number }[] = [];
    while (cards.length < MIN_CARDS) {
      for (let i = 0; i < songs.length && cards.length < MIN_CARDS; i++) {
        cards.push({ song: songs[i], originalIndex: i });
      }
    }
    return cards;
  }, [songs]);

  const { rotation, isDragging, onPointerDown, onPointerMove, onPointerUp } =
    useCarouselControls(undefined, displayCards.length);

  const {
    selectedSong,
    isSongSelected,
    selectSong,
    deselectSong,
  } = useCarouselState(songs);

  const playback = usePlayback();
  const ytPlayer = useYouTubePlayer();

  const [phase, setPhase] = useState<TransitionPhase>('idle');
  const [cardTransform, setCardTransform] = useState<CardTransform | null>(null);

  const selectedSongIndex = useMemo(
    () => (selectedSong ? songs.findIndex((s) => s.id === selectedSong.id) : 0),
    [selectedSong, songs],
  );

  useEffect(() => {
    if (selectedSong) {
      playback.setDuration(selectedSong.duration);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSong?.id]);

  const handleSelectSong = useCallback(
    (id: string, transform: CardTransform) => {
      if (phase !== 'idle') return;
      selectSong(id);
      setCardTransform(transform);
      setPhase('animating');
    },
    [selectSong, phase],
  );

  const handleTransitionComplete = useCallback(() => {
    setPhase('open');
  }, []);

  const handleClose = useCallback(() => {
    if (hasYouTube) {
      ytPlayer.pause();
    }
    deselectSong();
    setPhase('idle');
    setCardTransform(null);
  }, [deselectSong, hasYouTube, ytPlayer]);

  const handleCanvasClick = useCallback(() => {
    if (phase === 'open') {
      handleClose();
    }
  }, [phase, handleClose]);

  return (
    <div
      className="carousel-backdrop relative w-dvw h-dvh overflow-hidden touch-none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <div className="carousel-aurora" aria-hidden />
      <div className="carousel-grain" aria-hidden />
      <Suspense
        fallback={
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-warm-amber/30 border-t-warm-amber rounded-full animate-spin" />
          </div>
        }
      >
        <Canvas
          frameloop="demand"
          dpr={[1, 2]}
          gl={{ alpha: true, antialias: true }}
          onCreated={(state) => {
            state.gl.setClearColor(0x000000, 0);
          }}
          performance={{ min: 0.5, max: 1 }}
          style={{ background: 'transparent', position: 'relative', zIndex: 10 }}
          onPointerMissed={handleCanvasClick}
        >
          <ResponsiveCamera />
          <Scene />
          <group position={[0, 1, 0]}>
          <CylinderBase isIdle={!isSongSelected && !isDragging} />

          {displayCards.map((card, index) => (
            <SongCard
              key={`${card.song.id}-${index}`}
              song={card.song}
              index={index}
              originalIndex={card.originalIndex}
              totalCards={displayCards.length}
              rotation={rotation}
              radius={CAROUSEL_RADIUS}
              hidden={card.song.id === selectedSong?.id && phase !== 'idle'}
              isGhost={phase !== 'idle' && card.song.id !== selectedSong?.id}
              onSelect={handleSelectSong}
            />
          ))}

          </group>

          {/* Keep the scene dimmed for BOTH `animating` and `open` so the DOM SongView
              overlay doesn't have a flash-frame where the carousel brightens back up
              just before the overlay finishes fading in. Darkener only retracts when the
              user closes (phase → 'idle'). */}
          <SceneDarkener active={phase !== 'idle'} />

          {phase !== 'idle' && selectedSong && cardTransform && (
            <TransitionCard
              song={selectedSong}
              songIndex={selectedSongIndex}
              startPosition={cardTransform.position}
              startQuaternion={cardTransform.quaternion}
              startScale={cardTransform.scale}
              onComplete={handleTransitionComplete}
            />
          )}
        </Canvas>
      </Suspense>

      {/* SongView: pre-mounted hidden during animation, appears when 3D transition completes */}
      {phase !== 'idle' && selectedSong && (
        <div
          className="transition-opacity duration-150 ease-out"
          style={{
            opacity: phase === 'open' ? 1 : 0,
            pointerEvents: phase === 'open' ? 'auto' : 'none',
          }}
        >
          <SongView
            song={selectedSong}
            songIndex={selectedSongIndex}
            onClose={handleClose}
            {...(hasYouTube
              ? { youtubePlayer: ytPlayer }
              : {
                  isPlaying: playback.isPlaying,
                  progress: playback.progress,
                  onToggle: playback.toggle,
                })}
          />
        </div>
      )}
    </div>
  );
}
