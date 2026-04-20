'use client';

import { useState, useCallback, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { validateHandle } from '@/lib/handle-validation';

/**
 * Shown once when an authenticated user has no handle yet. The user chooses a URL slug
 * (`onrepeat.cc/@handle`) that becomes their public identity across rooms.
 *
 * Rendered from the root layout and self-gates on session state. When Supabase is not
 * configured (session.userId = null) the modal stays hidden — there is nothing to save.
 */
export function HandlePickerModal() {
  const { data: session, status, update } = useSession();
  const [value, setValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const open =
    status === 'authenticated' &&
    session?.userId != null &&
    session.handle == null;

  useEffect(() => {
    if (!open) setServerError(null);
  }, [open]);

  const localCheck = value ? validateHandle(value) : null;
  const clientError = localCheck && !localCheck.ok ? localCheck.reason : null;
  const canSubmit = !submitting && localCheck !== null && localCheck.ok;

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!canSubmit) return;
      setSubmitting(true);
      setServerError(null);

      try {
        const res = await fetch('/api/me/handle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ handle: value }),
        });
        const data = await res.json();
        if (!res.ok) {
          setServerError(data.error ?? 'Failed to save handle.');
          return;
        }
        // Refresh the session so `handle` propagates to every component that reads it.
        await update();
      } catch (err) {
        setServerError(
          err instanceof Error ? err.message : 'Unexpected error.',
        );
      } finally {
        setSubmitting(false);
      }
    },
    [canSubmit, value, update],
  );

  if (!open) return null;

  const displayError = serverError ?? clientError;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-matte-black/90 backdrop-blur-md px-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="handle-picker-title"
    >
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm bg-vinyl-black border border-cream-white/10 rounded-2xl p-6 flex flex-col gap-4"
      >
        <header className="flex flex-col gap-1">
          <h2
            id="handle-picker-title"
            className="text-lg font-sans font-semibold text-cream-white"
          >
            Pick your handle
          </h2>
          <p className="text-xs font-sans text-cream-white/50 leading-5">
            This becomes your public URL:{' '}
            <span className="font-mono text-cream-white/70">
              onrepeat.cc/@{value || 'your-handle'}
            </span>
          </p>
        </header>

        <div className="flex flex-col gap-2">
          <label
            htmlFor="handle-input"
            className="text-xs font-sans text-cream-white/60"
          >
            Handle
          </label>
          <div className="flex items-center gap-1 bg-matte-black border border-cream-white/15 rounded-lg px-3 py-2 focus-within:border-warm-amber/60 transition-colors">
            <span
              className="text-sm font-mono text-cream-white/40"
              aria-hidden
            >
              @
            </span>
            <input
              id="handle-input"
              type="text"
              value={value}
              onChange={(e) =>
                setValue(e.target.value.toLowerCase().slice(0, 24))
              }
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              placeholder="your-name"
              className="flex-1 bg-transparent text-sm font-mono text-cream-white placeholder:text-cream-white/25 outline-none"
              disabled={submitting}
              maxLength={24}
            />
          </div>
          <p
            className={`text-xs font-sans leading-5 ${
              displayError ? 'text-red-400' : 'text-cream-white/40'
            }`}
          >
            {displayError ??
              '3–24 chars. Letters, numbers, hyphens, underscores.'}
          </p>
        </div>

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full px-4 py-2.5 rounded-lg bg-warm-amber text-matte-black text-sm font-sans font-semibold hover:bg-warm-amber/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? 'Saving…' : 'Continue'}
        </button>
      </form>
    </div>
  );
}
