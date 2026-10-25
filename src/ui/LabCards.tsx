import Dexie from 'dexie';
import { useEffect, useState } from 'react';
import { BUILD } from '../core/build';
import { cardsReport, LAB_COPY, LAB_TITLE } from '../core/cardsReport';
import type { ManaDb } from '../platform/db';
import { userLog } from '../platform/repo';
import { CopyButton } from './CopyButton';

/**
 * The hidden page #/lab/cards (stage 6a.4, R40): no link leads here. Numbers and hashes of this
 * device's cards for the checks of the transfer (before / after, phone / laptop).
 */
export function LabCards({ db }: { db: ManaDb }) {
  const [report, setReport] = useState<string | null>(null);
  useEffect(() => {
    void (async () => {
      const meta = await db.meta.get('device');
      if (!meta) return;
      const cards = await db.cards.where('[userId+deckId]').between([meta.userId, Dexie.minKey], [meta.userId, Dexie.maxKey]).toArray();
      const outbox = await db.outbox.toArray();
      const count = (status: string) => outbox.filter((r) => r.status === status).length;
      setReport(
        await cardsReport({
          build: BUILD,
          userId: meta.userId,
          formerUserIds: meta.formerUserIds?.length ?? 0,
          records: (await userLog(db, meta.userId)).length,
          cards,
          outbox: { pending: count('pending'), rejected: count('rejected'), conflict: count('conflict') },
          lastSynced: meta.sync?.lastOkAt ?? null,
        }),
      );
    })();
  }, [db]);
  return (
    <section>
      <h1>{LAB_TITLE}</h1>
      {report && (
        <>
          <pre className="lab-report">{report}</pre>
          <CopyButton label={LAB_COPY} text={() => report} />
        </>
      )}
    </section>
  );
}
