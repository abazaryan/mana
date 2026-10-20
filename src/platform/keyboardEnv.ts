/**
 * Browser facts the on-screen keyboard needs (Р31): is the main pointer a finger, and
 * the device's "close" action (Android Back) while the keyboard is up.
 */

const COARSE = '(pointer: coarse)';

/** The main pointer is a finger (a phone or a tablet); false on a laptop with a touchpad or mouse. */
export function coarsePointer(): boolean {
  return typeof matchMedia === 'function' && matchMedia(COARSE).matches;
}

/** Calls back when the main pointer changes (a keyboard and mouse attached to a tablet). */
export function onPointerKindChange(cb: (coarse: boolean) => void): () => void {
  if (typeof matchMedia !== 'function') return () => {};
  const mq = matchMedia(COARSE);
  const on = () => cb(mq.matches);
  mq.addEventListener('change', on);
  return () => mq.removeEventListener('change', on);
}

interface CloseWatcherLike {
  onclose: (() => void) | null;
  destroy(): void;
}
type CloseWatcherCtor = new () => CloseWatcherLike;

/**
 * While the returned function is not called, the device's close action (Android Back,
 * Esc) calls `onClose` instead of leaving the page. Uses CloseWatcher (Chrome 126+); it
 * adds no history entries, so the hash routes are untouched. Without it (Safari:
 * iPhone has no Back button) — nothing happens.
 */
export function watchClose(onClose: () => void): () => void {
  const Ctor = (globalThis as { CloseWatcher?: CloseWatcherCtor }).CloseWatcher;
  if (!Ctor) return () => {};
  let watcher: CloseWatcherLike | null;
  try {
    watcher = new Ctor();
  } catch {
    return () => {};
  }
  watcher.onclose = () => {
    watcher = null;
    onClose();
  };
  return () => {
    watcher?.destroy();
    watcher = null;
  };
}
