import { useCallback, useEffect, useRef, useState } from 'react';
import { backupFileName } from '../core/backup';
import { primaryLanguage } from '../core/deckFormat';
import { findLanguagePack, speechLocale } from '../core/languages';
import type { MetaRow, SettingsRow, SpeechPackState } from '../core/model';
import { createScheduler } from '../core/scheduler';
import type { ManaDb } from '../platform/db';
import { downloadText } from '../platform/files';
import { requestPersistence, storagePersistence, type Persistence } from '../platform/persist';
import { exportJournal, listDecks, restoreJournal } from '../platform/repo';
import { installSpeechPack, speechPackState } from '../platform/speechPack';
import { AccountSection } from './AccountSection';
import { phrasesApiPresent } from './studyHooks';
import { useI18n } from './i18n';
import { LANG_NAMES, type Lang, type StringKey } from './strings';
import { VoiceCheckSheet } from './VoiceCheck';

/** The browser voice per learning language of the installed decks: its check and a button to (re)check (R33 item 14). */
function VoiceChecks({ db }: { db: ManaDb }) {
  const { t, lang } = useI18n();
  const [languages, setLanguages] = useState<string[]>([]);
  const [checks, setChecks] = useState<MetaRow['voiceChecks']>({});
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    void (async () => {
      const decks = await listDecks(db);
      const first = new Map<string, string>();
      for (const d of decks) if (!first.has(primaryLanguage(d.language))) first.set(primaryLanguage(d.language), d.language);
      setLanguages([...first.values()]);
      setChecks((await db.meta.get('device'))?.voiceChecks ?? {});
    })();
  }, [db]);
  if (languages.length === 0) return null;
  return (
    <>
      <h2 className="h2">{t('settings.voice')}</h2>
      <p className="hint">{t('settings.voiceHint')}</p>
      {languages.map((l) => {
        const state = checks?.[primaryLanguage(l)];
        return (
          <div key={l} className="stack mt">
            <p className="m">
              {findLanguagePack(l)?.name[lang] ?? l}: {t(state === 'yes' ? 'voice.state.yes' : state === 'no' ? 'voice.state.no' : 'voice.state.none')}
            </p>
            <button className="secondary" type="button" onClick={() => setOpen(l)}>
              {t('voice.title')}
            </button>
          </div>
        );
      })}
      {open && (
        <VoiceCheckSheet
          db={db}
          language={open}
          onDone={(m) => setChecks(m.voiceChecks ?? {})}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
}

interface Props {
  db: ManaDb;
  meta: MetaRow;
  newPerDay: number;
  biasing: boolean;
  /** Answers on the device's own keyboard (R31, device-only). */
  systemKeyboard: boolean;
  onSystemKeyboard(on: boolean): void;
  onChange(patch: Partial<Pick<SettingsRow, 'uiLang' | 'meaningLang' | 'newPerDay' | 'biasing'>>): void;
  /** The restore adopted another user: reload meta and settings. */
  onDataReplaced(): void;
  /** Signed in or out on this screen (stage 6a.2). */
  onAccountChange(meta: MetaRow): void;
}

const LANGS: Lang[] = ['tg', 'ru', 'en'];
/** New entries per day (R7): 5 by default, 10 the alternative; the user may go higher. */
const NEW_PER_DAY = [5, 10, 15, 20];

const PERSISTENCE_TEXT: Record<Persistence, StringKey> = {
  persisted: 'storage.persisted',
  'not-persisted': 'storage.notPersisted',
  unsupported: 'storage.unsupported',
};

type Msg = { text: string; err: boolean } | null;

export function SettingsScreen({ db, meta, newPerDay, biasing, systemKeyboard, onSystemKeyboard, onChange, onDataReplaced, onAccountChange }: Props) {
  const { t, lang, meaningLang } = useI18n();
  const [persist, setPersist] = useState<Persistence | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void storagePersistence().then(setPersist);
  }, []);

  // Read from the database: a study round may have set it after the app started.
  const [rejected, setRejected] = useState(meta.phrasesUnsupported === true);
  useEffect(() => {
    void db.meta.get('device').then((m) => setRejected(m?.phrasesUnsupported === true));
  }, [db, biasing, meta]);

  const save = async () => {
    try {
      const { json, count } = await exportJournal(db, meta);
      downloadText(json, backupFileName(new Date()));
      setMsg({ text: t('backup.saved', { n: count }), err: false });
    } catch (e) {
      setMsg({ text: t('backup.error.failed', { error: e instanceof Error ? e.message : String(e) }), err: true });
    }
  };

  const restore = async (f: File) => {
    try {
      const res = await restoreJournal(db, createScheduler(), await f.text());
      if (!res.ok) {
        const key: StringKey = res.error === 'format' ? 'backup.error.json' : `backup.error.${res.error}`;
        setMsg({ text: t(key), err: true });
        return;
      }
      setMsg({ text: t('backup.restored', { added: res.added, skipped: res.skipped }), err: false });
      void requestPersistence().then(setPersist);
      if (res.userId !== meta.userId) onDataReplaced();
    } catch (e) {
      setMsg({ text: t('backup.error.failed', { error: e instanceof Error ? e.message : String(e) }), err: true });
    }
  };

  return (
    <section>
      <h1>{t('settings.title')}</h1>

      <label className="field">
        <span>{t('settings.uiLang')}</span>
        <select value={lang} onChange={(e) => onChange({ uiLang: e.target.value as Lang })}>
          {LANGS.map((l) => (
            <option key={l} value={l} lang={l}>
              {LANG_NAMES[l]}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>{t('settings.meaningLang')}</span>
        <select value={meaningLang} onChange={(e) => onChange({ meaningLang: e.target.value as Lang })}>
          {LANGS.map((l) => (
            <option key={l} value={l} lang={l}>
              {LANG_NAMES[l]}
            </option>
          ))}
        </select>
      </label>
      <p className="hint">{t('settings.meaningHint')}</p>
      <label className="field">
        <span>{t('settings.newPerDay')}</span>
        <select value={newPerDay} onChange={(e) => onChange({ newPerDay: Number(e.target.value) })}>
          {[...new Set([...NEW_PER_DAY, newPerDay])].sort((a, b) => a - b).map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>

      <h2 className="h2">{t('settings.recognition')}</h2>
      <p className="hint">{t('privacy.voice')}</p>
      <label className="check">
        <input type="checkbox" checked={biasing} onChange={(e) => onChange({ biasing: e.target.checked })} />
        <span>{t('settings.biasing')}</span>
      </label>
      <p className="hint">{t('settings.biasingHint')}</p>
      {biasing && !phrasesApiPresent && <p className="hint err">{t('settings.biasingNoApi')}</p>}
      {biasing && phrasesApiPresent && rejected && <p className="hint err">{t('settings.biasingRejected')}</p>}
      {biasing && <SpeechPacks db={db} />}

      <VoiceChecks db={db} />

      <h2 className="h2">{t('kb.group')}</h2>
      <label className="check">
        <input type="checkbox" checked={systemKeyboard} onChange={(e) => onSystemKeyboard(e.target.checked)} />
        <span>{t('settings.systemKeyboard')}</span>
      </label>
      <p className="hint">{t('settings.systemKeyboardHint')}</p>

      <h2 className="h2">{t('backup.title')}</h2>
      <p className="hint">{t('backup.hint')}</p>
      <div className="stack mt">
        <button className="secondary" type="button" onClick={() => void save()}>
          {t('backup.save')}
        </button>
        {/* Signed in: off until the transfer of answers (6a.4) — a file of another installation would change the local user. */}
        <button className="secondary" type="button" disabled={meta.account !== undefined} onClick={() => file.current?.click()}>
          {t('backup.restore')}
        </button>
      </div>
      {meta.account && <p className="hint">{t('backup.restoreSignedIn')}</p>}
      <input
        ref={file}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) void restore(f);
        }}
      />
      {msg && (
        <p className={'hint' + (msg.err ? ' err' : '')} role="status">
          {msg.text}
        </p>
      )}

      <AccountSection db={db} meta={meta} onMetaChange={onAccountChange} />

      <h2 className="h2">{t('storage.title')}</h2>
      {persist && <p className="hint">{t(PERSISTENCE_TEXT[persist])}</p>}
      {persist === 'not-persisted' && (
        <button className="secondary mt" type="button" onClick={() => void requestPersistence().then(setPersist)}>
          {t('storage.request')}
        </button>
      )}
    </section>
  );
}

/** On-device recognition packs of the learning languages of the installed decks (hints only). */
function SpeechPacks({ db }: { db: ManaDb }) {
  const { t, lang } = useI18n();
  const [packs, setPacks] = useState<{ locale: string; code: string; state: SpeechPackState }[] | null>(null);
  const [failed, setFailed] = useState(false);

  const refresh = useCallback(async () => {
    const decks = await listDecks(db);
    const locales = [...new Set(decks.map((d) => speechLocale(d.language)).filter((l): l is string => l !== undefined))];
    setPacks(
      await Promise.all(
        locales.map(async (locale) => ({ locale, code: locale.split('-')[0]!, state: await speechPackState(locale) })),
      ),
    );
  }, [db]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!packs) return null;
  const name = (code: string) => findLanguagePack(code)?.name[lang] ?? code;
  return (
    <div className="stack mt">
      {packs.map((p) => (
        <div key={p.locale}>
          <p className="hint">{t(`pack.${p.state}`, { lang: name(p.code) })}</p>
          {p.state === 'downloadable' && (
            <button
              className="secondary"
              type="button"
              onClick={() => {
                setFailed(false);
                setPacks((all) => all?.map((x) => (x.locale === p.locale ? { ...x, state: 'downloading' } : x)) ?? null);
                // Only on the user's tap: the browser downloads the pack itself.
                void installSpeechPack(p.locale).then((ok) => {
                  if (!ok) setFailed(true);
                  void refresh();
                });
              }}
            >
              {t('pack.download', { lang: name(p.code) })}
            </button>
          )}
        </div>
      ))}
      {failed && <p className="hint err">{t('pack.failed')}</p>}
    </div>
  );
}
