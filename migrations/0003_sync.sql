-- Migration 0003 (stage 6a.3, R39): the journal and the synced settings (STAGE6_RESEARCH 4.2).
-- Times: integer milliseconds UTC. Rows of an account go with it (ON DELETE CASCADE); deleting
-- a large account (6a.5) removes the journal in portions first, the cascade is the safety net.

-- One row per journal record of an account. seq is the server's order and the devices' cursor
-- (AUTOINCREMENT: never reused, also after deletes). body is the record's canonical JSON (keys
-- sorted, no spaces; src/core/journalRecord.ts), body_hash its SHA-256 (hex): the same id with
-- another body is a conflict and the row stays as it is. device_id has no foreign key: removing
-- or revoking a device leaves its records.
CREATE TABLE journal (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  type TEXT NOT NULL,
  at INTEGER NOT NULL,
  device_id TEXT NOT NULL,
  deck_id TEXT NOT NULL,
  entry_id TEXT NOT NULL,
  -- scheduling rules of an answer (R29.4); NULL for other records
  rules INTEGER,
  body TEXT NOT NULL,
  body_hash TEXT NOT NULL,
  received_at INTEGER NOT NULL,
  UNIQUE (user_id, id)
) STRICT;
CREATE INDEX journal_user_seq ON journal (user_id, seq);

-- Synced settings, one row per key (uiLang, meaningLang, newPerDay; the Worker checks keys and
-- values, no CHECK here: a later key needs no rebuilt table). value is JSON. server_rev is the
-- account's change number, given inside the writing transaction: the change the server
-- received last wins (R33 item 10).
CREATE TABLE user_settings (
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  server_rev INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  device_id TEXT NOT NULL,
  PRIMARY KEY (user_id, key)
) STRICT;
