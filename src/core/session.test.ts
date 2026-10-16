import { describe, expect, it } from 'vitest';
import { State } from 'ts-fsrs';
import type { Skill } from './deckFormat';
import type { CardRow, EntryRow, IntroRecord, LogRecord, ReviewRecord } from './model';
import {
  buildSession,
  CATCH_UP_PER_DAY,
  catchUpToday,
  dayStart,
  introsToday,
  MAX_REQUEUES,
  PORTION_SIZE,
  requeueAfterAgain,
  sinceEntry,
  type SessionItem,
} from './session';

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

function card(entryId: string, due: Date, skill: Skill = 'speak'): CardRow {
  return {
    userId: 'u',
    deckId: 'd',
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
    lastReview: due,
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

const local = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m);
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
  buildSession({ now: NOW, entries: [], cards: [], log: [], newPerDay: 5, ...over });

describe('dayStart (04:00 local)', () => {
  it('after 04:00 → today 04:00', () => expect(dayStart(local(14, 10))).toEqual(local(14, 4)));
  it('before 04:00 → yesterday 04:00', () => expect(dayStart(local(14, 3, 59))).toEqual(local(13, 4)));
  it('exactly 04:00 → today', () => expect(dayStart(local(14, 4))).toEqual(local(14, 4)));
  it('across a month', () => expect(dayStart(new Date(2026, 10, 1, 1))).toEqual(new Date(2026, 9, 31, 4)));
});

describe('introsToday', () => {
  it('counts every deck and stops at the 04:00 boundary', () => {
    const log: LogRecord[] = [intro('a', local(14, 3, 59)), intro('b', local(14, 4)), intro('c', local(14, 9), 'other')];
    expect(introsToday(log, NOW)).toBe(2);
    expect(introsToday(log, local(14, 3, 59, ))).toBe(1);
  });
});

describe('buildSession', () => {
  const five = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((id, k) => entry(id, k));

  it('new entries: introductions first, recalls at the end, in deck order', () => {
    const plan = run({ entries: five.slice(0, 2), cards: [] });
    expect(shape(plan.items)).toEqual(['intro:a', 'intro:b', 'speak:a*', 'speak:b*']);
    expect(plan).toMatchObject({ introduced: 2, due: 0, noNew: null, newLeft: 3 });
  });

  it('order: introductions → overdue (oldest first) → recalls', () => {
    const entries = five.slice(0, 4);
    const cards = [card('a', local(14, 9)), card('b', local(12, 9)), card('c', local(15, 9))];
    const plan = run({ entries, cards });
    expect(shape(plan.items)).toEqual(['intro:d', 'speak:b', 'speak:a', 'speak:d*']);
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

  it('a portion holds 15 cards; overdue fill it first', () => {
    const entries = Array.from({ length: 30 }, (_, k) => entry(`e${k}`, k));
    const cards = entries.slice(0, 20).map((e, k) => card(e.entryId, local(1, 0, k)));
    const plan = run({ entries, cards });
    expect(plan.items).toHaveLength(PORTION_SIZE);
    expect(plan).toMatchObject({ due: 15, introduced: 0, noNew: 'portionFull' });
  });

  it('room left after overdue goes to new entries', () => {
    const entries = Array.from({ length: 30 }, (_, k) => entry(`e${k}`, k));
    const cards = entries.slice(0, 12).map((e, k) => card(e.entryId, local(1, 0, k)));
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
    expect(catchUpToday(log, NOW)).toBe(2);
  });

  it('an answer that is not the first on its pair does not count', () => {
    const later = { ...firstAnswer('a', local(14, 6)), fsrs: { stateBefore: State.Review } } as ReviewRecord;
    expect(catchUpToday([intro('a', local(13, 9)), later], NOW)).toBe(0);
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
