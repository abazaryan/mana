/**
 * Report of the keyboard lab (#/lab/keyboard, stage 5): what each test field received
 * from the keyboard and the browser. Lives next to the page and goes away with it.
 * Nothing here assumes Android: the same page runs in Safari on iOS.
 */

export type FieldId = 'K' | 'A' | 'A2' | 'B' | 'V';
export const FIELD_IDS: readonly FieldId[] = ['K', 'A', 'A2', 'B', 'V'];
export const FIELD_NAMES: Record<FieldId, string> = { K: 'К', A: 'А', A2: 'А′', B: 'Б', V: 'В' };

export type Detail = Record<string, string | number | boolean | null>;

export interface LabEvent {
  /** Milliseconds since the page opened. */
  t: number;
  target: FieldId | 'page';
  /**
   * Field: focus, blur, keydown, beforeinput, input, compositionstart / update / end, paste,
   * submit, ownkey (a key of the on-screen keyboard), edit (A′ typed on a physical keyboard),
   * measure. Page: viewport, visibility, orientation.
   */
  kind: string;
  detail?: Detail;
}

export interface LabEnv {
  userAgent: string;
  language: string;
  visualViewport: boolean;
  inputModeSupported: boolean;
  beforeInputSupported: boolean;
  pointerCoarse: boolean;
  hoverNone: boolean;
  maxTouchPoints: number;
  devicePixelRatio: number;
  screen: string;
}

export interface Measure {
  vvHeight: number;
  kbHeight: number;
  /** From the top of the field to the bottom of the marks-and-grades mock-up. */
  blockHeight: number;
  /** Visible height above the on-screen keyboard. */
  available: number;
  fits: boolean;
}

export interface FieldSummary {
  events: number;
  focuses: number;
  /** `inputType` of every `beforeinput`, with counts. */
  beforeinputTypes: Record<string, number>;
  /** `beforeinput` of type insertReplacementText: the keyboard replaced a word itself. */
  autocorrections: number;
  /** `paste` events (Gboard's clipboard chip may insert as plain text instead: see beforeinputTypes). */
  pastes: number;
  /** keydown with keyCode 229: the keyboard was composing. */
  keydown229: number;
  compositions: number;
  /** An empty field got a capital letter first from the system keyboard. */
  capitalFirst: number;
  submits: string[];
  ownKeys: number;
  /**
   * The visible height shrank by more than SYSTEM_KEYBOARD_PX while the field had the focus:
   * the system keyboard was up. null: the browser has no visualViewport.
   */
  systemKeyboard: boolean | null;
  /** The smallest visible height seen while the field had the focus. */
  minVisibleHeight: number | null;
  lastMeasure: Measure | null;
}

/** A system keyboard takes far more than the address bar (≈ 56 px) that comes and goes. */
export const SYSTEM_KEYBOARD_PX = 150;

/** Viewport samples: the tallest visible height for each width (a turn of the screen changes the width). */
function tallestByWidth(events: readonly LabEvent[]): Map<number, number> {
  const max = new Map<number, number>();
  for (const e of events) {
    if (e.target !== 'page' || e.kind !== 'viewport') continue;
    const w = e.detail?.vvWidth;
    const h = e.detail?.vvHeight;
    if (typeof w !== 'number' || typeof h !== 'number') continue;
    max.set(w, Math.max(max.get(w) ?? 0, h));
  }
  return max;
}

function isMeasure(d: Detail | undefined): d is Detail & Measure {
  return !!d && typeof d.vvHeight === 'number' && typeof d.kbHeight === 'number' && typeof d.blockHeight === 'number' && typeof d.available === 'number' && typeof d.fits === 'boolean';
}

function startsWithCapital(s: string): boolean {
  const c = [...s][0];
  return c !== undefined && c !== c.toLowerCase() && c === c.toUpperCase();
}

export function summarizeField(events: readonly LabEvent[], field: FieldId, hasViewport: boolean): FieldSummary {
  const s: FieldSummary = {
    events: 0,
    focuses: 0,
    beforeinputTypes: {},
    autocorrections: 0,
    pastes: 0,
    keydown229: 0,
    compositions: 0,
    capitalFirst: 0,
    submits: [],
    ownKeys: 0,
    systemKeyboard: hasViewport ? false : null,
    minVisibleHeight: null,
    lastMeasure: null,
  };
  const tallest = tallestByWidth(events);
  let focused = false;
  let previous = '';
  let pastedBefore = false;

  for (const e of events) {
    if (e.target === 'page') {
      if (focused && e.kind === 'viewport' && hasViewport) {
        const w = e.detail?.vvWidth;
        const h = e.detail?.vvHeight;
        if (typeof w === 'number' && typeof h === 'number') {
          s.minVisibleHeight = s.minVisibleHeight === null ? h : Math.min(s.minVisibleHeight, h);
          if (h < (tallest.get(w) ?? h) - SYSTEM_KEYBOARD_PX) s.systemKeyboard = true;
        }
      }
      continue;
    }
    if (e.target !== field) continue;
    s.events++;
    const d = e.detail;
    switch (e.kind) {
      case 'focus':
        focused = true;
        s.focuses++;
        break;
      case 'blur':
        focused = false;
        break;
      case 'keydown':
        if (d?.keyCode === 229) s.keydown229++;
        break;
      case 'beforeinput': {
        const type = typeof d?.inputType === 'string' ? d.inputType : '?';
        s.beforeinputTypes[type] = (s.beforeinputTypes[type] ?? 0) + 1;
        if (type === 'insertReplacementText') s.autocorrections++;
        if (type === 'insertFromPaste') pastedBefore = true;
        break;
      }
      case 'paste':
        s.pastes++;
        pastedBefore = true;
        break;
      case 'compositionstart':
        s.compositions++;
        break;
      case 'input': {
        const value = typeof d?.value === 'string' ? d.value : '';
        if (previous === '' && startsWithCapital(value) && !pastedBefore) s.capitalFirst++;
        pastedBefore = false;
        previous = value;
        break;
      }
      case 'ownkey':
      case 'edit':
        if (e.kind === 'ownkey') s.ownKeys++;
        previous = typeof d?.value === 'string' ? d.value : previous;
        break;
      case 'submit':
        s.submits.push(typeof d?.value === 'string' ? d.value : '');
        break;
      case 'measure':
        if (isMeasure(d)) s.lastMeasure = { vvHeight: d.vvHeight, kbHeight: d.kbHeight, blockHeight: d.blockHeight, available: d.available, fits: d.fits };
        break;
    }
  }
  return s;
}

export interface LabReport {
  kind: 'mana-keyboard-lab';
  version: 1;
  createdAt: string;
  env: LabEnv;
  summary: Record<FieldId, FieldSummary>;
  events: Record<FieldId | 'page', LabEvent[]>;
  limitations: string[];
}

export const LIMITATIONS = [
  'А′: каретка только в конце, без перестановки и выделения.',
  'А′: вставки из буфера нет.',
  'А′ с физической клавиатуры: буквы, пробел, Backspace и Enter; «мёртвые» клавиши (^ затем e) не работают.',
];

export function buildReport(env: LabEnv, events: readonly LabEvent[], now: Date): LabReport {
  const byTarget = { K: [], A: [], A2: [], B: [], V: [], page: [] } as Record<FieldId | 'page', LabEvent[]>;
  for (const e of events) byTarget[e.target].push(e);
  const summary = Object.fromEntries(FIELD_IDS.map((f) => [f, summarizeField(events, f, env.visualViewport)])) as Record<FieldId, FieldSummary>;
  return { kind: 'mana-keyboard-lab', version: 1, createdAt: now.toISOString(), env, summary, events: byTarget, limitations: LIMITATIONS };
}
