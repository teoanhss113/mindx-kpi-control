-- Role-based Permission System Migration
-- This replaces the hardcoded role system with flexible role management

-- 1. Create roles table
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  is_system_role BOOLEAN DEFAULT false, -- true for admin, false for custom roles
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create pages table (define all available pages)
CREATE TABLE IF NOT EXISTS pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_key VARCHAR(50) NOT NULL UNIQUE, -- 'dashboard', 'teacher-change', etc.
  page_name VARCHAR(100) NOT NULL, -- 'Tỷ lệ Hoàn thành', 'Tỷ lệ thay đổi Giáo viên'
  page_path VARCHAR(100) NOT NULL, -- '/', '/teacher-change'
  is_admin_page BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create role_permissions table (which pages each role can access)
CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  page_id UUID NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  can_view BOOLEAN DEFAULT true,
  can_edit BOOLEAN DEFAULT false, -- for future use
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(role_id, page_id)
);

-- 4. Add role_id to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES roles(id);

-- 5. Insert default pages
INSERT INTO pages (page_key, page_name, page_path, is_admin_page, display_order) VALUES
('dashboard', 'Tổng quan', '/', false, 1),
('completion', 'Tỷ lệ Hoàn thành', '/completion-rate', false, 2),
('teacher-change', 'Thay đổi Giáo viên', '/teacher-change', false, 3),
('tickets', 'Phiếu Đánh giá', '/tickets', false, 4),
('class-quality', 'Chất lượng Lớp học', '/class-quality', false, 5),
('office-hours', 'Ca Trải nghiệm', '/office-hours', false, 6),
('teacher-schedule', 'Điều phối Giáo viên', '/teacher-schedule', false, 7),
('teachers', 'Quản lý Giáo viên', '/teachers', false, 8),
('admin-users', 'Quản lý Tài khoản', '/admin/users', true, 9),
('admin-regions', 'Quản lý Khu vực', '/admin/regions', true, 10),
('admin-roles', 'Quản lý Vai trò', '/admin/roles', true, 11),
('admin-permissions', 'Phân quyền', '/admin/permissions', true, 12)
ON CONFLICT (page_key) DO NOTHING;

-- 6. Insert default roles
INSERT INTO roles (name, description, is_system_role) VALUES
('Admin', 'Quản trị viên hệ thống - có toàn quyền', true),
('Manager', 'Quản lý - xem tất cả báo cáo', false),
('Viewer', 'Người xem - chỉ xem báo cáo cơ bản', false)
ON CONFLICT (name) DO NOTHING;

-- 7. Set up default permissions
-- Admin role gets all permissions
INSERT INTO role_permissions (role_id, page_id, can_view, can_edit)
SELECT r.id, p.id, true, true
FROM roles r, pages p
WHERE r.name = 'Admin'
ON CONFLICT (role_id, page_id) DO NOTHING;

-- Manager role gets all non-admin pages
INSERT INTO role_permissions (role_id, page_id, can_view, can_edit)
SELECT r.id, p.id, true, false
FROM roles r, pages p
WHERE r.name = 'Manager' AND p.is_admin_page = false
ON CONFLICT (role_id, page_id) DO NOTHING;

-- Viewer role gets basic pages only
INSERT INTO role_permissions (role_id, page_id, can_view, can_edit)
SELECT r.id, p.id, true, false
FROM roles r, pages p
WHERE r.name = 'Viewer' AND p.page_key IN ('dashboard', 'tickets', 'class-quality')
ON CONFLICT (role_id, page_id) DO NOTHING;

-- 8. Migrate existing users to new role system
-- Update existing profiles to use role_id instead of role string
UPDATE profiles 
SET role_id = (SELECT id FROM roles WHERE name = 'Admin')
WHERE role = 'admin';

UPDATE profiles 
SET role_id = (SELECT id FROM roles WHERE name = 'Manager')
WHERE role = 'manager';

UPDATE profiles 
SET role_id = (SELECT id FROM roles WHERE name = 'Viewer')
WHERE role = 'viewer';

-- 9. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_page_id ON role_permissions(page_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role_id ON profiles(role_id);

-- 10. Add RLS policies
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

-- Allow service role to bypass RLS (for admin operations)
CREATE POLICY "Service role can manage roles" ON roles FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role can manage pages" ON pages FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role can manage role_permissions" ON role_permissions FOR ALL USING (auth.role() = 'service_role');

-- Allow authenticated users to read their own permissions
CREATE POLICY "Users can read roles" ON roles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can read pages" ON pages FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can read role_permissions" ON role_permissions FOR SELECT USING (auth.role() = 'authenticated');

-- 11. Create helper function to get user permissions
CREATE OR REPLACE FUNCTION get_user_permissions(user_email TEXT)
RETURNS TABLE (
  page_key TEXT,
  page_name TEXT,
  page_path TEXT,
  can_view BOOLEAN,
  can_edit BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.page_key::TEXT,
    p.page_name::TEXT,
    p.page_path::TEXT,
    rp.can_view,
    rp.can_edit
  FROM profiles prof
  JOIN roles r ON prof.role_id = r.id
  JOIN role_permissions rp ON r.id = rp.role_id
  JOIN pages p ON rp.page_id = p.id
  WHERE prof.email = user_email AND r.is_active = true
  ORDER BY p.display_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 12. Update triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_roles_updated_at BEFORE UPDATE ON roles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();