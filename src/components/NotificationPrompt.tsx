// Notification Permission Prompt Component
// Shows a banner to request notification permissions

'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNotifications } from '@/hooks/useNotifications';
import styles from '@/app/dashboard.module.css';
import promptStyles from './NotificationPrompt.module.css';

const AUTO_REQUEST_KEY = 'notification-auto-requested';
const AUTO_DISMISS_KEY = 'notification-prompt-dismissed-session';

export function NotificationPrompt() {
  const [dismissed, setDismissed] = useState(
    () => typeof window !== 'undefined' && sessionStorage.getItem(AUTO_DISMISS_KEY) === 'true'
  );
  const [showBlockedHelp, setShowBlockedHelp] = useState(false);
  const { supported, permission, subscribe, loading } = useNotifications();
  const shouldShowPrompt = supported && permission !== 'granted' && !dismissed;

  const handleEnable = async () => {
    sessionStorage.setItem(AUTO_REQUEST_KEY, 'true');
    const success = await subscribe();

    if (!success) {
      setShowBlockedHelp(true);
    }
  };

  const handleDismiss = () => {
    sessionStorage.setItem(AUTO_DISMISS_KEY, 'true');
    setDismissed(true);
  };

  return (
    <>
      <AnimatePresence>
        {shouldShowPrompt && (
          <motion.div
            className={`${styles.toast} ${styles.info} ${promptStyles.prompt}`}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <div className={styles.toastContent}>
              <div className={`${styles.toastMessage} ${promptStyles.message}`}>
                {showBlockedHelp || permission === 'denied'
                  ? 'Trình duyệt đang chặn thông báo. Mở cài đặt trang trên thanh địa chỉ → Notifications → Allow.'
                  : 'Bật thông báo để không bỏ lỡ cập nhật quan trọng.'}
              </div>
              {!showBlockedHelp && permission !== 'denied' && (
                <button
                  onClick={handleEnable}
                  disabled={loading}
                  className={styles.primaryBtn}
                >
                  {loading ? 'Đang bật...' : 'Bật ngay'}
                </button>
              )}
              <button
                type="button"
                onClick={handleDismiss}
                className={styles.toastCloseButton}
                aria-label="Tắt nhắc bật thông báo"
              >
                ×
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
