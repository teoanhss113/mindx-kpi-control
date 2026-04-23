-- Migration: Email-based permissions
-- Make email unique and indexed for fast lookups
-- Remove dependency on Firebase UID for permissions

-- 1. Make email unique (if not already)
ALTER TABLE profiles 
  DROP CONSTRAINT IF EXISTS profiles_email_key;

ALTER TABLE profiles 
  ADD CONSTRAINT profiles_email_key UNIQUE (email);

-- 2. Create index on email for fast lookups
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- 3. Create index on role_id for fast permission lookups
CREATE INDEX IF NOT EXISTS idx_profiles_role_id ON profiles(role_id);

-- 4. Update the id column to allow any string (not just Firebase UID)
-- This allows temporary IDs like 'admin-anhpnh' or actual Firebase UIDs
COMMENT ON COLUMN profiles.id IS 'User ID - can be Firebase UID or temporary ID. Email is the primary identifier for permissions.';

-- 5. Add comment to clarify email-based permission system
COMMENT ON TABLE profiles IS 'User profiles with role-based permissions. Permissions are checked by email, not by ID.';
