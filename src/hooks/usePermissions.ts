/**
 * usePermissions Hook
 * React hook to check user permissions in components
 */

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { authFetch } from '@/lib/auth/clientAuth';
import type { UserPermissions } from '@/lib/permissions';
import {
  canViewPage,
  canEditPage,
  getAllowedPages,
  getEditablePages,
  isAdmin,
  checkPagePermissions,
} from '@/lib/permissions';

/**
 * Hook to get and check user permissions
 * @returns Permission check functions and user permissions
 */
export function usePermissions() {
  const { session } = useAuth();
  const [permissions, setPermissions] = useState<UserPermissions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.uid) {
      setPermissions(null);
      setLoading(false);
      return;
    }
    loadPermissions();
  }, [session?.uid]);

  async function loadPermissions() {
    if (!session?.uid) return;

    setLoading(true);
    setError(null);

    try {
      const res = await authFetch(
        `/api/auth/sync-user?uid=${encodeURIComponent(session.uid)}`,
      );
      if (!res.ok) {
        setPermissions(null);
        setLoading(false);
        return;
      }
      const json = await res.json();
      const profile = json?.data?.profile;
      if (!profile) {
        setPermissions(null);
        setLoading(false);
        return;
      }
      if (!profile.is_active) {
        setError('User account is inactive');
        setPermissions(null);
        setLoading(false);
        return;
      }
      if (!profile.role_id) {
        setPermissions(null);
        setLoading(false);
        return;
      }

      setPermissions({
        rolePermissions: (profile?.roles?.role_permissions || []) as any,
      });
    } catch (err: any) {
      setError(err?.message || 'Failed to load permissions');
      setPermissions(null);
    } finally {
      setLoading(false);
    }
  }

  return {
    permissions,
    loading,
    error,
    // Helper functions
    canView: (pagePath: string) => canViewPage(permissions, pagePath),
    canEdit: (pagePath: string) => canEditPage(permissions, pagePath),
    getAllowedPages: () => getAllowedPages(permissions),
    getEditablePages: () => getEditablePages(permissions),
    isAdmin: () => isAdmin(permissions),
    checkPermissions: (pagePath: string) => checkPagePermissions(permissions, pagePath),
    // Reload function
    reload: loadPermissions,
  };
}

/**
 * Hook to check permissions for a specific page
 * @param pagePath - Page path to check
 * @returns Permission check result for the page
 */
export function usePagePermissions(pagePath: string) {
  const { permissions, loading, error, canView, canEdit, checkPermissions } = usePermissions();

  return {
    canView: canView(pagePath),
    canEdit: canEdit(pagePath),
    permissions: checkPermissions(pagePath),
    loading,
    error,
  };
}
