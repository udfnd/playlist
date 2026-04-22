// @MX:SPEC: SPEC-SOCIAL-001
// Unit tests for reactions service: upsert/delete/list/visibility/rate-limit.

import { describe, it, expect, beforeEach } from 'vitest';
import {
  upsertReaction,
  deleteReaction,
  listReactions,
  visibilityAllows,
  checkReactionRateLimit,
  __resetReactionRateLimit,
} from '../service';
import { makeReactionStub } from './_helpers';

const ROOM_ID = 'room-aaa';
const TRACK_REF = 'track-xyz';
const VISITOR_ID = 'vvvv1111-2222-3333-4444-555555555555';
const OTHER_VISITOR_ID = 'vvvv9999-2222-3333-4444-555555555555';
const USER_ID = 'uuuu1111-2222-3333-4444-555555555555';

describe('upsertReaction', () => {
  it('creates a row on first call (created: true)', async () => {
    const stub = makeReactionStub();
    const res = await upsertReaction(stub.client, {
      roomId: ROOM_ID,
      trackRef: TRACK_REF,
      actorKind: 'visitor',
      actorId: VISITOR_ID,
      emoji: '❤️',
    });
    expect(res.created).toBe(true);
    expect(res.reaction.id).toBeTruthy();
    expect(stub.state.inserts.length).toBe(1);
  });

  it('returns existing row when the unique tuple already exists (created: false)', async () => {
    const stub = makeReactionStub({
      rows: [
        {
          id: 'existing-1',
          room_id: ROOM_ID,
          track_ref: TRACK_REF,
          actor_kind: 'visitor',
          visitor_id: VISITOR_ID,
          user_id: null,
          emoji: '❤️',
        },
      ],
      insertConflict: true,
    });
    const res = await upsertReaction(stub.client, {
      roomId: ROOM_ID,
      trackRef: TRACK_REF,
      actorKind: 'visitor',
      actorId: VISITOR_ID,
      emoji: '❤️',
    });
    expect(res.created).toBe(false);
    expect(res.reaction.id).toBe('existing-1');
  });
});

describe('deleteReaction', () => {
  it('deletes only rows whose actor matches', async () => {
    const stub = makeReactionStub({
      rows: [
        {
          id: 'r1',
          room_id: ROOM_ID,
          track_ref: TRACK_REF,
          actor_kind: 'visitor',
          visitor_id: VISITOR_ID,
          user_id: null,
          emoji: '❤️',
        },
        {
          id: 'r2',
          room_id: ROOM_ID,
          track_ref: TRACK_REF,
          actor_kind: 'visitor',
          visitor_id: OTHER_VISITOR_ID,
          user_id: null,
          emoji: '❤️',
        },
      ],
    });
    const res = await deleteReaction(stub.client, {
      roomId: ROOM_ID,
      trackRef: TRACK_REF,
      actorKind: 'visitor',
      actorId: VISITOR_ID,
      emoji: '❤️',
    });
    expect(res.deleted).toBe(1);
    // The other visitor's row must remain.
    expect(stub.state.rows.length).toBe(1);
    expect(stub.state.rows[0].id).toBe('r2');
  });

  it('returns deleted:0 when no match (different actor)', async () => {
    const stub = makeReactionStub({
      rows: [
        {
          id: 'r1',
          room_id: ROOM_ID,
          track_ref: TRACK_REF,
          actor_kind: 'user',
          visitor_id: null,
          user_id: USER_ID,
          emoji: '❤️',
        },
      ],
    });
    const res = await deleteReaction(stub.client, {
      roomId: ROOM_ID,
      trackRef: TRACK_REF,
      actorKind: 'visitor',
      actorId: VISITOR_ID,
      emoji: '❤️',
    });
    expect(res.deleted).toBe(0);
  });
});

describe('listReactions', () => {
  it('returns all rows for a room', async () => {
    const stub = makeReactionStub({
      rows: [
        {
          id: 'r1',
          room_id: ROOM_ID,
          track_ref: TRACK_REF,
          actor_kind: 'visitor',
          visitor_id: VISITOR_ID,
          user_id: null,
          emoji: '❤️',
        },
        {
          id: 'r2',
          room_id: ROOM_ID,
          track_ref: TRACK_REF,
          actor_kind: 'visitor',
          visitor_id: OTHER_VISITOR_ID,
          user_id: null,
          emoji: '🔥',
        },
      ],
    });
    const rows = await listReactions(stub.client, ROOM_ID);
    expect(rows.length).toBe(2);
  });
});

describe('visibilityAllows', () => {
  it('allows public rooms for any actor', () => {
    expect(
      visibilityAllows(
        { visibility: 'public', user_id: 'owner' },
        'visitor',
        VISITOR_ID,
      ),
    ).toBe(true);
  });

  it('allows unlisted rooms for any actor', () => {
    expect(
      visibilityAllows(
        { visibility: 'unlisted', user_id: 'owner' },
        'visitor',
        VISITOR_ID,
      ),
    ).toBe(true);
  });

  it('rejects private rooms for non-owner', () => {
    expect(
      visibilityAllows(
        { visibility: 'private', user_id: 'owner' },
        'user',
        'different-user',
      ),
    ).toBe(false);
    expect(
      visibilityAllows(
        { visibility: 'private', user_id: 'owner' },
        'visitor',
        VISITOR_ID,
      ),
    ).toBe(false);
  });

  it('allows private room for the owner', () => {
    expect(
      visibilityAllows(
        { visibility: 'private', user_id: 'owner-123' },
        'user',
        'owner-123',
      ),
    ).toBe(true);
  });
});

describe('checkReactionRateLimit', () => {
  beforeEach(() => {
    __resetReactionRateLimit();
  });

  it('allows 30 mutations in 60 seconds', () => {
    for (let i = 0; i < 30; i++) {
      const res = checkReactionRateLimit('actor-A');
      expect(res.ok).toBe(true);
    }
  });

  it('rejects the 31st mutation with retryAfter', () => {
    for (let i = 0; i < 30; i++) {
      checkReactionRateLimit('actor-B');
    }
    const res = checkReactionRateLimit('actor-B');
    expect(res.ok).toBe(false);
    expect(res.retryAfter).toBeGreaterThan(0);
    expect(res.retryAfter).toBeLessThanOrEqual(60);
  });

  it('keeps buckets separate by actor', () => {
    for (let i = 0; i < 30; i++) {
      checkReactionRateLimit('actor-C');
    }
    const res = checkReactionRateLimit('actor-D');
    expect(res.ok).toBe(true);
  });
});
