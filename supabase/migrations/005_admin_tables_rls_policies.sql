-- ============================================================================
-- Admin Tables RLS Policies
-- Enable RLS and create policies for regions, region_centres, user_permissions
-- ============================================================================

-- ============================================================================
-- REGIONS TABLE
-- ============================================================================

-- Enable RLS
ALTER TABLE regions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Public read regions" ON regions;
DROP POLICY IF EXISTS "Admins manage regions" ON regions;
DROP POLICY IF EXISTS "Service role full access regions" ON regions;

-- Allow public read access (for displaying in UI)
CREATE POLICY "Public read regions"
  ON regions FOR SELECT
  USING (true);

-- Allow authenticated users with admin role to manage regions
CREATE POLICY "Admins manage regions"
  ON regions FOR ALL
  USING (
    auth.uid() IN (
      SELECT id FROM profiles 
      WHERE role = 'admin' AND is_active = true
    )
  );

-- Allow service role full access
CREATE POLICY "Service role full access regions"
  ON regions FOR ALL
  USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');

-- ============================================================================
-- REGION_CENTRES TABLE
-- ============================================================================

-- Enable RLS
ALTER TABLE region_centres ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Public read region_centres" ON region_centres;
DROP POLICY IF EXISTS "Admins manage region_centres" ON region_centres;
DROP POLICY IF EXISTS "Service role full access region_centres" ON region_centres;

-- Allow public read access
CREATE POLICY "Public read region_centres"
  ON region_centres FOR SELECT
  USING (true);

-- Allow authenticated users with admin role to manage
CREATE POLICY "Admins manage region_centres"
  ON region_centres FOR ALL
  USING (
    auth.uid() IN (
      SELECT id FROM profiles 
      WHERE role = 'admin' AND is_active = true
    )
  );

-- Allow service role full access
CREATE POLICY "Service role full access region_centres"
  ON region_centres FOR ALL
  USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');

-- ============================================================================
-- USER_PERMISSIONS TABLE
-- ============================================================================

-- Enable RLS
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users view own permissions" ON user_permissions;
DROP POLICY IF EXISTS "Admins view all permissions" ON user_permissions;
DROP POLICY IF EXISTS "Admins insert permissions" ON user_permissions;
DROP POLICY IF EXISTS "Admins update permissions" ON user_permissions;
DROP POLICY IF EXISTS "Admins delete permissions" ON user_permissions;
DROP POLICY IF EXISTS "Service role full access permissions" ON user_permissions;

-- Allow users to view their own permissions
CREATE POLICY "Users view own permissions"
  ON user_permissions FOR SELECT
  USING (auth.uid() = user_id);

-- Allow admins to view all permissions
CREATE POLICY "Admins view all permissions"
  ON user_permissions FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM profiles 
      WHERE role = 'admin' AND is_active = true
    )
  );

-- Allow admins to insert permissions
CREATE POLICY "Admins insert permissions"
  ON user_permissions FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM profiles 
      WHERE role = 'admin' AND is_active = true
    )
  );

-- Allow admins to update permissions
CREATE POLICY "Admins update permissions"
  ON user_permissions FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT id FROM profiles 
      WHERE role = 'admin' AND is_active = true
    )
  );

-- Allow admins to delete permissions
CREATE POLICY "Admins delete permissions"
  ON user_permissions FOR DELETE
  USING (
    auth.uid() IN (
      SELECT id FROM profiles 
      WHERE role = 'admin' AND is_active = true
    )
  );

-- Allow service role full access
CREATE POLICY "Service role full access permissions"
  ON user_permissions FOR ALL
  USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');

-- ============================================================================
-- AUDIT_LOGS TABLE (if exists)
-- ============================================================================

-- Enable RLS
ALTER TABLE IF EXISTS audit_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Admins view audit_logs" ON audit_logs;
DROP POLICY IF EXISTS "Service role full access audit_logs" ON audit_logs;
DROP POLICY IF EXISTS "System insert audit_logs" ON audit_logs;

-- Allow admins to view audit logs
CREATE POLICY "Admins view audit_logs"
  ON audit_logs FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM profiles 
      WHERE role = 'admin' AND is_active = true
    )
  );

-- Allow system to insert audit logs (no user check needed)
CREATE POLICY "System insert audit_logs"
  ON audit_logs FOR INSERT
  WITH CHECK (true);

-- Allow service role full access
CREATE POLICY "Service role full access audit_logs"
  ON audit_logs FOR ALL
  USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');

-- ============================================================================
-- VERIFY POLICIES
-- ============================================================================

-- Show all policies for admin tables
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  cmd, 
  qual 
FROM pg_policies 
WHERE tablename IN ('regions', 'region_centres', 'user_permissions', 'audit_logs')
ORDER BY tablename, policyname;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE regions IS 'Geographic regions with public read access and admin management';
COMMENT ON TABLE region_centres IS 'Region-centre mappings with public read access and admin management';
COMMENT ON TABLE user_permissions IS 'User permissions with owner read and admin management';
COMMENT ON TABLE audit_logs IS 'Audit logs with admin read and system insert access';
