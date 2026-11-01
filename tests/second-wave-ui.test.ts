/**
 * Second wave of invitations (R44 item 3, R45), the screens rendered to markup (react-dom/server;
 * effects do not run — no requests): the question about another installation's study log has
 * "No" as the main button and "Yes" in the style of the irreversible actions (STATUS open item
 * 10); the copy of the account's data sits in Settings → Account too, the same part as on the
 * deletion screen (STATUS open item 11). Taps in a real page are checked by hand on the laptop.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { MetaRow } from '../src/core/model';
import type { ManaDb } from '../src/platform/db';
import { AccountSection } from '../src/ui/AccountSection';
import { ConfirmOther, confirmOtherKey, listenConfirmKeys } from '../src/ui/ConfirmOther';
import { DeleteAccountScreen } from '../src/ui/DeleteAccountScreen';
import { translate } from '../src/ui/strings';

// The copy part as a marker: whoever renders it renders this one module's part.
vi.mock('../src/ui/AccountCopy', () => ({
  AccountCopy: ({ sendFirst }: { sendFirst?: boolean }) => createElement('i', { 'data-account-copy': sendFirst ? 'send-first' : 'plain' }),
}));

const ru = (key: Parameters<typeof translate>[1]) => translate('ru', key);
const db = {} as ManaDb;
const base: MetaRow = { id: 'device', userId: 'u-1', deviceId: 'd-1', createdAt: new Date(0) } as MetaRow;
const account = { userId: 'u-1', deviceName: 'Windows · Edge', since: new Date(0) };
const noop = () => {};

const section = (meta: MetaRow) => renderToStaticMarkup(createElement(AccountSection, { db, meta, onMetaChange: noop }));
const buttons = (html: string) => [...html.matchAll(/<button([^>]*)>([^<]*)<\/button>/g)].map(([, attrs, text]) => ({ attrs: attrs!, text: text! }));

describe('restore.confirmOther: "No" is the main button (R45)', () => {
  const html = renderToStaticMarkup(createElement(ConfirmOther, { onYes: noop, onNo: noop }));

  it('"No" comes first, is the main button and has the focus; "Yes" is secondary danger, never primary', () => {
    const [no, yes] = buttons(html);
    expect(no?.text).toBe(ru('common.no'));
    expect(no?.attrs).toMatch(/class="primary"/);
    expect(no?.attrs).toMatch(/autofocus/i);
    expect(yes?.text).toBe(ru('common.yes'));
    expect(yes?.attrs).toMatch(/class="secondary danger"/);
    expect(yes?.attrs).not.toMatch(/primary|autofocus/i);
  });

  it('the texts stay the same', () => {
    expect(html).toContain(ru('restore.confirmOther'));
    expect(html).toContain(ru('restore.confirmOtherHint'));
  });

  it('Escape answers "no" and sends nothing; Enter, Space and other keys answer nothing', () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const target = new EventTarget();
    const no = vi.fn();
    const stop = listenConfirmKeys(target, no);
    const press = (key: string) => target.dispatchEvent(Object.assign(new Event('keydown', { cancelable: true }), { key }));
    for (const key of ['Enter', ' ', 'y', 'Tab']) press(key);
    expect(no).not.toHaveBeenCalled();
    press('Escape');
    expect(no).toHaveBeenCalledTimes(1);
    stop();
    press('Escape');
    expect(no).toHaveBeenCalledTimes(1);
    expect(fetch).not.toHaveBeenCalled();
    expect(confirmOtherKey('Enter')).toBeNull();
    vi.unstubAllGlobals();
  });
});

describe('the copy of the account data in Settings → Account (R45)', () => {
  it('signed in: there, the queue sent first, above sign-out and deletion', () => {
    const html = section({ ...base, account });
    expect(html).toContain('data-account-copy="send-first"');
    expect(html.indexOf('data-account-copy')).toBeLessThan(html.indexOf(ru('account.signOut')));
    expect(html.indexOf('data-account-copy')).toBeLessThan(html.indexOf(ru('account.delete')));
  });

  it('signed in without consent to the current notice: there too (R42 item 1)', () => {
    expect(section({ ...base, account, sync: { cursor: 0, needsConsent: { version: 3, at: new Date(0) } } } as MetaRow)).toContain('data-account-copy');
  });

  it('not signed in, or a deletion sent with its answer unknown: not there', () => {
    expect(section(base)).not.toContain('data-account-copy');
    expect(section({ ...base, account, pendingDeletion: { userId: 'u-1', at: new Date(0) } })).not.toContain('data-account-copy');
  });

  it('the deletion screen renders the same part (the queue is sent by the screen itself)', () => {
    const html = renderToStaticMarkup(createElement(DeleteAccountScreen, { db, meta: { ...base, account }, deleted: false, onMetaChange: noop, onNeedsUpdate: noop }));
    expect(html).toContain('data-account-copy="plain"');
  });

  it('the part itself: the button "Save a copy of your account data"', async () => {
    const { AccountCopy } = await vi.importActual<typeof import('../src/ui/AccountCopy')>('../src/ui/AccountCopy');
    const [button] = buttons(renderToStaticMarkup(createElement(AccountCopy, { db, meta: { ...base, account }, sendFirst: true })));
    expect(button?.text).toBe(ru('account.exportAll'));
    expect(button?.attrs).not.toMatch(/danger|disabled/);
  });
});
