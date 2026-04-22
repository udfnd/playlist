// @MX:SPEC: SPEC-SOCIAL-001
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OwnerSuggestionQueue } from '../OwnerSuggestionQueue';

const PENDING = {
  id: 's-pending',
  title: 'Pending Title',
  artist: 'Artist A',
  status: 'pending',
  source_provider: 'youtube',
  external_track_id: 'yt1',
  thumbnail_url: null,
  duration_sec: 200,
};

const APPROVED = {
  ...PENDING,
  id: 's-approved',
  title: 'Approved Title',
  status: 'approved',
};

describe('OwnerSuggestionQueue', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches suggestions on mount and renders pending and approved', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ suggestions: [PENDING, APPROVED] }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', fetchSpy);
    render(<OwnerSuggestionQueue roomId="r1" />);
    expect(await screen.findByText('Pending Title')).toBeInTheDocument();
    expect(screen.getByText('Approved Title')).toBeInTheDocument();
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/rooms/r1/suggestions',
      expect.any(Object),
    );
  });

  it('PATCHes with approved status when approve clicked', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ suggestions: [PENDING] }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ suggestion: { ...PENDING, status: 'approved' } }),
          { status: 200 },
        ),
      );
    vi.stubGlobal('fetch', fetchSpy);
    const user = userEvent.setup();
    render(<OwnerSuggestionQueue roomId="r1" />);
    await screen.findByText('Pending Title');
    await user.click(screen.getByRole('button', { name: /승인/ }));
    const patchCall = fetchSpy.mock.calls.find(
      (c) => (c[1] as RequestInit | undefined)?.method === 'PATCH',
    );
    expect(patchCall).toBeTruthy();
    expect(patchCall![0]).toBe('/api/rooms/r1/suggestions/s-pending');
    expect(JSON.parse((patchCall![1] as RequestInit).body as string)).toEqual({
      status: 'approved',
    });
    await act(async () => {
      await Promise.resolve();
    });
  });

  it('PATCHes with rejected status when reject clicked', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ suggestions: [PENDING] }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ suggestion: { ...PENDING, status: 'rejected' } }),
          { status: 200 },
        ),
      );
    vi.stubGlobal('fetch', fetchSpy);
    const user = userEvent.setup();
    render(<OwnerSuggestionQueue roomId="r1" />);
    await screen.findByText('Pending Title');
    await user.click(screen.getByRole('button', { name: /거절/ }));
    const patchCall = fetchSpy.mock.calls.find(
      (c) => (c[1] as RequestInit | undefined)?.method === 'PATCH',
    );
    expect(patchCall).toBeTruthy();
    expect(JSON.parse((patchCall![1] as RequestInit).body as string)).toEqual({
      status: 'rejected',
    });
  });
});
