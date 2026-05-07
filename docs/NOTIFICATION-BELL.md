# 🔔 Notification Bell - User Guide

## 📍 Vị trí

Nút thông báo (Notification Bell) nằm ở **góc phải header** trên mọi trang trong dashboard.

```
┌─────────────────────────────────────────────────────┐
│  ☰  Tổng quan                            🔔 (3)  👤 │  ← Header
└─────────────────────────────────────────────────────┘
                                            ↑
                                    Notification Bell
```

## 🎯 Tính năng

### 1. Badge số thông báo chưa đọc
- Hiển thị số lượng thông báo chưa đọc
- Màu đỏ nổi bật (#ef4444)
- Tự động cập nhật real-time

### 2. Dropdown danh sách thông báo
- Click vào icon chuông để mở
- Hiển thị tối đa 50 thông báo gần nhất
- Scroll để xem thêm
- Click outside để đóng

### 3. Thông báo chưa đọc
- Background màu xanh nhạt
- Có dấu chấm xanh bên phải
- Tự động đánh dấu đã đọc khi click

### 4. Thời gian hiển thị
- "Vừa xong" - < 1 phút
- "5 phút trước" - < 1 giờ
- "2 giờ trước" - < 24 giờ
- "3 ngày trước" - ≥ 24 giờ

### 5. Actions
- **Click notification** → Navigate to URL + Mark as read
- **"Đánh dấu đã đọc"** → Mark all as read
- **"Xem tất cả"** → Navigate to `/admin/notifications`

## 🔄 Auto-refresh

Notifications tự động refresh mỗi **30 giây** để cập nhật thông báo mới.

## 📱 Responsive

### Desktop
- Dropdown width: 380px
- Position: Right-aligned

### Mobile
- Dropdown: Full width (với padding)
- Position: Fixed top

## 🎨 UI States

### Default State
```
🔔  (No badge)
```

### With Unread Notifications
```
🔔 (3)  ← Red badge
```

### Dropdown Open
```
┌─────────────────────────────────────┐
│ Thông báo          Đánh dấu đã đọc  │
├─────────────────────────────────────┤
│ • Yêu cầu thay đổi giáo viên        │
│   Nguyễn Văn A yêu cầu...           │
│   5 phút trước                   •  │
├─────────────────────────────────────┤
│   Phiếu đánh giá mới                │
│   Bạn được giao phiếu...            │
│   30 phút trước                     │
├─────────────────────────────────────┤
│              Xem tất cả              │
└─────────────────────────────────────┘
```

### Empty State
```
┌─────────────────────────────────────┐
│ Thông báo                           │
├─────────────────────────────────────┤
│                                     │
│           🔔                        │
│     Không có thông báo              │
│                                     │
└─────────────────────────────────────┘
```

## 🔧 Technical Details

### Component Location
```
src/components/NotificationBell.tsx
src/components/NotificationBell.module.css
```

### Integration
```tsx
// src/components/PageLayout.tsx
import { NotificationBell } from '@/components/NotificationBell';

<div className={styles.headerRight}>
  <NotificationBell />
</div>
```

### API Endpoints

#### GET /api/notifications/list
Fetch user's notifications
```typescript
Response: {
  success: true,
  notifications: [
    {
      id: string,
      title: string,
      body: string,
      url: string,
      read: boolean,
      created_at: string
    }
  ]
}
```

#### POST /api/notifications/list
Mark notifications as read
```typescript
Request: {
  notificationIds: string[]
}

Response: {
  success: true
}
```

### Database Schema
```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  url TEXT,
  type TEXT,
  read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB
);
```

## 🎯 Notification Types

### 1. Teacher Change Request
```typescript
{
  title: "Yêu cầu thay đổi giáo viên",
  body: "Nguyễn Văn A yêu cầu thay đổi lớp PRO-K12-01",
  url: "/admin/teacher-change",
  type: "teacher-change-request"
}
```

### 2. Teacher Change Approved
```typescript
{
  title: "Yêu cầu đã được phê duyệt",
  body: "Yêu cầu thay đổi lớp PRO-K12-01 đã được phê duyệt",
  url: "/teacher-change",
  type: "teacher-change-approved"
}
```

### 3. Ticket Assigned
```typescript
{
  title: "Phiếu đánh giá mới",
  body: "Bạn được giao phiếu đánh giá cho lớp PRO-K12-01",
  url: "/tickets?id=T001",
  type: "ticket-assigned"
}
```

### 4. Class Quality Alert
```typescript
{
  title: "Cảnh báo chất lượng lớp học",
  body: "Lớp PRO-K12-01: Tỷ lệ hoàn thành dưới 70%",
  url: "/admin/class-quality",
  type: "class-quality-alert"
}
```

## 🔐 Permissions

- **All users** can see their own notifications
- **RLS policies** ensure users only see their notifications
- **Service role** can create notifications for any user

## 📊 Notification Flow

```
1. Event occurs (e.g., teacher change approved)
   ↓
2. Server calls sendNotification()
   ↓
3. Notification saved to database
   ↓
4. Push notification sent to browser
   ↓
5. User sees:
   - Browser notification (if subscribed)
   - Bell badge updates
   - Notification in dropdown
   ↓
6. User clicks notification
   ↓
7. Mark as read in database
   ↓
8. Navigate to URL
```

## 🧪 Testing

### Test Notification Bell
1. Visit any page in dashboard
2. Look at top-right corner
3. Should see bell icon

### Test with Mock Data
1. Open browser DevTools
2. Check Network tab
3. Should see `/api/notifications/list` request
4. If API fails, shows mock data

### Test Mark as Read
1. Click a notification
2. Should navigate to URL
3. Notification should be marked as read
4. Badge count should decrease

### Test Mark All Read
1. Click "Đánh dấu đã đọc"
2. All notifications marked as read
3. Badge disappears

## 🎨 Customization

### Change Badge Color
```css
/* src/components/NotificationBell.module.css */
.badge {
  background: #ef4444; /* Change this */
}
```

### Change Dropdown Width
```css
.dropdown {
  width: 380px; /* Change this */
}
```

### Change Refresh Interval
```typescript
// src/components/NotificationBell.tsx
const interval = setInterval(fetchNotifications, 30000); // Change 30000ms
```

## 🚨 Troubleshooting

### Bell icon không hiển thị
- Check PageLayout import
- Check NotificationBell component exists
- Check CSS module loaded

### Badge không cập nhật
- Check API endpoint working
- Check database connection
- Check RLS policies

### Notifications không load
- Check `/api/notifications/list` endpoint
- Check database table exists
- Check user authentication

### Click notification không navigate
- Check URL field in notification
- Check browser console for errors

## 📚 Related Documentation

- **Push Notifications**: `docs/PUSH-NOTIFICATIONS.md`
- **Integration Guide**: `docs/NOTIFICATION-INTEGRATION-GUIDE.md`
- **Setup Guide**: `SETUP-NOTIFICATIONS.md`

## 🎉 Summary

Notification Bell provides:
- ✅ Real-time notification updates
- ✅ Unread badge counter
- ✅ Dropdown notification list
- ✅ Mark as read functionality
- ✅ Auto-refresh every 30s
- ✅ Mobile responsive
- ✅ Integrated with push notifications

**Location**: Top-right corner of every page in dashboard
