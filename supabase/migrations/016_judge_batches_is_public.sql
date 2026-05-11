-- Migration 016: Add is_public column to judge_batches
-- When is_public = true, the batch is visible on /judge-requests for all active users (not just via shared link).

ALTER TABLE judge_batches ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_judge_batches_is_public ON judge_batches(is_public);
