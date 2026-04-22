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
  // @MX:SPEC: SPEC-SOCIAL-001
  // Marks tracks appended from approved `room_extra_tracks`. Additive only.
  isSuggested?: boolean;
}

export interface Playlist {
  id: string;
  name: string;
  description: string;
  songs: Song[];
}
