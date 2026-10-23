/**
 * Signals between the journal, the sync engine and the screens (stage 6a.3): a record was queued
 * (send soon); records or settings came from the server (counts on the screens are stale). The
 * other windows of the app hear "changed" through a BroadcastChannel.
 */
type Listener = () => void;

const queued = new Set<Listener>();
const changed = new Set<Listener>();
const CHANNEL = 'mana-sync';

let channel: BroadcastChannel | null = null;
function bus(): BroadcastChannel | null {
  if (channel === null && typeof BroadcastChannel !== 'undefined') {
    channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = () => {
      for (const f of changed) f();
    };
  }
  return channel;
}

export function onQueued(f: Listener): () => void {
  queued.add(f);
  return () => queued.delete(f);
}

export function notifyQueued(): void {
  for (const f of queued) f();
}

export function onSyncChanged(f: Listener): () => void {
  bus();
  changed.add(f);
  return () => changed.delete(f);
}

/** Records or settings arrived: this window's screens and the other windows refresh. */
export function notifySyncChanged(): void {
  for (const f of changed) f();
  try {
    bus()?.postMessage('changed');
  } catch {
    // A closed channel: the other windows refresh on their next start.
  }
}
