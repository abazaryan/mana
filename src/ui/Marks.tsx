/**
 * Answer marks (Р22.9). Word blocks: each block wraps as a whole, the answer on top,
 * the reference below, so the two lines never drift apart on a phone. Every status
 * has a sign besides colour: ≈ for a sound match, a wavy underline for another word
 * or a wrong letter, a dashed empty cell for a gap, a strike for an extra, a dotted
 * underline for an accent.
 */
import { charBlocks, type CharCell, type CharStatus } from '../core/evaluate';
import { spokenBlocks, type SpokenCheck, type SpokenStatus } from '../core/spoken';
import { useI18n } from './i18n';
import type { StringKey } from './strings';

const SPOKEN_LABEL: Record<SpokenStatus, StringKey | null> = {
  ok: null,
  sound: 'mark.sound',
  other: 'mark.other',
  missing: 'mark.unsaid',
  extra: 'mark.extra',
};

const CHAR_LABEL: Record<CharStatus, StringKey | null> = {
  ok: null,
  wrong: 'mark.wrong',
  missing: 'mark.missing',
  extra: 'mark.extra',
  diacritic: 'mark.diacritic',
};

/** One status sample for the legend: the answer line as it looks in the blocks (a gap for a missing one). */
function Sample({ status }: { status: string }) {
  return (
    <span className={`cell st-${status}`} aria-hidden="true">
      <span className={`top${status === 'missing' ? ' gap' : ''}`}>
        {status === 'sound' && <i className="sign">≈</i>}
        {status === 'missing' ? '' : 'ab'}
      </span>
    </span>
  );
}

function Legend({ items }: { items: { status: string; label: string }[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="legend">
      {items.map((i) => (
        <li key={i.status}>
          <Sample status={i.status} /> {i.label}
        </li>
      ))}
    </ul>
  );
}

export function SpokenMarks({ check, lang, typed }: { check: SpokenCheck; lang: string; typed: boolean }) {
  const { t } = useI18n();
  const blocks = spokenBlocks(check);
  // A typed answer was not recognised: "another word", not "recognised as another word".
  const label = (st: SpokenStatus): StringKey | null => (typed && st === 'other' ? 'mark.otherTyped' : SPOKEN_LABEL[st]);
  const present = [...new Set(blocks.flat().map((c) => c.status))];
  return (
    <figure className="marks" aria-label={t(typed ? 'marks.rows.typed' : 'marks.rows.voice')}>
      <div className="blocks words" lang={lang}>
        {blocks.map((b, k) => (
          <span className="blk" key={k}>
            {b.map((c, j) => {
              const key = label(c.status);
              const title = key ? `${t(key)}${c.top ? ` — ${c.top}` : ''}` : undefined;
              return (
                <span className={`cell st-${c.status}`} key={j} title={title}>
                  <span className={`top${c.top === null ? ' gap' : ''}`}>
                    {c.status === 'sound' && c.top ? <i className="sign">≈</i> : null}
                    {c.top ?? ''}
                  </span>
                  <span className={`bot${c.bottom === null ? ' gap' : ''}`}>{c.bottom ?? ''}</span>
                  {title && <span className="sr">{title}</span>}
                </span>
              );
            })}
          </span>
        ))}
      </div>
      <figcaption className="m">{t(typed ? 'marks.rows.typed' : 'marks.rows.voice')}</figcaption>
      <Legend items={present.flatMap((s) => {
        const key = label(s);
        return key ? [{ status: s, label: t(key) }] : [];
      })} />
    </figure>
  );
}

function charText(c: string | null): string {
  return c === ' ' ? '␣' : (c ?? '');
}

export function CharMarks({ cells, lang }: { cells: readonly CharCell[]; lang: string }) {
  const { t } = useI18n();
  const blocks = charBlocks(cells);
  const present = [...new Set(cells.map((c) => c.status))];
  return (
    <figure className="marks" aria-label={t('marks.rows.typed')}>
      <div className="blocks chars" lang={lang}>
        {blocks.map((b, k) => (
          <span className="blk" key={k}>
            {b.map((c, j) => {
              const key = CHAR_LABEL[c.status];
              return (
                <span className={`cell st-${c.status}`} key={j} title={key ? t(key) : undefined}>
                  <span className={`top${c.top === null ? ' gap' : ''}`}>{charText(c.top)}</span>
                  <span className={`bot${c.bottom === null ? ' gap' : ''}`}>{charText(c.bottom)}</span>
                </span>
              );
            })}
          </span>
        ))}
      </div>
      <figcaption className="m">{t('marks.rows.typed')}</figcaption>
      <Legend items={present.flatMap((s) => (CHAR_LABEL[s] ? [{ status: s, label: t(CHAR_LABEL[s]) }] : []))} />
    </figure>
  );
}

/** "Say it aloud" while speaking: reference words light up as they are recognised (Р22.9в). */
export function LiveWords({ words, heard, lang }: { words: { text: string; join: string }[]; heard: boolean[]; lang: string }) {
  return (
    <p className="live-words" lang={lang} aria-live="polite">
      {words.map((w, k) => (
        <span key={k}>
          <span className={heard[k] ? 'lw on' : 'lw'}>{w.text}</span>
          {w.join}
        </span>
      ))}
    </p>
  );
}
