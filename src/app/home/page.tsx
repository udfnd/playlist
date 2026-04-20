import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth, signOut } from '@/auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { RoomCard, type RoomCardData } from './RoomCard';

export const metadata: Metadata = {
  title: 'Your rooms — onrepeat',
};

// No static generation: every request needs the session cookie.
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const session = await auth();

  // Not signed in → send to the landing page. (Supabase misconfigured counts as
  // "not signed in" because session.userId will be null and nothing here would work.)
  if (!session?.userId) redirect('/');
  // Signed in but no handle yet — the root-level HandlePickerModal will block interaction
  // regardless of route; landing the user here is fine, but reuse / so they get the
  // familiar post-login state until they choose a handle.
  if (!session.handle) redirect('/');

  const supabase = getSupabaseAdmin();
  const { data: rooms, error } = await supabase
    .from('rooms')
    .select('id, slug, title, visibility, created_at')
    .eq('user_id', session.userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[home] rooms load failed:', error);
  }

  const roomList: RoomCardData[] = (rooms ?? []).map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    visibility: r.visibility as RoomCardData['visibility'],
    created_at: r.created_at,
    handle: session.handle!,
  }));

  async function handleSignOut() {
    'use server';
    await signOut({ redirectTo: '/' });
  }

  return (
    <main className="min-h-dvh w-full bg-matte-black text-cream-white">
      <header
        className="flex items-center justify-between gap-4 px-5 py-4 border-b border-cream-white/10"
        style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}
      >
        <div className="flex items-baseline gap-2">
          <h1 className="text-lg font-sans font-bold text-cream-white">
            onrepeat
          </h1>
          <span className="text-xs font-mono text-cream-white/40">
            @{session.handle}
          </span>
        </div>
        <form action={handleSignOut}>
          <button
            type="submit"
            className="flex items-center gap-1.5 px-3 py-2 rounded-full border border-cream-white/15 text-cream-white/80 hover:text-cream-white hover:border-cream-white/30 hover:bg-cream-white/5 transition-colors text-sm font-sans"
          >
            <span>Sign out</span>
          </button>
        </form>
      </header>

      <section className="max-w-3xl mx-auto px-5 py-8 flex flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-sans font-semibold">Your rooms</h2>
            <p className="text-xs font-sans text-cream-white/50">
              Publish a playlist as a room to get a shareable URL.
            </p>
          </div>
          <Link
            href="/home/new"
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-warm-amber text-matte-black text-sm font-sans font-semibold hover:bg-warm-amber/90 transition-colors whitespace-nowrap"
          >
            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
              <path
                fillRule="evenodd"
                d="M10 3a.75.75 0 01.75.75v5.5h5.5a.75.75 0 010 1.5h-5.5v5.5a.75.75 0 01-1.5 0v-5.5h-5.5a.75.75 0 010-1.5h5.5v-5.5A.75.75 0 0110 3z"
                clipRule="evenodd"
              />
            </svg>
            <span>New room</span>
          </Link>
        </div>

        {roomList.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center gap-3 py-16 border border-dashed border-cream-white/10 rounded-2xl">
            <p className="text-sm font-sans text-cream-white/60">
              You haven&apos;t made a room yet.
            </p>
            <Link
              href="/home/new"
              className="text-sm font-sans text-warm-amber hover:text-warm-amber/80"
            >
              Create your first room →
            </Link>
          </div>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {roomList.map((room) => (
              <li key={room.id}>
                <RoomCard room={room} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
