# 🔐 Permissions Troubleshooting Guide

## 🚨 Vấn đề: Không thể truy cập /admin

### Triệu chứng
- Đăng nhập thành công
- Có vai trò và quyền trong database
- Nhưng khi truy cập `/admin` bị redirect về `/`
- Hoặc thấy màn hình "Không có quyền truy cập"

### Nguyên nhân

Khi truy cập `/admin`, hệ thống redirect đến `/admin/dashboard`. Trang này yêu cầu quyền xem page có **key = `dashboard`**.

**Vấn đề phổ biến:**
- ✅ Có quyền xem các trang admin khác (`admin-users`, `admin-roles`, etc.)
- ❌ **KHÔNG có quyền xem trang `dashboard`**

## 🔍 Cách Debug

### Bước 1: Truy cập Debug Page

Visit: `http://localhost:3000/admin/debug-permissions`

Trang này sẽ hiển thị:
- Session info (email, uid)
- Profile info (role, active status)
- **Tất cả permissions** của bạn
- Raw data để debug

### Bước 2: Kiểm tra Database

Chạy SQL queries trong `scripts/debug-permissions.sql`:

```sql
-- 1. Check user info
SELECT 
  p.email,
  p.display_name,
  p.is_active,
  p.role_id,
  r.role_name
FROM profiles p
LEFT JOIN roles r ON p.role_id = r.id
WHERE p.email = 'tuannh@mindx.com.vn';
```

**Kết quả mong đợi:**
- `is_active` = `true`
- `role_id` có giá trị (không null)
- `role_name` hiển thị tên vai trò

```sql
-- 2. Check permissions
SELECT 
  pg.key as page_key,
  pg.page_name,
  rp.can_view,
  rp.can_edit
FROM role_permissions rp
JOIN pages pg ON rp.page_id = pg.id
WHERE rp.role_id = (
  SELECT role_id FROM profiles WHERE email = 'tuannh@mindx.com.vn'
)
ORDER BY pg.key;
```

**Kiểm tra:** Phải có dòng với `page_key = 'dashboard'` và `can_view = true`

## ✅ Giải pháp

### Option 1: Sử dụng SQL Script (Khuyến nghị)

Chạy toàn bộ script `scripts/debug-permissions.sql` trong Supabase SQL Editor.

Script này sẽ:
1. Kiểm tra user và role
2. Tạo tất cả pages cần thiết
3. Grant permissions cho role của user
4. Verify kết quả

### Option 2: Manual Fix

#### Step 1: Tạo page 'dashboard' (nếu chưa có)

```sql
INSERT INTO pages (key, page_name, description, created_at)
VALUES ('dashboard', 'Tổng quan', 'Trang tổng quan dashboard', NOW())
ON CONFLICT (key) DO NOTHING;
```

#### Step 2: Grant permission cho role

```sql
-- Thay YOUR_ROLE_ID bằng role_id thực tế
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
```

#### Step 3: Verify

```sql
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
```

**Kết quả mong đợi:**
```
email                    | role_name | page_key  | page_name  | can_view | can_edit
-------------------------|-----------|-----------|------------|----------|----------
tuannh@mindx.com.vn      | Leader    | dashboard | Tổng quan  | true     | false
```

### Option 3: Grant All Permissions

Nếu muốn grant tất cả permissions cho role:

```sql
-- Tạo tất cả pages
INSERT INTO pages (key, page_name, description, created_at) VALUES
  ('dashboard', 'Tổng quan', 'Trang tổng quan dashboard', NOW()),
  ('completion', 'Tỷ lệ Hoàn thành', 'Trang tỷ lệ hoàn thành', NOW()),
  ('teacher-change', 'Thay đổi Giáo viên', 'Trang thay đổi giáo viên', NOW()),
  ('tickets', 'Phiếu Đánh giá', 'Trang phiếu đánh giá', NOW()),
  ('class-quality', 'Chất lượng Lớp học', 'Trang chất lượng lớp học', NOW()),
  ('office-hours', 'Ca Trải nghiệm', 'Trang ca trải nghiệm', NOW()),
  ('teacher-schedule', 'Điều phối Giáo viên', 'Trang điều phối giáo viên', NOW()),
  ('teachers', 'Quản lý Giáo viên', 'Trang quản lý giáo viên', NOW()),
  ('admin-users', 'Quản lý Tài khoản', 'Trang quản lý tài khoản', NOW()),
  ('admin-regions', 'Quản lý Khu vực', 'Trang quản lý khu vực', NOW()),
  ('admin-roles', 'Quản lý Vai trò', 'Trang quản lý vai trò', NOW())
ON CONFLICT (key) DO NOTHING;

-- Grant all permissions
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
```

## 📋 Required Page Keys

Tất cả page keys cần có trong database:

| Key | Page Name | Route |
|-----|-----------|-------|
| `dashboard` | Tổng quan | `/admin/dashboard` |
| `completion` | Tỷ lệ Hoàn thành | `/admin/completion-rate` |
| `teacher-change` | Thay đổi Giáo viên | `/admin/teacher-change` |
| `tickets` | Phiếu Đánh giá | `/admin/tickets` |
| `class-quality` | Chất lượng Lớp học | `/admin/class-quality` |
| `office-hours` | Ca Trải nghiệm | `/admin/office-hours` |
| `teacher-schedule` | Điều phối Giáo viên | `/admin/teacher-schedule` |
| `teachers` | Quản lý Giáo viên | `/admin/teachers` |
| `admin-users` | Quản lý Tài khoản | `/admin/users` |
| `admin-regions` | Quản lý Khu vực | `/admin/regions` |
| `admin-roles` | Quản lý Vai trò | `/admin/roles` |

## 🔄 Routing Flow

```
User visits /admin
    ↓
Redirect to /admin/dashboard
    ↓
ProtectedPage checks permission for key="dashboard"
    ↓
If has permission → Show page
If no permission → Show "Không có quyền truy cập"
```

## 🧪 Testing

### Test 1: Check Debug Page
```
1. Login as tuannh@mindx.com.vn
2. Visit /admin/debug-permissions
3. Check if "dashboard" shows ✅ or ❌
```

### Test 2: Check Database
```sql
-- Should return at least 1 row
SELECT * FROM role_permissions rp
JOIN pages pg ON rp.page_id = pg.id
WHERE rp.role_id = (SELECT role_id FROM profiles WHERE email = 'tuannh@mindx.com.vn')
AND pg.key = 'dashboard'
AND rp.can_view = true;
```

### Test 3: Try Access
```
1. Login as tuannh@mindx.com.vn
2. Visit /admin
3. Should redirect to /admin/dashboard
4. Should see dashboard content (not "Không có quyền truy cập")
```

## 🚨 Common Issues

### Issue 1: "Không có quyền truy cập"
**Cause:** Missing permission for `dashboard` page  
**Fix:** Run SQL script to grant permission

### Issue 2: Redirect to /
**Cause:** User not active or no role assigned  
**Fix:** Check `profiles` table, set `is_active = true` and assign `role_id`

### Issue 3: "Đang kiểm tra quyền truy cập..." forever
**Cause:** API error or network issue  
**Fix:** Check browser console for errors, verify API endpoint works

### Issue 4: Permission granted but still no access
**Cause:** Cache issue  
**Fix:** 
1. Logout and login again
2. Clear browser cache
3. Hard refresh (Cmd+Shift+R / Ctrl+Shift+R)

## 📞 Support

If still having issues:

1. Check browser console for errors
2. Check network tab for API responses
3. Run debug SQL queries
4. Visit `/admin/debug-permissions` page
5. Share screenshots of:
   - Debug page
   - SQL query results
   - Browser console errors

## 📚 Related Files

- **Debug Page**: `src/app/admin/debug-permissions/page.tsx`
- **SQL Script**: `scripts/debug-permissions.sql`
- **ProtectedPage**: `src/components/ProtectedPage.tsx`
- **PermissionsContext**: `src/lib/PermissionsContext.tsx`

---

**TL;DR:** Để truy cập `/admin`, bạn cần có quyền xem page với key = `dashboard`. Chạy `scripts/debug-permissions.sql` để fix.
