import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { defaultSettings, type MetaRow, type SettingsRow } from '../core/model';
import { getDb } from '../platform/db';
import { ensureDevice, getSettings, needsRulesUpdate, putSettings, setPhrasesUnsupported, setSystemKeyboard } from '../platform/repo';
import { DeckScreen } from './DeckScreen';
import { DecksScreen } from './DecksScreen';
import { FirstRun } from './FirstRun';
import { I18nProvider, useI18n } from './i18n';
import { KeyboardModeProvider } from './keyboardMode';
import type { Route } from './Root';
import { RulesUpdate } from './RulesUpdate';
import { SettingsScreen } from './SettingsScreen';
import { StudyScreen } from './StudyScreen';
import { translate, type Lang } from './strings';

type Boot =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  /** `rulesUpdate`: the cards must be rebuilt with the new rules before any study (Р29.7). */
  | { phase: 'ready'; meta: MetaRow; settings: SettingsRow | null; rulesUpdate: boolean };

const db = getDb();

async function load(): Promise<Boot> {
  const meta = await ensureDevice(db);
  const rulesUpdate = await needsRulesUpdate(db, meta);
  return { phase: 'ready', meta: (await db.meta.get('device')) ?? meta, settings: (await getSettings(db, meta.userId)) ?? null, rulesUpdate };
}

export function MainApp({ route }: { route: Route }) {
  const [boot, setBoot] = useState<Boot>({ phase: 'loading' });

  const reload = useCallback(() => {
    load()
      .then(setBoot)
      .catch((e: unknown) => setBoot({ phase: 'error', message: e instanceof Error ? e.message : String(e) }));
  }, []);
  useEffect(reload, [reload]);

  const lang = boot.phase === 'ready' ? boot.settings?.uiLang : undefined;
  useEffect(() => {
    if (lang) document.documentElement.lang = lang;
  }, [lang]);

  if (boot.phase === 'loading') return <main id="app" aria-busy="true" />;
  if (boot.phase === 'error') {
    return (
      <main id="app">
        <p className="hint err">{translate('ru', 'common.dbError', { error: boot.message })}</p>
      </main>
    );
  }

  const { meta, settings, rulesUpdate } = boot;
  if (!settings) {
    const choose = async (l: Lang) => {
      const s = defaultSettings(meta.userId, l, new Date());
      await putSettings(db, s);
      setBoot({ phase: 'ready', meta, settings: s, rulesUpdate });
    };
    return <FirstRun onChoose={(l) => void choose(l)} />;
  }

  const saveSettings = async (patch: Partial<Pick<SettingsRow, 'uiLang' | 'meaningLang' | 'newPerDay' | 'biasing'>>) => {
    // Switching the hints on again forgets that this browser once rejected them.
    // The flag lives in the database (a study round may have set it since boot): always clear it.
    const freshMeta = patch.biasing === true ? await setPhrasesUnsupported(db, false) : meta;
    const s = { ...settings, ...patch, updatedAt: new Date() };
    await putSettings(db, s);
    setBoot({ phase: 'ready', meta: freshMeta, settings: s, rulesUpdate });
  };

  const saveSystemKeyboard = async (on: boolean) => {
    const freshMeta = await setSystemKeyboard(db, on);
    setBoot({ phase: 'ready', meta: freshMeta, settings, rulesUpdate });
  };

  return (
    <I18nProvider lang={settings.uiLang} meaningLang={settings.meaningLang}>
      <KeyboardModeProvider systemKeyboard={meta.systemKeyboard === true}>
        <Shell route={route}>
          {rulesUpdate && <RulesUpdate db={db} meta={meta} onDone={reload} />}
          {!rulesUpdate && route.name === 'deck' && <DeckScreen db={db} deckId={route.deckId} userId={meta.userId} newPerDay={settings.newPerDay} />}
          {!rulesUpdate && route.name === 'study' && (
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
          {!rulesUpdate && route.name === 'settings' && (
            <SettingsScreen
              db={db}
              meta={meta}
              newPerDay={settings.newPerDay}
              biasing={settings.biasing === true}
              systemKeyboard={meta.systemKeyboard === true}
              onSystemKeyboard={(on) => void saveSystemKeyboard(on)}
              onChange={(p) => void saveSettings(p)} onDataReplaced={reload} />
          )}
          {!rulesUpdate && route.name === 'decks' && <DecksScreen db={db} />}
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
