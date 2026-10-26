/**
 * "Save a copy of the account data" (stage 6a.5b, R42 item 5): the head and the journal pages from
 * the server, kept between tries — a page that failed is asked again from its cursor, the pages
 * already here stay. The file is built only when everything is here (src/core/accountExport.ts).
 */
import { buildAccountExport, type AccountExport } from '../core/accountExport';
import type { ExportHead, ExportJournalPage } from '../core/accountRows';
import type { ApiResult } from './api';

export interface CopySource {
  head(): Promise<ApiResult<ExportHead>>;
  page(after: number): Promise<ApiResult<ExportJournalPage>>;
}

export type CopyStep = { ok: true; file: AccountExport } | { ok: false; status: number };

/** What has been collected so far; pass it again to go on after a failure. */
export interface CopyProgress {
  head: ExportHead | null;
  pages: ExportJournalPage[];
  /** The cursor for the next page. */
  after: number;
  done: boolean;
}

export const emptyCopy = (): CopyProgress => ({ head: null, pages: [], after: 0, done: false });

export const recordsIn = (p: CopyProgress): number => p.pages.reduce((n, page) => n + page.records.length, 0);

/**
 * Collects the rest of the copy into `progress` (changed in place); `onPage` hears the count after
 * each page. The answer: the file, or the status of the request that failed (0 — no network).
 */
export async function collectCopy(source: CopySource, progress: CopyProgress, deviceId: string, now: () => Date, onPage: (records: number) => void): Promise<CopyStep> {
  if (!progress.head) {
    const head = await source.head();
    if (!head.ok) return { ok: false, status: head.status };
    progress.head = head.data;
  }
  while (!progress.done) {
    const page = await source.page(progress.after);
    if (!page.ok) return { ok: false, status: page.status };
    progress.pages.push(page.data);
    progress.after = page.data.next;
    progress.done = !page.data.more;
    onPage(recordsIn(progress));
  }
  return { ok: true, file: buildAccountExport(progress.head, progress.pages, now(), deviceId) };
}
