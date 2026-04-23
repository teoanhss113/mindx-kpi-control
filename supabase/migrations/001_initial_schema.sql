-- =====================================================
-- MindX KPI Dashboard - Initial Database Schema
-- =====================================================
-- This migration creates all tables for the admin system
-- Authentication is handled by Firebase, Supabase only stores permissions
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. PAGES TABLE
-- Stores all available pages in the system
-- =====================================================
CREATE TABLE pages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  page_name TEXT NOT NULL,
  key TEXT NOT NULL UNIQUE,
  path TEXT NOT NULL,
  description TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default pages
INSERT INTO pages (page_name, key, path, description, display_order) VALUES
  ('Dashboard', 'dashboard', '/', 'Trang tổng quan', 1),
  ('Chất lượng lớp học', 'class-quality', '/class-quality', 'Theo dõi chất lượng lớp học', 2),
  ('Tỷ lệ hoàn thành', 'completion-rate', '/completion-rate', 'Tỷ lệ hoàn thành khóa học', 3),
  ('Thay đổi giáo viên', 'teacher-change', '/teacher-change', 'Theo dõi thay đổi giáo viên', 4),
  ('Giáo viên', 'teachers', '/teachers', 'Quản lý giáo viên', 5),
  ('Lịch giảng dạy', 'teacher-schedule', '/teacher-schedule', 'Lịch giảng dạy của giáo viên', 6),
  ('Office Hours', 'office-hours', '/office-hours', 'Quản lý office hours', 7),
  ('Tickets', 'tickets', '/tickets', 'Quản lý tickets', 8),
  ('Admin - Tài khoản', 'admin-users', '/admin/users', 'Quản lý tài khoản', 100),
  ('Admin - Vai trò', 'admin-roles', '/admin/roles', 'Quản lý vai trò', 101),
  ('Admin - Khu vực', 'admin-regions', '/admin/regions', 'Quản lý khu vực', 102);

-- =====================================================
-- 2. ROLES TABLE
-- Stores user roles (Admin, Manager, Teacher, etc.)
-- =====================================================
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_system_role BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- No default roles - will be created via admin UI

-- =====================================================
-- 3. ROLE_PERMISSIONS TABLE
-- Maps roles to pages (which pages each role can access)
-- =====================================================
CREATE TABLE role_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  page_id UUID NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  can_view BOOLEAN NOT NULL DEFAULT TRUE,
  can_edit BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(role_id, page_id)
);

-- No default role permissions - will be created via admin UI

-- =====================================================
-- 4. PROFILES TABLE
-- Stores user profiles (synced from Firebase)
-- =====================================================
CREATE TABLE profiles (
  id TEXT PRIMARY KEY, -- Firebase UID
  email TEXT NOT NULL UNIQUE,
  display_name TEXT,
  photo_url TEXT,
  role_id UUID REFERENCES roles(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- 5. REGIONS TABLE
-- Stores geographical regions (Miền Bắc, Miền Nam, etc.)
-- =====================================================
CREATE TABLE regions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- 6. REGION_CENTRES TABLE
-- Maps regions to centres (denormalized for performance)
-- =====================================================
CREATE TABLE region_centres (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  region_id UUID NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
  centre_id TEXT NOT NULL, -- Centre ID from LMS
  centre_name TEXT,
  centre_short_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(region_id, centre_id)
);

-- =====================================================
-- 7. USER_PERMISSIONS TABLE
-- Stores user-specific permissions (region + course access)
-- =====================================================
CREATE TABLE user_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  region_id UUID NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
  courses TEXT[] NOT NULL DEFAULT '{}', -- Array of course IDs
  can_view BOOLEAN NOT NULL DEFAULT TRUE,
  can_edit BOOLEAN NOT NULL DEFAULT FALSE,
  can_manage BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, region_id)
);

-- =====================================================
-- INDEXES for performance
-- =====================================================
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_role_id ON profiles(role_id);
CREATE INDEX idx_profiles_is_active ON profiles(is_active);
CREATE INDEX idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX idx_role_permissions_page_id ON role_permissions(page_id);
CREATE INDEX idx_region_centres_region_id ON region_centres(region_id);
CREATE INDEX idx_region_centres_centre_id ON region_centres(centre_id);
CREATE INDEX idx_user_permissions_user_id ON user_permissions(user_id);
CREATE INDEX idx_user_permissions_region_id ON user_permissions(region_id);

-- =====================================================
-- TRIGGERS for updated_at
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_pages_updated_at BEFORE UPDATE ON pages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_roles_updated_at BEFORE UPDATE ON roles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_regions_updated_at BEFORE UPDATE ON regions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_permissions_updated_at BEFORE UPDATE ON user_permissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================
-- Note: We're using service role key for admin operations
-- RLS is enabled but permissive for now since auth is via Firebase

ALTER TABLE pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE region_centres ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

-- Allow service role to do everything
CREATE POLICY "Service role has full access to pages" ON pages
  FOR ALL USING (true);

CREATE POLICY "Service role has full access to roles" ON roles
  FOR ALL USING (true);

CREATE POLICY "Service role has full access to role_permissions" ON role_permissions
  FOR ALL USING (true);

CREATE POLICY "Service role has full access to profiles" ON profiles
  FOR ALL USING (true);

CREATE POLICY "Service role has full access to regions" ON regions
  FOR ALL USING (true);

CREATE POLICY "Service role has full access to region_centres" ON region_centres
  FOR ALL USING (true);

CREATE POLICY "Service role has full access to user_permissions" ON user_permissions
  FOR ALL USING (true);

-- =====================================================
-- COMMENTS for documentation
-- =====================================================
COMMENT ON TABLE pages IS 'Available pages in the system';
COMMENT ON TABLE roles IS 'User roles (Admin, Manager, Teacher, etc.)';
COMMENT ON TABLE role_permissions IS 'Maps roles to pages with view/edit permissions';
COMMENT ON TABLE profiles IS 'User profiles synced from Firebase authentication';
COMMENT ON TABLE regions IS 'Geographical regions for data filtering';
COMMENT ON TABLE region_centres IS 'Maps regions to centres (denormalized)';
COMMENT ON TABLE user_permissions IS 'User-specific permissions for regions and courses';
