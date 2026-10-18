import { describe, expect, it } from 'vitest';
import { appDay, dayStart, DAY_START_HOUR, LEGACY_ZONE, offsetAt, recordOffset, today, zoneStamp } from './zone';

const LUX = 'Europe/Luxembourg';
const at = (iso: string) => new Date(iso);
/** App days between two answers, each in its own zone (Р29.3). */
const days = (a: string, za: string, b: string, zb: string) => appDay(at(b), offsetAt(zb, at(b))) - appDay(at(a), offsetAt(za, at(a)));
const hours = (from: Date, to: Date) => (to.getTime() - from.getTime()) / 3_600_000;

describe('offsetAt', () => {
  it('summer and winter time in Luxembourg', () => {
    expect(offsetAt(LUX, at('2026-10-18T12:00:00Z'))).toBe(120);
    expect(offsetAt(LUX, at('2026-10-26T12:00:00Z'))).toBe(60);
    expect(offsetAt(LUX, at('2027-03-29T12:00:00Z'))).toBe(120);
  });
  it('Tehran, Kabul, Dushanbe, New York', () => {
    expect(offsetAt('Asia/Tehran', at('2026-10-20T12:00:00Z'))).toBe(210);
    expect(offsetAt('Asia/Kabul', at('2026-10-20T12:00:00Z'))).toBe(270);
    expect(offsetAt('Asia/Dushanbe', at('2026-10-20T12:00:00Z'))).toBe(300);
    expect(offsetAt('America/New_York', at('2026-10-20T12:00:00Z'))).toBe(-240);
    expect(offsetAt('America/New_York', at('2026-11-02T12:00:00Z'))).toBe(-300);
  });
  it('the stamp of a record; old records count as Luxembourg', () => {
    expect(zoneStamp('Asia/Dushanbe', at('2026-10-20T12:00:00Z'))).toEqual({ tz: 'Asia/Dushanbe', tzOffsetMin: 300 });
    expect(LEGACY_ZONE).toBe(LUX);
    expect(recordOffset({ at: at('2026-10-18T12:00:00Z') })).toBe(120);
    expect(recordOffset({ at: at('2026-10-18T12:00:00Z'), tzOffsetMin: -240 })).toBe(-240);
  });
});

describe('app days', () => {
  it('01:45 → 02:05 local is one day (the UTC date changes at 02:00 in summer)', () => {
    expect(days('2026-10-17T23:45:00Z', LUX, '2026-10-18T00:05:00Z', LUX)).toBe(0);
  });
  it('00:45 → 01:05 local in winter (UTC date changes at 01:00) is one day', () => {
    expect(days('2026-10-31T23:45:00Z', LUX, '2026-11-01T00:05:00Z', LUX)).toBe(0);
  });
  it('03:50 → 04:05 local is the next day', () => {
    expect(DAY_START_HOUR).toBe(4);
    expect(days('2026-10-18T01:50:00Z', LUX, '2026-10-18T02:05:00Z', LUX)).toBe(1);
  });
  it('Tehran 03:20 → 03:40 and New York 19:50 → 20:10 stay in one day', () => {
    expect(days('2026-10-19T23:50:00Z', 'Asia/Tehran', '2026-10-20T00:10:00Z', 'Asia/Tehran')).toBe(0);
    expect(days('2026-10-19T23:50:00Z', 'America/New_York', '2026-10-20T00:10:00Z', 'America/New_York')).toBe(0);
  });
  it('the day starts at 04:00 local in every zone', () => {
    const now = at('2026-10-20T12:00:00Z');
    expect(dayStart(now, 'Asia/Tehran').toISOString()).toBe('2026-10-20T00:30:00.000Z');
    expect(dayStart(now, 'Asia/Kabul').toISOString()).toBe('2026-10-19T23:30:00.000Z');
    expect(dayStart(now, 'Asia/Dushanbe').toISOString()).toBe('2026-10-19T23:00:00.000Z');
    expect(dayStart(now, 'America/New_York').toISOString()).toBe('2026-10-20T08:00:00.000Z');
  });
});

describe('summer and winter time', () => {
  it('25.10.2026 (03:00 → 02:00): the day holding the change lasts 25 h; 02:30 twice is one day', () => {
    const s = dayStart(at('2026-10-25T00:30:00Z'), LUX);
    const next = dayStart(at('2026-10-25T03:30:00Z'), LUX);
    expect(s.toISOString()).toBe('2026-10-24T02:00:00.000Z');
    expect(next.toISOString()).toBe('2026-10-25T03:00:00.000Z');
    expect(hours(s, next)).toBe(25);
    expect(days('2026-10-25T00:30:00Z', LUX, '2026-10-25T01:30:00Z', LUX)).toBe(0);
    expect(days('2026-10-25T00:50:00Z', LUX, '2026-10-25T02:30:00Z', LUX)).toBe(0);
  });
  it('28.03.2027 (02:00 → 03:00): the day holding the change lasts 23 h', () => {
    const s = dayStart(at('2027-03-28T00:30:00Z'), LUX);
    const next = dayStart(at('2027-03-28T03:30:00Z'), LUX);
    expect(s.toISOString()).toBe('2027-03-27T03:00:00.000Z');
    expect(next.toISOString()).toBe('2027-03-28T02:00:00.000Z');
    expect(hours(s, next)).toBe(23);
  });
  it('New York: 01.11.2026 and 14.03.2027', () => {
    expect(hours(dayStart(at('2026-11-01T06:30:00Z'), 'America/New_York'), dayStart(at('2026-11-01T12:00:00Z'), 'America/New_York'))).toBe(25);
    expect(hours(dayStart(at('2027-03-14T07:30:00Z'), 'America/New_York'), dayStart(at('2027-03-14T12:00:00Z'), 'America/New_York'))).toBe(23);
  });
  it('a day number + 1 is the next calendar day across the change (no day skipped or doubled)', () => {
    const before = today(at('2027-03-27T12:00:00Z'), LUX);
    const after = today(at('2027-03-28T12:00:00Z'), LUX);
    expect(after - before).toBe(1);
  });
});

describe('travel: answers in two zones (Р29.3, figures of the 4.4a plan)', () => {
  it('east: Luxembourg 23:00 → Dushanbe 06:00 (3 h) is the next day; at home it would be the same day', () => {
    expect(days('2026-10-26T22:00:00Z', LUX, '2026-10-27T01:00:00Z', 'Asia/Dushanbe')).toBe(1);
    expect(days('2026-10-26T22:00:00Z', LUX, '2026-10-27T01:00:00Z', LUX)).toBe(0);
  });
  it('west: Luxembourg 10:00 → New York 23:00 (18 h) is the same day; at home it would be the next', () => {
    expect(days('2026-10-27T09:00:00Z', LUX, '2026-10-28T03:00:00Z', 'America/New_York')).toBe(0);
    expect(days('2026-10-27T09:00:00Z', LUX, '2026-10-28T03:00:00Z', LUX)).toBe(1);
  });
});
