-- ============================================================================
-- Remove auth.users constraint from profiles table
-- Allow profiles to exist independently (Firebase handles auth)
-- ============================================================================

-- Drop the foreign key constraint
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- Make id a regular UUID (not referencing auth.users)
-- Add a new column for Firebase UID if needed
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS firebase_uid TEXT;

-- Update indexes
CREATE INDEX IF NOT EXISTS idx_profiles_firebase_uid ON profiles(firebase_uid);

-- Drop the trigger that auto-creates profiles from auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Update RLS policies to work without auth.uid()
-- Users can view their own profile by email match
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile by email"
  ON profiles FOR SELECT
  USING (email = current_setting('request.jwt.claims', true)::json->>'email');

-- Allow anyone to read profiles (for role lookup)
DROP POLICY IF EXISTS "Allow public read for role lookup" ON profiles;
CREATE POLICY "Allow public read for role lookup"
  ON profiles FOR SELECT
  USING (true);

COMMENT ON TABLE profiles IS 'User profiles with roles - Firebase LMS handles authentication';
COMMENT ON COLUMN profiles.firebase_uid IS 'Firebase UID from LMS authentication';
