import { describe, expect, it } from 'vitest';
import { deck } from '../test/decks';
import { deckTitle } from './deckFormat';
import { planImport, type InstalledDeck } from './deckImport';

const T0 = new Date('2026-10-01T10:00:00Z');
const T1 = new Date('2026-10-02T10:00:00Z');

function installed(revision: number, ids: string[], hidden: string[] = []): InstalledDeck {
  const p = planImport(deck(revision, [...ids, ...hidden]), 'Урок', 0, null, T0);
  for (const e of p.entries) if (hidden.includes(e.entryId)) e.hidden = 1;
  return { deck: { ...p.deck, entryCount: ids.length, hiddenCount: hidden.length }, entries: p.entries };
}

describe('planImport', () => {
  it('installs a new deck in deck order, name from the file', () => {
    const p = planImport(deck(1, ['b', 'a', 'c']), 'Дарси 01', 1234, null, T0);
    expect(p.kind).toBe('install');
    expect(p.confirm).toEqual([]);
    expect(p.deck).toMatchObject({ id: 'fr-test-01', name: 'Дарси 01', revision: 1, entryCount: 3, hiddenCount: 0, audioBytes: 1234 });
    expect(p.entries.map((e) => [e.entryId, e.position, e.hidden])).toEqual([
      ['b', 0, 0],
      ['a', 1, 0],
      ['c', 2, 0],
    ]);
    expect(p.summary).toEqual({ added: 3, updated: 0, hidden: 0, restored: 0 });
  });

  it('a newer revision updates by id, hides missing entries, keeps their content', () => {
    const old = installed(1, ['a', 'b', 'c']);
    const next = deck(2, ['a', 'c', 'd']);
    next.entries[0]!.text = 'a corrigé';
    const p = planImport(next, 'Дарси 01 (2)', 0, old, T1);
    expect(p.kind).toBe('update');
    expect(p.confirm).toEqual([]);
    expect(p.summary).toEqual({ added: 1, updated: 2, hidden: 1, restored: 0 });
    const byId = new Map(p.entries.map((e) => [e.entryId, e]));
    expect(byId.get('a')).toMatchObject({ text: 'a corrigé', position: 0, hidden: 0 });
    expect(byId.get('b')).toMatchObject({ text: 'b', hidden: 1 });
    // Р30: an update without a title keeps the installed name, whatever the file is called.
    expect(p.deck).toMatchObject({ name: 'Урок', revision: 2, entryCount: 3, hiddenCount: 1, importedAt: T0, updatedAt: T1 });
  });

  it('keeps speech (Р34) and drops it when the new revision has none', () => {
    const first = deck(1, ['a', 'b']);
    first.entries[0]!.speech = 'tchao';
    const p = planImport(first, 'Урок', 0, null, T0);
    expect(p.entries.find((e) => e.entryId === 'a')?.speech).toBe('tchao');
    expect('speech' in p.entries.find((e) => e.entryId === 'b')!).toBe(false);
    const q = planImport(deck(2, ['a', 'b']), 'Урок', 0, { deck: p.deck, entries: p.entries }, T1);
    expect('speech' in q.entries.find((e) => e.entryId === 'a')!).toBe(false);
  });

  it('a returning entry is shown again', () => {
    const old = installed(2, ['a', 'c'], ['b']);
    const p = planImport(deck(3, ['a', 'b', 'c']), 'Урок', 0, old, T1);
    expect(p.summary).toEqual({ added: 0, updated: 2, hidden: 0, restored: 1 });
    expect(p.entries.find((e) => e.entryId === 'b')).toMatchObject({ hidden: 0, position: 1 });
    expect(p.deck.hiddenCount).toBe(0);
  });

  it('an entry hidden earlier and still missing stays hidden and is not counted again', () => {
    const old = installed(2, ['a'], ['b']);
    const p = planImport(deck(3, ['a']), 'Урок', 0, old, T1);
    expect(p.summary.hidden).toBe(0);
    expect(p.entries.find((e) => e.entryId === 'b')?.hidden).toBe(1);
    expect(p.deck.hiddenCount).toBe(1);
  });

  it('same revision asks to reinstall; older revision warns', () => {
    const old = installed(3, ['a', 'b']);
    expect(planImport(deck(3, ['a', 'b']), 'Урок', 0, old, T1).confirm).toEqual([{ type: 'reinstall', revision: 3 }]);
    expect(planImport(deck(2, ['a', 'b']), 'Урок', 0, old, T1).confirm).toEqual([
      { type: 'older', installed: 3, incoming: 2 },
    ]);
  });

  it('a deck with the same id but mostly other entries is flagged', () => {
    const old = installed(1, ['a', 'b', 'c', 'd']);
    const p = planImport(deck(2, ['a', 'x', 'y', 'z']), 'Другой урок', 0, old, T1);
    expect(p.confirm).toEqual([
      {
        type: 'different',
        installedName: 'Урок',
        shared: 1,
        installedCount: 4,
        incomingCount: 4,
        installedLanguage: 'fr-FR',
        languageChanged: false,
      },
    ]);
  });

  it('a grown deck that keeps the old entries is not flagged', () => {
    const old = installed(1, ['a', 'b']);
    expect(planImport(deck(2, ['a', 'b', 'c', 'd', 'e', 'f']), 'Урок', 0, old, T1).confirm).toEqual([]);
  });

  it('another learning language under the same id is flagged', () => {
    const old = installed(1, ['a', 'b']);
    const p = planImport(deck(2, ['a', 'b'], { language: 'de-DE' }), 'Урок', 0, old, T1);
    expect(p.confirm).toMatchObject([{ type: 'different', languageChanged: true, shared: 2 }]);
  });
});

describe('deck name (Р30)', () => {
  const title = { tg: 'Фаронсавӣ · Дарси 1', ru: 'Французский · Урок 1', en: 'French · Lesson 1' };

  it('install without a title: the file name; with a title: the title, the file name only stored', () => {
    expect(planImport(deck(1, ['a']), 'test-speak', 0, null, T0).deck).toMatchObject({ name: 'test-speak' });
    expect(planImport(deck(1, ['a']), 'test-speak', 0, null, T0).deck.title).toBeUndefined();
    const p = planImport(deck(1, ['a'], { title }), 'Фаронсавӣ · Дарси 01-1', 0, null, T0);
    expect(p.deck.title).toEqual(title);
    expect(deckTitle(p.deck, 'tg')).toBe('Фаронсавӣ · Дарси 1');
  });

  it('the real case: "test-speak" installed, "test-speak-2.zip" without a title arrives — the name stays', () => {
    const first = planImport(deck(8, ['a']), 'test-speak', 0, null, T0);
    const again = planImport(deck(8, ['a']), 'test-speak-2', 0, { deck: first.deck, entries: first.entries }, T1);
    expect(deckTitle(again.deck, 'ru')).toBe('test-speak');
  });

  it('a title fixes a deck renamed by a suffix, and stays when a later revision has none', () => {
    const broken = planImport(deck(2, ['a']), 'Фаронсавӣ · Дарси 01-1', 0, null, T0);
    const fixed = planImport(deck(3, ['a'], { title }), 'Фаронсавӣ · Дарси 01-2', 0, { deck: broken.deck, entries: broken.entries }, T1);
    expect(deckTitle(fixed.deck, 'tg')).toBe('Фаронсавӣ · Дарси 1');
    const later = planImport(deck(4, ['a']), 'x', 0, { deck: fixed.deck, entries: fixed.entries }, T1);
    expect(later.deck.title).toEqual(title);
  });

  it('shown in the interface language, else any, else the stored name', () => {
    const d = { name: 'file', title: { tg: 'Дарс', ru: 'Урок' } };
    expect(deckTitle(d, 'ru')).toBe('Урок');
    expect(deckTitle(d, 'en')).toBe('Дарс');
    expect(deckTitle({ name: 'file' }, 'en')).toBe('file');
  });
});
