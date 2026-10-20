/**
 * Hidden page of the keyboard experiment (#/lab/keyboard, stage 5, in no menu). Five test
 * fields side by side, and a report of what each got from the keyboard:
 *
 *   К  — a bare <input>, no attributes: the control;
 *   А  — the TypeField attributes + inputmode="none" and the on-screen keyboard (Р6);
 *   А′ — the on-screen keyboard and no <input> at all (a box with role="textbox"),
 *        the fallback if inputmode="none" does not hold;
 *   Б  — the system keyboard + the row of French letters (from the language pack, Р13);
 *   В  — exactly the TypeField attributes, in a <form> (the app today).
 *
 * Touches no app data, stores nothing, Russian only (a working tool). Nothing assumes
 * Android: the page is meant to run unchanged in Safari on iOS. Delete it with its folder.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode, type RefObject } from 'react';
import { checkWritten } from '../../core/evaluate';
import { FRENCH } from '../../core/languages';
import { caretAtEnd, deleteBackward, insertText, type TextState } from '../../core/textEdit';
import { CharMarks } from '../Marks';
import { FIELD_NAMES, LIMITATIONS, buildReport, summarizeField, type Detail, type FieldId, type LabEnv, type LabEvent, type Measure } from './labReport';
import './keyboardLab.css';

/** One made-up word per field: no keyboard dictionary knows them. К's word is never typed in full. */
const WORDS: Record<FieldId, string> = { K: 'glorvide', A: 'mavrique', A2: 'zubertin', B: 'tolbane', V: 'pexudrin' };
const MAX_EVENTS = 4000;

/** The TypeField attributes (src/ui/TypeField.tsx), copied: the lab must not depend on later changes there. */
const TYPEFIELD_ATTRS = {
  lang: FRENCH.code,
  enterKeyHint: 'go',
  autoComplete: 'off',
  autoCorrect: 'off',
  autoCapitalize: 'off',
  spellCheck: false,
} as const;

const LETTER_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'].map((r) => [...r]);
const half = Math.ceil(FRENCH.keyboardRow.length / 2);
const ACCENT_ROWS = [FRENCH.keyboardRow.slice(0, half), FRENCH.keyboardRow.slice(half)];

function readEnv(): LabEnv {
  const mq = (q: string) => (typeof matchMedia === 'function' ? matchMedia(q).matches : false);
  return {
    userAgent: navigator.userAgent,
    language: navigator.language,
    visualViewport: typeof window.visualViewport !== 'undefined' && window.visualViewport !== null,
    inputModeSupported: 'inputMode' in HTMLElement.prototype,
    beforeInputSupported: typeof InputEvent !== 'undefined' && 'getTargetRanges' in InputEvent.prototype,
    pointerCoarse: mq('(pointer: coarse)'),
    hoverNone: mq('(hover: none)'),
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
    devicePixelRatio: window.devicePixelRatio,
    screen: `${screen.width}x${screen.height}`,
  };
}

function orientation(): string {
  return screen.orientation?.type ?? (typeof matchMedia === 'function' && matchMedia('(orientation: portrait)').matches ? 'portrait' : 'landscape');
}

function viewportSample(): Detail {
  const vv = window.visualViewport;
  return {
    vvHeight: vv ? Math.round(vv.height) : null,
    vvWidth: vv ? Math.round(vv.width) : null,
    offsetTop: vv ? Math.round(vv.offsetTop) : null,
    innerHeight: window.innerHeight,
    innerWidth: window.innerWidth,
    orientation: orientation(),
  };
}

const visibleHeight = () => Math.round(window.visualViewport?.height ?? window.innerHeight);

type Record_ = (target: FieldId | 'page', kind: string, detail?: Detail) => void;

/** Native listeners: React's onBeforeInput is not the DOM `beforeinput`. */
function useFieldEvents(ref: RefObject<HTMLElement | null>, id: FieldId, rec: Record_) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const value = () => (el instanceof HTMLInputElement ? el.value : (el.dataset.value ?? ''));
    const on: [string, (e: Event) => void][] = [
      ['focus', () => rec(id, 'focus')],
      ['blur', () => rec(id, 'blur')],
      ['keydown', (e) => {
        const k = e as KeyboardEvent;
        rec(id, 'keydown', { key: k.key, code: k.code, keyCode: k.keyCode, isComposing: k.isComposing });
      }],
      ['beforeinput', (e) => {
        const i = e as InputEvent;
        rec(id, 'beforeinput', { inputType: i.inputType, data: i.data, isComposing: i.isComposing });
      }],
      ['input', () => rec(id, 'input', { value: value() })],
      ['compositionstart', (e) => rec(id, 'compositionstart', { data: (e as CompositionEvent).data })],
      ['compositionupdate', (e) => rec(id, 'compositionupdate', { data: (e as CompositionEvent).data })],
      ['compositionend', (e) => rec(id, 'compositionend', { data: (e as CompositionEvent).data })],
      ['paste', () => rec(id, 'paste')],
    ];
    for (const [type, fn] of on) el.addEventListener(type, fn);
    return () => {
      for (const [type, fn] of on) el.removeEventListener(type, fn);
    };
  }, [ref, id, rec]);
}

/** A controlled input whose text the on-screen keys also change, keeping the caret where the edit left it. */
function useEditableInput(ref: RefObject<HTMLInputElement | null>) {
  const [text, setText] = useState('');
  const caret = useRef<number | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && caret.current !== null && document.activeElement === el) el.setSelectionRange(caret.current, caret.current);
    caret.current = null;
  }, [text, ref]);
  const apply = (edit: (s: TextState) => TextState): string => {
    const el = ref.current;
    if (!el) return text;
    const next = edit({ text: el.value, start: el.selectionStart ?? el.value.length, end: el.selectionEnd ?? el.value.length });
    caret.current = next.start;
    setText(next.text);
    return next.text;
  };
  return { text, setText, apply };
}

function submitForm(form: HTMLFormElement | null) {
  if (!form) return;
  if (typeof form.requestSubmit === 'function') form.requestSubmit();
  else form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
}

/** Marks and the four grade buttons, the size of a `write` result (WriteCard + RatingPanel). Inert. */
function Mock({ innerRef }: { innerRef: RefObject<HTMLDivElement | null> }) {
  const cells = useMemo(() => checkWritten('le nom', 'la nom', FRENCH.writing, { determiner: true, gender: 'm' }).cells, []);
  return (
    <div className="kl-mock" ref={innerRef} aria-hidden="true" inert>
      <CharMarks cells={cells} lang={FRENCH.code} />
      <p className="reason">Предложено: Снова — неверный артикль</p>
      <div className="grades">
        {['Снова', 'Трудно', 'Хорошо', 'Легко'].map((g, k) => (
          <button key={g} className="grade" data-g={k + 1} type="button" tabIndex={-1} aria-pressed={k === 0}>
            {g}
          </button>
        ))}
      </div>
      <button className="primary big" type="button" tabIndex={-1}>
        Дальше
      </button>
    </div>
  );
}

function Section({ name, title, word, wordNote, children, summary }: { name: string; title: string; word: string; wordNote?: string; children: ReactNode; summary: string }) {
  return (
    <section className="kl-field">
      <h2>
        <span className="kl-tag">{name}</span> {title}
      </h2>
      <p className="kl-word">
        Тестовое слово: <b>{word}</b>
        {wordNote && ` — ${wordNote}`}
      </p>
      {children}
      <p className="kl-sum">{summary}</p>
    </section>
  );
}

const yesNo = (b: boolean | null) => (b === null ? 'неизвестно' : b ? 'да' : 'нет');

export function KeyboardLab() {
  const env = useMemo(readEnv, []);
  const t0 = useRef(performance.now());
  const events = useRef<LabEvent[]>([]);
  const [tick, setTick] = useState(0);
  // The journal must not disturb what it watches: a re-render from inside `beforeinput`
  // dropped typed text from controlled inputs (seen in the dev browser), so the summary
  // redraws a moment later, outside the input events.
  const redraw = useRef<number | null>(null);
  const rec = useCallback<Record_>((target, kind, detail) => {
    if (events.current.length >= MAX_EVENTS) events.current.shift();
    events.current.push({ t: Math.round(performance.now() - t0.current), target, kind, ...(detail ? { detail } : {}) });
    redraw.current ??= window.setTimeout(() => {
      redraw.current = null;
      setTick((n) => n + 1);
    }, 100);
  }, []);
  useEffect(
    () => () => {
      if (redraw.current !== null) window.clearTimeout(redraw.current);
      redraw.current = null;
    },
    [],
  );

  const kRef = useRef<HTMLInputElement>(null);
  const aRef = useRef<HTMLInputElement>(null);
  const aForm = useRef<HTMLFormElement>(null);
  const a2Ref = useRef<HTMLDivElement>(null);
  const bRef = useRef<HTMLInputElement>(null);
  const vRef = useRef<HTMLInputElement>(null);
  const mockA = useRef<HTMLDivElement>(null);
  const mockA2 = useRef<HTMLDivElement>(null);
  const kbRef = useRef<HTMLDivElement>(null);
  useFieldEvents(kRef, 'K', rec);
  useFieldEvents(aRef, 'A', rec);
  useFieldEvents(a2Ref, 'A2', rec);
  useFieldEvents(bRef, 'B', rec);
  useFieldEvents(vRef, 'V', rec);

  const a = useEditableInput(aRef);
  const b = useEditableInput(bRef);
  const [vText, setVText] = useState('');
  const [a2Text, setA2Text] = useState('');
  const [submitted, setSubmitted] = useState<Partial<Record<FieldId, string>>>({});
  const [kbTarget, setKbTarget] = useState<'A' | 'A2' | null>(null);
  const [shift, setShift] = useState(false);
  const [fit, setFit] = useState<Measure | null>(null);
  const [vvNow, setVvNow] = useState(visibleHeight);
  const [copyState, setCopyState] = useState<'' | 'ok' | 'manual'>('');
  const [reportText, setReportText] = useState('');

  // Page-level: the visible height (the system keyboard), switching apps, turning the screen.
  useEffect(() => {
    const sample = (kind: string) => () => {
      rec('page', kind, kind === 'visibility' ? { state: document.visibilityState, ...viewportSample() } : viewportSample());
      setVvNow(visibleHeight());
    };
    const onViewport = sample('viewport');
    const onVisibility = sample('visibility');
    const onOrientation = sample('orientation');
    onViewport();
    const vv = window.visualViewport;
    vv?.addEventListener('resize', onViewport);
    window.addEventListener('resize', onViewport);
    document.addEventListener('visibilitychange', onVisibility);
    screen.orientation?.addEventListener?.('change', onOrientation);
    window.addEventListener('orientationchange', onOrientation);
    return () => {
      vv?.removeEventListener('resize', onViewport);
      window.removeEventListener('resize', onViewport);
      document.removeEventListener('visibilitychange', onVisibility);
      screen.orientation?.removeEventListener?.('change', onOrientation);
      window.removeEventListener('orientationchange', onOrientation);
    };
  }, [rec]);

  // A viewport sample at every focus and shortly after, so a keyboard that slides up is caught.
  const onFieldFocus = useCallback(() => {
    rec('page', 'viewport', viewportSample());
    window.setTimeout(() => rec('page', 'viewport', viewportSample()), 600);
  }, [rec]);

  const fieldFor = (target: 'A' | 'A2') => (target === 'A' ? aForm.current : a2Ref.current);
  const mockFor = (target: 'A' | 'A2') => (target === 'A' ? mockA.current : mockA2.current);

  const measure = useCallback(
    (target: 'A' | 'A2') => {
      const field = fieldFor(target);
      const mock = mockFor(target);
      if (!field || !mock) return;
      const vvHeight = visibleHeight();
      const kbHeight = Math.round(kbRef.current?.getBoundingClientRect().height ?? 0);
      const blockHeight = Math.round(mock.getBoundingClientRect().bottom - field.getBoundingClientRect().top);
      const available = vvHeight - kbHeight;
      const m: Measure = { vvHeight, kbHeight, blockHeight, available, fits: blockHeight <= available };
      setFit(m);
      rec(target, 'measure', { ...m });
    },
    [rec],
  );

  // The on-screen keyboard came up: the field goes to the top, then measure.
  useEffect(() => {
    if (!kbTarget) return;
    const field = fieldFor(kbTarget);
    if (field) window.scrollBy({ top: field.getBoundingClientRect().top - 8, behavior: 'instant' });
    const id = window.setTimeout(() => measure(kbTarget), 400);
    const vv = window.visualViewport;
    const again = () => measure(kbTarget);
    vv?.addEventListener('resize', again);
    return () => {
      window.clearTimeout(id);
      vv?.removeEventListener('resize', again);
    };
  }, [kbTarget, measure]);

  const submit = (id: FieldId, value: string) => {
    rec(id, 'submit', { value });
    setSubmitted((s) => ({ ...s, [id]: value }));
  };

  const press = (key: string) => {
    if (!kbTarget) return;
    if (key === 'enter') {
      rec(kbTarget, 'ownkey', { key: 'Enter', value: kbTarget === 'A' ? a.text : a2Text });
      if (kbTarget === 'A') submitForm(aForm.current);
      else submit('A2', a2Text);
      return;
    }
    if (key === 'shift') {
      setShift((s) => !s);
      return;
    }
    const chars = key === 'space' ? ' ' : shift ? key.toUpperCase() : key;
    const edit = (s: TextState) => (key === 'backspace' ? deleteBackward(s) : insertText(s, chars));
    let value: string;
    if (kbTarget === 'A') value = a.apply(edit);
    else {
      value = edit(caretAtEnd(a2Text)).text;
      setA2Text(value);
    }
    if (shift && key !== 'backspace') setShift(false);
    rec(kbTarget, 'ownkey', { key: key === 'space' ? ' ' : key === 'backspace' ? 'Backspace' : chars, value });
  };

  // Backspace repeats while held.
  const repeat = useRef<{ delay: number; timer: number } | null>(null);
  const pressRef = useRef(press);
  pressRef.current = press;
  const stopRepeat = () => {
    if (!repeat.current) return;
    window.clearTimeout(repeat.current.delay);
    window.clearInterval(repeat.current.timer);
    repeat.current = null;
  };
  useEffect(() => stopRepeat, []);

  const key = (k: string, label: string, cls = '', aria?: string) => (
    <button
      key={k}
      className={`kl-key ${cls}`}
      type="button"
      tabIndex={-1}
      aria-label={aria}
      // Keep the focus (and the caret) in the field.
      onPointerDown={(e) => {
        e.preventDefault();
        if (k === 'backspace') {
          stopRepeat();
          pressRef.current('backspace');
          const delay = window.setTimeout(() => {
            if (repeat.current) repeat.current.timer = window.setInterval(() => pressRef.current('backspace'), 80);
          }, 450);
          repeat.current = { delay, timer: 0 };
        }
      }}
      onPointerUp={stopRepeat}
      onPointerCancel={stopRepeat}
      onPointerLeave={stopRepeat}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => {
        if (k !== 'backspace') press(k);
      }}
    >
      {label}
    </button>
  );

  // Б: a French letter at the caret; the system keyboard stays up.
  const accentForB = (ch: string) => (
    <button
      key={ch}
      className="kl-key kl-acc"
      type="button"
      tabIndex={-1}
      onPointerDown={(e) => e.preventDefault()}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => {
        const value = b.apply((s) => insertText(s, ch));
        rec('B', 'ownkey', { key: ch, value });
      }}
    >
      {ch}
    </button>
  );

  // A′ on a physical keyboard (the laptop): letters, space, Backspace, Enter.
  const onA2Key = (e: ReactKeyboardEvent) => {
    if (e.nativeEvent.isComposing || e.key === 'Process' || e.key === 'Dead') return;
    let next: string | null = null;
    if (e.key === 'Backspace') next = deleteBackward(caretAtEnd(a2Text)).text;
    else if (e.key === 'Enter') {
      e.preventDefault();
      submit('A2', a2Text);
      return;
    } else if (e.key.length === 1 && (!(e.ctrlKey || e.metaKey || e.altKey) || (e.ctrlKey && e.altKey))) {
      next = insertText(caretAtEnd(a2Text), e.key).text;
    }
    if (next === null) return;
    e.preventDefault();
    setA2Text(next);
    rec('A2', 'edit', { key: e.key, value: next });
  };

  const summaries = useMemo(
    () => Object.fromEntries((['K', 'A', 'A2', 'B', 'V'] as FieldId[]).map((f) => [f, summarizeField(events.current, f, env.visualViewport)])),
    // `tick` is the journal's version: events.current changes in place.
    [tick, env.visualViewport],
  ) as Record<FieldId, ReturnType<typeof summarizeField>>;

  const line = (f: FieldId) => {
    const s = summaries[f];
    const parts = [
      `системная клавиатура: ${s.focuses ? yesNo(s.systemKeyboard) : 'поле ещё не открывали'}`,
      `автозамен: ${s.autocorrections}`,
      `заглавная в начале: ${s.capitalFirst}`,
      `вставок: ${s.pastes}`,
    ];
    if (s.submits.length) parts.push(`Enter: ${s.submits.length}`);
    return parts.join(' · ');
  };

  const copyReport = async () => {
    const text = JSON.stringify(buildReport(env, events.current, new Date()), null, 1);
    setReportText(text);
    try {
      await navigator.clipboard.writeText(text);
      setCopyState('ok');
    } catch {
      setCopyState('manual');
    }
  };

  const kbShown = kbTarget !== null;
  const blur = (id: 'A' | 'A2') => () => setKbTarget((t) => (t === id ? null : t));

  return (
    <div className={kbShown ? 'lab kl kb-on' : 'lab kl'}>
      <h1>Лаборатория клавиатуры</h1>
      <p className="lead">Служебная страница этапа 5. Данных приложения не касается и ничего не сохраняет: журнал живёт, пока открыта страница.</p>

      <details className="kl-env">
        <summary>Браузер</summary>
        <dl>
          <dt>userAgent</dt>
          <dd>{env.userAgent}</dd>
          <dt>visualViewport</dt>
          <dd>{yesNo(env.visualViewport)}</dd>
          <dt>inputmode</dt>
          <dd>{yesNo(env.inputModeSupported)}</dd>
          <dt>beforeinput</dt>
          <dd>{yesNo(env.beforeInputSupported)}</dd>
          <dt>Палец / без наведения</dt>
          <dd>
            {yesNo(env.pointerCoarse)} / {yesNo(env.hoverNone)}
          </dd>
          <dt>Видимая высота сейчас</dt>
          <dd>{vvNow} px</dd>
        </dl>
      </details>

      <Section name="К" title="Контроль: поле без атрибутов" word={WORDS.K} wordNote="целиком не набирать" summary={line('K')}>
        <p className="kl-how">Только первые 3 буквы каждого тестового слова, без пробела и Enter; посмотреть полосу подсказок; стереть.</p>
        <label className="kl-label">
          Поле К
          <input ref={kRef} className="kl-input" onFocus={onFieldFocus} />
        </label>
      </Section>

      <Section name="А" title="Своя клавиатура, системная скрыта (inputmode=&quot;none&quot;)" word={WORDS.A} summary={line('A')}>
        <form
          ref={aForm}
          className="typebox"
          onSubmit={(e) => {
            e.preventDefault();
            submit('A', a.text);
          }}
        >
          <input
            ref={aRef}
            className="kl-input"
            {...TYPEFIELD_ATTRS}
            inputMode="none"
            value={a.text}
            placeholder="Напишите…"
            aria-label="Поле А"
            onChange={(e) => a.setText(e.target.value)}
            onFocus={() => {
              onFieldFocus();
              setKbTarget('A');
            }}
            onBlur={blur('A')}
          />
          <button className="secondary" type="submit">
            Проверить
          </button>
        </form>
        <Mock innerRef={mockA} />
        {submitted.A !== undefined && <p className="kl-sent">Enter: «{submitted.A}»</p>}
      </Section>

      <Section name="А′" title="Своя клавиатура, без системного поля" word={WORDS.A2} summary={line('A2')}>
        <ul className="kl-how kl-limits">
          {LIMITATIONS.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
        <div
          ref={a2Ref}
          className={`kl-box${kbTarget === 'A2' ? ' on' : ''}`}
          role="textbox"
          aria-label="Поле А′"
          aria-multiline="false"
          tabIndex={0}
          data-value={a2Text}
          lang={FRENCH.code}
          onKeyDown={onA2Key}
          // Not every browser focuses a tapped tabindex box by itself.
          onPointerDown={() => a2Ref.current?.focus({ preventScroll: true })}
          onFocus={() => {
            onFieldFocus();
            setKbTarget('A2');
          }}
          onBlur={blur('A2')}
        >
          {a2Text ? <span>{a2Text}</span> : kbTarget !== 'A2' && <span className="kl-ph">Напишите…</span>}
          {kbTarget === 'A2' && <span className="kl-caret" aria-hidden="true" />}
        </div>
        <Mock innerRef={mockA2} />
        {submitted.A2 !== undefined && <p className="kl-sent">Enter: «{submitted.A2}»</p>}
      </Section>

      <Section name="Б" title="Системная клавиатура + ряд французских букв" word={WORDS.B} summary={line('B')}>
        <form
          className="typebox"
          onSubmit={(e) => {
            e.preventDefault();
            submit('B', b.text);
          }}
        >
          <input
            ref={bRef}
            className="kl-input"
            {...TYPEFIELD_ATTRS}
            value={b.text}
            placeholder="Напишите…"
            aria-label="Поле Б"
            onChange={(e) => b.setText(e.target.value)}
            onFocus={onFieldFocus}
          />
          <button className="secondary" type="submit">
            Проверить
          </button>
        </form>
        <div className="kl-accents">{FRENCH.keyboardRow.map(accentForB)}</div>
        {submitted.B !== undefined && <p className="kl-sent">Enter: «{submitted.B}»</p>}
      </Section>

      <Section name="В" title="Только атрибуты поля (как в приложении сейчас)" word={WORDS.V} summary={line('V')}>
        <form
          className="typebox"
          onSubmit={(e) => {
            e.preventDefault();
            submit('V', vText);
          }}
        >
          <input
            ref={vRef}
            className="kl-input"
            {...TYPEFIELD_ATTRS}
            value={vText}
            placeholder="Напишите…"
            aria-label="Поле В"
            onChange={(e) => setVText(e.target.value)}
            onFocus={onFieldFocus}
          />
          <button className="secondary" type="submit">
            Проверить
          </button>
        </form>
        {submitted.V !== undefined && <p className="kl-sent">Enter: «{submitted.V}»</p>}
      </Section>

      <section className="kl-field">
        <h2>Отчёт</h2>
        <p className="kl-how">Событий в журнале: {events.current.length}.</p>
        <div className="row start">
          <button className="primary" type="button" onClick={() => void copyReport()}>
            Скопировать отчёт
          </button>
          <button
            className="secondary"
            type="button"
            onClick={() => {
              events.current = [];
              setReportText('');
              setCopyState('');
              setTick((n) => n + 1);
            }}
          >
            Очистить журнал
          </button>
        </div>
        {copyState === 'ok' && <p className="kl-sent">Отчёт скопирован — вставьте его в чат.</p>}
        {copyState === 'manual' && (
          <>
            <p className="kl-sent">Браузер не дал скопировать: выделите текст ниже и скопируйте вручную.</p>
            <textarea className="kl-report" readOnly value={reportText} onFocus={(e) => e.currentTarget.select()} />
          </>
        )}
      </section>

      <div ref={kbRef} className="kl-kb" hidden={!kbShown} aria-label="Своя клавиатура">
        <p className="kl-kb-info">
          {kbTarget ? FIELD_NAMES[kbTarget] : ''} · видно {vvNow}
          {fit && ` · клавиатура ${fit.kbHeight} · поле+макет ${fit.blockHeight} из ${fit.available} · помещается: ${yesNo(fit.fits)}`}
        </p>
        {ACCENT_ROWS.map((row, r) => (
          <div className="kl-row" key={`acc${r}`}>
            {row.map((ch) => key(ch, shift ? ch.toUpperCase() : ch))}
          </div>
        ))}
        {LETTER_ROWS.map((row, r) => (
          <div className="kl-row" key={`row${r}`}>
            {r === 2 && key('shift', '⇧', `kl-wide${shift ? ' on' : ''}`, 'Заглавная')}
            {row.map((ch) => key(ch, shift ? ch.toUpperCase() : ch))}
            {r === 2 && key('backspace', '⌫', 'kl-wide', 'Стереть')}
          </div>
        ))}
        <div className="kl-row">
          {key('space', 'пробел', 'kl-space', 'Пробел')}
          {key('enter', '⏎', 'kl-wide kl-enter', 'Enter')}
        </div>
      </div>
    </div>
  );
}
