/**
 * Recognizer experiment (docs/RECOGNITION_EXPERIMENT.md): runs every recording through every
 * service variant, checks the transcript with the app's checkSpoken and compares the verdict
 * with the expected one.
 *
 *   node tools/lab/compare.ts [--only=variant,...] [--refresh]
 *
 * Reads tools/.env (CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, LAB_DIR) and never prints
 * its values. Answers are cached in <LAB_DIR>/results/cache/<variant>/<id>.json, so a rerun
 * costs nothing (--refresh asks again). Writes <LAB_DIR>/results/details.json (with texts,
 * local only) and <LAB_DIR>/results/aggregate.md (numbers only, for the public report).
 * Node 24+ (runs .ts directly).
 */
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import JSZip from 'jszip';
import { biasPhrases, checkSpoken, tokenizeSpoken } from '../../src/core/spoken.ts';
import { findLanguagePack } from '../../src/core/languages.ts';
import { encodeWav16, LAB_CATEGORIES, LAB_CATEGORY_LABELS, type LabCategory, type LabManifest } from '../../src/core/lab.ts';
import type { Verdict } from '../../src/core/evaluate.ts';

process.loadEnvFile(new URL('../.env', import.meta.url));
const account = process.env.CLOUDFLARE_ACCOUNT_ID;
const token = process.env.CLOUDFLARE_API_TOKEN;
if (!account || !token) {
  console.error('В tools/.env не заданы CLOUDFLARE_ACCOUNT_ID и/или CLOUDFLARE_API_TOKEN.');
  process.exit(1);
}
const labDir = resolve(process.env.LAB_DIR || '../mana-lab');
const recDir = join(labDir, 'recordings');
const resDir = join(labDir, 'results');
const args = process.argv.slice(2);
const only = args.find((a) => a.startsWith('--only='))?.slice(7).split(',');
const refresh = args.includes('--refresh');

const manifest = JSON.parse(await readFile(join(recDir, 'manifest.json'), 'utf8')) as LabManifest;
const pack = findLanguagePack(manifest.language)!;
const lang = pack.code;

// ---------- Deck vocabulary (what the app would send as hints) ----------

const deckTexts: string[] = [];
for (const f of await readdir('decks')) {
  if (!f.endsWith('.zip')) continue;
  const zip = await JSZip.loadAsync(await readFile(join('decks', f)));
  const deck = JSON.parse((await zip.file('deck.json')!.async('string')).replace(/^﻿/, '')) as {
    language: string;
    entries: { text: string }[];
  };
  if (deck.language === manifest.language) deckTexts.push(...deck.entries.map((e) => e.text));
}
const vocab = biasPhrases(deckTexts, pack.spoken);
const vocabSet = new Set(vocab);

// ---------- Audio inputs: recordings and silence / noise probes ----------

interface Input {
  id: string;
  wav: Buffer;
}

async function wavOf(path: string): Promise<Buffer> {
  return readFile(join(recDir, path));
}

function probes(recordings: Buffer[]): Input[] {
  const n = 32000; // 2 s at 16 kHz
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32) * 2 - 1;
  const noise = new Float32Array(n).map(() => rnd() * 0.005 * Math.sqrt(3));
  // Room: the first 0.15 s of each recording (before speech), joined.
  const room = new Float32Array(n);
  let k = 0;
  for (const b of recordings) {
    for (let i = 0; i < 2400 && k < n; i++, k++) room[k] = b.readInt16LE(44 + 2 * i) / 32768;
    if (k >= n) break;
  }
  return [
    { id: 'probe-silence', wav: Buffer.from(encodeWav16(new Float32Array(n), 16000)) },
    { id: 'probe-noise', wav: Buffer.from(encodeWav16(noise, 16000)) },
    { id: 'probe-room', wav: Buffer.from(encodeWav16(room.subarray(0, k), 16000)) },
  ];
}

// ---------- Services ----------

interface Answer {
  text: string;
  ms: number;
  error?: string;
}

const api = `https://api.cloudflare.com/client/v4/accounts/${account}/ai/run`;
const auth = { Authorization: `Bearer ${token}` };

async function whisper(wav: Buffer, extra: Record<string, unknown>): Promise<Answer> {
  const t0 = performance.now();
  const res = await fetch(`${api}/@cf/openai/whisper-large-v3-turbo`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ audio: wav.toString('base64'), language: lang, ...extra }),
  });
  const ms = Math.round(performance.now() - t0);
  const body = (await res.json().catch(() => null)) as { success?: boolean; result?: { text?: string }; errors?: { message: string }[] } | null;
  if (!res.ok || !body?.success) return { text: '', ms, error: `HTTP ${res.status}: ${body?.errors?.map((e) => e.message).join('; ') ?? ''}` };
  return { text: (body.result?.text ?? '').trim(), ms };
}

async function deepgram(wav: Buffer): Promise<Answer> {
  const t0 = performance.now();
  const res = await fetch(`${api}/@cf/deepgram/nova-3?language=${lang}&mip_opt_out=true`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'audio/wav' },
    body: wav,
  });
  const ms = Math.round(performance.now() - t0);
  const body = (await res.json().catch(() => null)) as {
    success?: boolean;
    result?: { results?: { channels?: { alternatives?: { transcript?: string }[] }[] } };
    errors?: { message: string }[];
  } | null;
  if (!res.ok || !body?.success) return { text: '', ms, error: `HTTP ${res.status}: ${body?.errors?.map((e) => e.message).join('; ') ?? ''}` };
  return { text: (body.result?.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? '').trim(), ms };
}

interface Variant {
  id: string;
  label: string;
  run: (wav: Buffer) => Promise<Answer>;
}

const prompt = vocab.join(', ');
const VARIANTS: Variant[] = [
  { id: 'whisper', label: 'Whisper turbo', run: (w) => whisper(w, {}) },
  { id: 'whisper-prompt', label: 'Whisper turbo + словарь', run: (w) => whisper(w, { initial_prompt: prompt }) },
  { id: 'whisper-vad', label: 'Whisper turbo + фильтр тишины', run: (w) => whisper(w, { vad_filter: true }) },
  { id: 'deepgram', label: 'Deepgram Nova-3', run: deepgram },
];

async function cached(variant: Variant, input: Input): Promise<Answer> {
  const dir = join(resDir, 'cache', variant.id);
  const file = join(dir, `${input.id}.json`);
  if (!refresh) {
    try {
      return JSON.parse(await readFile(file, 'utf8')) as Answer;
    } catch {
      /* not cached yet */
    }
  }
  let a: Answer = { text: '', ms: 0, error: 'not run' };
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      a = await variant.run(input.wav);
    } catch (e) {
      a = { text: '', ms: 0, error: `network: ${e instanceof Error ? e.name : 'error'}` };
    }
    if (!a.error || !/HTTP (429|5\d\d)|network/.test(a.error)) break;
    await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
  }
  await mkdir(dir, { recursive: true });
  if (!a.error) await writeFile(file, JSON.stringify(a), 'utf8');
  return a;
}

// ---------- Run ----------

const recWavs = await Promise.all(manifest.items.map((i) => wavOf(i.audioWav!)));
const inputs: Input[] = manifest.items.map((it, k) => ({ id: it.id, wav: recWavs[k]! }));
const probeInputs = probes(recWavs);
const variants = VARIANTS.filter((v) => !only || only.includes(v.id));

const answers = new Map<string, Map<string, Answer>>(); // variant -> input id -> answer
for (const v of variants) {
  const m = new Map<string, Answer>();
  const all = [...inputs, ...probeInputs];
  let errors = 0;
  // Three requests at a time.
  for (let i = 0; i < all.length; i += 3) {
    const batch = all.slice(i, i + 3);
    const got = await Promise.all(batch.map((inp) => cached(v, inp)));
    batch.forEach((inp, k) => {
      m.set(inp.id, got[k]!);
      if (got[k]!.error) errors++;
    });
  }
  answers.set(v.id, m);
  const firstError = [...m.values()].find((a) => a.error)?.error;
  console.log(`${v.label}: ${all.length - errors}/${all.length} ответов${errors ? `, ошибок ${errors} (${firstError})` : ''}`);
}

// ---------- Evaluate ----------

type Got = Verdict | 'none';
interface Row {
  id: string;
  category: LabCategory;
  expected: Verdict;
  got: Got;
  text: string;
  empty: boolean;
  exact: boolean;
  leak: string[];
  unrelated: boolean;
  ms: number | null;
}

const keys = (s: string) => tokenizeSpoken(s, pack.spoken).map((t) => t.key);
const shares = (text: string, alts: string[]) =>
  checkSpoken(text, alts, pack.spoken).ops.some((o) => o.status === 'ok' || o.status === 'sound');

function evaluate(it: LabManifest['items'][number], alts: string[], ms: number | null, error?: string): Row {
  const text = alts[0] ?? '';
  const heard = alts.flatMap(keys);
  const said = keys(it.said);
  const ref = keys(it.reference);
  const empty = heard.length === 0;
  const got: Got = error ? 'none' : checkSpoken(it.reference, alts, pack.spoken, { determiner: it.determiner }).verdict;
  return {
    id: it.id,
    category: it.category,
    expected: it.expected,
    got,
    text,
    empty,
    exact: alts.some((a) => keys(a).join(' ') === said.join(' ')),
    leak: [...new Set(heard.filter((k) => vocabSet.has(k) && !said.includes(k)))],
    // No word matches (exactly or by a sound rule) either what was said or the reference.
    unrelated: !empty && !shares(it.said, alts) && !shares(it.reference, alts),
    ms,
  };
}

const rows = new Map<string, Row[]>();
rows.set(
  'chrome',
  manifest.items.filter((i) => i.chrome).map((i) => evaluate(i, i.chrome!.alternatives, null)),
);
for (const v of variants) {
  const m = answers.get(v.id)!;
  rows.set(
    v.id,
    manifest.items.map((i) => {
      const a = m.get(i.id)!;
      return evaluate(i, a.text ? [a.text] : [], a.ms, a.error);
    }),
  );
}
const labels = new Map([['chrome', 'Chrome Web Speech (база, другой дубль)'], ...variants.map((v) => [v.id, v.label] as const)]);
const commonIds = new Set(rows.get('chrome')!.map((r) => r.id));
const common = (id: string) => rows.get(id)!.filter((r) => commonIds.has(r.id));

// ---------- Metrics ----------

const ok = (g: Got) => g === 'correct';
const falseAccepts = (rs: Row[]) => rs.filter((r) => r.expected !== 'correct' && ok(r.got));
const falseRejects = (rs: Row[]) => rs.filter((r) => r.expected === 'correct' && !ok(r.got));
const pct = (n: number, d: number) => `${n}/${d}`;
const quantile = (xs: number[], q: number) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))]!;
};
const PRICE_PER_MIN: Record<string, number> = { chrome: 0, whisper: 0.0005, 'whisper-prompt': 0.0005, 'whisper-vad': 0.0005, deepgram: 0.0052 };
const NEURONS_PER_MIN: Record<string, number> = { whisper: 46.63, 'whisper-prompt': 46.63, 'whisper-vad': 46.63, deepgram: 472.73 };
function costLine(id: string): string {
  if (id === 'chrome') return '0 (бесплатно)';
  const minutes = 1500;
  const perDayNeurons = (minutes / 30) * NEURONS_PER_MIN[id]!;
  const paidNeurons = Math.max(0, perDayNeurons - 10000) * 30;
  const usage = (paidNeurons / 1000) * 0.011;
  return perDayNeurons <= 10000
    ? `$${(minutes * PRICE_PER_MIN[id]!).toFixed(2)} по прайсу; при ~50 мин/сутки укладывается в бесплатные 10 000 нейронов`
    : `$${(minutes * PRICE_PER_MIN[id]!).toFixed(2)} по прайсу; сверх бесплатного ≈ $${usage.toFixed(2)} + Workers Paid $5`;
}

const out: string[] = [];
const ids = ['chrome', ...variants.map((v) => v.id)];
const nWrong = common('chrome').filter((r) => r.expected !== 'correct').length;
const nRight = common('chrome').filter((r) => r.expected === 'correct').length;
const nShort = common('chrome').filter((r) => r.category === 'short').length;

out.push(`Пункты: ${commonIds.size} общих с Chrome (из ${manifest.items.length}); ожидали «верно» — ${nRight}, «почти»/«неверно» — ${nWrong}, коротких слов — ${nShort}.`, '');
out.push('### Сводка', '');
out.push('| Вариант | Засчитано неверных | Отвергнуто верных | из них коротких | Пустых | Текст = сказанному | Время ответа, медиана / 90 % |', '|---|---|---|---|---|---|---|');
for (const id of ids) {
  const rs = common(id);
  const ms = rs.map((r) => r.ms).filter((x): x is number => x !== null);
  const fr = falseRejects(rs);
  out.push(
    `| ${labels.get(id)} | ${pct(falseAccepts(rs).length, nWrong)} | ${pct(fr.length, nRight)} | ${pct(fr.filter((r) => r.category === 'short').length, nShort)} | ${rs.filter((r) => r.empty).length} | ${pct(rs.filter((r) => r.exact).length, rs.length)} | ${ms.length ? `${quantile(ms, 0.5)} / ${quantile(ms, 0.9)} мс` : '—'} |`,
  );
}
out.push('', 'Время ответа — от отправки готового файла до ответа сервиса с ноутбука; это нижняя граница (в приложении добавятся сеть телефона и ожидание конца речи). У Chrome время в журнале страницы включает саму речь, поэтому не сравнивается.', '');

out.push('### Ожидали / получили', '');
for (const id of ids) {
  const rs = common(id);
  out.push(`**${labels.get(id)}**`, '', '| ожидали \\ получили | верно | почти | неверно | ошибка сервиса |', '|---|---|---|---|---|');
  for (const e of ['correct', 'almost', 'incorrect'] as const) {
    const xs = rs.filter((r) => r.expected === e);
    const n = (g: Got) => xs.filter((r) => r.got === g).length;
    out.push(`| ${{ correct: 'верно', almost: 'почти', incorrect: 'неверно' }[e]} (${xs.length}) | ${n('correct')} | ${n('almost')} | ${n('incorrect')} | ${n('none')} |`);
  }
  out.push('');
}

out.push('### По категориям: засчитано неверных / отвергнуто верных', '');
out.push(`| Категория | ${ids.map((id) => labels.get(id)).join(' | ')} |`, `|---|${ids.map(() => '---').join('|')}|`);
for (const cat of LAB_CATEGORIES) {
  const cells = ids.map((id) => {
    const rs = common(id).filter((r) => r.category === cat);
    if (!rs.length) return '—';
    return rs[0]!.expected === 'correct' || rs.every((r) => r.expected === 'correct')
      ? `отв. ${falseRejects(rs).length}/${rs.length}`
      : `засч. ${falseAccepts(rs).length}/${rs.length}`;
  });
  out.push(`| ${LAB_CATEGORY_LABELS[cat]} | ${cells.join(' | ')} |`);
}
out.push('');

out.push('### Подсказка и галлюцинации', '');
out.push('| Вариант | Есть слово словаря, которого не было в сказанном | из них новых против Whisper без подсказки | Ответ без общих слов со сказанным и эталоном | Непустой ответ на тишину / шум / фон |', '|---|---|---|---|---|');
const plainLeak = new Map((rows.get('whisper') ?? []).map((r) => [r.id, new Set(r.leak)]));
for (const id of ids) {
  const rs = common(id);
  const probeCell =
    id === 'chrome'
      ? '— (не проверялось)'
      : (() => {
          const m = answers.get(id)!;
          const got = probeInputs.map((p) => m.get(p.id)!);
          return `${got.filter((a) => keys(a.text).length > 0).length}/${got.length}`;
        })();
  const newLeaks = id.startsWith('whisper-') && rows.has('whisper') ? String(rs.filter((r) => r.leak.some((w) => !plainLeak.get(r.id)?.has(w))).length) : '—';
  out.push(`| ${labels.get(id)} | ${rs.filter((r) => r.leak.length).length} | ${newLeaks} | ${rs.filter((r) => r.unrelated).length} | ${probeCell} |`);
}
out.push('', `Словарь колод: ${vocab.length} слов (как \`biasPhrases\` в приложении).`, '');

out.push('### Правило выбора', '');
const chrome = common('chrome');
const cFA = falseAccepts(chrome).length;
const cFR = falseRejects(chrome).length;
const cFRs = falseRejects(chrome).filter((r) => r.category === 'short').length;
out.push(`Chrome: засчитано неверных ${cFA}, отвергнуто верных ${cFR}, из них коротких ${cFRs}.`, '');
out.push('| Вариант | 1. засчитано неверных ≤ Chrome | 2. коротких отвергнуто ≤ ½ и на 3 меньше | 3. отвергнуто верных ≤ Chrome | Лучше Chrome |', '|---|---|---|---|---|');
for (const v of variants) {
  const rs = common(v.id);
  const fa = falseAccepts(rs).length;
  const fr = falseRejects(rs).length;
  const frs = falseRejects(rs).filter((r) => r.category === 'short').length;
  const c1 = fa <= cFA;
  const c2 = cFRs > 2 && frs <= cFRs / 2 && frs <= cFRs - 3;
  const c3 = fr <= cFR;
  const yn = (b: boolean) => (b ? '✓' : '✗');
  out.push(`| ${v.label} | ${yn(c1)} (${fa} vs ${cFA}) | ${yn(c2)} (${frs} vs ${cFRs}) | ${yn(c3)} (${fr} vs ${cFR}) | **${c1 && c2 && c3 ? 'да' : 'нет'}** |`);
}
out.push('');

out.push('### Стоимость при 1500 мин звука в месяц', '');
for (const id of ids) out.push(`- ${labels.get(id)}: ${costLine(id)}.`);
out.push('');

await mkdir(resDir, { recursive: true });
await writeFile(join(resDir, 'aggregate.md'), out.join('\n'), 'utf8');
await writeFile(
  join(resDir, 'details.json'),
  JSON.stringify(
    {
      vocab,
      rows: Object.fromEntries([...rows].map(([id, rs]) => [id, rs])),
      probes: Object.fromEntries(variants.map((v) => [v.id, probeInputs.map((p) => ({ id: p.id, ...answers.get(v.id)!.get(p.id)! }))])),
    },
    null,
    2,
  ),
  'utf8',
);
console.log(`Готово: ${join(resDir, 'aggregate.md')} (только числа), ${join(resDir, 'details.json')} (с текстами, локально).`);
