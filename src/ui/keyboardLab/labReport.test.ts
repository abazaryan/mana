import { describe, expect, it } from 'vitest';
import { buildReport, summarizeField, type LabEnv, type LabEvent } from './labReport';

let t = 0;
const ev = (target: LabEvent['target'], kind: string, detail?: LabEvent['detail']): LabEvent => ({ t: t++, target, kind, ...(detail ? { detail } : {}) });
const vp = (vvHeight: number, vvWidth = 400) => ev('page', 'viewport', { vvHeight, vvWidth, innerHeight: 800, innerWidth: vvWidth });

const env: LabEnv = {
  userAgent: 'test',
  language: 'ru',
  visualViewport: true,
  inputModeSupported: true,
  beforeInputSupported: true,
  pointerCoarse: true,
  hoverNone: true,
  maxTouchPoints: 5,
  devicePixelRatio: 2,
  screen: '400x800',
};

describe('summarizeField: system keyboard', () => {
  it('the visible height shrank while the field had the focus', () => {
    const events = [vp(800), ev('B', 'focus'), vp(800), vp(480), ev('B', 'blur'), vp(800)];
    const s = summarizeField(events, 'B', true);
    expect(s.systemKeyboard).toBe(true);
    expect(s.minVisibleHeight).toBe(480);
  });
  it('stayed hidden: only the address bar moved', () => {
    const events = [vp(800), ev('A', 'focus'), vp(744), vp(800), ev('A', 'blur')];
    const s = summarizeField(events, 'A', true);
    expect(s.systemKeyboard).toBe(false);
    expect(s.minVisibleHeight).toBe(744);
  });
  it('a shrink while another field has the focus does not count', () => {
    const events = [vp(800), ev('B', 'focus'), vp(480), ev('B', 'blur'), ev('A', 'focus'), vp(800), ev('A', 'blur')];
    expect(summarizeField(events, 'A', true).systemKeyboard).toBe(false);
    expect(summarizeField(events, 'B', true).systemKeyboard).toBe(true);
  });
  it('a turn of the screen is not a keyboard: heights compare within one width', () => {
    const events = [vp(800, 400), ev('A', 'focus'), vp(380, 800), vp(380, 800), ev('A', 'blur')];
    expect(summarizeField(events, 'A', true).systemKeyboard).toBe(false);
  });
  it('the keyboard came back after the turn', () => {
    const events = [vp(800, 400), ev('A', 'focus'), vp(380, 800), vp(150, 800), ev('A', 'blur'), vp(380, 800)];
    expect(summarizeField(events, 'A', true).systemKeyboard).toBe(true);
  });
  it('the keyboard came back after switching apps (focus again)', () => {
    const events = [vp(800), ev('A', 'focus'), vp(800), ev('A', 'blur'), ev('page', 'visibility', { state: 'hidden' }), ev('page', 'visibility', { state: 'visible' }), ev('A', 'focus'), vp(450)];
    const s = summarizeField(events, 'A', true);
    expect(s.systemKeyboard).toBe(true);
    expect(s.focuses).toBe(2);
  });
  it('without visualViewport: unknown', () => {
    const events = [ev('A', 'focus'), ev('A', 'blur')];
    expect(summarizeField(events, 'A', false).systemKeyboard).toBeNull();
  });
});

describe('summarizeField: what the keyboard did', () => {
  it('counts beforeinput types and autocorrections', () => {
    const events = [
      ev('V', 'beforeinput', { inputType: 'insertCompositionText', data: 'tol' }),
      ev('V', 'beforeinput', { inputType: 'insertReplacementText', data: 'tolbane' }),
      ev('V', 'beforeinput', { inputType: 'insertText', data: ' ' }),
      ev('V', 'beforeinput', { inputType: 'insertCompositionText', data: 'x' }),
    ];
    const s = summarizeField(events, 'V', true);
    expect(s.beforeinputTypes).toEqual({ insertCompositionText: 2, insertReplacementText: 1, insertText: 1 });
    expect(s.autocorrections).toBe(1);
  });
  it('a capital first letter in an empty field', () => {
    const events = [ev('K', 'input', { value: 'M' }), ev('K', 'input', { value: 'Ma' }), ev('K', 'input', { value: '' }), ev('K', 'input', { value: 'm' })];
    expect(summarizeField(events, 'K', true).capitalFirst).toBe(1);
  });
  it('a pasted capital is not autocapitalisation', () => {
    const events = [ev('B', 'paste'), ev('B', 'beforeinput', { inputType: 'insertFromPaste' }), ev('B', 'input', { value: 'Paris' })];
    const s = summarizeField(events, 'B', true);
    expect(s.capitalFirst).toBe(0);
    expect(s.pastes).toBe(1);
  });
  it('a capital from the on-screen keyboard (shift) is not autocapitalisation', () => {
    const events = [ev('A', 'ownkey', { key: 'M', value: 'M' }), ev('A', 'input', { value: 'Ma' })];
    const s = summarizeField(events, 'A', true);
    expect(s.capitalFirst).toBe(0);
    expect(s.ownKeys).toBe(1);
  });
  it('keyCode 229, compositions, submits', () => {
    const events = [
      ev('B', 'keydown', { key: 'Unidentified', keyCode: 229 }),
      ev('B', 'compositionstart', { data: '' }),
      ev('B', 'keydown', { key: 'Enter', keyCode: 13 }),
      ev('B', 'submit', { value: 'tolbane' }),
      ev('B', 'submit', { value: 'tolbne' }),
    ];
    const s = summarizeField(events, 'B', true);
    expect(s.keydown229).toBe(1);
    expect(s.compositions).toBe(1);
    expect(s.submits).toEqual(['tolbane', 'tolbne']);
  });
  it('the last fit measure', () => {
    const m1 = { vvHeight: 800, kbHeight: 300, blockHeight: 400, available: 500, fits: true };
    const m2 = { vvHeight: 700, kbHeight: 300, blockHeight: 450, available: 400, fits: false };
    const s = summarizeField([ev('A2', 'measure', m1), ev('A2', 'measure', m2), ev('A2', 'measure', { broken: true })], 'A2', true);
    expect(s.lastMeasure).toEqual(m2);
  });
});

describe('buildReport', () => {
  it('events by field and page, a summary for every field', () => {
    const events = [vp(800), ev('K', 'focus'), ev('A2', 'ownkey', { key: 'z', value: 'z' })];
    const r = buildReport(env, events, new Date('2026-10-20T10:00:00Z'));
    expect(r.kind).toBe('mana-keyboard-lab');
    expect(r.createdAt).toBe('2026-10-20T10:00:00.000Z');
    expect(r.events.page).toHaveLength(1);
    expect(r.events.K).toHaveLength(1);
    expect(r.events.A2).toHaveLength(1);
    expect(r.events.V).toEqual([]);
    expect(Object.keys(r.summary)).toEqual(['K', 'A', 'A2', 'B', 'V']);
    expect(r.summary.A2.ownKeys).toBe(1);
    expect(r.limitations.length).toBeGreaterThan(0);
    expect(JSON.parse(JSON.stringify(r))).toEqual(r);
  });
});
