import { useEffect, useState } from 'react';
import type { Consent } from '../core/auth';
import type { MetaRow } from '../core/model';
import { NOTICE_VERSION } from '../core/notice';
import { giveConsent } from '../platform/api';
import type { ManaDb } from '../platform/db';
import { setAccountState } from '../platform/repo';
import { useI18n } from './i18n';
import { noticeText } from './noticeText';
import { NoticeView } from './NoticeView';
import { ParentConsent } from './ParentConsent';
import { FAILURE_TEXT, failureOf } from './signIn';
import type { StringKey } from './strings';

interface Props {
  db: ManaDb;
  meta: MetaRow;
  /** The consent is in: sync may go again (MainApp starts the engine afresh). */
  onConsented(meta: MetaRow): void;
}

/**
 * Consent again to a new version of the notice (stage 6a.5b, R42 item 6; docs/STATUS.md, stage 6a
 * rules): "the text has changed", the notice of the current version, "I agree" — or, for an
 * account under 16, the screen of a parent or guardian. The age question is not asked again.
 * "Later" — the app works on the device, sync waits; the Account section keeps the way here.
 */
export function ConsentScreen({ db, meta, onConsented }: Props) {
  const { t, lang } = useI18n();
  const text = noticeText(lang);
  const minor = meta.account?.minor === true;
  const [step, setStep] = useState<'notice' | 'parent' | 'sending' | 'done'>('notice');
  const [error, setError] = useState<StringKey | null>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step]);

  if (!meta.account) {
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
    const answer = await giveConsent(consent);
    if (!answer.ok) {
      if (answer.status !== 401) setError(FAILURE_TEXT[failureOf(answer)]);
      setStep(minor ? 'parent' : 'notice');
      return;
    }
    onConsented(await setAccountState(db, { minor, needsConsent: false }, NOTICE_VERSION));
    setStep('done');
  };

  if (step === 'sending') return <section aria-busy="true">{t('common.loading')}</section>;
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
        onClick={() => (minor ? setStep('parent') : void send({ version: NOTICE_VERSION, by: 'self' }))}
      >
        {t('join.agree')}
      </button>
      <a className="secondary center mt" href="#/">
        {t('consent.later')}
      </a>
    </section>
  );
}
