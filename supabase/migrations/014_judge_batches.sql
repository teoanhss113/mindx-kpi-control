-- Migration 014: Judge Batches, Final Sessions, Judge Requests
-- Admin creates weekly "batches" of final-class sessions and shares a link with qualified JUDGE teachers.

-- ─── 1. judge_batches ────────────────────────────────────────────────────────
-- One batch = one shareable link, typically one week's final sessions.

CREATE TABLE IF NOT EXISTS judge_batches (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT    UNIQUE NOT NULL,         -- URL-safe identifier, e.g. "tuan-19-05-2026"
  title       TEXT    NOT NULL,                -- Human label, e.g. "Tuần 19/05 – 25/05"
  week_from   DATE    NOT NULL,
  week_to     DATE    NOT NULL,
  notes       TEXT,
  created_by  TEXT    NOT NULL,                -- admin email
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_judge_batches_slug      ON judge_batches(slug);
CREATE INDEX IF NOT EXISTS idx_judge_batches_is_active ON judge_batches(is_active);
CREATE INDEX IF NOT EXISTS idx_judge_batches_week      ON judge_batches(week_from, week_to);

-- ─── 2. final_sessions ───────────────────────────────────────────────────────
-- Admin-curated list of class final sessions within a batch.
-- Metadata is denormalised from LMS at insertion time so the teacher page
-- never needs to call the LMS API.

CREATE TABLE IF NOT EXISTS final_sessions (
  id               UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id         UUID  NOT NULL REFERENCES judge_batches(id) ON DELETE CASCADE,
  lms_class_id     TEXT  NOT NULL,
  lms_slot_id      TEXT  NOT NULL,
  class_name       TEXT  NOT NULL,
  course_short_name TEXT,
  centre_id        TEXT,
  centre_name      TEXT,
  category         TEXT,                       -- Coding / Robotics / Art / Others
  session_date     DATE  NOT NULL,
  start_time_utc   TIMESTAMPTZ,
  end_time_utc     TIMESTAMPTZ,
  main_teacher     TEXT,
  student_count    INT   NOT NULL DEFAULT 0,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(batch_id, lms_slot_id)               -- no duplicate slots per batch
);

CREATE INDEX IF NOT EXISTS idx_final_sessions_batch ON final_sessions(batch_id);
CREATE INDEX IF NOT EXISTS idx_final_sessions_date  ON final_sessions(session_date);

-- ─── 3. judge_requests ───────────────────────────────────────────────────────
-- Drop previous skeleton table from migration 014 (first attempt).
DROP TABLE IF EXISTS judge_requests CASCADE;

CREATE TABLE judge_requests (
  id                UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  final_session_id  UUID  NOT NULL REFERENCES final_sessions(id) ON DELETE CASCADE,
  teacher_email     TEXT  NOT NULL,
  teacher_name      TEXT,
  teacher_id        TEXT,
  status            TEXT  NOT NULL DEFAULT 'pending',   -- pending / approved / rejected
  request_note      TEXT,
  approved_at       TIMESTAMPTZ,
  approved_by       TEXT,
  rejected_at       TIMESTAMPTZ,
  rejected_by       TEXT,
  rejection_reason  TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(final_session_id, teacher_email)
);

CREATE INDEX IF NOT EXISTS idx_judge_requests_session ON judge_requests(final_session_id);
CREATE INDEX IF NOT EXISTS idx_judge_requests_teacher ON judge_requests(teacher_email);
CREATE INDEX IF NOT EXISTS idx_judge_requests_status  ON judge_requests(status);

-- ─── 4. Auto-update updated_at ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION _set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_judge_batches_updated_at   ON judge_batches;
CREATE TRIGGER trg_judge_batches_updated_at
  BEFORE UPDATE ON judge_batches
  FOR EACH ROW EXECUTE FUNCTION _set_updated_at();

DROP TRIGGER IF EXISTS trg_judge_requests_updated_at  ON judge_requests;
CREATE TRIGGER trg_judge_requests_updated_at
  BEFORE UPDATE ON judge_requests
  FOR EACH ROW EXECUTE FUNCTION _set_updated_at();

-- ─── 5. RLS (service-role bypasses) ─────────────────────────────────────────
ALTER TABLE judge_batches   ENABLE ROW LEVEL SECURITY;
ALTER TABLE final_sessions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE judge_requests  ENABLE ROW LEVEL SECURITY;
