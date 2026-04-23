-- Migration: Office Hours Shift Requests
-- Store teacher requests to take available shifts

-- 1. Create enum for request status
DO $$ BEGIN
  CREATE TYPE shift_request_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Create office_hours_shift_requests table
CREATE TABLE IF NOT EXISTS office_hours_shift_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_hour_id TEXT NOT NULL,
  teacher_email TEXT NOT NULL,
  teacher_name TEXT,
  teacher_id TEXT,
  status shift_request_status NOT NULL DEFAULT 'pending',
  request_note TEXT,
  approved_at TIMESTAMPTZ,
  approved_by TEXT,
  rejected_at TIMESTAMPTZ,
  rejected_by TEXT,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(office_hour_id, teacher_email)
);

-- 3. Create indexes
CREATE INDEX IF NOT EXISTS idx_shift_requests_office_hour 
  ON office_hours_shift_requests(office_hour_id);

CREATE INDEX IF NOT EXISTS idx_shift_requests_teacher 
  ON office_hours_shift_requests(teacher_email);

CREATE INDEX IF NOT EXISTS idx_shift_requests_status 
  ON office_hours_shift_requests(status);

CREATE INDEX IF NOT EXISTS idx_shift_requests_created 
  ON office_hours_shift_requests(created_at DESC);

-- 4. Create updated_at trigger
CREATE OR REPLACE FUNCTION update_shift_request_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_shift_request_updated_at
  BEFORE UPDATE ON office_hours_shift_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_shift_request_updated_at();

-- 5. Add RLS policies (allow all operations since using Firebase Auth)
ALTER TABLE office_hours_shift_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all to view shift requests"
  ON office_hours_shift_requests
  FOR SELECT
  USING (true);

CREATE POLICY "Allow insert shift requests"
  ON office_hours_shift_requests
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow update shift requests"
  ON office_hours_shift_requests
  FOR UPDATE
  USING (true);

CREATE POLICY "Allow delete shift requests"
  ON office_hours_shift_requests
  FOR DELETE
  USING (true);

-- 6. Add comments
COMMENT ON TABLE office_hours_shift_requests IS 
  'Teacher requests to take available office hour shifts. Security handled at application level via Firebase Auth.';
COMMENT ON COLUMN office_hours_shift_requests.status IS 
  'Request status: pending (waiting for admin approval), approved (admin assigned teacher), rejected (admin declined request)';
COMMENT ON COLUMN office_hours_shift_requests.office_hour_id IS 
  'Reference to office hour in LMS';
COMMENT ON COLUMN office_hours_shift_requests.teacher_email IS 
  'Teacher email for matching with Firebase auth';
COMMENT ON COLUMN office_hours_shift_requests.teacher_id IS 
  'Teacher ID from LMS for quick assignment';
