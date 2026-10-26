import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { BUILD } from '../core/build';
import { defaultSettings, type MetaRow, type SettingsRow } from '../core/model';
import { createScheduler, RULES_VERSION } from '../core/scheduler';
import { setUnauthorizedHandler, syncTransport } from '../platform/api';
import { getDb } from '../platform/db';
import { ensureDevice, getSettings, markAccountLost, needsRulesUpdate, putSettings, setPhrasesUnsupported, setSystemKeyboard } from '../platform/repo';
import { finishPendingWipe, onWipeSignal } from '../platform/wipe';
import { SyncEngine } from '../platform/syncClient';
import { onQueued, onSyncChanged } from '../platform/syncEvents';
import { saveSettings as storeSettings, settleUpdate } from '../platform/syncStore';
import { ConsentScreen } from './ConsentScreen';
import { DeckScreen } from './DeckScreen';
import { DeleteAccountScreen } from './DeleteAccountScreen';
import { DecksScreen } from './DecksScreen';
import { FirstRun } from './FirstRun';
import { I18nProvider, useI18n } from './i18n';
import { inviteOpened, inviteToken } from './inviteToken';
import { JoinFlow } from './JoinFlow';
import { KeyboardModeProvider } from './keyboardMode';
import { LabCards } from './LabCards';
import { noticeText } from './noticeText';
import { NoticeView } from './NoticeView';
import type { Route } from './Root';
import { RulesUpdate } from './RulesUpdate';
import { SettingsScreen } from './SettingsScreen';
import { finishTransfer, refreshAccount, settlePendingDeletion } from './signIn';
import { SignInScreen } from './SignInScreen';
import { StudyScreen } from './StudyScreen';
import { translate, type Lang } from './strings';
import { UpdateScreen } from './UpdateScreen';

type Boot =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  /**
   * `rulesUpdate`: the cards must be rebuilt with the new rules before any study (R29.7).
   * `needsUpdate`: this version is older than the account's data (sync, stage 6a.3).
   * `deletedAtStart`: a deletion of the account sent before turned out done (R42 item 8).
   */
  | { phase: 'ready'; meta: MetaRow; settings: SettingsRow | null; rulesUpdate: boolean; needsUpdate: boolean; deletedAtStart?: boolean };

const db = getDb();

/** Another window cleared the data and no "done" came (no BroadcastChannel): open afresh after this. */
const WIPE_RELOAD_FALLBACK_MS = 5000;

/** Screens the consent screen does not interrupt at start: a portion, an invitation, the sign-in. */
const CONSENT_NOT_OVER = /^#\/(study|join|signin)/;

async function load(): Promise<Boot> {
  // A clearing of the device whose page closed midway (R42 item 7): finished before the database opens.
  await finishPendingWipe();
  let meta = await ensureDevice(db);
  // A deletion of the account whose answer was lost (R42 item 8): the server tells.
  const deletedAtStart = meta.pendingDeletion !== undefined && (await settlePendingDeletion(db).catch(() => 'unknown')) === 'deleted';
  if (meta.pendingDeletion) meta = (await db.meta.get('device')) ?? meta;
  // A transfer of answers whose tab closed before the device side was done (R40): the server decides.
  if (meta.pendingTransfer && (await finishTransfer(db, createScheduler()).catch(() => false))) meta = (await db.meta.get('device')) ?? meta;
  const rulesUpdate = await needsRulesUpdate(db, meta);
  // After an update the "older version" mark of sync goes; cards left for it are rebuilt.
  const needsUpdate = await settleUpdate(db, createScheduler(), BUILD, RULES_VERSION);
  return { phase: 'ready', meta: (await db.meta.get('device')) ?? meta, settings: (await getSettings(db, meta.userId)) ?? null, rulesUpdate, needsUpdate, deletedAtStart };
}

export function MainApp({ route }: { route: Route }) {
  const [boot, setBoot] = useState<Boot>({ phase: 'loading' });

  const reload = useCallback(() => {
    load()
      .then(setBoot)
      .catch((e: unknown) => setBoot({ phase: 'error', message: e instanceof Error ? e.message : String(e) }));
  }, []);
  useEffect(reload, [reload]);

  // The session ended elsewhere (401 on any request): the account mark goes, the data stays, and
  // `accountLost` keeps the sign-in screen's explanation and the way to clear the device — after a
  // reload too (STAGE6_RESEARCH 3.3, R33 item 13). A device that was not signed in is left alone.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      void markAccountLost(db).then((meta) => {
        setBoot((b) => (b.phase === 'ready' ? { ...b, meta } : b));
        if (meta.accountLost) location.hash = '#/signin';
      });
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  // Signed in: one quiet check at start (it also keeps the session alive) that refreshes the
  // account's earlier ids; records left under one of them move to the account (R40). An account
  // that still needs consent to the current notice gets its screen, once (R42 item 6). Without
  // sign-in, or with a deletion of the account sent and not answered — no request and no sync.
  const signedIn = boot.phase === 'ready' && boot.meta.account !== undefined && boot.meta.pendingDeletion === undefined;
  useEffect(() => {
    if (!signedIn) return;
    void refreshAccount(db, createScheduler()).then(({ moved, needsConsent }) => {
      if (needsConsent && !CONSENT_NOT_OVER.test(location.hash)) location.hash = '#/consent';
      if (moved) reload();
    });
  }, [signedIn, reload]);

  // The account was found deleted at start: its screen, on this device only.
  const deletedAtStart = boot.phase === 'ready' && boot.deletedAtStart === true;
  useEffect(() => {
    if (deletedAtStart) location.hash = '#/account/delete';
  }, [deletedAtStart]);

  // "A newer version is needed" (stage 6a.3): from sync, or another window upgraded the database.
  // While a portion is open, the screen waits until the current card is saved (the next record).
  const [update, setUpdate] = useState<'data' | 'otherTab' | null>(null);
  const [updateShown, setUpdateShown] = useState(false);
  const studying = route.name === 'study';
  useEffect(() => {
    if (boot.phase === 'ready' && boot.needsUpdate) setUpdate('data');
  }, [boot]);
  useEffect(() => {
    if (!update || updateShown) return;
    if (!studying) {
      setUpdateShown(true);
      return;
    }
    return onQueued(() => setUpdateShown(true));
  }, [update, updateShown, studying]);
  // Another window clears the data of this device (R42 item 7): let the database go, say so, and
  // open afresh when it is done. Without the signal the delete itself tells (versionchange to no version).
  const [wipedElsewhere, setWipedElsewhere] = useState(false);
  useEffect(() => {
    const otherWindow = (event: IDBVersionChangeEvent) => {
      db.close();
      if (event.newVersion === null) {
        setWipedElsewhere(true);
        setTimeout(() => location.reload(), WIPE_RELOAD_FALLBACK_MS);
        return;
      }
      setUpdate('otherTab');
      setUpdateShown(true);
    };
    db.on('versionchange', otherWindow);
    const off = onWipeSignal((message) => {
      if (message === 'done') {
        location.reload();
        return;
      }
      db.close();
      setWipedElsewhere(true);
    });
    return () => {
      db.on('versionchange').unsubscribe(otherWindow);
      off();
    };
  }, []);

  // Sync runs while signed in and this version is current; a consent given starts it again.
  const [syncEpoch, setSyncEpoch] = useState(0);
  useEffect(() => {
    if (!signedIn || update) return;
    const engine = new SyncEngine({ db, scheduler: createScheduler(), transport: syncTransport, build: BUILD, onNeedsUpdate: () => setUpdate('data') });
    engine.start();
    return () => engine.stop();
  }, [signedIn, update, syncEpoch]);

  // Settings or records came from the server: screens count again; the settings apply at once,
  // except in an open portion — there when it is left (its plan must not be rebuilt, R39).
  const [synced, setSynced] = useState(0);
  const heldSettings = useRef<SettingsRow | null>(null);
  const userId = boot.phase === 'ready' ? boot.meta.userId : null;
  useEffect(() => {
    if (!userId) return;
    return onSyncChanged(() => {
      setSynced((v) => v + 1);
      void getSettings(db, userId).then((s) => {
        if (!s) return;
        if (location.hash.startsWith('#/study')) heldSettings.current = s;
        else setBoot((b) => (b.phase === 'ready' ? { ...b, settings: s } : b));
      });
    });
  }, [userId]);
  useEffect(() => {
    if (studying || !heldSettings.current) return;
    const s = heldSettings.current;
    heldSettings.current = null;
    setBoot((b) => (b.phase === 'ready' ? { ...b, settings: s } : b));
  }, [studying]);

  const lang = boot.phase === 'ready' ? boot.settings?.uiLang : undefined;
  useEffect(() => {
    if (lang) document.documentElement.lang = lang;
  }, [lang]);

  if (wipedElsewhere) {
    return (
      <main id="app">
        <p role="status">{translate(boot.phase === 'ready' ? (boot.settings?.uiLang ?? 'tg') : 'tg', 'device.wipedElsewhere')}</p>
      </main>
    );
  }
  if (boot.phase === 'loading') return <main id="app" aria-busy="true" />;
  if (boot.phase === 'error') {
    return (
      <main id="app">
        <p className="hint err">{translate('ru', 'common.dbError', { error: boot.message })}</p>
      </main>
    );
  }

  const { meta, settings, rulesUpdate, needsUpdate } = boot;
  if (!settings) {
    const choose = async (l: Lang) => {
      const s = defaultSettings(meta.userId, l, new Date());
      await putSettings(db, s);
      setBoot({ phase: 'ready', meta, settings: s, rulesUpdate, needsUpdate });
    };
    return <FirstRun onChoose={(l) => void choose(l)} />;
  }

  const blocked = rulesUpdate || (update !== null && updateShown);

  const saveSettings = async (patch: Partial<Pick<SettingsRow, 'uiLang' | 'meaningLang' | 'newPerDay' | 'biasing'>>) => {
    // Switching the hints on again forgets that this browser once rejected them.
    // The flag lives in the database (a study round may have set it since boot): always clear it.
    const freshMeta = patch.biasing === true ? await setPhrasesUnsupported(db, false) : meta;
    const s = { ...settings, ...patch, updatedAt: new Date() };
    await storeSettings(db, s);
    setBoot({ phase: 'ready', meta: freshMeta, settings: s, rulesUpdate, needsUpdate });
  };

  const saveSystemKeyboard = async (on: boolean) => {
    const freshMeta = await setSystemKeyboard(db, on);
    setBoot({ phase: 'ready', meta: freshMeta, settings, rulesUpdate, needsUpdate });
  };

  // Sign-in moves the settings to the account's id (repo.markSignedIn): read them again.
  const accountChanged = async (freshMeta: MetaRow) => {
    const s = (await getSettings(db, freshMeta.userId)) ?? settings;
    setBoot({ phase: 'ready', meta: freshMeta, settings: s, rulesUpdate, needsUpdate });
  };

  return (
    <I18nProvider lang={settings.uiLang} meaningLang={settings.meaningLang}>
      <KeyboardModeProvider systemKeyboard={meta.systemKeyboard === true}>
        <Shell route={route}>
          {update && updateShown && <UpdateScreen reason={update} />}
          {!(update && updateShown) && rulesUpdate && <RulesUpdate db={db} meta={meta} onDone={reload} />}
          {!blocked && route.name === 'deck' && <DeckScreen db={db} deckId={route.deckId} userId={meta.userId} newPerDay={settings.newPerDay} synced={synced} />}
          {!blocked && route.name === 'study' && (
            <StudyScreen
              key={`${route.deckId}${route.addAnyway ? '/new' : ''}`}
              db={db}
              deckId={route.deckId}
              actor={meta}
              newPerDay={settings.newPerDay}
              biasing={settings.biasing === true}
              addAnyway={route.addAnyway === true}
            />
          )}
          {!blocked && route.name === 'settings' && (
            <SettingsScreen
              db={db}
              meta={meta}
              newPerDay={settings.newPerDay}
              biasing={settings.biasing === true}
              systemKeyboard={meta.systemKeyboard === true}
              onSystemKeyboard={(on) => void saveSystemKeyboard(on)}
              onChange={(p) => void saveSettings(p)} onDataReplaced={reload}
              onAccountChange={(m) => void accountChanged(m)} />
          )}
          {!blocked && route.name === 'decks' && <DecksScreen db={db} />}
          {!blocked && route.name === 'join' && (
            <JoinFlow key={inviteOpened()} db={db} meta={meta} token={inviteToken()} onSignedIn={(m) => void accountChanged(m)} />
          )}
          {!blocked && route.name === 'signin' && (
            <SignInScreen db={db} meta={meta} onSignedIn={(m) => void accountChanged(m)} />
          )}
          {!(update && updateShown) && route.name === 'privacy' && <NoticeView section={noticeText(settings.uiLang).notice} />}
          {!blocked && route.name === 'consent' && (
            <ConsentScreen
              db={db}
              meta={meta}
              onConsented={(m) => {
                void accountChanged(m);
                setSyncEpoch((n) => n + 1);
              }}
            />
          )}
          {!blocked && route.name === 'accountDelete' && (
            <DeleteAccountScreen
              db={db}
              meta={meta}
              deleted={boot.deletedAtStart === true}
              onMetaChange={(m) => void accountChanged(m)}
              onNeedsUpdate={() => setUpdate('data')}
            />
          )}
          {!(update && updateShown) && route.name === 'labCards' && <LabCards db={db} />}
        </Shell>
      </KeyboardModeProvider>
    </I18nProvider>
  );
}

function Shell({ route, children }: { route: Route; children: ReactNode }) {
  const { t } = useI18n();
  const current = (on: boolean) => (on ? ('page' as const) : undefined);
  return (
    <main id="app">
      <header className="top">
        <a className="brand" href="#/">
          {t('app.name')}
        </a>
        <nav className="top-actions">
          <a className="ghost" href="#/" aria-current={current(route.name === 'decks' || route.name === 'deck' || route.name === 'study')}>
            {t('nav.decks')}
          </a>
          <a className="ghost" href="#/settings" aria-current={current(route.name === 'settings')}>
            {t('nav.settings')}
          </a>
        </nav>
      </header>
      {children}
    </main>
  );
}
