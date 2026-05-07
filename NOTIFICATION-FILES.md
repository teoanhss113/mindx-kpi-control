# 📁 Push Notifications - File Structure

Tổng hợp tất cả files đã được tạo cho tính năng Push Notifications.

## 📂 Core Files

### Service Worker
```
public/
└── sw.js                                    # Service worker xử lý push events
```

### Libraries & Utilities
```
src/lib/
├── notifications.ts                         # Browser notification utilities
└── sendNotification.ts                      # Server-side notification sender + templates
```

### React Hooks
```
src/hooks/
└── useNotifications.ts                      # React hook for notification management
```

### UI Components
```
src/components/
├── NotificationPrompt.tsx                   # Auto-show permission prompt
├── NotificationPrompt.module.css
├── NotificationSettings.tsx                 # Settings panel
└── NotificationSettings.module.css
```

### API Routes
```
src/app/api/notifications/
├── subscribe/
│   └── route.ts                            # Subscribe to notifications
├── unsubscribe/
│   └── route.ts                            # Unsubscribe from notifications
└── send/
    └── route.ts                            # Send notifications to users
```

### Admin Pages
```
src/app/admin/notifications/
├── page.tsx                                # Admin notification management page
└── page.module.css
```

### Database Scripts
```
scripts/
├── create-push-subscriptions-table.sql     # Database schema
└── generate-vapid-keys.js                  # VAPID key generator
```

### Documentation
```
docs/
└── PUSH-NOTIFICATIONS.md                   # Full documentation

SETUP-NOTIFICATIONS.md                      # Quick setup guide
NOTIFICATION-FILES.md                       # This file
```

## 📦 Dependencies Added

```json
{
  "dependencies": {
    "web-push": "^3.6.7"
  },
  "devDependencies": {
    "@types/web-push": "^3.6.3"
  }
}
```

## 🔧 Configuration Files Modified

### package.json
- Added `web-push` dependency
- Added `@types/web-push` dev dependency

### .env.local (needs to be added)
```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_public_key
VAPID_PRIVATE_KEY=your_private_key
```

## 📊 Database Schema

### Table: push_subscriptions
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

## 🎯 Key Features

### 1. Client-Side
- ✅ Browser notification support detection
- ✅ Permission request handling
- ✅ Service worker registration
- ✅ Push subscription management
- ✅ Auto-show permission prompt
- ✅ Settings panel with toggle
- ✅ Test notification button

### 2. Server-Side
- ✅ Subscription storage in database
- ✅ Send notifications to users
- ✅ Notification templates
- ✅ Auto cleanup invalid subscriptions
- ✅ Batch sending support

### 3. Security
- ✅ VAPID authentication
- ✅ Row Level Security (RLS)
- ✅ HTTPS requirement
- ✅ Subscription validation

## 🚀 Usage Flow

### Setup Flow
1. Generate VAPID keys → `scripts/generate-vapid-keys.js`
2. Add keys to `.env.local`
3. Create database table → `scripts/create-push-subscriptions-table.sql`
4. Install dependencies → `npm install`
5. Add NotificationPrompt to layout

### User Flow
1. User visits site
2. NotificationPrompt shows after 3s
3. User clicks "Bật ngay"
4. Browser requests permission
5. If granted, subscribe to push
6. Subscription saved to database

### Notification Flow
1. Server event occurs (e.g., teacher change approved)
2. Call `sendNotification()` with userId and template
3. API fetches user's subscription from database
4. Send push notification via web-push
5. Service worker receives push event
6. Show notification to user
7. User clicks notification → navigate to URL

## 🔗 Integration Points

### Where to integrate notifications:

#### 1. Teacher Change Flow
```typescript
// src/app/api/teacher-change/approve/route.ts
import { sendNotification, NotificationTemplates } from '@/lib/sendNotification';

await sendNotification({
  userId: teacherId,
  notification: NotificationTemplates.teacherChangeApproved(className)
});
```

#### 2. Ticket Assignment
```typescript
// src/app/api/tickets/assign/route.ts
await sendNotification({
  userId: assigneeId,
  notification: NotificationTemplates.ticketAssigned(ticketId, className)
});
```

#### 3. Class Quality Alerts
```typescript
// src/lib/checkClassQuality.ts
await sendNotification({
  userIds: managerEmails,
  notification: NotificationTemplates.classQualityAlert(className, issue)
});
```

#### 4. Office Hours Reminders
```typescript
// src/lib/scheduleReminders.ts
await sendNotification({
  userId: teacherId,
  notification: NotificationTemplates.officeHoursReminder(time, location)
});
```

## 📝 Available Templates

```typescript
NotificationTemplates.teacherChangeRequest(teacherName, className)
NotificationTemplates.teacherChangeApproved(className)
NotificationTemplates.teacherChangeRejected(className, reason?)
NotificationTemplates.ticketAssigned(ticketId, className)
NotificationTemplates.ticketCompleted(className)
NotificationTemplates.classQualityAlert(className, issue)
NotificationTemplates.officeHoursReminder(time, location)
NotificationTemplates.generic(title, body, url?)
```

## 🧪 Testing

### Test Pages
- `/admin/notifications` - Admin management & testing page

### Test Commands
```bash
# Generate VAPID keys
node scripts/generate-vapid-keys.js

# Test notification via curl
curl -X POST http://localhost:3000/api/notifications/send \
  -H "Content-Type: application/json" \
  -d '{"userId":"test@mindx.edu.vn","payload":{"title":"Test","body":"Message"}}'
```

## 📚 Documentation

- **Quick Start**: `SETUP-NOTIFICATIONS.md`
- **Full Docs**: `docs/PUSH-NOTIFICATIONS.md`
- **This File**: `NOTIFICATION-FILES.md`

## ✅ Implementation Checklist

- [x] Service worker created
- [x] Notification utilities implemented
- [x] React hook created
- [x] UI components built
- [x] API routes implemented
- [x] Database schema defined
- [x] VAPID key generator created
- [x] Notification templates defined
- [x] Admin management page created
- [x] Documentation written
- [x] Setup guide created
- [ ] VAPID keys generated (user action)
- [ ] Database table created (user action)
- [ ] NotificationPrompt added to layout (user action)
- [ ] Integrated into features (user action)

## 🎉 Summary

Tính năng Push Notifications đã hoàn thiện với:
- ✅ 15 files mới
- ✅ 2 dependencies mới
- ✅ 1 database table
- ✅ 8 notification templates
- ✅ Full documentation
- ✅ Admin management UI
- ✅ Ready to integrate

Next steps: Follow `SETUP-NOTIFICATIONS.md` để setup và integrate vào các tính năng hiện có.
