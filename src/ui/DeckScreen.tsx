import { useEffect, useState } from 'react';
import { formHints, pickLocalizedWithLang } from '../core/deckFormat';
import type { DeckRow, EntryRow } from '../core/model';
import { buildSession, capped, outlook } from '../core/session';
import { playAudio, stopAudio } from '../platform/audio';
import type { ManaDb } from '../platform/db';
import { deviceZone } from '../platform/device';
import { getDeck, getMedia, listEntries, loadSessionData } from '../platform/repo';
import { formatMb, languageName } from './DecksScreen';
import { useI18n } from './i18n';
import { studyHref } from './Root';
import { LANG_NAMES } from './strings';

/**
 * `due`: reviews due today in this deck (debts included); `debt`: the first deck with
 * debts (this one first) and how many decks have them; `held`: debts hold back new
 * entries now, so "add anyway" is offered (Р29.5, Р29.6).
 */
type Day = { due: number; fresh: number; debt: { deckId: string; name: string; count: number } | null; held: boolean };
type Loaded = { deck: DeckRow; entries: EntryRow[]; day: Day } | 'missing' | null;

export function DeckScreen({ db, deckId, userId, newPerDay }: { db: ManaDb; deckId: string; userId: string; newPerDay: number }) {
  const { t, lang, meaningLang } = useI18n();
  const [data, setData] = useState<Loaded>(null);
  const [audioError, setAudioError] = useState(false);

  useEffect(() => {
    let live = true;
    void (async () => {
      const deck = await getDeck(db, deckId);
      if (!deck) {
        if (live) setData('missing');
        return;
      }
      const [entries, all] = await Promise.all([listEntries(db, deckId), loadSessionData(db, userId)]);
      const input = { now: new Date(), tz: deviceZone(), deckId, entries: all.entries, cards: all.cards, log: all.log, newPerDay };
      const o = outlook(input);
      const first = o.debts[0];
      const name = (id: string) => all.decks.find((d) => d.id === id)?.name ?? id;
      const held = buildSession(input).noNew === 'overdue';
      const day: Day = { due: o.today, fresh: o.fresh, debt: first ? { deckId: first.deckId, name: name(first.deckId), count: first.count } : null, held };
      if (live) setData({ deck, entries, day });
    })();
    return () => {
      live = false;
      stopAudio();
    };
  }, [db, deckId, userId, newPerDay]);

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

  const { deck, entries, day } = data;
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
      <p className="m">
        {t('deck.dueToday', { n: capped(day.due) })}
        {day.fresh > 0 && t('deck.dueNew', { m: capped(day.fresh) })}
      </p>
      {day.debt && (
        <p className="hint">
          {day.debt.deckId === deck.id
            ? t('deck.overdue', { n: capped(day.debt.count) })
            : t('deck.overdueIn', { deck: day.debt.name, n: capped(day.debt.count) })}
        </p>
      )}
      <div className="stack">
        <a className="primary big center" href={studyHref(deck.id)}>
          {t('study.start')}
        </a>
        {day.held && (
          <a className="secondary big center" href={studyHref(deck.id, true)}>
            {t('study.addAnyway')}
          </a>
        )}
      </div>
      {audioError && (
        <p className="hint err" role="alert">
          {t('deck.audioError')}
        </p>
      )}

      <details className="deck-contents">
        <summary>{t('deck.contents', { n: entries.length })}</summary>
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
      </details>
    </section>
  );
}
