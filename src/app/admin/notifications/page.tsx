'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { PageLayout } from '@/components/PageLayout';
import { NotificationSettings } from '@/components/NotificationSettings';
import { Icon } from '@/components/ui';
import { authFetch } from '@/lib/auth/clientAuth';
import styles from './page.module.css';

interface Notification {
  id: string;
  title: string;
  body: string;
  url?: string;
  type?: string;
  read: boolean;
  created_at: string;
}

// ── Category system ────────────────────────────────────────────────
type CategoryId =
  | 'office-hours'
  | 'teacher-change'
  | 'tickets'
  | 'class-quality'
  | 'judge'
  | 'other';

interface CategoryMeta {
  id: CategoryId;
  label: string;
  icon: React.ReactNode;
  color: string; // CSS custom-property or hex
  bg: string;
}

const CATEGORIES: Record<CategoryId, CategoryMeta> = {
  'office-hours': {
    id: 'office-hours',
    label: 'Ca trực',
    icon: <Icon.Calendar size={13} />,
    color: '#5e6ad2',
    bg: 'rgba(94,106,210,0.1)',
  },
  'teacher-change': {
    id: 'teacher-change',
    label: 'Thay đổi GV',
    icon: <Icon.People size={13} />,
    color: '#0ea5e9',
    bg: 'rgba(14,165,233,0.1)',
  },
  tickets: {
    id: 'tickets',
    label: 'Phiếu đánh giá',
    icon: <Icon.FileText size={13} />,
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.1)',
  },
  'class-quality': {
    id: 'class-quality',
    label: 'Chất lượng lớp',
    icon: <Icon.CheckCircle size={13} />,
    color: '#10b981',
    bg: 'rgba(16,185,129,0.1)',
  },
  judge: {
    id: 'judge',
    label: 'Giám khảo',
    icon: <Icon.ClipboardCheck size={13} />,
    color: '#8b5cf6',
    bg: 'rgba(139,92,246,0.1)',
  },
  other: {
    id: 'other',
    label: 'Khác',
    icon: <Icon.Bell size={13} />,
    color: 'var(--text-tertiary)',
    bg: 'var(--bg-elevated)',
  },
};

/** Derive category from notification type field or url */
function getCategory(n: Notification): CategoryId {
  const t = (n.type || '').toLowerCase();
  const u = (n.url || '').toLowerCase();

  if (t.includes('office-hour') || u.includes('office-hour') || u.includes('available-shift'))
    return 'office-hours';
  if (t.includes('teacher-change') || u.includes('teacher-change'))
    return 'teacher-change';
  if (t.includes('ticket') || u.includes('ticket'))
    return 'tickets';
  if (t.includes('class-quality') || u.includes('class-quality'))
    return 'class-quality';
  if (t.includes('judge') || u.includes('judge') || u.includes('final-session'))
    return 'judge';
  return 'other';
}

// ── Tab system ─────────────────────────────────────────────────────
type TabId = 'all' | 'unread' | 'read' | 'settings';

const TABS: { id: TabId; label: string }[] = [
  { id: 'all', label: 'Tất cả' },
  { id: 'unread', label: 'Chưa đọc' },
  { id: 'read', label: 'Đã đọc' },
  { id: 'settings', label: 'Cài đặt' },
];

// ── Timestamp helper ───────────────────────────────────────────────
function formatTimestamp(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Vừa xong';
  if (minutes < 60) return `${minutes} phút trước`;
  if (hours < 24) return `${hours} giờ trước`;
  if (days === 1) return 'Hôm qua';
  if (days < 7) return `${days} ngày trước`;
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ── Page ───────────────────────────────────────────────────────────
export default function NotificationsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('all');
  const [activeCategory, setActiveCategory] = useState<CategoryId | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await authFetch('/api/notifications/list');
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.notifications) {
          setNotifications(data.notifications);
        }
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch('/api/notifications/setup', { method: 'POST' }).catch(() => {});
    fetchNotifications();
  }, [fetchNotifications]);

  const handleNotificationClick = async (n: Notification) => {
    if (!n.read) {
      setNotifications(prev =>
        prev.map(item => item.id === n.id ? { ...item, read: true } : item)
      );
      try {
        await authFetch('/api/notifications/list', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notificationIds: [n.id] }),
        });
      } catch { /* silent */ }
    }
    if (n.url) window.location.href = n.url;
  };

  const handleMarkAllRead = async () => {
    const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
    if (!unreadIds.length) return;
    setMarkingAll(true);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    try {
      await authFetch('/api/notifications/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationIds: unreadIds }),
      });
    } catch { /* silent */ } finally {
      setMarkingAll(false);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  // Which categories actually appear in the data (for dynamic chip rendering)
  const availableCategories = useMemo<CategoryId[]>(() => {
    const seen = new Set<CategoryId>();
    notifications.forEach(n => seen.add(getCategory(n)));
    // Preserve the canonical order from CATEGORIES
    return (Object.keys(CATEGORIES) as CategoryId[]).filter(c => seen.has(c));
  }, [notifications]);

  // Final filtered list — tab + category
  const filteredNotifications = useMemo(() => {
    return notifications.filter(n => {
      if (activeTab === 'unread' && n.read) return false;
      if (activeTab === 'read' && !n.read) return false;
      if (activeCategory && getCategory(n) !== activeCategory) return false;
      return true;
    });
  }, [notifications, activeTab, activeCategory]);

  // Count per category (respecting active tab filter)
  const categoryCount = useMemo<Record<CategoryId, number>>(() => {
    const counts = {} as Record<CategoryId, number>;
    notifications.forEach(n => {
      if (activeTab === 'unread' && n.read) return;
      if (activeTab === 'read' && !n.read) return;
      const cat = getCategory(n);
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [notifications, activeTab]);

  return (
    <PageLayout title="Thông báo">
      <div className={styles.pageContainer}>
        {/* ── Tabs bar ──────────────────────────────────── */}
        <div className={styles.tabBar}>
          <div className={styles.tabs}>
            {TABS.map(tab => (
              <button
                key={tab.id}
                className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`}
                onClick={() => {
                  setActiveTab(tab.id);
                  setActiveCategory(null); // reset category when switching tab
                }}
              >
                {tab.label}
                {tab.id === 'unread' && unreadCount > 0 && (
                  <span className={styles.tabBadge}>{unreadCount > 99 ? '99+' : unreadCount}</span>
                )}
              </button>
            ))}
          </div>

          {activeTab !== 'settings' && unreadCount > 0 && (
            <button
              className={styles.markAllBtn}
              onClick={handleMarkAllRead}
              disabled={markingAll}
            >
              <Icon.Check size={14} />
              Đánh dấu tất cả đã đọc
            </button>
          )}
        </div>

        {/* ── Category chips (only when list tabs are active) ── */}
        {activeTab !== 'settings' && !loading && availableCategories.length > 1 && (
          <div className={styles.categoryBar}>
            <button
              className={`${styles.categoryChip} ${activeCategory === null ? styles.categoryChipActive : ''}`}
              onClick={() => setActiveCategory(null)}
            >
              Tất cả loại
              <span className={styles.chipCount}>
                {activeTab === 'unread' ? unreadCount
                 : activeTab === 'read' ? notifications.filter(n => n.read).length
                 : notifications.length}
              </span>
            </button>

            {availableCategories.map(catId => {
              const cat = CATEGORIES[catId];
              const count = categoryCount[catId] || 0;
              if (!count) return null;
              return (
                <button
                  key={catId}
                  className={`${styles.categoryChip} ${activeCategory === catId ? styles.categoryChipActive : ''}`}
                  style={activeCategory === catId
                    ? { '--chip-color': cat.color, '--chip-bg': cat.bg } as React.CSSProperties
                    : undefined}
                  onClick={() => setActiveCategory(prev => prev === catId ? null : catId)}
                >
                  <span className={styles.chipIcon} style={{ color: cat.color }}>{cat.icon}</span>
                  {cat.label}
                  <span className={styles.chipCount}>{count}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* ── Notification list panel ────────────────────── */}
        {activeTab !== 'settings' && (
          <div className={styles.listPanel}>
            {loading ? (
              <div className={styles.loadingState}>
                {[...Array(5)].map((_, i) => (
                  <div key={i} className={styles.skeletonItem}>
                    <div className={styles.skeletonIcon} />
                    <div className={styles.skeletonContent}>
                      <div className={styles.skeletonTitle} />
                      <div className={styles.skeletonBody} />
                      <div className={styles.skeletonTime} />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>
                  <Icon.Bell size={28} />
                </div>
                <p className={styles.emptyTitle}>
                  {activeCategory
                    ? `Không có thông báo "${CATEGORIES[activeCategory].label}"`
                    : activeTab === 'unread' ? 'Không có thông báo chưa đọc'
                    : activeTab === 'read'   ? 'Không có thông báo đã đọc'
                    :                          'Không có thông báo nào'}
                </p>
                <p className={styles.emptyDesc}>
                  {activeCategory
                    ? 'Thử chọn danh mục khác.'
                    : activeTab === 'unread'
                      ? 'Bạn đã đọc tất cả thông báo rồi!'
                      : 'Thông báo mới sẽ xuất hiện ở đây.'}
                </p>
              </div>
            ) : (
              <div className={styles.notificationList}>
                {filteredNotifications.map(n => {
                  const cat = CATEGORIES[getCategory(n)];
                  return (
                    <div
                      key={n.id}
                      className={`${styles.notificationItem} ${!n.read ? styles.unread : ''}`}
                      onClick={() => handleNotificationClick(n)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={e => e.key === 'Enter' && handleNotificationClick(n)}
                    >
                      {/* Category icon */}
                      <div
                        className={styles.notifIconWrapper}
                        style={{ background: cat.bg, color: cat.color }}
                      >
                        {cat.icon}
                      </div>

                      <div className={styles.notifContent}>
                        <div className={styles.notifHeader}>
                          <div className={styles.notifTitleRow}>
                            <h4 className={styles.notifTitle}>{n.title}</h4>
                            {/* Category badge */}
                            <span
                              className={styles.categoryLabel}
                              style={{ color: cat.color, background: cat.bg }}
                            >
                              {cat.label}
                            </span>
                          </div>
                          <span className={styles.notifTime}>{formatTimestamp(n.created_at)}</span>
                        </div>
                        <p className={styles.notifBody}>{n.body}</p>
                        {n.url && (
                          <span className={styles.notifLink}>
                            <Icon.ChevronRight size={11} /> Xem chi tiết
                          </span>
                        )}
                      </div>

                      {!n.read && <div className={styles.unreadDot} />}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Settings panel ─────────────────────────────── */}
        {activeTab === 'settings' && (
          <div className={styles.settingsPanel}>
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
        )}
      </div>
    </PageLayout>
  );
}
