-- Ensure All Required Pages Exist
-- Run this once to create all pages needed by the application

-- Create all required pages (will skip if already exists)
INSERT INTO pages (key, page_name, description, created_at) VALUES
  ('dashboard', 'Tổng quan', 'Trang tổng quan dashboard với các KPI chính', NOW()),
  ('completion', 'Tỷ lệ Hoàn thành', 'Trang theo dõi tỷ lệ hoàn thành khóa học', NOW()),
  ('teacher-change', 'Thay đổi Giáo viên', 'Trang quản lý thay đổi giáo viên', NOW()),
  ('tickets', 'Phiếu Đánh giá', 'Trang quản lý phiếu đánh giá từ học viên', NOW()),
  ('class-quality', 'Chất lượng Lớp học', 'Trang kiểm soát chất lượng lớp học', NOW()),
  ('office-hours', 'Ca Trải nghiệm', 'Trang quản lý ca trải nghiệm và tỷ lệ chuyển đổi', NOW()),
  ('manager-schedules', 'Đăng ký lịch Quản lý', 'Quản lý đăng ký lịch làm việc hằng tuần theo cơ sở và buổi', NOW()),
  ('admin-manager-schedules', 'Lịch làm việc Quản lý', 'Admin theo dõi lịch làm việc của quản lý theo thời gian và cơ sở', NOW()),
  ('teacher-schedule', 'Điều phối Giáo viên', 'Trang điều phối lịch giảng dạy của giáo viên', NOW()),
  ('teachers', 'Quản lý Giáo viên', 'Trang quản lý thông tin giáo viên', NOW()),
  ('admin-users', 'Quản lý Tài khoản', 'Trang quản lý tài khoản người dùng hệ thống', NOW()),
  ('admin-regions', 'Quản lý Khu vực', 'Trang quản lý khu vực và cơ sở', NOW()),
  ('admin-roles', 'Quản lý Vai trò', 'Trang quản lý vai trò và phân quyền', NOW())
ON CONFLICT (key) DO UPDATE SET
  page_name = EXCLUDED.page_name,
  description = EXCLUDED.description;

-- Verify all pages exist
SELECT 
  key,
  page_name,
  description,
  created_at
FROM pages
ORDER BY 
  CASE key
    WHEN 'dashboard' THEN 1
    WHEN 'completion' THEN 2
    WHEN 'teacher-change' THEN 3
    WHEN 'tickets' THEN 4
    WHEN 'class-quality' THEN 5
    WHEN 'office-hours' THEN 6
    WHEN 'manager-schedules' THEN 7
    WHEN 'teacher-schedule' THEN 8
    WHEN 'teachers' THEN 9
    WHEN 'admin-users' THEN 10
    WHEN 'admin-regions' THEN 11
    WHEN 'admin-roles' THEN 12
    WHEN 'admin-manager-schedules' THEN 13
    ELSE 99
  END;

-- Show count
SELECT COUNT(*) as total_pages FROM pages;
