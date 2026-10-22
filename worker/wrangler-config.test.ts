import { describe, expect, it } from 'vitest';
import text from '../wrangler.jsonc?raw';
import { parseJsonc } from './test/jsonc.ts';

/**
 * Resources created with jurisdiction eu (Р33 п. 3, docs/DEPLOY.md). A binding may name only
 * these: wrangler ≥ 4.45 creates a resource of its own for a binding without an id on deploy,
 * and that one has no jurisdiction (rules of 6a, docs/STATUS.md). Add a resource here only
 * after `d1 info` / `r2 bucket info` showed "jurisdiction": "eu".
 */
const EU_D1 = ['402d25f9-3390-45f4-9177-57621f470661'];
const EU_R2: string[] = [];

interface Config {
  main?: string;
  assets?: { directory?: string; binding?: string; not_found_handling?: string; run_worker_first?: unknown };
  d1_databases?: { binding?: string; database_name?: string; database_id?: string; migrations_dir?: string }[];
  r2_buckets?: { binding?: string; bucket_name?: string; jurisdiction?: string }[];
  kv_namespaces?: { binding?: string; id?: string }[];
  observability?: { enabled?: boolean };
  preview_urls?: boolean;
  send_metrics?: boolean;
  env?: Record<string, unknown>;
}

const config = parseJsonc(text) as Config;

describe('wrangler.jsonc: every binding names its resource', () => {
  it('D1 — database_id of a database created with eu', () => {
    expect(config.d1_databases?.length).toBeGreaterThan(0);
    for (const db of config.d1_databases ?? []) {
      expect(db.database_id, db.binding).toBeDefined();
      expect(EU_D1, db.binding).toContain(db.database_id);
    }
  });

  it('R2 — bucket_name of a bucket created with eu, and jurisdiction eu', () => {
    for (const bucket of config.r2_buckets ?? []) {
      expect(EU_R2, bucket.binding).toContain(bucket.bucket_name);
      expect(bucket.jurisdiction, bucket.binding).toBe('eu');
    }
  });

  it('KV — id', () => {
    for (const kv of config.kv_namespaces ?? []) expect(kv.id, kv.binding).toBeTruthy();
  });

  it('no environments (their bindings are not inherited and would be checked by nobody)', () => {
    expect(config.env).toBeUndefined();
  });
});

describe('wrangler.jsonc: the rest of Р32 / Р33 stays', () => {
  it('the Worker runs first only for /api/*; unknown paths — plain 404', () => {
    expect(config.main).toBe('worker/index.ts');
    expect(config.assets?.run_worker_first).toEqual(['/api/*']);
    expect(config.assets?.not_found_handling).toBe('none');
    expect(config.assets?.binding).toBe('ASSETS');
  });

  it('D1 binding DB → mana, migrations in migrations/', () => {
    expect(config.d1_databases).toEqual([
      { binding: 'DB', database_name: 'mana', database_id: EU_D1[0], migrations_dir: 'migrations' },
    ]);
  });

  it('logs, telemetry and preview URLs off', () => {
    expect(config.observability?.enabled).toBe(false);
    expect(config.send_metrics).toBe(false);
    expect(config.preview_urls).toBe(false);
  });
});

describe('parseJsonc', () => {
  it('comments and trailing commas outside strings', () => {
    const value = parseJsonc('{\n // a\n "u": "http://x/*y*/", /* b */ "l": [1, 2, /* c */],\n "s": "a,]",\n}');
    expect(value).toEqual({ u: 'http://x/*y*/', l: [1, 2], s: 'a,]' });
  });

  it('escaped quotes in strings', () => {
    expect(parseJsonc('{"a": "x\\"// y", "b": 1}')).toEqual({ a: 'x"// y', b: 1 });
  });
});
