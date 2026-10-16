/**
 * Session composition (Р17, Р22.4, Р25). Pure: the caller loads entries, cards and
 * the journal; nothing here touches the database.
 *
 * A card is one (entry × skill) pair: `speak`, `write`, `listen` (Р3). The soft ban
 * on new entries while reviews are overdue, the "25+" cap and the volume advice come
 * at stage 4.4.
 */
import { State } from 'ts-fsrs';
import type { Skill } from './deckFormat';
import type { CardRow, EntryRow, LogRecord } from './model';

/** The local day starts at 04:00: practice after midnight counts for the day before (Р17.10). */
export const DAY_START_HOUR = 4;
/** Cards in one portion (Р17.1): overdue reviews + first cards of new entries; introductions and returns are extra. */
export const PORTION_SIZE = 15;
/**
 * Entries introduced on an earlier day whose skills have no card yet (a skill added
 * by a new revision, a recall missed when the app was closed): at most this many a
 * day get their first cards (Р25). Counted apart from the limit of introductions.
 */
export const CATCH_UP_PER_DAY = 5;
/** Two cards of one entry (or of entries that sound the same) stand at least this many other cards apart, when there are enough cards. */
export const ENTRY_GAP = 2;
/** A card answered Again comes back after at least this many other cards (Р25). */
export const REQUEUE_MIN_GAP = 3;
/** At most this many returns of one card in a portion; the second only after Again on the first. */
export const MAX_REQUEUES = 2;

/** Order of the cards of one entry inside a portion: `listen` never before `speak`/`write` (Р17.2, Р25). */
export const SKILL_ORDER: readonly Skill[] = ['speak', 'write', 'listen'];

/** Start of the local day that contains `now`. */
export function dayStart(now: Date, hour = DAY_START_HOUR): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour);
  if (now.getTime() < d.getTime()) d.setDate(d.getDate() - 1);
  return d;
}

export type SessionItem =
  | { kind: 'intro'; entry: EntryRow }
  /**
   * `card` null: the first answer on the pair (no FSRS state yet).
   * `requeue`: 0 for the card as planned; 1 or 2 when it came back after Again.
   */
  | { kind: 'review'; skill: Skill; entry: EntryRow; card: CardRow | null; requeue: number };

export type ReviewItem = Extract<SessionItem, { kind: 'review' }>;

/** Why no new entry was added (Р17.7); stage 4.4 adds "overdue reviews". */
export type NoNewReason = 'noMaterial' | 'dailyLimit' | 'portionFull';

export interface SessionPlan {
  items: SessionItem[];
  /** Overdue reviews in the portion. */
  due: number;
  /** New entries introduced in the portion. */
  introduced: number;
  /** Entries introduced today but not answered in every skill, finished now. */
  pending: number;
  /** Entries introduced on an earlier day that get first cards of a skill now (Р25). */
  catchUp: number;
  /** Introductions left for today after this portion. */
  newLeft: number;
  noNew: NoNewReason | null;
}

export interface SessionInput {
  now: Date;
  /** Entries of the deck, hidden ones included (they are skipped here). */
  entries: readonly EntryRow[];
  /** FSRS cards of the user in this deck. */
  cards: readonly CardRow[];
  /** The user's journal: introductions and first answers of every deck count toward the daily limits. */
  log: readonly LogRecord[];
  newPerDay: number;
  portion?: number;
  /** Two entries sound the same (ravi / ravie, Р16): kept apart like cards of one entry. */
  sameSound?(a: EntryRow, b: EntryRow): boolean;
}

/**
 * The one definition of "a card the session may issue" (Р17.8): the entry is not
 * hidden, has the skill, and for `listen` has deck audio — the browser voice does
 * not teach pronunciation (Р25).
 */
export function issuable(e: EntryRow, skill: Skill): boolean {
  return !e.hidden && e.skills.includes(skill) && (skill !== 'listen' || !!e.audio);
}

/** Skills of the entry the session may issue, in the order of SKILL_ORDER. */
export function issuableSkills(e: EntryRow): Skill[] {
  return SKILL_ORDER.filter((s) => issuable(e, s));
}

const inDay = (at: Date, now: Date) => at.getTime() >= dayStart(now).getTime() && at.getTime() <= now.getTime();
const pairKey = (deckId: string, entryId: string) => `${deckId}/${entryId}`;

/** Introductions since the start of today, in any deck, hidden entries included (Р17.5, Р17.9). */
export function introsToday(log: readonly LogRecord[], now: Date): number {
  return log.filter((r) => r.type === 'intro' && inDay(r.at, now)).length;
}

/**
 * Entries, in any deck, introduced before today that had the first answer of some
 * skill today: the catch-up count (Р25).
 */
export function catchUpToday(log: readonly LogRecord[], now: Date): number {
  const from = dayStart(now).getTime();
  const introAt = new Map<string, number>();
  for (const r of log) {
    if (r.type !== 'intro') continue;
    const k = pairKey(r.deckId, r.entryId);
    introAt.set(k, Math.min(introAt.get(k) ?? Infinity, r.at.getTime()));
  }
  const entries = new Set<string>();
  for (const r of log) {
    if (r.type !== 'review' || r.fsrs.stateBefore !== State.New || !inDay(r.at, now)) continue;
    const k = pairKey(r.deckId, r.entryId);
    if ((introAt.get(k) ?? Infinity) < from) entries.add(k);
  }
  return entries.size;
}

interface Recall {
  entry: EntryRow;
  skills: Skill[];
}

/** Takes recalls in order while they fit `room`; an entry comes with all its cards or not at all. */
function fit(list: readonly Recall[], room: number, maxEntries = Infinity): Recall[] {
  const out: Recall[] = [];
  for (const r of list) {
    if (out.length >= maxEntries) break;
    if (r.skills.length > room) break;
    out.push(r);
    room -= r.skills.length;
  }
  return out;
}

/**
 * One portion. Planned: overdue cards of every skill (oldest first), then first
 * cards of entries introduced today and not finished, then catch-up entries, then
 * new entries in deck order, each with all its skills.
 * Shown as: introductions → overdue reviews → first cards in rounds (every `speak`,
 * then every `write`, then every `listen`), so reviews stand between an introduction
 * and its recall (Р22.4); then `arrange` keeps the cards of one entry apart and in
 * the order speak → write → listen.
 */
export function buildSession(input: SessionInput): SessionPlan {
  const portion = input.portion ?? PORTION_SIZE;
  const now = input.now.getTime();
  const today = dayStart(input.now).getTime();
  const byId = new Map(input.entries.map((e) => [e.entryId, e]));
  const has = new Set(input.cards.map((c) => `${c.entryId}/${c.skill}`));
  const deckId = input.entries[0]?.deckId;
  const introAt = new Map<string, number>();
  for (const r of input.log) {
    if (r.type === 'intro' && r.deckId === deckId) introAt.set(r.entryId, Math.min(introAt.get(r.entryId) ?? Infinity, r.at.getTime()));
  }
  // An entry with a card but no introduction in this journal (an old or restored one) is known already.
  for (const c of input.cards) if (!introAt.has(c.entryId)) introAt.set(c.entryId, -Infinity);

  const due = input.cards
    .filter((c) => c.due.getTime() <= now)
    .flatMap((c) => {
      const e = byId.get(c.entryId);
      return e && issuable(e, c.skill) ? [{ entry: e, card: c }] : [];
    })
    .sort((a, b) => a.card.due.getTime() - b.card.due.getTime())
    .slice(0, portion);

  const ordered = [...input.entries].filter((e) => issuableSkills(e).length > 0).sort((a, b) => a.position - b.position);
  const missing = (e: EntryRow): Recall => ({ entry: e, skills: issuableSkills(e).filter((s) => !has.has(`${e.entryId}/${s}`)) });
  const started = ordered.filter((e) => introAt.has(e.entryId)).map(missing).filter((r) => r.skills.length > 0);

  let room = portion - due.length;
  const pending = fit(started.filter((r) => introAt.get(r.entry.entryId)! >= today), Math.max(0, room));
  room -= pending.reduce((n, r) => n + r.skills.length, 0);
  const catchBudget = Math.max(0, CATCH_UP_PER_DAY - catchUpToday(input.log, input.now));
  const catchUp = fit(started.filter((r) => introAt.get(r.entry.entryId)! < today), Math.max(0, room), catchBudget);
  room -= catchUp.reduce((n, r) => n + r.skills.length, 0);

  const notIntroduced = ordered.filter((e) => !introAt.has(e.entryId)).map((e) => ({ entry: e, skills: issuableSkills(e) }));
  const budget = Math.max(0, input.newPerDay - introsToday(input.log, input.now));
  const fresher = fit(notIntroduced, Math.max(0, room), budget);

  let noNew: NoNewReason | null = null;
  if (fresher.length === 0) {
    if (notIntroduced.length === 0) noNew = 'noMaterial';
    else if (budget === 0) noNew = 'dailyLimit';
    else noNew = 'portionFull';
  }

  const recalls = [...pending, ...catchUp, ...fresher].sort((a, b) => a.entry.position - b.entry.position);
  const rounds: ReviewItem[] = SKILL_ORDER.flatMap((skill) =>
    recalls.filter((r) => r.skills.includes(skill)).map((r): ReviewItem => ({ kind: 'review', skill, entry: r.entry, card: null, requeue: 0 })),
  );
  const intros = fresher.map(({ entry }): SessionItem => ({ kind: 'intro', entry }));
  const reviews: ReviewItem[] = [
    ...due.map(({ entry, card }): ReviewItem => ({ kind: 'review', skill: card.skill, entry, card, requeue: 0 })),
    ...rounds,
  ];
  return {
    items: arrange(intros, reviews, soundGroups(input.entries, input.sameSound)),
    due: due.length,
    introduced: fresher.length,
    pending: pending.length,
    catchUp: catchUp.length,
    newLeft: budget - fresher.length,
    noNew,
  };
}

/** entryId → spacing key: entries that sound the same share one (Р16). */
export function soundGroups(entries: readonly EntryRow[], sameSound?: (a: EntryRow, b: EntryRow) => boolean): Map<string, string> {
  const group = new Map(entries.map((e) => [e.entryId, e.entryId]));
  if (!sameSound) return group;
  const live = entries.filter((e) => !e.hidden);
  for (let i = 0; i < live.length; i++) {
    for (let j = 0; j < i; j++) {
      if (sameSound(live[i]!, live[j]!)) {
        const from = group.get(live[i]!.entryId)!;
        const to = group.get(live[j]!.entryId)!;
        for (const [k, v] of group) if (v === from) group.set(k, to);
      }
    }
  }
  return group;
}

/**
 * Order of the cards after the introductions. Greedy over the planned order: the
 * next card is the first one whose entry has no card of an earlier skill still
 * waiting (speak → write → listen, always) and whose spacing key is not among the
 * last ENTRY_GAP items; if every waiting card is that close, the first allowed one.
 */
export function arrange(intros: readonly SessionItem[], reviews: readonly ReviewItem[], groups: ReadonlyMap<string, string>): SessionItem[] {
  const key = (i: SessionItem) => groups.get(i.entry.entryId) ?? i.entry.entryId;
  const rank = (s: Skill) => SKILL_ORDER.indexOf(s);
  const out: SessionItem[] = [...intros];
  const left = [...reviews];
  while (left.length > 0) {
    const allowed = left.filter(
      (c) => !left.some((o) => o !== c && o.entry.entryId === c.entry.entryId && rank(o.skill) < rank(c.skill)),
    );
    const recent = new Set(out.slice(-ENTRY_GAP).map(key));
    const pick = allowed.find((c) => !recent.has(key(c))) ?? allowed[0]!;
    out.push(pick);
    left.splice(left.indexOf(pick), 1);
  }
  return out;
}

/**
 * A card answered Again at `index` comes back at the end of the portion (Р25):
 * not sooner than REQUEUE_MIN_GAP other cards later, at most MAX_REQUEUES times.
 * Returns the new list, or null when it does not come back in this portion — FSRS
 * brings it back in 1–10 minutes anyway.
 */
export function requeueAfterAgain(items: readonly SessionItem[], index: number): SessionItem[] | null {
  const item = items[index];
  if (!item || item.kind !== 'review' || item.requeue >= MAX_REQUEUES) return null;
  if (items.length - index - 1 < REQUEUE_MIN_GAP) return null;
  return [...items, { ...item, requeue: item.requeue + 1 }];
}

/** Cards and seconds since the last card of the same entry in this portion; nulls when there was none. */
export interface SinceEntry {
  cards: number | null;
  sec: number | null;
}

/** `shown`: the items shown so far in the portion (index → time), introductions included. */
export function sinceEntry(items: readonly SessionItem[], shownAt: ReadonlyMap<number, Date>, index: number, now: Date): SinceEntry {
  const id = items[index]!.entry.entryId;
  for (let k = index - 1; k >= 0; k--) {
    if (items[k]!.entry.entryId !== id) continue;
    const at = shownAt.get(k);
    return { cards: index - k - 1, sec: at ? Math.round((now.getTime() - at.getTime()) / 1000) : null };
  }
  return { cards: null, sec: null };
}
