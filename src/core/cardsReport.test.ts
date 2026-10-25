import { describe, expect, it } from 'vitest';
import { cardLines, cardsHash, cardsReport, type CardDue } from './cardsReport';

const card = (deckId: string, entryId: string, skill: string, due: string): CardDue => ({ deckId, entryId, skill, due: new Date(due) });

describe('#/lab/cards report (R40)', () => {
  const cards = [card('fr-b', 'x', 'speak', '2026-10-30T10:00:00.000Z'), card('fr-a', 'y', 'listen', '2026-10-28T08:00:00.000Z')];

  it('lines are sorted; the hash does not depend on the order of the cards', async () => {
    expect(cardLines(cards)).toEqual(['fr-a|y|listen|2026-10-28T08:00:00.000Z', 'fr-b|x|speak|2026-10-30T10:00:00.000Z']);
    expect(await cardsHash(cards)).toBe(await cardsHash([...cards].reverse()));
    expect(await cardsHash(cards)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('another due date gives another hash', async () => {
    const moved = [cards[0]!, { ...cards[1]!, due: new Date('2026-10-29T08:00:00.000Z') }];
    expect(await cardsHash(moved)).not.toBe(await cardsHash(cards));
  });

  it('the report: numbers and hashes, the first 8 characters of the user, one line per deck', async () => {
    const text = await cardsReport({
      build: 202610251200,
      userId: '4fb2b47d-0000-4000-8000-000000000000',
      formerUserIds: 1,
      records: 9,
      cards,
      outbox: { pending: 2, rejected: 0, conflict: 0 },
      lastSynced: null,
    });
    const lines = text.split('\n');
    expect(lines[0]).toBe('build: 202610251200');
    expect(lines[1]).toBe('user: 4fb2b47d   former: 1');
    expect(lines[2]).toBe('log: 9   cards: 2');
    expect(lines[3]).toMatch(/^cards\.sha256: [0-9a-f]{64}$/);
    expect(lines[4]).toMatch(/^deck fr-a: cards 1 sha256 [0-9a-f]{64}$/);
    expect(lines[5]).toMatch(/^deck fr-b: cards 1 sha256 [0-9a-f]{64}$/);
    expect(lines[6]).toBe('outbox: pending 2 rejected 0 conflict 0');
    expect(lines[7]).toBe('synced: never');
    expect(text).not.toContain('4fb2b47d-0000');
  });
});
