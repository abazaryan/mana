/**
 * Numbers only from a journal file (step "CPU of sign-in routes"): how large the records are
 * as the server stores them (canonical JSON, bytes of UTF-8) and how many keys they have, per
 * type. The file is read where it lies and nothing of it is printed or written but counts and
 * quantiles — tools/bench/.out/sizes.json, which records.ts uses to shape synthetic records.
 *   node tools/bench/journal-sizes.ts <path to mana-journal-….json>
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalJson, utf8Bytes } from '../../src/core/journalRecord.ts';
import { OUT, SIZES_FILE } from './paths.ts';

export interface TypeSizes {
  n: number;
  /** Bytes of canonical JSON: quantiles 0, 10, 25, 50, 75, 90, 100. */
  bytes: number[];
  /** Keys at the top level, median. */
  topKeys: number;
  /** Keys at every level, median. */
  allKeys: number;
  /** Keys of nested objects, median (fsrs and the like). */
  nestedKeys: number;
  /** Array elements in the record, median. */
  arrayItems: number;
}

export interface Sizes {
  records: number;
  types: Record<string, TypeSizes>;
}

const QUANTILES = [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1];

function quantile(sorted: number[], q: number): number {
  return sorted[Math.min(sorted.length - 1, Math.round(q * (sorted.length - 1)))]!;
}

const median = (values: number[]) => quantile([...values].sort((a, b) => a - b), 0.5);

function countKeys(v: unknown, depth = 0): { all: number; nested: number; items: number } {
  if (Array.isArray(v)) return v.reduce((s, x) => { const c = countKeys(x, depth + 1); return { all: s.all + c.all, nested: s.nested + c.nested, items: s.items + 1 + c.items }; }, { all: 0, nested: 0, items: 0 });
  if (typeof v !== 'object' || v === null) return { all: 0, nested: 0, items: 0 };
  let all = 0;
  let nested = 0;
  let items = 0;
  for (const x of Object.values(v)) {
    all++;
    if (depth > 0) nested++;
    const c = countKeys(x, depth + 1);
    all += c.all;
    nested += c.nested;
    items += c.items;
  }
  return { all, nested, items };
}

export function sizesOf(records: readonly unknown[]): Sizes {
  const byType = new Map<string, { bytes: number[]; top: number[]; all: number[]; nested: number[]; items: number[] }>();
  for (const r of records) {
    if (typeof r !== 'object' || r === null) continue;
    const type = String((r as { type?: unknown }).type);
    const row = byType.get(type) ?? { bytes: [], top: [], all: [], nested: [], items: [] };
    row.bytes.push(utf8Bytes(canonicalJson(r)));
    row.top.push(Object.keys(r).length);
    const c = countKeys(r);
    row.all.push(c.all);
    row.nested.push(c.nested);
    row.items.push(c.items);
    byType.set(type, row);
  }
  const types: Record<string, TypeSizes> = {};
  for (const [type, row] of byType) {
    const sorted = [...row.bytes].sort((a, b) => a - b);
    types[type] = {
      n: row.bytes.length,
      bytes: QUANTILES.map((q) => quantile(sorted, q)),
      topKeys: median(row.top),
      allKeys: median(row.all),
      nestedKeys: median(row.nested),
      arrayItems: median(row.items),
    };
  }
  return { records: records.length, types };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const path = process.argv[2];
  if (!path) {
    console.error('usage: node tools/bench/journal-sizes.ts <journal file>');
    process.exit(2);
  }
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as { records?: unknown };
  if (!Array.isArray(parsed.records)) {
    console.error('no records array');
    process.exit(1);
  }
  const sizes = sizesOf(parsed.records);
  mkdirSync(OUT, { recursive: true });
  writeFileSync(SIZES_FILE, JSON.stringify(sizes, null, 2));
  console.log(JSON.stringify(sizes, null, 2));
}
