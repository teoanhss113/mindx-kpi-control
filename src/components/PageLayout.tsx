'use client';

import { ReactNode, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { usePermissionsContext } from '@/lib/PermissionsContext';
import { initials, Icon } from '@/components/ui';
import { NotificationBell } from '@/components/NotificationBell';
import { NotificationPrompt } from '@/components/NotificationPrompt';
import styles from '@/app/dashboard.module.css';

interface PageLayoutProps {
  children: ReactNode;
  title: string;
  activePage?: 'dashboard' | 'operations' | 'completion' | 'teacher-change' | 'tickets' | 'office-hours' | 'teachers' | 'final-sessions' | 'admin' | 'admin-users' | 'admin-regions' | 'admin-roles' | 'admin-usage-analytics';
  sidebarOpen?: boolean;
  onSidebarToggle?: (open: boolean) => void;
}

export function PageLayout({ children, title, activePage, sidebarOpen = false, onSidebarToggle }: PageLayoutProps) {
  const { session, logout } = useAuth();
  const { canView, loading: permissionsLoading } = usePermissionsContext();
  const router = useRouter();
  const [adminSubmenuOpen, setAdminSubmenuOpen] = useState(
    activePage === 'admin' || activePage === 'admin-users' || activePage === 'admin-regions' || activePage === 'admin-roles' || activePage === 'admin-usage-analytics'
  );
  // Internal sidebar state — used when no external controller is wired up (e.g. dashboard)
  const [internalSidebarOpen, setInternalSidebarOpen] = useState(false);
  const isControlled = onSidebarToggle !== undefined;
  const effectiveSidebarOpen = isControlled ? sidebarOpen : internalSidebarOpen;
  const handleSidebarToggle = useCallback((open: boolean) => {
    if (isControlled) onSidebarToggle!(open);
    else setInternalSidebarOpen(open);
  }, [isControlled, onSidebarToggle]);

  // User display - use session from AuthContext (always fresh)
  const _displayName = session?.displayName?.trim() || '';
  const _email = session?.email || '';

  const userAvatar = _displayName ? initials(_displayName) : _email.charAt(0).toUpperCase();
  const userName = _displayName || _email.split('@')[0];
  const userEmail = _email;

  // Check if any admin page is active
  const isAdminActive = activePage === 'admin' || activePage === 'admin-users' || activePage === 'admin-regions' || activePage === 'admin-roles' || activePage === 'admin-usage-analytics';

  // Check if user has access to any admin page
  const hasAdminAccess = canView('admin-users') || canView('admin-regions') || canView('admin-roles') || canView('admin-usage-analytics');

  return (
    <div className={styles.page}>
      <NotificationPrompt />
      {/* Sidebar overlay for mobile */}
      {effectiveSidebarOpen && (
        <div className={styles.sidebarOverlay} onClick={() => handleSidebarToggle(false)} aria-hidden />
      )}

      {/* Sidebar */}
      <aside className={`${styles.sidebar} ${effectiveSidebarOpen ? styles.sidebarMobileOpen : ''}`}>
        <div className={styles.sidebarLogo}>
          <img src="/logo/logo.svg" alt="MindX" style={{ height: 26, objectFit: 'contain' }} />
        </div>
        <nav className={styles.sidebarMenu}>
          {/* Loading state - show spinner while loading permissions */}
          {permissionsLoading && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 'var(--space-6)',
              gap: 'var(--space-3)'
            }}>
              <div style={{
                width: 24,
                height: 24,
                border: '2px solid var(--border-primary)',
                borderTopColor: 'var(--brand-indigo)',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite'
              }} />
              <p style={{
                fontSize: 12,
                color: 'var(--text-tertiary)',
                margin: 0
              }}>
                Đang tải menu...
              </p>
            </div>
          )}

          {/* Menu items - only show after permissions loaded */}
          {!permissionsLoading && canView('dashboard') && (
            <div 
              className={`${styles.sidebarLink} ${activePage === 'dashboard' ? styles.active : ''}`}
              onClick={() => { router.push('/admin/dashboard'); handleSidebarToggle(false); }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
              Tổng quan
            </div>
          )}
          {!permissionsLoading && canView('teacher-schedule') && (
            <div 
              className={`${styles.sidebarLink} ${activePage === 'operations' ? styles.active : ''}`}
              onClick={() => { router.push('/admin/operations'); handleSidebarToggle(false); }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
                <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01" />
              </svg>
              Quản lý Vận hành
            </div>
          )}
          {!permissionsLoading && canView('completion') && (
            <div 
              className={`${styles.sidebarLink} ${activePage === 'completion' ? styles.active : ''}`}
              onClick={() => { router.push('/admin/completion-rate'); handleSidebarToggle(false); }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="3" y1="9" x2="21" y2="9" />
                <line x1="9" y1="21" x2="9" y2="9" />
              </svg>
              Tỷ lệ Hoàn thành
            </div>
          )}
          {!permissionsLoading && canView('teacher-change') && (
            <div 
              className={`${styles.sidebarLink} ${activePage === 'teacher-change' ? styles.active : ''}`}
              onClick={() => { router.push('/admin/teacher-change'); handleSidebarToggle(false); }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              Thay đổi Giáo viên
            </div>
          )}
          {!permissionsLoading && canView('tickets') && (
            <div 
              className={`${styles.sidebarLink} ${activePage === 'tickets' ? styles.active : ''}`}
              onClick={() => { router.push('/admin/tickets'); handleSidebarToggle(false); }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              Phiếu Đánh giá
            </div>
          )}
          {!permissionsLoading && canView('office-hours') && (
            <div 
              className={`${styles.sidebarLink} ${activePage === 'office-hours' ? styles.active : ''}`}
              onClick={() => { router.push('/admin/office-hours'); handleSidebarToggle(false); }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              Ca Trải nghiệm
            </div>
          )}
          {!permissionsLoading && canView('final-sessions') && (
            <div
              className={`${styles.sidebarLink} ${activePage === 'final-sessions' ? styles.active : ''}`}
              onClick={() => { router.push('/admin/final-sessions'); handleSidebarToggle(false); }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
              Giám khảo Cuối khoá
            </div>
          )}
          {!permissionsLoading && canView('teachers') && (
            <div 
              className={`${styles.sidebarLink} ${activePage === 'teachers' ? styles.active : ''}`}
              onClick={() => { router.push('/admin/teachers'); handleSidebarToggle(false); }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              Quản lý Giáo viên
            </div>
          )}

          {/* Admin section - only show if user has access to any admin page */}
          {!permissionsLoading && hasAdminAccess && (
            <>
              <div className={styles.sidebarDivider} />
              
              {/* Admin parent menu item */}
              <div 
                className={`${styles.sidebarLink} ${isAdminActive ? styles.active : ''}`}
                onClick={() => setAdminSubmenuOpen(!adminSubmenuOpen)}
                style={{ cursor: 'pointer' }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <polyline points="9 12 10.5 13.5 15 9" />
                </svg>
                Quản trị Hệ thống
                <svg 
                  width="12" 
                  height="12" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2"
                  style={{ 
                    marginLeft: 'auto',
                    transform: adminSubmenuOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s ease'
                  }}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>

              {/* Admin submenu */}
              {adminSubmenuOpen && (
                <div className={styles.adminSubmenu}>
                  {canView('admin-users') && (
                    <div 
                      className={`${styles.sidebarSubmenuLink} ${activePage === 'admin-users' ? styles.active : ''}`}
                      onClick={() => { router.push('/admin/users'); handleSidebarToggle(false); }}
                    >
                      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M13 14v-1.5a3 3 0 0 0-3-3H6a3 3 0 0 0-3 3V14M8 7a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Tài khoản
                    </div>
                  )}
                  {canView('admin-regions') && (
                    <div 
                      className={`${styles.sidebarSubmenuLink} ${activePage === 'admin-regions' ? styles.active : ''}`}
                      onClick={() => { router.push('/admin/regions'); handleSidebarToggle(false); }}
                    >
                      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M2 14h12M3 14V6l3-3 3 3v8M6 9h2v2H6zM10 14V8l2-2 2 2v6M11 11h2v2h-2z" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Khu vực
                    </div>
                  )}
                  {canView('admin-roles') && (
                    <div 
                      className={`${styles.sidebarSubmenuLink} ${activePage === 'admin-roles' ? styles.active : ''}`}
                      onClick={() => { router.push('/admin/roles'); handleSidebarToggle(false); }}
                    >
                      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M8 1l2 4h4l-3 3 1 4-4-2-4 2 1-4-3-3h4l2-4z" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Vai trò
                    </div>
                  )}
                  {(canView('admin-usage-analytics') || canView('admin-users')) && (
                    <div
                      className={`${styles.sidebarSubmenuLink} ${activePage === 'admin-usage-analytics' ? styles.active : ''}`}
                      onClick={() => { router.push('/admin/usage-analytics'); handleSidebarToggle(false); }}
                    >
                      <Icon.BarChart size={13} />
                      Phân tích sử dụng
                    </div>
                  )}
                </div>
              )}
            </>
          )}
          {/* Unified Context Switcher (placed at bottom via margin-top: auto) */}
          <div 
            className={styles.contextSwitcher}
            onClick={() => { router.push('/'); handleSidebarToggle(false); }}
          >
            <Icon.Repeat size={14} color="var(--brand-indigo)" />
            Trang Giáo viên
          </div>
        </nav>

        {/* User block */}
        <div className={styles.sidebarUser}>
          <div className={styles.sidebarUserAvatar}>{userAvatar || '?'}</div>
          <div className={styles.sidebarUserInfo}>
            <div className={styles.sidebarUserName}>{userName || userEmail || '—'}</div>
            {userName && userEmail && (
              <div className={styles.sidebarUserEmail}>{userEmail}</div>
            )}
            <button className={styles.sidebarLogout} onClick={logout}>Đăng xuất</button>
          </div>
        </div>
      </aside>

      {/* Main wrapper */}
      <div className={styles.mainWrapper}>
        {/* Header */}
        <header className={styles.header}>
          <button
            className={styles.hamburger}
            onClick={() => handleSidebarToggle(!effectiveSidebarOpen)}
            aria-label="Mở menu"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          {/* Mobile: show logo (sidebar is hidden) */}
          <div className={styles.headerMobileLogo}>
            <img src="/logo/logo.svg" alt="MindX" style={{ height: 22, objectFit: 'contain' }} />
          </div>
          {/* Desktop: show page title */}
          <div className={styles.headerLeft}>
            <h1 className={styles.pageTitle}>{title}</h1>
          </div>
          <div className={styles.headerRight}>
            <NotificationBell />
          </div>
        </header>

        {/* Main content */}
        <main className={styles.main}>
          {children}
        </main>
      </div>
    </div>
  );
}

// Refactored layout structure
/* Refactored layout structure */
/* Refactored layout structure */
/* Updated navigation UI */
/* Improved transitions */
// Optimized re-renders

/* Refactored layout structure */

/* Updated navigation */

// Optimized renders
// Optimized component re-renders
