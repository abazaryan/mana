/**
 * The account's copy and erasure outside the Worker (stage 6a.5, R42): the admin scripts' SQL on
 * the test database leaves no trace; the trace check covers every text column; the copy — from the
 * admin script and from the app's routes — is taken by restore from a file as it is today.
 */
import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { accountExportFileName, buildAccountExport, serializeAccountExport, ADMIN_EXPORT_DEVICE } from '../src/core/accountExport';
import type { ExportHead, ExportJournalPage } from '../src/core/accountRows';
import { parseBackup, planAccountRestore, planRestore } from '../src/core/backup';
import { createScheduler } from '../src/core/scheduler';
import { ManaDb } from '../src/platform/db';
import { ensureDevice, restoreJournal, userLog } from '../src/platform/repo';
import { exportFrom, idsOf, portionSql, startSql } from '../tools/admin/accountAdmin';
import { inline, outName } from '../tools/admin/d1';
import { TEXT_COLUMNS, traceSql, tracesFrom } from '../tools/admin/traces';
import { ERASE_SQL } from '../worker/accountSql';
import { ERASE_PORTION } from '../worker/config';
import { DAY, HOUR, send, signedIn, T0, world, type SignedIn, type World } from '../worker/test/accounts';

let n = 0;
function record(who: SignedIn): Record<string, unknown> {
  n++;
  return {
    id: crypto.randomUUID(),
    type: 'review',
    userId: who.userId,
    deviceId: who.deviceId,
    at: new Date(T0 - HOUR + n).toISOString(),
    deckId: 'test-speak',
    entryId: `e${n % 7}`,
    deckRevision: 9,
    sessionId: 's1',
    skill: 'speak',
    final: 3,
    suggested: 3,
    rules: 2,
    answer: 'bonjour',
    fsrs: { stateBefore: 2, dueBefore: new Date(T0 - DAY).toISOString(), nextDue: new Date(T0 + 3 * DAY).toISOString() },
  };
}

const read = (w: World) => (text: string) => w.db.sqlite.prepare(text).all() as Record<string, unknown>[];
const traces = (w: World, ids: string[]) => tracesFrom(read(w)(traceSql(ids)));

/** An account with two devices, records, a setting, an earlier id and an admin row. */
async function account(w: World, records = 3): Promise<{ a: SignedIn; b: SignedIn }> {
  const a = await signedIn(w);
  const b = await signedIn(w, a.userId);
  const body = { records: Array.from({ length: records }, () => record(a)), settings: [{ key: 'newPerDay', value: 7, mode: 'set' }] };
  expect((await send(w, '/api/sync/push', { cookie: a.cookie, body })).status).toBe(200);
  w.db.sqlite.prepare('INSERT INTO user_aliases (user_id, alias_id, added_at) VALUES (?, ?, ?)').run(a.userId, crypto.randomUUID(), T0);
  w.db.sqlite.prepare("INSERT INTO admin_actions (id, at, action, user_id, detail) VALUES (?, ?, 'revoke', ?, ?)").run(crypto.randomUUID(), T0, a.userId, JSON.stringify({ device: b.deviceId }));
  return { a, b };
}

describe('the trace check (tools/admin/traces.ts)', () => {
  it('covers every TEXT column of the schema', () => {
    const w = world();
    const columns = w.db.sqlite
      .prepare("SELECT m.name AS t, p.name AS c FROM sqlite_schema m, pragma_table_info(m.name) p WHERE m.type = 'table' AND m.name NOT LIKE 'sqlite_%' AND p.type = 'TEXT' ORDER BY 1, 2")
      .all() as { t: string; c: string }[];
    expect([...TEXT_COLUMNS].map(([t, c]) => `${t}.${c}`).sort()).toEqual(columns.map(({ t, c }) => `${t}.${c}`).sort());
  });

  it('finds an id in any column, inside JSON too; takes UUIDs only', async () => {
    const w = world();
    const { a, b } = await account(w);
    const places = traces(w, [b.deviceId]).map((p) => p.place);
    expect(places).toEqual(expect.arrayContaining(['devices.id', 'sessions.device_id', 'admin_actions.detail']));
    expect(traces(w, [a.userId.toUpperCase()]).length).toBeGreaterThan(3);
    expect(() => traceSql(["x') OR 1=1 --"])).toThrow();
    expect(() => traceSql([])).toThrow();
  });
});

describe('the admin erasure (delete-account.ts SQL)', () => {
  it('steps 1–3 with literals erase the account; no trace; one admin row "admin" without the account', async () => {
    const w = world();
    const { a } = await account(w, 5);
    const other = await signedIn(w);
    const file = exportFrom(read(w), a.userId, T0);
    const ids = idsOf(file);
    expect(ids).toHaveLength(4);
    w.db.sqlite.exec(startSql(a.userId, T0));
    w.db.sqlite.exec(startSql(a.userId, T0 + 1)); // again: changes nothing
    const { changes } = w.db.sqlite.prepare(inline(ERASE_SQL.portion, [a.userId, 2])).run();
    expect(Number(changes)).toBe(2);
    expect(read(w)(portionSql(a.userId))).toHaveLength(3); // the rest, counted from RETURNING
    expect(read(w)(portionSql(a.userId))).toHaveLength(0);
    w.db.sqlite.exec(inline(ERASE_SQL.account, [a.userId]));
    expect(traces(w, ids)).toEqual([]);
    expect(read(w)("SELECT user_id, detail FROM admin_actions WHERE action = 'delete'")).toEqual([{ user_id: null, detail: '{"via":"admin"}' }]);
    expect(traces(w, [other.userId, other.deviceId]).length).toBeGreaterThan(0);
    expect(ERASE_PORTION).toBe(1000);
  });

  it('inline puts values in as literals and refuses a missing one', () => {
    expect(inline('SELECT ?1, ?2, ?1', ["it's", 5])).toBe("SELECT 'it''s', 5, 'it''s'");
    expect(() => inline('SELECT ?2', ['x'])).toThrow();
  });

  it('files in tools/.out are named by kind and time, never by label', () => {
    expect(outName('export', 'json', Date.UTC(2026, 9, 26, 17, 5, 9))).toBe('export-20261026-170509.json');
    for (const script of ['invite', 'recover']) {
      const text = readFileSync(new URL(`../tools/admin/${script}.ts`, import.meta.url), 'utf8');
      expect(text).toMatch(new RegExp(`handOverLink\\(target, [^\\n]*'${script}', now\\)`));
      expect(text).not.toMatch(/`(invite|recover)-\$\{label\}`/);
    }
  });
});

describe('the copy of the account is a journal file (R42 item 5)', () => {
  it('the admin copy (deviceId "admin"): parseBackup takes it, restore plans take it', async () => {
    const w = world();
    const { a } = await account(w, 4);
    const file = exportFrom(read(w), a.userId, T0);
    expect(file.deviceId).toBe(ADMIN_EXPORT_DEVICE);
    expect(file.records).toHaveLength(4);
    expect(file.serverRecords.map((r) => r.seq)).toEqual([1, 2, 3, 4]);
    expect(file.settings).toEqual([expect.objectContaining({ key: 'newPerDay', value: 7, deviceId: a.deviceId })]);
    const parsed = parseBackup(serializeAccountExport(file));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.backup.userId).toBe(a.userId);
    expect(parsed.backup.records).toHaveLength(4);
    expect(planRestore(parsed.backup, 'someone-else', false, new Set())).toMatchObject({ ok: true, adoptUserId: a.userId });
    expect(planAccountRestore(parsed.backup, a.userId, [], new Set())).toMatchObject({ ok: true, skipped: 0 });
  });

  it('the app copy from the routes: restoreJournal on an empty installation takes all records', async () => {
    const w = world();
    const { a } = await account(w, 3);
    const head = (await (await send(w, '/api/account/export', { method: 'GET', cookie: a.cookie })).json()) as ExportHead;
    const page = (await (await send(w, '/api/account/export/journal', { method: 'GET', cookie: a.cookie })).json()) as ExportJournalPage;
    const file = buildAccountExport(head, [page], new Date(T0), a.deviceId);
    expect(accountExportFileName(new Date(2026, 9, 26))).toBe('mana-journal-account-2026-10-26.json');

    const db = new ManaDb(`account-copy-${crypto.randomUUID()}`);
    await ensureDevice(db);
    const result = await restoreJournal(db, createScheduler(), serializeAccountExport(file));
    expect(result).toMatchObject({ ok: true, added: 3, skipped: 0, userId: a.userId });
    expect((await userLog(db, a.userId)).map((r) => r.id)).toEqual(file.records.map((r) => (r as { id: string }).id));
    db.close();
  });
});
