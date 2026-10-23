import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { LAB_DB_NAME, removeLegacyLabDatabase } from './legacyCleanup';

function memoryFlag() {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
}

function createDb(name: string, row: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, 1);
    req.onupgradeneeded = () => req.result.createObjectStore('kv', { keyPath: 'key' }).put({ key: 'k', value: row });
    req.onsuccess = () => {
      req.result.close();
      resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

const names = async () => (await indexedDB.databases()).map((d) => d.name);

describe('removal of the closed recognizer experiment database (R23)', () => {
  it('deletes mana-lab once and leaves every other database alone', async () => {
    await createDb(LAB_DB_NAME, 'recording');
    await createDb('mana-cleanup-test', 'journal');
    const flag = memoryFlag();

    expect(await removeLegacyLabDatabase(indexedDB, flag)).toBe('removed');
    expect(await names()).not.toContain(LAB_DB_NAME);
    expect(await names()).toContain('mana-cleanup-test');

    // A database of the same name created later is left alone: the cleanup ran once.
    await createDb(LAB_DB_NAME, 'new');
    expect(await removeLegacyLabDatabase(indexedDB, flag)).toBe('skipped');
    expect(await names()).toContain(LAB_DB_NAME);
  });

  it('a device without the database is fine, and without IndexedDB nothing happens', async () => {
    expect(await removeLegacyLabDatabase(indexedDB, memoryFlag())).toBe('removed');
    expect(await removeLegacyLabDatabase(null, memoryFlag())).toBe('skipped');
  });
});
