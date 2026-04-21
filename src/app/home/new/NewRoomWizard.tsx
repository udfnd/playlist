'use client';

// @MX:SPEC: SPEC-SPOTIFY-001
// New Room wizard. Users pick a source (YouTube | Spotify), pick a playlist
// from that source, then configure title / preset / visibility. Publishing
// hits POST /api/me/rooms with the selected sourceProvider. The Spotify
// branch preserves the YouTube flow exactly — the URL fallback, playlist
// list layout, and publish button are source-agnostic.

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { PRESETS, DEFAULT_PRESET_KEY } from '@/lib/presets';
import type { GeneratedPreset } from '@/lib/presets/types';

type Visibility = 'public' | 'unlisted' | 'private';
type Step = 'pick' | 'setup' | 'publishing';
type SourceProvider = 'youtube' | 'spotify';

interface UserPlaylist {
  id: string;
  title: string;
  description?: string;
  thumbnailUrl: string;
  itemCount: number;
  // YouTube uses `privacyStatus`; Spotify uses `privacy`. We normalize to
  // a common `privacyLabel` at fetch time so the list view stays uniform.
  privacyLabel: string;
}

interface PickedPlaylist {
  sourcePlaylistId: string;
  defaultTitle: string;
  thumbnailUrl: string | null;
  provider: SourceProvider;
}

export function NewRoomWizard() {
  const [step, setStep] = useState<Step>('pick');
  const [sourceProvider, setSourceProvider] = useState<SourceProvider>('youtube');
  const [picked, setPicked] = useState<PickedPlaylist | null>(null);
  const [title, setTitle] = useState('');
  const [presetKey, setPresetKey] = useState<string>(DEFAULT_PRESET_KEY);
  const [visibility, setVisibility] = useState<Visibility>('public');
  const [error, setError] = useState<string | null>(null);

  // Custom AI preset state — active when presetKey === 'custom'
  const [customPrompt, setCustomPrompt] = useState('');
  const [generatedPreset, setGeneratedPreset] = useState<GeneratedPreset | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Picker state (per-source)
  const [playlists, setPlaylists] = useState<UserPlaylist[]>([]);
  const [fetching, setFetching] = useState(true);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState('');

  // Spotify connection probe — `null` means "not yet checked"; only queried
  // on demand when the user switches to the Spotify tab so we avoid a
  // useless network call for users who stay on YouTube.
  const [spotifyConnected, setSpotifyConnected] = useState<boolean | null>(null);

  // Load playlists for the active source. Re-runs when switching tabs or
  // returning to the pick step. Spotify also needs the connection probe
  // first — we short-circuit and render the connect CTA if disconnected.
  useEffect(() => {
    if (step !== 'pick') return;
    let cancelled = false;

    async function load() {
      setPickerError(null);
      setPlaylists([]);

      if (sourceProvider === 'youtube') {
        setFetching(true);
        try {
          const res = await fetch('/api/my-playlists');
          const data = await res.json();
          if (cancelled) return;
          if (data.error) throw new Error(data.error);
          setPlaylists(
            (
              data.playlists as Array<{
                id: string;
                title: string;
                description: string;
                thumbnailUrl: string;
                itemCount: number;
                privacyStatus: string;
              }>
            ).map((p) => ({
              id: p.id,
              title: p.title,
              description: p.description,
              thumbnailUrl: p.thumbnailUrl,
              itemCount: p.itemCount,
              privacyLabel: p.privacyStatus,
            })),
          );
        } catch (err) {
          if (!cancelled) setPickerError(err instanceof Error ? err.message : 'Unknown error.');
        } finally {
          if (!cancelled) setFetching(false);
        }
        return;
      }

      // Spotify path: probe connection first.
      setFetching(true);
      try {
        const probe = await fetch('/api/me/spotify/status');
        const probeData = await probe.json();
        if (cancelled) return;
        const connected = Boolean(probeData.connected);
        setSpotifyConnected(connected);
        if (!connected) {
          setPlaylists([]);
          return;
        }
        const res = await fetch('/api/me/spotify/playlists');
        const data = await res.json();
        if (cancelled) return;
        if (data.error) throw new Error(data.error);
        setPlaylists(
          (
            data.playlists as Array<{
              id: string;
              title: string;
              thumbnailUrl: string;
              itemCount: number;
              privacy: string;
            }>
          ).map((p) => ({
            id: p.id,
            title: p.title,
            thumbnailUrl: p.thumbnailUrl,
            itemCount: p.itemCount,
            privacyLabel: p.privacy,
          })),
        );
      } catch (err) {
        if (!cancelled) setPickerError(err instanceof Error ? err.message : 'Unknown error.');
      } finally {
        if (!cancelled) setFetching(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [step, sourceProvider]);

  const handlePickPlaylist = useCallback(
    (pl: UserPlaylist) => {
      setPicked({
        sourcePlaylistId: pl.id,
        defaultTitle: pl.title,
        thumbnailUrl: pl.thumbnailUrl,
        provider: sourceProvider,
      });
      setTitle(pl.title);
      setStep('setup');
      setError(null);
    },
    [sourceProvider],
  );

  const handlePickUrl = useCallback(async () => {
    const input = urlInput.trim();
    if (!input) return;
    setPickerError(null);
    try {
      const endpoint =
        sourceProvider === 'spotify'
          ? `/api/spotify/playlist?list=${encodeURIComponent(input)}`
          : `/api/playlist?list=${encodeURIComponent(input)}`;
      const res = await fetch(endpoint);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Could not load this playlist.');
      setPicked({
        sourcePlaylistId: data.id,
        defaultTitle: data.name,
        thumbnailUrl: data.songs?.[0]?.thumbnailUrl ?? null,
        provider: sourceProvider,
      });
      setTitle(data.name);
      setStep('setup');
    } catch (err) {
      setPickerError(err instanceof Error ? err.message : 'Unknown error.');
    }
  }, [urlInput, sourceProvider]);

  const handlePublish = useCallback(async () => {
    if (!picked) return;
    setStep('publishing');
    setError(null);
    try {
      const res = await fetch('/api/me/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          sourceProvider: picked.provider,
          sourcePlaylistId: picked.sourcePlaylistId,
          presetKey,
          generatedPreset: presetKey === 'custom' ? generatedPreset : undefined,
          visibility,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to create the room.');
        setStep('setup');
        return;
      }
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error.');
      setStep('setup');
    }
  }, [picked, title, presetKey, generatedPreset, visibility]);

  const handleGeneratePreset = useCallback(async () => {
    const prompt = customPrompt.trim();
    if (prompt.length < 2) return;
    setGenerating(true);
    setGenerateError(null);
    try {
      const res = await fetch('/api/me/presets/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to generate preset.');
      setGeneratedPreset(data.preset as GeneratedPreset);
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'Unknown error.');
    } finally {
      setGenerating(false);
    }
  }, [customPrompt]);

  const placeholderUrl =
    sourceProvider === 'spotify'
      ? 'https://open.spotify.com/playlist/...'
      : 'https://www.youtube.com/playlist?list=...';
  const pickHeading =
    sourceProvider === 'spotify'
      ? 'Spotify 플레이리스트 선택'
      : 'Pick a YouTube playlist';
  const mineHeading =
    sourceProvider === 'spotify' ? 'Your Spotify playlists' : 'Your YouTube playlists';
  const providerLabel = sourceProvider === 'spotify' ? 'Spotify playlist' : 'YouTube playlist';
  const showConnectCta = sourceProvider === 'spotify' && spotifyConnected === false;

  return (
    <main className="min-h-dvh w-full bg-matte-black text-cream-white">
      <header
        className="flex items-center justify-between gap-4 px-5 py-4 border-b border-cream-white/10"
        style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}
      >
        <Link
          href="/home"
          className="flex items-center gap-1.5 px-3 py-2 rounded-full border border-cream-white/15 text-cream-white/80 hover:text-cream-white hover:border-cream-white/30 text-sm font-sans transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
            <path
              fillRule="evenodd"
              d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z"
              clipRule="evenodd"
            />
          </svg>
          <span>Cancel</span>
        </Link>
        <h1 className="text-sm font-sans font-semibold text-cream-white">
          New room
        </h1>
        <span className="w-[76px]" aria-hidden />
      </header>

      <section className="max-w-xl mx-auto px-5 py-10 flex flex-col gap-8">
        {/* Step indicator — visual progress, not just text */}
        <nav aria-label="Wizard progress" className="flex items-center gap-3">
          {(['pick', 'setup'] as const).map((s, i) => {
            const isActive = step === s || (s === 'setup' && step === 'publishing');
            const isComplete = i === 0 && (step === 'setup' || step === 'publishing');
            return (
              <div key={s} className="flex items-center gap-3 flex-1">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-mono font-semibold flex-shrink-0 transition-colors ${
                      isComplete
                        ? 'bg-warm-amber text-matte-black'
                        : isActive
                          ? 'bg-warm-amber/20 text-warm-amber ring-1 ring-warm-amber/50'
                          : 'bg-cream-white/5 text-cream-white/40'
                    }`}
                    aria-current={isActive && !isComplete ? 'step' : undefined}
                  >
                    {isComplete ? (
                      <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                        <path fillRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-8 8a1 1 0 01-1.4 0l-4-4a1 1 0 111.4-1.4L8 12.58l7.3-7.3a1 1 0 011.4 0z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      i + 1
                    )}
                  </span>
                  <span
                    className={`text-xs font-sans ${
                      isActive || isComplete ? 'text-cream-white' : 'text-cream-white/40'
                    }`}
                  >
                    {s === 'pick' ? 'Pick playlist' : 'Set up room'}
                  </span>
                </div>
                {i === 0 && (
                  <div
                    className={`flex-1 h-px ${isComplete ? 'bg-warm-amber/50' : 'bg-cream-white/10'}`}
                    aria-hidden
                  />
                )}
              </div>
            );
          })}
        </nav>

        {step === 'pick' && (
          <>
            {/* Source toggle — horizontal segmented control. Switching clears
                the current selection implicitly via the useEffect reload. */}
            <div
              role="tablist"
              aria-label="Playlist source"
              className="flex gap-1 p-1 rounded-full bg-vinyl-black border border-cream-white/10 self-start"
            >
              {(['youtube', 'spotify'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  role="tab"
                  aria-selected={sourceProvider === p}
                  onClick={() => setSourceProvider(p)}
                  className={`px-4 py-1.5 rounded-full text-xs font-sans font-semibold transition-colors ${
                    sourceProvider === p
                      ? 'bg-warm-amber text-matte-black'
                      : 'text-cream-white/60 hover:text-cream-white'
                  }`}
                >
                  {p === 'youtube' ? 'YouTube' : 'Spotify'}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-2">
              <h2 className="text-lg font-sans font-semibold">{pickHeading}</h2>
              <p className="text-sm font-sans text-cream-white/60">
                {sourceProvider === 'spotify'
                  ? '본인 계정의 플레이리스트에서 고르거나, 공개 Spotify 플레이리스트 URL을 붙여 넣으세요.'
                  : 'Choose one of your playlists, or paste a public YouTube playlist URL.'}
              </p>
            </div>

            {showConnectCta ? (
              <div className="flex flex-col gap-3 p-5 rounded-xl bg-vinyl-black border border-warm-amber/30">
                <p className="text-sm font-sans text-cream-white">
                  Spotify 계정을 연결하면 본인 플레이리스트를 방으로 만들 수 있어요.
                </p>
                <a
                  href={`/api/auth/spotify/connect?returnTo=${encodeURIComponent('/home/new')}`}
                  className="self-start inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-warm-amber text-matte-black text-sm font-sans font-semibold hover:bg-warm-amber/90 transition-colors"
                >
                  Spotify 연결하기
                </a>
              </div>
            ) : (
              <>
                {/* URL fallback */}
                <div className="flex flex-col gap-2 p-4 rounded-xl bg-vinyl-black border border-cream-white/5">
                  <label
                    htmlFor="pl-url"
                    className="text-xs font-sans text-cream-white/60"
                  >
                    Paste a playlist URL
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="pl-url"
                      type="url"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      placeholder={placeholderUrl}
                      className="flex-1 bg-matte-black border border-cream-white/15 rounded-lg px-3 py-2 text-sm font-sans text-cream-white placeholder:text-cream-white/25 outline-none focus:border-warm-amber/60 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={handlePickUrl}
                      disabled={!urlInput.trim()}
                      className="px-4 py-2 rounded-lg bg-warm-amber text-matte-black text-sm font-sans font-semibold hover:bg-warm-amber/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                    >
                      Use
                    </button>
                  </div>
                  {pickerError && (
                    <p className="text-xs font-sans text-red-400">{pickerError}</p>
                  )}
                </div>

                {/* My playlists — source-specific */}
                <div className="flex flex-col gap-3">
                  <h3 className="text-xs font-sans text-cream-white/60 uppercase tracking-wider">
                    {mineHeading}
                  </h3>
                  {fetching && (
                    <div className="flex items-center justify-center py-6">
                      <div className="w-5 h-5 border-2 border-warm-amber/30 border-t-warm-amber rounded-full animate-spin" />
                    </div>
                  )}
                  {!fetching && playlists.length === 0 && !pickerError && (
                    <p className="text-sm text-cream-white/40 text-center py-6">
                      {sourceProvider === 'spotify'
                        ? '플레이리스트가 없습니다.'
                        : 'No playlists found on your YouTube account.'}
                    </p>
                  )}
                  <div className="flex flex-col gap-2">
                    {playlists.map((pl) => (
                      <button
                        key={pl.id}
                        type="button"
                        onClick={() => handlePickPlaylist(pl)}
                        className="flex items-center gap-3 p-3 rounded-lg bg-vinyl-black border border-cream-white/5 hover:border-cream-white/20 transition-colors text-left"
                      >
                        {pl.thumbnailUrl ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={pl.thumbnailUrl}
                            alt=""
                            className="w-12 h-12 rounded object-cover flex-shrink-0 bg-matte-black"
                          />
                        ) : (
                          <div
                            aria-hidden
                            className="w-12 h-12 rounded flex-shrink-0 bg-matte-black/60"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-sans font-semibold text-cream-white truncate">
                            {pl.title}
                          </p>
                          <p className="text-xs font-mono text-cream-white/40">
                            {pl.itemCount} tracks · {pl.privacyLabel}
                          </p>
                        </div>
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          className="text-cream-white/30 flex-shrink-0"
                          aria-hidden
                        >
                          <path
                            fillRule="evenodd"
                            d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {(step === 'setup' || step === 'publishing') && picked && (
          <>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-vinyl-black border border-cream-white/5">
              {picked.thumbnailUrl && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={picked.thumbnailUrl}
                  alt=""
                  className="w-12 h-12 rounded object-cover flex-shrink-0 bg-matte-black"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-sans font-semibold text-cream-white truncate">
                  {picked.defaultTitle}
                </p>
                <p className="text-xs font-mono text-cream-white/40">{providerLabel}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPicked(null);
                  setStep('pick');
                }}
                className="text-xs font-sans text-cream-white/50 hover:text-cream-white transition-colors"
                disabled={step === 'publishing'}
              >
                Change
              </button>
            </div>

            <div className="flex flex-col gap-2">
              <label
                htmlFor="room-title"
                className="text-xs font-sans text-cream-white/60"
              >
                Room title
              </label>
              <input
                id="room-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value.slice(0, 120))}
                maxLength={120}
                required
                disabled={step === 'publishing'}
                className="bg-matte-black border border-cream-white/15 rounded-lg px-3 py-2 text-sm font-sans text-cream-white placeholder:text-cream-white/25 outline-none focus:border-warm-amber/60 transition-colors"
                placeholder="Room title"
              />
            </div>

            <fieldset className="flex flex-col gap-2">
              <legend className="text-xs font-sans text-cream-white/60 mb-1">
                Visual preset
              </legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {PRESETS.map((p) => (
                  <label
                    key={p.key}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors cursor-pointer ${
                      presetKey === p.key
                        ? 'border-warm-amber/50 bg-warm-amber/5'
                        : 'border-cream-white/10 hover:border-cream-white/20'
                    }`}
                  >
                    <input
                      type="radio"
                      name="preset"
                      value={p.key}
                      checked={presetKey === p.key}
                      onChange={() => setPresetKey(p.key)}
                      disabled={step === 'publishing'}
                      className="sr-only"
                    />
                    <span
                      aria-hidden
                      className="w-10 h-10 rounded-md flex-shrink-0 border border-cream-white/10"
                      style={{
                        background: `linear-gradient(135deg, ${p.swatch[0]} 0%, ${p.swatch[1]} 55%, ${p.swatch[2]} 100%)`,
                      }}
                    />
                    <span className="flex flex-col min-w-0">
                      <span className="text-sm font-sans font-medium text-cream-white truncate">
                        {p.label}
                      </span>
                      <span className="text-[11px] font-sans text-cream-white/50 leading-4 truncate">
                        {p.description}
                      </span>
                    </span>
                  </label>
                ))}

                {/* Custom AI preset slot. */}
                <label
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors cursor-pointer ${
                    presetKey === 'custom'
                      ? 'border-warm-amber/50 bg-warm-amber/5'
                      : 'border-cream-white/10 hover:border-cream-white/20'
                  }`}
                >
                  <input
                    type="radio"
                    name="preset"
                    value="custom"
                    checked={presetKey === 'custom'}
                    onChange={() => setPresetKey('custom')}
                    disabled={step === 'publishing'}
                    className="sr-only"
                  />
                  <span
                    aria-hidden
                    className="w-10 h-10 rounded-md flex-shrink-0 border border-cream-white/10 flex items-center justify-center"
                    style={
                      generatedPreset
                        ? {
                            background: `linear-gradient(135deg, ${generatedPreset.swatch[0]} 0%, ${generatedPreset.swatch[1]} 55%, ${generatedPreset.swatch[2]} 100%)`,
                          }
                        : {
                            background:
                              'linear-gradient(135deg, #181028 0%, #3c2670 55%, #a2609b 100%)',
                          }
                    }
                  >
                    {!generatedPreset && (
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="text-cream-white/80"
                        aria-hidden
                      >
                        <path d="M10 2l1.2 3.8L15 7l-3.8 1.2L10 12l-1.2-3.8L5 7l3.8-1.2L10 2zm6 8l.6 1.9L18.5 13l-1.9.6L16 16l-.6-1.9L13.5 13l1.9-.6L16 10z" />
                      </svg>
                    )}
                  </span>
                  <span className="flex flex-col min-w-0">
                    <span className="text-sm font-sans font-medium text-cream-white truncate">
                      {generatedPreset?.label ?? 'Custom (AI)'}
                    </span>
                    <span className="text-[11px] font-sans text-cream-white/50 leading-4 truncate">
                      {generatedPreset?.description ??
                        'Describe the vibe; Claude generates a palette.'}
                    </span>
                  </span>
                </label>
              </div>

              {presetKey === 'custom' && (
                <div className="flex flex-col gap-2 mt-2 p-3 rounded-lg bg-matte-black/60 border border-cream-white/10">
                  <label
                    htmlFor="preset-prompt"
                    className="text-xs font-sans text-cream-white/60"
                  >
                    Describe your vibe
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="preset-prompt"
                      type="text"
                      value={customPrompt}
                      onChange={(e) => setCustomPrompt(e.target.value.slice(0, 200))}
                      disabled={generating || step === 'publishing'}
                      placeholder="rainy cafe in shibuya, 2am"
                      className="flex-1 bg-matte-black border border-cream-white/15 rounded-lg px-3 py-2 text-sm font-sans text-cream-white placeholder:text-cream-white/25 outline-none focus:border-warm-amber/60 transition-colors disabled:opacity-50"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !generating) {
                          e.preventDefault();
                          handleGeneratePreset();
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleGeneratePreset}
                      disabled={
                        generating ||
                        step === 'publishing' ||
                        customPrompt.trim().length < 2
                      }
                      className="px-3 py-2 rounded-lg bg-warm-amber text-matte-black text-xs font-sans font-semibold hover:bg-warm-amber/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                    >
                      {generating
                        ? 'Generating…'
                        : generatedPreset
                          ? 'Regenerate'
                          : 'Generate'}
                    </button>
                  </div>
                  {generateError && (
                    <p className="text-[11px] font-sans text-red-400 leading-4">
                      {generateError}
                    </p>
                  )}
                  {generatedPreset && (
                    <p className="text-[11px] font-sans text-cream-white/50 leading-4">
                      Palette ready — it applies when you publish.
                    </p>
                  )}
                </div>
              )}
            </fieldset>

            <fieldset className="flex flex-col gap-2">
              <legend className="text-xs font-sans text-cream-white/60 mb-1">
                Who can view?
              </legend>
              {(
                [
                  ['public', 'Public', 'Anyone can find and view.'],
                  ['unlisted', 'Unlisted', 'Only people with the link.'],
                  ['private', 'Private', 'Only you.'],
                ] as const
              ).map(([value, label, hint]) => (
                <label
                  key={value}
                  className={`flex items-start gap-3 px-3 py-2.5 rounded-lg border transition-colors cursor-pointer ${
                    visibility === value
                      ? 'border-warm-amber/50 bg-warm-amber/5'
                      : 'border-cream-white/10 hover:border-cream-white/20'
                  }`}
                >
                  <input
                    type="radio"
                    name="visibility"
                    value={value}
                    checked={visibility === value}
                    onChange={() => setVisibility(value)}
                    disabled={step === 'publishing'}
                    className="mt-0.5 accent-warm-amber"
                  />
                  <span className="flex flex-col">
                    <span className="text-sm font-sans font-medium text-cream-white">
                      {label}
                    </span>
                    <span className="text-xs font-sans text-cream-white/50">
                      {hint}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>

            {error && (
              <p className="text-xs font-sans text-red-400 leading-5">{error}</p>
            )}

            <button
              type="button"
              onClick={handlePublish}
              disabled={
                step === 'publishing' ||
                !title.trim() ||
                (presetKey === 'custom' && !generatedPreset)
              }
              className="w-full px-4 py-3 rounded-lg bg-warm-amber text-matte-black text-sm font-sans font-semibold hover:bg-warm-amber/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {step === 'publishing'
                ? 'Publishing…'
                : presetKey === 'custom' && !generatedPreset
                  ? 'Generate a palette first'
                  : 'Publish room'}
            </button>
          </>
        )}
      </section>
    </main>
  );
}
