-- Debug Permissions Script
-- Use this to check and fix permission issues

-- 1. Check if user exists and has role
SELECT 
  p.id,
  p.email,
  p.display_name,
  p.is_active,
  p.role_id,
  r.role_name
FROM profiles p
LEFT JOIN roles r ON p.role_id = r.id
WHERE p.email = 'tuannh@mindx.com.vn';

-- 2. Check all pages in database
SELECT * FROM pages ORDER BY key;

-- 3. Check role permissions for the user's role
SELECT 
  rp.id,
  rp.role_id,
  r.role_name,
  rp.page_id,
  pg.key as page_key,
  pg.page_name,
  rp.can_view,
  rp.can_edit
FROM role_permissions rp
JOIN roles r ON rp.role_id = r.id
JOIN pages pg ON rp.page_id = pg.id
WHERE r.id = (
  SELECT role_id FROM profiles WHERE email = 'tuannh@mindx.com.vn'
)
ORDER BY pg.key;

-- 4. Check if 'dashboard' page exists
SELECT * FROM pages WHERE key = 'dashboard';

-- 5. Check if user's role has permission to view 'dashboard'
SELECT 
  rp.*,
  pg.key,
  pg.page_name
FROM role_permissions rp
JOIN pages pg ON rp.page_id = pg.id
WHERE rp.role_id = (
  SELECT role_id FROM profiles WHERE email = 'tuannh@mindx.com.vn'
)
AND pg.key = 'dashboard';

-- 6. If 'dashboard' page doesn't exist, create it
INSERT INTO pages (key, page_name, description, created_at)
VALUES ('dashboard', 'Tổng quan', 'Trang tổng quan dashboard', NOW())
ON CONFLICT (key) DO NOTHING;

-- 7. Grant 'dashboard' permission to user's role (if not exists)
-- Replace 'YOUR_ROLE_ID' with actual role_id from query #1
INSERT INTO role_permissions (role_id, page_id, can_view, can_edit, created_at)
SELECT 
  (SELECT role_id FROM profiles WHERE email = 'tuannh@mindx.com.vn'),
  (SELECT id FROM pages WHERE key = 'dashboard'),
  true,
  false,
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM role_permissions rp
  JOIN pages pg ON rp.page_id = pg.id
  WHERE rp.role_id = (SELECT role_id FROM profiles WHERE email = 'tuannh@mindx.com.vn')
  AND pg.key = 'dashboard'
);

-- 8. Verify the fix
SELECT 
  p.email,
  r.role_name,
  pg.key as page_key,
  pg.page_name,
  rp.can_view,
  rp.can_edit
FROM profiles p
JOIN roles r ON p.role_id = r.id
JOIN role_permissions rp ON rp.role_id = r.id
JOIN pages pg ON rp.page_id = pg.id
WHERE p.email = 'tuannh@mindx.com.vn'
AND pg.key = 'dashboard';

-- 9. List all required page keys for the application
-- Make sure these pages exist in your database
/*
Required page keys:
- dashboard (Tổng quan)
- completion (Tỷ lệ Hoàn thành)
- teacher-change (Thay đổi Giáo viên)
- tickets (Phiếu Đánh giá)
- class-quality (Chất lượng Lớp học)
- office-hours (Ca Trải nghiệm)
- manager-schedules (Đăng ký lịch Quản lý)
- admin-manager-schedules (Lịch làm việc Quản lý)
- teacher-schedule (Điều phối Giáo viên)
- teachers (Quản lý Giáo viên)
- admin-users (Quản lý Tài khoản)
- admin-regions (Quản lý Khu vực)
- admin-roles (Quản lý Vai trò)
*/

-- 10. Create all required pages if they don't exist
INSERT INTO pages (key, page_name, description, created_at) VALUES
  ('dashboard', 'Tổng quan', 'Trang tổng quan dashboard', NOW()),
  ('completion', 'Tỷ lệ Hoàn thành', 'Trang tỷ lệ hoàn thành', NOW()),
  ('teacher-change', 'Thay đổi Giáo viên', 'Trang thay đổi giáo viên', NOW()),
  ('tickets', 'Phiếu Đánh giá', 'Trang phiếu đánh giá', NOW()),
  ('class-quality', 'Chất lượng Lớp học', 'Trang chất lượng lớp học', NOW()),
  ('office-hours', 'Ca Trải nghiệm', 'Trang ca trải nghiệm', NOW()),
  ('manager-schedules', 'Đăng ký lịch Quản lý', 'Trang đăng ký lịch làm việc quản lý', NOW()),
  ('admin-manager-schedules', 'Lịch làm việc Quản lý', 'Trang quản trị lịch làm việc quản lý', NOW()),
  ('teacher-schedule', 'Điều phối Giáo viên', 'Trang điều phối giáo viên', NOW()),
  ('teachers', 'Quản lý Giáo viên', 'Trang quản lý giáo viên', NOW()),
  ('admin-users', 'Quản lý Tài khoản', 'Trang quản lý tài khoản', NOW()),
  ('admin-regions', 'Quản lý Khu vực', 'Trang quản lý khu vực', NOW()),
  ('admin-roles', 'Quản lý Vai trò', 'Trang quản lý vai trò', NOW())
ON CONFLICT (key) DO NOTHING;

-- 11. Grant all permissions to user's role
-- This will give full access to all pages
INSERT INTO role_permissions (role_id, page_id, can_view, can_edit, created_at)
SELECT 
  (SELECT role_id FROM profiles WHERE email = 'tuannh@mindx.com.vn'),
  pg.id,
  true,
  true,
  NOW()
FROM pages pg
WHERE NOT EXISTS (
  SELECT 1 FROM role_permissions rp
  WHERE rp.role_id = (SELECT role_id FROM profiles WHERE email = 'tuannh@mindx.com.vn')
  AND rp.page_id = pg.id
);

-- 12. Final verification - show all permissions for user
SELECT 
  p.email,
  p.display_name,
  r.role_name,
  pg.key as page_key,
  pg.page_name,
  rp.can_view,
  rp.can_edit
FROM profiles p
JOIN roles r ON p.role_id = r.id
JOIN role_permissions rp ON rp.role_id = r.id
JOIN pages pg ON rp.page_id = pg.id
WHERE p.email = 'tuannh@mindx.com.vn'
ORDER BY pg.key;
