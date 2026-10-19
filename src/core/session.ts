/**
 * Session composition (Р17, Р22.4, Р25, Р29). Pure: the caller loads entries, cards
 * and the journal; nothing here touches the database.
 *
 * A card is one (entry × skill) pair: `speak`, `write`, `listen` (Р3). A card is due
 * on its due day — the app day of its last answer + the interval in days (Р29.3) —
 * and a debt once that day is past. Debts in any deck hold back new entries until
 * they are done, unless the user adds new ones anyway for one portion (Р17.4, Р29.5).
 * The volume advice of Р7 comes at stage 4.4b.
 */
import { State } from 'ts-fsrs';
import type { Skill } from './deckFormat';
import type { CardRow, EntryRow, LogRecord } from './model';
import type { CardState } from './scheduler';
import { appDay, dayStart, LEGACY_ZONE, offsetAt, today as appToday } from './zone';

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
/** Counts on screen stop here: "25+" (Р17.6). Exact figures stay for calculations. */
export const SHOWN_CAP = 25;

/** Order of the cards of one entry inside a portion: `listen` never before `speak`/`write` (Р17.2, Р25). */
export const SKILL_ORDER: readonly Skill[] = ['speak', 'write', 'listen'];

/** A count as shown: at most "25+" (Р17.6). */
export function capped(n: number): string {
  return n > SHOWN_CAP ? `${SHOWN_CAP}+` : String(n);
}

/**
 * The due day of a card (Р29.3): the app day of its last answer, in the zone of that
 * answer, + the interval in days. A card is due once this day has come.
 */
export function dueDay(c: Pick<CardState, 'due' | 'lastReview' | 'lastReviewOffsetMin' | 'scheduledDays'>): number {
  if (!c.lastReview) return appDay(c.due, offsetAt(LEGACY_ZONE, c.due));
  const off = c.lastReviewOffsetMin ?? offsetAt(LEGACY_ZONE, c.lastReview);
  return appDay(c.lastReview, off) + c.scheduledDays;
}

export type SessionItem =
  | { kind: 'intro'; entry: EntryRow }
  /**
   * `card` null: the first answer on the pair (no FSRS state yet).
   * `requeue`: 0 for the card as planned; 1 or 2 when it came back after Again.
   */
  | { kind: 'review'; skill: Skill; entry: EntryRow; card: CardRow | null; requeue: number };

export type ReviewItem = Extract<SessionItem, { kind: 'review' }>;

/**
 * Why no new card was added (Р17.7): no material / a daily limit / debts / reviews took
 * the places. "New" = first cards of new entries and of skills of known entries
 * (catch-up, Р25.9); one line for both daily limits (phone check 19.10.2026).
 */
export type NoNewReason = 'noMaterial' | 'dailyLimit' | 'overdue' | 'portionFull';

/** Debts of one deck. */
export interface DeckCount {
  deckId: string;
  count: number;
}

export interface SessionPlan {
  items: SessionItem[];
  /** Reviews in the portion (debts and today's). */
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
  /** Debts by deck, exact (this deck first, then by count): any of them holds back new entries (Р29.5). */
  debts: DeckCount[];
}

/** What the session and the outlook see: every deck of the user (debts and limits span them all). */
export interface DayInput {
  now: Date;
  /** Zone of the device now (IANA): "today" is counted in it (Р29.3). */
  tz: string;
  /** The deck being studied. */
  deckId: string;
  /** Entries of every deck, hidden ones included (they are skipped here). */
  entries: readonly EntryRow[];
  /** FSRS cards of the user in every deck. */
  cards: readonly CardRow[];
}

export interface SessionInput extends DayInput {
  /** The user's journal: introductions and first answers of every deck count toward the daily limits. */
  log: readonly LogRecord[];
  newPerDay: number;
  portion?: number;
  /** Two entries sound the same (ravi / ravie, Р16): kept apart like cards of one entry. */
  sameSound?(a: EntryRow, b: EntryRow): boolean;
  /** "Add anyway" (Р29.5): this one portion gets new entries in spite of debts; their recalls take places first. */
  addAnyway?: boolean;
}

/**
 * The one definition of "a card the session may issue" (Р17.8): the entry is not
 * hidden, has the skill, and for `listen` has deck audio — the browser voice does
 * not teach pronunciation (Р25). For a card with a state, also: its due day has come.
 */
export function issuable(e: EntryRow, skill: Skill): boolean {
  return !e.hidden && e.skills.includes(skill) && (skill !== 'listen' || !!e.audio);
}

/** Skills of the entry the session may issue, in the order of SKILL_ORDER. */
export function issuableSkills(e: EntryRow): Skill[] {
  return SKILL_ORDER.filter((s) => issuable(e, s));
}

const pairKey = (deckId: string, entryId: string) => `${deckId}/${entryId}`;

interface DueCard {
  entry: EntryRow;
  card: CardRow;
  day: number;
}

/** Cards of every deck that may be issued (Р17.8) with their due day; `today` in the zone of the device. */
function dueCards(input: DayInput): { today: number; cards: DueCard[] } {
  const today = appToday(input.now, input.tz);
  const byKey = new Map(input.entries.map((e) => [pairKey(e.deckId, e.entryId), e]));
  const cards: DueCard[] = [];
  for (const c of input.cards) {
    const e = byKey.get(pairKey(c.deckId, c.entryId));
    if (e && issuable(e, c.skill)) cards.push({ entry: e, card: c, day: dueDay(c) });
  }
  return { today, cards };
}

function debtsOf(cards: readonly DueCard[], today: number, deckId: string): DeckCount[] {
  const by = new Map<string, number>();
  for (const c of cards) if (c.day < today) by.set(c.card.deckId, (by.get(c.card.deckId) ?? 0) + 1);
  return [...by]
    .map(([d, count]) => ({ deckId: d, count }))
    .sort((a, b) => Number(b.deckId === deckId) - Number(a.deckId === deckId) || b.count - a.count || a.deckId.localeCompare(b.deckId));
}

/** Figures for the end of a portion, the empty queue and the deck screen (Р29.6); exact, capped only when shown. */
export interface Outlook {
  /** Reviews due today or earlier in this deck: "today still N", tied to "Another round". */
  today: number;
  /** Reviews due tomorrow, every deck. */
  tomorrow: number;
  /** Reviews due from tomorrow over 7 days, every deck; only the due dates set so far. */
  week: number;
  /**
   * New cards this deck may still give today: recalls of entries introduced today,
   * catch-up within its daily limit and new entries within theirs, every skill
   * counted. Debts do not lower it (they only hold the new cards back, Р29.5).
   */
  fresh: number;
  debts: DeckCount[];
}

export function outlook(input: DayInput & Pick<SessionInput, 'log' | 'newPerDay'>): Outlook {
  const { today, cards } = dueCards(input);
  let here = 0;
  let tomorrow = 0;
  let week = 0;
  for (const c of cards) {
    if (c.day <= today && c.card.deckId === input.deckId) here++;
    if (c.day === today + 1) tomorrow++;
    if (c.day > today && c.day <= today + 7) week++;
  }
  const m = newMaterial(input);
  const skills = (list: readonly Recall[]) => list.reduce((n, r) => n + r.skills.length, 0);
  const fresh = skills(m.startedToday) + skills(m.startedBefore.slice(0, m.catchBudget)) + skills(m.notIntroduced.slice(0, m.budget));
  return { today: here, tomorrow, week, fresh, debts: debtsOf(cards, today, input.deckId) };
}

/** True when `at` falls in the app day of `now` in `tz`. */
function inToday(at: Date, now: Date, tz: string): boolean {
  return at.getTime() >= dayStart(now, tz).getTime() && at.getTime() <= now.getTime();
}

/** Introductions since the start of today, in any deck, hidden entries included (Р17.5, Р17.9). */
export function introsToday(log: readonly LogRecord[], now: Date, tz: string): number {
  return log.filter((r) => r.type === 'intro' && inToday(r.at, now, tz)).length;
}

/**
 * Entries, in any deck, introduced before today that had the first answer of some
 * skill today: the catch-up count (Р25).
 */
export function catchUpToday(log: readonly LogRecord[], now: Date, tz: string): number {
  const from = dayStart(now, tz).getTime();
  const introAt = new Map<string, number>();
  for (const r of log) {
    if (r.type !== 'intro') continue;
    const k = pairKey(r.deckId, r.entryId);
    introAt.set(k, Math.min(introAt.get(k) ?? Infinity, r.at.getTime()));
  }
  const entries = new Set<string>();
  for (const r of log) {
    if (r.type !== 'review' || r.fsrs.stateBefore !== State.New || !inToday(r.at, now, tz)) continue;
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

/** First cards this deck could give: today's introductions, catch-up, new entries; with the room the daily limits leave. */
interface NewMaterial {
  /** Entries introduced today with skills still unanswered (Р17.3): always issued. */
  startedToday: Recall[];
  /** Entries known from an earlier day with skills never answered: catch-up (Р25.9). */
  startedBefore: Recall[];
  notIntroduced: Recall[];
  /** Introductions left today (Р17.5). */
  budget: number;
  /** Catch-up entries left today. */
  catchBudget: number;
}

function newMaterial(input: DayInput & Pick<SessionInput, 'log' | 'newPerDay'>): NewMaterial {
  const { deckId } = input;
  const entries = input.entries.filter((e) => e.deckId === deckId);
  const cards = input.cards.filter((c) => c.deckId === deckId);
  const has = new Set(cards.map((c) => `${c.entryId}/${c.skill}`));
  const start = dayStart(input.now, input.tz).getTime();
  const introAt = new Map<string, number>();
  for (const r of input.log) {
    if (r.type === 'intro' && r.deckId === deckId) introAt.set(r.entryId, Math.min(introAt.get(r.entryId) ?? Infinity, r.at.getTime()));
  }
  // An entry with a card but no introduction in this journal (an old or restored one) is known already.
  for (const c of cards) if (!introAt.has(c.entryId)) introAt.set(c.entryId, -Infinity);
  const ordered = [...entries].filter((e) => issuableSkills(e).length > 0).sort((a, b) => a.position - b.position);
  const missing = (e: EntryRow): Recall => ({ entry: e, skills: issuableSkills(e).filter((s) => !has.has(`${e.entryId}/${s}`)) });
  const started = ordered.filter((e) => introAt.has(e.entryId)).map(missing).filter((r) => r.skills.length > 0);
  return {
    startedToday: started.filter((r) => introAt.get(r.entry.entryId)! >= start),
    startedBefore: started.filter((r) => introAt.get(r.entry.entryId)! < start),
    notIntroduced: ordered.filter((e) => !introAt.has(e.entryId)).map((e) => ({ entry: e, skills: issuableSkills(e) })),
    budget: Math.max(0, input.newPerDay - introsToday(input.log, input.now, input.tz)),
    catchBudget: Math.max(0, CATCH_UP_PER_DAY - catchUpToday(input.log, input.now, input.tz)),
  };
}

/**
 * One portion.
 *
 * Places, as a rule: due cards of this deck (debts and today's, oldest first), then
 * first cards of entries introduced today and not finished, then catch-up entries,
 * then new entries in deck order, each with all its skills. Checks for new entries:
 * material → daily limit → debts in any deck → room (Р17.5, Р29.5). With debts, no
 * introductions and no catch-up; the recalls of today's introductions always come
 * (Р17.3). "Add anyway" (one portion): the recalls of new entries — today's and the
 * new ones within the limit — take places first, the due cards the rest, catch-up last.
 *
 * Shown as: introductions → due cards → first cards in rounds (every `speak`, then
 * every `write`, then every `listen`), so reviews stand between an introduction and
 * its recall (Р22.4); then `arrange` keeps the cards of one entry apart and in the
 * order speak → write → listen.
 */
export function buildSession(input: SessionInput): SessionPlan {
  const portion = input.portion ?? PORTION_SIZE;
  const { deckId } = input;
  const { today, cards: allDue } = dueCards(input);
  const debts = debtsOf(allDue, today, deckId);
  const anyDebt = debts.length > 0;
  const forced = anyDebt && input.addAnyway === true;
  const blocked = anyDebt && !forced;

  const entries = input.entries.filter((e) => e.deckId === deckId);
  const due = allDue
    .filter((c) => c.card.deckId === deckId && c.day <= today)
    .sort((a, b) => a.card.due.getTime() - b.card.due.getTime());
  const { startedToday, startedBefore, notIntroduced, budget, catchBudget } = newMaterial(input);

  let room = portion;
  const take = (list: readonly Recall[], maxEntries = Infinity) => {
    const got = fit(list, room, maxEntries);
    room -= got.reduce((n, r) => n + r.skills.length, 0);
    return got;
  };
  const takeDue = () => {
    const got = due.slice(0, room);
    room -= got.length;
    return got;
  };
  let dueTaken: DueCard[];
  let pending: Recall[];
  let catchUp: Recall[] = [];
  let fresher: Recall[] = [];
  if (forced) {
    pending = take(startedToday);
    fresher = take(notIntroduced, budget);
    dueTaken = takeDue();
    catchUp = take(startedBefore, catchBudget);
  } else {
    dueTaken = takeDue();
    pending = take(startedToday);
    if (!blocked) {
      catchUp = take(startedBefore, catchBudget);
      fresher = take(notIntroduced, budget);
    }
  }

  // New cards: new entries and catch-up (Р25.9). Checks: material → daily limits → debts → room (Р29.5).
  let noNew: NoNewReason | null = null;
  if (fresher.length + catchUp.length === 0) {
    const newLeft = notIntroduced.length > 0 && budget > 0;
    const catchLeft = startedBefore.length > 0 && catchBudget > 0;
    if (notIntroduced.length + startedBefore.length === 0) noNew = 'noMaterial';
    else if (!newLeft && !catchLeft) noNew = 'dailyLimit';
    else if (blocked) noNew = 'overdue';
    else noNew = 'portionFull';
  }

  const recalls = [...pending, ...catchUp, ...fresher].sort((a, b) => a.entry.position - b.entry.position);
  const rounds: ReviewItem[] = SKILL_ORDER.flatMap((skill) =>
    recalls.filter((r) => r.skills.includes(skill)).map((r): ReviewItem => ({ kind: 'review', skill, entry: r.entry, card: null, requeue: 0 })),
  );
  const intros = fresher.map(({ entry }): SessionItem => ({ kind: 'intro', entry }));
  const reviews: ReviewItem[] = [
    ...dueTaken.map(({ entry, card }): ReviewItem => ({ kind: 'review', skill: card.skill, entry, card, requeue: 0 })),
    ...rounds,
  ];
  return {
    items: arrange(intros, reviews, soundGroups(entries, input.sameSound)),
    due: dueTaken.length,
    introduced: fresher.length,
    pending: pending.length,
    catchUp: catchUp.length,
    newLeft: budget - fresher.length,
    noNew,
    debts,
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
 *
 * Last places (Р25.8, fixed after the phone check of 19.10.2026): the greedy order
 * alone left the cards of one entry for the tail, where nothing was left to put
 * between them (oui/write, oui/listen after 12 reviews). A spacing key with k cards
 * left must start no later than place L − 1 − (k − 1)·(ENTRY_GAP + 1), L being the
 * length of the portion. Keys whose last places fall together are served in that
 * order, one place earlier each (counted back from the latest). A key at its last
 * place goes first; when it is too close to its previous card, nothing is forced —
 * with too few places the result is the plain greedy order.
 */
export function arrange(intros: readonly SessionItem[], reviews: readonly ReviewItem[], groups: ReadonlyMap<string, string>): SessionItem[] {
  const key = (i: SessionItem) => groups.get(i.entry.entryId) ?? i.entry.entryId;
  const rank = (s: Skill) => SKILL_ORDER.indexOf(s);
  const out: SessionItem[] = [...intros];
  const left = [...reviews];
  const total = intros.length + reviews.length;
  while (left.length > 0) {
    const allowed = left.filter(
      (c) => !left.some((o) => o !== c && o.entry.entryId === c.entry.entryId && rank(o.skill) < rank(c.skill)),
    );
    const recent = new Set(out.slice(-ENTRY_GAP).map(key));
    const urgent = lastPlaces(left, key, total);
    const place = out.length;
    const pressing = allowed
      .filter((c) => !recent.has(key(c)) && urgent.get(key(c))! <= place)
      .sort((a, b) => urgent.get(key(a))! - urgent.get(key(b))!);
    const pick = pressing[0] ?? allowed.find((c) => !recent.has(key(c))) ?? allowed[0]!;
    out.push(pick);
    left.splice(left.indexOf(pick), 1);
  }
  return out;
}

/**
 * The last place where the next card of each spacing key may stand so that its
 * remaining cards still fit ENTRY_GAP apart before the end of the portion; keys with
 * the same or crowding last places are moved earlier one by one (latest first).
 * A key with one card left has no last place (Infinity): it never presses.
 */
function lastPlaces(left: readonly ReviewItem[], key: (i: SessionItem) => string, total: number): Map<string, number> {
  const count = new Map<string, number>();
  const firstAt = new Map<string, number>();
  left.forEach((c, k) => {
    const g = key(c);
    count.set(g, (count.get(g) ?? 0) + 1);
    if (!firstAt.has(g)) firstAt.set(g, k);
  });
  const own = [...count].map(([g, n]) => ({ g, last: total - 1 - (n - 1) * (ENTRY_GAP + 1) }));
  // Latest first; on a tie the key planned later keeps the later place.
  own.sort((a, b) => b.last - a.last || firstAt.get(b.g)! - firstAt.get(a.g)!);
  const out = new Map<string, number>();
  let bound = Infinity;
  for (const { g, last } of own) {
    if (count.get(g)! < 2) {
      out.set(g, Infinity);
      continue;
    }
    bound = Math.min(last, bound - 1);
    out.set(g, bound);
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
