// Notification Settings Component
// Allows users to manage notification preferences

'use client';

import { useState } from 'react';
import { Bell, BellOff, TestTube } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import styles from './NotificationSettings.module.css';

export function NotificationSettings() {
  const {
    supported,
    permission,
    subscribed,
    loading,
    error,
    subscribe,
    unsubscribe,
    testNotification,
    clearError
  } = useNotifications();

  const [testing, setTesting] = useState(false);

  const handleToggle = async () => {
    if (subscribed) {
      await unsubscribe();
    } else {
      await subscribe();
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      await testNotification();
    } catch (err) {
      console.error('Test notification failed:', err);
    } finally {
      setTimeout(() => setTesting(false), 2000);
    }
  };

  if (!supported) {
    return (
      <div className={styles.container}>
        <div className={styles.unsupported}>
          <BellOff size={24} />
          <p>Trình duyệt của bạn không hỗ trợ push notifications</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerIcon}>
          <Bell size={20} />
        </div>
        <div className={styles.headerText}>
          <h3>Thông báo đẩy</h3>
          <p>Nhận thông báo về các yêu cầu và cập nhật quan trọng</p>
        </div>
      </div>

      <div className={styles.content}>
        {/* Permission Status */}
        <div className={styles.status}>
          <span className={styles.statusLabel}>Trạng thái:</span>
          <span className={`${styles.statusBadge} ${styles[permission]}`}>
            {permission === 'granted' && 'Đã cho phép'}
            {permission === 'denied' && 'Đã từ chối'}
            {permission === 'default' && 'Chưa thiết lập'}
          </span>
        </div>

        {/* Subscription Toggle */}
        {permission === 'granted' && (
          <div className={styles.toggle}>
            <label className={styles.toggleLabel}>
              <input
                type="checkbox"
                checked={subscribed}
                onChange={handleToggle}
                disabled={loading}
                className={styles.toggleInput}
              />
              <span className={styles.toggleSwitch} />
              <span className={styles.toggleText}>
                {subscribed ? 'Đang bật' : 'Đang tắt'}
              </span>
            </label>
          </div>
        )}

        {/* Test Button */}
        {subscribed && (
          <button
            onClick={handleTest}
            disabled={testing}
            className={styles.testButton}
          >
            <TestTube size={16} />
            {testing ? 'Đã gửi!' : 'Gửi thông báo thử'}
          </button>
        )}

        {/* Error Message */}
        {error && (
          <div className={styles.error}>
            <p>{error}</p>
            <button onClick={clearError} className={styles.errorClose}>
              Đóng
            </button>
          </div>
        )}

        {/* Help Text */}
        {permission === 'denied' && (
          <div className={styles.help}>
            <p>
              Bạn đã từ chối quyền thông báo. Để bật lại, vui lòng vào cài đặt
              trình duyệt và cho phép thông báo cho trang web này.
            </p>
          </div>
        )}

        {permission === 'default' && (
          <div className={styles.help}>
            <p>
              Bật thông báo để nhận cập nhật về các yêu cầu xác nhận, phê duyệt
              và các thay đổi quan trọng.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
