/**
 * usePermissions Hook
 * React hook to check user permissions in components
 */

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase/client';
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
    if (!session?.email) {
      setPermissions(null);
      setLoading(false);
      return;
    }

    loadPermissions();
  }, [session?.email]);

  async function loadPermissions() {
    if (!session?.email) return;

    setLoading(true);
    setError(null);

    try {
      // 1. Get user profile by EMAIL to get role_id
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role_id, is_active')
        .eq('email', session.email)
        .single();

      if (profileError) throw profileError;
      
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

      // 2. Get role permissions with page details
      const { data: rolePermissions, error: permissionsError } = await supabase
        .from('role_permissions')
        .select(`
          *,
          pages (*)
        `)
        .eq('role_id', profile.role_id);

      if (permissionsError) throw permissionsError;

      setPermissions({
        rolePermissions: rolePermissions as any,
      });
    } catch (err: any) {
      console.error('Failed to load permissions:', err);
      setError(err.message);
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
