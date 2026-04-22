// @MX:SPEC: SPEC-SOCIAL-001
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchTrackModal } from '../SearchTrackModal';

const SAMPLE_RESULT = {
  externalTrackId: 'yt-abc',
  title: 'Hello',
  artist: 'Adele',
  thumbnailUrl: 'https://img/thumb.jpg',
  durationSec: 245,
};

describe('SearchTrackModal', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('debounces search input (no fetch before 300ms)', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ results: [] }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchSpy);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <SearchTrackModal
        roomId="r1"
        sourceProvider="youtube"
        onClose={() => {}}
      />,
    );
    await user.type(screen.getByPlaceholderText(/검색/), 'hello');
    // Immediately after typing, no fetch yet.
    expect(fetchSpy).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(350);
    });
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/api/rooms/r1/search?q=hello'),
      expect.any(Object),
    );
  });

  it('posts a suggestion when a result is clicked', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ results: [SAMPLE_RESULT] }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ suggestion: { id: 's1' } }), { status: 201 }),
      );
    vi.stubGlobal('fetch', fetchSpy);
    const onSubmitted = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <SearchTrackModal
        roomId="r1"
        sourceProvider="youtube"
        onClose={onClose}
        onSubmitted={onSubmitted}
      />,
    );
    await user.type(screen.getByPlaceholderText(/검색/), 'hello');
    await act(async () => {
      vi.advanceTimersByTime(350);
    });
    await act(async () => {
      await Promise.resolve();
    });
    const resultBtn = await screen.findByRole('button', { name: /Hello/ });
    await user.click(resultBtn);
    const postCall = fetchSpy.mock.calls.find(
      (c) => (c[1] as RequestInit | undefined)?.method === 'POST',
    );
    expect(postCall).toBeTruthy();
    expect(JSON.parse((postCall![1] as RequestInit).body as string)).toMatchObject({
      externalTrackId: 'yt-abc',
      title: 'Hello',
      artist: 'Adele',
    });
  });

  it('shows rate-limit message on 429 from suggestion POST', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ results: [SAMPLE_RESULT] }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'rate' }), { status: 429 }),
      );
    vi.stubGlobal('fetch', fetchSpy);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <SearchTrackModal
        roomId="r1"
        sourceProvider="youtube"
        onClose={() => {}}
      />,
    );
    await user.type(screen.getByPlaceholderText(/검색/), 'hello');
    await act(async () => {
      vi.advanceTimersByTime(350);
    });
    await act(async () => {
      await Promise.resolve();
    });
    const resultBtn = await screen.findByRole('button', { name: /Hello/ });
    await user.click(resultBtn);
    expect(await screen.findByText(/시간당 5건/)).toBeInTheDocument();
  });
});
