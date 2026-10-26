/**
 * What the screens of leaving share (stage 6a.5b, R42): send the queue now and count what is not
 * on the server; save this device's journal to a file.
 */
import { backupFileName } from '../core/backup';
import { BUILD } from '../core/build';
import { createScheduler } from '../core/scheduler';
import { syncTransport } from '../platform/api';
import type { ManaDb } from '../platform/db';
import { downloadText } from '../platform/files';
import { exportJournal } from '../platform/repo';
import { flushQueue, type RunResult } from '../platform/syncClient';
import { queueCounts } from '../platform/syncStore';

/** One sync run now; `unsent` — records of this device the server does not have (waiting or refused). */
export async function sendQueue(db: ManaDb): Promise<{ result: RunResult; unsent: number }> {
  const result = await flushQueue({ db, scheduler: createScheduler(), transport: syncTransport, build: BUILD });
  const { pending, notAccepted } = await queueCounts(db);
  return { result, unsent: pending + notAccepted };
}

/** "Save the study log to a file" (as in Settings); the number of records saved. */
export async function saveJournalFile(db: ManaDb): Promise<number> {
  const meta = await db.meta.get('device');
  if (!meta) throw new Error('saveJournalFile: no device row');
  const { json, count } = await exportJournal(db, meta);
  downloadText(json, backupFileName(new Date()));
  return count;
}
