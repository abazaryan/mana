/**
 * Storage of the recognizer experiment's recordings (hidden page #/lab/record).
 * Its own IndexedDB database, so the learner's data in `mana` is never touched.
 */
import Dexie, { type Table } from 'dexie';
import type { LabChromeResult, LabSet } from '../core/lab';

export interface LabTake {
  itemId: string;
  blob?: Blob;
  mimeType?: string;
  durationMs?: number;
  /** The speaker marked the recording as spoiled. */
  spoiled?: boolean;
  chrome?: LabChromeResult;
  chromeSimultaneous?: LabChromeResult;
}

interface KvRow {
  key: string;
  value: LabSet;
}

class LabDb extends Dexie {
  kv!: Table<KvRow, string>;
  takes!: Table<LabTake, string>;
  constructor() {
    super('mana-lab');
    this.version(1).stores({ kv: 'key', takes: 'itemId' });
  }
}

let db: LabDb | null = null;
const get = () => (db ??= new LabDb());

export async function loadLabSet(): Promise<LabSet | null> {
  return (await get().kv.get('set'))?.value ?? null;
}

export async function saveLabSet(set: LabSet): Promise<void> {
  await get().kv.put({ key: 'set', value: set });
}

export async function loadTakes(): Promise<Map<string, LabTake>> {
  return new Map((await get().takes.toArray()).map((t) => [t.itemId, t]));
}

/** Merges `patch` into the take of an item. */
export async function patchTake(itemId: string, patch: Partial<LabTake>): Promise<LabTake> {
  const d = get();
  return d.transaction('rw', d.takes, async () => {
    const next: LabTake = { ...(await d.takes.get(itemId)), ...patch, itemId };
    await d.takes.put(next);
    return next;
  });
}

export async function clearLab(): Promise<void> {
  const d = get();
  await d.takes.clear();
  await d.kv.clear();
}
