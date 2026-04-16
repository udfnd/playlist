'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Scene } from '@/components/scene/Scene';
import { SongCard } from '@/components/scene/SongCard';
import type { CardTransform } from '@/components/scene/SongCard';
import { CylinderBase } from '@/components/scene/CylinderBase';
import { TransitionCard } from '@/components/scene/TransitionCard';
import { SceneDarkener } from '@/components/scene/SceneDarkener';
import { SongView } from '@/components/ui/SongView';
import { useCarouselState } from '@/hooks/useCarouselState';
import { useCarouselControls, calculateAlbumPosition } from '@/hooks/useCarouselControls';
import { usePlayback } from '@/hooks/usePlayback';
import { useYouTubePlayer } from '@/hooks/useYouTubePlayer';
import type { Song, Playlist } from '@/data/types';
import { MATTE_BLACK } from '@/lib/colors';

const CAROUSEL_RADIUS = 3.5;
const MIN_CARDS = 16;

type TransitionPhase = 'idle' | 'animating' | 'open';

interface SongCarouselProps {
  playlist: Playlist;
}

export default function SongCarousel({ playlist }: SongCarouselProps) {
  const { rotation, isDragging, onPointerDown, onPointerMove, onPointerUp } =
    useCarouselControls();

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
      className="relative w-screen h-screen overflow-hidden bg-matte-black"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <Suspense
        fallback={
          <div className="w-full h-full flex items-center justify-center bg-matte-black">
            <div className="w-6 h-6 border-2 border-warm-amber/30 border-t-warm-amber rounded-full animate-spin" />
          </div>
        }
      >
        <Canvas
          frameloop="demand"
          dpr={[1, 2]}
          camera={{ position: [0, 3, 8], fov: 50 }}
          onCreated={(state) => {
            state.gl.setClearColor(MATTE_BLACK);
          }}
          performance={{ min: 0.5, max: 1 }}
          style={{ background: MATTE_BLACK }}
          onPointerMissed={handleCanvasClick}
        >
          <Scene />
          <group position={[0, 1, 0]}>
          <CylinderBase isIdle={!isSongSelected && !isDragging} />

          <group rotation={[0, rotation, 0]}>
            {displayCards.map((card, index) => {
              const pos = calculateAlbumPosition(index, displayCards.length, CAROUSEL_RADIUS);
              return (
                <SongCard
                  key={`${card.song.id}-${index}`}
                  song={card.song}
                  index={card.originalIndex}
                  position={[pos.x, 0, pos.z]}
                  rotation={pos.angle}
                  isSelected={card.song.id === selectedSong?.id}
                  isAnySelected={isSongSelected}
                  hidden={card.song.id === selectedSong?.id && phase !== 'idle'}
                  onSelect={handleSelectSong}
                />
              );
            })}
          </group>

          </group>

          <SceneDarkener active={phase === 'animating'} />

          {phase !== 'idle' && selectedSong && cardTransform && (
            <TransitionCard
              song={selectedSong}
              songIndex={selectedSongIndex}
              startPosition={cardTransform.position}
              startQuaternion={cardTransform.quaternion}
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
