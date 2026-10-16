/**
 * Builds the recording set for the recognizer experiment (docs/RECOGNITION_EXPERIMENT.md).
 *
 *   node tools/lab/make-set.ts [lab-dir] [decks-dir]
 *
 * Reads <lab-dir>/set-spec.json (what to say for which card; kept outside the repo
 * because it holds lesson content), checks that every reference is a text of an entry in
 * the decks, computes the expected verdict with the app's own checkSpoken, shuffles
 * (fixed seed) and writes <lab-dir>/set.json and <lab-dir>/set-table.md.
 * Defaults: lab-dir = ../mana-lab, decks-dir = decks. Node 24+ (runs .ts directly).
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import JSZip from 'jszip';
import { checkSpoken } from '../../src/core/spoken.ts';
import { findLanguagePack } from '../../src/core/languages.ts';
import { LAB_CATEGORIES, LAB_CATEGORY_LABELS, type LabCategory, type LabItem, type LabSet } from '../../src/core/lab.ts';

const labDir = resolve(process.argv[2] ?? '../mana-lab');
const decksDir = resolve(process.argv[3] ?? 'decks');

interface Spec {
  language: string;
  items: { cat: LabCategory; ref: string; said: string }[];
}

const spec = JSON.parse(await readFile(join(labDir, 'set-spec.json'), 'utf8')) as Spec;
const pack = findLanguagePack(spec.language);
if (!pack) throw new Error(`Нет языкового пакета для ${spec.language}`);

// reference text -> does the card show a determiner hint
const entries = new Map<string, boolean>();
for (const f of await readdir(decksDir)) {
  if (!f.endsWith('.zip')) continue;
  const zip = await JSZip.loadAsync(await readFile(join(decksDir, f)));
  const deck = JSON.parse((await zip.file('deck.json')!.async('string')).replace(/^﻿/, '')) as {
    language: string;
    entries: { text: string; form?: { determiner?: string } }[];
  };
  if (deck.language !== spec.language) continue;
  for (const e of deck.entries) {
    const det = e.form?.determiner !== undefined;
    entries.set(e.text, (entries.get(e.text) ?? false) || det);
  }
}

const problems: string[] = [];
const items: LabItem[] = [];
spec.items.forEach((s, k) => {
  if (!entries.has(s.ref)) problems.push(`#${k + 1}: «${s.ref}» не найдено среди записей колод`);
  if (!LAB_CATEGORIES.includes(s.cat)) problems.push(`#${k + 1}: неизвестная категория ${s.cat}`);
  const determiner = entries.get(s.ref) ?? false;
  const c = checkSpoken(s.ref, [s.said], pack.spoken, { determiner });
  items.push({ id: '', category: s.cat, reference: s.ref, said: s.said, determiner, expected: c.verdict });
});
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}

// Seeded shuffle (mulberry32) so the order is the same every run and categories are mixed.
let seed = 20261016;
const rnd = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
for (let i = items.length - 1; i > 0; i--) {
  const j = Math.floor(rnd() * (i + 1));
  [items[i], items[j]] = [items[j]!, items[i]!];
}
items.forEach((it, k) => (it.id = `i${String(k + 1).padStart(2, '0')}`));

const set: LabSet = { format: 'mana-lab-set', version: 1, language: spec.language, items };
await writeFile(join(labDir, 'set.json'), JSON.stringify(set, null, 2), 'utf8');

const VERDICT_RU = { correct: 'верно', almost: 'почти', incorrect: 'неверно' } as const;
const lines = ['# Набор записей (для одобрения)', '', `Пунктов: ${items.length}`, ''];
lines.push('| Категория | Пунктов | верно | почти | неверно |', '|---|---|---|---|---|');
for (const cat of LAB_CATEGORIES) {
  const xs = items.filter((i) => i.category === cat);
  const n = (v: string) => xs.filter((i) => i.expected === v).length;
  lines.push(`| ${LAB_CATEGORY_LABELS[cat]} | ${xs.length} | ${n('correct')} | ${n('almost')} | ${n('incorrect')} |`);
}
lines.push('', '## Что сказать (по категориям; порядок записи перемешан)', '');
for (const cat of LAB_CATEGORIES) {
  lines.push(`### ${LAB_CATEGORY_LABELS[cat]}`, '', '| Эталон карточки | Сказать | Ожидаем |', '|---|---|---|');
  for (const i of items.filter((x) => x.category === cat)) {
    lines.push(`| ${i.reference} | **${i.said}** | ${VERDICT_RU[i.expected]}${i.determiner ? ' (с подсказкой артикля)' : ''} |`);
  }
  lines.push('');
}
await writeFile(join(labDir, 'set-table.md'), lines.join('\n'), 'utf8');
console.log(`OK: ${items.length} пунктов → ${join(labDir, 'set.json')}; таблица → ${join(labDir, 'set-table.md')}`);
