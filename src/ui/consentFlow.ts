/**
 * Consent again on the device (stage 6a.5b, R42 item 6): which consent the screen asks for, and
 * the start of a signed-in session that learns it. Shared by MainApp and ConsentScreen.
 *
 * The source of truth is the server (/api/auth/me), not what the device remembered at sign-in:
 * a sign-in does not bring "under 16", and a copy of the device row kept in the page goes stale
 * (defect found by check 4c of 6a.5c, 27.10.2026 — a second device of an account under 16 was
 * offered the person's own consent and got a bare error).
 */
import type { FSRS } from 'ts-fsrs';
import type { Consent } from '../core/auth';
import type { MetaRow } from '../core/model';
import { NOTICE_VERSION } from '../core/notice';
import { giveConsent, whoAmI } from '../platform/api';
import type { ManaDb } from '../platform/db';
import { noteConsentProblem, setAccountState } from '../platform/repo';
import { FAILURE_TEXT, failureOf, refreshAccount } from './signIn';
import type { StringKey } from './strings';

/** self — the person's own "I agree"; parent — the screen of a parent or guardian (under 16). */
export type ConsentVariant = 'self' | 'parent';

/** The consent the screen asks for, from the device row. */
export function consentVariant(meta: MetaRow): ConsentVariant {
  return meta.account?.minor === true ? 'parent' : 'self';
}

/**
 * The start of a signed-in session (MainApp): /api/auth/me and what it brings to the device.
 * `meta` — the device row as it is now in the database, for the app to keep (not `held`, the copy
 * from the sign-in: it does not know "under 16").
 */
export async function startSignedIn(db: ManaDb, scheduler: FSRS, held: MetaRow): Promise<{ meta: MetaRow; moved: boolean; needsConsent: boolean }> {
  const { moved, needsConsent } = await refreshAccount(db, scheduler);
  return { meta: (await db.meta.get('device')) ?? held, moved, needsConsent };
}

/** What the consent screen shows, asked of the server: the variant and whether consent is still needed. */
export type ConsentState = { ok: true; variant: ConsentVariant; needsConsent: boolean; meta: MetaRow } | { ok: false; status: number };

export async function readConsentState(db: ManaDb): Promise<ConsentState> {
  const me = await whoAmI();
  if (!me.ok) return { ok: false, status: me.status };
  const meta = await setAccountState(db, { minor: me.data.minor === true, needsConsent: me.data.needsConsent === true }, NOTICE_VERSION);
  return { ok: true, variant: me.data.minor === true ? 'parent' : 'self', needsConsent: me.data.needsConsent === true, meta };
}

/** done — the consent is in (or was not needed any more); parent — ask a parent or guardian instead; error — say this. */
export type SendOutcome = { kind: 'done'; meta: MetaRow } | { kind: 'parent' } | { kind: 'error'; message: StringKey; status: number };

/**
 * Sends the consent. A 400 consent_required means the server wanted another one: the state is
 * asked again — under 16, the parent's screen; nothing needed any more, done. If the server cannot
 * be asked, the refusal goes to the debug note and the person sees the usual error line.
 */
export async function sendConsent(db: ManaDb, consent: Consent): Promise<SendOutcome> {
  const answer = await giveConsent(consent);
  if (answer.ok) {
    const meta = await setAccountState(db, { minor: consent.by === 'parent', needsConsent: false }, NOTICE_VERSION);
    return { kind: 'done', meta };
  }
  if (answer.status === 400 && answer.error === 'consent_required') {
    const state = await readConsentState(db);
    if (state.ok && !state.needsConsent) return { kind: 'done', meta: state.meta };
    if (state.ok && state.variant === 'parent' && consent.by !== 'parent') return { kind: 'parent' };
    await noteConsentProblem(db, { status: answer.status, body: JSON.stringify(answer.body ?? null), meStatus: state.ok ? 200 : state.status });
  }
  return { kind: 'error', message: FAILURE_TEXT[failureOf(answer)], status: answer.status };
}
