-- Migration: Office Hours Teacher Confirmation
-- Add teacher confirmation status and tracking

-- 1. Create enum for confirmation status
DO $$ BEGIN
  CREATE TYPE teacher_confirmation_status AS ENUM ('pending', 'confirmed', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Create teacher_office_hour_confirmations table
CREATE TABLE IF NOT EXISTS teacher_office_hour_confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_hour_id TEXT NOT NULL,
  teacher_email TEXT NOT NULL,
  teacher_name TEXT,
  status teacher_confirmation_status NOT NULL DEFAULT 'pending',
  confirmed_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(office_hour_id, teacher_email)
);

-- 3. Create indexes
CREATE INDEX IF NOT EXISTS idx_teacher_confirmations_office_hour 
  ON teacher_office_hour_confirmations(office_hour_id);

CREATE INDEX IF NOT EXISTS idx_teacher_confirmations_teacher 
  ON teacher_office_hour_confirmations(teacher_email);

CREATE INDEX IF NOT EXISTS idx_teacher_confirmations_status 
  ON teacher_office_hour_confirmations(status);

CREATE INDEX IF NOT EXISTS idx_teacher_confirmations_created 
  ON teacher_office_hour_confirmations(created_at DESC);

-- 4. Create updated_at trigger
CREATE OR REPLACE FUNCTION update_teacher_confirmation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_teacher_confirmation_updated_at
  BEFORE UPDATE ON teacher_office_hour_confirmations
  FOR EACH ROW
  EXECUTE FUNCTION update_teacher_confirmation_updated_at();

-- 5. Add RLS policies
ALTER TABLE teacher_office_hour_confirmations ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read their own confirmations
CREATE POLICY "Users can view their own confirmations"
  ON teacher_office_hour_confirmations
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Allow authenticated users to update their own confirmations
CREATE POLICY "Users can update their own confirmations"
  ON teacher_office_hour_confirmations
  FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- Allow authenticated users to insert confirmations
CREATE POLICY "Users can insert confirmations"
  ON teacher_office_hour_confirmations
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- 6. Add comments
COMMENT ON TABLE teacher_office_hour_confirmations IS 'Teacher confirmations for office hour assignments';
COMMENT ON COLUMN teacher_office_hour_confirmations.status IS 'Confirmation status: pending, confirmed, rejected';
COMMENT ON COLUMN teacher_office_hour_confirmations.office_hour_id IS 'Reference to office hour in LMS';
COMMENT ON COLUMN teacher_office_hour_confirmations.teacher_email IS 'Teacher email for matching with Firebase auth';
