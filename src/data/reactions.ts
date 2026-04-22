// @MX:SPEC: SPEC-SOCIAL-001
// Single source of truth for the emoji palette. Both the reactions service
// layer and UI components import from here so that adding/removing an emoji
// only requires editing this file.

export const EMOJI_SET = ['❤️', '🔥', '✨', '🎧', '👍', '😭', '⭐', '🔁'] as const;

export type ReactionEmoji = (typeof EMOJI_SET)[number];

export function isReactionEmoji(value: unknown): value is ReactionEmoji {
  return typeof value === 'string' && (EMOJI_SET as readonly string[]).includes(value);
}
