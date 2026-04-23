-- Update page names to match Sidebar labels
-- Ensure consistency between database and UI

-- Update page names to match navigation labels
UPDATE pages SET page_name = 'Tổng quan' WHERE page_key = 'dashboard';
UPDATE pages SET page_name = 'Tỷ lệ Hoàn thành' WHERE page_key = 'completion';
UPDATE pages SET page_name = 'Thay đổi Giáo viên' WHERE page_key = 'teacher-change';
UPDATE pages SET page_name = 'Phiếu Đánh giá' WHERE page_key = 'tickets';
UPDATE pages SET page_name = 'Chất lượng Lớp học' WHERE page_key = 'class-quality';
UPDATE pages SET page_name = 'Ca Trải nghiệm' WHERE page_key = 'office-hours';
UPDATE pages SET page_name = 'Điều phối Giáo viên' WHERE page_key = 'teacher-schedule';
UPDATE pages SET page_name = 'Quản lý Giáo viên' WHERE page_key = 'teachers';
UPDATE pages SET page_name = 'Quản lý Tài khoản' WHERE page_key = 'admin-users';
UPDATE pages SET page_name = 'Quản lý Khu vực' WHERE page_key = 'admin-regions';
UPDATE pages SET page_name = 'Quản lý Vai trò' WHERE page_key = 'admin-roles';
UPDATE pages SET page_name = 'Phân quyền' WHERE page_key = 'admin-permissions';

-- Add missing pages if they don't exist
INSERT INTO pages (page_key, page_name, page_path, is_admin_page, display_order) VALUES
('completion', 'Tỷ lệ Hoàn thành', '/completion-rate', false, 2),
('teachers', 'Quản lý Giáo viên', '/teachers', false, 7),
('admin-permissions', 'Phân quyền', '/admin/permissions', true, 10)
ON CONFLICT (page_key) DO UPDATE SET
  page_name = EXCLUDED.page_name,
  page_path = EXCLUDED.page_path,
  is_admin_page = EXCLUDED.is_admin_page,
  display_order = EXCLUDED.display_order;

-- Update display order to match navigation order
UPDATE pages SET display_order = 1 WHERE page_key = 'dashboard';
UPDATE pages SET display_order = 2 WHERE page_key = 'completion';
UPDATE pages SET display_order = 3 WHERE page_key = 'teacher-change';
UPDATE pages SET display_order = 4 WHERE page_key = 'tickets';
UPDATE pages SET display_order = 5 WHERE page_key = 'class-quality';
UPDATE pages SET display_order = 6 WHERE page_key = 'office-hours';
UPDATE pages SET display_order = 7 WHERE page_key = 'teacher-schedule';
UPDATE pages SET display_order = 8 WHERE page_key = 'teachers';
UPDATE pages SET display_order = 9 WHERE page_key = 'admin-users';
UPDATE pages SET display_order = 10 WHERE page_key = 'admin-regions';
UPDATE pages SET display_order = 11 WHERE page_key = 'admin-roles';
UPDATE pages SET display_order = 12 WHERE page_key = 'admin-permissions';
