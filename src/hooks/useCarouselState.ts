import { useState, useMemo, useCallback } from 'react';
import type { Song } from '@/data/types';

interface CarouselState {
  selectedSongId: string | null;
  selectedSong: Song | null;
  isSongSelected: boolean;
  selectSong: (id: string) => void;
  deselectSong: () => void;
}

export function useCarouselState(songs: Song[]): CarouselState {
  const [selectedSongId, setSelectedSongId] = useState<string | null>(null);

  const selectedSong = useMemo(
    () => songs.find((song) => song.id === selectedSongId) ?? null,
    [songs, selectedSongId],
  );

  const isSongSelected = selectedSongId !== null;

  const selectSong = useCallback((id: string) => {
    setSelectedSongId(id);
  }, []);

  const deselectSong = useCallback(() => {
    setSelectedSongId(null);
  }, []);

  return {
    selectedSongId,
    selectedSong,
    isSongSelected,
    selectSong,
    deselectSong,
  };
}
