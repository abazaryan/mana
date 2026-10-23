import { describe, expect, it } from 'vitest';
import {
  canonicalJson,
  checkPushed,
  EARLIEST_AT,
  FUTURE_SLACK_MS,
  isoTime,
  MAX_RECORD_BYTES,
  reviveRecord,
  validRecordShape,
} from './journalRecord';

const USER = '11111111-1111-4111-8111-111111111111';
const NOW = Date.UTC(2026, 9, 23, 12, 0, 0);

function review(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'a0000000-0000-4000-8000-000000000001',
    type: 'review',
    userId: USER,
    deviceId: 'd0000000-0000-4000-8000-000000000001',
    at: new Date(NOW - 60_000),
    deckId: 'test-speak',
    entryId: 'bonjour',
    deckRevision: 9,
    sessionId: 's0000000-0000-4000-8000-000000000001',
    skill: 'speak',
    final: 3,
    suggested: 3,
    rules: 2,
    fsrs: { stateBefore: 2, dueBefore: new Date(NOW - 86_400_000), nextState: 2, nextDue: new Date(NOW + 3 * 86_400_000), stability: 3.2 },
    ...extra,
  };
}

/** What a device sends: the record through JSON.stringify. */
const wire = (r: unknown) => JSON.parse(JSON.stringify(r)) as unknown;

describe('isoTime', () => {
  it('accepts exactly the form JSON.stringify writes for a Date', () => {
    expect(isoTime('2026-10-23T10:00:00.123Z')).toBe(Date.UTC(2026, 9, 23, 10, 0, 0, 123));
  });
  it('refuses other forms and impossible dates', () => {
    for (const v of ['2026-10-23', '2026-10-23T10:00:00Z', '2026-10-23T10:00:00.123+02:00', '2026-02-30T10:00:00.000Z', 1_700_000_000_000, null]) {
      expect(isoTime(v)).toBeNull();
    }
  });
});

describe('validRecordShape', () => {
  it('known types with their own fields', () => {
    expect(validRecordShape(wire(review()))).toBe(true);
    expect(validRecordShape(wire({ ...review(), type: 'intro', skill: null }))).toBe(true);
    expect(validRecordShape(wire({ ...review(), type: 'drill', reviewId: 'r1' }))).toBe(true);
    expect(validRecordShape(wire({ ...review(), type: 'drill' }))).toBe(false);
    expect(validRecordShape(wire({ ...review(), type: 'intro' }))).toBe(false);
    expect(validRecordShape(wire({ ...review(), fsrs: undefined }))).toBe(false);
    expect(validRecordShape(wire({ ...review(), final: 5 }))).toBe(false);
  });
  it('an unknown later type passes on its common fields (STAGE6 5.5)', () => {
    const later = { id: 'x1', type: 'practice', userId: USER, deviceId: 'd', at: new Date(NOW), deckId: 'k', entryId: 'e', deckRevision: 1, sessionId: 's', anything: { deep: [1] } };
    expect(validRecordShape(wire(later))).toBe(true);
    expect(validRecordShape(wire({ ...later, sessionId: '' }))).toBe(false);
    expect(validRecordShape(wire({ ...later, at: '2026-10-23' }))).toBe(false);
  });
});

describe('reviveRecord', () => {
  it('turns the times back into Dates and keeps every other field', () => {
    const back = reviveRecord(wire(review({ futureField: { a: 1 } })), USER)!;
    expect(back.at).toEqual(new Date(NOW - 60_000));
    expect((back.fsrs as { nextDue: Date }).nextDue).toEqual(new Date(NOW + 3 * 86_400_000));
    expect(back.futureField).toEqual({ a: 1 });
  });
  it('another user — null', () => {
    expect(reviveRecord(wire(review()), 'someone-else')).toBeNull();
  });
});

describe('canonicalJson', () => {
  it('sorts keys at every level and has no spaces', () => {
    expect(canonicalJson({ b: 1, a: { d: [2, { z: 1, y: 2 }], c: 'x' } })).toBe('{"a":{"c":"x","d":[2,{"y":2,"z":1}]},"b":1}');
  });
  it('equals JSON.stringify otherwise: Date, undefined, NaN, Infinity', () => {
    const v = { at: new Date(NOW), gone: undefined, nan: Number.NaN, inf: Infinity, list: [undefined, 1] };
    expect(canonicalJson(v)).toBe(canonicalJson(wire(v)));
    expect(canonicalJson(v)).toBe(`{"at":"${new Date(NOW).toISOString()}","inf":null,"list":[null,1],"nan":null}`);
  });
  it('a record on the device, on the wire and revived on another device — the same text', () => {
    const local = review({ latencyMs: Number.NaN, voice: undefined, nested: { when: new Date(NOW), list: [{ b: 2, a: 1 }] } });
    const sent = wire(local);
    const received = reviveRecord(sent, USER)!;
    expect(canonicalJson(sent)).toBe(canonicalJson(local));
    expect(canonicalJson(wire(received))).toBe(canonicalJson(local));
  });
});

describe('checkPushed', () => {
  const ok = (r: unknown, now = NOW) => checkPushed(wire(r), USER, now);

  it('a valid record: its columns and the canonical body', () => {
    const r = ok(review());
    expect(r).toMatchObject({ ok: true, record: { id: review().id, type: 'review', at: NOW - 60_000, deckId: 'test-speak', entryId: 'bonjour', rules: 2 } });
    if (r.ok) expect(r.record.body).toBe(canonicalJson(review()));
  });
  it('rules only for an answer with a whole number', () => {
    expect(ok({ ...review(), type: 'intro', skill: null })).toMatchObject({ record: { rules: null } });
    expect(ok(review({ rules: undefined }))).toMatchObject({ record: { rules: null } });
  });
  it('refusals and their reasons', () => {
    expect(ok({ ...review(), final: 0 })).toEqual({ ok: false, id: review().id, reason: 'schema' });
    expect(checkPushed('nope', USER, NOW)).toEqual({ ok: false, id: null, reason: 'schema' });
    expect(ok(review({ userId: 'other' }))).toMatchObject({ ok: false, reason: 'user' });
    expect(ok(review({ big: 'x'.repeat(MAX_RECORD_BYTES) }))).toMatchObject({ ok: false, reason: 'size' });
  });
  it('future: more than 2 hours ahead of the server; past: before 1 October 2026', () => {
    expect(ok(review({ at: new Date(NOW + FUTURE_SLACK_MS) })).ok).toBe(true);
    expect(ok(review({ at: new Date(NOW + FUTURE_SLACK_MS + 1) }))).toMatchObject({ ok: false, reason: 'future' });
    expect(ok(review({ at: new Date(EARLIEST_AT) })).ok).toBe(true);
    expect(ok(review({ at: new Date(EARLIEST_AT - 1) }))).toMatchObject({ ok: false, reason: 'past' });
  });
  it('the device id may be another device of the account (records of older devices, 6a.4)', () => {
    expect(ok(review({ deviceId: 'some-older-device' })).ok).toBe(true);
  });
});
