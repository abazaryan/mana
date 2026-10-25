import { useEffect, useState } from 'react';
import { firstJoinStep, PARENT_NAME_MAX, cleanTypedName, stepAfterNotice, type Consent, type JoinStep } from '../core/auth';
import type { MetaRow } from '../core/model';
import { NOTICE_VERSION } from '../core/notice';
import { createScheduler } from '../core/scheduler';
import { inviteInfo, redeemInvite } from '../platform/api';
import type { ManaDb } from '../platform/db';
import { hasLocalAnswers } from '../platform/repo';
import { useI18n } from './i18n';
import { forgetInviteToken } from './inviteToken';
import { noticeText } from './noticeText';
import { NoticeBlocks, NoticeView } from './NoticeView';
import { FAILURE_TEXT, failureOf, signInWith, type SignInFailure } from './signIn';
import { TransferDone, TransferQuestion } from './TransferQuestion';

type Screen =
  | { name: 'checking' }
  | { name: 'step'; step: JoinStep; minor: boolean }
  | { name: 'question'; consent: Consent | null }
  | { name: 'declined' }
  | { name: 'sending'; transfer: boolean }
  | { name: 'failed'; reason: SignInFailure }
  | { name: 'done'; queued: number; transfer: boolean };

interface Props {
  db: ManaDb;
  meta: MetaRow;
  token: string | null;
  onSignedIn(meta: MetaRow): void;
}

/**
 * An opened invitation (STAGE6_RESEARCH 3.1, 8.2, R37): the data notice and "I agree" → "Are you
 * 16?" → a parent's or guardian's consent on this device for a "no" or an invitation marked
 * under 16 → on a device with answers, "add this device's progress?" (R40) → sign-in. The
 * question comes before the request: "no" spends nothing, the same link works later.
 */
export function JoinFlow({ db, meta, token, onSignedIn }: Props) {
  const { t, lang } = useI18n();
  const [screen, setScreen] = useState<Screen>(
    meta.account ? { name: 'failed', reason: 'already' } : token ? { name: 'checking' } : { name: 'failed', reason: 'invalid' },
  );
  const [kind, setKind] = useState<'account' | 'device'>('account');
  const [parentName, setParentName] = useState('');
  const [parentAgreed, setParentAgreed] = useState(false);
  const [missing, setMissing] = useState(false);
  const text = noticeText(lang);

  useEffect(() => {
    if (screen.name !== 'checking' || !token) return;
    let live = true;
    void inviteInfo(token).then((result) => {
      if (!live) return;
      if (result.ok) {
        setKind(result.data.kind);
        setScreen({ name: 'step', step: firstJoinStep(result.data.kind), minor: result.data.minor });
      } else setScreen({ name: 'failed', reason: failureOf(result) });
    });
    return () => {
      live = false;
    };
  }, [screen.name, token]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screen]);

  /** After the consent steps: a device with answers is asked first. */
  const submit = async (consent: Consent | null) => {
    if (await hasLocalAnswers(db)) setScreen({ name: 'question', consent });
    else void send(consent, false);
  };

  const send = async (consent: Consent | null, transfer: boolean) => {
    if (!token) return;
    setScreen({ name: 'sending', transfer });
    const outcome = await signInWith(db, createScheduler(), transfer, (device, local) =>
      redeemInvite(token, device, consent, local === null ? null : kind === 'account' ? { localUserId: local } : { formerUserId: local }),
    );
    if (!outcome.ok) {
      setScreen({ name: 'failed', reason: outcome.reason });
      return;
    }
    forgetInviteToken();
    setScreen({ name: 'done', queued: outcome.queued, transfer });
    onSignedIn(outcome.meta);
  };

  const parentSubmit = () => {
    const name = cleanTypedName(parentName, PARENT_NAME_MAX);
    if (!name || !parentAgreed) {
      setMissing(true);
      return;
    }
    void submit({ version: NOTICE_VERSION, by: 'parent', parentName: name, parentAgreed: true });
  };

  if (screen.name === 'checking' || (screen.name === 'sending' && !screen.transfer)) {
    return <section aria-busy="true">{t('common.loading')}</section>;
  }
  if (screen.name === 'sending') {
    return (
      <section aria-busy="true">
        <h1>{t('join.title')}</h1>
        <p role="status">{t('transfer.saving')}</p>
      </section>
    );
  }
  if (screen.name === 'question') {
    const { consent } = screen;
    return (
      <section>
        <h1>{t('join.title')}</h1>
        <TransferQuestion db={db} meta={meta} onYes={() => void send(consent, true)} onNo={() => setScreen({ name: 'declined' })} />
      </section>
    );
  }
  if (screen.name === 'failed' || screen.name === 'declined') {
    const quiet = screen.name === 'declined' || screen.reason === 'already';
    return (
      <section>
        <h1>{t('join.title')}</h1>
        <p className={quiet ? '' : 'hint err'} role="alert">
          {t(screen.name === 'declined' ? 'transfer.declined' : FAILURE_TEXT[screen.reason])}
        </p>
        <p className="note">
          <a href="#/">{t('nav.decks')}</a>
        </p>
      </section>
    );
  }
  if (screen.name === 'done') {
    return (
      <section>
        <h1>{t('join.title')}</h1>
        {screen.transfer ? <TransferDone db={db} queued={screen.queued} /> : <p role="status">{t('signin.done')}</p>}
        <a className="primary big center mt" href="#/">
          {t('nav.decks')}
        </a>
      </section>
    );
  }

  const { step, minor } = screen;
  if (step === 'notice') {
    return (
      <section>
        <NoticeView section={text.notice} />
        <button className="primary big mt" type="button" onClick={() => setScreen({ name: 'step', step: stepAfterNotice(minor), minor })}>
          {t('join.agree')}
        </button>
      </section>
    );
  }
  if (step === 'age') {
    return (
      <section>
        <h1>{t('join.title')}</h1>
        <p className="prompt">{t('join.age')}</p>
        <p className="hint">{t('join.ageHint')}</p>
        <div className="two mt">
          <button className="primary" type="button" onClick={() => void submit({ version: NOTICE_VERSION, by: 'self' })}>
            {t('voice.yes')}
          </button>
          <button className="secondary" type="button" onClick={() => setScreen({ name: 'step', step: 'parent', minor })}>
            {t('voice.no')}
          </button>
        </div>
      </section>
    );
  }
  if (step === 'parent') {
    const field = text.parent.blocks.find((b) => b.kind === 'field');
    const check = text.parent.blocks.find((b) => b.kind === 'check');
    return (
      <section className="notice">
        <p className="hint">{t('join.parentHint')}</p>
        <h1>{text.parent.title}</h1>
        <NoticeBlocks blocks={text.parent.blocks} />
        <label className="field">
          <span>{field?.kind === 'field' ? field.label : ''}</span>
          <input
            type="text"
            value={parentName}
            maxLength={PARENT_NAME_MAX}
            autoComplete="name"
            onChange={(e) => {
              setParentName(e.target.value);
              setMissing(false);
            }}
          />
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={parentAgreed}
            onChange={(e) => {
              setParentAgreed(e.target.checked);
              setMissing(false);
            }}
          />
          <span>{check?.kind === 'check' ? check.label : ''}</span>
        </label>
        {missing && (
          <p className="hint err" role="alert">
            {t('join.parentMissing')}
          </p>
        )}
        <button className="primary big mt" type="button" onClick={parentSubmit}>
          {t('join.signIn')}
        </button>
      </section>
    );
  }
  return (
    <section>
      <h1>{t('join.title')}</h1>
      <p>{t('join.deviceInvite')}</p>
      <button className="primary big mt" type="button" onClick={() => void submit(null)}>
        {t('join.signIn')}
      </button>
    </section>
  );
}
