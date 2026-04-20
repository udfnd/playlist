import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { auth } from '@/auth';
import type { GeneratedPreset } from '@/lib/presets/types';

// LLM-generated preset endpoint. Takes a short mood prompt and asks Claude Haiku to
// produce a structured palette that the carousel can render directly. No code or CSS
// strings leave the LLM — only hex colors and numeric intensities — so there's no
// injection surface.

export const runtime = 'nodejs';

const MODEL = 'claude-haiku-4-5';

const SYSTEM_PROMPT = `You are a palette designer for a 3D music visualizer called "onrepeat".

Given a short mood description, return a JSON object describing a cohesive visual palette.
Output VALID JSON ONLY — no prose, no markdown fencing, no trailing text.

Schema (every field required):
{
  "label": string — 2 to 3 words, title-cased, human-friendly preset name,
  "description": string — single sentence, max 70 chars, evoking the mood,
  "lighting": {
    "keyColor": "#RRGGBB",        // warm or cool directional light, saturated
    "keyIntensity": number,        // 1.4 to 2.4
    "fillColor": "#RRGGBB",        // complementary fill light, desaturated
    "fillIntensity": number,       // 0.3 to 0.7
    "ambientIntensity": number     // 0.3 to 0.6
  },
  "cylinderColor": "#RRGGBB",      // darker than base, slightly tinted by glow
  "swatch": ["#RRGGBB", "#RRGGBB", "#RRGGBB"], // [base, primary, accent] for UI chip
  "backdrop": {
    "base": "#RRGGBB",             // dark background; 8% to 15% luminance
    "glowPrimary": "#RRGGBB",      // main accent color, most saturated
    "glowSecondary": "#RRGGBB"     // secondary accent, complementary, less saturated
  },
  "aurora": {
    "a": "#RRGGBB",                // center aurora blob
    "b": "#RRGGBB",                // lower-left blob, usually complementary
    "c": "#RRGGBB"                 // upper-right blob, tertiary accent or highlight
  }
}

Rules:
- All hex values MUST be #RRGGBB (uppercase or lowercase, no alpha).
- backdrop.base must be dark; glow colors must be noticeably brighter than base.
- cylinderColor must be darker than backdrop.base.
- The three aurora colors should feel harmonious as a trio.
- Keep the palette within 3-5 dominant hues — no rainbow.
- Never repeat the same hex twice; avoid pure #000000 or #FFFFFF.
- Output MUST parse as JSON.`;

interface ClaudeResponseShape {
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
  backdrop: {
    base: string;
    glowPrimary: string;
    glowSecondary: string;
  };
  aurora: { a: string; b: string; c: string };
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function isHex(v: unknown): v is string {
  return typeof v === 'string' && HEX_RE.test(v);
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function validate(raw: unknown): GeneratedPreset | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<ClaudeResponseShape>;
  const l = r.lighting;
  const b = r.backdrop;
  const a = r.aurora;

  if (typeof r.label !== 'string' || r.label.length === 0 || r.label.length > 40) return null;
  if (typeof r.description !== 'string' || r.description.length === 0 || r.description.length > 90) return null;
  if (!l || typeof l !== 'object') return null;
  if (!isHex(l.keyColor) || !isHex(l.fillColor)) return null;
  if (typeof l.keyIntensity !== 'number' || typeof l.fillIntensity !== 'number') return null;
  if (typeof l.ambientIntensity !== 'number') return null;
  if (!isHex(r.cylinderColor)) return null;
  if (!Array.isArray(r.swatch) || r.swatch.length !== 3 || !r.swatch.every(isHex)) return null;
  if (!b || !isHex(b.base) || !isHex(b.glowPrimary) || !isHex(b.glowSecondary)) return null;
  if (!a || !isHex(a.a) || !isHex(a.b) || !isHex(a.c)) return null;

  // Normalize — cap intensities to the documented ranges so a hallucinated 10.0 doesn't
  // melt the scene, and force labels/description to sane lengths just in case.
  return {
    label: r.label.trim().slice(0, 40),
    description: r.description.trim().slice(0, 90),
    lighting: {
      keyColor: l.keyColor,
      keyIntensity: clamp(l.keyIntensity, 1.0, 2.8),
      fillColor: l.fillColor,
      fillIntensity: clamp(l.fillIntensity, 0.15, 0.9),
      ambientIntensity: clamp(l.ambientIntensity, 0.2, 0.7),
    },
    cylinderColor: r.cylinderColor,
    swatch: [r.swatch[0], r.swatch[1], r.swatch[2]],
    backdrop: {
      base: b.base,
      glowPrimary: b.glowPrimary,
      glowSecondary: b.glowSecondary,
    },
    aurora: { a: a.a, b: a.b, c: a.c },
  };
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.userId) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Preset generation is not configured on this environment.' },
      { status: 503 },
    );
  }

  let body: { prompt?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  if (prompt.length < 2 || prompt.length > 200) {
    return NextResponse.json(
      { error: 'prompt must be 2-200 characters.' },
      { status: 400 },
    );
  }

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 600,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Mood: ${prompt}` }],
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();

    // Tolerate a leading code fence just in case the model wraps its output.
    const stripped = text
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(stripped);
    } catch {
      console.error('[preset-gen] non-JSON response:', text.slice(0, 200));
      return NextResponse.json(
        { error: 'The palette generator returned malformed output. Try again.' },
        { status: 502 },
      );
    }

    const generated = validate(parsed);
    if (!generated) {
      console.error('[preset-gen] schema-invalid response:', parsed);
      return NextResponse.json(
        { error: 'The palette generator returned an invalid palette. Try again.' },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true, preset: generated });
  } catch (err) {
    console.error('[preset-gen] Anthropic call failed:', err);
    return NextResponse.json(
      { error: 'Palette generation is unavailable right now. Try again in a moment.' },
      { status: 502 },
    );
  }
}
