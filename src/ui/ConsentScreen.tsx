import { useCallback, useEffect, useState } from 'react';
import type { Consent } from '../core/auth';
import type { MetaRow } from '../core/model';
import { NOTICE_VERSION } from '../core/notice';
import type { ManaDb } from '../platform/db';
import { readConsentState, sendConsent, type ConsentVariant } from './consentFlow';
import { useI18n } from './i18n';
import { noticeText } from './noticeText';
import { NoticeView } from './NoticeView';
import { ParentConsent } from './ParentConsent';
import type { StringKey } from './strings';

interface Props {
  db: ManaDb;
  meta: MetaRow;
  /** The device row changed (under 16 learned from the server, or the consent is in); after a consent sync may go again. */
  onMetaChange(meta: MetaRow): void;
  onConsented(meta: MetaRow): void;
}

type Step = 'asking' | 'offline' | 'notice' | 'parent' | 'sending' | 'done';

/**
 * Consent again to a new version of the notice (stage 6a.5b, R42 item 6; docs/STATUS.md, stage 6a
 * rules): "the text has changed", the notice of the current version, "I agree" — or, for an
 * account under 16, the screen of a parent or guardian. The age question is not asked again.
 * "Later" — the app works on the device, sync waits; the Account section keeps the way here.
 * Which of the two, the server says when the screen opens (consentFlow.ts), not the page's copy
 * of the device row.
 */
export function ConsentScreen({ db, meta, onMetaChange, onConsented }: Props) {
  const { t, lang } = useI18n();
  const text = noticeText(lang);
  const [step, setStep] = useState<Step>('asking');
  const [variant, setVariant] = useState<ConsentVariant>('self');
  const [error, setError] = useState<StringKey | null>(null);
  const signedIn = meta.account !== undefined;

  // Asked once, when the screen opens (onMetaChange is a new function on every render of MainApp).
  const ask = useCallback(async () => {
    setStep('asking');
    const state = await readConsentState(db);
    if (!state.ok) {
      // A 401 is handled by the app (the sign-in screen); anything else — try again.
      if (state.status !== 401) setStep('offline');
      return;
    }
    onMetaChange(state.meta);
    setVariant(state.variant);
    setStep(state.needsConsent ? 'notice' : 'done');
  }, [db]);

  useEffect(() => {
    if (signedIn) void ask();
  }, [signedIn, ask]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step]);

  if (!signedIn) {
    return (
      <section>
        <p className="hint">{t('account.signedOut')}</p>
        <a className="secondary center mt" href="#/">
          {t('nav.decks')}
        </a>
      </section>
    );
  }

  const send = async (consent: Consent) => {
    setStep('sending');
    setError(null);
    const outcome = await sendConsent(db, consent);
    if (outcome.kind === 'done') {
      onConsented(outcome.meta);
      setStep('done');
    } else if (outcome.kind === 'parent') {
      // The server wants a parent's or guardian's consent: its screen says why (join.parentHint).
      setVariant('parent');
      setStep('parent');
    } else {
      if (outcome.status !== 401) setError(outcome.message);
      setStep(variant === 'parent' ? 'parent' : 'notice');
    }
  };

  if (step === 'asking' || step === 'sending') return <section aria-busy="true">{t('common.loading')}</section>;
  if (step === 'offline') {
    return (
      <section>
        <p className="hint err" role="alert">
          {t('account.offline')}
        </p>
        <button className="secondary mt" type="button" onClick={() => void ask()}>
          {t('common.retry')}
        </button>
      </section>
    );
  }
  if (step === 'done') {
    return (
      <section>
        <p role="status">{t('consent.done')}</p>
        <a className="primary big center mt" href="#/">
          {t('nav.decks')}
        </a>
      </section>
    );
  }
  const failed = error && (
    <p className="hint err" role="alert">
      {t(error)}
    </p>
  );
  if (step === 'parent') {
    return (
      <>
        {failed}
        <ParentConsent section={text.parent} submitLabel="join.agree" onSubmit={(consent) => void send(consent)} />
      </>
    );
  }
  return (
    <section>
      <p className="prompt">{t('consent.changed')}</p>
      <NoticeView section={text.notice} />
      {failed}
      <button
        className="primary big mt"
        type="button"
        onClick={() => (variant === 'parent' ? setStep('parent') : void send({ version: NOTICE_VERSION, by: 'self' }))}
      >
        {t('join.agree')}
      </button>
      <a className="secondary center mt" href="#/">
        {t('consent.later')}
      </a>
    </section>
  );
}
