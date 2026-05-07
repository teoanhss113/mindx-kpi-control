# 🔔 Push Notifications - Complete Implementation

## 🎉 Tổng quan

Hệ thống Push Notifications đã được implement hoàn chỉnh cho MindX KPI Dashboard, cho phép gửi thông báo real-time đến trình duyệt của người dùng về các sự kiện quan trọng như:

- ✅ Yêu cầu thay đổi giáo viên
- ✅ Phê duyệt/Từ chối yêu cầu
- ✅ Giao phiếu đánh giá
- ✅ Cảnh báo chất lượng lớp học
- ✅ Nhắc nhở ca trải nghiệm

## 📦 Files Created

### ✅ 20 files mới đã được tạo:

#### Core Implementation (4 files)
- `public/sw.js` - Service Worker
- `src/lib/notifications.ts` - Browser utilities
- `src/lib/sendNotification.ts` - Server sender + 8 templates
- `src/hooks/useNotifications.ts` - React hook

#### UI Components (4 files)
- `src/components/NotificationPrompt.tsx` + `.module.css`
- `src/components/NotificationSettings.tsx` + `.module.css`

#### API Routes (3 files)
- `src/app/api/notifications/subscribe/route.ts`
- `src/app/api/notifications/unsubscribe/route.ts`
- `src/app/api/notifications/send/route.ts`

#### Admin Page (2 files)
- `src/app/admin/notifications/page.tsx` + `.module.css`

#### Scripts (2 files)
- `scripts/create-push-subscriptions-table.sql`
- `scripts/generate-vapid-keys.js`

#### Documentation (5 files)
- `docs/PUSH-NOTIFICATIONS.md` - Full documentation
- `docs/NOTIFICATION-FLOW.md` - Flow diagrams
- `docs/NOTIFICATION-INTEGRATION-GUIDE.md` - Integration guide
- `SETUP-NOTIFICATIONS.md` - Quick setup (5 phút)
- `NOTIFICATION-FILES.md` - File structure
- `NOTIFICATIONS-SUMMARY.md` - Summary
- `README-NOTIFICATIONS.md` - This file

## 🚀 Quick Start (5 phút)

### 1. Install Dependencies
```bash
npm install
```

### 2. Generate VAPID Keys
```bash
node scripts/generate-vapid-keys.js
```

Copy output vào `.env.local`:
```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BNxxx...
VAPID_PRIVATE_KEY=xxx...
```

### 3. Create Database Table
Mở Supabase Dashboard → SQL Editor, paste và execute:
```sql
-- Copy from scripts/create-push-subscriptions-table.sql
```

### 4. Add NotificationPrompt to Layout
```tsx
// src/app/layout.tsx
import { NotificationPrompt } from '@/components/NotificationPrompt';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <NotificationPrompt />
      </body>
    </html>
  );
}
```

### 5. Test
```bash
npm run dev
```
Visit: http://localhost:3000/admin/notifications

## 🎯 Usage Examples

### Client-Side: Subscribe to Notifications
```tsx
import { useNotifications } from '@/hooks/useNotifications';

function MyComponent() {
  const { subscribe, subscribed } = useNotifications();
  
  return (
    <button onClick={subscribe}>
      {subscribed ? 'Đã bật' : 'Bật thông báo'}
    </button>
  );
}
```

### Server-Side: Send Notifications
```typescript
import { sendNotification, NotificationTemplates } from '@/lib/sendNotification';

// Example 1: Teacher Change Approved
await sendNotification({
  userId: 'teacher@mindx.edu.vn',
  notification: NotificationTemplates.teacherChangeApproved('PRO-K12-01')
});

// Example 2: Ticket Assigned
await sendNotification({
  userId: 'user@mindx.edu.vn',
  notification: NotificationTemplates.ticketAssigned('T001', 'PRO-K12-01')
});

// Example 3: Class Quality Alert (Multiple users)
await sendNotification({
  userIds: ['manager1@mindx.edu.vn', 'manager2@mindx.edu.vn'],
  notification: NotificationTemplates.classQualityAlert(
    'PRO-K12-01',
    'Tỷ lệ hoàn thành dưới 70%'
  )
});
```

## 📚 Available Templates

```typescript
import { NotificationTemplates } from '@/lib/sendNotification';

// 1. Teacher Change Request (→ Managers)
NotificationTemplates.teacherChangeRequest(teacherName, className)

// 2. Teacher Change Approved (→ Teacher)
NotificationTemplates.teacherChangeApproved(className)

// 3. Teacher Change Rejected (→ Teacher)
NotificationTemplates.teacherChangeRejected(className, reason?)

// 4. Ticket Assigned (→ Assignee)
NotificationTemplates.ticketAssigned(ticketId, className)

// 5. Ticket Completed (→ Creator)
NotificationTemplates.ticketCompleted(className)

// 6. Class Quality Alert (→ Managers)
NotificationTemplates.classQualityAlert(className, issue)

// 7. Office Hours Reminder (→ Teacher)
NotificationTemplates.officeHoursReminder(time, location)

// 8. Generic (→ Anyone)
NotificationTemplates.generic(title, body, url?)
```

## 🔗 Integration Points

### Teacher Change Flow
```typescript
// When manager approves request
await sendNotification({
  userId: teacherId,
  notification: NotificationTemplates.teacherChangeApproved(className)
});
```

### Tickets Flow
```typescript
// When ticket is assigned
await sendNotification({
  userId: assigneeId,
  notification: NotificationTemplates.ticketAssigned(ticketId, className)
});
```

### Class Quality Alerts
```typescript
// When completion rate is low
if (completionRate < 70) {
  await sendNotification({
    userIds: managerEmails,
    notification: NotificationTemplates.classQualityAlert(
      className,
      `Tỷ lệ hoàn thành: ${completionRate}%`
    )
  });
}
```

## 🎨 UI Components

### NotificationPrompt
Auto-show banner sau 3 giây, dismissible 7 ngày.
```tsx
<NotificationPrompt />
```

### NotificationSettings
Full settings panel với toggle, test button.
```tsx
<NotificationSettings />
```

### useNotifications Hook
```tsx
const {
  supported,      // Browser có hỗ trợ không
  permission,     // 'default' | 'granted' | 'denied'
  subscribed,     // Đã subscribe chưa
  loading,        // Đang xử lý
  error,          // Error message
  subscribe,      // Subscribe function
  unsubscribe,    // Unsubscribe function
  testNotification // Test function
} = useNotifications();
```

## 🔐 Security

- ✅ **VAPID Authentication** - Public/Private key pair
- ✅ **HTTPS Required** - Production phải dùng HTTPS
- ✅ **Row Level Security** - Database có RLS policies
- ✅ **Auto Cleanup** - Invalid subscriptions tự động xoá

## 🧪 Testing

### Test Page
Visit: http://localhost:3000/admin/notifications
- Enable notifications
- Click template buttons
- Check notifications appear

### Test API
```bash
curl -X POST http://localhost:3000/api/notifications/send \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test@mindx.edu.vn",
    "payload": {
      "title": "Test",
      "body": "Test message"
    }
  }'
```

## 📖 Documentation

### Quick Reference
- **Setup Guide**: `SETUP-NOTIFICATIONS.md` (5 phút)
- **Summary**: `NOTIFICATIONS-SUMMARY.md`

### Detailed Docs
- **Full Documentation**: `docs/PUSH-NOTIFICATIONS.md`
- **Flow Diagrams**: `docs/NOTIFICATION-FLOW.md`
- **Integration Guide**: `docs/NOTIFICATION-INTEGRATION-GUIDE.md`
- **File Structure**: `NOTIFICATION-FILES.md`

## ✅ Implementation Checklist

### Setup (Bạn cần làm)
- [ ] Run `npm install`
- [ ] Generate VAPID keys
- [ ] Add keys to `.env.local`
- [ ] Create database table
- [ ] Add NotificationPrompt to layout
- [ ] Restart dev server
- [ ] Test on `/admin/notifications`

### Integration (Tùy chọn)
- [ ] Teacher Change: Request created → Notify managers
- [ ] Teacher Change: Approved → Notify teacher
- [ ] Teacher Change: Rejected → Notify teacher
- [ ] Tickets: Assigned → Notify assignee
- [ ] Tickets: Completed → Notify creator
- [ ] Class Quality: Low completion → Notify managers
- [ ] Office Hours: Reminder → Notify teacher

## 🎯 Features

### Client-Side
- ✅ Browser support detection
- ✅ Permission request handling
- ✅ Service worker registration
- ✅ Auto-show permission prompt
- ✅ Settings panel with toggle
- ✅ Test notification button
- ✅ Error handling

### Server-Side
- ✅ Send to single user
- ✅ Send to multiple users
- ✅ 8 pre-built templates
- ✅ Custom notifications
- ✅ Auto cleanup invalid subscriptions
- ✅ Delivery tracking

## 🔄 Architecture

```
Browser (Client)
    ↓
Service Worker (/sw.js)
    ↓
Push Manager (Browser API)
    ↓
Server (Next.js API)
    ↓
Database (Supabase)
    ↓
web-push (Node.js)
    ↓
Push Service (Browser vendor)
    ↓
User's Device
```

## 📊 Database Schema

```sql
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

## 🚨 Troubleshooting

### Notifications không hiển thị
1. Check browser support: Chrome, Firefox, Edge (Safari limited)
2. Check permission: Must be "granted"
3. Check service worker: DevTools → Application → Service Workers
4. Check HTTPS: Required in production

### Service Worker không register
1. Check file exists: `public/sw.js`
2. Check HTTPS or localhost
3. Clear cache và reload
4. Check console errors

### VAPID key errors
1. Check keys trong `.env.local`
2. Restart dev server
3. Keys phải là base64url format

## 🎉 Summary

✅ **20 files** created  
✅ **8 templates** ready to use  
✅ **3 API routes** implemented  
✅ **2 UI components** built  
✅ **Full documentation** written  
✅ **Admin page** for testing  
✅ **Ready to integrate** into features  

## 🚀 Next Steps

1. **Setup** (5 phút): Follow `SETUP-NOTIFICATIONS.md`
2. **Test**: Visit `/admin/notifications` và test
3. **Integrate**: Follow `docs/NOTIFICATION-INTEGRATION-GUIDE.md`
4. **Deploy**: Add VAPID keys to production environment

## 💡 Tips

- Start with one feature (e.g., Teacher Change)
- Test thoroughly before moving to next
- Monitor notification delivery in production
- Gather user feedback and iterate
- Consider notification preferences in future

## 📞 Support

- Check documentation in `docs/` folder
- Review examples in integration guide
- Test on admin page first
- Check browser console for errors

---

**Happy coding! 🎉**

Tất cả code đã sẵn sàng. Chỉ cần follow setup guide và bắt đầu gửi notifications!
