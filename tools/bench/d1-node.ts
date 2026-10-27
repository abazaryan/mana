/**
 * The part of D1 the Worker uses, over node:sqlite, for the bench (like worker/test/sqlite-d1.ts,
 * which runs only under Vite: it finds the migrations with import.meta.glob). SQLite runs on the
 * main thread, synchronously: the time it takes is counted apart (`sqlMicros`, around every call)
 * so the bench can take it out of the Worker's CPU.
 *
 * `emulate`: the D1 binding of workerd is JavaScript inside the Worker's isolate — it sends a
 * query as JSON and parses the JSON answer (results as columns and rows, turned into objects).
 * With `emulate` the shim does the same work on the Worker's side: JSON.stringify of the query,
 * JSON.parse of an answer the "database" wrote as text (that writing is counted with SQLite),
 * and the rows built back as objects. The fetch between them is not imitated.
 *
 * `recording`: every round trip's answers as text, in order — what replay-worker.js gives back to
 * the same bundle in workerd, without a database.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { ROOT } from './paths.ts';

type Value = null | number | bigint | string | Uint8Array;
type Row = Record<string, unknown>;
type Result = { success: true; results: Row[]; meta: Record<string, number> };

export interface Accounting {
  /** CPU of SQLite (and of the database writing its answer under `emulate`), microseconds. */
  sqlMicros: number;
  /** Queries as D1 counts them: a batch is one. */
  queries: number;
}

/**
 * Microseconds of wall time: SQLite runs synchronously on this thread, so its wall time is its CPU.
 * (CPU counters of Windows advance in steps of about 15.6 ms — useless for one query.)
 */
const cpuNow = (): number => performance.now() * 1000;

/** The answer of the database to one statement, as text (columns and rows), and its `meta`. */
function answerText(results: Row[], changes: number): string {
  const columns = results.length > 0 ? Object.keys(results[0]!) : [];
  const rows = results.map((r) => columns.map((c) => r[c]));
  return JSON.stringify({ results: { columns, rows }, meta: { changes, duration: 0, rows_read: 0, rows_written: 0 }, success: true });
}

/** The binding's side of an answer: parsed and turned back into row objects. */
function fromAnswer(text: string): Result {
  const parsed = JSON.parse(text) as { results: { columns: string[]; rows: unknown[][] }; meta: Record<string, number> };
  const { columns, rows } = parsed.results;
  const results = rows.map((row) => {
    const o: Row = {};
    for (let i = 0; i < columns.length; i++) o[columns[i]!] = row[i];
    return o;
  });
  return { success: true, results, meta: parsed.meta };
}

export class Statement {
  db: NodeD1;
  sql: string;
  params: Value[];

  constructor(db: NodeD1, sql: string, params: Value[] = []) {
    this.db = db;
    this.sql = sql;
    this.params = params;
  }

  bind(...params: Value[]): Statement {
    return new Statement(this.db, this.sql, params);
  }

  /** Runs on the "database" side: SQLite, then (emulate) the answer as text. */
  execute(): { result: Result; text: string | null } {
    const t0 = cpuNow();
    const prepared = this.db.sqlite.prepare(this.sql);
    let result: Result;
    if (prepared.columns().length === 0) {
      const { changes, lastInsertRowid } = prepared.run(...this.params);
      result = { success: true, results: [], meta: { changes: Number(changes), last_row_id: Number(lastInsertRowid) } };
    } else {
      const rows = (prepared.all(...this.params) as Row[]).map((row) => ({ ...row }));
      result = { success: true, results: rows, meta: { changes: 0 } };
    }
    const text = this.db.emulate || this.db.recording ? answerText(result.results, result.meta.changes ?? 0) : null;
    this.db.accounting.sqlMicros += cpuNow() - t0;
    return { result, text };
  }

  /** One round trip of the binding for this statement alone. */
  private async single(): Promise<Result> {
    this.db.accounting.queries++;
    if (this.db.emulate) JSON.stringify({ sql: this.sql, params: this.params.map((p) => (typeof p === 'bigint' ? Number(p) : p)) });
    const { result, text } = this.execute();
    this.db.recording?.push([text!]);
    return text === null || !this.db.emulate ? result : fromAnswer(text);
  }

  async first(column?: string): Promise<unknown> {
    const { results } = await this.single();
    const row = results[0];
    if (!row) return null;
    return column === undefined ? row : row[column];
  }

  async all(): Promise<Result> {
    return this.single();
  }

  async run(): Promise<Result> {
    return this.single();
  }
}

export class NodeD1 {
  sqlite: DatabaseSync;
  emulate: boolean;
  accounting: Accounting = { sqlMicros: 0, queries: 0 };
  /** Answers of every round trip as text (a batch: one per statement), when recording. */
  recording: string[][] | null = null;

  constructor(emulate = false) {
    this.sqlite = new DatabaseSync(':memory:');
    this.emulate = emulate;
    this.sqlite.exec('PRAGMA foreign_keys = ON');
    const dir = `${ROOT}migrations/`;
    for (const name of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) this.sqlite.exec(readFileSync(dir + name, 'utf8'));
  }

  prepare(sql: string): Statement {
    return new Statement(this, sql);
  }

  async batch(statements: Statement[]): Promise<Result[]> {
    this.accounting.queries++;
    if (this.emulate) JSON.stringify(statements.map((s) => ({ sql: s.sql, params: s.params.map((p) => (typeof p === 'bigint' ? Number(p) : p)) })));
    const t0 = cpuNow();
    this.sqlite.exec('BEGIN');
    this.accounting.sqlMicros += cpuNow() - t0;
    const answers: { result: Result; text: string | null }[] = [];
    try {
      for (const s of statements) answers.push(s.execute());
      const t1 = cpuNow();
      this.sqlite.exec('COMMIT');
      this.accounting.sqlMicros += cpuNow() - t1;
    } catch (e) {
      this.sqlite.exec('ROLLBACK');
      throw e;
    }
    this.recording?.push(answers.map((a) => a.text!));
    return answers.map(({ result, text }) => (text === null || !this.emulate ? result : fromAnswer(text)));
  }

  async exec(sql: string): Promise<{ count: number; duration: number }> {
    this.sqlite.exec(sql);
    return { count: 0, duration: 0 };
  }

  /** Seeds and checks of the bench, straight into SQLite (not counted). */
  seed(statements: readonly string[]): void {
    this.sqlite.exec('BEGIN');
    for (const s of statements) this.sqlite.exec(s);
    this.sqlite.exec('COMMIT');
  }
}
