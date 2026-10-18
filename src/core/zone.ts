/**
 * Local days of the app and time zones (Р17.10, Р29.3). Pure: the zone is an IANA
 * name passed in (the device zone comes from src/platform), so every rule is
 * testable in any zone.
 *
 * The app day starts at DAY_START_HOUR local time: practice after midnight counts
 * for the day before. "Local" is the zone of the device at the moment of the
 * answer, with the offset of that very date (summer and winter time differ).
 */

/** The local day starts at 04:00 (Р17.10). */
export const DAY_START_HOUR = 4;
/** Zone of journal records written before stage 4.4a, which have none (Р29.3). */
export const LEGACY_ZONE = 'Europe/Luxembourg';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** The zone stamp of a journal record: IANA name and minutes east of UTC at that moment. */
export interface ZoneStamp {
  tz: string;
  tzOffsetMin: number;
}

const formats = new Map<string, Intl.DateTimeFormat>();

function format(tz: string): Intl.DateTimeFormat {
  let f = formats.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formats.set(tz, f);
  }
  return f;
}

/**
 * Minutes east of UTC in `tz` at `at` (Luxembourg in summer: 120). Falls back to the
 * offset of the device when the browser does not know the zone.
 */
export function offsetAt(tz: string, at: Date): number {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = format(tz).formatToParts(at);
  } catch {
    return -at.getTimezoneOffset();
  }
  const p: Record<string, number> = {};
  for (const x of parts) if (x.type !== 'literal') p[x.type] = Number(x.value);
  const asUtc = Date.UTC(p.year!, p.month! - 1, p.day!, p.hour!, p.minute!, p.second!);
  const whole = Math.floor(at.getTime() / 1000) * 1000;
  return Math.round((asUtc - whole) / MINUTE);
}

export function zoneStamp(tz: string, at: Date): ZoneStamp {
  return { tz, tzOffsetMin: offsetAt(tz, at) };
}

/** The offset a record was written with; records before stage 4.4a count as Luxembourg (Р29.3). */
export function recordOffset(r: { at: Date; tzOffsetMin?: number }): number {
  return typeof r.tzOffsetMin === 'number' ? r.tzOffsetMin : offsetAt(LEGACY_ZONE, r.at);
}

/**
 * The app day of a moment as a whole number (days since 1970-01-01 of the local
 * calendar, shifted by DAY_START_HOUR). Comparable across zones: it is a local date.
 */
export function appDay(at: Date, offsetMin: number): number {
  return Math.floor((at.getTime() + offsetMin * MINUTE - DAY_START_HOUR * HOUR) / DAY);
}

/** The app day of `now` in `tz`. */
export function today(now: Date, tz: string): number {
  return appDay(now, offsetAt(tz, now));
}

/** The moment app day `day` starts in `tz` (04:00 local; the offset of that moment). */
export function dayStartOf(day: number, tz: string): Date {
  const local = day * DAY + DAY_START_HOUR * HOUR;
  let t = local - offsetAt(tz, new Date(local)) * MINUTE;
  t = local - offsetAt(tz, new Date(t)) * MINUTE;
  return new Date(t);
}

/** Start of the app day that contains `now` in `tz`. */
export function dayStart(now: Date, tz: string): Date {
  return dayStartOf(today(now, tz), tz);
}

/**
 * The shift that makes ts-fsrs see app days: it counts days between UTC dates, so a
 * moment moved by (offset − 04:00) falls on the UTC date of its app day (Р29.3).
 */
export function fsrsShiftMs(offsetMin: number): number {
  return offsetMin * MINUTE - DAY_START_HOUR * HOUR;
}
