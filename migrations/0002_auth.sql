-- Migration 0002 (stage 6a.2, R37): sign-in — accounts, invitations, devices, sessions,
-- pairing codes, counters of failed code attempts, consent records, admin actions
-- (STAGE6_RESEARCH 4.1). user_aliases comes with the transfer of answers (6a.4).
-- Times: integer milliseconds UTC. Tokens and codes only as hashes (hex), never in clear.
-- Rows of an account go with it (ON DELETE CASCADE): deleting the users row erases them (6a.5).

CREATE TABLE users (
  id TEXT PRIMARY KEY NOT NULL,
  -- the administrator's name for the person; not shown in the app
  label TEXT NOT NULL,
  -- under 16: marked in the invitation or answered "no" at sign-in (no date of birth)
  minor INTEGER NOT NULL DEFAULT 0 CHECK (minor IN (0, 1)),
  created_at INTEGER NOT NULL
) STRICT;

-- account: a new account and its first device; device: one more device of an existing
-- account (also the recovery link). One use: used_at; redeem_id marks the request that won.
CREATE TABLE invites (
  token_hash TEXT PRIMARY KEY NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('account', 'device')),
  user_id TEXT REFERENCES users (id) ON DELETE CASCADE,
  label TEXT,
  minor INTEGER NOT NULL DEFAULT 0 CHECK (minor IN (0, 1)),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  used_device_id TEXT,
  redeem_id TEXT,
  CHECK (kind = 'device' OR label IS NOT NULL),
  CHECK (kind = 'account' OR user_id IS NOT NULL)
) STRICT;
CREATE INDEX invites_expires ON invites (expires_at);

-- id = the device's local deviceId (meta). revoked_at: removed or signed out; cleared on a new sign-in.
CREATE TABLE devices (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  app_version INTEGER,
  revoked_at INTEGER
) STRICT;
CREATE INDEX devices_user ON devices (user_id);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  device_id TEXT NOT NULL REFERENCES devices (id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  last_used_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
) STRICT;
CREATE INDEX sessions_user ON sessions (user_id);
CREATE INDEX sessions_device ON sessions (device_id);
CREATE INDEX sessions_expires ON sessions (expires_at);

-- At most one live code per account: issuing a code removes the account's earlier ones.
CREATE TABLE pairing_codes (
  code_hash TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_by_device TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  used_device_id TEXT
) STRICT;
CREATE INDEX pairing_codes_user ON pairing_codes (user_id);
CREATE INDEX pairing_codes_expires ON pairing_codes (expires_at);

-- Failed code attempts (STAGE6_RESEARCH 7.3): 'pair:global' and 'pair:ip:<hash>'. Rows with
-- an IP hash are erased within a day at most — promised in the notice (docs/NOTICE.md).
CREATE TABLE auth_attempts (
  bucket TEXT PRIMARY KEY NOT NULL,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL,
  locked_until INTEGER
) STRICT;

-- Who agreed, when, to which version of the notice; the parent's or guardian's name only
-- when they gave consent.
CREATE TABLE consents (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  notice_version INTEGER NOT NULL,
  given_by TEXT NOT NULL CHECK (given_by IN ('self', 'parent')),
  parent_name TEXT,
  device_id TEXT NOT NULL,
  given_at INTEGER NOT NULL,
  CHECK ((given_by = 'parent') = (parent_name IS NOT NULL))
) STRICT;
CREATE INDEX consents_user ON consents (user_id);

-- What the admin scripts did; user_id without a name, detail without personal data.
-- No foreign key: the row of a deleted account stays.
CREATE TABLE admin_actions (
  id TEXT PRIMARY KEY NOT NULL,
  at INTEGER NOT NULL,
  action TEXT NOT NULL,
  user_id TEXT,
  detail TEXT
) STRICT;
