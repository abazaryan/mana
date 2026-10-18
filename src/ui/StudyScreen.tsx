/**
 * One round of study in a deck (Р17, Р22.4, Р25): buildSession decides the items; each
 * introduction, answer and practice is written to the journal as soon as it is
 * finished, so leaving in the middle loses nothing already done. An answer rated
 * Again is written first, then its short practice follows, and the card comes back
 * at the end of the portion (requeueAfterAgain).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { findLanguagePack, speechLocale, type LanguagePack } from '../core/languages';
import type { DeckRow, EntryRow, FinalRating, IntroCopy, IntroEcho, ReviewRecord } from '../core/model';
import { createScheduler } from '../core/scheduler';
import { buildSession, requeueAfterAgain, sinceEntry, type ReviewItem, type SessionItem, type SessionPlan } from '../core/session';
import { biasPhrases } from '../core/spoken';
import type { ManaDb } from '../platform/db';
import {
  entryTextsForLanguage,
  getDeck,
  lastReview,
  loadSessionData,
  randomId,
  recordDrill,
  recordIntro,
  recordReview,
  setPhrasesUnsupported,
  type Actor,
} from '../platform/repo';
import { speechPackState } from '../platform/speechPack';
import { languageName } from './DecksScreen';
import { useI18n } from './i18n';
import { IntroCard, type IntroResult } from './IntroCard';
import { CopyStep, EchoStep } from './PracticeSteps';
import { deckHref } from './Root';
import { phrasesApiPresent, type RecognitionSetup } from './studyHooks';
import { VoiceCard, type CardAnswer } from './VoiceCard';
import { WriteCard } from './WriteCard';

const scheduler = createScheduler();

type Hints = Omit<RecognitionSetup, 'onPhrasesUnsupported'>;
type Round = { deck: DeckRow; plan: SessionPlan; items: SessionItem[]; sessionId: string; hints: Hints } | 'missing' | null;
type DrillResult = { echo: IntroEcho | null; copy: IntroCopy | null; skipped: boolean };

const OFF: Hints = { options: {}, biasing: 'off', speechPack: null };

/**
 * Recognizer hints for a round (experiment, off by default): the words of every
 * installed deck in the language; on the device when its pack is installed. Not
 * sent when this browser has no hints API or once rejected them.
 */
async function prepareHints(db: ManaDb, deck: DeckRow, biasing: boolean): Promise<Hints> {
  if (!biasing) return OFF;
  const pack = findLanguagePack(deck.language);
  const locale = speechLocale(deck.language);
  const meta = await db.meta.get('device');
  if (!pack || !locale || !phrasesApiPresent || meta?.phrasesUnsupported) return { ...OFF, biasing: 'unavailable' };
  const speechPack = await speechPackState(locale);
  const phrases = biasPhrases(await entryTextsForLanguage(db, deck.language), pack.spoken);
  return { options: { phrases, processLocally: speechPack === 'available' }, biasing: 'on', speechPack };
}

/** Two entries sound the same (ravi / ravie, Р16): kept apart in the portion. */
function sameSoundOf(pack: LanguagePack | undefined) {
  const same = pack?.sameSound;
  return same ? (a: EntryRow, b: EntryRow) => same(a.text, b.text) : undefined;
}

export function StudyScreen({
  db,
  deckId,
  actor,
  newPerDay,
  biasing,
}: {
  db: ManaDb;
  deckId: string;
  actor: Actor;
  newPerDay: number;
  biasing: boolean;
}) {
  const { t, lang } = useI18n();
  const [round, setRound] = useState<Round>(null);
  const [index, setIndex] = useState(0);
  const [ratings, setRatings] = useState<FinalRating[]>([]);
  const [previous, setPrevious] = useState<{ index: number; review: ReviewRecord | null } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  /** The short practice after Again of the card at `index`, answered in the record `reviewId`. */
  const [drill, setDrill] = useState<{ index: number; reviewId: string } | null>(null);
  /** When each item of the portion was finished (for the spacing figures in the journal). */
  const finishedAt = useRef(new Map<number, Date>());

  const start = useCallback(async () => {
    const deck = await getDeck(db, deckId);
    if (!deck) {
      setRound('missing');
      return;
    }
    const all = await loadSessionData(db, actor.userId);
    const data = { entries: all.entries.filter((e) => e.deckId === deckId), cards: all.cards.filter((c) => c.deckId === deckId), log: all.log };
    const plan = buildSession({ now: new Date(), ...data, newPerDay, sameSound: sameSoundOf(findLanguagePack(deck.language)) });
    const hints = await prepareHints(db, deck, biasing);
    setRound({ deck, plan, items: plan.items, sessionId: randomId(), hints });
    setIndex(0);
    setRatings([]);
    setPrevious(null);
    setDrill(null);
    finishedAt.current = new Map();
  }, [db, deckId, actor.userId, newPerDay, biasing]);

  useEffect(() => {
    void start();
  }, [start]);

  const item = round && round !== 'missing' ? round.items[index] : undefined;

  // The previous answer on the card, for the Easy rule; loaded before the card shows.
  useEffect(() => {
    if (!item || item.kind !== 'review') return;
    let live = true;
    void lastReview(db, actor.userId, item.entry.deckId, item.entry.entryId, item.skill).then((review) => {
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
  const { deck, plan, items, sessionId } = round;
  const recognition: RecognitionSetup = {
    ...round.hints,
    onPhrasesUnsupported: () => {
      // Remembered on this device; later cards go without hints (Р22, amendments of 15.10.2026).
      void setPhrasesUnsupported(db, true);
      setRound((r) => (r && r !== 'missing' ? { ...r, hints: { ...OFF, biasing: 'unavailable', speechPack: r.hints.speechPack } } : r));
    },
  };
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

  if (items.length === 0) {
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
    void save(async () => {
      const b = base(entryId);
      await recordIntro(db, actor, { ...b, echo: r.echo, copy: r.copy });
      finishedAt.current.set(index, b.at);
    });
  const onAnswer = (it: ReviewItem, prev: ReviewRecord | null) => (a: CardAnswer) => {
    setSaveError(null);
    void (async () => {
      try {
        const b = base(it.entry.entryId);
        const since = sinceEntry(items, finishedAt.current, index, b.at);
        const { record } = await recordReview(db, scheduler, actor, {
          ...b,
          skill: it.skill,
          ...a,
          requeue: it.requeue,
          sincePairSec: prev ? Math.round((b.at.getTime() - prev.at.getTime()) / 1000) : null,
          sinceEntryCards: since.cards,
          sinceEntrySec: since.sec,
        });
        finishedAt.current.set(index, b.at);
        setRatings((r) => [...r, a.final]);
        if (a.final !== 1) {
          setIndex((i) => i + 1);
          return;
        }
        // Again (Р25): the answer is in the journal; now the short practice, and the card comes back later.
        const requeued = requeueAfterAgain(items, index);
        if (requeued) setRound((r) => (r && r !== 'missing' ? { ...r, items: requeued } : r));
        setDrill({ index, reviewId: record.id });
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : String(e));
      }
    })();
  };
  const onDrill = (it: ReviewItem, reviewId: string) => (r: DrillResult) =>
    void save(async () => {
      await recordDrill(db, actor, { ...base(it.entry.entryId), skill: it.skill, reviewId, ...r });
      setDrill(null);
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

  const total = items.length;
  const cardKey = `${sessionId}-${index}`;

  let card;
  if (item.kind === 'intro') {
    card = (
      <IntroCard
        key={cardKey}
        db={db}
        entry={item.entry}
        pack={pack}
        locale={locale}
        recognition={recognition}
        onDone={onIntro(item.entry.entryId)}
      />
    );
  } else if (drill?.index === index) {
    const finishDrill = onDrill(item, drill.reviewId);
    card =
      item.skill === 'write' ? (
        <CopyStep
          key={`${cardKey}-drill`}
          db={db}
          entry={item.entry}
          pack={pack}
          locale={locale}
          kicker={t('skill.write')}
          skippable
          onDone={(copy) => finishDrill({ echo: null, copy, skipped: copy === null })}
        />
      ) : (
        <EchoStep
          key={`${cardKey}-drill`}
          db={db}
          entry={item.entry}
          pack={pack}
          locale={locale}
          recognition={recognition}
          kicker={t(`skill.${item.skill}`)}
          start="afterAudio"
          onDone={(echo) => finishDrill({ echo, copy: null, skipped: echo.skipped })}
        />
      );
  } else if (previous?.index === index) {
    card =
      item.skill === 'write' ? (
        <WriteCard
          key={cardKey}
          db={db}
          entry={item.entry}
          pack={pack}
          locale={locale}
          previous={previous.review}
          requeue={item.requeue}
          onDone={onAnswer(item, previous.review)}
        />
      ) : (
        <VoiceCard
          key={cardKey}
          db={db}
          entry={item.entry}
          pack={pack}
          locale={locale}
          skill={item.skill}
          previous={previous.review}
          recognition={recognition}
          requeue={item.requeue}
          onDone={onAnswer(item, previous.review)}
        />
      );
  } else {
    card = <p className="lead">{t('common.loading')}</p>;
  }

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
      {card}
    </section>
  );
}
