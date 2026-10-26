/**
 * The part of D1 the Worker uses, over Node's built-in SQLite (node:sqlite), for Vitest
 * without workerd (R36). Not the D1 engine: rows_read and engine limits are checked with
 * `wrangler d1 … --local` / `wrangler dev` and on the real database. batch runs in one
 * transaction like D1 (all or nothing) — in 6a.3 also check that through wrangler dev.
 */
import { DatabaseSync } from 'node:sqlite';

const migrations = import.meta.glob('../../migrations/*.sql', { query: '?raw', import: 'default', eager: true }) as Record<
  string,
  string
>;

/** Migration files in order: [name, sql]. */
export function migrationFiles(): [string, string][] {
  return Object.entries(migrations)
    .map(([path, sql]): [string, string] => [path.slice(path.lastIndexOf('/') + 1), sql])
    .sort(([a], [b]) => a.localeCompare(b));
}

type Value = null | number | bigint | string | Uint8Array;

/** Queries sent to the database, as D1 counts them against its limit per Worker invocation: a batch is one (R42). */
interface Counter {
  queries: number;
}

type Result = { success: true; results: Record<string, unknown>[]; meta: Record<string, number> };

class Statement {
  constructor(
    private readonly db: DatabaseSync,
    private readonly counter: Counter,
    private readonly sql: string,
    private readonly params: Value[] = [],
  ) {}

  bind(...params: Value[]): Statement {
    return new Statement(this.db, this.counter, this.sql, params);
  }

  async first(column?: string): Promise<unknown> {
    this.counter.queries++;
    const row = this.db.prepare(this.sql).get(...this.params) as Record<string, unknown> | undefined;
    if (!row) return null;
    return column === undefined ? { ...row } : row[column];
  }

  async all(): Promise<Result> {
    this.counter.queries++;
    return this.inBatch();
  }

  async run(): Promise<Result> {
    this.counter.queries++;
    const { changes, lastInsertRowid } = this.db.prepare(this.sql).run(...this.params);
    return { success: true, results: [], meta: { changes: Number(changes), last_row_id: Number(lastInsertRowid) } };
  }

  /** One statement of a batch: rows like `all`, `changes` like `run`; not counted on its own. */
  inBatch(): Result {
    const prepared = this.db.prepare(this.sql);
    if (prepared.columns().length === 0) {
      const { changes } = prepared.run(...this.params);
      return { success: true, results: [], meta: { changes: Number(changes) } };
    }
    const results = prepared.all(...this.params) as Record<string, unknown>[];
    return { success: true, results: results.map((row) => ({ ...row })), meta: {} };
  }
}

export interface FakeD1 {
  prepare(sql: string): Statement;
  batch(statements: Statement[]): Promise<Result[]>;
  exec(sql: string): Promise<{ count: number; duration: number }>;
  /** The SQLite database underneath, for checks in tests. */
  sqlite: DatabaseSync;
  /** Queries so far (a batch counts once); tests reset it. */
  counter: Counter;
}

/** An in-memory database; with `migrate`, all of migrations/ applied in order. */
export function fakeD1({ migrate = true } = {}): FakeD1 {
  const db = new DatabaseSync(':memory:');
  // D1 enforces foreign keys (PRAGMA foreign_keys is 1 there; checked with --local, 6a.2).
  db.exec('PRAGMA foreign_keys = ON');
  if (migrate) for (const [, sql] of migrationFiles()) db.exec(sql);
  const counter: Counter = { queries: 0 };
  return {
    prepare: (sql) => new Statement(db, counter, sql),
    async batch(statements) {
      counter.queries++;
      db.exec('BEGIN');
      try {
        const results = [];
        for (const statement of statements) results.push(statement.inBatch());
        db.exec('COMMIT');
        return results;
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
    async exec(sql) {
      db.exec(sql);
      return { count: 0, duration: 0 };
    },
    sqlite: db,
    counter,
  };
}
