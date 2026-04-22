// @MX:SPEC: SPEC-SOCIAL-001
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactionPicker } from '../ReactionPicker';
import { EMOJI_SET } from '@/data/reactions';

describe('ReactionPicker', () => {
  const roomId = 'room-1';
  const trackRef = 'track-1';

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders one button per emoji in EMOJI_SET', () => {
    render(
      <ReactionPicker
        roomId={roomId}
        trackRef={trackRef}
        initialMine={new Set()}
      />,
    );
    for (const emoji of EMOJI_SET) {
      expect(
        screen.getByRole('button', { name: new RegExp(emoji) }),
      ).toBeInTheDocument();
    }
  });

  it('POSTs to reactions endpoint when clicking unselected emoji', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({}), { status: 201 }),
    );
    vi.stubGlobal('fetch', fetchSpy);
    const user = userEvent.setup();
    render(
      <ReactionPicker
        roomId={roomId}
        trackRef={trackRef}
        initialMine={new Set()}
      />,
    );
    await user.click(screen.getByRole('button', { name: new RegExp(EMOJI_SET[0]) }));
    expect(fetchSpy).toHaveBeenCalledWith(
      `/api/rooms/${roomId}/reactions`,
      expect.objectContaining({ method: 'POST' }),
    );
    const call = fetchSpy.mock.calls[0][1];
    expect(JSON.parse(call.body)).toEqual({ trackRef, emoji: EMOJI_SET[0] });
  });

  it('DELETEs when clicking an already-selected emoji', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ deleted: 1 }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchSpy);
    const user = userEvent.setup();
    render(
      <ReactionPicker
        roomId={roomId}
        trackRef={trackRef}
        initialMine={new Set([EMOJI_SET[0]])}
      />,
    );
    await user.click(screen.getByRole('button', { name: new RegExp(EMOJI_SET[0]) }));
    expect(fetchSpy).toHaveBeenCalledWith(
      `/api/rooms/${roomId}/reactions`,
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('reverts optimistic state when server returns 429', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'rate limited' }), { status: 429 }),
    );
    vi.stubGlobal('fetch', fetchSpy);
    const user = userEvent.setup();
    render(
      <ReactionPicker
        roomId={roomId}
        trackRef={trackRef}
        initialMine={new Set()}
      />,
    );
    const btn = screen.getByRole('button', { name: new RegExp(EMOJI_SET[0]) });
    await user.click(btn);
    // After server rejection, the button should no longer be "pressed".
    expect(btn).toHaveAttribute('aria-pressed', 'false');
  });
});
