/**
 * On-device recognition packs (Web Speech `SpeechRecognition.available` / `install`).
 * Chrome may support recognizer hints only on the device, so the pack state decides
 * `processLocally`. The API is new and not everywhere: everything degrades to
 * `unsupported`, and a check that hangs gives up after a few seconds.
 */
import type { SpeechPackState } from '../core/model';

interface OnDeviceApi {
  available(o: { langs: string[]; processLocally: boolean }): Promise<string>;
  install(o: { langs: string[]; processLocally: boolean }): Promise<boolean>;
}

function api(): OnDeviceApi | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: Partial<OnDeviceApi>; webkitSpeechRecognition?: Partial<OnDeviceApi> };
  const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return SR && typeof SR.available === 'function' && typeof SR.install === 'function' ? (SR as OnDeviceApi) : null;
}

const STATES: readonly string[] = ['available', 'downloadable', 'downloading', 'unavailable'];
const CHECK_TIMEOUT_MS = 4000;

export async function speechPackState(locale: string): Promise<SpeechPackState> {
  const a = api();
  if (!a) return 'unsupported';
  try {
    const timeout = new Promise<string>((resolve) => setTimeout(() => resolve('unavailable'), CHECK_TIMEOUT_MS));
    const r = await Promise.race([a.available({ langs: [locale], processLocally: true }), timeout]);
    return STATES.includes(r) ? (r as SpeechPackState) : 'unavailable';
  } catch {
    return 'unsupported';
  }
}

/** Starts the pack download; call from a tap (the browser wants a user gesture). Resolves true when installed. */
export async function installSpeechPack(locale: string): Promise<boolean> {
  const a = api();
  if (!a) return false;
  try {
    return await a.install({ langs: [locale], processLocally: true });
  } catch {
    return false;
  }
}
