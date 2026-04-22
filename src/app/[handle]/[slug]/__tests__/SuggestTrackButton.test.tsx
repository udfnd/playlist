// @MX:SPEC: SPEC-SOCIAL-001
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SuggestTrackButton } from '../SuggestTrackButton';

const signInSpy = vi.fn();
vi.mock('next-auth/react', () => ({
  signIn: (...args: unknown[]) => signInSpy(...args),
}));

describe('SuggestTrackButton', () => {
  beforeEach(() => {
    signInSpy.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows "로그인 필요" label when not logged in and triggers signIn on click', async () => {
    const user = userEvent.setup();
    render(
      <SuggestTrackButton
        roomId="r1"
        sourceProvider="youtube"
        isLoggedIn={false}
        isSpotifyConnected={false}
      />,
    );
    const btn = screen.getByRole('button', { name: /로그인 필요/ });
    expect(btn).toBeInTheDocument();
    await user.click(btn);
    expect(signInSpy).toHaveBeenCalledWith('google', expect.any(Object));
  });

  it('shows "Spotify 연결 필요" when Spotify room without connection', () => {
    render(
      <SuggestTrackButton
        roomId="r1"
        sourceProvider="spotify"
        isLoggedIn={true}
        isSpotifyConnected={false}
      />,
    );
    expect(screen.getByRole('button', { name: /Spotify 연결 필요/ })).toBeInTheDocument();
  });

  it('opens the search modal on click in happy path', async () => {
    const user = userEvent.setup();
    render(
      <SuggestTrackButton
        roomId="r1"
        sourceProvider="youtube"
        isLoggedIn={true}
        isSpotifyConnected={false}
      />,
    );
    await user.click(screen.getByRole('button', { name: /곡 추천하기/ }));
    // Modal presence indicated by search input.
    expect(screen.getByPlaceholderText(/검색/)).toBeInTheDocument();
  });
});
