'use client';

import { useCallback, useState } from 'react';

type Visibility = 'public' | 'unlisted' | 'private';

interface SaveAsRoomButtonProps {
  /** Source playlist id (YouTube) — the room will load this on every view. */
  sourcePlaylistId: string;
  /** Default title used to prefill the modal. */
  defaultTitle: string;
}

/**
 * Floating button shown on the carousel when an authenticated user with a handle is
 * viewing any playlist. Opens a modal that publishes the playlist as a persistent
 * room at onrepeat.cc/@handle/slug.
 */
export function SaveAsRoomButton({
  sourcePlaylistId,
  defaultTitle,
}: SaveAsRoomButtonProps) {
  const [isOpen, setOpen] = useState(false);
  const [title, setTitle] = useState(defaultTitle);
  const [visibility, setVisibility] = useState<Visibility>('public');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openModal = useCallback(() => {
    setTitle(defaultTitle);
    setVisibility('public');
    setError(null);
    setOpen(true);
  }, [defaultTitle]);

  const submit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (submitting) return;
      setSubmitting(true);
      setError(null);
      try {
        const res = await fetch('/api/me/rooms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title,
            sourceProvider: 'youtube',
            sourcePlaylistId,
            visibility,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? 'Failed to create the room.');
          return;
        }
        // Navigate the browser to the new room URL. Full reload here is fine — the room
        // page is server-rendered and needs a fresh request anyway.
        window.location.href = data.url;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unexpected error.');
      } finally {
        setSubmitting(false);
      }
    },
    [title, visibility, sourcePlaylistId, submitting],
  );

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="fixed top-[max(1rem,env(safe-area-inset-top))] right-4 z-[60] flex items-center gap-1.5 px-3 py-2 rounded-full bg-warm-amber/90 text-matte-black hover:bg-warm-amber transition-colors text-sm font-sans font-semibold"
        aria-label="Publish this playlist as a room"
      >
        <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
          <path
            fillRule="evenodd"
            d="M10 3a.75.75 0 01.75.75v5.5h5.5a.75.75 0 010 1.5h-5.5v5.5a.75.75 0 01-1.5 0v-5.5h-5.5a.75.75 0 010-1.5h5.5v-5.5A.75.75 0 0110 3z"
            clipRule="evenodd"
          />
        </svg>
        <span>Publish</span>
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-matte-black/90 backdrop-blur-md px-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="save-room-title"
        >
          <form
            onSubmit={submit}
            className="w-full max-w-sm bg-vinyl-black border border-cream-white/10 rounded-2xl p-6 flex flex-col gap-5"
          >
            <header className="flex flex-col gap-1">
              <h2
                id="save-room-title"
                className="text-lg font-sans font-semibold text-cream-white"
              >
                Publish as a room
              </h2>
              <p className="text-xs font-sans text-cream-white/50 leading-5">
                Creates a persistent URL you can share. You can change
                visibility anytime.
              </p>
            </header>

            <div className="flex flex-col gap-2">
              <label
                htmlFor="room-title"
                className="text-xs font-sans text-cream-white/60"
              >
                Title
              </label>
              <input
                id="room-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value.slice(0, 120))}
                maxLength={120}
                required
                disabled={submitting}
                className="bg-matte-black border border-cream-white/15 rounded-lg px-3 py-2 text-sm font-sans text-cream-white placeholder:text-cream-white/25 outline-none focus:border-warm-amber/60 transition-colors"
                placeholder="Room title"
              />
            </div>

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
                    disabled={submitting}
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

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => !submitting && setOpen(false)}
                disabled={submitting}
                className="px-3 py-2 text-sm font-sans text-cream-white/60 hover:text-cream-white transition-colors disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !title.trim()}
                className="px-4 py-2 rounded-lg bg-warm-amber text-matte-black text-sm font-sans font-semibold hover:bg-warm-amber/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? 'Publishing…' : 'Publish'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
