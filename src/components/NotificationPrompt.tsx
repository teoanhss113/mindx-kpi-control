// Notification Permission Prompt Component
// Shows a banner to request notification permissions

'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@/components/ui';
import { useNotifications } from '@/hooks/useNotifications';
import styles from './NotificationPrompt.module.css';

const DISMISSED_KEY = 'notification-prompt-dismissed';
const DISMISS_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

export function NotificationPrompt() {
  const [visible, setVisible] = useState(false);
  const { supported, permission, subscribe, loading } = useNotifications();

  useEffect(() => {
    // Check if should show prompt
    if (!supported || permission !== 'default') {
      return;
    }

    const dismissed = localStorage.getItem(DISMISSED_KEY);
    if (dismissed) {
      const dismissedTime = parseInt(dismissed, 10);
      if (Date.now() - dismissedTime < DISMISS_DURATION) {
        return;
      }
    }

    // Show after 3 seconds
    const timer = setTimeout(() => {
      setVisible(true);
    }, 3000);

    return () => clearTimeout(timer);
  }, [supported, permission]);

  const handleEnable = async () => {
    const success = await subscribe();
    if (success) {
      setVisible(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, Date.now().toString());
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className={styles.prompt}
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          <div className={styles.content}>
            <div className={styles.icon}>
              <Icon.Bell size={20} />
            </div>
            <div className={styles.text}>
              <h4>Bật thông báo</h4>
              <p>Nhận thông báo khi có yêu cầu xác nhận hoặc cập nhật quan trọng</p>
            </div>
            <div className={styles.actions}>
              <button
                onClick={handleEnable}
                disabled={loading}
                className={styles.enableButton}
              >
                {loading ? 'Đang bật...' : 'Bật ngay'}
              </button>
              <button
                onClick={handleDismiss}
                className={styles.dismissButton}
                aria-label="Đóng"
              >
                <Icon.X size={18} />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
