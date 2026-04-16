import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCarouselState } from '@/hooks/useCarouselState';
import type { Song } from '@/data/types';

const mockSongs: Song[] = [
  {
    id: 'song-1',
    title: 'Test Song One',
    artist: 'Artist A',
    albumName: 'Album A',
    coverUrl: '/covers/song-1.webp',
    color: '#FF0000',
    duration: 200,
    lyrics: 'lyrics one',
  },
  {
    id: 'song-2',
    title: 'Test Song Two',
    artist: 'Artist B',
    albumName: 'Album B',
    coverUrl: '/covers/song-2.webp',
    color: '#00FF00',
    duration: 180,
    lyrics: 'lyrics two',
  },
  {
    id: 'song-3',
    title: 'Test Song Three',
    artist: 'Artist C',
    albumName: 'Album C',
    coverUrl: '/covers/song-3.webp',
    color: '#0000FF',
    duration: 220,
    lyrics: 'lyrics three',
  },
];

describe('useCarouselState', () => {
  it('should have no song selected initially', () => {
    const { result } = renderHook(() => useCarouselState(mockSongs));

    expect(result.current.selectedSongId).toBeNull();
    expect(result.current.selectedSong).toBeNull();
    expect(result.current.isSongSelected).toBe(false);
  });

  it('should select a song by id', () => {
    const { result } = renderHook(() => useCarouselState(mockSongs));

    act(() => {
      result.current.selectSong('song-2');
    });

    expect(result.current.selectedSongId).toBe('song-2');
    expect(result.current.selectedSong).toEqual(mockSongs[1]);
    expect(result.current.isSongSelected).toBe(true);
  });

  it('should deselect a song', () => {
    const { result } = renderHook(() => useCarouselState(mockSongs));

    act(() => {
      result.current.selectSong('song-1');
    });

    expect(result.current.selectedSongId).toBe('song-1');

    act(() => {
      result.current.deselectSong();
    });

    expect(result.current.selectedSongId).toBeNull();
    expect(result.current.selectedSong).toBeNull();
    expect(result.current.isSongSelected).toBe(false);
  });

  it('should update correctly when selecting a different song', () => {
    const { result } = renderHook(() => useCarouselState(mockSongs));

    act(() => {
      result.current.selectSong('song-1');
    });

    expect(result.current.selectedSong).toEqual(mockSongs[0]);

    act(() => {
      result.current.selectSong('song-3');
    });

    expect(result.current.selectedSongId).toBe('song-3');
    expect(result.current.selectedSong).toEqual(mockSongs[2]);
  });

  it('should return correct isSongSelected boolean', () => {
    const { result } = renderHook(() => useCarouselState(mockSongs));

    expect(result.current.isSongSelected).toBe(false);

    act(() => {
      result.current.selectSong('song-1');
    });

    expect(result.current.isSongSelected).toBe(true);

    act(() => {
      result.current.deselectSong();
    });

    expect(result.current.isSongSelected).toBe(false);
  });
});
