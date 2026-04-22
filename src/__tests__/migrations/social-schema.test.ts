// @MX:SPEC: SPEC-SOCIAL-001
// Drift-detection for 20260422_social_layer.sql. We don't execute the SQL
// here; we only parse it to ensure the expected statements are present, so a
// subsequent edit can't silently drop a table or RLS line.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const MIGRATION_PATH = path.resolve(
  __dirname,
  '../../../supabase/migrations/20260422_social_layer.sql',
);

describe('SPEC-SOCIAL-001 social schema migration', () => {
  const sql = readFileSync(MIGRATION_PATH, 'utf8');

  it('creates the four expected tables', () => {
    const creates = sql.match(/create table public\.(\w+)/gi) ?? [];
    const names = creates.map((line) => line.split('.')[1].toLowerCase());
    expect(names).toEqual([
      'visitors',
      'track_reactions',
      'track_suggestions',
      'room_extra_tracks',
    ]);
  });

  it('enables RLS on all four tables', () => {
    const rls = sql.match(/alter table public\.\w+\s+enable row level security/gi) ?? [];
    expect(rls.length).toBe(4);
  });

  it('defines the reactions UNIQUE constraint on the idempotency key', () => {
    // The unique block wraps: room_id, track_ref, actor_kind, coalesce(...), emoji
    expect(sql).toMatch(/unique\s*\(\s*room_id,\s*track_ref,\s*actor_kind,/);
    expect(sql).toMatch(/coalesce\s*\(\s*visitor_id::text,\s*user_id::text\s*\)/);
  });
});
