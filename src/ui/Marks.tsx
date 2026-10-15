/**
 * Answer marks (Р22.9 and its amendments of 15.10.2026).
 *
 * All correct → one line with ✓ (words matched by sound carry a muted ≈).
 * Otherwise word blocks: the answer on top (🎤 voice / ⌨ typed at its start), the
 * reference below in the card's main font; a block wraps as a whole, so the two
 * lines never drift apart on a phone. Every status has a sign besides colour (≈, a
 * wavy underline, a dashed empty cell, a strike, a dotted underline). Tapping a
 * block explains it: the status and what was heard or typed.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { charBlocks, type CharCell, type CharStatus } from '../core/evaluate';
import { allMatched, spokenBlocks, type SpokenCell, type SpokenCheck, type SpokenStatus } from '../core/spoken';
import { useI18n } from './i18n';
import type { StringKey } from './strings';

export type AnswerSource = 'voice' | 'typed';

const SOURCE_ICON: Record<AnswerSource, string> = { voice: '🎤', typed: '⌨' };

function spokenLabel(status: SpokenStatus, source: AnswerSource): StringKey | null {
  switch (status) {
    case 'ok':
      return null;
    case 'sound':
      return 'mark.sound';
    case 'other':
      return source === 'typed' ? 'mark.otherTyped' : 'mark.other';
    case 'missing':
      return 'mark.unsaid';
    case 'extra':
      return 'mark.extra';
  }
}

const CHAR_LABEL: Record<CharStatus, StringKey | null> = {
  ok: null,
  wrong: 'mark.wrong',
  missing: 'mark.missing',
  extra: 'mark.extra',
  diacritic: 'mark.diacritic',
};

/**
 * A block that explains itself on tap. Only blocks with something to explain are
 * buttons; the explanation closes on a second tap or a tap elsewhere.
 */
function Block({
  id,
  open,
  setOpen,
  explain,
  className,
  children,
}: {
  id: number;
  open: number | null;
  setOpen(v: number | null): void;
  explain: string[];
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const [right, setRight] = useState(false);
  const cls = `blk${className ? ` ${className}` : ''}`;
  if (explain.length === 0) return <span className={cls}>{children}</span>;
  const isOpen = open === id;
  return (
    <button
      ref={ref}
      type="button"
      className={`${cls} tap`}
      aria-expanded={isOpen}
      aria-label={explain.join('; ')}
      onClick={(e) => {
        e.stopPropagation();
        const r = ref.current?.getBoundingClientRect();
        setRight(r ? r.left > window.innerWidth / 2 : false);
        setOpen(isOpen ? null : id);
      }}
    >
      {children}
      {isOpen && (
        <span className={`pop${right ? ' right' : ''}`} role="status">
          {explain.map((line, k) => (
            <span key={k}>{line}</span>
          ))}
        </span>
      )}
    </button>
  );
}

/** Which block's explanation is open; closes on a tap anywhere else. */
function useOpenBlock(): [number | null, (v: number | null) => void] {
  const [open, setOpen] = useState<number | null>(null);
  useEffect(() => {
    if (open === null) return;
    const close = () => setOpen(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [open]);
  return [open, setOpen];
}

function cellText(c: SpokenCell, side: 'top' | 'bottom'): string {
  return c[side] ?? '';
}

export function SpokenMarks({ check, lang, source }: { check: SpokenCheck; lang: string; source: AnswerSource }) {
  const { t } = useI18n();
  const [open, setOpen] = useOpenBlock();
  const blocks = spokenBlocks(check);
  const heardKey: StringKey = source === 'typed' ? 'mark.typedX' : 'mark.heardX';

  const explain = (b: SpokenCell[]): string[] =>
    b.flatMap((c) => {
      const key = spokenLabel(c.status, source);
      if (!key) return [];
      return [c.heard !== null && c.status !== 'missing' ? `${t(key)} — ${t(heardKey, { x: c.heard })}` : t(key)];
    });

  if (allMatched(check)) {
    return (
      <div className="marks one" lang={lang}>
        <span className="check" aria-hidden="true">
          ✓
        </span>
        {blocks.map((b, k) => [
          ' ',
          <Block key={k} id={k} open={open} setOpen={setOpen} explain={explain(b)} className="flat">
            {b.map((c, j) => (
              <span key={j} className={`w st-${c.status}${c.space && j > 0 ? ' sp' : ''}`}>
                {c.status === 'sound' && (
                  <i className="sign" aria-hidden="true">
                    ≈
                  </i>
                )}
                {cellText(c, 'bottom')}
              </span>
            ))}
          </Block>,
        ])}
      </div>
    );
  }

  return (
    <div className="marks blocks words" lang={lang}>
      <span className="blk icon" aria-hidden="true">
        <span className="cell">
          <span className="top">{SOURCE_ICON[source]}</span>
          <span className="bot" />
        </span>
      </span>
      {blocks.map((b, k) => (
        <Block key={k} id={k} open={open} setOpen={setOpen} explain={explain(b)}>
          {b.map((c, j) => (
            <span className={`cell st-${c.status}${c.space && j > 0 ? ' sp' : ''}`} key={j}>
              <span className={`top${c.top === null ? ' gap' : ''}`}>
                {c.status === 'sound' && c.top ? (
                  <i className="sign" aria-hidden="true">
                    ≈
                  </i>
                ) : null}
                {cellText(c, 'top')}
              </span>
              <span className={`bot${c.bottom === null ? ' gap' : ''}`}>{cellText(c, 'bottom')}</span>
            </span>
          ))}
        </Block>
      ))}
    </div>
  );
}

function charText(c: string | null): string {
  return c === ' ' ? '␣' : (c ?? '');
}

/** A typed answer, letter by letter (copy it out; `write` at stage 4.3). */
export function CharMarks({ cells, lang }: { cells: readonly CharCell[]; lang: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useOpenBlock();
  const blocks = charBlocks(cells);

  if (cells.every((c) => c.status === 'ok')) {
    return (
      <div className="marks one" lang={lang}>
        <span className="check" aria-hidden="true">
          ✓
        </span>
        {' '}
        <span className="w">{cells.map((c) => c.bottom ?? '').join('')}</span>
      </div>
    );
  }

  const explain = (b: CharCell[]): string[] => [
    ...new Set(
      b.flatMap((c) => {
        const key = CHAR_LABEL[c.status];
        if (!key) return [];
        return [c.top !== null && c.status !== 'extra' ? `${t(key)} — ${t('mark.typedX', { x: charText(c.top) })}` : t(key)];
      }),
    ),
  ];

  return (
    <div className="marks blocks chars" lang={lang}>
      <span className="blk icon" aria-hidden="true">
        <span className="cell">
          <span className="top">{SOURCE_ICON.typed}</span>
          <span className="bot" />
        </span>
      </span>
      {blocks.map((b, k) => (
        <Block key={k} id={k} open={open} setOpen={setOpen} explain={explain(b)}>
          {b.map((c, j) => (
            <span className={`cell st-${c.status}`} key={j}>
              <span className={`top${c.top === null ? ' gap' : ''}`}>{charText(c.top)}</span>
              <span className={`bot${c.bottom === null ? ' gap' : ''}`}>{charText(c.bottom)}</span>
            </span>
          ))}
        </Block>
      ))}
    </div>
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
