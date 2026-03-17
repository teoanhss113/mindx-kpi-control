/**
 * Permission System
 * Helper functions to check user permissions based on roles and pages
 */

import type { RolePermission, Page } from './supabase/types';

export interface UserPermissions {
  rolePermissions: Array<RolePermission & { pages: Page }>;
}

/**
 * Check if user has VIEW permission for a specific page
 * @param userPermissions - User's role permissions
 * @param pagePath - Page path (e.g., '/class-quality', '/teachers')
 * @returns true if user can view the page
 */
export function canViewPage(
  userPermissions: UserPermissions | null,
  pagePath: string
): boolean {
  if (!userPermissions || !userPermissions.rolePermissions) {
    return false;
  }

  const permission = userPermissions.rolePermissions.find(
    (p) => p.pages.key === pagePath || p.pages.key === pagePath.replace('/', '')
  );

  return permission?.can_view ?? false;
}

/**
 * Check if user has EDIT permission for a specific page
 * @param userPermissions - User's role permissions
 * @param pagePath - Page path (e.g., '/class-quality', '/teachers')
 * @returns true if user can edit data on the page
 */
export function canEditPage(
  userPermissions: UserPermissions | null,
  pagePath: string
): boolean {
  if (!userPermissions || !userPermissions.rolePermissions) {
    return false;
  }

  const permission = userPermissions.rolePermissions.find(
    (p) => p.pages.key === pagePath || p.pages.key === pagePath.replace('/', '')
  );

  // Must have both view AND edit permissions
  return (permission?.can_view && permission?.can_edit) ?? false;
}

/**
 * Get all pages user can view
 * @param userPermissions - User's role permissions
 * @returns Array of page keys user can view
 */
export function getAllowedPages(
  userPermissions: UserPermissions | null
): string[] {
  if (!userPermissions || !userPermissions.rolePermissions) {
    return [];
  }

  return userPermissions.rolePermissions
    .filter((p) => p.can_view)
    .map((p) => p.pages.key);
}

/**
 * Get all pages user can edit
 * @param userPermissions - User's role permissions
 * @returns Array of page keys user can edit
 */
export function getEditablePages(
  userPermissions: UserPermissions | null
): string[] {
  if (!userPermissions || !userPermissions.rolePermissions) {
    return [];
  }

  return userPermissions.rolePermissions
    .filter((p) => p.can_view && p.can_edit)
    .map((p) => p.pages.key);
}

/**
 * Check if user is admin (has edit permission on admin pages)
 * @param userPermissions - User's role permissions
 * @returns true if user has admin permissions
 */
export function isAdmin(userPermissions: UserPermissions | null): boolean {
  if (!userPermissions || !userPermissions.rolePermissions) {
    return false;
  }

  // Check if user has edit permission on any admin page
  const adminPages = ['admin-users', 'admin-roles', 'admin-regions'];
  return userPermissions.rolePermissions.some(
    (p) =>
      adminPages.includes(p.pages.key) && p.can_view && p.can_edit
  );
}

/**
 * Permission check result with detailed info
 */
export interface PermissionCheckResult {
  canView: boolean;
  canEdit: boolean;
  reason?: string;
}

/**
 * Comprehensive permission check with detailed result
 * @param userPermissions - User's role permissions
 * @param pagePath - Page path
 * @returns Detailed permission check result
 */
export function checkPagePermissions(
  userPermissions: UserPermissions | null,
  pagePath: string
): PermissionCheckResult {
  if (!userPermissions || !userPermissions.rolePermissions) {
    return {
      canView: false,
      canEdit: false,
      reason: 'No permissions found',
    };
  }

  const permission = userPermissions.rolePermissions.find(
    (p) => p.pages.key === pagePath || p.pages.key === pagePath.replace('/', '')
  );

  if (!permission) {
    return {
      canView: false,
      canEdit: false,
      reason: 'Page not in user permissions',
    };
  }

  return {
    canView: permission.can_view ?? false,
    canEdit: (permission.can_view && permission.can_edit) ?? false,
  };
}

/**
 * Mock function to get current user permissions
 * TODO: Replace with actual implementation that fetches from Supabase
 * @param userId - User ID
 * @returns User permissions
 */
export async function getUserPermissions(
  userId: string
): Promise<UserPermissions | null> {
  // TODO: Implement actual fetch from Supabase
  // This is a placeholder that should be replaced with:
  // 1. Get user's role_id from profiles table
  // 2. Get role_permissions for that role
  // 3. Join with pages table to get page details
  
  console.warn('getUserPermissions not implemented - using mock data');
  return null;
}

// Fixed permission logic
// Fixed permission logic
// Fixed permission check logic

// Fixed permission logic
