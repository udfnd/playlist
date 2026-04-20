import { ImageResponse } from 'next/og';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { fetchYouTubePlaylist, type AuthMethod } from '@/lib/youtube/fetch-playlist';

// Edge-friendly OG/Twitter card image renderer for /[handle]/[slug].
//
// Runs at request time and renders a 1200×630 card that matches the matte-black + warm
// amber brand tone, shows the room title, the owner's @handle, and up to four playlist
// cover thumbnails. Output is cached for 5 minutes to avoid hammering the YouTube API
// every time a social crawler fetches it.

export const runtime = 'nodejs';
export const alt = 'onrepeat listening room';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const revalidate = 300;

const MATTE_BLACK = '#0A0A0A';
const WARM_AMBER = '#E8A84C';
const CREAM_WHITE = '#F5F0E6';

interface ParamsShape {
  handle: string;
  slug: string;
}

export default async function OpengraphImage({
  params,
}: {
  params: ParamsShape;
}) {
  const supabase = getSupabaseAdmin();

  const { data: owner } = await supabase
    .from('users')
    .select('id, handle')
    .eq('handle', params.handle)
    .maybeSingle();

  const { data: room } = owner
    ? await supabase
        .from('rooms')
        .select('title, source_playlist_id, user_id')
        .eq('user_id', owner.id)
        .eq('slug', params.slug)
        .maybeSingle()
    : { data: null };

  // Collect up to 4 cover thumbnails if we can reach the source playlist. OG rendering
  // must stay best-effort: if YouTube is unavailable or the playlist is private, we fall
  // back to the gradient-only card.
  let covers: string[] = [];
  if (room) {
    try {
      let authMethod: AuthMethod | null = null;
      const { data: conn } = await supabase
        .from('music_connections')
        .select('access_token')
        .eq('user_id', room.user_id)
        .eq('provider', 'google')
        .maybeSingle();
      if (conn?.access_token) {
        authMethod = { type: 'oauth', accessToken: conn.access_token };
      } else if (process.env.YOUTUBE_API_KEY) {
        authMethod = { type: 'apiKey', key: process.env.YOUTUBE_API_KEY };
      }
      if (authMethod) {
        const playlist = await fetchYouTubePlaylist(
          room.source_playlist_id,
          authMethod,
        );
        covers = playlist.songs
          .map((s) => s.thumbnailUrl)
          .filter((u): u is string => Boolean(u))
          .slice(0, 4);
      }
    } catch {
      // Swallow — fall back to gradient card.
    }
  }

  const title = room?.title ?? 'Room not found';
  const handle = owner?.handle ?? params.handle;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: MATTE_BLACK,
          color: CREAM_WHITE,
          padding: 72,
          position: 'relative',
          fontFamily: 'system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif',
          backgroundImage: `radial-gradient(ellipse 70% 50% at 50% 60%, rgba(232,168,76,0.22), transparent 65%), radial-gradient(ellipse 120% 70% at 50% 110%, rgba(107,91,138,0.28), transparent 70%)`,
        }}
      >
        {/* Cover collage, optional */}
        {covers.length > 0 && (
          <div
            style={{
              position: 'absolute',
              top: 72,
              right: 72,
              display: 'flex',
              flexDirection: 'row',
              gap: 12,
            }}
          >
            {covers.map((url, i) => (
              // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
              <img
                key={i}
                src={url}
                width={120}
                height={120}
                style={{
                  borderRadius: 12,
                  objectFit: 'cover',
                  transform: `translateY(${i * 8}px) rotate(${(i - 1.5) * 3}deg)`,
                  boxShadow: '0 12px 32px rgba(0,0,0,0.45)',
                }}
              />
            ))}
          </div>
        )}

        {/* Bottom-left stack: brand, @handle, title */}
        <div
          style={{
            marginTop: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              fontSize: 22,
              letterSpacing: '-0.01em',
              color: WARM_AMBER,
            }}
          >
            <span style={{ fontWeight: 700 }}>onrepeat</span>
            <span style={{ opacity: 0.4 }}>·</span>
            <span style={{ opacity: 0.8, fontFamily: 'ui-monospace, monospace' }}>
              @{handle}
            </span>
          </div>
          <div
            style={{
              fontSize: 72,
              fontWeight: 700,
              letterSpacing: '-0.03em',
              lineHeight: 1.05,
              maxWidth: '70%',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical' as const,
              overflow: 'hidden',
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontSize: 22,
              opacity: 0.5,
              fontFamily: 'ui-monospace, monospace',
            }}
          >
            onrepeat.cc/{handle}/{params.slug}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
