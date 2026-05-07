# 🔗 Push Notification Integration Guide

Hướng dẫn chi tiết cách integrate push notifications vào các tính năng hiện có của MindX KPI Dashboard.

## 📋 Overview

Các tính năng cần notifications:
1. ✅ Teacher Change (Thay đổi giáo viên)
2. ✅ Tickets (Phiếu đánh giá)
3. ✅ Class Quality (Chất lượng lớp học)
4. ✅ Office Hours (Ca trải nghiệm)

## 🎯 Integration Points

### 1. Teacher Change Flow

#### Scenario A: Teacher submits change request
**Trigger**: Teacher tạo yêu cầu thay đổi  
**Recipient**: Managers của cơ sở  
**Template**: `teacherChangeRequest`

```typescript
// File: src/app/api/teacher-change/create/route.ts
import { sendNotification, NotificationTemplates } from '@/lib/sendNotification';

export async function POST(request: Request) {
  const { teacherId, teacherName, className, centreId } = await request.json();
  
  // 1. Create request in database
  const request = await createTeacherChangeRequest({
    teacherId,
    className,
    status: 'pending'
  });
  
  // 2. Get managers for this centre
  const managers = await getManagersForCentre(centreId);
  const managerIds = managers.map(m => m.email);
  
  // 3. Send notification to managers
  await sendNotification({
    userIds: managerIds,
    notification: NotificationTemplates.teacherChangeRequest(
      teacherName,
      className
    )
  });
  
  return Response.json({ success: true, requestId: request.id });
}
```

#### Scenario B: Manager approves request
**Trigger**: Manager phê duyệt yêu cầu  
**Recipient**: Teacher đã tạo yêu cầu  
**Template**: `teacherChangeApproved`

```typescript
// File: src/app/api/teacher-change/approve/route.ts
import { sendNotification, NotificationTemplates } from '@/lib/sendNotification';

export async function POST(request: Request) {
  const { requestId, managerId } = await request.json();
  
  // 1. Get request details
  const changeRequest = await getTeacherChangeRequest(requestId);
  
  // 2. Update status to approved
  await updateTeacherChangeRequest(requestId, {
    status: 'approved',
    approvedBy: managerId,
    approvedAt: new Date()
  });
  
  // 3. Send notification to teacher
  await sendNotification({
    userId: changeRequest.teacherId,
    notification: NotificationTemplates.teacherChangeApproved(
      changeRequest.className
    )
  });
  
  return Response.json({ success: true });
}
```

#### Scenario C: Manager rejects request
**Trigger**: Manager từ chối yêu cầu  
**Recipient**: Teacher đã tạo yêu cầu  
**Template**: `teacherChangeRejected`

```typescript
// File: src/app/api/teacher-change/reject/route.ts
import { sendNotification, NotificationTemplates } from '@/lib/sendNotification';

export async function POST(request: Request) {
  const { requestId, managerId, reason } = await request.json();
  
  // 1. Get request details
  const changeRequest = await getTeacherChangeRequest(requestId);
  
  // 2. Update status to rejected
  await updateTeacherChangeRequest(requestId, {
    status: 'rejected',
    rejectedBy: managerId,
    rejectedAt: new Date(),
    rejectionReason: reason
  });
  
  // 3. Send notification to teacher
  await sendNotification({
    userId: changeRequest.teacherId,
    notification: NotificationTemplates.teacherChangeRejected(
      changeRequest.className,
      reason
    )
  });
  
  return Response.json({ success: true });
}
```

---

### 2. Tickets Flow

#### Scenario A: Ticket assigned to user
**Trigger**: Admin giao phiếu đánh giá  
**Recipient**: User được giao  
**Template**: `ticketAssigned`

```typescript
// File: src/app/api/tickets/assign/route.ts
import { sendNotification, NotificationTemplates } from '@/lib/sendNotification';

export async function POST(request: Request) {
  const { ticketId, assigneeId, className } = await request.json();
  
  // 1. Assign ticket
  await assignTicket(ticketId, assigneeId);
  
  // 2. Send notification to assignee
  await sendNotification({
    userId: assigneeId,
    notification: NotificationTemplates.ticketAssigned(
      ticketId,
      className
    )
  });
  
  return Response.json({ success: true });
}
```

#### Scenario B: Ticket completed
**Trigger**: User hoàn thành phiếu đánh giá  
**Recipient**: Admin/Manager đã tạo ticket  
**Template**: `ticketCompleted`

```typescript
// File: src/app/api/tickets/complete/route.ts
import { sendNotification, NotificationTemplates } from '@/lib/sendNotification';

export async function POST(request: Request) {
  const { ticketId, completedBy } = await request.json();
  
  // 1. Get ticket details
  const ticket = await getTicket(ticketId);
  
  // 2. Update status to completed
  await updateTicket(ticketId, {
    status: 'completed',
    completedBy,
    completedAt: new Date()
  });
  
  // 3. Send notification to creator
  await sendNotification({
    userId: ticket.createdBy,
    notification: NotificationTemplates.ticketCompleted(
      ticket.className
    )
  });
  
  return Response.json({ success: true });
}
```

---

### 3. Class Quality Alerts

#### Scenario A: Low completion rate
**Trigger**: Tỷ lệ hoàn thành < 70%  
**Recipient**: Managers của cơ sở  
**Template**: `classQualityAlert`

```typescript
// File: src/lib/checkClassQuality.ts
import { sendNotification, NotificationTemplates } from '@/lib/sendNotification';

export async function checkCompletionRate(classData: ClassData) {
  const completionRate = (classData.completed / classData.total) * 100;
  
  if (completionRate < 70) {
    // Get managers for this centre
    const managers = await getManagersForCentre(classData.centreId);
    
    // Send alert
    await sendNotification({
      userIds: managers.map(m => m.email),
      notification: NotificationTemplates.classQualityAlert(
        classData.className,
        `Tỷ lệ hoàn thành thấp: ${completionRate.toFixed(1)}%`
      )
    });
  }
}
```

#### Scenario B: High teacher change rate
**Trigger**: Tỷ lệ thay đổi GV > 30%  
**Recipient**: Managers của cơ sở  
**Template**: `classQualityAlert`

```typescript
// File: src/lib/checkTeacherChangeRate.ts
import { sendNotification, NotificationTemplates } from '@/lib/sendNotification';

export async function checkTeacherChangeRate(classData: ClassData) {
  const changeRate = (classData.teacherChanges / classData.totalSessions) * 100;
  
  if (changeRate > 30) {
    const managers = await getManagersForCentre(classData.centreId);
    
    await sendNotification({
      userIds: managers.map(m => m.email),
      notification: NotificationTemplates.classQualityAlert(
        classData.className,
        `Tỷ lệ thay đổi GV cao: ${changeRate.toFixed(1)}%`
      )
    });
  }
}
```

#### Scenario C: Low survey score
**Trigger**: Điểm khảo sát < 3.0  
**Recipient**: Managers và Teacher  
**Template**: `classQualityAlert`

```typescript
// File: src/lib/checkSurveyScore.ts
import { sendNotification, NotificationTemplates } from '@/lib/sendNotification';

export async function checkSurveyScore(surveyData: SurveyData) {
  if (surveyData.averageScore < 3.0) {
    // Get managers and teacher
    const managers = await getManagersForCentre(surveyData.centreId);
    const recipients = [
      ...managers.map(m => m.email),
      surveyData.teacherId
    ];
    
    await sendNotification({
      userIds: recipients,
      notification: NotificationTemplates.classQualityAlert(
        surveyData.className,
        `Điểm khảo sát thấp: ${surveyData.averageScore.toFixed(1)}/5`
      )
    });
  }
}
```

---

### 4. Office Hours Reminders

#### Scenario A: Reminder before session
**Trigger**: 30 phút trước ca trải nghiệm  
**Recipient**: Teacher phụ trách  
**Template**: `officeHoursReminder`

```typescript
// File: src/lib/scheduleOfficeHoursReminders.ts
import { sendNotification, NotificationTemplates } from '@/lib/sendNotification';

export async function sendOfficeHoursReminder(session: OfficeHourSession) {
  const sessionTime = new Date(session.startTime);
  const now = new Date();
  const minutesUntil = (sessionTime.getTime() - now.getTime()) / 1000 / 60;
  
  // Send reminder 30 minutes before
  if (minutesUntil <= 30 && minutesUntil > 25) {
    await sendNotification({
      userId: session.teacherId,
      notification: NotificationTemplates.officeHoursReminder(
        session.startTime,
        session.location
      )
    });
  }
}

// Schedule this to run every 5 minutes
// Using cron job or Next.js API route with setInterval
```

#### Scenario B: Session assigned
**Trigger**: Admin giao ca cho teacher  
**Recipient**: Teacher được giao  
**Template**: `generic`

```typescript
// File: src/app/api/office-hours/assign/route.ts
import { sendNotification, NotificationTemplates } from '@/lib/sendNotification';

export async function POST(request: Request) {
  const { sessionId, teacherId, startTime, location } = await request.json();
  
  // 1. Assign session
  await assignOfficeHourSession(sessionId, teacherId);
  
  // 2. Send notification
  await sendNotification({
    userId: teacherId,
    notification: NotificationTemplates.generic(
      'Ca trải nghiệm mới',
      `Bạn được giao ca ${startTime} tại ${location}`,
      '/office-hours'
    )
  });
  
  return Response.json({ success: true });
}
```

---

## 🔄 Batch Notifications

### Send to multiple users at once

```typescript
// Example: Alert all managers about system maintenance
import { sendNotification } from '@/lib/sendNotification';

async function notifySystemMaintenance() {
  const allManagers = await getAllManagers();
  
  await sendNotification({
    userIds: allManagers.map(m => m.email),
    notification: {
      title: 'Bảo trì hệ thống',
      body: 'Hệ thống sẽ bảo trì từ 22:00 - 23:00 hôm nay',
      url: '/',
      requireInteraction: true
    }
  });
}
```

---

## 🎯 Custom Notifications

### Create custom notification for specific use case

```typescript
import { sendNotification } from '@/lib/sendNotification';

// Example: Custom notification with actions
await sendNotification({
  userId: 'user@mindx.edu.vn',
  notification: {
    title: 'Yêu cầu xác nhận',
    body: 'Bạn có yêu cầu cần xác nhận',
    icon: '/logo/logo.svg',
    badge: '/logo/x_white.svg',
    tag: 'confirmation-request',
    url: '/confirmations',
    requireInteraction: true,
    actions: [
      { action: 'approve', title: 'Xác nhận' },
      { action: 'reject', title: 'Từ chối' }
    ],
    data: {
      requestId: 'REQ-001',
      type: 'confirmation'
    }
  }
});
```

---

## 🔧 Helper Functions

### Get managers for centre

```typescript
// File: src/lib/getManagers.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function getManagersForCentre(centreId: string) {
  const { data, error } = await supabase
    .from('users')
    .select('email, name')
    .eq('role', 'manager')
    .eq('centre_id', centreId);
  
  if (error) throw error;
  return data;
}

export async function getAllManagers() {
  const { data, error } = await supabase
    .from('users')
    .select('email, name')
    .eq('role', 'manager');
  
  if (error) throw error;
  return data;
}
```

---

## 📊 Monitoring & Analytics

### Track notification delivery

```typescript
// File: src/lib/trackNotification.ts
export async function trackNotification(
  userId: string,
  notificationType: string,
  success: boolean
) {
  await supabase.from('notification_logs').insert({
    user_id: userId,
    type: notificationType,
    success,
    sent_at: new Date()
  });
}

// Usage in sendNotification
const result = await sendNotification({
  userId,
  notification
});

await trackNotification(userId, 'teacher-change-approved', result.success);
```

---

## 🧪 Testing Integration

### Test notification in development

```typescript
// File: src/app/api/test-notification/route.ts
import { sendNotification, NotificationTemplates } from '@/lib/sendNotification';

export async function POST(request: Request) {
  const { userId, template } = await request.json();
  
  let notification;
  
  switch (template) {
    case 'teacher-change-request':
      notification = NotificationTemplates.teacherChangeRequest(
        'Test Teacher',
        'TEST-CLASS-01'
      );
      break;
    case 'ticket-assigned':
      notification = NotificationTemplates.ticketAssigned(
        'TEST-001',
        'TEST-CLASS-01'
      );
      break;
    // ... other templates
  }
  
  const result = await sendNotification({ userId, notification });
  return Response.json(result);
}
```

---

## ✅ Integration Checklist

### For each feature:

- [ ] Identify notification triggers
- [ ] Determine recipients
- [ ] Choose appropriate template
- [ ] Add sendNotification() call
- [ ] Test notification delivery
- [ ] Verify notification content
- [ ] Test click navigation
- [ ] Add error handling
- [ ] Add logging/tracking

### Teacher Change:
- [ ] Request created → Notify managers
- [ ] Request approved → Notify teacher
- [ ] Request rejected → Notify teacher

### Tickets:
- [ ] Ticket assigned → Notify assignee
- [ ] Ticket completed → Notify creator

### Class Quality:
- [ ] Low completion → Notify managers
- [ ] High teacher change → Notify managers
- [ ] Low survey score → Notify managers + teacher

### Office Hours:
- [ ] Session assigned → Notify teacher
- [ ] 30min reminder → Notify teacher

---

## 🚨 Error Handling

### Handle notification failures gracefully

```typescript
try {
  const result = await sendNotification({
    userId,
    notification
  });
  
  if (!result.success) {
    console.error('Notification failed:', result.error);
    // Log error but don't block main flow
  }
} catch (error) {
  console.error('Notification error:', error);
  // Continue with main flow
}
```

---

## 📚 Resources

- **Templates**: `src/lib/sendNotification.ts`
- **Hook**: `src/hooks/useNotifications.ts`
- **API**: `src/app/api/notifications/`
- **Docs**: `docs/PUSH-NOTIFICATIONS.md`

---

**Next Steps:**
1. Follow this guide to add notifications to each feature
2. Test each integration thoroughly
3. Monitor notification delivery in production
4. Gather user feedback and iterate
