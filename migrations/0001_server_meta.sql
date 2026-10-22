-- Migration 0001 (stage 6a.1): one service table, to try the whole migration path
-- (local, then the real database with --remote). /api/health reads the 'schema' row.
-- Migrations only add (STAGE6_RESEARCH 4.4): no DROP, no RENAME — a test checks.
CREATE TABLE server_meta (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
) STRICT;

INSERT INTO server_meta (key, value) VALUES ('schema', '1');
