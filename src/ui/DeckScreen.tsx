import { useEffect, useState } from 'react';
import { formHints, pickLocalizedWithLang } from '../core/deckFormat';
import type { DeckRow, EntryRow } from '../core/model';
import { playAudio, stopAudio } from '../platform/audio';
import type { SluhDb } from '../platform/db';
import { getDeck, getMedia, listEntries } from '../platform/repo';
import { formatMb, languageName } from './DecksScreen';
import { useI18n } from './i18n';
import { LANG_NAMES } from './strings';

type Loaded = { deck: DeckRow; entries: EntryRow[] } | 'missing' | null;

export function DeckScreen({ db, deckId }: { db: SluhDb; deckId: string }) {
  const { t, lang, meaningLang } = useI18n();
  const [data, setData] = useState<Loaded>(null);
  const [audioError, setAudioError] = useState(false);

  useEffect(() => {
    let live = true;
    void (async () => {
      const deck = await getDeck(db, deckId);
      const entries = deck ? await listEntries(db, deckId) : [];
      if (live) setData(deck ? { deck, entries } : 'missing');
    })();
    return () => {
      live = false;
      stopAudio();
    };
  }, [db, deckId]);

  const play = async (e: EntryRow) => {
    if (!e.audio) return;
    setAudioError(false);
    try {
      const media = await getMedia(db, deckId, e.audio);
      if (!media) throw new Error('no media');
      await playAudio(media.data, media.type);
    } catch {
      setAudioError(true);
    }
  };

  if (data === null) return <p className="lead">{t('common.loading')}</p>;
  if (data === 'missing') {
    return (
      <section>
        <p className="lead">{t('deck.notFound')}</p>
        <a href="#/">← {t('common.back')}</a>
      </section>
    );
  }

  const { deck, entries } = data;
  return (
    <section>
      <a className="back-link" href="#/">
        ← {t('decks.title')}
      </a>
      <h1>{deck.name}</h1>
      <p className="lead">
        {languageName(deck.language, lang)} · {t('decks.entries', { n: deck.entryCount })} ·{' '}
        {t('decks.revision', { n: deck.revision })} · {t('decks.audio', { mb: formatMb(deck.audioBytes, lang) })}
      </p>
      {deck.hiddenCount > 0 && <p className="hint">{t('deck.hidden', { n: deck.hiddenCount })}</p>}
      {audioError && (
        <p className="hint err" role="alert">
          {t('deck.audioError')}
        </p>
      )}

      <ul className="entries">
        {entries.map((e) => {
          const hints = formHints(e.form, lang);
          const meaning = pickLocalizedWithLang(e.meaning, meaningLang);
          return (
            <li key={e.entryId} className="entry">
              <div className="entry-main">
                <div className="entry-text" lang={deck.language}>
                  {e.text}
                </div>
                {e.ipa && <div className="m ipa">[{e.ipa}]</div>}
                <div lang={meaning?.lang}>
                  {meaning?.text}
                  {meaning && meaning.lang !== meaningLang && (
                    <span className="chip lang-mark" title={LANG_NAMES[meaning.lang]}>
                      {meaning.lang}
                    </span>
                  )}
                  {hints.length > 0 && <span className="m"> · {hints.join(', ')}</span>}
                </div>
                <div className="chips">
                  {e.skills.map((s) => (
                    <span key={s} className="chip">
                      {t(`skill.${s}`)}
                    </span>
                  ))}
                </div>
              </div>
              <button
                className="play"
                type="button"
                disabled={!e.audio}
                aria-label={e.audio ? `${t('deck.play')}: ${e.text}` : t('deck.noAudio')}
                onClick={() => void play(e)}
              >
                ▶
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
