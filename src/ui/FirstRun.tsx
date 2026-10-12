import { FIRST_RUN_TITLE, LANG_NAMES, type Lang } from './strings';

const ORDER: Lang[] = ['tg', 'ru', 'en'];

/** Shown once: the interface language; the meaning language starts the same (Р8). */
export function FirstRun({ onChoose }: { onChoose(lang: Lang): void }) {
  return (
    <main id="app">
      <header className="top">
        <div className="brand">Mana</div>
      </header>
      <h1 className="first-run">{FIRST_RUN_TITLE}</h1>
      <div className="stack">
        {ORDER.map((l) => (
          <button key={l} className="secondary big" type="button" lang={l} onClick={() => onChoose(l)}>
            {LANG_NAMES[l]}
          </button>
        ))}
      </div>
    </main>
  );
}
