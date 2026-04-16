export interface Song {
  id: string;
  title: string;
  artist: string;
  albumName: string;
  coverUrl: string;
  color: string; // dominant hex color for glow
  duration: number; // seconds
  lyrics: string;
  videoId?: string; // YouTube video ID
  thumbnailUrl?: string; // YouTube thumbnail URL
}

export interface Playlist {
  id: string;
  name: string;
  description: string;
  songs: Song[];
}
