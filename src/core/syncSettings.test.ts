import { describe, expect, it } from 'vitest';
import { changedKeys, fromSyncedValues, mergeSettings, settingsToSend, syncedValues } from './sync';
import { deckOfLimitKey, isSyncedSetting, MAX_SETTING_CHANGES, validSetting } from './syncProtocol';

describe('synced settings with a limit per deck (R47)', () => {
  const row = { uiLang: 'tg', meaningLang: 'ru', newPerDay: 10, newPerDeck: { 'fr-tu1-u01': 10, 'fr-tu1-u01-listen': 5 } };

  it('a key per deck limit; the shared newPerDay is not one of them', () => {
    expect(syncedValues(row)).toEqual({ uiLang: 'tg', meaningLang: 'ru', 'newPerDeck:fr-tu1-u01': 10, 'newPerDeck:fr-tu1-u01-listen': 5 });
    expect(fromSyncedValues(row, { 'newPerDeck:my-x': 15, uiLang: 'en' })).toEqual({ ...row, uiLang: 'en', newPerDeck: { ...row.newPerDeck, 'my-x': 15 } });
  });

  it('deck limit keys: a valid deck id after the prefix', () => {
    expect(deckOfLimitKey('newPerDeck:fr-tu1-u01')).toBe('fr-tu1-u01');
    for (const key of ['newPerDeck:', 'newPerDeck:A', 'newPerDeck:a:b', 'newPerDay', 'x', 1]) expect(deckOfLimitKey(key)).toBeNull();
    expect(isSyncedSetting('newPerDeck:a')).toBe(true);
    expect(validSetting('newPerDeck:a', 1)).toBe(true);
    expect(validSetting('newPerDeck:a', 100)).toBe(true);
    for (const v of [0, 101, 2.5, '5', null]) expect(validSetting('newPerDeck:a', v)).toBe(false);
  });

  it('changes go first, then init; at most MAX_SETTING_CHANGES in one push', () => {
    const many = Object.fromEntries(Array.from({ length: 60 }, (_, k) => [`d${k}`, 5]));
    const local = syncedValues({ ...row, newPerDeck: many });
    const sent = settingsToSend(local, {}, ['newPerDeck:d59']);
    expect(sent).toHaveLength(MAX_SETTING_CHANGES);
    expect(sent[0]).toEqual({ key: 'newPerDeck:d59', value: 5, mode: 'set' });
    expect(sent.slice(1).every((c) => c.mode === 'init')).toBe(true);
    expect(sent.some((c) => c.key === 'newPerDay')).toBe(false);
  });

  it('the shared newPerDay from the server is not taken; a deck limit of a deck not here is', () => {
    const merged = mergeSettings(syncedValues(row), {}, [], { newPerDay: { value: 20, rev: 3 }, 'newPerDeck:other': { value: 15, rev: 4 } });
    expect(merged.values).toEqual({ 'newPerDeck:other': 15 });
    expect(merged.rev).toEqual({ 'newPerDeck:other': 4 });
  });

  it('a changed deck limit is a changed key', () => {
    expect(changedKeys(syncedValues(row), syncedValues({ ...row, newPerDeck: { ...row.newPerDeck, 'fr-tu1-u01': 15 } }))).toEqual(['newPerDeck:fr-tu1-u01']);
  });
});
