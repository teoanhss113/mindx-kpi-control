-- ============================================================================
-- Insert initial admin user
-- ============================================================================

-- Insert admin user profile
-- Note: id is a UUID, not linked to auth.users (Firebase handles auth)
INSERT INTO profiles (id, email, username, full_name, role, is_active)
VALUES (
  uuid_generate_v4(),
  'anhpnh@mindx.com.vn',
  'anhpnh',
  'Anh Pham',
  'admin',
  true
)
ON CONFLICT (email) DO UPDATE
SET 
  role = 'admin',
  is_active = true,
  updated_at = NOW();

COMMENT ON TABLE profiles IS 'Admin user anhpnh@mindx.com.vn added with admin role';
