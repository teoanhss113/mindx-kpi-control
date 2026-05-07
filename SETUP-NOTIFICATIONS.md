# 🔔 Setup Push Notifications - Quick Start

Hướng dẫn nhanh để setup Push Notifications cho MindX KPI Dashboard.

## ⚡ Quick Setup (5 phút)

### 1. Install Dependencies

```bash
npm install
```

### 2. Generate VAPID Keys

```bash
node scripts/generate-vapid-keys.js
```

Copy output và thêm vào `.env.local`:

```env
# Push Notifications VAPID Keys
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BNxxx...
VAPID_PRIVATE_KEY=xxx...
```

### 3. Create Database Table

**Option A: Using Supabase Dashboard**
1. Mở Supabase Dashboard → SQL Editor
2. Copy nội dung file `scripts/create-push-subscriptions-table.sql`
3. Paste và Execute

**Option B: Using psql**
```bash
psql $DATABASE_URL -f scripts/create-push-subscriptions-table.sql
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

1. Mở http://localhost:3000
2. Sau 3 giây sẽ thấy notification prompt
3. Click "Bật ngay" để subscribe
4. Vào http://localhost:3000/admin/notifications để test gửi notification

## 📝 Integration Examples

### Example 1: Send notification khi approve teacher change

```typescript
// src/app/api/teacher-change/approve/route.ts
import { sendNotification, NotificationTemplates } from '@/lib/sendNotification';

export async function POST(request: Request) {
  const { teacherId, className } = await request.json();
  
  // Your approval logic here
  // ...
  
  // Send notification
  await sendNotification({
    userId: teacherId,
    notification: NotificationTemplates.teacherChangeApproved(className)
  });
  
  return Response.json({ success: true });
}
```

### Example 2: Send notification khi assign ticket

```typescript
// src/app/api/tickets/assign/route.ts
import { sendNotification, NotificationTemplates } from '@/lib/sendNotification';

export async function POST(request: Request) {
  const { ticketId, assigneeId, className } = await request.json();
  
  // Your assignment logic here
  // ...
  
  // Send notification
  await sendNotification({
    userId: assigneeId,
    notification: NotificationTemplates.ticketAssigned(ticketId, className)
  });
  
  return Response.json({ success: true });
}
```

### Example 3: Send alert khi class quality thấp

```typescript
// src/lib/checkClassQuality.ts
import { sendNotification, NotificationTemplates } from '@/lib/sendNotification';

export async function checkClassQuality(classData: ClassData) {
  if (classData.completionRate < 70) {
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

## 🎯 Available Notification Templates

```typescript
import { NotificationTemplates } from '@/lib/sendNotification';

// 1. Teacher Change Request (gửi cho manager)
NotificationTemplates.teacherChangeRequest(teacherName, className)

// 2. Teacher Change Approved (gửi cho teacher)
NotificationTemplates.teacherChangeApproved(className)

// 3. Teacher Change Rejected (gửi cho teacher)
NotificationTemplates.teacherChangeRejected(className, reason?)

// 4. Ticket Assigned (gửi cho assignee)
NotificationTemplates.ticketAssigned(ticketId, className)

// 5. Ticket Completed (gửi cho creator)
NotificationTemplates.ticketCompleted(className)

// 6. Class Quality Alert (gửi cho managers)
NotificationTemplates.classQualityAlert(className, issue)

// 7. Office Hours Reminder (gửi cho teachers)
NotificationTemplates.officeHoursReminder(time, location)

// 8. Generic (custom notification)
NotificationTemplates.generic(title, body, url?)
```

## 🔧 Configuration

### Environment Variables

```env
# Required
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_public_key
VAPID_PRIVATE_KEY=your_private_key

# Optional
NEXT_PUBLIC_APP_URL=https://your-domain.com  # For production
```

### Service Worker

File `public/sw.js` đã được tạo sẵn. Không cần chỉnh sửa.

### Database

Table `push_subscriptions` structure:
- `id` - UUID primary key
- `user_id` - User identifier (email, username, etc.)
- `endpoint` - Push service endpoint
- `p256dh` - Encryption key
- `auth` - Authentication secret
- `created_at` - Timestamp
- `updated_at` - Timestamp

## 🧪 Testing

### Test trong Development

1. Mở http://localhost:3000/admin/notifications
2. Click "Bật thông báo" nếu chưa bật
3. Click các template buttons để test
4. Check notification hiển thị

### Test với curl

```bash
curl -X POST http://localhost:3000/api/notifications/send \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test@mindx.edu.vn",
    "payload": {
      "title": "Test Notification",
      "body": "This is a test message",
      "tag": "test"
    }
  }'
```

## 🚨 Troubleshooting

### Notification không hiển thị

**Check 1: Browser support**
```javascript
console.log('Supported:', 'Notification' in window);
```

**Check 2: Permission**
```javascript
console.log('Permission:', Notification.permission);
```

**Check 3: Service Worker**
- DevTools → Application → Service Workers
- Should see `/sw.js` registered

**Check 4: Subscription**
```javascript
const reg = await navigator.serviceWorker.getRegistration();
const sub = await reg.pushManager.getSubscription();
console.log('Subscription:', sub);
```

### Service Worker không register

- ✅ Phải dùng HTTPS (hoặc localhost)
- ✅ Check file `/sw.js` tồn tại
- ✅ Clear cache và reload
- ✅ Check console errors

### VAPID key errors

- ✅ Check keys trong `.env.local`
- ✅ Restart dev server sau khi thêm keys
- ✅ Keys phải là base64url format (không có `=` padding)

## 📚 Full Documentation

Xem chi tiết tại: `docs/PUSH-NOTIFICATIONS.md`

## 🎨 UI Components

### NotificationPrompt
Auto-show banner sau 3 giây, dismissible 7 ngày.

```tsx
import { NotificationPrompt } from '@/components/NotificationPrompt';
<NotificationPrompt />
```

### NotificationSettings
Full settings panel với toggle, test button.

```tsx
import { NotificationSettings } from '@/components/NotificationSettings';
<NotificationSettings />
```

### useNotifications Hook
Custom hook để control notifications.

```tsx
import { useNotifications } from '@/hooks/useNotifications';

const {
  supported,
  permission,
  subscribed,
  subscribe,
  unsubscribe,
  testNotification
} = useNotifications();
```

## 🔐 Security Notes

- ✅ Private key KHÔNG được commit vào git
- ✅ RLS policies đã được setup cho table
- ✅ Subscriptions tự động cleanup khi invalid
- ⚠️ Cần integrate với auth system (hiện dùng placeholder)

## 🚀 Production Deployment

### 1. Set Environment Variables

Thêm vào production environment:
```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_public_key
VAPID_PRIVATE_KEY=your_private_key
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

### 2. Verify HTTPS

Push notifications chỉ hoạt động trên HTTPS (hoặc localhost).

### 3. Test on Production

1. Deploy code
2. Visit site và enable notifications
3. Test sending từ admin panel
4. Verify notifications arrive

## ✅ Checklist

- [ ] Dependencies installed (`npm install`)
- [ ] VAPID keys generated và added to `.env.local`
- [ ] Database table created
- [ ] NotificationPrompt added to layout
- [ ] Dev server restarted
- [ ] Tested notification prompt shows
- [ ] Tested subscribing
- [ ] Tested sending notification
- [ ] Integrated into features (teacher-change, tickets, etc.)

## 🎉 Done!

Push notifications đã sẵn sàng. Bây giờ có thể:
- Users subscribe qua UI
- Server gửi notifications qua `sendNotification()`
- Notifications hiển thị ngay cả khi browser ở background

Happy coding! 🚀
