import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SongView } from '@/components/ui/SongView';
import type { Song } from '@/data/types';

vi.mock('@/lib/cover-generator', () => ({
  generateCoverDataUrl: () => 'data:image/png;base64,MOCK',
}));

const mockSong: Song = {
  id: 'song-1',
  title: 'Fading Horizon',
  artist: 'Luna Voss',
  albumName: 'Midnight Echoes',
  coverUrl: '/covers/song-1.webp',
  color: '#4A90D9',
  duration: 234,
  lyrics: 'The light bends where the ocean meets the sky\nI watch it fade',
};

describe('SongView', () => {
  const defaultProps = {
    song: mockSong,
    songIndex: 0,
    onClose: vi.fn(),
    isPlaying: false,
    progress: 0,
    onToggle: vi.fn(),
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders song title and artist', () => {
    render(<SongView {...defaultProps} />);
    expect(screen.getByText('Fading Horizon')).toBeInTheDocument();
    expect(screen.getByText(/Luna Voss/)).toBeInTheDocument();
  });

  it('does not render album name separately', () => {
    render(<SongView {...defaultProps} />);
    expect(screen.queryByText(/Midnight Echoes/)).not.toBeInTheDocument();
  });

  it('renders lyrics', () => {
    render(<SongView {...defaultProps} />);
    expect(screen.getByText(/The light bends/)).toBeInTheDocument();
  });

  it('renders cover image', () => {
    render(<SongView {...defaultProps} />);
    const img = screen.getByAltText('Fading Horizon');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'data:image/png;base64,MOCK');
  });

  it('calls onClose when close button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<SongView {...defaultProps} onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('renders playback controls', () => {
    render(<SongView {...defaultProps} />);
    expect(screen.getByRole('button', { name: /play/i })).toBeInTheDocument();
  });

  it('displays formatted duration', () => {
    render(<SongView {...defaultProps} />);
    const matches = screen.getAllByText('3:54');
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });
});
