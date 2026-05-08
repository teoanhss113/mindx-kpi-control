// Notification Bell Component
// Shows notification icon with badge and dropdown list

'use client';

import { useState, useEffect, useRef } from 'react';
import { Icon } from '@/components/ui';
import { useNotifications } from '@/hooks/useNotifications';
import { authFetch } from '@/lib/auth/clientAuth';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './NotificationBell.module.css';

interface Notification {
  id: string;
  title: string;
  body: string;
  url?: string;
  read: boolean;
  timestamp: Date;
}

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { subscribed, permission, subscribe } = useNotifications();
  const [showSubscribeHint, setShowSubscribeHint] = useState(false);
  const [testingPush, setTestingPush] = useState(false);
  const [testResult, setTestResult] = useState<'ok' | 'fail' | null>(null);

  const handleTestPush = async () => {
    setTestingPush(true);
    setTestResult(null);
    try {
      const res = await authFetch('/api/notifications/test', { method: 'POST' });
      const data = await res.json();
      setTestResult(data.success ? 'ok' : 'fail');
    } catch {
      setTestResult('fail');
    } finally {
      setTestingPush(false);
      setTimeout(() => setTestResult(null), 4000);
    }
  };

  // Ensure notification tables exist (idempotent — cached server-side after first success)
  useEffect(() => {
    fetch('/api/notifications/setup', { method: 'POST' }).catch(() => {});
  }, []);

  // Fetch notifications from API
  useEffect(() => {
    async function fetchNotifications() {
      try {
        const response = await authFetch('/api/notifications/list');
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.notifications) {
            const formattedNotifications = data.notifications.map((n: any) => ({
              id: n.id,
              title: n.title,
              body: n.body,
              url: n.url,
              read: n.read,
              timestamp: new Date(n.created_at)
            }));
            setNotifications(formattedNotifications);
          }
        }
      } catch (error) {
        console.error('Failed to fetch notifications:', error);
        // Keep existing notifications on error — don't clear what's already shown
      }
    }

    fetchNotifications();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read in UI
    setNotifications(prev =>
      prev.map(n => n.id === notification.id ? { ...n, read: true } : n)
    );

    // Mark as read in database
    try {
      await authFetch('/api/notifications/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationIds: [notification.id] })
      });
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }

    // Navigate to URL
    if (notification.url) {
      window.location.href = notification.url;
    }

    setIsOpen(false);
  };

  const handleMarkAllRead = async () => {
    const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
    
    // Mark all as read in UI
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));

    // Mark all as read in database
    try {
      await authFetch('/api/notifications/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationIds: unreadIds })
      });
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const formatTimestamp = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Vừa xong';
    if (minutes < 60) return `${minutes} phút trước`;
    if (hours < 24) return `${hours} giờ trước`;
    return `${days} ngày trước`;
  };

  return (
    <div className={styles.container} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={styles.bellButton}
        aria-label="Thông báo"
      >
        <Icon.Bell size={18} />
        {unreadCount > 0 && (
          <span className={styles.badge}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            className={styles.dropdown}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {/* Header */}
            <div className={styles.dropdownHeader}>
              <h3>Thông báo</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {unreadCount > 0 && (
                  <button onClick={handleMarkAllRead} className={styles.markAllRead}>
                    Đánh dấu đã đọc
                  </button>
                )}
                {/* Show re-subscribe option if test failed (stale browser subscription) */}
                {subscribed && testResult === 'fail' ? (
                  <button
                    onClick={async () => { setTestResult(null); await subscribe(); }}
                    className={styles.markAllRead}
                    title="Đăng ký lại thông báo"
                    style={{ color: '#dc2626' }}
                  >
                    ✗ Đăng ký lại
                  </button>
                ) : subscribed && permission === 'granted' ? (
                  <button
                    onClick={handleTestPush}
                    disabled={testingPush}
                    className={styles.markAllRead}
                    title="Gửi thông báo thử để kiểm tra"
                    style={{ color: testResult === 'ok' ? '#10b981' : 'var(--text-tertiary)' }}
                  >
                    {testingPush ? '...' : testResult === 'ok' ? '✓ Đã gửi' : 'Gửi thử'}
                  </button>
                ) : (
                  <button
                    onClick={async () => { await subscribe(); setShowSubscribeHint(false); }}
                    className={styles.markAllRead}
                    title="Bật thông báo đẩy"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    Bật thông báo
                  </button>
                )}
              </div>
            </div>

            {/* Notifications list */}
            <div className={styles.notificationsList}>
              {notifications.length === 0 ? (
                <div className={styles.emptyState}>
                  <Icon.Bell size={32} />
                  <p>Không có thông báo</p>
                </div>
              ) : (
                notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`${styles.notificationItem} ${!notification.read ? styles.unread : ''}`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className={styles.notificationContent}>
                      <h4>{notification.title}</h4>
                      <p>{notification.body}</p>
                      <span className={styles.timestamp}>
                        {formatTimestamp(notification.timestamp)}
                      </span>
                    </div>
                    {!notification.read && <div className={styles.unreadDot} />}
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className={styles.dropdownFooter}>
                <a href="/admin/notifications" className={styles.viewAll}>
                  Xem tất cả
                </a>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
