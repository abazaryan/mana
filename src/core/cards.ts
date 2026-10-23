/**
 * FSRS state is derived from the journal (R10): replaying the answers of one card
 * in journal order through ts-fsrs with the final ratings gives its state.
 *
 * Determinism: the scheduler runs without fuzz. (Even with fuzz on, ts-fsrs 5.4.1
 * seeds its generator from the review time, reps and difficulty × stability, so a
 * replay would still match.) Days are app days in the zone stored in each record
 * (R29.3; records before stage 4.4a count as Luxembourg), so the zone of the device
 * replaying does not change the result. Each answer also stores the computed next
 * due date (`ReviewRecord.fsrs`); a test checks the rebuild reproduces it for
 * records of the current rules version (older records keep what was computed then).
 *
 * A return after Again in the same portion (`requeue` > 0) is journaled with its
 * rating but leaves FSRS alone (R29.2): the first Again sets the due date. The
 * replay skips such answers in records of any version.
 */
import type { FSRS, Grade } from 'ts-fsrs';
import { cardKey, compareLog, type CardRow, type LogRecord, type ReviewFsrs, type ReviewRecord } from './model';
import { applyReview, newCardState, type CardState } from './scheduler';
import { recordOffset } from './zone';

/** One answer applied to a card: the new state and the figures stored in the journal. */
export function stepCard(
  scheduler: FSRS,
  card: CardState | null,
  final: Grade,
  at: Date,
  offsetMin?: number,
): { card: CardState; fsrs: ReviewFsrs } {
  const before = card ?? newCardState(at);
  const r = applyReview(scheduler, before, final, at, { offsetMin: offsetMin ?? recordOffset({ at }) });
  return { card: r.card, fsrs: snapshot(before, r.card) };
}

function snapshot(before: CardState, after: CardState): ReviewFsrs {
  return {
    stateBefore: before.state,
    dueBefore: before.due,
    nextState: after.state,
    nextDue: after.due,
    stability: after.stability,
    difficulty: after.difficulty,
    scheduledDays: after.scheduledDays,
  };
}

/** What of an answer the scheduler needs. */
export type AnswerFacts = Pick<ReviewRecord, 'final' | 'at'> & Partial<Pick<ReviewRecord, 'requeue' | 'tzOffsetMin'>>;

/** A return after Again (R29.2) on a card that exists does not change it. */
export function changesCard(a: Pick<AnswerFacts, 'requeue'>, card: CardState | null): boolean {
  return !(card && (a.requeue ?? 0) > 0);
}

/**
 * The card after an answer, as the app records it and the replay rebuilds it:
 * `changed` false for a return after Again (the card and its due date stay; the
 * snapshot shows the state unchanged).
 */
export function answerCard(scheduler: FSRS, card: CardState | null, a: AnswerFacts): { card: CardState; fsrs: ReviewFsrs; changed: boolean } {
  if (card && !changesCard(a, card)) return { card, fsrs: snapshot(card, card), changed: false };
  const step = stepCard(scheduler, card, a.final, a.at, recordOffset(a));
  return { ...step, changed: true };
}

/** Cards of `userId` rebuilt from the whole journal. Introductions create no card: a card appears with its first answer. */
export function rebuildCards(scheduler: FSRS, log: readonly LogRecord[], userId: string): CardRow[] {
  const reviews = log
    .filter((r): r is ReviewRecord => r.type === 'review' && r.userId === userId)
    .sort(compareLog);
  const cards = new Map<string, CardRow>();
  for (const r of reviews) {
    const key = cardKey(r);
    const prev = cards.get(key) ?? null;
    // One set of rules exists (RULES_VERSION 2); records without a version get it too (R29.4).
    const { card, changed } = answerCard(scheduler, prev, r);
    if (!changed) continue;
    cards.set(key, { ...card, userId, deckId: r.deckId, entryId: r.entryId, skill: r.skill, lastLogId: r.id });
  }
  return [...cards.values()];
}
