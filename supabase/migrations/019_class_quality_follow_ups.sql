-- Processing status and staff notes for the class quality table.

CREATE TABLE IF NOT EXISTS class_quality_follow_ups (
  class_id TEXT PRIMARY KEY,
  class_name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'unprocessed'
    CHECK (status IN ('unprocessed', 'in_progress', 'resolved')),
  note TEXT NOT NULL DEFAULT '' CHECK (char_length(note) <= 2000),
  updated_by_profile_id TEXT NOT NULL,
  updated_by_email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_class_quality_follow_ups_status
  ON class_quality_follow_ups(status);

CREATE INDEX IF NOT EXISTS idx_class_quality_follow_ups_updated_at
  ON class_quality_follow_ups(updated_at DESC);

ALTER TABLE class_quality_follow_ups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage class quality follow ups"
  ON class_quality_follow_ups;
CREATE POLICY "Service role can manage class quality follow ups"
  ON class_quality_follow_ups FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION set_class_quality_follow_ups_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_class_quality_follow_ups_updated_at
  ON class_quality_follow_ups;
CREATE TRIGGER trg_class_quality_follow_ups_updated_at
  BEFORE UPDATE ON class_quality_follow_ups
  FOR EACH ROW
  EXECUTE FUNCTION set_class_quality_follow_ups_updated_at();

COMMENT ON TABLE class_quality_follow_ups IS
  'Staff processing status and notes for classes in the operations quality table.';

