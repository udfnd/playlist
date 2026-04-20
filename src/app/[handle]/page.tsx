import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

interface ProfilePageParams {
  handle: string;
}

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<ProfilePageParams>;
}): Promise<Metadata> {
  const { handle } = await params;
  return {
    title: `@${handle} — onrepeat`,
    description: `Listening rooms published by @${handle} on onrepeat.cc`,
  };
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return new Date(iso).toLocaleDateString();
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<ProfilePageParams>;
}) {
  const { handle } = await params;

  const supabase = getSupabaseAdmin();
  const { data: owner } = await supabase
    .from('users')
    .select('id, handle, display_name, avatar_url')
    .eq('handle', handle)
    .maybeSingle();
  if (!owner) notFound();

  // Public profile only shows public rooms; unlisted is reserved for direct links.
  const { data: rooms } = await supabase
    .from('rooms')
    .select('id, slug, title, visibility, created_at')
    .eq('user_id', owner.id)
    .eq('visibility', 'public')
    .order('created_at', { ascending: false });

  const roomList = rooms ?? [];

  return (
    <main className="min-h-dvh w-full bg-matte-black text-cream-white">
      <header
        className="flex items-center justify-between gap-4 px-5 py-4 border-b border-cream-white/10"
        style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}
      >
        <Link
          href="/"
          className="text-lg font-sans font-bold text-cream-white hover:text-warm-amber transition-colors"
        >
          onrepeat
        </Link>
      </header>

      <section className="max-w-3xl mx-auto px-5 py-8 flex flex-col gap-8">
        <div className="flex items-center gap-4">
          {owner.avatar_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={owner.avatar_url}
              alt=""
              className="w-16 h-16 rounded-full object-cover bg-vinyl-black"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-vinyl-black flex items-center justify-center text-xl font-sans font-bold text-warm-amber">
              {owner.handle!.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex flex-col gap-0.5 min-w-0">
            <h1 className="text-xl font-sans font-bold truncate">
              @{owner.handle}
            </h1>
            {owner.display_name && (
              <p className="text-sm font-sans text-cream-white/60 truncate">
                {owner.display_name}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-sans font-semibold text-cream-white/80">
            Rooms
          </h2>
          <p className="text-xs font-sans text-cream-white/40">
            {roomList.length === 0
              ? 'No public rooms yet.'
              : `${roomList.length} public ${roomList.length === 1 ? 'room' : 'rooms'}`}
          </p>
        </div>

        {roomList.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center gap-3 py-16 border border-dashed border-cream-white/10 rounded-2xl">
            <p className="text-sm font-sans text-cream-white/60">
              @{owner.handle} hasn&apos;t published any public rooms yet.
            </p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {roomList.map((room) => (
              <li key={room.id}>
                <Link
                  href={`/${owner.handle}/${room.slug}`}
                  className="flex flex-col gap-2 p-4 rounded-xl bg-vinyl-black border border-cream-white/5 hover:border-cream-white/20 transition-colors"
                >
                  <h3 className="text-sm font-sans font-semibold text-cream-white truncate">
                    {room.title}
                  </h3>
                  <div className="flex items-center justify-between text-xs font-sans text-cream-white/40">
                    <span className="font-mono truncate">
                      /{owner.handle}/{room.slug}
                    </span>
                    <span className="flex-shrink-0 ml-2">
                      {formatRelative(room.created_at)}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
