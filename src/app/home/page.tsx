import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth, signOut } from '@/auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { RoomCard, type RoomCardData } from './RoomCard';
import { SpotifyStatus } from './SpotifyStatus';

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
  // Probe rooms and Spotify-connection state in parallel — the queries are
  // independent and running them sequentially costs a full Supabase RTT per
  // page load. Spotify presence is read server-side so the chip renders
  // without a client fetch; only presence is exposed, never the tokens.
  const [roomsResult, connResult] = await Promise.all([
    supabase
      .from('rooms')
      .select('id, slug, title, visibility, created_at')
      .eq('user_id', session.userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('music_connections')
      .select('user_id')
      .eq('user_id', session.userId)
      .eq('provider', 'spotify')
      .maybeSingle(),
  ]);
  const rooms = roomsResult.data;
  if (roomsResult.error) {
    console.error('[home] rooms load failed:', roomsResult.error);
  }
  const spotifyConnected = Boolean(connResult.data);

  // @MX:SPEC: SPEC-SOCIAL-001 — pending-suggestion count per owned room.
  // Cast to untyped client: track_suggestions is not in the generated types.
  const roomIds = (rooms ?? []).map((r) => r.id);
  const pendingByRoom = new Map<string, number>();
  if (roomIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const untyped = supabase as unknown as any;
    const { data: pending } = await untyped
      .from('track_suggestions')
      .select('room_id')
      .eq('status', 'pending')
      .in('room_id', roomIds);
    for (const row of (pending ?? []) as Array<{ room_id: string }>) {
      pendingByRoom.set(row.room_id, (pendingByRoom.get(row.room_id) ?? 0) + 1);
    }
  }

  const roomList: RoomCardData[] = (rooms ?? []).map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    visibility: r.visibility as RoomCardData['visibility'],
    created_at: r.created_at,
    handle: session.handle!,
    pendingCount: pendingByRoom.get(r.id) ?? 0,
  }));

  async function handleSignOut() {
    'use server';
    await signOut({ redirectTo: '/' });
  }

  return (
    <main className="min-h-dvh w-full bg-matte-black text-cream-white">
      <header
        className="sticky top-0 z-20 flex items-center justify-between gap-4 px-5 py-4 border-b border-cream-white/10 bg-matte-black/80 backdrop-blur-md"
        style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}
      >
        <Link
          href={`/${session.handle}`}
          className="flex items-baseline gap-2 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-warm-amber/60"
          aria-label="View your public profile"
        >
          <span className="text-lg font-sans font-bold text-cream-white tracking-tight">
            onrepeat
          </span>
          <span className="text-xs font-mono text-cream-white/50">
            @{session.handle}
          </span>
        </Link>
        <form action={handleSignOut}>
          <button
            type="submit"
            className="flex items-center gap-1.5 px-3 py-2 rounded-full border border-cream-white/15 text-cream-white/70 hover:text-cream-white hover:border-cream-white/30 hover:bg-cream-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-warm-amber/60 transition-colors text-sm font-sans"
          >
            <span>Sign out</span>
          </button>
        </form>
      </header>

      <section className="max-w-3xl mx-auto px-5 py-10 flex flex-col gap-8">
        <div className="flex items-center gap-3">
          <SpotifyStatus connected={spotifyConnected} />
        </div>

        <div className="flex items-end justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <h1 className="text-2xl font-sans font-bold tracking-tight">
              Your rooms
            </h1>
            <p className="text-sm font-sans text-cream-white/55 leading-5">
              Publish a playlist as a room to get a shareable URL.
            </p>
          </div>
          <Link
            href="/home/new"
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-warm-amber text-matte-black text-sm font-sans font-semibold hover:bg-warm-amber/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-warm-amber/60 focus-visible:ring-offset-2 focus-visible:ring-offset-matte-black transition-colors whitespace-nowrap"
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
          <div className="flex flex-col items-center justify-center text-center gap-4 py-20 px-6 border border-dashed border-cream-white/10 rounded-2xl">
            <div className="w-12 h-12 rounded-full bg-warm-amber/10 flex items-center justify-center">
              <svg width="22" height="22" viewBox="0 0 20 20" fill="currentColor" className="text-warm-amber" aria-hidden>
                <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm0 2a6 6 0 110 12 6 6 0 010-12zm-.25 2.75v3H6.75a.75.75 0 000 1.5h3v3a.75.75 0 001.5 0v-3h3a.75.75 0 000-1.5h-3v-3a.75.75 0 00-1.5 0z" />
              </svg>
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-base font-sans font-medium text-cream-white">
                No rooms yet
              </p>
              <p className="text-sm font-sans text-cream-white/50">
                Turn any YouTube playlist into a 3D listening room.
              </p>
            </div>
            <Link
              href="/home/new"
              className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-warm-amber text-matte-black text-sm font-sans font-semibold hover:bg-warm-amber/90 transition-colors"
            >
              Create your first room
              <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
              </svg>
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
