/**
 * Clearing the data on this device (stage 6a.5b, R42 item 7), the browser side of
 * src/core/wipe.ts: the databases, the storage keys, the signal to the other windows. The
 * sending of the queue and the sign-out come before (src/ui/WipeSheet.tsx).
 */
import { keysToWipe, WIPE_CHANNEL, WIPE_DATABASES, WIPE_PENDING_KEY, type WipeSignal } from '../core/wipe';

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>;

function store(name: 'localStorage' | 'sessionStorage'): Store | null {
  try {
    return typeof globalThis[name] === 'undefined' ? null : globalThis[name];
  } catch {
    return null;
  }
}

function keysOf(s: Store): string[] {
  const out: string[] = [];
  for (let i = 0; i < s.length; i++) {
    const k = s.key(i);
    if (k !== null) out.push(k);
  }
  return out;
}

/** Deletes one database; `onBlocked` — another window still holds it: the delete waits for it. */
function deleteDatabase(idb: IDBFactory, name: string, onBlocked: () => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = idb.deleteDatabase(name);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = onBlocked;
  });
}

function signal(message: WipeSignal): void {
  try {
    const channel = new BroadcastChannel(WIPE_CHANNEL);
    channel.postMessage(message);
    channel.close();
  } catch {
    // No channel: the other windows learn it from the database's versionchange.
  }
}

/** The other windows' side: `start` — let the database go and say so; `done` — open afresh. */
export function onWipeSignal(handler: (message: WipeSignal) => void): () => void {
  if (typeof BroadcastChannel === 'undefined') return () => {};
  const channel = new BroadcastChannel(WIPE_CHANNEL);
  channel.onmessage = (e: MessageEvent) => {
    if (e.data === 'start' || e.data === 'done') handler(e.data);
  };
  return () => channel.close();
}

export interface WipeEnv {
  idb?: IDBFactory | null;
  local?: Store | null;
  session?: Store | null;
  /** The app's open database: closed first, so the delete does not wait for this window. */
  close?: () => void;
  onBlocked?: () => void;
}

async function deleteAll(env: WipeEnv): Promise<void> {
  const idb = env.idb === undefined ? (typeof indexedDB === 'undefined' ? null : indexedDB) : env.idb;
  if (idb) for (const name of WIPE_DATABASES) await deleteDatabase(idb, name, env.onBlocked ?? (() => {}));
  for (const s of [env.session, env.local]) {
    if (!s) continue;
    for (const key of keysToWipe(keysOf(s))) s.removeItem(key);
  }
}

const withDefaults = (env: WipeEnv): WipeEnv => ({
  ...env,
  local: env.local === undefined ? store('localStorage') : env.local,
  session: env.session === undefined ? store('sessionStorage') : env.session,
});

/** Steps 3–5 of the wipe (core/wipe.ts); the caller opens the page afresh after it. */
export async function wipeDevice(given: WipeEnv = {}): Promise<void> {
  const env = withDefaults(given);
  try {
    env.local?.setItem(WIPE_PENDING_KEY, String(Date.now()));
  } catch {
    // Without the mark a page closed midway is not finished at the next start; the wipe still runs.
  }
  signal('start');
  env.close?.();
  await deleteAll(env);
  signal('done');
}

/** At start, before the database is opened: a wipe whose page closed midway is finished. True — it was. */
export async function finishPendingWipe(given: WipeEnv = {}): Promise<boolean> {
  const env = withDefaults(given);
  let pending: string | null = null;
  try {
    pending = env.local?.getItem(WIPE_PENDING_KEY) ?? null;
  } catch {
    return false;
  }
  if (pending === null) return false;
  await deleteAll(env);
  return true;
}
