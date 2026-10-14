/**
 * Session composition (Р17, Р22.4). Pure: the caller loads entries, cards and the
 * journal; nothing here touches the database.
 *
 * Stage 4.2 covers the skill `speak` only. The soft ban on new entries while reviews
 * are overdue, the "25+" cap and the volume advice come at stage 4.4.
 */
import type { EntryRow, CardRow, LogRecord } from './model';

/** The local day starts at 04:00: practice after midnight counts for the day before (Р17.10). */
export const DAY_START_HOUR = 4;
/** Cards in one portion (Р17.1): overdue reviews + recalls of new entries; introductions are extra. */
export const PORTION_SIZE = 15;

/** Start of the local day that contains `now`. */
export function dayStart(now: Date, hour = DAY_START_HOUR): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour);
  if (now.getTime() < d.getTime()) d.setDate(d.getDate() - 1);
  return d;
}

export type SessionItem =
  | { kind: 'intro'; entry: EntryRow }
  /** `card` null: the first answer on a new entry (no FSRS state yet). */
  | { kind: 'speak'; entry: EntryRow; card: CardRow | null };

/** Why no new entry was added (Р17.7); stage 4.4 adds "overdue reviews". */
export type NoNewReason = 'noMaterial' | 'dailyLimit' | 'portionFull';

export interface SessionPlan {
  items: SessionItem[];
  /** Overdue reviews in the portion. */
  due: number;
  /** New entries introduced in the portion. */
  introduced: number;
  /** Entries introduced earlier but never answered, recalled now. */
  pending: number;
  /** Introductions left for today after this portion. */
  newLeft: number;
  noNew: NoNewReason | null;
}

export interface SessionInput {
  now: Date;
  /** Entries of the deck, hidden ones included (they are skipped here). */
  entries: readonly EntryRow[];
  /** FSRS cards of the user in this deck. */
  cards: readonly CardRow[];
  /** The user's journal: introductions of every deck count toward the daily limit. */
  log: readonly LogRecord[];
  newPerDay: number;
  portion?: number;
}

/** The one definition of "an entry the session may issue for `speak`" (Р17.8). */
export function issuableForSpeak(e: EntryRow): boolean {
  return !e.hidden && e.skills.includes('speak');
}

/** Introductions since the start of today, in any deck, hidden entries included (Р17.5, Р17.9). */
export function introsToday(log: readonly LogRecord[], now: Date): number {
  const from = dayStart(now).getTime();
  return log.filter((r) => r.type === 'intro' && r.at.getTime() >= from && r.at.getTime() <= now.getTime()).length;
}

/**
 * One portion: overdue `speak` cards (oldest first), then new entries in deck order.
 * Shown as: introductions → overdue reviews → recalls of the new entries, so the
 * reviews stand between an introduction and its recall (Р22.4, refines Р17.2).
 *
 * An entry introduced earlier but never answered (the app was closed) is recalled
 * without a new introduction and does not count toward the limit again.
 */
export function buildSession(input: SessionInput): SessionPlan {
  const portion = input.portion ?? PORTION_SIZE;
  const now = input.now.getTime();
  const byId = new Map(input.entries.map((e) => [e.entryId, e]));
  const speakCards = input.cards.filter((c) => c.skill === 'speak');
  const answered = new Set(speakCards.map((c) => c.entryId));
  const deckId = input.entries[0]?.deckId;
  const introduced = new Set(
    input.log.filter((r) => r.type === 'intro' && r.deckId === deckId).map((r) => r.entryId),
  );

  const due = speakCards
    .filter((c) => c.due.getTime() <= now)
    .flatMap((c) => {
      const e = byId.get(c.entryId);
      return e && issuableForSpeak(e) ? [{ entry: e, card: c }] : [];
    })
    .sort((a, b) => a.card.due.getTime() - b.card.due.getTime())
    .slice(0, portion);

  const fresh = [...input.entries]
    .filter((e) => issuableForSpeak(e) && !answered.has(e.entryId))
    .sort((a, b) => a.position - b.position);
  let room = portion - due.length;
  const pending = fresh.filter((e) => introduced.has(e.entryId)).slice(0, Math.max(0, room));
  room -= pending.length;

  const notIntroduced = fresh.filter((e) => !introduced.has(e.entryId));
  const budget = Math.max(0, input.newPerDay - introsToday(input.log, input.now));
  const take = Math.max(0, Math.min(budget, room, notIntroduced.length));
  const fresher = notIntroduced.slice(0, take);

  let noNew: NoNewReason | null = null;
  if (take === 0) {
    if (notIntroduced.length === 0) noNew = 'noMaterial';
    else if (budget === 0) noNew = 'dailyLimit';
    else noNew = 'portionFull';
  }

  const recalls = [...pending, ...fresher].sort((a, b) => a.position - b.position);
  const items: SessionItem[] = [
    ...fresher.map((entry): SessionItem => ({ kind: 'intro', entry })),
    ...due.map(({ entry, card }): SessionItem => ({ kind: 'speak', entry, card })),
    ...recalls.map((entry): SessionItem => ({ kind: 'speak', entry, card: null })),
  ];
  return {
    items,
    due: due.length,
    introduced: fresher.length,
    pending: pending.length,
    newLeft: budget - fresher.length,
    noNew,
  };
}
