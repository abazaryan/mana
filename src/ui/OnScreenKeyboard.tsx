/**
 * The on-screen phone keyboard (Р6, Р31). Shown by TypeField while its field has the
 * focus on a touch device; the system keyboard is hidden by inputmode="none".
 *
 * Layout and long-press variants come from the language pack (Р13). A tap types on
 * release; holding a key with variants opens them above it (the first preselected),
 * sliding picks one, releasing types it. A second finger types the first key at once.
 * Backspace deletes on press and repeats while held. Keys never take the focus, so the
 * caret stays in the field. Assistive technology that sends a plain click (no pointer
 * events) types the key itself.
 */
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import {
  KEY_HEIGHT_LANDSCAPE_PX,
  KEY_HEIGHT_PX,
  LONG_PRESS_MS,
  REPEAT_DELAY_MS,
  REPEAT_EVERY_MS,
  keyboardRows,
  keyVariants,
  pickVariant,
  popupGrid,
  releasedChar,
  shiftChar,
  type Key,
} from '../core/keyboard';
import type { KeyboardLayout } from '../core/languages';
import { useI18n } from './i18n';
import type { StringKey } from './strings';

/** Characters whose name the screen reader gets instead of the glyph. */
const NAMED: Record<string, StringKey> = { "'": 'kb.apostrophe', '-': 'kb.hyphen' };

interface Popup {
  variants: string[];
  cols: number;
  rows: number;
  cellW: number;
  cellH: number;
  left: number;
  top: number;
  /** Height of the key under the popup: the finger may slide over it. */
  keyH: number;
}

interface Press {
  pointerId: number;
  key: Key;
  /** `char` keys: what a tap types (Shift applied). */
  char: string;
  variants: string[];
  popup: Popup | null;
  index: number | null;
  timer: number | null;
  repeat: number | null;
}

interface View {
  keyId: string;
  /** Preview bubble over the pressed key. */
  bubble: { char: string; left: number; top: number; width: number } | null;
  popup: (Popup & { index: number | null }) | null;
}

export function OnScreenKeyboard({
  layout,
  spaceLabel,
  enterLabel,
  onChar,
  onBackspace,
  onEnter,
  onTouch,
}: {
  layout: KeyboardLayout;
  /** Shown on the space bar (the learning language), as Gboard shows its layout. */
  spaceLabel: string;
  /** Read by the screen reader for Enter ("Check" or "Next"). */
  enterLabel: string;
  onChar(ch: string): void;
  onBackspace(): void;
  onEnter(): void;
  /** Any key touched (latency, Р21). */
  onTouch(): void;
}) {
  const { t } = useI18n();
  const rows = keyboardRows(layout);
  const [shift, setShift] = useState(false);
  const [view, setView] = useState<View | null>(null);
  const press = useRef<Press | null>(null);
  const pointerSeen = useRef(false);
  const box = useRef<HTMLDivElement>(null);
  // The handlers below outlive a render (timers): read the current props and Shift here.
  const live = useRef({ onChar, onBackspace, onEnter, shift });
  live.current = { onChar, onBackspace, onEnter, shift };

  // The page keeps room for the keyboard: the field scrolls above it (styles.css, html.osk-open).
  useLayoutEffect(() => {
    const el = box.current;
    const root = document.documentElement;
    if (!el) return;
    const set = () => root.style.setProperty('--osk-h', `${Math.ceil(el.getBoundingClientRect().height)}px`);
    set();
    root.classList.add('osk-open');
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(set) : null;
    ro?.observe(el);
    return () => {
      ro?.disconnect();
      root.classList.remove('osk-open');
      root.style.removeProperty('--osk-h');
    };
  }, []);

  const clearTimers = (p: Press) => {
    if (p.timer !== null) window.clearTimeout(p.timer);
    if (p.repeat !== null) window.clearInterval(p.repeat);
    p.timer = null;
    p.repeat = null;
  };
  useEffect(
    () => () => {
      if (press.current) clearTimers(press.current);
    },
    [],
  );

  const typeChar = (ch: string) => {
    live.current.onChar(ch);
    if (live.current.shift) setShift(false);
  };

  /** The key is let go: type what it stands for. */
  const commit = (p: Press) => {
    clearTimers(p);
    switch (p.key.kind) {
      case 'char': {
        const out = releasedChar({ char: p.char, variants: p.variants, popupOpen: p.popup !== null, index: p.index });
        if (out !== null) typeChar(out);
        break;
      }
      case 'space':
        typeChar(' ');
        break;
      case 'shift':
        setShift((s) => !s);
        break;
      case 'enter':
        live.current.onEnter();
        break;
      case 'backspace':
        break;
    }
  };

  const end = (commitIt: boolean) => {
    const p = press.current;
    if (!p) return;
    press.current = null;
    if (commitIt) commit(p);
    else clearTimers(p);
    setView(null);
  };

  const openPopup = (p: Press, rect: DOMRect) => {
    const { cols, rows: popupRows } = popupGrid(p.variants.length);
    const cellW = Math.max(rect.width, 40);
    const cellH = Math.min(rect.height, 52);
    const width = cols * cellW;
    const vw = document.documentElement.clientWidth;
    // The first (preselected) variant sits over the key, as far as the screen allows.
    const left = Math.min(Math.max(4, rect.left + rect.width / 2 - cellW / 2), Math.max(4, vw - width - 4));
    const top = rect.top - popupRows * cellH - 6;
    p.popup = { variants: p.variants, cols, rows: popupRows, cellW, cellH, left, top, keyH: rect.height };
    p.index = 0;
    setView({ keyId: p.key.id, bubble: null, popup: { ...p.popup, index: 0 } });
  };

  const down = (key: Key, e: ReactPointerEvent<HTMLButtonElement>) => {
    // Keep the focus (and the caret) in the field.
    e.preventDefault();
    pointerSeen.current = true;
    onTouch();
    if (press.current) end(true);
    const el = e.currentTarget;
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      // Not every pointer can be captured; moves then come only while over the key.
    }
    const char = key.char !== undefined ? shiftChar(key.char, live.current.shift) : '';
    const variants = key.char !== undefined ? keyVariants(layout, key.char, live.current.shift) : [];
    const p: Press = { pointerId: e.pointerId, key, char, variants, popup: null, index: null, timer: null, repeat: null };
    press.current = p;
    const rect = el.getBoundingClientRect();

    if (key.kind === 'backspace') {
      live.current.onBackspace();
      p.timer = window.setTimeout(() => {
        p.timer = null;
        p.repeat = window.setInterval(() => live.current.onBackspace(), REPEAT_EVERY_MS);
      }, REPEAT_DELAY_MS);
      setView({ keyId: key.id, bubble: null, popup: null });
      return;
    }
    const bubble = key.kind === 'char' ? { char, left: rect.left, top: rect.top, width: rect.width } : null;
    setView({ keyId: key.id, bubble, popup: null });
    if (variants.length > 0) {
      p.timer = window.setTimeout(() => {
        p.timer = null;
        if (press.current === p) openPopup(p, rect);
      }, LONG_PRESS_MS);
    }
  };

  const move = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const p = press.current;
    if (!p || p.pointerId !== e.pointerId || !p.popup) return;
    const g = p.popup;
    const index = pickVariant({
      count: g.variants.length,
      cols: g.cols,
      rows: g.rows,
      cellW: g.cellW,
      cellH: g.cellH,
      left: g.left,
      top: g.top,
      x: e.clientX,
      y: e.clientY,
      slack: g.cellW,
      below: g.keyH + 40,
    });
    if (index !== p.index) {
      p.index = index;
      setView((v) => (v?.popup ? { ...v, popup: { ...v.popup, index } } : v));
    }
  };

  const up = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (press.current?.pointerId === e.pointerId) end(true);
  };
  const cancel = (e: ReactPointerEvent<HTMLButtonElement>) => {
    // No click follows a cancelled pointer.
    pointerSeen.current = false;
    if (press.current?.pointerId === e.pointerId) end(false);
  };

  /** A click without pointer events (assistive technology): the key itself. */
  const click = (key: Key) => {
    if (pointerSeen.current) {
      pointerSeen.current = false;
      return;
    }
    onTouch();
    const char = key.char !== undefined ? shiftChar(key.char, live.current.shift) : '';
    if (key.kind === 'backspace') live.current.onBackspace();
    else commit({ pointerId: -1, key, char, variants: [], popup: null, index: null, timer: null, repeat: null });
  };

  const label = (key: Key): string => {
    switch (key.kind) {
      case 'shift':
        return t('kb.shift');
      case 'backspace':
        return t('kb.backspace');
      case 'space':
        return t('kb.space');
      case 'enter':
        return enterLabel;
      case 'char': {
        const base = key.char!;
        const name = NAMED[base] ? t(NAMED[base]) : shiftChar(base, shift);
        const vs = keyVariants(layout, base, shift);
        return vs.length ? `${name}, ${t('kb.hold', { list: vs.join(' ') })}` : name;
      }
    }
  };

  const glyph = (key: Key) => {
    switch (key.kind) {
      case 'shift':
        return '⇧';
      case 'backspace':
        return '⌫';
      case 'space':
        return spaceLabel;
      case 'enter':
        return '⏎';
      case 'char':
        return shiftChar(key.char!, shift);
    }
  };

  const style = { '--key-h': `${KEY_HEIGHT_PX}px`, '--key-h-land': `${KEY_HEIGHT_LANDSCAPE_PX}px` } as CSSProperties;

  return createPortal(
    <div className="osk" ref={box} role="group" aria-label={t('kb.group')} style={style}>
      <div className="osk-rows">
        {rows.map((row, r) => (
          <div className="osk-row" key={r}>
            {row.indent > 0 && <span className="osk-indent" style={{ flexGrow: row.indent }} />}
            {row.keys.map((key) => (
              <button
                key={key.id}
                type="button"
                tabIndex={-1}
                className="osk-key"
                data-kind={key.kind}
                data-down={view?.keyId === key.id || undefined}
                data-on={key.kind === 'shift' && shift ? true : undefined}
                aria-pressed={key.kind === 'shift' ? shift : undefined}
                aria-label={label(key)}
                style={{ flexGrow: key.width }}
                onPointerDown={(e) => down(key, e)}
                onPointerMove={move}
                onPointerUp={up}
                onPointerCancel={cancel}
                onMouseDown={(e) => e.preventDefault()}
                onContextMenu={(e) => e.preventDefault()}
                onClick={() => click(key)}
              >
                <span className="osk-cap" aria-hidden="true">
                  {glyph(key)}
                  {key.char !== undefined && layout.variants[key.char] && <i className="osk-mark" />}
                </span>
              </button>
            ))}
            {row.indent > 0 && <span className="osk-indent" style={{ flexGrow: row.indent }} />}
          </div>
        ))}
      </div>
      {view?.bubble && (
        <div className="osk-bubble" aria-hidden="true" style={{ left: view.bubble.left, top: view.bubble.top, width: view.bubble.width }}>
          {view.bubble.char}
        </div>
      )}
      {view?.popup && (
        <div
          className="osk-popup"
          aria-hidden="true"
          style={{ left: view.popup.left, top: view.popup.top, gridTemplateColumns: `repeat(${view.popup.cols}, ${view.popup.cellW}px)`, gridAutoRows: `${view.popup.cellH}px` }}
        >
          {view.popup.variants.map((v, k) => (
            <span key={v} className="osk-var" data-on={k === view.popup!.index || undefined}>
              {v}
            </span>
          ))}
        </div>
      )}
    </div>,
    document.body,
  );
}
