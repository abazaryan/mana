import { describe, expect, it } from 'vitest';
import { fakeD1, migrationFiles } from './test/sqlite-d1.ts';

/** SQL without -- and /* *\/ comments and without the text of string literals, for the checks below. */
function code(sql: string): string {
  let out = '';
  let i = 0;
  while (i < sql.length) {
    if (sql[i] === "'") {
      i++;
      while (i < sql.length && !(sql[i] === "'" && sql[i + 1] !== "'")) i += sql[i] === "'" ? 2 : 1;
      i++;
      out += "''";
    } else if (sql.startsWith('--', i)) {
      while (i < sql.length && sql[i] !== '\n') i++;
    } else if (sql.startsWith('/*', i)) {
      const end = sql.indexOf('*/', i + 2);
      i = end < 0 ? sql.length : end + 2;
    } else {
      out += sql[i++];
    }
  }
  return out;
}

describe('migrations/', () => {
  const files = migrationFiles();

  it('files 0001_…, 0002_… in a row', () => {
    expect(files.length).toBeGreaterThan(0);
    files.forEach(([name], i) => {
      expect(name).toMatch(/^\d{4}_[a-z0-9_]+\.sql$/);
      expect(Number(name.slice(0, 4))).toBe(i + 1);
    });
  });

  it('the check sees through comments and strings', () => {
    expect(code("-- DROP it\nSELECT 'DROP', 'it''s' /* DROP */ FROM t")).toBe("\nSELECT '', ''  FROM t");
  });

  it('only add (STAGE6_RESEARCH 4.4): no DROP, RENAME, DELETE, UPDATE', () => {
    for (const [name, sql] of files) {
      expect(code(sql), name).not.toMatch(/\b(DROP|RENAME|DELETE|UPDATE|REPLACE)\b/i);
    }
  });

  it('no transactions of their own (wrangler runs each file as a whole)', () => {
    for (const [name, sql] of files) expect(code(sql), name).not.toMatch(/\b(BEGIN|COMMIT|ROLLBACK|SAVEPOINT)\b/i);
  });

  it('apply in order to an empty database; 0001 writes the health row', async () => {
    const db = fakeD1();
    expect(await db.prepare("SELECT value FROM server_meta WHERE key = 'schema'").first('value')).toBe('1');
  });

  it('server_meta is STRICT: a value of the wrong type is refused (a number would become text)', () => {
    const db = fakeD1();
    expect(() => db.sqlite.exec("INSERT INTO server_meta (key, value) VALUES ('x', X'00')")).toThrow(/cannot store BLOB/);
  });
});

describe('the D1 stand-in (worker/test/sqlite-d1.ts)', () => {
  it('batch is one transaction: one failing statement keeps nothing', async () => {
    const db = fakeD1();
    await expect(
      db.batch([
        db.prepare('INSERT INTO server_meta (key, value) VALUES (?, ?)').bind('a', '1'),
        db.prepare('INSERT INTO server_meta (key, value) VALUES (?, ?)').bind('schema', 'again'),
      ]),
    ).rejects.toThrow();
    expect(await db.prepare("SELECT 1 FROM server_meta WHERE key = 'a'").first()).toBeNull();
  });
});
