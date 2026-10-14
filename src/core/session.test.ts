import { describe, expect, it } from 'vitest';
import { State } from 'ts-fsrs';
import type { Skill } from './deckFormat';
import type { CardRow, EntryRow, IntroRecord, LogRecord } from './model';
import { buildSession, dayStart, introsToday, PORTION_SIZE, type SessionItem } from './session';

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
const shape = (items: SessionItem[]) => items.map((i) => `${i.kind}:${i.entry.entryId}${i.kind === 'speak' && i.card === null ? '*' : ''}`);
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

  it('introduced but never answered: recalled without a new introduction', () => {
    const log = [intro('a', local(13, 10))];
    const plan = run({ entries: five.slice(0, 2), log });
    expect(shape(plan.items)).toEqual(['intro:b', 'speak:a*', 'speak:b*']);
    expect(plan).toMatchObject({ pending: 1, introduced: 1 });
  });

  it('hidden entries are not issued, but their introductions count toward the limit', () => {
    const entries = [entry('a', 0, { hidden: 1 }), entry('b', 1), entry('c', 2)];
    const plan = run({ entries, cards: [card('a', local(1, 0))], log: [intro('a', local(14, 5))], newPerDay: 2 });
    expect(shape(plan.items)).toEqual(['intro:b', 'speak:b*']);
  });

  it('entries without `speak` wait for stage 4.3', () => {
    const plan = run({ entries: [entry('a', 0, { skills: ['write'] }), entry('b', 1)] });
    expect(shape(plan.items)).toEqual(['intro:b', 'speak:b*']);
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
    expect(plan.items.filter((i) => i.kind === 'speak')).toHaveLength(15);
  });

  it('cards of other skills and future cards are not issued', () => {
    const plan = run({
      entries: five.slice(0, 2),
      cards: [card('a', local(20, 0)), card('b', local(1, 0), 'write')],
      newPerDay: 0,
    });
    expect(plan.items).toEqual([]);
    expect(plan.noNew).toBe('dailyLimit');
  });

  it('nothing at all: no material', () => {
    expect(run({ entries: [] })).toMatchObject({ items: [], noNew: 'noMaterial' });
  });
});
