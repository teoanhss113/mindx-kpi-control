# 🔄 Push Notification Flow Diagram

## 📊 System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        MindX KPI Dashboard                       │
│                     Push Notification System                     │
└─────────────────────────────────────────────────────────────────┘

┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│   Browser    │         │   Server     │         │   Database   │
│  (Client)    │         │  (Next.js)   │         │  (Supabase)  │
└──────────────┘         └──────────────┘         └──────────────┘
```

## 🔐 Setup Flow

```
1. Generate VAPID Keys
   ┌─────────────────────────────────────┐
   │ node scripts/generate-vapid-keys.js │
   └─────────────────────────────────────┘
                    ↓
   ┌─────────────────────────────────────┐
   │  Public Key  → Client (.env.local)  │
   │  Private Key → Server (.env.local)  │
   └─────────────────────────────────────┘

2. Create Database Table
   ┌─────────────────────────────────────┐
   │  scripts/create-push-subscriptions  │
   │           -table.sql                │
   └─────────────────────────────────────┘
                    ↓
   ┌─────────────────────────────────────┐
   │  Table: push_subscriptions          │
   │  - id, user_id, endpoint            │
   │  - p256dh, auth, timestamps         │
   └─────────────────────────────────────┘
```

## 👤 User Subscription Flow

```
┌─────────┐                                    ┌─────────┐
│ Browser │                                    │ Server  │
└────┬────┘                                    └────┬────┘
     │                                              │
     │ 1. Load page                                 │
     ├──────────────────────────────────────────────>
     │                                              │
     │ 2. Show NotificationPrompt (after 3s)        │
     │    ┌──────────────────────────┐              │
     │    │ 🔔 Bật thông báo         │              │
     │    │ Nhận thông báo khi có... │              │
     │    │ [Bật ngay] [X]           │              │
     │    └──────────────────────────┘              │
     │                                              │
     │ 3. User clicks "Bật ngay"                    │
     │    → Request permission                      │
     │    ┌──────────────────────────┐              │
     │    │ Allow notifications?     │              │
     │    │ [Block] [Allow]          │              │
     │    └──────────────────────────┘              │
     │                                              │
     │ 4. Permission granted                        │
     │    → Register service worker                 │
     │    → Subscribe to push                       │
     │                                              │
     │ 5. POST /api/notifications/subscribe         │
     │    { endpoint, keys: { p256dh, auth } }      │
     ├──────────────────────────────────────────────>
     │                                              │
     │                                              │ 6. Save to DB
     │                                              ├────────────┐
     │                                              │            │
     │                                              │ INSERT INTO│
     │                                              │ push_subs  │
     │                                              │<───────────┘
     │                                              │
     │ 7. { success: true }                         │
     │<─────────────────────────────────────────────┤
     │                                              │
     │ ✅ Subscribed!                               │
     │                                              │
```

## 📤 Send Notification Flow

```
┌─────────┐         ┌─────────┐         ┌──────────┐         ┌─────────┐
│ Feature │         │ Server  │         │ Database │         │ Browser │
└────┬────┘         └────┬────┘         └────┬─────┘         └────┬────┘
     │                   │                   │                    │
     │ 1. Event occurs   │                   │                    │
     │ (e.g., approval)  │                   │                    │
     │                   │                   │                    │
     │ 2. sendNotification()                 │                    │
     ├──────────────────>│                   │                    │
     │                   │                   │                    │
     │                   │ 3. Fetch subscriptions                 │
     │                   ├──────────────────>│                    │
     │                   │                   │                    │
     │                   │ 4. Return subs    │                    │
     │                   │<──────────────────┤                    │
     │                   │                   │                    │
     │                   │ 5. Send push via web-push              │
     │                   │ (using VAPID keys)                     │
     │                   ├────────────────────────────────────────>
     │                   │                   │                    │
     │                   │                   │                    │ 6. Service Worker
     │                   │                   │                    │    receives push
     │                   │                   │                    │
     │                   │                   │                    │ 7. Show notification
     │                   │                   │                    │    ┌──────────────┐
     │                   │                   │                    │    │ 🔔 Title     │
     │                   │                   │                    │    │ Message...   │
     │                   │                   │                    │    └──────────────┘
     │                   │                   │                    │
     │ 8. { sent: 1 }    │                   │                    │
     │<──────────────────┤                   │                    │
     │                   │                   │                    │
```

## 🖱️ User Interaction Flow

```
User clicks notification
         ↓
Service Worker handles click
         ↓
Close notification
         ↓
Find existing tab or open new
         ↓
Navigate to target URL
         ↓
User sees relevant page
```

## 🔄 Complete Integration Example

### Teacher Change Approval Flow

```
┌──────────┐         ┌──────────┐         ┌──────────┐
│ Manager  │         │  Server  │         │ Teacher  │
└────┬─────┘         └────┬─────┘         └────┬─────┘
     │                    │                     │
     │ 1. Approve request │                     │
     ├───────────────────>│                     │
     │                    │                     │
     │                    │ 2. Update DB        │
     │                    │    (status=approved)│
     │                    │                     │
     │                    │ 3. sendNotification()
     │                    │    teacherChangeApproved
     │                    │                     │
     │                    │ 4. Push notification│
     │                    ├────────────────────>│
     │                    │                     │
     │                    │                     │ 5. 🔔 Notification
     │                    │                     │    "Yêu cầu đã được
     │                    │                     │     phê duyệt"
     │                    │                     │
     │                    │                     │ 6. Click notification
     │                    │                     │
     │                    │                     │ 7. Navigate to
     │                    │                     │    /teacher-change
     │                    │                     │
     │                    │                     │ 8. See approved status
     │                    │                     │
```

## 🎯 Notification Templates Flow

```
┌─────────────────────────────────────────────────────────────┐
│                   Notification Templates                     │
└─────────────────────────────────────────────────────────────┘

Teacher Change Request (Manager)
   ↓
   "Nguyễn Văn A yêu cầu thay đổi lớp PRO-K12-01"
   [Xem chi tiết] → /admin/teacher-change

Teacher Change Approved (Teacher)
   ↓
   "Yêu cầu thay đổi lớp PRO-K12-01 đã được phê duyệt"
   Click → /teacher-change

Ticket Assigned (Assignee)
   ↓
   "Bạn được giao phiếu đánh giá cho lớp PRO-K12-01"
   [Xem chi tiết] → /tickets?id=T001

Class Quality Alert (Managers)
   ↓
   "Lớp PRO-K12-01: Tỷ lệ hoàn thành dưới 70%"
   [Xem chi tiết] → /admin/class-quality
```

## 🔐 Security Flow

```
┌─────────────────────────────────────────────────────────────┐
│                      Security Layers                         │
└─────────────────────────────────────────────────────────────┘

1. VAPID Authentication
   ┌──────────────────────────────────────┐
   │ Public Key  → Client (safe to share) │
   │ Private Key → Server (keep secret)   │
   └──────────────────────────────────────┘

2. HTTPS Requirement
   ┌──────────────────────────────────────┐
   │ Production: HTTPS required           │
   │ Development: localhost allowed       │
   └──────────────────────────────────────┘

3. Row Level Security (RLS)
   ┌──────────────────────────────────────┐
   │ Users can only access own subs       │
   │ Service role for server operations   │
   └──────────────────────────────────────┘

4. Subscription Validation
   ┌──────────────────────────────────────┐
   │ Invalid subs auto-removed (410/404)  │
   │ Expired subs cleaned up              │
   └──────────────────────────────────────┘
```

## 📱 Component Hierarchy

```
App Layout
└── NotificationPrompt (auto-show after 3s)
    └── useNotifications hook
        ├── registerServiceWorker()
        ├── requestPermission()
        ├── subscribeToPush()
        └── POST /api/notifications/subscribe

Settings Page
└── NotificationSettings
    └── useNotifications hook
        ├── subscribe()
        ├── unsubscribe()
        ├── testNotification()
        └── Permission status display

Admin Page
└── Notification Management
    ├── NotificationSettings
    └── Template Test Buttons
        └── POST /api/notifications/send
```

## 🔄 State Management

```
useNotifications Hook State
┌─────────────────────────────────────┐
│ supported: boolean                  │
│ permission: 'default'|'granted'|... │
│ subscribed: boolean                 │
│ loading: boolean                    │
│ error: string | null                │
└─────────────────────────────────────┘
         ↓
Actions
┌─────────────────────────────────────┐
│ requestPermission()                 │
│ subscribe()                         │
│ unsubscribe()                       │
│ testNotification()                  │
│ clearError()                        │
└─────────────────────────────────────┘
```

## 🎨 UI States

```
Permission States
┌─────────────────────────────────────┐
│ default   → Show prompt             │
│ granted   → Show toggle (on/off)    │
│ denied    → Show help text          │
└─────────────────────────────────────┘

Subscription States
┌─────────────────────────────────────┐
│ not subscribed → [Bật thông báo]    │
│ subscribed     → [Tắt thông báo]    │
│                  [Test notification] │
└─────────────────────────────────────┘

Loading States
┌─────────────────────────────────────┐
│ loading → Disable buttons           │
│           Show "Đang bật..."        │
└─────────────────────────────────────┘
```

## 📊 Data Flow Summary

```
1. Setup
   VAPID Keys → .env.local
   SQL Script → Database Table

2. User Subscribe
   Browser → Service Worker → Push Manager → Server → Database

3. Send Notification
   Feature → sendNotification() → API → Database → web-push → Browser

4. User Interaction
   Click Notification → Service Worker → Navigate → Show Page
```

## 🚀 Quick Reference

### Client-Side
```typescript
import { useNotifications } from '@/hooks/useNotifications';
const { subscribe, subscribed } = useNotifications();
```

### Server-Side
```typescript
import { sendNotification, NotificationTemplates } from '@/lib/sendNotification';
await sendNotification({
  userId: 'user@mindx.edu.vn',
  notification: NotificationTemplates.teacherChangeApproved('PRO-K12-01')
});
```

### Service Worker
```javascript
// Automatically handles:
// - Push events
// - Notification display
// - Click handling
// - Navigation
```

---

**See also:**
- `SETUP-NOTIFICATIONS.md` - Quick setup guide
- `docs/PUSH-NOTIFICATIONS.md` - Full documentation
- `NOTIFICATION-FILES.md` - File structure
