// @MX:SPEC: SPEC-SPOTIFY-001
// Tests for the NewRoomWizard source toggle and Spotify branch (T-009 /
// REQ-SPOT-001..003, Scenario 2 & 5). YouTube behavior is exercised by
// existing flows — these tests focus on the Spotify additions and guard
// against regression (Publish payload carries `sourceProvider: 'spotify'`).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NewRoomWizard } from '@/app/home/new/NewRoomWizard';

/**
 * Minimal URL-router fetch mock. Tests provide a map of URL substring → JSON
 * response. Any unmatched URL throws so misconfigured tests fail loudly.
 */
function installFetch(
  routes: Record<
    string,
    { status?: number; body: unknown } | ((input: string, init?: RequestInit) => { status?: number; body: unknown })
  >,
): {
  calls: Array<{ url: string; init?: RequestInit }>;
} {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    for (const key of Object.keys(routes)) {
      if (url.includes(key)) {
        const handler = routes[key];
        const out = typeof handler === 'function' ? handler(url, init) : handler;
        return new Response(JSON.stringify(out.body), {
          status: out.status ?? 200,
          headers: { 'content-type': 'application/json' },
        });
      }
    }
    throw new Error(`installFetch: no route for ${url}`);
  });
  vi.stubGlobal('fetch', fn);
  return { calls };
}

beforeEach(() => {
  // jsdom/happy-dom lacks a real location; guard against navigation during Publish.
  Object.defineProperty(window, 'location', {
    writable: true,
    value: { href: '' } as Location,
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('NewRoomWizard — source toggle', () => {
  it('renders the YouTube tab by default and lists YouTube playlists', async () => {
    installFetch({
      '/api/my-playlists': {
        body: {
          playlists: [
            {
              id: 'yt1',
              title: 'My YT',
              description: '',
              thumbnailUrl: '',
              itemCount: 10,
              privacyStatus: 'public',
            },
          ],
        },
      },
    });

    render(<NewRoomWizard />);

    await waitFor(() => {
      expect(screen.getByText('My YT')).toBeInTheDocument();
    });
    // Toggle controls should both be present
    expect(screen.getByRole('tab', { name: /^YouTube$/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^Spotify$/ })).toBeInTheDocument();
  });

  it('shows the connect CTA when Spotify tab is chosen and not connected', async () => {
    installFetch({
      '/api/my-playlists': { body: { playlists: [] } },
      '/api/me/spotify/status': { body: { connected: false } },
    });

    render(<NewRoomWizard />);
    await userEvent.click(screen.getByRole('tab', { name: /^Spotify$/ }));

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /Spotify 연결하기/ })).toBeInTheDocument();
    });
    const link = screen.getByRole('link', { name: /Spotify 연결하기/ }) as HTMLAnchorElement;
    expect(link.getAttribute('href')).toContain('/api/auth/spotify/connect');
    expect(link.getAttribute('href')).toContain('returnTo=%2Fhome%2Fnew');
  });

  it('lists Spotify playlists when connected', async () => {
    installFetch({
      '/api/my-playlists': { body: { playlists: [] } },
      '/api/me/spotify/status': { body: { connected: true } },
      '/api/me/spotify/playlists': {
        body: {
          playlists: [
            { id: 'sp1', title: 'Focus', thumbnailUrl: '', itemCount: 22, privacy: 'private' },
          ],
        },
      },
    });

    render(<NewRoomWizard />);
    await userEvent.click(screen.getByRole('tab', { name: /^Spotify$/ }));

    await waitFor(() => {
      expect(screen.getByText('Focus')).toBeInTheDocument();
    });
  });

  it('publishes with sourceProvider "spotify" when a Spotify playlist is picked', async () => {
    const { calls } = installFetch({
      '/api/my-playlists': { body: { playlists: [] } },
      '/api/me/spotify/status': { body: { connected: true } },
      '/api/me/spotify/playlists': {
        body: {
          playlists: [
            { id: 'sp1', title: 'Focus', thumbnailUrl: '', itemCount: 22, privacy: 'private' },
          ],
        },
      },
      '/api/me/rooms': { body: { ok: true, url: '/u/test' } },
    });

    render(<NewRoomWizard />);
    await userEvent.click(screen.getByRole('tab', { name: /^Spotify$/ }));

    const picker = await screen.findByRole('button', { name: /Focus/ });
    await userEvent.click(picker);

    const publish = await screen.findByRole('button', { name: /Publish room/ });
    await userEvent.click(publish);

    await waitFor(() => {
      const postCall = calls.find(
        (c) => c.url.includes('/api/me/rooms') && c.init?.method === 'POST',
      );
      expect(postCall).toBeDefined();
      const body = JSON.parse((postCall!.init!.body as string) ?? '{}');
      expect(body.sourceProvider).toBe('spotify');
      expect(body.sourcePlaylistId).toBe('sp1');
    });
  });
});
