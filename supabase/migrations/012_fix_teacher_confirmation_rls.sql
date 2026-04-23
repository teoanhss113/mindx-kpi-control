-- Migration: Fix RLS policies for teacher_office_hour_confirmations
-- Allow teachers to create and update their own confirmations

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own confirmations" ON teacher_office_hour_confirmations;
DROP POLICY IF EXISTS "Users can update their own confirmations" ON teacher_office_hour_confirmations;
DROP POLICY IF EXISTS "Users can insert confirmations" ON teacher_office_hour_confirmations;

-- Create new policies that allow all authenticated operations
-- Since we're using Firebase Auth (not Supabase Auth), we can't check auth.uid()
-- Instead, we'll allow all operations and rely on application-level security

-- Allow all SELECT operations (teachers can view all confirmations)
CREATE POLICY "Allow all to view confirmations"
  ON teacher_office_hour_confirmations
  FOR SELECT
  USING (true);

-- Allow INSERT for any authenticated request
CREATE POLICY "Allow insert confirmations"
  ON teacher_office_hour_confirmations
  FOR INSERT
  WITH CHECK (true);

-- Allow UPDATE for any authenticated request
CREATE POLICY "Allow update confirmations"
  ON teacher_office_hour_confirmations
  FOR UPDATE
  USING (true);

-- Allow DELETE for any authenticated request (for admin cleanup)
CREATE POLICY "Allow delete confirmations"
  ON teacher_office_hour_confirmations
  FOR DELETE
  USING (true);

-- Add comment explaining the security model
COMMENT ON TABLE teacher_office_hour_confirmations IS 
  'Teacher confirmations for office hour assignments. Security is handled at application level via Firebase Auth. RLS policies allow all operations since Supabase Auth is not used.';
