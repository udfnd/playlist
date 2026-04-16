import { describe, it, expect } from 'vitest';
import { defaultPlaylist } from '@/data/mock-playlists';

describe('mock-playlists', () => {
  it('should export a default playlist', () => {
    expect(defaultPlaylist).toBeDefined();
    expect(defaultPlaylist.id).toBeDefined();
    expect(defaultPlaylist.name).toBeDefined();
    expect(defaultPlaylist.description).toBeDefined();
  });

  it('should have at least 8 songs', () => {
    expect(defaultPlaylist.songs.length).toBeGreaterThanOrEqual(8);
  });

  it('each song should have required fields', () => {
    for (const song of defaultPlaylist.songs) {
      expect(song.id).toBeDefined();
      expect(typeof song.id).toBe('string');
      expect(song.title).toBeDefined();
      expect(typeof song.title).toBe('string');
      expect(song.artist).toBeDefined();
      expect(typeof song.artist).toBe('string');
      expect(song.coverUrl).toBeDefined();
      expect(typeof song.coverUrl).toBe('string');
      expect(song.color).toBeDefined();
      expect(typeof song.color).toBe('string');
      expect(typeof song.duration).toBe('number');
      expect(song.duration).toBeGreaterThan(0);
    }
  });

  it('each song should have a valid hex color', () => {
    const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;
    for (const song of defaultPlaylist.songs) {
      expect(song.color).toMatch(hexColorRegex);
    }
  });

  it('cover URLs should follow the pattern /covers/song-N.webp', () => {
    for (const song of defaultPlaylist.songs) {
      expect(song.coverUrl).toMatch(/^\/covers\/song-\d+\.webp$/);
    }
  });
});
