// @MX:SPEC: SPEC-SOCIAL-001
// Unit tests for suggestions service: create / list / moderate / rate-limit.

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createSuggestion,
  listSuggestionsForVisitor,
  listSuggestionsForOwner,
  moderateSuggestion,
  checkSuggestionRateLimit,
  __resetSuggestionRateLimit,
} from '../service';
import { makeSuggestionStub } from './_helpers';

const ROOM_ID = 'room-aaa';
const OWNER_ID = 'owner-uuid';
const USER_ID = 'user-uuid';
const OTHER_USER_ID = 'other-uuid';

function youtubeRoom(): Record<string, unknown> {
  return { id: ROOM_ID, user_id: OWNER_ID, source_provider: 'youtube' };
}
function spotifyRoom(): Record<string, unknown> {
  return { id: ROOM_ID, user_id: OWNER_ID, source_provider: 'spotify' };
}

describe('createSuggestion', () => {
  beforeEach(() => __resetSuggestionRateLimit());

  it('creates a pending row when provider matches', async () => {
    const stub = makeSuggestionStub({ rooms: [{ ...youtubeRoom(), id: ROOM_ID }] });
    const res = await createSuggestion(stub.client, {
      roomId: ROOM_ID,
      suggestedBy: USER_ID,
      sourceProvider: 'youtube',
      externalTrackId: 'vid-123',
      title: 'Hello',
      artist: 'Adele',
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.suggestion.status).toBe('pending');
      expect(res.suggestion.suggested_by).toBe(USER_ID);
    }
  });

  it('rejects with provider_mismatch when room provider differs', async () => {
    const stub = makeSuggestionStub({ rooms: [{ ...youtubeRoom(), id: ROOM_ID }] });
    const res = await createSuggestion(stub.client, {
      roomId: ROOM_ID,
      suggestedBy: USER_ID,
      sourceProvider: 'spotify',
      externalTrackId: 'sp-track',
      title: 'X',
      artist: 'Y',
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('provider_mismatch');
  });

  it('returns duplicate when DB unique constraint fires', async () => {
    const stub = makeSuggestionStub({
      rooms: [{ ...spotifyRoom(), id: ROOM_ID }],
      insertConflict: true,
    });
    const res = await createSuggestion(stub.client, {
      roomId: ROOM_ID,
      suggestedBy: USER_ID,
      sourceProvider: 'spotify',
      externalTrackId: 'sp-track',
      title: 'X',
      artist: 'Y',
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('duplicate');
  });

  it('returns rate_limited when exceeding 5/hour for same actor+room', async () => {
    const stub = makeSuggestionStub({ rooms: [{ ...spotifyRoom(), id: ROOM_ID }] });
    for (let i = 0; i < 5; i++) {
      const r = await createSuggestion(stub.client, {
        roomId: ROOM_ID,
        suggestedBy: USER_ID,
        sourceProvider: 'spotify',
        externalTrackId: `sp-${i}`,
        title: 'X',
        artist: 'Y',
      });
      expect(r.ok).toBe(true);
    }
    const sixth = await createSuggestion(stub.client, {
      roomId: ROOM_ID,
      suggestedBy: USER_ID,
      sourceProvider: 'spotify',
      externalTrackId: 'sp-6',
      title: 'X',
      artist: 'Y',
    });
    expect(sixth.ok).toBe(false);
    if (!sixth.ok) {
      expect(sixth.code).toBe('rate_limited');
      expect(sixth.retryAfter).toBeGreaterThan(0);
    }
  });
});

describe('listSuggestions*', () => {
  it('listSuggestionsForVisitor returns only approved', async () => {
    const stub = makeSuggestionStub({
      suggestions: [
        { id: 's1', room_id: ROOM_ID, status: 'pending' },
        { id: 's2', room_id: ROOM_ID, status: 'approved' },
        { id: 's3', room_id: ROOM_ID, status: 'rejected' },
      ],
    });
    const rows = await listSuggestionsForVisitor(stub.client, ROOM_ID);
    expect(rows.map((r) => r.id)).toEqual(['s2']);
  });

  it('listSuggestionsForOwner returns all rows for the room', async () => {
    const stub = makeSuggestionStub({
      suggestions: [
        { id: 's1', room_id: ROOM_ID, status: 'pending' },
        { id: 's2', room_id: ROOM_ID, status: 'approved' },
        { id: 's3', room_id: ROOM_ID, status: 'rejected' },
        { id: 's4', room_id: 'other-room', status: 'pending' },
      ],
    });
    const rows = await listSuggestionsForOwner(stub.client, ROOM_ID);
    expect(rows.length).toBe(3);
  });
});

describe('moderateSuggestion', () => {
  beforeEach(() => __resetSuggestionRateLimit());

  it('approve: updates row, inserts room_extra_tracks at position 1 when none exist', async () => {
    const stub = makeSuggestionStub({
      rooms: [{ ...spotifyRoom(), id: ROOM_ID }],
      suggestions: [
        {
          id: 's1',
          room_id: ROOM_ID,
          suggested_by: USER_ID,
          status: 'pending',
        },
      ],
    });
    const res = await moderateSuggestion(stub.client, {
      suggestionId: 's1',
      ownerUserId: OWNER_ID,
      status: 'approved',
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.row.status).toBe('approved');
      expect(res.row.resolved_at).toBeTruthy();
      expect(res.extraTrack?.position).toBe(1);
      expect(res.extraTrack?.suggestion_id).toBe('s1');
    }
    expect(stub.state.extraTracks.length).toBe(1);
  });

  it('approve: assigns position MAX(position)+1 when prior rows exist', async () => {
    const stub = makeSuggestionStub({
      rooms: [{ ...spotifyRoom(), id: ROOM_ID }],
      suggestions: [
        { id: 's2', room_id: ROOM_ID, suggested_by: USER_ID, status: 'pending' },
      ],
      extraTracks: [
        { id: 'e1', room_id: ROOM_ID, suggestion_id: 'old-1', position: 1 },
        { id: 'e2', room_id: ROOM_ID, suggestion_id: 'old-2', position: 7 },
      ],
    });
    const res = await moderateSuggestion(stub.client, {
      suggestionId: 's2',
      ownerUserId: OWNER_ID,
      status: 'approved',
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.extraTrack?.position).toBe(8);
  });

  it('reject: updates row, does not insert into room_extra_tracks', async () => {
    const stub = makeSuggestionStub({
      rooms: [{ ...spotifyRoom(), id: ROOM_ID }],
      suggestions: [
        { id: 's3', room_id: ROOM_ID, suggested_by: USER_ID, status: 'pending' },
      ],
    });
    const res = await moderateSuggestion(stub.client, {
      suggestionId: 's3',
      ownerUserId: OWNER_ID,
      status: 'rejected',
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.row.status).toBe('rejected');
      expect(res.extraTrack).toBeUndefined();
    }
    expect(stub.state.extraTracks.length).toBe(0);
  });

  it('non-owner: returns forbidden, leaves row unchanged', async () => {
    const stub = makeSuggestionStub({
      rooms: [{ ...spotifyRoom(), id: ROOM_ID }],
      suggestions: [
        { id: 's4', room_id: ROOM_ID, suggested_by: USER_ID, status: 'pending' },
      ],
    });
    const res = await moderateSuggestion(stub.client, {
      suggestionId: 's4',
      ownerUserId: OTHER_USER_ID,
      status: 'approved',
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('forbidden');
    expect(stub.state.suggestions[0].status).toBe('pending');
  });

  it('not_found: missing suggestion id', async () => {
    const stub = makeSuggestionStub({});
    const res = await moderateSuggestion(stub.client, {
      suggestionId: 'missing',
      ownerUserId: OWNER_ID,
      status: 'approved',
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('not_found');
  });

  it('already_resolved: rejects when status != pending', async () => {
    const stub = makeSuggestionStub({
      rooms: [{ ...spotifyRoom(), id: ROOM_ID }],
      suggestions: [
        { id: 's5', room_id: ROOM_ID, suggested_by: USER_ID, status: 'rejected' },
      ],
    });
    const res = await moderateSuggestion(stub.client, {
      suggestionId: 's5',
      ownerUserId: OWNER_ID,
      status: 'approved',
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('already_resolved');
  });
});

describe('checkSuggestionRateLimit', () => {
  beforeEach(() => __resetSuggestionRateLimit());

  it('allows 5 within 1h, blocks 6th', () => {
    for (let i = 0; i < 5; i++) {
      expect(checkSuggestionRateLimit(USER_ID, ROOM_ID).ok).toBe(true);
    }
    const r = checkSuggestionRateLimit(USER_ID, ROOM_ID);
    expect(r.ok).toBe(false);
    expect(r.retryAfter).toBeGreaterThan(0);
  });

  it('keeps buckets isolated per (user, room) pair', () => {
    for (let i = 0; i < 5; i++) checkSuggestionRateLimit(USER_ID, ROOM_ID);
    expect(checkSuggestionRateLimit(USER_ID, 'other-room').ok).toBe(true);
    expect(checkSuggestionRateLimit(OTHER_USER_ID, ROOM_ID).ok).toBe(true);
  });
});
