// Utility to send push notifications
// Use this from server-side code to send notifications to users

interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  url?: string;
  requireInteraction?: boolean;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
  data?: Record<string, any>;
}

interface SendNotificationParams {
  userId?: string;
  userIds?: string[];
  notification: NotificationOptions;
}

/**
 * Send push notification to one or multiple users
 * Also saves notification to database for history
 */
export async function sendNotification({
  userId,
  userIds,
  notification
}: SendNotificationParams): Promise<{
  success: boolean;
  sent?: number;
  failed?: number;
  error?: string;
}> {
  try {
    const payload = {
      title: notification.title,
      body: notification.body,
      icon: notification.icon || '/logo/logo.svg',
      badge: notification.badge || '/logo/x_white.svg',
      tag: notification.tag || 'mindx-notification',
      requireInteraction: notification.requireInteraction || false,
      actions: notification.actions || [],
      data: {
        url: notification.url || '/',
        ...notification.data
      }
    };

    // Save notification to database first
    const targetUserIds = userId ? [userId] : userIds || [];
    
    if (targetUserIds.length > 0) {
      await saveNotificationToDatabase(targetUserIds, notification);
    }

    // Send push notification
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/notifications/send`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId,
          userIds,
          payload
        })
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to send notification');
    }

    const result = await response.json();
    return {
      success: true,
      sent: result.sent,
      failed: result.failed
    };
  } catch (error) {
    console.error('[sendNotification] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Save notification to database for history
 */
async function saveNotificationToDatabase(
  userIds: string[],
  notification: NotificationOptions
): Promise<void> {
  try {
    const notifications = userIds.map(userId => ({
      user_id: userId,
      title: notification.title,
      body: notification.body,
      url: notification.url || '/',
      type: notification.tag || 'generic',
      metadata: notification.data || {}
    }));

    await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/notifications/save`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ notifications })
      }
    );
  } catch (error) {
    console.error('[saveNotificationToDatabase] Error:', error);
    // Don't throw - notification history is not critical
  }
}

/**
 * Notification templates for common scenarios
 */
export const NotificationTemplates = {
  // Teacher Change Request
  teacherChangeRequest: (teacherName: string, className: string) => ({
    title: 'Yêu cầu thay đổi giáo viên',
    body: `${teacherName} yêu cầu thay đổi lớp ${className}`,
    tag: 'teacher-change-request',
    url: '/admin/teacher-change',
    requireInteraction: true,
    actions: [
      { action: 'view', title: 'Xem chi tiết' },
      { action: 'close', title: 'Đóng' }
    ]
  }),

  // Teacher Change Approved
  teacherChangeApproved: (className: string) => ({
    title: 'Yêu cầu đã được phê duyệt',
    body: `Yêu cầu thay đổi lớp ${className} đã được phê duyệt`,
    tag: 'teacher-change-approved',
    url: '/teacher-change'
  }),

  // Teacher Change Rejected
  teacherChangeRejected: (className: string, reason?: string) => ({
    title: 'Yêu cầu bị từ chối',
    body: reason
      ? `Yêu cầu thay đổi lớp ${className} bị từ chối: ${reason}`
      : `Yêu cầu thay đổi lớp ${className} bị từ chối`,
    tag: 'teacher-change-rejected',
    url: '/teacher-change'
  }),

  // Ticket Assigned
  ticketAssigned: (ticketId: string, className: string) => ({
    title: 'Phiếu đánh giá mới',
    body: `Bạn được giao phiếu đánh giá cho lớp ${className}`,
    tag: 'ticket-assigned',
    url: `/tickets?id=${ticketId}`,
    requireInteraction: true
  }),

  // Ticket Completed
  ticketCompleted: (className: string) => ({
    title: 'Phiếu đánh giá đã hoàn thành',
    body: `Phiếu đánh giá lớp ${className} đã được hoàn thành`,
    tag: 'ticket-completed',
    url: '/tickets'
  }),

  // Class Quality Alert
  classQualityAlert: (className: string, issue: string) => ({
    title: 'Cảnh báo chất lượng lớp học',
    body: `Lớp ${className}: ${issue}`,
    tag: 'class-quality-alert',
    url: '/admin/class-quality',
    requireInteraction: true
  }),

  // Office Hours Reminder
  officeHoursReminder: (time: string, location: string) => ({
    title: 'Nhắc nhở ca trải nghiệm',
    body: `Ca trải nghiệm ${time} tại ${location} sắp bắt đầu`,
    tag: 'office-hours-reminder',
    url: '/office-hours'
  }),

  // Generic notification
  generic: (title: string, body: string, url?: string) => ({
    title,
    body,
    tag: 'generic-notification',
    url: url || '/'
  })
};
