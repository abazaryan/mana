/**
 * Persistent storage: without it the browser may clear IndexedDB when the disk is
 * short of space. Chrome grants or refuses it without asking the user.
 */
export type Persistence = 'persisted' | 'not-persisted' | 'unsupported';

export async function storagePersistence(): Promise<Persistence> {
  if (!navigator.storage?.persisted) return 'unsupported';
  try {
    return (await navigator.storage.persisted()) ? 'persisted' : 'not-persisted';
  } catch {
    return 'unsupported';
  }
}

export async function requestPersistence(): Promise<Persistence> {
  if (!navigator.storage?.persist) return 'unsupported';
  try {
    return (await navigator.storage.persist()) ? 'persisted' : 'not-persisted';
  } catch {
    return 'unsupported';
  }
}
