/**
 * FSRS state is derived from the journal (Р10): replaying the answers of one card
 * in journal order through ts-fsrs with the final ratings gives its state.
 *
 * Determinism: the scheduler runs without fuzz. (Even with fuzz on, ts-fsrs 5.4.1
 * seeds its generator from the review time, reps and difficulty × stability, so a
 * replay would still match.) Day counts in ts-fsrs use UTC dates, so the device
 * time zone does not change the result. Each answer also stores the computed next
 * due date (`ReviewRecord.fsrs`); a test checks the rebuild reproduces it.
 */
import type { FSRS, Grade } from 'ts-fsrs';
import { cardKey, compareLog, type CardRow, type LogRecord, type ReviewFsrs, type ReviewRecord } from './model';
import { applyReview, newCardState, type CardState } from './scheduler';

/** One answer applied to a card: the new state and the figures stored in the journal. */
export function stepCard(
  scheduler: FSRS,
  card: CardState | null,
  final: Grade,
  at: Date,
): { card: CardState; fsrs: ReviewFsrs } {
  const before = card ?? newCardState(at);
  const r = applyReview(scheduler, before, final, at);
  return {
    card: r.card,
    fsrs: {
      stateBefore: before.state,
      dueBefore: before.due,
      nextState: r.card.state,
      nextDue: r.card.due,
      stability: r.card.stability,
      difficulty: r.card.difficulty,
      scheduledDays: r.card.scheduledDays,
    },
  };
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
    const { card } = stepCard(scheduler, prev, r.final, r.at);
    cards.set(key, { ...card, userId, deckId: r.deckId, entryId: r.entryId, skill: r.skill, lastLogId: r.id });
  }
  return [...cards.values()];
}
