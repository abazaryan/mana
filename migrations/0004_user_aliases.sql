-- Migration 0004 (stage 6a.4, R40): earlier local userIds of an account (STAGE6_RESEARCH 4.1,
-- 5.9). An installation whose answers were added to the account under another id, or a backup
-- file of such an installation. alias_id is never a users.id (the Worker's statements check it:
-- a CHECK cannot look at another table) and belongs to one account only (UNIQUE).
CREATE TABLE user_aliases (
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  alias_id TEXT NOT NULL UNIQUE,
  added_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, alias_id),
  CHECK (alias_id <> user_id)
) STRICT;
