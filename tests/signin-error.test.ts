/**
 * A sign-in that got no answer even after the automatic retry (R45, STATUS open item 8): the text
 * names the way in — the same link again (invitation, recovery link) or "Sign in" again (pairing
 * code). No answer while the browser is offline keeps the old text: the request never left, nothing
 * was spent. Every other answer keeps its old text.
 */
import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createScheduler } from '../src/core/scheduler';
import { pairDevice, redeemInvite, type ApiResult, type SignedIn } from '../src/platform/api';
import { ManaDb } from '../src/platform/db';
import { ensureDevice } from '../src/platform/repo';
import { failureText, signInWith, type SignInFailure } from '../src/ui/signIn';
import { STRINGS } from '../src/ui/strings';

const open: ManaDb[] = [];
afterEach(async () => {
  vi.unstubAllGlobals();
  for (const db of open.splice(0)) {
    db.close();
    await db.delete();
  }
});

async function device(): Promise<ManaDb> {
  const db = new ManaDb(`signin-error-${crypto.randomUUID()}`);
  open.push(db);
  await ensureDevice(db);
  return db;
}

const fail = (status: number, error: string): ApiResult<SignedIn> => ({ ok: false, status, error });

/** The reason after signInWith, every attempt answered with `answer`. */
async function reasonFor(answer: ApiResult<SignedIn>, online: boolean): Promise<SignInFailure | 'ok'> {
  const outcome = await signInWith(await device(), createScheduler(), false, async () => answer, async () => {}, () => online);
  return outcome.ok ? 'ok' : outcome.reason;
}

describe('which text a failed sign-in shows (R45)', () => {
  it('a 5xx after the retry (a 1102 page included): the new texts, whatever navigator.onLine says', async () => {
    for (const online of [true, false]) {
      for (const status of [500, 503, 524]) expect(await reasonFor(fail(status, 'http'), online), `${status} ${online}`).toBe('noAnswer');
    }
    expect(failureText('noAnswer', 'link')).toBe('signin.errorLink');
    expect(failureText('noAnswer', 'code')).toBe('signin.errorCode');
  });

  it('no answer at all: the new texts while online, the old offline text while the browser is offline', async () => {
    expect(await reasonFor(fail(0, 'offline'), true)).toBe('noAnswer');
    expect(await reasonFor(fail(0, 'offline'), false)).toBe('offline');
    for (const way of ['link', 'code'] as const) expect(failureText('offline', way)).toBe('account.offline');
  });

  it('every other answer keeps its old text on both ways in', async () => {
    const cases: [number, string, SignInFailure][] = [
      [400, 'invalid', 'invalid'],
      [429, 'too_many_requests', 'tooMany'],
      [409, 'already_signed_in', 'already'],
      [426, 'upgrade_required', 'outdated'],
      [409, 'user_taken', 'userTaken'],
      [403, 'consent_required', 'error'],
      [400, 'bad_request', 'error'],
    ];
    for (const [status, error, reason] of cases) {
      expect(await reasonFor(fail(status, error), true), error).toBe(reason);
      for (const way of ['link', 'code'] as const) expect(failureText(reason, way)).not.toMatch(/^signin\.error(Link|Code)$/);
    }
    expect(failureText('error', 'link')).toBe('signin.error');
    expect(failureText('error', 'code')).toBe('signin.error');
  });

  it('a 5xx on the first try and an answer on the retry: signed in', async () => {
    let n = 0;
    const outcome = await signInWith(
      await device(),
      createScheduler(),
      false,
      async (d) => (++n === 1 ? fail(503, 'http') : { ok: true, data: { userId: crypto.randomUUID(), device: d } }),
      async () => {},
      () => true,
    );
    expect(outcome.ok).toBe(true);
    expect(n).toBe(2);
  });
});

describe('the real request: what the browser gives back (R45)', () => {
  /** The page's fetch: a Cloudflare 1102 page twice, or a network error (a timeout of the browser) twice. */
  const stub = (kind: 'html' | 'network') =>
    vi.stubGlobal('fetch', async () => {
      if (kind === 'network') throw new TypeError('Failed to fetch');
      return new Response('<!DOCTYPE html><html><body>Error 1102 Worker exceeded resource limits</body></html>', {
        status: 503,
        headers: { 'Content-Type': 'text/html' },
      });
    });

  for (const kind of ['html', 'network'] as const) {
    it(`a ${kind === 'html' ? '1102 HTML page' : 'network error'} on the link and on the code → the new text of that way in`, async () => {
      stub(kind);
      const link = await signInWith(await device(), createScheduler(), false, (d) => redeemInvite('t'.repeat(43), d, null), async () => {}, () => true);
      const code = await signInWith(await device(), createScheduler(), false, (d) => pairDevice('ABCD2345', d), async () => {}, () => true);
      expect(link.ok || failureText(link.reason, 'link')).toBe('signin.errorLink');
      expect(code.ok || failureText(code.reason, 'code')).toBe('signin.errorCode');
    });
  }

  it('a network error while navigator.onLine is false → the old offline text', async () => {
    stub('network');
    const code = await signInWith(await device(), createScheduler(), false, (d) => pairDevice('ABCD2345', d), async () => {}, () => false);
    expect(code.ok || failureText(code.reason, 'code')).toBe('account.offline');
  });

  it('the default reads navigator.onLine', async () => {
    stub('network');
    vi.stubGlobal('navigator', { ...navigator, onLine: false, userAgent: 'test' });
    const offline = await signInWith(await device(), createScheduler(), false, (d) => pairDevice('ABCD2345', d), async () => {});
    expect(offline.ok || offline.reason).toBe('offline');
    vi.stubGlobal('navigator', { ...navigator, onLine: true, userAgent: 'test' });
    const online = await signInWith(await device(), createScheduler(), false, (d) => pairDevice('ABCD2345', d), async () => {});
    expect(online.ok || online.reason).toBe('noAnswer');
  });
});

describe('the texts of the two keys (approved 28.10.2026)', () => {
  it('signin.errorLink and signin.errorCode in tg / ru / en, letter for letter', () => {
    expect(STRINGS['signin.errorLink']).toEqual({
      tg: 'Вуруд комил нашуд: сервер ҷавоб надод. Фавран ҳамин даъватномаро дубора кушоед. Агар нашуд, аз фиристандааш даъватномаи нав дархост кунед.',
      ru: 'Вход не завершён: сервер не ответил. Сразу откройте ту же ссылку ещё раз. Если не получится — попросите новую ссылку у того, кто её прислал.',
      en: "Sign-in didn't finish: the server didn't answer. Open the same link again right away. If that doesn't work, ask whoever sent it for a new link.",
    });
    expect(STRINGS['signin.errorCode']).toEqual({
      tg: 'Вуруд комил нашуд: сервер ҷавоб надод. Фавран «Вуруд»-ро дубора фишор диҳед. Агар нашуд, аз дастгоҳе, ки вориди ҳисоб аст, коди нав гиред.',
      ru: 'Вход не завершён: сервер не ответил. Сразу нажмите «Войти» ещё раз. Если не получится — возьмите новый код на устройстве, где вход уже есть.',
      en: "Sign-in didn't finish: the server didn't answer. Tap “Sign in” again right away. If that doesn't work, get a new code on a device that's already signed in.",
    });
  });

  it('the code text names the sign-in button by its own label in every language', () => {
    const button = STRINGS['signin.submit'];
    expect(STRINGS['signin.errorCode'].tg).toContain(`«${button.tg}»`);
    expect(STRINGS['signin.errorCode'].ru).toContain(`«${button.ru}»`);
    expect(STRINGS['signin.errorCode'].en).toContain(`“${button.en}”`);
  });

  it('transfer.declinedCode (tg): the device "where you are signed in" in the approved wording', () => {
    expect(STRINGS['transfer.declinedCode'].tg).toContain('аз дастгоҳе, ки вориди ҳисоб аст');
    expect(STRINGS['transfer.declinedCode'].tg).not.toContain('ба ҳисоб ворид аст');
    expect(STRINGS['account.signedOutBy'].tg).toContain('дигар ба ҳисоб ворид нест');
  });
});
