import { ImageResponse } from 'next/og';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

// Edge-friendly OG/Twitter card image renderer for /[handle]/[slug].
//
// Runs at request time and renders a 1200×630 card that matches the matte-black + warm
// amber brand tone, showing the room title and owner's @handle. Output is cached for
// 5 minutes via the revalidate export.

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
  params: Promise<ParamsShape>;
}) {
  const { handle, slug } = await params;

  let title = 'Room not found';
  let resolvedHandle = handle;

  try {
    const supabase = getSupabaseAdmin();
    const { data: owner } = await supabase
      .from('users')
      .select('id, handle')
      .eq('handle', handle)
      .maybeSingle();
    if (owner) {
      resolvedHandle = owner.handle ?? handle;
      const { data: room } = await supabase
        .from('rooms')
        .select('title')
        .eq('user_id', owner.id)
        .eq('slug', slug)
        .maybeSingle();
      if (room) title = room.title;
    }
  } catch (err) {
    // Never let Supabase errors take down the OG endpoint — degrade to the
    // "Room not found" card so crawlers still get *something* to show.
    console.error('[og] lookup failed:', err);
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          backgroundColor: MATTE_BLACK,
          color: CREAM_WHITE,
          padding: 72,
          position: 'relative',
          fontFamily: 'system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif',
          backgroundImage:
            'radial-gradient(ellipse 70% 50% at 50% 60%, rgba(232,168,76,0.22), transparent 65%), radial-gradient(ellipse 120% 70% at 50% 110%, rgba(107,91,138,0.28), transparent 70%)',
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
            marginBottom: 12,
          }}
        >
          <span style={{ fontWeight: 700 }}>onrepeat</span>
          <span style={{ opacity: 0.4 }}>·</span>
          <span style={{ opacity: 0.85, fontFamily: 'ui-monospace, monospace' }}>
            @{resolvedHandle}
          </span>
        </div>

        <div
          style={{
            fontSize: 76,
            fontWeight: 700,
            letterSpacing: '-0.03em',
            lineHeight: 1.05,
            maxWidth: '90%',
            display: 'flex',
          }}
        >
          {title}
        </div>

        <div
          style={{
            display: 'flex',
            marginTop: 16,
            fontSize: 22,
            opacity: 0.55,
            fontFamily: 'ui-monospace, monospace',
          }}
        >
          onrepeat.cc/{resolvedHandle}/{slug}
        </div>
      </div>
    ),
    size,
  );
}
