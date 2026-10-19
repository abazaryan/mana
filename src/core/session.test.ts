import { describe, expect, it } from 'vitest';
import { State } from 'ts-fsrs';
import type { Skill } from './deckFormat';
import type { CardRow, EntryRow, IntroRecord, LogRecord, ReviewRecord } from './model';
import {
  buildSession,
  capped,
  CATCH_UP_PER_DAY,
  catchUpToday,
  dueDay,
  introsToday,
  MAX_REQUEUES,
  outlook,
  PORTION_SIZE,
  requeueAfterAgain,
  sinceEntry,
  type SessionItem,
} from './session';
import { appDay, offsetAt } from './zone';

const LUX = 'Europe/Luxembourg';
const DAY = 86_400_000;

function entry(id: string, position: number, extra: Partial<EntryRow> = {}): EntryRow {
  return {
    deckId: 'd',
    entryId: id,
    position,
    hidden: 0,
    text: id,
    meaning: { ru: id },
    skills: ['speak'] as Skill[],
    audio: null,
    ...extra,
  } as EntryRow;
}

/** A card in review due at `due`: answered one day earlier in Luxembourg with a one-day interval. */
function card(entryId: string, due: Date, skill: Skill = 'speak', deckId = 'd'): CardRow {
  const lastReview = new Date(due.getTime() - DAY);
  return {
    userId: 'u',
    deckId,
    entryId,
    skill,
    due,
    stability: 1,
    difficulty: 5,
    elapsedDays: 0,
    scheduledDays: 1,
    reps: 1,
    lapses: 0,
    learningSteps: 0,
    state: State.Review,
    lastReview,
    lastReviewOffsetMin: offsetAt(LUX, lastReview),
    lastLogId: 'x',
  } as CardRow;
}

let n = 0;
function intro(entryId: string, at: Date, deckId = 'd'): IntroRecord {
  return {
    id: `i${n++}`,
    type: 'intro',
    skill: null,
    userId: 'u',
    deviceId: 'dev',
    at,
    deckId,
    entryId,
    deckRevision: 1,
    sessionId: 's',
  };
}

/** October 2026, Luxembourg local time, whatever the zone of the machine running the tests. */
function local(d: number, h: number, m = 0): Date {
  const wall = Date.UTC(2026, 9, d, h, m);
  let t = wall - offsetAt(LUX, new Date(wall)) * 60_000;
  t = wall - offsetAt(LUX, new Date(t)) * 60_000;
  return new Date(t);
}
const NOW = local(14, 10);
const shape = (items: SessionItem[]) =>
  items.map((i) => (i.kind === 'intro' ? `intro:${i.entry.entryId}` : `${i.skill}:${i.entry.entryId}${i.card === null ? '*' : ''}${i.requeue ? `↻${i.requeue}` : ''}`));

/** The first answer on a pair (stateBefore New), for the catch-up count. */
function firstAnswer(entryId: string, at: Date, skill: Skill = 'write', deckId = 'd'): ReviewRecord {
  return {
    id: `r${n++}`,
    type: 'review',
    skill,
    userId: 'u',
    deviceId: 'dev',
    at,
    deckId,
    entryId,
    deckRevision: 1,
    sessionId: 's',
    fsrs: { stateBefore: State.New },
  } as ReviewRecord;
}
const run = (over: Partial<Parameters<typeof buildSession>[0]> = {}) =>
  buildSession({ now: NOW, tz: LUX, deckId: 'd', entries: [], cards: [], log: [], newPerDay: 5, ...over });

describe('introsToday', () => {
  it('counts every deck and stops at the 04:00 boundary', () => {
    const log: LogRecord[] = [intro('a', local(14, 3, 59)), intro('b', local(14, 4)), intro('c', local(14, 9), 'other')];
    expect(introsToday(log, NOW, LUX)).toBe(2);
    expect(introsToday(log, local(14, 3, 59), LUX)).toBe(1);
  });
});

describe('buildSession', () => {
  const five = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((id, k) => entry(id, k));

  it('new entries: introductions first, recalls at the end, in deck order', () => {
    const plan = run({ entries: five.slice(0, 2), cards: [] });
    expect(shape(plan.items)).toEqual(['intro:a', 'intro:b', 'speak:a*', 'speak:b*']);
    expect(plan).toMatchObject({ introduced: 2, due: 0, noNew: null, newLeft: 3 });
  });

  it('order: introductions → due today (oldest first) → recalls', () => {
    const entries = five.slice(0, 4);
    const cards = [card('a', local(14, 9)), card('b', local(14, 5)), card('c', local(15, 9))];
    const plan = run({ entries, cards });
    expect(shape(plan.items)).toEqual(['intro:d', 'speak:b', 'speak:a', 'speak:d*']);
  });

  it('a card is due all of its due day, even later than now (Р29.3)', () => {
    const plan = run({ entries: five.slice(0, 2), cards: [card('a', local(14, 23)), card('b', local(15, 3, 30))], newPerDay: 0 });
    expect(shape(plan.items)).toEqual(['speak:a', 'speak:b']);
    expect(run({ entries: five.slice(0, 2), cards: [card('a', local(15, 4))], newPerDay: 0 }).items).toEqual([]);
  });

  it('daily limit by the journal, not by the session; a reload gives nothing new', () => {
    const log = [intro('a', local(14, 5)), intro('b', local(14, 6)), intro('x', local(14, 7), 'other')];
    const cards = [card('a', local(20, 0)), card('b', local(20, 0))];
    const plan = run({ entries: five, cards, log, newPerDay: 5 });
    expect(plan.introduced).toBe(2);
    expect(plan.newLeft).toBe(0);
    const again = run({ entries: five, cards, log: [...log, intro('c', local(14, 8)), intro('d', local(14, 8))], newPerDay: 5 });
    expect(again).toMatchObject({ introduced: 0, noNew: 'dailyLimit' });
  });

  it('yesterday before 04:00 does not count; today after midnight does', () => {
    const log = [intro('a', local(13, 23)), intro('b', local(14, 2))];
    const plan = run({ now: local(14, 3), entries: five, log, newPerDay: 2 });
    expect(plan).toMatchObject({ introduced: 0, noNew: 'dailyLimit' });
    const later = run({ now: local(14, 5), entries: five, log, newPerDay: 2 });
    expect(later.introduced).toBe(2);
  });

  it('introduced today but not answered: recalled without a new introduction, no limit', () => {
    const log = [intro('a', local(14, 5))];
    const plan = run({ entries: five.slice(0, 2), log, newPerDay: 2 });
    expect(shape(plan.items)).toEqual(['intro:b', 'speak:a*', 'speak:b*']);
    expect(plan).toMatchObject({ pending: 1, catchUp: 0, introduced: 1 });
  });

  it('introduced on an earlier day and never answered: a catch-up entry (Р25)', () => {
    const log = [intro('a', local(13, 10))];
    const plan = run({ entries: five.slice(0, 2), log });
    expect(shape(plan.items)).toEqual(['intro:b', 'speak:a*', 'speak:b*']);
    expect(plan).toMatchObject({ pending: 0, catchUp: 1, introduced: 1 });
  });

  it('hidden entries are not issued, but their introductions count toward the limit', () => {
    const entries = [entry('a', 0, { hidden: 1 }), entry('b', 1), entry('c', 2)];
    const plan = run({ entries, cards: [card('a', local(1, 0))], log: [intro('a', local(14, 5))], newPerDay: 2 });
    expect(shape(plan.items)).toEqual(['intro:b', 'speak:b*']);
  });

  it('an entry with `write` only is introduced and gets its `write` card', () => {
    const plan = run({ entries: [entry('a', 0, { skills: ['write'] }), entry('b', 1)] });
    expect(shape(plan.items)).toEqual(['intro:a', 'intro:b', 'speak:b*', 'write:a*']);
  });

  it('a portion holds 15 cards; due cards fill it first', () => {
    const entries = Array.from({ length: 30 }, (_, k) => entry(`e${k}`, k));
    const cards = entries.slice(0, 20).map((e, k) => card(e.entryId, local(14, 5, k)));
    const plan = run({ entries, cards });
    expect(plan.items).toHaveLength(PORTION_SIZE);
    expect(plan).toMatchObject({ due: 15, introduced: 0, noNew: 'portionFull', debts: [] });
  });

  it('room left after due cards goes to new entries', () => {
    const entries = Array.from({ length: 30 }, (_, k) => entry(`e${k}`, k));
    const cards = entries.slice(0, 12).map((e, k) => card(e.entryId, local(14, 5, k)));
    const plan = run({ entries, cards, newPerDay: 5 });
    expect(plan).toMatchObject({ due: 12, introduced: 3, newLeft: 2 });
    expect(plan.items.filter((i) => i.kind === 'review')).toHaveLength(15);
  });

  it('cards of a skill the entry no longer has and future cards are not issued', () => {
    const plan = run({
      entries: five.slice(0, 2),
      cards: [card('a', local(20, 0)), card('b', local(20, 0)), card('b', local(1, 0), 'write')],
      newPerDay: 0,
    });
    expect(plan.items).toEqual([]);
    expect(plan.noNew).toBe('noMaterial');
  });

  it('nothing at all: no material', () => {
    expect(run({ entries: [] })).toMatchObject({ items: [], noNew: 'noMaterial' });
  });
});

describe('buildSession: three skills (Р25)', () => {
  const all = (id: string, k: number, extra: Partial<EntryRow> = {}) =>
    entry(id, k, { skills: ['listen', 'speak', 'write'], audio: `audio/${id}.wav`, ...extra });

  it('a new entry: introduction, then its first cards speak → write → listen', () => {
    const plan = run({ entries: [all('a', 0)] });
    expect(shape(plan.items)).toEqual(['intro:a', 'speak:a*', 'write:a*', 'listen:a*']);
  });

  it('`listen` without deck audio is not issued', () => {
    const plan = run({ entries: [all('a', 0, { audio: null })] });
    expect(shape(plan.items)).toEqual(['intro:a', 'speak:a*', 'write:a*']);
    const onlyListen = run({ entries: [entry('b', 0, { skills: ['listen'] })] });
    expect(onlyListen).toMatchObject({ items: [], noNew: 'noMaterial' });
  });

  it('first cards of new entries go in rounds: every speak, then every write, then every listen', () => {
    const plan = run({ entries: ['a', 'b', 'c'].map((id, k) => all(id, k)) });
    expect(shape(plan.items)).toEqual([
      'intro:a', 'intro:b', 'intro:c',
      'speak:a*', 'speak:b*', 'speak:c*',
      'write:a*', 'write:b*', 'write:c*',
      'listen:a*', 'listen:b*', 'listen:c*',
    ]);
  });

  it('a new entry costs one place per skill and comes whole or not at all', () => {
    const entries = ['a', 'b', 'c', 'd', 'e', 'f'].map((id, k) => all(id, k));
    const plan = run({ entries, newPerDay: 10 });
    expect(plan).toMatchObject({ introduced: 5, newLeft: 5, noNew: null });
    expect(plan.items.filter((i) => i.kind === 'review')).toHaveLength(15);
    const tight = run({ entries, newPerDay: 10, portion: 4 });
    expect(shape(tight.items)).toEqual(['intro:a', 'speak:a*', 'write:a*', 'listen:a*']);
  });

  it('overdue cards of every skill, oldest first', () => {
    const entries = ['a', 'b'].map((id, k) => all(id, k));
    const cards = [card('a', local(10, 0), 'write'), card('b', local(9, 0), 'listen'), card('b', local(20, 0), 'speak'), card('a', local(20, 0), 'speak'), card('a', local(20, 0), 'listen'), card('b', local(20, 0), 'write')];
    const plan = run({ entries, cards, newPerDay: 0 });
    expect(shape(plan.items)).toEqual(['listen:b', 'write:a']);
  });

  it('`listen` never before `speak`/`write` of the same entry, overdue included', () => {
    const entries = [all('a', 0), all('z', 1)];
    const cards = [card('a', local(9, 0), 'listen'), card('a', local(10, 0), 'speak'), card('a', local(11, 0), 'write')];
    const plan = run({ entries, cards, newPerDay: 0 });
    expect(shape(plan.items)).toEqual(['speak:a', 'write:a', 'listen:a']);
  });

  it('cards of one entry stand at least two other cards apart when there are enough cards', () => {
    const entries = [entry('a', 0, { skills: ['speak', 'write'] }), entry('b', 1), entry('c', 2)];
    const cards = [card('a', local(9, 0), 'speak'), card('a', local(9, 1), 'write'), card('b', local(9, 2), 'speak'), card('c', local(9, 3), 'speak')];
    const plan = run({ entries, cards, newPerDay: 0 });
    expect(shape(plan.items)).toEqual(['speak:a', 'speak:b', 'speak:c', 'write:a']);
  });

  it('entries that sound the same are kept apart like one entry (Р16)', () => {
    const entries = [entry('ravi', 0, { skills: ['speak', 'write'] }), entry('ravie', 1, { skills: ['write'] }), entry('x', 2)];
    const sameSound = (p: EntryRow, q: EntryRow) => p.entryId.startsWith('ravi') && q.entryId.startsWith('ravi');
    const cards = [card('ravi', local(9, 0), 'write'), card('ravie', local(9, 1), 'write'), card('x', local(9, 2)), card('ravi', local(30, 0))];
    const apart = run({ entries, cards, newPerDay: 0, sameSound });
    expect(shape(apart.items)).toEqual(['write:ravi', 'speak:x', 'write:ravie']);
    const plain = run({ entries, cards, newPerDay: 0 });
    expect(shape(plain.items)).toEqual(['write:ravi', 'write:ravie', 'speak:x']);
  });

  it('a skill added to an entry introduced on an earlier day: catch-up, at most 5 entries a day', () => {
    const entries = Array.from({ length: 8 }, (_, k) => entry(`e${k}`, k, { skills: ['speak', 'write'] }));
    const cards = entries.map((e) => card(e.entryId, local(30, 0), 'speak'));
    const log = entries.map((e) => intro(e.entryId, local(10, 9)));
    const plan = run({ entries, cards, log, newPerDay: 5 });
    expect(plan.catchUp).toBe(CATCH_UP_PER_DAY);
    expect(shape(plan.items)).toEqual(['write:e0*', 'write:e1*', 'write:e2*', 'write:e3*', 'write:e4*']);
    // The count is kept by the journal: after three first answers today, two more.
    const later = run({ entries, cards, log: [...log, ...['e0', 'e1', 'e2'].map((id) => firstAnswer(id, local(14, 8)))], newPerDay: 5 });
    expect(later.catchUp).toBe(2);
    // It does not touch the limit of introductions.
    expect(later.newLeft).toBe(5);
  });
});

describe('catchUpToday', () => {
  it('counts entries introduced before today with a first answer today, in any deck, once each', () => {
    const log: LogRecord[] = [
      intro('a', local(13, 9)),
      intro('b', local(14, 5)),
      intro('c', local(12, 9), 'other'),
      firstAnswer('a', local(14, 6), 'write'),
      firstAnswer('a', local(14, 7), 'listen'),
      firstAnswer('b', local(14, 6)),
      firstAnswer('c', local(14, 6), 'speak', 'other'),
      firstAnswer('a', local(13, 10), 'speak'),
    ];
    expect(catchUpToday(log, NOW, LUX)).toBe(2);
  });

  it('an answer that is not the first on its pair does not count', () => {
    const later = { ...firstAnswer('a', local(14, 6)), fsrs: { stateBefore: State.Review } } as ReviewRecord;
    expect(catchUpToday([intro('a', local(13, 9)), later], NOW, LUX)).toBe(0);
  });
});

describe('requeueAfterAgain (Р25)', () => {
  const r = (id: string, requeue = 0): SessionItem => ({ kind: 'review', skill: 'speak', entry: entry(id, 0), card: null, requeue });
  const items = ['a', 'b', 'c', 'd', 'e'].map((id) => r(id));

  it('the card comes back at the end of the portion, marked', () => {
    expect(shape(requeueAfterAgain(items, 0)!)).toEqual(['speak:a*', 'speak:b*', 'speak:c*', 'speak:d*', 'speak:e*', 'speak:a*↻1']);
  });

  it('not sooner than three other cards later: near the end it does not come back', () => {
    expect(requeueAfterAgain(items, 1)).not.toBeNull();
    expect(requeueAfterAgain(items, 2)).toBeNull();
    expect(requeueAfterAgain(items, 4)).toBeNull();
  });

  it('at most twice: the second return only after Again on the first', () => {
    const once = requeueAfterAgain([r('a', 1), ...items.slice(1)], 0)!;
    expect(shape(once).at(-1)).toBe('speak:a*↻2');
    expect(requeueAfterAgain([r('a', MAX_REQUEUES), ...items.slice(1)], 0)).toBeNull();
  });

  it('introductions never come back', () => {
    expect(requeueAfterAgain([{ kind: 'intro', entry: entry('a', 0) }, ...items], 0)).toBeNull();
  });
});

describe('sinceEntry', () => {
  it('cards and seconds since the previous item of the same entry, introduction included', () => {
    const items: SessionItem[] = [
      { kind: 'intro', entry: entry('a', 0) },
      { kind: 'review', skill: 'speak', entry: entry('b', 1), card: null, requeue: 0 },
      { kind: 'review', skill: 'speak', entry: entry('a', 0), card: null, requeue: 0 },
    ];
    const done = new Map([[0, local(14, 10, 0)], [1, local(14, 10, 1)]]);
    expect(sinceEntry(items, done, 2, local(14, 10, 2))).toEqual({ cards: 1, sec: 120 });
    expect(sinceEntry(items, done, 1, local(14, 10, 2))).toEqual({ cards: null, sec: null });
  });
});

describe('due day (Р29.3)', () => {
  const at = (iso: string) => new Date(iso);
  const answered = (iso: string, days: number, offsetMin: number) => ({ due: new Date(at(iso).getTime() + days * DAY), lastReview: at(iso), lastReviewOffsetMin: offsetMin, scheduledDays: days });

  it('= the app day of the last answer + the interval', () => {
    const c = answered('2026-10-18T08:00:00Z', 2, 120);
    expect(dueDay(c)).toBe(appDay(at('2026-10-20T08:00:00Z'), 120));
  });
  it('an answer at 03:30 belongs to the day before: one day later it is due the next app day', () => {
    const c = answered('2026-10-18T01:30:00Z', 1, 120);
    expect(dueDay(c)).toBe(appDay(at('2026-10-18T12:00:00Z'), 120));
  });
  it('27.03.2027 03:30 + 1 day is due on 27.03 app day + 1, not two days later (the 23-hour day)', () => {
    const c = answered('2027-03-27T02:30:00Z', 1, 60);
    expect(dueDay(c) - appDay(at('2027-03-27T02:30:00Z'), 60)).toBe(1);
    // "Due before the next 04:00" would have said two days: +24 h lands at 04:30 summer time.
    expect(appDay(c.due, offsetAt(LUX, c.due)) - appDay(at('2027-03-27T02:30:00Z'), 60)).toBe(2);
  });
  it('24.10.2026 04:10 + 1 day is not due the same night (the 25-hour day)', () => {
    const c = answered('2026-10-24T02:10:00Z', 1, 120);
    expect(dueDay(c) - appDay(at('2026-10-24T02:10:00Z'), 120)).toBe(1);
    expect(appDay(c.due, offsetAt(LUX, c.due)) - appDay(at('2026-10-24T02:10:00Z'), 120)).toBe(0);
  });
  it('records before stage 4.4a (no offset) count as Luxembourg', () => {
    const c = { ...answered('2026-10-18T08:00:00Z', 2, 120), lastReviewOffsetMin: null };
    expect(dueDay(c)).toBe(appDay(at('2026-10-20T08:00:00Z'), 120));
  });
});

describe('debts hold back new entries (Р17.4, Р29.5)', () => {
  const five = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((id, k) => entry(id, k));
  const other = (id: string, k: number, extra: Partial<EntryRow> = {}) => entry(id, k, { deckId: 'o', ...extra });

  it('a debt in this deck: no introductions, the reason, the debt first', () => {
    const plan = run({ entries: five, cards: [card('a', local(12, 9)), card('b', local(14, 9))] });
    expect(shape(plan.items)).toEqual(['speak:a', 'speak:b']);
    expect(plan).toMatchObject({ introduced: 0, noNew: 'overdue', debts: [{ deckId: 'd', count: 1 }] });
  });

  it('a debt in another deck holds back new entries here too and is named', () => {
    const entries = [...five, other('x', 0)];
    const plan = run({ entries, cards: [card('x', local(13, 9), 'speak', 'o')] });
    expect(plan).toMatchObject({ items: [], noNew: 'overdue', debts: [{ deckId: 'o', count: 1 }] });
  });

  it('this deck comes first in the list of debts, then by count', () => {
    const entries = [...five, other('x', 0), other('y', 1), entry('z', 0, { deckId: 'p' }), entry('w', 1, { deckId: 'p' }), entry('v', 2, { deckId: 'p' })];
    const cards = [card('a', local(13, 9)), card('x', local(13, 9), 'speak', 'o'), ...['z', 'w', 'v'].map((id) => card(id, local(12, 9), 'speak', 'p'))];
    expect(run({ entries, cards }).debts).toEqual([{ deckId: 'd', count: 1 }, { deckId: 'p', count: 3 }, { deckId: 'o', count: 1 }]);
  });

  it('cards of hidden entries, of dropped skills and of decks that are gone are no debts', () => {
    const entries = [entry('a', 0, { hidden: 1 }), entry('b', 1), entry('c', 2)];
    const cards = [card('a', local(10, 9)), card('b', local(10, 9), 'write'), card('q', local(10, 9), 'speak', 'gone')];
    expect(run({ entries, cards, newPerDay: 1 })).toMatchObject({ introduced: 1, noNew: null, debts: [] });
  });

  it('the recalls of today\'s introductions are never held back (Р17.3); catch-up is', () => {
    const entries = [entry('a', 0), entry('b', 1, { skills: ['speak', 'write'] }), entry('c', 2)];
    const log = [intro('a', local(14, 5)), intro('b', local(10, 9))];
    const cards = [card('b', local(12, 9))];
    const plan = run({ entries, cards, log });
    expect(shape(plan.items)).toEqual(['speak:b', 'speak:a*']);
    expect(plan).toMatchObject({ pending: 1, catchUp: 0, introduced: 0, noNew: 'overdue' });
  });

  it('order of checks: material → limit → debts → room', () => {
    const debt = card('a', local(12, 9));
    expect(run({ entries: five.slice(0, 1), cards: [debt] }).noNew).toBe('noMaterial');
    expect(run({ entries: five, cards: [debt], newPerDay: 0 }).noNew).toBe('dailyLimit');
    expect(run({ entries: five, cards: [debt] }).noNew).toBe('overdue');
  });

  it('done with the debts: the next portion has new entries again', () => {
    const answered = { ...card('a', local(16, 9)), lastReview: local(14, 9) , scheduledDays: 2 };
    const plan = run({ entries: five, cards: [answered], newPerDay: 2 });
    expect(plan).toMatchObject({ introduced: 2, noNew: null, debts: [] });
  });

  it('"add anyway": new entries for one portion; their recalls take places first, debts the rest', () => {
    const entries = Array.from({ length: 30 }, (_, k) => entry(`e${k}`, k));
    const cards = entries.slice(0, 20).map((e, k) => card(e.entryId, local(10, 5, k)));
    const held = run({ entries, cards });
    expect(held).toMatchObject({ due: 15, introduced: 0, noNew: 'overdue' });
    const forced = run({ entries, cards, addAnyway: true });
    expect(forced).toMatchObject({ due: 10, introduced: 5, noNew: null, newLeft: 0 });
    // Shown as before: introductions → reviews → first cards.
    expect(shape(forced.items).slice(0, 5)).toEqual(['intro:e20', 'intro:e21', 'intro:e22', 'intro:e23', 'intro:e24']);
    expect(shape(forced.items).slice(-5)).toEqual(['speak:e20*', 'speak:e21*', 'speak:e22*', 'speak:e23*', 'speak:e24*']);
  });

  it('"add anyway" still keeps the daily limit; without debts it changes nothing', () => {
    const entries = Array.from({ length: 10 }, (_, k) => entry(`e${k}`, k));
    const cards = [card('e0', local(12, 9))];
    const log = ['x1', 'x2', 'x3', 'x4', 'x5'].map((id) => intro(id, local(14, 6), 'o'));
    expect(run({ entries, cards, log, addAnyway: true }).noNew).toBe('dailyLimit');
    const clean = run({ entries, cards: [card('e0', local(14, 9))] });
    expect(run({ entries, cards: [card('e0', local(14, 9))], addAnyway: true })).toEqual(clean);
  });
});

describe('outlook (Р29.6)', () => {
  const entries = ['a', 'b', 'c', 'd', 'e'].map((id, k) => entry(id, k));
  const others = ['x', 'y'].map((id, k) => entry(id, k, { deckId: 'o' }));
  const day = { now: NOW, tz: LUX, deckId: 'd', entries: [...entries, ...others] };

  it('today (this deck, debts included), tomorrow and 7 days from tomorrow (every deck)', () => {
    const cards = [
      card('a', local(12, 9)), // debt
      card('b', local(14, 22)), // today
      card('c', local(15, 3)), // still today: before 04:00
      card('d', local(15, 9)), // tomorrow
      card('e', local(21, 9)), // in 7 days
      card('x', local(13, 9), 'speak', 'o'), // a debt elsewhere: not in "today"
      card('y', local(15, 10), 'speak', 'o'), // tomorrow elsewhere
    ];
    expect(outlook({ ...day, cards })).toEqual({ today: 3, tomorrow: 2, week: 3, debts: [{ deckId: 'd', count: 1 }, { deckId: 'o', count: 1 }] });
    expect(outlook({ ...day, cards: [card('e', local(22, 9))] }).week).toBe(0);
  });

  it('counts are shown up to 25+', () => {
    expect(capped(25)).toBe('25');
    expect(capped(26)).toBe('25+');
    expect(capped(0)).toBe('0');
  });
});

describe('today is counted in the zone of the device (Р29.3)', () => {
  const five = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((id, k) => entry(id, k));
  const at = (iso: string) => new Date(iso);
  const intros = (iso: string) => five.slice(0, 5).map((e, k) => intro(e.entryId, new Date(at(iso).getTime() + k * 60_000), 'old'));

  it('east: 5 introductions in Luxembourg at 20:00, Dushanbe at 07:00 the next morning — a new day', () => {
    const log = intros('2026-10-26T19:00:00Z');
    expect(introsToday(log, at('2026-10-27T02:00:00Z'), 'Asia/Dushanbe')).toBe(0);
    expect(introsToday(log, at('2026-10-27T02:00:00Z'), LUX)).toBe(5);
    expect(introsToday(log, at('2026-10-26T22:30:00Z'), 'Asia/Dushanbe')).toBe(5);
  });

  it('west: introductions in Luxembourg at 07:30 are "yesterday" in New York at 15:00; at 10:00 they are today', () => {
    expect(introsToday(intros('2026-10-27T06:30:00Z'), at('2026-10-27T19:00:00Z'), 'America/New_York')).toBe(0);
    expect(introsToday(intros('2026-10-27T09:00:00Z'), at('2026-10-27T19:00:00Z'), 'America/New_York')).toBe(5);
  });

  it('a card due on Monday in Luxembourg is a debt in Dushanbe on Tuesday morning, not yet at home', () => {
    const c = { ...card('a', at('2026-10-26T22:30:00Z')), lastReview: at('2026-10-25T22:30:00Z'), lastReviewOffsetMin: 60, scheduledDays: 1 };
    const input = { entries: five, cards: [c], newPerDay: 5, log: [] as LogRecord[], deckId: 'd' };
    expect(buildSession({ ...input, now: at('2026-10-27T01:00:00Z'), tz: LUX }).debts).toEqual([]);
    expect(buildSession({ ...input, now: at('2026-10-27T01:00:00Z'), tz: 'Asia/Dushanbe' }).debts).toEqual([{ deckId: 'd', count: 1 }]);
  });
});

describe('last places keep the cards of one entry apart at the tail (Р25.8, phone check 19.10.2026)', () => {
  const speakOnly = (n: number) => Array.from({ length: n }, (_, k) => entry(`r${k}`, k));
  const dueToday = (ids: string[]) => ids.map((id) => card(id, local(14, 5)));
  /** Known since an earlier day, `speak` answered (due later), `write` and `listen` still to come: catch-up. */
  const known = (id: string, k: number) => entry(id, 20 + k, { skills: ['speak', 'write', 'listen'], audio: `audio/${id}.wav` });
  const knownCard = (id: string) => card(id, local(25, 9));
  const gaps = (items: SessionItem[], id: string) => {
    const at = items.flatMap((i, k) => (i.entry.entryId === id ? [k] : []));
    return at.slice(1).map((k, j) => k - at[j]! - 1);
  };

  it('19.10: 12 reviews and one catch-up entry with write + listen — two cards between them', () => {
    const due = speakOnly(12);
    const plan = run({ entries: [...due, known('oui', 0)], cards: [...dueToday(due.map((e) => e.entryId)), knownCard('oui')], log: [intro('oui', local(10, 9))] });
    expect(plan.catchUp).toBe(1);
    expect(plan.items).toHaveLength(14);
    expect(shape(plan.items).slice(-4)).toEqual(['write:oui*', 'speak:r10', 'speak:r11', 'listen:oui*']);
    expect(gaps(plan.items, 'oui')).toEqual([2]);
  });

  it('one new entry with three skills after 10 reviews: speak → write → listen, each two cards apart', () => {
    const due = speakOnly(10);
    const neu = entry('neu', 30, { skills: ['speak', 'write', 'listen'], audio: 'audio/neu.wav' });
    const plan = run({ entries: [...due, neu], cards: dueToday(due.map((e) => e.entryId)) });
    expect(shape(plan.items)[0]).toBe('intro:neu');
    expect(shape(plan.items).filter((s) => s.endsWith(':neu*'))).toEqual(['speak:neu*', 'write:neu*', 'listen:neu*']);
    expect(gaps(plan.items, 'neu').every((g) => g >= 2)).toBe(true);
  });

  it('two entries reach their last places together: the one planned first starts a place earlier, both stay apart', () => {
    const due = speakOnly(10);
    const plan = run({
      entries: [...due, known('a', 0), known('b', 1)],
      cards: [...dueToday(due.map((e) => e.entryId)), knownCard('a'), knownCard('b')],
      log: [intro('a', local(10, 9)), intro('b', local(10, 9))],
    });
    expect(plan.items).toHaveLength(14);
    expect(shape(plan.items).slice(-5)).toEqual(['write:a*', 'write:b*', 'speak:r9', 'listen:a*', 'listen:b*']);
    expect(gaps(plan.items, 'a')).toEqual([2]);
    expect(gaps(plan.items, 'b')).toEqual([2]);
  });

  it('too few places: no error, the plain order as before', () => {
    const plan = run({
      entries: [known('a', 0), known('b', 1)],
      cards: [knownCard('a'), knownCard('b')],
      log: [intro('a', local(10, 9)), intro('b', local(10, 9))],
    });
    expect(shape(plan.items)).toEqual(['write:a*', 'write:b*', 'listen:a*', 'listen:b*']);
  });
});
