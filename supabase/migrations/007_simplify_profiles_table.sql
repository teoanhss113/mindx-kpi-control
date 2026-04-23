-- ============================================================================
-- Simplify Profiles Table - Remove redundant fields
-- ============================================================================
-- Chỉ giữ email, role, is_active trong database
-- Các thông tin khác (username, full_name) sẽ lấy từ LMS API khi hiển thị

-- Drop columns that will be fetched from LMS
ALTER TABLE profiles 
  DROP COLUMN IF EXISTS username,
  DROP COLUMN IF EXISTS full_name;

-- Keep lms_user_id for linking (optional, có thể dùng email)
-- ALTER TABLE profiles DROP COLUMN IF EXISTS lms_user_id;

-- Update function to not set full_name
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment explaining the design
COMMENT ON TABLE profiles IS 'User profiles with minimal data. Display info (username, full_name) fetched from LMS API.';
COMMENT ON COLUMN profiles.email IS 'User email - primary identifier, synced with LMS';
COMMENT ON COLUMN profiles.role IS 'Dashboard role: admin, manager, or viewer';
COMMENT ON COLUMN profiles.is_active IS 'Whether user can access the dashboard';
COMMENT ON COLUMN profiles.lms_user_id IS 'Optional: LMS user ID for faster lookups';
