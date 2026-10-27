/**
 * The account itself (stage 6a.5, R42): a copy of everything the server keeps for it, and its
 * erasure. Both work without consent to the current notice (R42 item 1): a person may always
 * take their data and leave.
 *
 * Erasure (R42 items 2–3): step 1 — one batch that marks the account and removes its sessions,
 * codes, invitations and admin rows (from here on every device of the account gets a plain 401,
 * this one too); step 2 — the journal in portions, each its own query, so progress stays when a
 * call ends; step 3 — the users row, the cascade takes the rest. What a call leaves unfinished the
 * hourly Cron finishes (finishErasures). D1 counts queries per invocation (a batch is one): every
 * call spends from a budget.
 */
import { EXPORT_PAGE, headFromRows, serverRecordFromRow } from '../src/core/accountRows.ts';
import { ERASE_SQL, eraseDetail, EXPORT_SQL, MARKED_SQL, type EraseVia } from './accountSql.ts';
import type { Call } from './api.ts';
import { withSession } from './auth.ts';
import { ERASE_CRON_PORTIONS, ERASE_CRON_TIME, ERASE_PORTION, ERASE_REQUEST_PORTIONS, ERASE_REQUEST_TIME, QUERIES_PER_INVOCATION } from './config.ts';
import { API_HEADERS, error, json } from './http.ts';
import { clearCookie } from './session.ts';
import { queryInt, queryLimit } from './sync.ts';

type Json = Record<string, unknown>;

/** What one invocation may still spend on an erasure. */
export interface EraseBudget {
  /** Queries left (a batch is one). */
  queries: number;
  /** Journal portions left. */
  portions: number;
  /** No new portion from this time on (ms, `clock`). */
  until: number;
  clock(): number;
  /** Journal rows per portion. */
  size: number;
}

/** Step 1: the mark and everything that lets anyone in or names the account in admin rows. One query. */
export async function startErasure(db: D1Database, userId: string, via: EraseVia, now: number, budget: EraseBudget): Promise<void> {
  budget.queries--;
  await db.batch([
    db.prepare(ERASE_SQL.adminRow).bind(userId, crypto.randomUUID(), now, eraseDetail(via)),
    db.prepare(ERASE_SQL.mark).bind(userId, now),
    db.prepare(ERASE_SQL.sessions).bind(userId),
    db.prepare(ERASE_SQL.codes).bind(userId),
    db.prepare(ERASE_SQL.invites).bind(userId),
    db.prepare(ERASE_SQL.adminActions).bind(userId),
  ]);
}

/**
 * Steps 2–3 for a marked account: journal portions while the budget lasts, then the users row.
 * True — the account is gone; false — the budget ended first (one query is always kept for step 3).
 */
export async function continueErasure(db: D1Database, userId: string, budget: EraseBudget): Promise<boolean> {
  for (;;) {
    if (budget.queries < 2 || budget.portions < 1 || budget.clock() >= budget.until) return false;
    budget.queries--;
    budget.portions--;
    const result = await db.prepare(ERASE_SQL.portion).bind(userId, budget.size).run();
    if (Number(result.meta.changes ?? 0) < budget.size) break;
  }
  budget.queries--;
  await db.prepare(ERASE_SQL.account).bind(userId).run();
  return true;
}

/** Steps 1–3 for a delete request. True — finished; false — the Cron finishes it. */
export async function eraseAccount(db: D1Database, userId: string, via: EraseVia, now: number, budget: EraseBudget): Promise<boolean> {
  await startErasure(db, userId, via, now, budget);
  return continueErasure(db, userId, budget);
}

/** Accounts looked at in one Cron run. */
const CRON_ACCOUNTS = 10;

/** The Cron's part: erasures left unfinished, oldest first, while the budget lasts. */
export async function finishErasures(db: D1Database, budget: EraseBudget): Promise<void> {
  if (budget.queries < 2) return;
  budget.queries--;
  const { results } = await db.prepare(MARKED_SQL).bind(CRON_ACCOUNTS).all<{ id: string }>();
  for (const { id } of results) {
    if (!(await continueErasure(db, id, budget))) return;
  }
}

/** The Cron's budget after its own cleanup batch (one query). */
export function cronBudget(clock: () => number = Date.now): EraseBudget {
  return { queries: QUERIES_PER_INVOCATION - 1, portions: ERASE_CRON_PORTIONS, until: clock() + ERASE_CRON_TIME, clock, size: ERASE_PORTION };
}

/** A delete request's budget after reading the session (a read and, once a day, a write). */
export function requestBudget(clock: () => number = Date.now): EraseBudget {
  return { queries: QUERIES_PER_INVOCATION - 2, portions: ERASE_REQUEST_PORTIONS, until: clock() + ERASE_REQUEST_TIME, clock, size: ERASE_PORTION };
}

const isObject = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * POST /api/account/delete {confirm: 'delete'} — erases the account of this session. The session
 * ends with step 1, so a repeat gets 401; what is left the Cron finishes. `finished` — all of it gone.
 */
export const deleteAccount = withSession(async ({ env, body, now }: Call, session) => {
  if (!isObject(body) || body.confirm !== 'delete') return error('bad_request', 400);
  const finished = await eraseAccount(env.DB, session.userId, 'app', now, requestBudget());
  return json({ finished }, 200, { 'Set-Cookie': clearCookie(session.profile) });
});

/** GET /api/account/export — everything the server keeps for the account but the journal (one query). */
export const exportHead = withSession(async ({ env }: Call, session) => {
  const db = env.DB;
  const one = (sql: string) => db.prepare(sql).bind(session.userId);
  const [account, devices, consents, formerNumbers, settings, adminActions, count] = await db.batch<Json>([
    one(EXPORT_SQL.account),
    one(EXPORT_SQL.devices),
    one(EXPORT_SQL.consents),
    one(EXPORT_SQL.formerNumbers),
    one(EXPORT_SQL.settings),
    one(EXPORT_SQL.adminActions),
    one(EXPORT_SQL.journalCount),
  ]);
  const row = account!.results[0];
  if (!row) return error('unauthorized', 401);
  return json(
    headFromRows({
      account: row,
      devices: devices!.results,
      consents: consents!.results,
      formerNumbers: formerNumbers!.results,
      settings: settings!.results,
      adminActions: adminActions!.results,
      journalCount: Number(count!.results[0]?.n ?? 0),
    }),
  );
});

/**
 * GET /api/account/export/journal?after=<seq>&limit=<n> — one page of the journal with what the
 * server keeps about each record. Bodies go out as stored, without being parsed (like the pull).
 */
export const exportJournal = withSession(async ({ request, env }: Call, session) => {
  const params = new URL(request.url).searchParams;
  const after = queryInt(params, 'after', 0, 0, Number.MAX_SAFE_INTEGER);
  const limit = queryLimit(params, EXPORT_PAGE);
  if (after === null || limit === null) return error('bad_request', 400);
  const { results } = await env.DB.prepare(EXPORT_SQL.journalPage).bind(session.userId, after, limit + 1).all<Json>();
  const page = results.slice(0, limit);
  const next = page.length > 0 ? Number(page[page.length - 1]!.seq) : after;
  const tail = JSON.stringify({ server: page.map(serverRecordFromRow), next, more: results.length > limit }).slice(1);
  const text = `{"records":[${page.map((r) => String(r.body)).join(',')}],${tail}`;
  return new Response(text, { status: 200, headers: new Headers(API_HEADERS) });
});
