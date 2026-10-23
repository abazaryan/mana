import { useState } from 'react';
import { readSignInInput } from '../core/auth';
import type { MetaRow } from '../core/model';
import { pairDevice } from '../platform/api';
import type { ManaDb } from '../platform/db';
import { useI18n } from './i18n';
import { setInviteToken } from './inviteToken';
import { FAILURE_TEXT, signInWith, type SignInFailure } from './signIn';

interface Props {
  db: ManaDb;
  meta: MetaRow;
  /** The session was ended elsewhere (401): say so above the field. */
  signedOutBy: boolean;
  onSignedIn(meta: MetaRow): void;
}

/**
 * Sign-in without an opened link (STAGE6_RESEARCH 3.2, 2.3): one field for a pasted invitation
 * link or a pairing code from another signed-in device. The system keyboard is used here
 * (Gboard on the phone), not the app's own.
 */
export function SignInScreen({ db, meta, signedOutBy, onSignedIn }: Props) {
  const { t } = useI18n();
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<SignInFailure | null>(meta.account ? 'already' : null);
  const [done, setDone] = useState(false);

  const submit = async () => {
    const input = readSignInInput(value);
    if (input.kind === 'bad') {
      setFailure('invalid');
      return;
    }
    if (input.kind === 'invite') {
      setInviteToken(input.token);
      location.hash = '#/join';
      return;
    }
    setBusy(true);
    setFailure(null);
    const outcome = await signInWith(db, (device) => pairDevice(input.code, device));
    setBusy(false);
    if (!outcome.ok) {
      setFailure(outcome.reason);
      return;
    }
    setDone(true);
    onSignedIn(outcome.meta);
  };

  if (done) {
    return (
      <section>
        <h1>{t('signin.title')}</h1>
        <p role="status">{t('signin.done')}</p>
        <a className="primary big center mt" href="#/">
          {t('nav.decks')}
        </a>
      </section>
    );
  }

  return (
    <section>
      <h1>{t('signin.title')}</h1>
      {signedOutBy && !meta.account && <p role="status">{t('account.signedOutBy')}</p>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy && !meta.account) void submit();
        }}
      >
        <label className="field">
          <span>{t('signin.label')}</span>
          <input
            type="text"
            value={value}
            disabled={busy || meta.account !== undefined}
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            inputMode="text"
            enterKeyHint="go"
            onChange={(e) => {
              setValue(e.target.value);
              setFailure(null);
            }}
          />
        </label>
        <p className="hint">{t('signin.hint')}</p>
        {failure && (
          <p className={failure === 'already' || failure === 'hasAnswers' ? 'mt' : 'hint err'} role="alert">
            {t(FAILURE_TEXT[failure])}
          </p>
        )}
        <button className="primary big mt" type="submit" disabled={busy || value.trim() === '' || meta.account !== undefined}>
          {busy ? t('common.loading') : t('signin.submit')}
        </button>
      </form>
      <p className="note">
        <a href="#/privacy">{t('account.privacy')}</a>
      </p>
    </section>
  );
}
