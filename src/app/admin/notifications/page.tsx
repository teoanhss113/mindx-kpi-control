'use client';

import { useEffect } from 'react';
import { PageLayout } from '@/components/PageLayout';
import { NotificationSettings } from '@/components/NotificationSettings';
import styles from './page.module.css';

export default function NotificationsPage() {
  useEffect(() => {
    fetch('/api/notifications/setup', { method: 'POST' }).catch(() => {});
  }, []);

  return (
    <PageLayout title="Thông báo">
      <div className={styles.wrapper}>
        <NotificationSettings />

        <details className={styles.help}>
          <summary className={styles.helpSummary}>Không nhận được thông báo?</summary>
          <ol className={styles.helpList}>
            <li>DevTools (F12) → <strong>Application</strong> → <strong>Service Workers</strong> — xác nhận <code>sw.js</code> đang chạy</li>
            <li>Tab <strong>Application</strong> → <strong>Notifications</strong> → kiểm tra Origin được Allow</li>
            <li>Nếu SW hiện <em>"waiting to activate"</em> → click <strong>skipWaiting</strong> hoặc đóng hết tab rồi mở lại</li>
            <li>Nhấn "Gửi thử" trong phần cài đặt — nếu thất bại, nhấn <strong>Đăng ký lại</strong> rồi thử lại</li>
            <li>macOS: System Settings → Notifications → Chrome → bật Allow</li>
          </ol>
        </details>
      </div>
    </PageLayout>
  );
}
