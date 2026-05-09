/**
 * Permissions Service
 * Simplified - returns all pages for authenticated users
 * Temporary implementation before redesigning permission system
 */

import type { PageKey } from '@/lib/navigation';

/**
 * Get allowed pages for current user
 * Simplified - returns all pages for any authenticated user
 * @returns Array of all page keys
 */
export async function getAllowedPages(): Promise<PageKey[]> {
  return [
    'dashboard',
    'completion',
    'teacher-change',
    'tickets',

    'office-hours',
    'teacher-schedule',
    'resale',
  ];
}

/**
 * Check if user has access to a specific page
 * Simplified - always returns true for authenticated users
 * @param pageKey - The page key to check
 * @returns Always true
 */
export async function hasPageAccess(pageKey: PageKey): Promise<boolean> {
  return true;
}
