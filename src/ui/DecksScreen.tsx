import { useCallback, useEffect, useRef, useState } from 'react';
import { readDeckFile, readDeckJson, type DeckArchive } from '../core/deckArchive';
import type { ImportPlan } from '../core/deckImport';
import { deckTitle } from '../core/deckFormat';
import { installedForAi } from '../core/deckReport';
import { findLanguagePack, LANGUAGE_PACKS } from '../core/languages';
import type { DeckRow } from '../core/model';
import type { ManaDb } from '../platform/db';
import { requestPersistence } from '../platform/persist';
import { applyImport, listDecks, listEntries, prepareImport } from '../platform/repo';
import { CopyButton } from './CopyButton';
import { deckPromptText, promptLanguage } from './deckPrompt';
import { useI18n } from './i18n';
import { ImportSheet, type Checked, type ImportState } from './ImportSheet';
import { deckHref } from './Root';
import { Sheet } from './Sheet';

export function formatMb(bytes: number, lang: string): string {
  return new Intl.NumberFormat(lang === 'en' ? 'en' : 'ru', { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(
    bytes / 1024 / 1024,
  );
}

export function languageName(tag: string, lang: 'tg' | 'ru' | 'en'): string {
  return findLanguagePack(tag)?.name[lang] ?? tag;
}

/** The deck id and revision of deck.json text that did not pass, when readable (for the AI report). */
function idOf(archive: DeckArchive): { deckId: string | null; revision: number | null } {
  const d = archive.check.deck;
  return { deckId: d?.id ?? null, revision: d?.revision ?? null };
}

/** Pasting the answer of an AI (Р33 п. 15). */
function PasteSheet({ onCheck, onClose }: { onCheck(text: string): void; onClose(): void }) {
  const { t } = useI18n();
  const [text, setText] = useState('');
  return (
    <Sheet title={t('paste.title')} onClose={onClose} closeLabel={t('common.close')}>
      <p className="hint">{t('paste.hint')}</p>
      <textarea
        className="paste-text"
        rows={10}
        value={text}
        lang="fr"
        spellCheck={false}
        autoComplete="off"
        onChange={(e) => setText(e.target.value)}
        aria-label={t('paste.title')}
      />
      <div className="row mt">
        <button className="secondary" type="button" onClick={onClose}>
          {t('common.cancel')}
        </button>
        <button className="primary" type="button" disabled={text.trim() === ''} onClick={() => onCheck(text)}>
          {t('speak.check')}
        </button>
      </div>
    </Sheet>
  );
}

/** How to make a personal deck with an AI (Р33 п. 15): one text with the rules, the settings and the installed entries (Р34). */
function PromptSheet({ db, onClose }: { db: ManaDb; onClose(): void }) {
  const { t, lang, meaningLang } = useI18n();
  const [installed, setInstalled] = useState<string | null>(null);
  useEffect(() => {
    void (async () => {
      const decks = await listDecks(db);
      const list = [];
      for (const d of decks) list.push({ id: d.id, title: deckTitle(d, lang), language: d.language, entries: await listEntries(db, d.id) });
      setInstalled(installedForAi(list, promptLanguage(lang)));
    })();
  }, [db, lang]);
  // The supported learning languages; one for now (fr-FR), several → the AI asks.
  const language = LANGUAGE_PACKS.map((p) => p.defaultLocale).join(' / ');
  return (
    <Sheet title={t('decks.makeWithAi')} onClose={onClose} closeLabel={t('common.close')}>
      <ol className="steps">
        {(['prompt.step1', 'prompt.step2', 'prompt.step3', 'prompt.step4', 'prompt.step5'] as const).map((k) => (
          <li key={k}>{t(k)}</li>
        ))}
      </ol>
      <div className="stack mt">
        {installed === null ? (
          <p className="hint">{t('common.loading')}</p>
        ) : (
          <CopyButton label={t('prompt.copy')} text={() => deckPromptText({ lang, meaningLang, language, installed })} primary />
        )}
      </div>
      <p className="hint mt">{t('prompt.personal')}</p>
    </Sheet>
  );
}

export function DecksScreen({ db }: { db: ManaDb }) {
  const { t, lang } = useI18n();
  const [decks, setDecks] = useState<DeckRow[] | null>(null);
  const [imp, setImp] = useState<ImportState | null>(null);
  const [sheet, setSheet] = useState<'paste' | 'prompt' | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const refresh = useCallback(() => {
    void listDecks(db).then(setDecks);
  }, [db]);
  useEffect(refresh, [refresh]);

  const write = async (plan: ImportPlan, archive: DeckArchive, checked: Checked) => {
    try {
      await applyImport(db, plan, archive.audio);
      void requestPersistence();
      setImp({ phase: 'done', plan, checked });
      refresh();
    } catch (e) {
      setImp({ phase: 'failed', error: e instanceof Error ? e.message : String(e) });
    }
  };

  /**
   * Errors refuse the deck; otherwise the check result is always shown and the deck is
   * installed only by a button — "Add anyway" with warnings (the validator's and К1/К2,
   * Р33 п. 15), "Install" without (Р34).
   */
  const consider = async (read: () => Promise<DeckArchive>) => {
    setImp({ phase: 'reading' });
    try {
      const archive = await read();
      const { errors, warnings, notes } = archive.check;
      if (!archive.check.deck) {
        setImp({ phase: 'rejected', checked: { ...idOf(archive), errors, warnings, notes } });
        return;
      }
      const plan = await prepareImport(db, archive, new Date(), lang);
      const checked: Checked = { ...idOf(archive), errors, warnings: [...warnings, ...(plan.crossDeck ?? [])], notes };
      setImp({ phase: 'confirm', plan, archive, checked });
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
        accept=".zip,.json,application/zip,application/json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) void consider(async () => readDeckFile(await f.arrayBuffer(), f.name));
        }}
      />
      <div className="stack">
        <button className="primary big" type="button" onClick={() => input.current?.click()}>
          {t('decks.import')}
        </button>
        <button className="secondary" type="button" onClick={() => setSheet('paste')}>
          {t('decks.paste')}
        </button>
        <button className="secondary" type="button" onClick={() => setSheet('prompt')}>
          {t('decks.makeWithAi')}
        </button>
      </div>

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

      <p className="hint mt">{t('privacy.voice')}</p>
      <p className="note">
        <a href="#/prototype">{t('settings.prototype')}</a>
      </p>

      {sheet === 'paste' && (
        <PasteSheet
          onClose={() => setSheet(null)}
          onCheck={(text) => {
            setSheet(null);
            void consider(async () => readDeckJson(text, null));
          }}
        />
      )}
      {sheet === 'prompt' && <PromptSheet db={db} onClose={() => setSheet(null)} />}
      {imp && (
        <ImportSheet
          state={imp}
          onConfirm={(plan, archive) => {
            if (imp.phase === 'confirm') void write(plan, archive, imp.checked);
          }}
          onClose={() => setImp(null)}
        />
      )}
    </section>
  );
}
