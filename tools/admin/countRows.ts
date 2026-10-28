/**
 * Numbers of the server for the checks of 6a.6 (tools/admin/counts.ts): accounts in all and, for
 * one account, its journal rows, devices (signed out among them), sessions, consents, earlier ids
 * and whether it is being erased. Numbers only — no label, no content, the id cut to 8
 * characters. One read-only SELECT. Pure: the script and the tests use it.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export interface AccountCounts {
  found: boolean;
  /** users.deleting_at is set: the erasure has begun (R42 item 2). */
  erasing: boolean;
  journal: number;
  devices: number;
  signedOut: number;
  sessions: number;
  consents: number;
  earlierIds: number;
}

export interface Counts {
  accounts: number;
  /** Accounts being erased among them. */
  erasing: number;
  /** null — no account asked for. */
  account: AccountCounts | null;
}

/** The SELECT; `userId` null — the totals only. */
export function countsSql(userId: string | null): string {
  const totals = ['(SELECT count(*) FROM users) AS accounts', '(SELECT count(*) FROM users WHERE deleting_at IS NOT NULL) AS erasing'];
  if (userId === null) return `SELECT ${totals.join(', ')}`;
  if (!UUID.test(userId)) throw new Error('countsSql: a UUID only');
  const id = `'${userId}'`;
  const own = [
    `(SELECT count(*) FROM users WHERE id = ${id}) AS found`,
    `(SELECT count(*) FROM users WHERE id = ${id} AND deleting_at IS NOT NULL) AS being_erased`,
    `(SELECT count(*) FROM journal WHERE user_id = ${id}) AS journal`,
    `(SELECT count(*) FROM devices WHERE user_id = ${id}) AS devices`,
    `(SELECT count(*) FROM devices WHERE user_id = ${id} AND revoked_at IS NOT NULL) AS signed_out`,
    `(SELECT count(*) FROM sessions WHERE user_id = ${id}) AS sessions`,
    `(SELECT count(*) FROM consents WHERE user_id = ${id}) AS consents`,
    `(SELECT count(*) FROM user_aliases WHERE user_id = ${id}) AS earlier_ids`,
  ];
  return `SELECT ${[...totals, ...own].join(', ')}`;
}

/** The one row of countsSql. */
export function countsFrom(rows: readonly Record<string, unknown>[]): Counts {
  const row = rows[0] ?? {};
  const num = (key: string) => Number(row[key] ?? 0);
  const totals = { accounts: num('accounts'), erasing: num('erasing') };
  if (!('found' in row)) return { ...totals, account: null };
  return {
    ...totals,
    account: {
      found: num('found') > 0,
      erasing: num('being_erased') > 0,
      journal: num('journal'),
      devices: num('devices'),
      signedOut: num('signed_out'),
      sessions: num('sessions'),
      consents: num('consents'),
      earlierIds: num('earlier_ids'),
    },
  };
}

/** The lines the script prints. */
export function countsText(c: Counts, userId: string | null): string[] {
  const lines = [`Accounts: ${c.accounts} (being erased: ${c.erasing}).`];
  if (c.account === null || userId === null) return lines;
  const short = userId.slice(0, 8);
  const a = c.account;
  lines.push(
    a.found
      ? `Account ${short}: being erased: ${a.erasing ? 'yes' : 'no'}, journal ${a.journal}, devices ${a.devices} (signed out ${a.signedOut}), sessions ${a.sessions}, consents ${a.consents}, earlier ids ${a.earlierIds}.`
      : `No account ${short}.`,
  );
  return lines;
}
