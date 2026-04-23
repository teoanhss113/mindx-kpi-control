-- ============================================================================
-- Fix RLS policies - Remove infinite recursion
-- ============================================================================

-- Drop ALL existing policies on profiles table
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile by email" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Allow public read for role lookup" ON profiles;

-- Create simple, non-recursive policies

-- 1. Allow anonymous read access for role lookup (no recursion)
CREATE POLICY "Public read access for authentication"
  ON profiles FOR SELECT
  USING (true);

-- 2. Allow service role to do everything (for admin operations)
CREATE POLICY "Service role full access"
  ON profiles FOR ALL
  USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');

COMMENT ON TABLE profiles IS 'Profiles table with public read access for role lookup during authentication';

-- Verify policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'profiles' 
ORDER BY policyname;
