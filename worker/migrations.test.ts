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

  it('only add (STAGE6_RESEARCH 4.4): no DROP, RENAME, DELETE, UPDATE (ON DELETE CASCADE of a key is fine)', () => {
    for (const [name, sql] of files) {
      expect(code(sql).replace(/\bON\s+DELETE\s+CASCADE\b/gi, ''), name).not.toMatch(/\b(DROP|RENAME|DELETE|UPDATE|REPLACE)\b/i);
    }
  });

  it('every table is STRICT', () => {
    const db = fakeD1();
    const tables = db.sqlite.prepare("SELECT name, sql FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all() as {
      name: string;
      sql: string;
    }[];
    expect(tables.length).toBeGreaterThan(1);
    for (const { name, sql } of tables) expect(sql, name).toMatch(/\)\s*STRICT$/);
  });

  it('foreign keys are enforced, as in D1: a device of no account is refused', () => {
    const db = fakeD1();
    expect(() => db.sqlite.exec("INSERT INTO devices (id, user_id, name, created_at, last_seen_at) VALUES ('d', 'nobody', 'x', 1, 1)")).toThrow(
      /FOREIGN KEY/,
    );
  });

  it('deleting an account erases its devices, sessions, codes, consents and invitations (6a.5)', () => {
    const db = fakeD1();
    db.sqlite.exec(`
      INSERT INTO users (id, label, minor, created_at) VALUES ('u', 'test', 0, 1);
      INSERT INTO devices (id, user_id, name, created_at, last_seen_at) VALUES ('d', 'u', 'x', 1, 1);
      INSERT INTO sessions VALUES ('s', 'u', 'd', 1, 1, 2);
      INSERT INTO pairing_codes (code_hash, user_id, created_by_device, created_at, expires_at) VALUES ('c', 'u', 'd', 1, 2);
      INSERT INTO consents VALUES ('k', 'u', 1, 'self', NULL, 'd', 1);
      INSERT INTO invites (token_hash, kind, user_id, created_at, expires_at) VALUES ('i', 'device', 'u', 1, 2);
      DELETE FROM users WHERE id = 'u';
    `);
    for (const table of ['devices', 'sessions', 'pairing_codes', 'consents', 'invites']) {
      expect(db.sqlite.prepare(`SELECT count(*) AS n FROM ${table}`).get(), table).toEqual({ n: 0 });
    }
  });

  it('deleting an account erases its journal and settings too (6a.3); a record of no account is refused', () => {
    const db = fakeD1();
    db.sqlite.exec(`
      INSERT INTO users (id, label, minor, created_at) VALUES ('u', 'test', 0, 1);
      INSERT INTO journal (user_id, id, type, at, device_id, deck_id, entry_id, body, body_hash, received_at)
        VALUES ('u', 'r', 'review', 1, 'd', 'k', 'e', '{}', 'h', 1);
      INSERT INTO user_settings VALUES ('u', 'uiLang', '"tg"', 1, 1, 'd');
    `);
    expect(() =>
      db.sqlite.exec("INSERT INTO journal (user_id, id, type, at, device_id, deck_id, entry_id, body, body_hash, received_at) VALUES ('x', 'r', 'review', 1, 'd', 'k', 'e', '{}', 'h', 1)"),
    ).toThrow(/FOREIGN KEY/);
    db.sqlite.exec("DELETE FROM users WHERE id = 'u'");
    for (const table of ['journal', 'user_settings']) expect(db.sqlite.prepare(`SELECT count(*) AS n FROM ${table}`).get(), table).toEqual({ n: 0 });
  });

  it('consents: a parent name exactly when a parent agreed', () => {
    const db = fakeD1();
    db.sqlite.exec("INSERT INTO users (id, label, minor, created_at) VALUES ('u', 'test', 1, 1)");
    const add = (by: string, name: string | null) =>
      db.sqlite.prepare('INSERT INTO consents VALUES (?, ?, 1, ?, ?, ?, 1)').run(`${by}${name}`, 'u', by, name, 'd');
    expect(() => add('parent', null)).toThrow(/CHECK/);
    expect(() => add('self', 'Name')).toThrow(/CHECK/);
    expect(() => add('parent', 'Name')).not.toThrow();
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
