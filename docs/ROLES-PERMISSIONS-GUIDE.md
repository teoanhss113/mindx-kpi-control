# 🔐 Roles & Permissions - User Guide

## 📋 Tổng quan

Hệ thống phân quyền dựa trên **Roles** (Vai trò). Mỗi role có thể được gán quyền truy cập vào các **Pages** (Trang) khác nhau với 2 mức độ:
- **View** (Xem): Có thể xem nội dung trang
- **Edit** (Sửa): Có thể chỉnh sửa dữ liệu (bao gồm cả quyền xem)

## 🎯 Quản lý Roles từ UI

### Truy cập trang Roles

Visit: `/admin/roles`

**Yêu cầu:** Phải có quyền xem page `admin-roles`

### 1. Đồng bộ Pages (Bước đầu tiên - QUAN TRỌNG!)

Trước khi tạo role, cần đảm bảo tất cả pages đã có trong database.

**Cách làm:**
1. Vào `/admin/roles`
2. Tìm box "Đồng bộ Pages" ở đầu trang
3. Click button **"Đồng bộ Pages"**
4. Đợi thông báo "Đồng bộ thành công"

**Kết quả:** Tất cả 11 pages sẽ được tạo trong database:
- ✅ dashboard (Tổng quan)
- ✅ completion (Tỷ lệ Hoàn thành)
- ✅ teacher-change (Thay đổi Giáo viên)
- ✅ tickets (Phiếu Đánh giá)
- ✅ class-quality (Chất lượng Lớp học)
- ✅ office-hours (Ca Trải nghiệm)
- ✅ teacher-schedule (Điều phối Giáo viên)
- ✅ teachers (Quản lý Giáo viên)
- ✅ admin-users (Quản lý Tài khoản)
- ✅ admin-regions (Quản lý Khu vực)
- ✅ admin-roles (Quản lý Vai trò)

### 2. Tạo Role mới

**Bước 1:** Click button **"Tạo vai trò"**

**Bước 2:** Điền thông tin
- **Tên vai trò*** (bắt buộc): Ví dụ "Leader", "Manager", "Teacher"
- **Mô tả** (tùy chọn): Mô tả vai trò
- **Vai trò hoạt động**: Check để kích hoạt

**Bước 3:** Chọn quyền truy cập

Bảng permissions hiển thị tất cả pages với 2 cột:
- **Xem**: Cho phép xem trang
- **Sửa**: Cho phép chỉnh sửa (tự động bật quyền Xem)

**Tips:**
- Click **"Chọn tất cả"** để chọn tất cả pages
- Click **"Bỏ chọn tất cả"** để bỏ chọn
- Nếu bỏ check "Xem", "Sửa" sẽ tự động bị bỏ check
- Nếu check "Sửa", "Xem" sẽ tự động được check

**Bước 4:** Click **"Tạo vai trò"**

### 3. Chỉnh sửa Role

**Bước 1:** Click icon ✏️ (Edit) ở hàng role cần sửa

**Bước 2:** Cập nhật thông tin và permissions

**Bước 3:** Click **"Cập nhật"**

### 4. Xóa Role

**Bước 1:** Click icon 🗑️ (Trash) ở hàng role cần xóa

**Bước 2:** Xác nhận xóa trong dialog

**Lưu ý:** Không thể xóa system roles (vai trò hệ thống)

## 🎯 Gán Role cho User

### Từ trang Users

Visit: `/admin/users`

**Bước 1:** Click Edit user

**Bước 2:** Chọn Role từ dropdown

**Bước 3:** Click "Cập nhật"

**Kết quả:** User sẽ có tất cả permissions của role đó

## 📋 Required Pages

Tất cả page keys cần có trong database:

| Key | Page Name | Route | Mô tả |
|-----|-----------|-------|-------|
| `dashboard` | Tổng quan | `/admin/dashboard` | **QUAN TRỌNG** - Cần để truy cập /admin |
| `completion` | Tỷ lệ Hoàn thành | `/admin/completion-rate` | Trang tỷ lệ hoàn thành |
| `teacher-change` | Thay đổi Giáo viên | `/admin/teacher-change` | Trang thay đổi GV |
| `tickets` | Phiếu Đánh giá | `/admin/tickets` | Trang phiếu đánh giá |
| `class-quality` | Chất lượng Lớp học | `/admin/class-quality` | Trang chất lượng |
| `office-hours` | Ca Trải nghiệm | `/admin/office-hours` | Trang ca trải nghiệm |
| `teacher-schedule` | Điều phối Giáo viên | `/admin/teacher-schedule` | Trang điều phối |
| `teachers` | Quản lý Giáo viên | `/admin/teachers` | Trang quản lý GV |
| `admin-users` | Quản lý Tài khoản | `/admin/users` | Trang quản lý users |
| `admin-regions` | Quản lý Khu vực | `/admin/regions` | Trang quản lý khu vực |
| `admin-roles` | Quản lý Vai trò | `/admin/roles` | Trang quản lý roles |

## 🔄 Workflow: Tạo User mới với Permissions

### Scenario: Tạo tài khoản Leader mới

**Bước 1: Đồng bộ Pages** (Chỉ cần làm 1 lần)
1. Vào `/admin/roles`
2. Click "Đồng bộ Pages"
3. Đợi thành công

**Bước 2: Tạo Role "Leader"** (Nếu chưa có)
1. Vào `/admin/roles`
2. Click "Tạo vai trò"
3. Nhập:
   - Tên: "Leader"
   - Mô tả: "Vai trò lãnh đạo, có quyền truy cập đầy đủ"
4. Click "Chọn tất cả" để chọn tất cả pages
5. Check "Sửa" cho các pages cần quyền edit
6. Click "Tạo vai trò"

**Bước 3: Tạo User**
1. Vào `/admin/users`
2. Click "Tạo tài khoản"
3. Nhập thông tin user
4. Chọn Role: "Leader"
5. Click "Tạo tài khoản"

**Bước 4: Test**
1. Logout
2. Login với tài khoản mới
3. Truy cập `/admin` → Should work!
4. Check các trang khác

## 🚨 Troubleshooting

### Vấn đề 1: Không thể truy cập /admin

**Nguyên nhân:** Thiếu quyền xem page `dashboard`

**Giải pháp:**
1. Vào `/admin/roles`
2. Click "Đồng bộ Pages" để tạo page `dashboard`
3. Edit role của user
4. Check "Xem" cho page "Tổng quan" (dashboard)
5. Click "Cập nhật"
6. User logout và login lại

### Vấn đề 2: Không thấy page trong danh sách khi tạo role

**Nguyên nhân:** Pages chưa được tạo trong database

**Giải pháp:**
1. Vào `/admin/roles`
2. Click "Đồng bộ Pages"
3. Đợi thông báo thành công
4. Refresh trang
5. Tạo/Edit role lại

### Vấn đề 3: User có role nhưng vẫn không có quyền

**Nguyên nhân:** 
- Role chưa được gán permissions
- User chưa logout/login lại

**Giải pháp:**
1. Check role có permissions chưa: `/admin/roles`
2. Edit role và thêm permissions
3. User logout và login lại
4. Clear browser cache nếu cần

### Vấn đề 4: Tạo role thành công nhưng không thấy pages

**Nguyên nhân:** Chưa chọn pages khi tạo role

**Giải pháp:**
1. Edit role
2. Check "Xem" cho các pages cần thiết
3. Click "Cập nhật"

## 💡 Best Practices

### 1. Luôn đồng bộ Pages trước
Trước khi tạo role đầu tiên, luôn click "Đồng bộ Pages" để đảm bảo tất cả pages có trong database.

### 2. Tạo roles theo chức năng
- **Admin**: Full access (tất cả pages, tất cả quyền)
- **Manager**: Xem tất cả, sửa một số
- **Leader**: Xem tất cả, sửa dashboard + reports
- **Teacher**: Chỉ xem một số pages cụ thể

### 3. Đặt tên role rõ ràng
- ✅ "Regional Manager"
- ✅ "Centre Leader"
- ✅ "Teacher"
- ❌ "Role 1"
- ❌ "Test"

### 4. Thêm mô tả chi tiết
Giúp admin khác hiểu rõ vai trò này dùng cho ai.

### 5. Test sau khi tạo
Tạo test user với role mới và test truy cập các trang.

## 📊 Permission Matrix Example

### Admin Role
| Page | View | Edit |
|------|------|------|
| Tất cả pages | ✅ | ✅ |

### Manager Role
| Page | View | Edit |
|------|------|------|
| Dashboard | ✅ | ❌ |
| Completion | ✅ | ✅ |
| Teacher Change | ✅ | ✅ |
| Tickets | ✅ | ✅ |
| Class Quality | ✅ | ✅ |
| Office Hours | ✅ | ✅ |
| Teacher Schedule | ✅ | ✅ |
| Teachers | ✅ | ❌ |
| Admin pages | ❌ | ❌ |

### Teacher Role
| Page | View | Edit |
|------|------|------|
| Dashboard | ✅ | ❌ |
| Completion | ✅ | ❌ |
| Teacher Change | ✅ | ❌ |
| Tickets | ✅ | ❌ |
| Others | ❌ | ❌ |

## 🔗 Related

- **Troubleshooting**: `docs/PERMISSIONS-TROUBLESHOOTING.md`
- **Debug Page**: `/admin/debug-permissions`
- **SQL Scripts**: `scripts/ensure-all-pages-exist.sql`

## 📞 Support

Nếu vẫn gặp vấn đề:
1. Visit `/admin/debug-permissions` để xem permissions hiện tại
2. Check database: `SELECT * FROM pages`
3. Check role permissions: `SELECT * FROM role_permissions WHERE role_id = 'YOUR_ROLE_ID'`

---

**TL;DR:**
1. Vào `/admin/roles`
2. Click "Đồng bộ Pages" (1 lần duy nhất)
3. Tạo role và chọn permissions
4. Gán role cho user
5. Done! 🎉
