// Notification Bell Component
// Shows notification icon with badge and dropdown list

'use client';

import { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
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
  const { subscribed, subscribe } = useNotifications();

  // Fetch notifications from API
  useEffect(() => {
    async function fetchNotifications() {
      try {
        const response = await fetch('/api/notifications/list');
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
        // Fallback to mock data if API fails
        const mockNotifications: Notification[] = [
          {
            id: '1',
            title: 'Yêu cầu thay đổi giáo viên',
            body: 'Nguyễn Văn A yêu cầu thay đổi lớp PRO-K12-01',
            url: '/admin/teacher-change',
            read: false,
            timestamp: new Date(Date.now() - 5 * 60 * 1000)
          },
          {
            id: '2',
            title: 'Phiếu đánh giá mới',
            body: 'Bạn được giao phiếu đánh giá cho lớp PRO-K12-02',
            url: '/admin/tickets',
            read: false,
            timestamp: new Date(Date.now() - 30 * 60 * 1000)
          }
        ];
        setNotifications(mockNotifications);
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
      await fetch('/api/notifications/list', {
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
      await fetch('/api/notifications/list', {
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

  // If not subscribed, show subscribe prompt
  if (!subscribed) {
    return (
      <button
        onClick={subscribe}
        className={styles.bellButton}
        title="Bật thông báo"
      >
        <Bell size={18} />
      </button>
    );
  }

  return (
    <div className={styles.container} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={styles.bellButton}
        aria-label="Thông báo"
      >
        <Bell size={18} />
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
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className={styles.markAllRead}
                >
                  Đánh dấu đã đọc
                </button>
              )}
            </div>

            {/* Notifications list */}
            <div className={styles.notificationsList}>
              {notifications.length === 0 ? (
                <div className={styles.emptyState}>
                  <Bell size={32} />
                  <p>Không có thông báo</p>
                </div>
              ) : (
                notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`${styles.notificationItem} ${
                      !notification.read ? styles.unread : ''
                    }`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className={styles.notificationContent}>
                      <h4>{notification.title}</h4>
                      <p>{notification.body}</p>
                      <span className={styles.timestamp}>
                        {formatTimestamp(notification.timestamp)}
                      </span>
                    </div>
                    {!notification.read && (
                      <div className={styles.unreadDot} />
                    )}
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
