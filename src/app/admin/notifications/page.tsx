// Admin Notifications Management Page
// Demo page for testing and managing push notifications

'use client';

import { useState } from 'react';
import { Bell, Send, TestTube, Users } from 'lucide-react';
import { PageLayout } from '@/components/PageLayout';
import { NotificationSettings } from '@/components/NotificationSettings';
import { NotificationTemplates } from '@/lib/sendNotification';
import styles from './page.module.css';

export default function NotificationsPage() {
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleSendTest = async (template: string) => {
    setSending(true);
    setResult(null);

    try {
      let notification;
      
      switch (template) {
        case 'teacher-change-request':
          notification = NotificationTemplates.teacherChangeRequest(
            'Nguyễn Văn A',
            'PRO-K12-01'
          );
          break;
        case 'teacher-change-approved':
          notification = NotificationTemplates.teacherChangeApproved('PRO-K12-01');
          break;
        case 'ticket-assigned':
          notification = NotificationTemplates.ticketAssigned('T001', 'PRO-K12-01');
          break;
        case 'class-quality-alert':
          notification = NotificationTemplates.classQualityAlert(
            'PRO-K12-01',
            'Tỷ lệ hoàn thành dưới 70%'
          );
          break;
        default:
          notification = NotificationTemplates.generic(
            'Test Notification',
            'This is a test notification'
          );
      }

      const response = await fetch('/api/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'test@mindx.edu.vn', // Replace with actual user
          payload: notification
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setResult(`✅ Đã gửi: ${data.sent}, Thất bại: ${data.failed}`);
      } else {
        setResult(`❌ Lỗi: ${data.error}`);
      }
    } catch (error) {
      setResult(`❌ Lỗi: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <PageLayout
      title="Quản lý Thông báo"
      icon={<Bell size={24} />}
    >
      <div className={styles.container}>
        {/* Settings Section */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Cài đặt của bạn</h2>
          <NotificationSettings />
        </section>

        {/* Test Templates Section */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            <TestTube size={20} />
            Test Notification Templates
          </h2>
          
          <div className={styles.templates}>
            <button
              onClick={() => handleSendTest('teacher-change-request')}
              disabled={sending}
              className={styles.templateButton}
            >
              <Send size={16} />
              Teacher Change Request
            </button>

            <button
              onClick={() => handleSendTest('teacher-change-approved')}
              disabled={sending}
              className={styles.templateButton}
            >
              <Send size={16} />
              Teacher Change Approved
            </button>

            <button
              onClick={() => handleSendTest('ticket-assigned')}
              disabled={sending}
              className={styles.templateButton}
            >
              <Send size={16} />
              Ticket Assigned
            </button>

            <button
              onClick={() => handleSendTest('class-quality-alert')}
              disabled={sending}
              className={styles.templateButton}
            >
              <Send size={16} />
              Class Quality Alert
            </button>

            <button
              onClick={() => handleSendTest('generic')}
              disabled={sending}
              className={styles.templateButton}
            >
              <Send size={16} />
              Generic Notification
            </button>
          </div>

          {result && (
            <div className={styles.result}>
              {result}
            </div>
          )}
        </section>

        {/* Documentation Section */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            <Users size={20} />
            Hướng dẫn sử dụng
          </h2>
          
          <div className={styles.docs}>
            <h3>Client-side (React Component)</h3>
            <pre className={styles.code}>
{`import { useNotifications } from '@/hooks/useNotifications';

const { subscribe, subscribed } = useNotifications();

// Subscribe to notifications
await subscribe();`}
            </pre>

            <h3>Server-side (API Route)</h3>
            <pre className={styles.code}>
{`import { sendNotification, NotificationTemplates } from '@/lib/sendNotification';

await sendNotification({
  userId: 'user@mindx.edu.vn',
  notification: NotificationTemplates.teacherChangeRequest(
    'Teacher Name',
    'Class Name'
  )
});`}
            </pre>

            <h3>Available Templates</h3>
            <ul className={styles.list}>
              <li>teacherChangeRequest</li>
              <li>teacherChangeApproved</li>
              <li>teacherChangeRejected</li>
              <li>ticketAssigned</li>
              <li>ticketCompleted</li>
              <li>classQualityAlert</li>
              <li>officeHoursReminder</li>
              <li>generic</li>
            </ul>

            <p className={styles.note}>
              📖 Xem chi tiết tại <code>docs/PUSH-NOTIFICATIONS.md</code>
            </p>
          </div>
        </section>
      </div>
    </PageLayout>
  );
}
