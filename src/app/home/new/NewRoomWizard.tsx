'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { PRESETS, DEFAULT_PRESET_KEY } from '@/lib/presets';

type Visibility = 'public' | 'unlisted' | 'private';
type Step = 'pick' | 'setup' | 'publishing';

interface UserPlaylist {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  itemCount: number;
  privacyStatus: string;
}

interface PickedPlaylist {
  sourcePlaylistId: string;
  defaultTitle: string;
  thumbnailUrl: string | null;
}

export function NewRoomWizard() {
  const [step, setStep] = useState<Step>('pick');
  const [picked, setPicked] = useState<PickedPlaylist | null>(null);
  const [title, setTitle] = useState('');
  const [presetKey, setPresetKey] = useState<string>(DEFAULT_PRESET_KEY);
  const [visibility, setVisibility] = useState<Visibility>('public');
  const [error, setError] = useState<string | null>(null);

  // Picker state
  const [playlists, setPlaylists] = useState<UserPlaylist[]>([]);
  const [fetching, setFetching] = useState(true);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState('');

  useEffect(() => {
    if (step !== 'pick') return;
    let cancelled = false;
    setFetching(true);
    fetch('/api/my-playlists')
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) throw new Error(data.error);
        setPlaylists(data.playlists as UserPlaylist[]);
      })
      .catch((err) => !cancelled && setPickerError(err.message))
      .finally(() => !cancelled && setFetching(false));
    return () => {
      cancelled = true;
    };
  }, [step]);

  const handlePickPlaylist = useCallback((pl: UserPlaylist) => {
    setPicked({
      sourcePlaylistId: pl.id,
      defaultTitle: pl.title,
      thumbnailUrl: pl.thumbnailUrl,
    });
    setTitle(pl.title);
    setStep('setup');
    setError(null);
  }, []);

  const handlePickUrl = useCallback(async () => {
    const input = urlInput.trim();
    if (!input) return;
    setPickerError(null);
    // Defer metadata fetch to the server when we publish; for the setup step we just need
    // the raw input and can extract an ID client-side, but a quick validation round-trip
    // to /api/playlist doubles as "does this playlist exist and resolve?" before the user
    // spends time picking a title.
    try {
      const res = await fetch(`/api/playlist?list=${encodeURIComponent(input)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Could not load this playlist.');
      setPicked({
        sourcePlaylistId: data.id,
        defaultTitle: data.name,
        thumbnailUrl: data.songs?.[0]?.thumbnailUrl ?? null,
      });
      setTitle(data.name);
      setStep('setup');
    } catch (err) {
      setPickerError(err instanceof Error ? err.message : 'Unknown error.');
    }
  }, [urlInput]);

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
          sourceProvider: 'youtube',
          sourcePlaylistId: picked.sourcePlaylistId,
          presetKey,
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
  }, [picked, title, presetKey, visibility]);

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

      <section className="max-w-xl mx-auto px-5 py-8 flex flex-col gap-6">
        {/* Step indicator */}
        <div className="flex items-center gap-2 text-xs font-mono text-cream-white/40">
          <span className={step === 'pick' ? 'text-cream-white' : ''}>1 · Pick</span>
          <span>→</span>
          <span className={step === 'setup' || step === 'publishing' ? 'text-cream-white' : ''}>
            2 · Setup
          </span>
        </div>

        {step === 'pick' && (
          <>
            <div className="flex flex-col gap-2">
              <h2 className="text-lg font-sans font-semibold">
                Pick a YouTube playlist
              </h2>
              <p className="text-sm font-sans text-cream-white/60">
                Choose one of your playlists, or paste a public YouTube
                playlist URL.
              </p>
            </div>

            {/* URL fallback */}
            <div className="flex flex-col gap-2 p-4 rounded-xl bg-vinyl-black border border-cream-white/5">
              <label
                htmlFor="yt-url"
                className="text-xs font-sans text-cream-white/60"
              >
                Paste a playlist URL
              </label>
              <div className="flex gap-2">
                <input
                  id="yt-url"
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://www.youtube.com/playlist?list=..."
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

            {/* My playlists from YouTube */}
            <div className="flex flex-col gap-3">
              <h3 className="text-xs font-sans text-cream-white/60 uppercase tracking-wider">
                Your YouTube playlists
              </h3>
              {fetching && (
                <div className="flex items-center justify-center py-6">
                  <div className="w-5 h-5 border-2 border-warm-amber/30 border-t-warm-amber rounded-full animate-spin" />
                </div>
              )}
              {!fetching && playlists.length === 0 && !pickerError && (
                <p className="text-sm text-cream-white/40 text-center py-6">
                  No playlists found on your YouTube account.
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
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={pl.thumbnailUrl}
                      alt=""
                      className="w-12 h-12 rounded object-cover flex-shrink-0 bg-matte-black"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-sans font-semibold text-cream-white truncate">
                        {pl.title}
                      </p>
                      <p className="text-xs font-mono text-cream-white/40">
                        {pl.itemCount} tracks · {pl.privacyStatus}
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
                <p className="text-xs font-mono text-cream-white/40">
                  YouTube playlist
                </p>
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
                    {/* Swatch: 3-stop gradient mirrors the runtime palette */}
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
              </div>
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
              disabled={step === 'publishing' || !title.trim()}
              className="w-full px-4 py-3 rounded-lg bg-warm-amber text-matte-black text-sm font-sans font-semibold hover:bg-warm-amber/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {step === 'publishing' ? 'Publishing…' : 'Publish room'}
            </button>
          </>
        )}
      </section>
    </main>
  );
}
