-- A-track: store an LLM-generated visual palette per room alongside the curated
-- preset_key. When generated_preset is non-null, the renderer ignores preset_key
-- and drives the carousel from the stored palette. preset_key stays as a human-
-- readable "source" label (e.g. 'custom' for AI-generated).

alter table public.rooms
  add column generated_preset jsonb;

comment on column public.rooms.generated_preset is
  'LLM-generated palette+lighting payload. Schema matches the GeneratedPreset type in src/lib/presets/generated.ts. Null for curated preset rooms.';
