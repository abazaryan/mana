import { useCallback, useEffect, useRef, useState } from 'react';
import { readDeckArchive, type DeckArchive } from '../core/deckArchive';
import type { ImportPlan } from '../core/deckImport';
import { deckTitle } from '../core/deckFormat';
import { findLanguagePack } from '../core/languages';
import type { DeckRow } from '../core/model';
import type { ManaDb } from '../platform/db';
import { requestPersistence } from '../platform/persist';
import { applyImport, listDecks, prepareImport } from '../platform/repo';
import { useI18n } from './i18n';
import { ImportSheet, type ImportState } from './ImportSheet';
import { deckHref } from './Root';

export function formatMb(bytes: number, lang: string): string {
  return new Intl.NumberFormat(lang === 'en' ? 'en' : 'ru', { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(
    bytes / 1024 / 1024,
  );
}

export function languageName(tag: string, lang: 'tg' | 'ru' | 'en'): string {
  return findLanguagePack(tag)?.name[lang] ?? tag;
}

export function DecksScreen({ db }: { db: ManaDb }) {
  const { t, lang } = useI18n();
  const [decks, setDecks] = useState<DeckRow[] | null>(null);
  const [imp, setImp] = useState<ImportState | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const refresh = useCallback(() => {
    void listDecks(db).then(setDecks);
  }, [db]);
  useEffect(refresh, [refresh]);

  const write = async (plan: ImportPlan, archive: DeckArchive) => {
    try {
      await applyImport(db, plan, archive.audio);
      void requestPersistence();
      setImp({ phase: 'done', plan, warnings: [...archive.check.warnings, ...(plan.crossDeck ?? [])] });
      refresh();
    } catch (e) {
      setImp({ phase: 'failed', error: e instanceof Error ? e.message : String(e) });
    }
  };

  const onFile = async (file: File) => {
    setImp({ phase: 'reading' });
    try {
      const archive = await readDeckArchive(await file.arrayBuffer(), file.name);
      if (!archive.check.deck) {
        setImp({ phase: 'rejected', errors: archive.check.errors, warnings: archive.check.warnings });
        return;
      }
      const plan = await prepareImport(db, archive, new Date(), lang);
      if (plan.confirm.length > 0) setImp({ phase: 'confirm', plan, archive });
      else await write(plan, archive);
    } catch (e) {
      setImp({ phase: 'failed', error: e instanceof Error ? e.message : String(e) });
    }
  };

  return (
    <section>
      <h1>{t('decks.title')}</h1>
      <input
        ref={input}
        type="file"
        accept=".zip,application/zip"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) void onFile(f);
        }}
      />
      <button className="primary big" type="button" onClick={() => input.current?.click()}>
        {t('decks.import')}
      </button>

      {decks && decks.length === 0 && <p className="lead mt">{t('decks.empty')}</p>}
      {decks && decks.length > 0 && (
        <ul className="cards-list">
          {decks.map((d) => (
            <li key={d.id}>
              <a className="deck-card" href={deckHref(d.id)}>
                <strong>{deckTitle(d, lang)}</strong>
                <span className="m">
                  {languageName(d.language, lang)} · {t('decks.entries', { n: d.entryCount })} ·{' '}
                  {t('decks.revision', { n: d.revision })}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}

      <p className="note">
        <a href="#/prototype">{t('settings.prototype')}</a>
      </p>

      {imp && (
        <ImportSheet
          state={imp}
          onConfirm={(plan, archive) => void write(plan, archive)}
          onClose={() => setImp(null)}
        />
      )}
    </section>
  );
}
