/**
 * One round of study in a deck (Р17, Р22.4): buildSession decides the items; each
 * introduction and each answer is written to the journal as soon as it is finished,
 * so leaving in the middle loses nothing already done.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { findLanguagePack, speechLocale } from '../core/languages';
import type { DeckRow, FinalRating, ReviewRecord } from '../core/model';
import { createScheduler } from '../core/scheduler';
import { buildSession, type SessionPlan } from '../core/session';
import type { ManaDb } from '../platform/db';
import { getDeck, lastReview, loadSessionData, randomId, recordIntro, recordReview, type Actor } from '../platform/repo';
import { languageName } from './DecksScreen';
import { useI18n } from './i18n';
import { IntroCard, type IntroResult } from './IntroCard';
import { deckHref } from './Root';
import { SpeakCard, type SpeakAnswer } from './SpeakCard';

const scheduler = createScheduler();

type Round = { deck: DeckRow; plan: SessionPlan; sessionId: string } | 'missing' | null;

export function StudyScreen({ db, deckId, actor, newPerDay }: { db: ManaDb; deckId: string; actor: Actor; newPerDay: number }) {
  const { t, lang } = useI18n();
  const [round, setRound] = useState<Round>(null);
  const [index, setIndex] = useState(0);
  const [ratings, setRatings] = useState<FinalRating[]>([]);
  const [previous, setPrevious] = useState<{ index: number; review: ReviewRecord | null } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const start = useCallback(async () => {
    const deck = await getDeck(db, deckId);
    if (!deck) {
      setRound('missing');
      return;
    }
    const data = await loadSessionData(db, actor.userId, deckId);
    const plan = buildSession({ now: new Date(), ...data, newPerDay });
    setRound({ deck, plan, sessionId: randomId() });
    setIndex(0);
    setRatings([]);
    setPrevious(null);
  }, [db, deckId, actor.userId, newPerDay]);

  useEffect(() => {
    void start();
  }, [start]);

  const item = round && round !== 'missing' ? round.plan.items[index] : undefined;

  // The previous answer on the card, for the Easy rule; loaded before the card shows.
  useEffect(() => {
    if (!item || item.kind !== 'speak') return;
    let live = true;
    void lastReview(db, actor.userId, item.entry.deckId, item.entry.entryId, 'speak').then((review) => {
      if (live) setPrevious({ index, review });
    });
    return () => {
      live = false;
    };
  }, [db, actor.userId, item, index]);

  const pack = useMemo(() => (round && round !== 'missing' ? findLanguagePack(round.deck.language) : undefined), [round]);

  if (round === null) return <p className="lead">{t('common.loading')}</p>;
  if (round === 'missing') {
    return (
      <section>
        <p className="lead">{t('deck.notFound')}</p>
        <a href="#/">← {t('common.back')}</a>
      </section>
    );
  }
  const { deck, plan, sessionId } = round;
  const back = (
    <a className="back-link" href={deckHref(deck.id)}>
      ← {deck.name}
    </a>
  );
  if (!pack) {
    return (
      <section>
        {back}
        <p className="lead">{t('study.noLanguage', { lang: languageName(deck.language, lang) })}</p>
      </section>
    );
  }
  const locale = speechLocale(deck.language) ?? pack.defaultLocale;
  const noNewLine =
    plan.noNew === 'dailyLimit'
      ? t('study.noNew.dailyLimit', { n: newPerDay })
      : plan.noNew === 'portionFull'
        ? t('study.noNew.portionFull')
        : plan.noNew === 'noMaterial'
          ? t('study.noNew.noMaterial')
          : null;

  if (plan.items.length === 0) {
    return (
      <section>
        {back}
        <h1>{deck.name}</h1>
        <p className="lead">{t('study.nothing')}</p>
        {noNewLine && <p className="hint">{noNewLine}</p>}
      </section>
    );
  }

  const base = (entryId: string) => ({ at: new Date(), deckId: deck.id, entryId, deckRevision: deck.revision, sessionId });
  const save = async (write: () => Promise<unknown>) => {
    setSaveError(null);
    try {
      await write();
      setIndex((i) => i + 1);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    }
  };
  const onIntro = (entryId: string) => (r: IntroResult) =>
    void save(() => recordIntro(db, actor, { ...base(entryId), echo: r.echo, copy: r.copy }));
  const onSpeak = (entryId: string) => (a: SpeakAnswer) =>
    void save(async () => {
      await recordReview(db, scheduler, actor, { ...base(entryId), skill: 'speak', ...a });
      setRatings((r) => [...r, a.final]);
    });

  if (!item) {
    const counts = ([1, 2, 3, 4] as const).map((g) => ratings.filter((r) => r === g).length);
    return (
      <section>
        {back}
        <h1>{t('study.done')}</h1>
        <div className="sum">
          {counts.map((c, k) => (
            <div key={k} data-g={k + 1}>
              <strong>{c}</strong>
              {t(`rating.${(k + 1) as FinalRating}`)}
            </div>
          ))}
        </div>
        {plan.introduced > 0 && <p className="m">{t('study.introduced', { n: plan.introduced })}</p>}
        {noNewLine && <p className="hint">{noNewLine}</p>}
        <div className="stack mt">
          <button className="primary big" type="button" onClick={() => void start()}>
            {t('study.more')}
          </button>
          <a className="secondary big center" href={deckHref(deck.id)}>
            {t('common.back')}
          </a>
        </div>
      </section>
    );
  }

  const total = plan.items.length;
  return (
    <section>
      {back}
      <div className="progress">
        <span>{t('study.progress', { i: index + 1, n: total })}</span>
        <span className="bar">
          <i style={{ width: `${(index / total) * 100}%` }} />
        </span>
      </div>
      {index === 0 && noNewLine && <p className="hint">{noNewLine}</p>}
      {saveError && (
        <p className="hint err" role="alert">
          {t('study.saveError', { error: saveError })}
        </p>
      )}
      {item.kind === 'intro' ? (
        <IntroCard key={`${sessionId}-${index}`} db={db} entry={item.entry} pack={pack} locale={locale} onDone={onIntro(item.entry.entryId)} />
      ) : previous?.index === index ? (
        <SpeakCard
          key={`${sessionId}-${index}`}
          db={db}
          entry={item.entry}
          pack={pack}
          locale={locale}
          previous={previous.review}
          onDone={onSpeak(item.entry.entryId)}
        />
      ) : (
        <p className="lead">{t('common.loading')}</p>
      )}
    </section>
  );
}
