import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { generateSlugCandidate, pickAvailableSlug } from '@/lib/slug';
import { DEFAULT_PRESET_KEY, VALID_PRESET_KEYS } from '@/lib/presets';
import type { Json } from '@/lib/supabase/database.types';

export async function GET() {
  const session = await auth();
  if (!session?.userId) {
    return NextResponse.json(
      { error: 'Not authenticated, or Supabase is not configured.' },
      { status: 401 },
    );
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('rooms')
    .select(
      'id, slug, title, preset_key, visibility, source_provider, source_playlist_id, created_at',
    )
    .eq('user_id', session.userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[rooms] list failed:', error);
    return NextResponse.json({ error: 'Failed to load rooms.' }, { status: 500 });
  }

  return NextResponse.json({ rooms: data ?? [] });
}

interface CreateRoomBody {
  title?: string;
  sourceProvider?: 'youtube' | 'spotify';
  sourcePlaylistId?: string;
  presetKey?: string;
  /**
   * Present only when the user chose the "Custom" LLM-generated preset in the wizard.
   * Must match the shape produced by /api/me/presets/generate — we re-validate here
   * so the client can't forge a palette that bypasses the generator's schema.
   */
  generatedPreset?: unknown;
  visibility?: 'public' | 'unlisted' | 'private';
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
function isHex(v: unknown): v is string {
  return typeof v === 'string' && HEX_RE.test(v);
}

/**
 * Lightweight re-validation of the generatedPreset payload. We don't want to trust
 * the client after the generate endpoint returned it — they could have edited the
 * request body — so we check the same shape the generator enforces.
 */
function validateGeneratedPreset(raw: unknown): raw is {
  label: string;
  description: string;
  lighting: {
    keyColor: string;
    keyIntensity: number;
    fillColor: string;
    fillIntensity: number;
    ambientIntensity: number;
  };
  cylinderColor: string;
  swatch: [string, string, string];
  backdrop: { base: string; glowPrimary: string; glowSecondary: string };
  aurora: { a: string; b: string; c: string };
} {
  if (!raw || typeof raw !== 'object') return false;
  const r = raw as Record<string, unknown>;
  if (typeof r.label !== 'string' || !r.label) return false;
  if (typeof r.description !== 'string') return false;
  const l = r.lighting as Record<string, unknown> | undefined;
  if (!l || !isHex(l.keyColor) || !isHex(l.fillColor)) return false;
  if (typeof l.keyIntensity !== 'number' || typeof l.fillIntensity !== 'number') return false;
  if (typeof l.ambientIntensity !== 'number') return false;
  if (!isHex(r.cylinderColor)) return false;
  if (!Array.isArray(r.swatch) || r.swatch.length !== 3 || !r.swatch.every(isHex)) return false;
  const b = r.backdrop as Record<string, unknown> | undefined;
  if (!b || !isHex(b.base) || !isHex(b.glowPrimary) || !isHex(b.glowSecondary)) return false;
  const a = r.aurora as Record<string, unknown> | undefined;
  if (!a || !isHex(a.a) || !isHex(a.b) || !isHex(a.c)) return false;
  return true;
}

const ALLOWED_VISIBILITY = new Set(['public', 'unlisted', 'private']);

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.userId) {
    return NextResponse.json(
      { error: 'Not authenticated, or Supabase is not configured.' },
      { status: 401 },
    );
  }
  if (!session.handle) {
    return NextResponse.json(
      { error: 'Pick a handle before creating a room.' },
      { status: 409 },
    );
  }

  let body: CreateRoomBody;
  try {
    body = (await request.json()) as CreateRoomBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const title = body.title?.trim();
  if (!title || title.length > 120) {
    return NextResponse.json(
      { error: 'Title is required and must be 120 characters or fewer.' },
      { status: 400 },
    );
  }

  const sourceProvider = body.sourceProvider;
  if (sourceProvider !== 'youtube' && sourceProvider !== 'spotify') {
    return NextResponse.json(
      { error: 'sourceProvider must be "youtube" or "spotify".' },
      { status: 400 },
    );
  }

  const sourcePlaylistId = body.sourcePlaylistId?.trim();
  if (!sourcePlaylistId) {
    return NextResponse.json(
      { error: 'sourcePlaylistId is required.' },
      { status: 400 },
    );
  }

  // Determine the preset source. Two mutually-exclusive paths:
  //   1. Curated preset — presetKey references a key in VALID_PRESET_KEYS, no generated.
  //   2. Custom (AI) — presetKey is 'custom' AND generatedPreset carries a valid palette.
  const presetKey = body.presetKey ?? DEFAULT_PRESET_KEY;
  const isCustom = presetKey === 'custom';

  if (isCustom) {
    if (!validateGeneratedPreset(body.generatedPreset)) {
      return NextResponse.json(
        { error: 'Custom preset payload is missing or malformed.' },
        { status: 400 },
      );
    }
  } else if (!VALID_PRESET_KEYS.has(presetKey)) {
    return NextResponse.json(
      { error: `presetKey "${presetKey}" is not available.` },
      { status: 400 },
    );
  }

  const visibility = body.visibility ?? 'public';
  if (!ALLOWED_VISIBILITY.has(visibility)) {
    return NextResponse.json(
      { error: 'visibility must be one of public, unlisted, private.' },
      { status: 400 },
    );
  }

  const supabase = getSupabaseAdmin();

  // Pick a unique slug within this user's namespace. Read all existing slugs that
  // share the same base prefix once, then compute a non-colliding candidate in memory.
  const base = generateSlugCandidate(title);
  const { data: existingRows, error: existingErr } = await supabase
    .from('rooms')
    .select('slug')
    .eq('user_id', session.userId)
    .like('slug', `${base}%`);
  if (existingErr) {
    console.error('[rooms] slug scan failed:', existingErr);
    return NextResponse.json(
      { error: 'Could not generate a unique slug.' },
      { status: 500 },
    );
  }
  const slug = pickAvailableSlug(
    base,
    (existingRows ?? []).map((r) => r.slug),
  );

  const { data: room, error: insertErr } = await supabase
    .from('rooms')
    .insert({
      user_id: session.userId,
      slug,
      title,
      preset_key: presetKey,
      source_provider: sourceProvider,
      source_playlist_id: sourcePlaylistId,
      visibility,
      // Only stored for custom rooms; null for curated presets. Cast via Json
      // because the schema's Json type covers plain-object shapes exactly.
      generated_preset: isCustom
        ? (body.generatedPreset as Json)
        : null,
    })
    .select('id, slug, title, preset_key, visibility, created_at')
    .single();

  if (insertErr || !room) {
    // 23505 = unique_violation (race with another concurrent insert)
    const code = (insertErr as { code?: string } | null)?.code;
    if (code === '23505') {
      return NextResponse.json(
        { error: 'A room with this slug was just created — try again.' },
        { status: 409 },
      );
    }
    console.error('[rooms] insert failed:', insertErr);
    return NextResponse.json(
      { error: 'Failed to create room.' },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    room,
    // URL has no leading "@" on the handle because Next.js App Router reserves "@"-
    // prefixed path segments for parallel route slots, which prevents dynamic matching.
    // The UI still displays "@handle" as a visual prefix.
    url: `/${session.handle}/${room.slug}`,
  });
}
