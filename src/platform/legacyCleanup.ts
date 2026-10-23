/**
 * One-time cleanup of the recognizer experiment (R23, closed): the hidden page #/lab/record kept
 * its recordings in its own IndexedDB database `mana-lab`. The page is gone, so the database is
 * deleted once on a device that has it. Only this database: `mana` (decks, cards, journal) is
 * never touched.
 */
export const LAB_DB_NAME = 'mana-lab';
const DONE_KEY = 'mana.labDbRemoved';

type Flag = Pick<Storage, 'getItem' | 'setItem'>;

function flagStore(): Flag | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function deleteDb(idb: IDBFactory, name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = idb.deleteDatabase(name);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    // Another tab still holds it open: the delete finishes when that tab lets go.
    req.onblocked = () => resolve();
  });
}

/** Resolves `removed` after the delete, `skipped` when it already ran on this device. Never throws. */
export async function removeLegacyLabDatabase(
  idb: IDBFactory | null = typeof indexedDB === 'undefined' ? null : indexedDB,
  flag: Flag | null = flagStore(),
): Promise<'removed' | 'skipped'> {
  if (!idb) return 'skipped';
  try {
    if (flag?.getItem(DONE_KEY)) return 'skipped';
  } catch {
    // The flag is only an optimisation: deleting a missing database is harmless.
  }
  try {
    await deleteDb(idb, LAB_DB_NAME);
    try {
      flag?.setItem(DONE_KEY, '1');
    } catch {
      // Without the flag the delete simply runs again at the next start.
    }
    return 'removed';
  } catch {
    return 'skipped';
  }
}
