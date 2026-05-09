/**
 * Centralized navigation configuration
 * Single source of truth for all sidebar navigation items
 */

import { Icon } from '@/components/ui';

export type PageKey = 'dashboard' | 'completion' | 'teacher-change' | 'tickets' | 'office-hours' | 'teacher-schedule' | 'resale';

export interface NavConfig {
  label: string;
  icon: React.ReactNode;
  route: string;
  disabled?: boolean;
}

/**
 * Navigation items configuration
 * Order matters - this is the display order in sidebar
 */
export const NAV_ITEMS: Record<PageKey, NavConfig> = {
  'dashboard': {
    label: 'Tổng quan',
    icon: <Icon.BarChart />,
    route: '/',
  },
  'completion': {
    label: 'Tỷ lệ Hoàn thành',
    icon: <Icon.Table />,
    route: '/completion-rate',
  },
  'teacher-change': {
    label: 'Thay đổi Giáo viên',
    icon: <Icon.People />,
    route: '/teacher-change',
  },
  'tickets': {
    label: 'Phiếu Đánh giá',
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>,
    route: '/tickets',
  },
  'office-hours': {
    label: 'Ca Trải nghiệm',
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>,
    route: '/office-hours',
  },
  'teacher-schedule': {
    label: 'Quản lý lớp học',
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01" />
    </svg>,
    route: '/teacher-schedule',
  },
  'resale': {
    label: 'Tái phí',
    icon: <Icon.PieChart />,
    route: '/resale',
    disabled: true,
  },
};

/**
 * Get navigation items for a specific page
 * @param activePage - The current page key
 * @returns Array of navigation items with active state set
 */
export function getNavItems(activePage: PageKey) {
  return Object.entries(NAV_ITEMS).map(([key, config]) => ({
    label: config.label,
    icon: config.icon,
    active: key === activePage,
    disabled: config.disabled,
    onClick: config.disabled ? undefined : () => {
      // Navigation is handled by Next.js router in the component
      // This is just a placeholder - actual navigation happens in PageLayout
      if (typeof window !== 'undefined') {
        window.location.href = config.route;
      }
    },
  }));
}

/**
 * Get navigation items with router for use in components
 * @param activePage - The current page key
 * @param router - Next.js router instance
 * @param allowedPages - Deprecated parameter (no longer used for filtering)
 * @returns Array of navigation items with router navigation
 */
export function getNavItemsWithRouter(
  activePage: PageKey, 
  router: any,
  allowedPages?: PageKey[]
) {
  // Simplified - no permission filtering, show all pages except disabled
  return Object.entries(NAV_ITEMS)
    .filter(([key, config]) => !config.disabled)
    .map(([key, config]) => ({
      label: config.label,
      icon: config.icon,
      active: key === activePage,
      disabled: config.disabled,
      onClick: config.disabled ? undefined : () => router.push(config.route),
    }));
}

// Enhanced navigation styles
/* Enhanced navigation styles */
/* Enhanced navigation styles */

/* Enhanced styles */
