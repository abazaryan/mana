/**
 * One round of study in a deck (Р17, Р22.4, Р25): buildSession decides the items; each
 * introduction, answer and practice is written to the journal as soon as it is
 * finished, so leaving in the middle loses nothing already done. An answer rated
 * Again is written first, then its short practice follows, and the card comes back
 * at the end of the portion (requeueAfterAgain). Every record carries the zone of the
 * device (Р29.3). After the portion — or when there is nothing to issue — the figures
 * of Р29.6 and the reason why no new entries came (Р17.7).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { findLanguagePack, speechLocale, type LanguagePack } from '../core/languages';
import type { DeckRow, EntryRow, FinalRating, IntroCopy, IntroEcho, ReviewRecord } from '../core/model';
import { createScheduler } from '../core/scheduler';
import {
  buildSession,
  capped,
  outlook,
  requeueAfterAgain,
  sinceEntry,
  type Outlook,
  type ReviewItem,
  type SessionItem,
  type SessionPlan,
} from '../core/session';
import { biasPhrases } from '../core/spoken';
import { zoneStamp } from '../core/zone';
import type { ManaDb } from '../platform/db';
import { deviceZone } from '../platform/device';
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
  type SessionData,
} from '../platform/repo';
import { speechPackState } from '../platform/speechPack';
import { languageName } from './DecksScreen';
import { useI18n } from './i18n';
import { IntroCard, type IntroResult } from './IntroCard';
import { CopyStep, EchoStep } from './PracticeSteps';
import { deckHref, studyHref } from './Root';
import { phrasesApiPresent, type RecognitionSetup } from './studyHooks';
import { VoiceCard, type CardAnswer } from './VoiceCard';
import { WriteCard } from './WriteCard';

const scheduler = createScheduler();

type Hints = Omit<RecognitionSetup, 'onPhrasesUnsupported'>;
/** What comes after this portion (Р29.6): the figures and the portion "Another round" would build. */
type After = { outlook: Outlook; next: SessionPlan; names: Map<string, string> };
type Round =
  | { deck: DeckRow; plan: SessionPlan; items: SessionItem[]; sessionId: string; hints: Hints; names: Map<string, string>; after: After | null }
  | 'missing'
  | null;
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

function planFor(data: SessionData, deck: DeckRow, newPerDay: number, addAnyway: boolean): SessionPlan {
  return buildSession({
    now: new Date(),
    tz: deviceZone(),
    deckId: deck.id,
    ...data,
    newPerDay,
    addAnyway,
    sameSound: sameSoundOf(findLanguagePack(deck.language)),
  });
}

function lookAhead(data: SessionData, deck: DeckRow, newPerDay: number): After {
  const day = { now: new Date(), tz: deviceZone(), deckId: deck.id, entries: data.entries, cards: data.cards, log: data.log, newPerDay };
  return { outlook: outlook(day), next: planFor(data, deck, newPerDay, false), names: new Map(data.decks.map((d) => [d.id, d.name])) };
}

export function StudyScreen({
  db,
  deckId,
  actor,
  newPerDay,
  biasing,
  addAnyway = false,
}: {
  db: ManaDb;
  deckId: string;
  actor: Actor;
  newPerDay: number;
  biasing: boolean;
  /** Opened with "add anyway" (Р29.5): the first portion only. */
  addAnyway?: boolean;
}) {
  const { t, lang } = useI18n();
  const [round, setRound] = useState<Round>(null);
  const [index, setIndex] = useState(0);
  const [ratings, setRatings] = useState<FinalRating[]>([]);
  /** `review`: the previous answer for the Easy rule (returns skipped, Р29.2); `last`: the previous answer of any kind, for `sincePairSec`. */
  const [previous, setPrevious] = useState<{ index: number; review: ReviewRecord | null; last: ReviewRecord | null } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  /** The short practice after Again of the card at `index`, answered in the record `reviewId`. */
  const [drill, setDrill] = useState<{ index: number; reviewId: string } | null>(null);
  /** When each item of the portion was finished (for the spacing figures in the journal). */
  const finishedAt = useRef(new Map<number, Date>());

  const start = useCallback(async (force: boolean) => {
    const deck = await getDeck(db, deckId);
    if (!deck) {
      setRound('missing');
      return;
    }
    const data = await loadSessionData(db, actor.userId);
    const p = planFor(data, deck, newPerDay, force);
    const hints = await prepareHints(db, deck, biasing);
    const names = new Map(data.decks.map((d) => [d.id, d.name]));
    const after = p.items.length === 0 ? lookAhead(data, deck, newPerDay) : null;
    setRound({ deck, plan: p, items: p.items, sessionId: randomId(), hints, names, after });
    setIndex(0);
    setRatings([]);
    setPrevious(null);
    setDrill(null);
    finishedAt.current = new Map();
  }, [db, deckId, actor.userId, newPerDay, biasing]);

  useEffect(() => {
    void start(addAnyway);
    // "Add anyway" is for this portion only: a reload or "Another round" builds without it.
    if (addAnyway) history.replaceState(null, '', studyHref(deckId));
  }, [start, addAnyway, deckId]);

  const item = round && round !== 'missing' ? round.items[index] : undefined;

  // The previous answer on the card, for the Easy rule; loaded before the card shows.
  useEffect(() => {
    if (!item || item.kind !== 'review') return;
    let live = true;
    const { deckId: d, entryId: e } = item.entry;
    void Promise.all([lastReview(db, actor.userId, d, e, item.skill, true), lastReview(db, actor.userId, d, e, item.skill)]).then(([review, last]) => {
      if (live) setPrevious({ index, review, last });
    });
    return () => {
      live = false;
    };
  }, [db, actor.userId, item, index]);

  // The portion is done: the figures and the next portion, from the journal as it is now.
  const finished = !!round && round !== 'missing' && round.items.length > 0 && index >= round.items.length;
  const finishedDeck = finished ? round.deck : null;
  useEffect(() => {
    if (!finishedDeck) return;
    let live = true;
    void loadSessionData(db, actor.userId).then((data) => {
      if (live) setRound((r) => (r && r !== 'missing' ? { ...r, after: lookAhead(data, finishedDeck, newPerDay) } : r));
    });
    return () => {
      live = false;
    };
  }, [db, actor.userId, finishedDeck, newPerDay]);

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
  /** One line: why no new entries came (Р17.7). Debts elsewhere name the deck (Р29.5). */
  const noNewText = (p: SessionPlan): string | null => {
    if (p.noNew === 'dailyLimit') return t('study.noNew.dailyLimit');
    if (p.noNew === 'portionFull') return t('study.noNew.portionFull');
    // "No new entries left" only when the portion has nothing at all: otherwise the figures tell.
    if (p.noNew === 'noMaterial') return p.items.length === 0 ? t('study.noNew.noMaterial') : null;
    if (p.noNew !== 'overdue') return null;
    const first = p.debts[0];
    if (!first || first.deckId === deck.id) return t('study.noNew.overdue');
    const more = p.debts.length > 1 ? t('study.noNew.overdueMore', { n: p.debts.length - 1 }) : '';
    return t('study.noNew.overdueIn', { deck: round.names.get(first.deckId) ?? first.deckId, more });
  };
  const noNewLine = noNewText(plan);

  /** The figures, the reason and the buttons after a portion or instead of an empty one (Р29.6). */
  const ahead = (after: After | null) => {
    if (!after) return <p className="m">{t('common.loading')}</p>;
    const why = noNewText(after.next);
    return (
      <>
        <p className="m">{t('study.left.today', { n: capped(after.outlook.today + after.outlook.fresh) })}</p>
        <p className="m">
          {t('study.left.tomorrow', { n: capped(after.outlook.tomorrow) })} · {t('study.left.week', { n: capped(after.outlook.week) })}
        </p>
        {why && <p className="hint">{why}</p>}
        <div className="stack mt">
          {after.next.items.length > 0 && (
            <button className="primary big" type="button" onClick={() => void start(false)}>
              {t('study.more')}
            </button>
          )}
          {after.next.noNew === 'overdue' && (
            <button className={after.next.items.length > 0 ? 'secondary big' : 'primary big'} type="button" onClick={() => void start(true)}>
              {t('study.addAnyway')}
            </button>
          )}
          <a className="secondary big center" href={deckHref(deck.id)}>
            {t('common.back')}
          </a>
        </div>
      </>
    );
  };

  if (items.length === 0) {
    return (
      <section>
        {back}
        <h1>{deck.name}</h1>
        <p className="lead">{t('study.nothing')}</p>
        {ahead(round.after)}
      </section>
    );
  }

  const base = (entryId: string) => {
    const at = new Date();
    return { at, deckId: deck.id, entryId, deckRevision: deck.revision, sessionId, ...zoneStamp(deviceZone(), at) };
  };
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
    // `prev`: the previous answer of any kind, returns included (seconds since it, as before Р29).
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
        {ahead(round.after)}
      </section>
    );
  }

  // "X of N" counts cards to answer, not introductions (Р29.6); N still grows after Again.
  const total = items.filter((i) => i.kind === 'review').length;
  const done = items.slice(0, index).filter((i) => i.kind === 'review').length;
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
          onDone={onAnswer(item, previous.last)}
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
          onDone={onAnswer(item, previous.last)}
        />
      );
  } else {
    card = <p className="lead">{t('common.loading')}</p>;
  }

  return (
    <section>
      {back}
      <div className="progress">
        {/* An introduction has no number (Р29.6): the place stays empty, the card shows its own title. */}
        <span>{item.kind === 'intro' ? '' : t('study.progress', { i: done + 1, n: total })}</span>
        <span className="bar">
          <i style={{ width: `${total > 0 ? (done / total) * 100 : 0}%` }} />
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
