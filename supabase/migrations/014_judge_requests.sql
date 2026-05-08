-- Migration: Judge Requests
-- Store teacher requests to be a judge for final class sessions

-- 1. Create enum (reuse shift_request_status if exists, else create judge_request_status)
DO $$ BEGIN
  CREATE TYPE judge_request_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Create judge_requests table
CREATE TABLE IF NOT EXISTS judge_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,        -- LMS slot _id
  class_id TEXT NOT NULL,          -- LMS class id
  teacher_email TEXT NOT NULL,
  teacher_name TEXT,
  teacher_id TEXT,
  status judge_request_status NOT NULL DEFAULT 'pending',
  request_note TEXT,
  approved_at TIMESTAMPTZ,
  approved_by TEXT,
  rejected_at TIMESTAMPTZ,
  rejected_by TEXT,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(session_id, teacher_email)
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_judge_requests_session
  ON judge_requests(session_id);

CREATE INDEX IF NOT EXISTS idx_judge_requests_teacher
  ON judge_requests(teacher_email);

CREATE INDEX IF NOT EXISTS idx_judge_requests_status
  ON judge_requests(status);

-- 4. Auto-update updated_at
CREATE OR REPLACE FUNCTION update_judge_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_judge_requests_updated_at ON judge_requests;
CREATE TRIGGER trg_judge_requests_updated_at
  BEFORE UPDATE ON judge_requests
  FOR EACH ROW EXECUTE FUNCTION update_judge_requests_updated_at();

-- 5. RLS
ALTER TABLE judge_requests ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS (used by API routes via supabaseAdmin)
