-- Migration 0005 (stage 6a.5, R42): an account being erased. Set in the first step, together
-- with removing its sessions, codes, invitations and admin rows; the users row goes last
-- (the cascade takes the mark with it). The hourly Cron finishes an erasure left unfinished.
ALTER TABLE users ADD COLUMN deleting_at INTEGER;
