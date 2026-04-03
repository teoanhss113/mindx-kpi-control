/**
 * useAllowedPages Hook
 * 
 * Simplified - returns all pages immediately for authenticated users
 * Temporary implementation before redesigning permission system
 */

import type { PageKey } from '@/lib/navigation';

export function useAllowedPages() {
  const allPages: PageKey[] = [
    'dashboard',
    'completion',
    'teacher-change',
    'tickets',
    'class-quality',
    'office-hours',
    'teacher-schedule',
    'resale',
  ];
  
  return {
    allowedPages: allPages,
    loading: false,
    hasAccess: (pageKey: PageKey) => true,
  };
}
