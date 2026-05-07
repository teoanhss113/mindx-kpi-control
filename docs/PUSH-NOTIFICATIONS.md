# Push Notifications - MindX KPI Dashboard

Hệ thống Push Notifications cho phép gửi thông báo real-time đến trình duyệt của người dùng, ngay cả khi họ không đang mở trang web.

## 📋 Tính năng

- ✅ **Browser Push Notifications** - Thông báo đẩy qua trình duyệt
- ✅ **Service Worker** - Xử lý notifications ở background
- ✅ **Permission Management** - Quản lý quyền thông báo
- ✅ **Subscription Storage** - Lưu subscriptions vào database
- ✅ **Notification Templates** - Templates cho các loại thông báo
- ✅ **Auto Cleanup** - Tự động xoá subscriptions không hợp lệ

## 🚀 Setup

### 1. Generate VAPID Keys

VAPID keys được dùng để xác thực push notifications.

```bash
node scripts/generate-vapid-keys.js
```

Copy keys vào `.env.local`:

```env
# Push Notifications VAPID Keys
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_public_key_here
VAPID_PRIVATE_KEY=your_private_key_here
```

### 2. Create Database Table

Chạy SQL migration để tạo bảng `push_subscriptions`:

```bash
psql $DATABASE_URL -f scripts/create-push-subscriptions-table.sql
```

Hoặc chạy trực tiếp trong Supabase SQL Editor.

### 3. Install Dependencies

```bash
npm install
```

Package `web-push` đã được thêm vào `package.json`.

## 📱 Usage

### Client-Side: Request Permission & Subscribe

#### Option 1: Using NotificationPrompt Component

Thêm vào layout để tự động hiển thị prompt:

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

#### Option 2: Using NotificationSettings Component

Thêm vào settings page:

```tsx
// src/app/settings/page.tsx
import { NotificationSettings } from '@/components/NotificationSettings';

export default function SettingsPage() {
  return (
    <div>
      <h1>Cài đặt</h1>
      <NotificationSettings />
    </div>
  );
}
```

#### Option 3: Using useNotifications Hook

Tự custom UI:

```tsx
'use client';

import { useNotifications } from '@/hooks/useNotifications';

export function MyComponent() {
  const {
    supported,
    permission,
    subscribed,
    loading,
    subscribe,
    unsubscribe,
    testNotification
  } = useNotifications();

  if (!supported) {
    return <p>Browser không hỗ trợ notifications</p>;
  }

  return (
    <div>
      <p>Permission: {permission}</p>
      <p>Subscribed: {subscribed ? 'Yes' : 'No'}</p>
      
      {!subscribed && (
        <button onClick={subscribe} disabled={loading}>
          Bật thông báo
        </button>
      )}
      
      {subscribed && (
        <>
          <button onClick={unsubscribe} disabled={loading}>
            Tắt thông báo
          </button>
          <button onClick={testNotification}>
            Test notification
          </button>
        </>
      )}
    </div>
  );
}
```

### Server-Side: Send Notifications

#### Using sendNotification Utility

```typescript
import { sendNotification, NotificationTemplates } from '@/lib/sendNotification';

// Example 1: Teacher Change Request
await sendNotification({
  userId: 'manager@mindx.edu.vn',
  notification: NotificationTemplates.teacherChangeRequest(
    'Nguyễn Văn A',
    'PRO-K12-01'
  )
});

// Example 2: Teacher Change Approved
await sendNotification({
  userId: 'teacher@mindx.edu.vn',
  notification: NotificationTemplates.teacherChangeApproved('PRO-K12-01')
});

// Example 3: Send to multiple users
await sendNotification({
  userIds: ['user1@mindx.edu.vn', 'user2@mindx.edu.vn'],
  notification: NotificationTemplates.classQualityAlert(
    'PRO-K12-01',
    'Tỷ lệ hoàn thành thấp'
  )
});

// Example 4: Custom notification
await sendNotification({
  userId: 'user@mindx.edu.vn',
  notification: {
    title: 'Custom Title',
    body: 'Custom message',
    url: '/custom-page',
    requireInteraction: true,
    actions: [
      { action: 'view', title: 'Xem' },
      { action: 'dismiss', title: 'Bỏ qua' }
    ]
  }
});
```

#### Direct API Call

```typescript
// From API route or server component
const response = await fetch('/api/notifications/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 'user@mindx.edu.vn',
    payload: {
      title: 'Notification Title',
      body: 'Notification message',
      icon: '/logo/logo.svg',
      badge: '/logo/x_white.svg',
      tag: 'my-notification',
      data: {
        url: '/target-page'
      }
    }
  })
});

const result = await response.json();
console.log(`Sent: ${result.sent}, Failed: ${result.failed}`);
```

## 🎯 Notification Templates

### Available Templates

```typescript
import { NotificationTemplates } from '@/lib/sendNotification';

// 1. Teacher Change Request
NotificationTemplates.teacherChangeRequest(teacherName, className);

// 2. Teacher Change Approved
NotificationTemplates.teacherChangeApproved(className);

// 3. Teacher Change Rejected
NotificationTemplates.teacherChangeRejected(className, reason?);

// 4. Ticket Assigned
NotificationTemplates.ticketAssigned(ticketId, className);

// 5. Ticket Completed
NotificationTemplates.ticketCompleted(className);

// 6. Class Quality Alert
NotificationTemplates.classQualityAlert(className, issue);

// 7. Office Hours Reminder
NotificationTemplates.officeHoursReminder(time, location);

// 8. Generic
NotificationTemplates.generic(title, body, url?);
```

### Custom Template

```typescript
const customNotification = {
  title: 'Your Title',
  body: 'Your message',
  icon: '/custom-icon.png',
  badge: '/custom-badge.png',
  tag: 'custom-tag',
  url: '/target-page',
  requireInteraction: false,
  actions: [
    { action: 'accept', title: 'Chấp nhận' },
    { action: 'reject', title: 'Từ chối' }
  ],
  data: {
    customField: 'customValue'
  }
};
```

## 🔧 Integration Examples

### Example 1: Teacher Change Approval Flow

```typescript
// src/app/api/teacher-change/approve/route.ts
import { sendNotification, NotificationTemplates } from '@/lib/sendNotification';

export async function POST(request: Request) {
  const { requestId, teacherId, className } = await request.json();
  
  // Approve the request in database
  await approveTeacherChange(requestId);
  
  // Send notification to teacher
  await sendNotification({
    userId: teacherId,
    notification: NotificationTemplates.teacherChangeApproved(className)
  });
  
  return Response.json({ success: true });
}
```

### Example 2: Ticket Assignment

```typescript
// src/app/api/tickets/assign/route.ts
import { sendNotification, NotificationTemplates } from '@/lib/sendNotification';

export async function POST(request: Request) {
  const { ticketId, assigneeId, className } = await request.json();
  
  // Assign ticket in database
  await assignTicket(ticketId, assigneeId);
  
  // Send notification to assignee
  await sendNotification({
    userId: assigneeId,
    notification: NotificationTemplates.ticketAssigned(ticketId, className)
  });
  
  return Response.json({ success: true });
}
```

### Example 3: Class Quality Alert

```typescript
// src/lib/checkClassQuality.ts
import { sendNotification, NotificationTemplates } from '@/lib/sendNotification';

export async function checkClassQuality(classData: ClassData) {
  if (classData.completionRate < 70) {
    // Send alert to managers
    const managers = await getManagersForCentre(classData.centreId);
    
    await sendNotification({
      userIds: managers.map(m => m.email),
      notification: NotificationTemplates.classQualityAlert(
        classData.className,
        'Tỷ lệ hoàn thành dưới 70%'
      )
    });
  }
}
```

## 🔐 Security

### Row Level Security (RLS)

Database table có RLS policies:
- Users chỉ có thể xem/sửa/xoá subscriptions của chính họ
- Service role key được dùng cho server-side operations

### VAPID Keys

- **Public key**: Có thể public, dùng ở client-side
- **Private key**: PHẢI giữ bí mật, chỉ dùng ở server-side
- Không commit private key vào git

### User Authentication

Hiện tại dùng placeholder `x-user-id` header. Cần integrate với auth system:

```typescript
// src/app/api/notifications/subscribe/route.ts
// TODO: Replace with actual auth
const userId = request.headers.get('x-user-id') || 'anonymous';

// Should be:
const session = await getServerSession();
const userId = session.user.email;
```

## 🧪 Testing

### Test Local Notification

```typescript
import { showLocalNotification } from '@/lib/notifications';

await showLocalNotification('Test Title', {
  body: 'Test message',
  tag: 'test'
});
```

### Test Push Notification

```bash
# Using curl
curl -X POST http://localhost:3000/api/notifications/send \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test@mindx.edu.vn",
    "payload": {
      "title": "Test Notification",
      "body": "This is a test",
      "tag": "test"
    }
  }'
```

## 📊 Database Schema

```sql
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## 🐛 Troubleshooting

### Notifications không hiển thị

1. Check browser support: `isPushSupported()`
2. Check permission: `getNotificationPermission()`
3. Check service worker: DevTools → Application → Service Workers
4. Check subscription: DevTools → Application → Storage → IndexedDB

### Service Worker không register

1. HTTPS required (hoặc localhost)
2. Check `/sw.js` file exists
3. Check console errors
4. Clear cache và reload

### Subscription failed

1. Check VAPID keys trong `.env.local`
2. Check database connection
3. Check RLS policies
4. Check user authentication

## 📚 Resources

- [Web Push Protocol](https://datatracker.ietf.org/doc/html/rfc8030)
- [Push API MDN](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [web-push library](https://github.com/web-push-libs/web-push)

## 🎨 UI Components

### NotificationPrompt
- Auto-shows after 3 seconds
- Dismissible for 7 days
- Smooth animations

### NotificationSettings
- Full settings panel
- Toggle on/off
- Test notification button
- Permission status
- Error handling

## 🔄 Future Enhancements

- [ ] Notification preferences (per category)
- [ ] Notification history
- [ ] Batch notifications
- [ ] Scheduled notifications
- [ ] Rich notifications with images
- [ ] Action handlers in service worker
- [ ] Analytics tracking
- [ ] A/B testing for notification content
