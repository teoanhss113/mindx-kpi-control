'use client';

import { ReactNode, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { initials } from '@/components/ui';
import styles from '@/app/dashboard.module.css';

interface UserLayoutProps {
  children: ReactNode;
  title: string;
  activePage?: 'home' | 'my-schedule' | 'available-shifts' | 'my-profile';
  sidebarOpen?: boolean;
  onSidebarToggle?: (open: boolean) => void;
}

export function UserLayout({ 
  children, 
  title, 
  activePage = 'home',
  sidebarOpen = false, 
  onSidebarToggle 
}: UserLayoutProps) {
  const { session, logout } = useAuth();
  const router = useRouter();
  const [internalSidebarOpen, setInternalSidebarOpen] = useState(false);

  // User display
  const _displayName = session?.displayName?.trim() || '';
  const _email = session?.email || '';
  
  const userAvatar = _displayName ? initials(_displayName) : _email.charAt(0).toUpperCase();
  const userName = _displayName || _email.split('@')[0];
  const userEmail = _email;

  // Handle sidebar toggle
  const handleSidebarToggle = onSidebarToggle || setInternalSidebarOpen;
  const isSidebarOpen = sidebarOpen || internalSidebarOpen;

  return (
    <div className={styles.page}>
      {/* Sidebar overlay for mobile */}
      {isSidebarOpen && (
        <div 
          className={styles.sidebarOverlay} 
          onClick={() => handleSidebarToggle(false)} 
          aria-hidden 
        />
      )}

      {/* Sidebar */}
      <aside className={`${styles.sidebar} ${isSidebarOpen ? styles.sidebarMobileOpen : ''}`}>
        <div className={styles.sidebarLogo}>
          <img src="/logo/logo.svg" alt="MindX" style={{ height: 26, objectFit: 'contain' }} />
        </div>

        <nav className={styles.sidebarMenu}>
          {/* Home */}
          <div 
            className={`${styles.sidebarLink} ${activePage === 'home' ? styles.active : ''}`}
            onClick={() => { router.push('/'); handleSidebarToggle(false); }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            Trang chủ
          </div>

          {/* My Schedule */}
          <div 
            className={`${styles.sidebarLink} ${activePage === 'my-schedule' ? styles.active : ''}`}
            onClick={() => { router.push('/my-schedule'); handleSidebarToggle(false); }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            Lịch dạy
          </div>

          {/* Available Shifts */}
          <div 
            className={`${styles.sidebarLink} ${activePage === 'available-shifts' ? styles.active : ''}`}
            onClick={() => { router.push('/available-shifts'); handleSidebarToggle(false); }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            Ca trực khả dụng
          </div>

          <div className={styles.sidebarDivider} />

          {/* My Profile - External link */}
          <a 
            href="https://www.tpsmindx.com/user/thong-tin-giao-vien"
            target="_blank"
            rel="noopener noreferrer"
            className={`${styles.sidebarLink} ${activePage === 'my-profile' ? styles.active : ''}`}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            Thông tin cá nhân
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: 'auto', opacity: 0.5 }}>
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>
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
            onClick={() => handleSidebarToggle(!isSidebarOpen)}
            aria-label="Mở menu"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <div className={styles.headerLeft}>
            <h1 className={styles.pageTitle}>{title}</h1>
          </div>
          <div className={styles.headerRight} />
        </header>

        {/* Main content */}
        <main className={styles.main}>
          {children}
        </main>
      </div>
    </div>
  );
}
/* Improved responsive design */

/* Improved responsive design */
