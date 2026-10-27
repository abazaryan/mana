/**
 * Consent again right after a sign-in, without a reload (defect found by check 4c of 6a.5c,
 * 27.10.2026): the consent screen must ask a parent or guardian for an account under 16 on every
 * way in — a device invitation (also the recovery link of recover.ts), a pairing code, an account
 * invitation — and the person's own consent for an adult; the server takes it. The device runs on
 * fake-indexeddb, the server is the Worker over the SQLite stand-in; the page's fetch is routed to
 * it with the session cookie, as a browser would send it.
 */
import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Consent } from '../src/core/auth';
import { NOTICE_VERSION } from '../src/core/notice';
import { createScheduler } from '../src/core/scheduler';
import { giveConsent, pairDevice, redeemInvite } from '../src/platform/api';
import { ManaDb } from '../src/platform/db';
import { ensureDevice } from '../src/platform/repo';
import { consentVariant, readConsentState, sendConsent, startSignedIn } from '../src/ui/consentFlow';
import { signInWith } from '../src/ui/signIn';
import { handleApi, ROUTES } from '../worker/api';
import { INVITE_TTL, ORIGIN } from '../worker/config';
import { send, signedIn, world, type World } from '../worker/test/accounts';
import { newToken, sha256Hex } from '../worker/tokens';

const open: ManaDb[] = [];
afterEach(async () => {
  vi.unstubAllGlobals();
  for (const db of open.splice(0)) {
    db.close();
    await db.delete();
  }
});

/** The page's fetch goes to the Worker; the session cookie is kept like a browser keeps it. */
function browser(w: World): void {
  let cookie = '';
  vi.stubGlobal('fetch', async (input: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    headers.set('Sec-Fetch-Site', 'same-origin');
    if (cookie) headers.set('Cookie', cookie);
    const response = await handleApi(new Request(`${ORIGIN}${input}`, { ...init, headers }), w.env, ROUTES, Date.now());
    const set = response.headers.get('Set-Cookie');
    if (set) cookie = /Max-Age=0/.test(set) ? '' : set.split(';')[0]!;
    return response;
  });
}

async function device(): Promise<ManaDb> {
  const db = new ManaDb(`consent-${crypto.randomUUID()}`);
  open.push(db);
  await ensureDevice(db);
  return db;
}

async function invite(w: World, kind: 'account' | 'device', opts: { userId?: string; minor?: boolean } = {}): Promise<string> {
  const token = newToken();
  w.db.sqlite
    .prepare('INSERT INTO invites (token_hash, kind, user_id, label, minor, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(await sha256Hex(token), kind, opts.userId ?? null, kind === 'account' ? 'test-consent' : null, opts.minor ? 1 : 0, Date.now(), Date.now() + INVITE_TTL);
  return token;
}

const PARENT: Consent = { version: NOTICE_VERSION, by: 'parent', parentName: 'Parent Name', parentAgreed: true };
const SELF: Consent = { version: NOTICE_VERSION, by: 'self' };

type Way = 'device invitation (recover.ts)' | 'pairing code' | 'account invitation';
const WAYS: Way[] = ['device invitation (recover.ts)', 'pairing code', 'account invitation'];

/**
 * An account whose consent is older than the current notice, and this device signed in to it by
 * `way`. Returns the device and the device row the app keeps after the sign-in (what the sign-in
 * screens hand to MainApp).
 */
async function signInBy(w: World, way: Way, minor: boolean) {
  const db = await device();
  let userId: string;
  let outcome;
  if (way === 'account invitation') {
    const token = await invite(w, 'account', { minor });
    outcome = await signInWith(db, createScheduler(), false, (d) => redeemInvite(token, d, minor ? PARENT : SELF));
    expect(outcome.ok).toBe(true);
    userId = outcome.ok ? outcome.meta.userId : '';
    // A newer notice came after this consent (as for test-edge-minor with v1).
    w.db.sqlite.prepare('UPDATE consents SET notice_version = ? WHERE user_id = ?').run(NOTICE_VERSION - 1, userId);
  } else {
    const first = await signedIn(w, undefined, Date.now(), { minor, consent: { by: minor ? 'parent' : 'self', version: NOTICE_VERSION - 1 } });
    userId = first.userId;
    if (way === 'pairing code') {
      const { code } = (await (await send(w, '/api/auth/pairing-code', { cookie: first.cookie, now: Date.now() })).json()) as { code: string };
      outcome = await signInWith(db, createScheduler(), false, (d) => pairDevice(code, d));
    } else {
      const token = await invite(w, 'device', { userId });
      outcome = await signInWith(db, createScheduler(), false, (d) => redeemInvite(token, d, null));
    }
  }
  expect(outcome.ok).toBe(true);
  if (!outcome.ok) throw new Error('sign-in failed');
  return { db, userId, held: outcome.meta };
}

const consentRows = (w: World, userId: string) =>
  w.db.sqlite.prepare('SELECT notice_version, given_by FROM consents WHERE user_id = ? ORDER BY given_at, rowid').all(userId) as { notice_version: number; given_by: string }[];

for (const minor of [true, false]) {
  describe(`consent again right after the sign-in, without a reload — ${minor ? 'under 16' : 'adult'}`, () => {
    for (const way of WAYS) {
      it(`${way}: the screen asks for the ${minor ? "parent's" : "person's own"} consent and the server takes it`, async () => {
        const w = world();
        browser(w);
        const { db, userId, held } = await signInBy(w, way, minor);

        // The start of the signed-in session (MainApp), then the consent screen — no reload in between.
        const start = await startSignedIn(db, createScheduler(), held);
        expect(start.needsConsent).toBe(true);
        expect(consentVariant(start.meta)).toBe(minor ? 'parent' : 'self');

        const answer = await giveConsent(consentVariant(start.meta) === 'parent' ? PARENT : SELF);
        expect(answer.ok).toBe(true);
        expect(consentRows(w, userId).at(-1)).toEqual({ notice_version: NOTICE_VERSION, given_by: minor ? 'parent' : 'self' });
      });

      it(`${way}: the consent screen asks the server, even with the page's copy from the sign-in`, async () => {
        const w = world();
        browser(w);
        const { db, userId } = await signInBy(w, way, minor);
        // The screen opens on the copy the sign-in left (no start of the session in between).
        const state = await readConsentState(db);
        expect(state).toMatchObject({ ok: true, variant: minor ? 'parent' : 'self', needsConsent: true });
        expect(state.ok && state.meta.account?.minor).toBe(minor);
        const outcome = await sendConsent(db, minor ? PARENT : SELF);
        expect(outcome.kind).toBe('done');
        expect(outcome.kind === 'done' && outcome.meta.sync?.needsConsent).toBeUndefined();
        expect(consentRows(w, userId).at(-1)).toEqual({ notice_version: NOTICE_VERSION, given_by: minor ? 'parent' : 'self' });
      });
    }
  });
}

describe('a consent the server refuses (400 consent_required)', () => {
  it("under 16, the person's own consent sent: me is asked again and the parent's screen follows; then it is taken", async () => {
    const w = world();
    browser(w);
    const { db, userId } = await signInBy(w, 'device invitation (recover.ts)', true);
    expect(await sendConsent(db, SELF)).toEqual({ kind: 'parent' });
    expect(consentRows(w, userId)).toHaveLength(1);
    expect((await db.meta.get('device'))?.consentProblem).toBeUndefined();
    expect((await sendConsent(db, PARENT)).kind).toBe('done');
    expect(consentRows(w, userId).at(-1)).toEqual({ notice_version: NOTICE_VERSION, given_by: 'parent' });
  });

  it('me cannot be asked: the usual error line, and the refusal (status, body) in the debug note', async () => {
    const w = world();
    browser(w);
    const { db } = await signInBy(w, 'pairing code', true);
    const real = globalThis.fetch;
    vi.stubGlobal('fetch', async (input: string, init?: RequestInit) => (input.startsWith('/api/auth/me') ? Promise.reject(new TypeError('offline')) : real(input, init)));
    expect(await sendConsent(db, SELF)).toMatchObject({ kind: 'error', message: 'signin.error', status: 400 });
    expect((await db.meta.get('device'))?.consentProblem).toMatchObject({ status: 400, body: '{"error":"consent_required"}', meStatus: 0 });
  });
});
