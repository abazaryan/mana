/**
 * The transfer on a copy of the real journal (stage 6a.4, R40; plan 6a.4 item 10). The copy lives
 * only in reference/ (not in git) and its path comes from MANA_REAL_JOURNAL; without it the tests
 * are skipped (Workers Builds has no copy). Output and comparisons are numbers and hashes only —
 * never an object of the journal, so a failure cannot print a record.
 *   MANA_REAL_JOURNAL=reference/journal/<file>.json npx vitest run tests/real-journal.test.ts
 */
import 'fake-indexeddb/auto';
import { existsSync, readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { parseBackup, type JournalBackup } from '../src/core/backup';
import { rebuildCards } from '../src/core/cards';
import { checkPushed } from '../src/core/journalRecord';
import type { ReviewRecord } from '../src/core/model';
import { createScheduler } from '../src/core/scheduler';
import type { ManaDb } from '../src/platform/db';
import { adoptAccount, restoreForAccount, restoreJournal } from '../src/platform/repo';
import { isLocalUserId } from '../worker/aliases';
import { world } from '../worker/test/accounts';
import { isUuid } from '../worker/tokens';
import { actorOf, aliasRows, duesHash, localDevice, pairWith, redeemAccount, serverRows, syncAll, type Devices } from './support/devices';

const path = process.env.MANA_REAL_JOURNAL;
const text = path && existsSync(path) ? readFileSync(path, 'utf8') : null;
const scheduler = createScheduler();
const open: ManaDb[] = [];

afterEach(async () => {
  for (const db of open.splice(0)) {
    db.close();
    await db.delete();
  }
});

function backupOf(): JournalBackup {
  const parsed = parseBackup(text!);
  if (!parsed.ok) throw new Error(`the copy does not read: ${parsed.error}`);
  return parsed.backup;
}

const devices = (): Devices => ({ w: world(), clock: { now: Date.now() }, scheduler, open });
const say = (line: string) => console.log(`real journal: ${line}`);

describe.skipIf(text === null)('copy of the real journal (numbers and hashes only)', () => {
  it('(a) every record passes the server check; userId and deviceIds have the server format', () => {
    const backup = backupOf();
    const raw = (JSON.parse(text!) as { records: unknown[] }).records;
    const reasons = new Map<string, number>();
    for (const r of raw) {
      const check = checkPushed(r, backup.userId, Date.now());
      const key = check.ok ? 'ok' : check.reason;
      reasons.set(key, (reasons.get(key) ?? 0) + 1);
    }
    const devicesOk = backup.records.every((r) => isUuid(r.deviceId));
    say(`records ${raw.length}; check ${JSON.stringify(Object.fromEntries(reasons))}; userId local format ${isLocalUserId(backup.userId)}; deviceIds UUID ${devicesOk}`);
    expect(reasons.get('ok')).toBe(raw.length);
    expect(isLocalUserId(backup.userId)).toBe(true);
    expect(devicesOk).toBe(true);
  });

  it('(b) rebuildCards against the fsrs snapshot of each card last answer: mismatches by rules', () => {
    const backup = backupOf();
    const byId = new Map(backup.records.map((r) => [r.id, r]));
    const cards = rebuildCards(scheduler, backup.records, backup.userId);
    const counts = { rules2: { cards: 0, differ: 0 }, older: { cards: 0, differ: 0 } };
    for (const card of cards) {
      const last = byId.get(card.lastLogId) as ReviewRecord;
      const group = last.rules === 2 ? counts.rules2 : counts.older;
      group.cards++;
      if (last.fsrs.nextDue.getTime() !== card.due.getTime()) group.differ++;
    }
    say(`cards ${cards.length}; last answer with rules 2: ${counts.rules2.cards} cards, ${counts.rules2.differ} differ; older: ${counts.older.cards} cards, ${counts.older.differ} differ`);
    expect(counts.rules2.differ).toBe(0);
  });

  it('(c) first device: due dates before = after the transfer = on a second, empty device after the pull', async () => {
    const t = devices();
    const phone = await localDevice(t);
    expect((await restoreJournal(phone.db, scheduler, text!)).ok).toBe(true);
    const local = (await actorOf(phone)).userId;
    const before = await duesHash(phone);
    expect((await redeemAccount(t, phone)).ok).toBe(true);
    expect(await duesHash(phone)).toBe(before);
    await syncAll(phone);
    const rows = serverRows(t.w);
    expect(rows.length).toBe(backupOf().records.length);
    expect(rows.every((r) => r.user_id === local)).toBe(true);
    const laptop = await localDevice(t);
    expect((await pairWith(t, laptop, phone, false)).ok).toBe(true);
    await syncAll(laptop);
    expect(await duesHash(laptop)).toBe(before);
    say(`(c) records ${rows.length}, pushes ${phone.pushes.length}, cards hash ${before.slice(0, 12)}… equal on both devices`);
  });

  it('(d) second device with its own answers: the copy joins an account with another id; due dates the same', async () => {
    const t = devices();
    const first = await localDevice(t);
    expect((await redeemAccount(t, first, false)).ok).toBe(true);
    const account = (await actorOf(first)).userId;
    const copy = await localDevice(t);
    expect((await restoreJournal(copy.db, scheduler, text!)).ok).toBe(true);
    const former = (await actorOf(copy)).userId;
    const before = await duesHash(copy);
    expect((await pairWith(t, copy, first)).ok).toBe(true);
    expect(await duesHash(copy)).toBe(before);
    await syncAll(copy, first);
    const rows = serverRows(t.w);
    const fileIds = backupOf().records.map((r) => r.id).sort();
    expect(rows.every((r) => r.user_id === account)).toBe(true);
    expect(rows.map((r) => r.id).sort()).toEqual(fileIds);
    expect(aliasRows(t.w)).toEqual([{ user_id: account, alias_id: former }]);
    expect(await duesHash(first)).toBe(before);
    say(`(d) records ${rows.length} under the account id, ids the same as the file, earlier ids 1`);

    // (e) a repeat changes nothing.
    await adoptAccount(copy.db, scheduler, account, 'copy', [former]);
    copy.pushes = [];
    await syncAll(copy);
    expect(copy.pushes.reduce((a, b) => a + b, 0)).toBe(0);
    expect(await duesHash(copy)).toBe(before);
    expect(serverRows(t.w).length).toBe(rows.length);

    // (f) the file restored on a third, signed-in device changes nothing.
    const third = await localDevice(t);
    expect((await pairWith(t, third, first, false)).ok).toBe(true);
    await syncAll(third);
    await third.db.meta.update('device', { formerUserIds: [former] });
    expect(await restoreForAccount(third.db, scheduler, backupOf())).toEqual({ ok: true, added: 0, skipped: rows.length });
    expect(await duesHash(third)).toBe(before);
    say('(e) repeat: 0 records sent, hashes the same; (f) restore on a third device: 0 added, hash the same');
  });
});
