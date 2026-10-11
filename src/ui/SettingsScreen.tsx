import { useEffect, useRef, useState } from 'react';
import { backupFileName } from '../core/backup';
import type { MetaRow, SettingsRow } from '../core/model';
import { createScheduler } from '../core/scheduler';
import type { SluhDb } from '../platform/db';
import { downloadText } from '../platform/files';
import { requestPersistence, storagePersistence, type Persistence } from '../platform/persist';
import { exportJournal, restoreJournal } from '../platform/repo';
import { useI18n } from './i18n';
import { LANG_NAMES, type Lang, type StringKey } from './strings';

interface Props {
  db: SluhDb;
  meta: MetaRow;
  onChange(patch: Partial<Pick<SettingsRow, 'uiLang' | 'meaningLang'>>): void;
  /** The restore adopted another user: reload meta and settings. */
  onDataReplaced(): void;
}

const LANGS: Lang[] = ['tg', 'ru', 'en'];

const PERSISTENCE_TEXT: Record<Persistence, StringKey> = {
  persisted: 'storage.persisted',
  'not-persisted': 'storage.notPersisted',
  unsupported: 'storage.unsupported',
};

type Msg = { text: string; err: boolean } | null;

export function SettingsScreen({ db, meta, onChange, onDataReplaced }: Props) {
  const { t, lang, meaningLang } = useI18n();
  const [persist, setPersist] = useState<Persistence | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void storagePersistence().then(setPersist);
  }, []);

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

      <h2 className="h2">{t('backup.title')}</h2>
      <p className="hint">{t('backup.hint')}</p>
      <div className="stack mt">
        <button className="secondary" type="button" onClick={() => void save()}>
          {t('backup.save')}
        </button>
        <button className="secondary" type="button" onClick={() => file.current?.click()}>
          {t('backup.restore')}
        </button>
      </div>
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

      <h2 className="h2">{t('storage.title')}</h2>
      {persist && <p className="hint">{t(PERSISTENCE_TEXT[persist])}</p>}
      {persist === 'not-persisted' && (
        <button className="secondary mt" type="button" onClick={() => void requestPersistence().then(setPersist)}>
          {t('storage.request')}
        </button>
      )}

      <p className="note">
        <a href="#/prototype">{t('settings.prototype')}</a>
      </p>
    </section>
  );
}
