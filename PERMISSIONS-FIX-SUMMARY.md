# 🔐 Permissions Fix - Summary

## 🚨 Vấn đề

Tài khoản `tuannh@mindx.com.vn` có vai trò "Leader" và đã được phân quyền các trang Admin, nhưng **không thể truy cập `/admin`** - luôn bị redirect về `/`.

## 🔍 Nguyên nhân

Khi truy cập `/admin`, hệ thống redirect đến `/admin/dashboard`.

Trang `/admin/dashboard` yêu cầu quyền xem page có **key = `dashboard`**.

**Vấn đề:** Vai trò "Leader" có quyền xem các trang admin khác (`admin-users`, `admin-roles`, etc.) nhưng **THIẾU quyền xem trang `dashboard`**.

## ✅ Giải pháp

### Quick Fix (5 phút)

**Bước 1:** Chạy SQL script

Mở Supabase SQL Editor và chạy file: `scripts/debug-permissions.sql`

Script này sẽ:
- ✅ Tạo tất cả pages cần thiết (bao gồm `dashboard`)
- ✅ Grant permissions cho vai trò "Leader"
- ✅ Verify kết quả

**Bước 2:** Logout và Login lại

**Bước 3:** Truy cập `/admin` - Should work! 🎉

### Manual Fix

Nếu muốn fix thủ công:

```sql
-- 1. Tạo page 'dashboard'
INSERT INTO pages (key, page_name, description, created_at)
VALUES ('dashboard', 'Tổng quan', 'Trang tổng quan dashboard', NOW())
ON CONFLICT (key) DO NOTHING;

-- 2. Grant permission cho role của tuannh@mindx.com.vn
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

## 🔍 Debug Tools

### 1. Debug Page

Visit: `http://localhost:3000/admin/debug-permissions`

Trang này hiển thị:
- ✅ Session info
- ✅ Profile info
- ✅ **Tất cả permissions** (visual grid)
- ✅ Raw data

### 2. SQL Queries

File: `scripts/debug-permissions.sql`

Chứa tất cả queries để:
- Check user info
- Check permissions
- Create missing pages
- Grant permissions
- Verify results

## 📋 Required Page Keys

Tất cả page keys cần có trong database:

```
✅ dashboard          → /admin/dashboard
✅ completion         → /admin/completion-rate
✅ teacher-change     → /admin/teacher-change
✅ tickets            → /admin/tickets
✅ class-quality      → /admin/class-quality
✅ office-hours       → /admin/office-hours
✅ teacher-schedule   → /admin/teacher-schedule
✅ teachers           → /admin/teachers
✅ admin-users        → /admin/users
✅ admin-regions      → /admin/regions
✅ admin-roles        → /admin/roles
```

## 🔄 Routing Flow

```
User visits /admin
    ↓
src/app/admin/page.tsx redirects to /admin/dashboard
    ↓
src/app/admin/dashboard/page.tsx
    ↓
<ProtectedPage pageKey="dashboard">
    ↓
Check if user has permission for key="dashboard"
    ↓
✅ Has permission → Show dashboard
❌ No permission → Show "Không có quyền truy cập"
```

## 📦 Files Created

1. **Debug Page** (2 files)
   - `src/app/admin/debug-permissions/page.tsx`
   - `src/app/admin/debug-permissions/page.module.css`

2. **SQL Script** (1 file)
   - `scripts/debug-permissions.sql`

3. **Documentation** (2 files)
   - `docs/PERMISSIONS-TROUBLESHOOTING.md`
   - `PERMISSIONS-FIX-SUMMARY.md` (this file)

## 🧪 Testing

### Test 1: Check Debug Page
```
1. Login as tuannh@mindx.com.vn
2. Visit /admin/debug-permissions
3. Look for "dashboard" in permissions grid
4. Should show ✅ (green) after fix
```

### Test 2: Check Database
```sql
SELECT 
  pg.key,
  pg.page_name,
  rp.can_view,
  rp.can_edit
FROM role_permissions rp
JOIN pages pg ON rp.page_id = pg.id
WHERE rp.role_id = (
  SELECT role_id FROM profiles WHERE email = 'tuannh@mindx.com.vn'
)
AND pg.key = 'dashboard';
```

**Expected result:**
```
key       | page_name  | can_view | can_edit
----------|------------|----------|----------
dashboard | Tổng quan  | true     | false
```

### Test 3: Access /admin
```
1. Login as tuannh@mindx.com.vn
2. Visit /admin
3. Should redirect to /admin/dashboard
4. Should see dashboard content (KPI cards, charts, etc.)
5. Should NOT see "Không có quyền truy cập"
```

## 🎯 Summary

**Problem:** Missing permission for `dashboard` page  
**Solution:** Run `scripts/debug-permissions.sql`  
**Result:** Can access `/admin` successfully  

**Key Insight:** `/admin` redirects to `/admin/dashboard`, which requires `dashboard` permission, not admin permissions.

## 📚 Documentation

- **Full Guide**: `docs/PERMISSIONS-TROUBLESHOOTING.md`
- **SQL Script**: `scripts/debug-permissions.sql`
- **Debug Page**: `/admin/debug-permissions`

---

**Next Steps:**
1. Run SQL script
2. Logout & login
3. Visit `/admin`
4. Should work! 🎉
