import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlaybackControls } from '@/components/ui/PlaybackControls';

describe('PlaybackControls', () => {
  const defaultProps = {
    isPlaying: false,
    duration: 200,
    progress: 0,
    onToggle: vi.fn(),
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders play button when paused', () => {
    render(<PlaybackControls {...defaultProps} />);
    expect(screen.getByRole('button', { name: /play/i })).toBeInTheDocument();
  });

  it('renders pause button when playing', () => {
    render(<PlaybackControls {...defaultProps} isPlaying={true} />);
    expect(screen.getByRole('button', { name: /pause/i })).toBeInTheDocument();
  });

  it('calls onToggle when play/pause is clicked', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();

    render(<PlaybackControls {...defaultProps} onToggle={onToggle} />);
    await user.click(screen.getByRole('button', { name: /play/i }));
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it('displays progress bar with correct value', () => {
    render(<PlaybackControls {...defaultProps} progress={0.5} />);
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveAttribute('aria-valuenow', '50');
  });

  it('shows 0% progress initially', () => {
    render(<PlaybackControls {...defaultProps} progress={0} />);
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveAttribute('aria-valuenow', '0');
  });

  it('displays elapsed time based on progress and duration', () => {
    // 50% of 200 seconds = 100 seconds = 1:40
    render(<PlaybackControls {...defaultProps} progress={0.5} />);
    expect(screen.getByText('1:40')).toBeInTheDocument();
  });

  it('displays total duration', () => {
    // 200 seconds = 3:20
    render(<PlaybackControls {...defaultProps} />);
    expect(screen.getByText('3:20')).toBeInTheDocument();
  });
});
