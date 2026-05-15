'use client';

import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { authFetch } from '@/lib/auth/clientAuth';

interface PagePermission {
  page_key: string;
  page_name: string;
  can_view: boolean;
  can_edit: boolean;
}

interface PermissionsContextType {
  permissions: PagePermission[];
  loading: boolean;
  isAdmin: boolean;
  canView: (pageKey: string) => boolean;
  canEdit: (pageKey: string) => boolean;
  reload: () => Promise<void>;
}

interface RolePermissionRow {
  can_view: boolean;
  can_edit: boolean;
  pages?: {
    key?: string;
    page_name?: string;
  } | null;
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);

// How often to silently re-fetch permissions in the background (30 minutes).
// This keeps the in-memory cache fresh without forcing a full re-login.
const REFRESH_INTERVAL_MS = 30 * 60 * 1000;

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const { session, isLoading: authLoading } = useAuth();
  const [permissions, setPermissions] = useState<PagePermission[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  // Keep a ref so loadPermissions can always see the current session
  const sessionRef = useRef(session);
  sessionRef.current = session;

  // Initial load + reload whenever the logged-in user changes.
  // Wait for AuthContext to finish before acting — otherwise we'd set
  // loading=false with empty permissions while the token is still being restored.
  useEffect(() => {
    if (authLoading) return;
    if (!session?.uid) {
      const timer = window.setTimeout(() => {
        setPermissions([]);
        setIsAdmin(false);
        setLoading(false);
      }, 0);
      return () => window.clearTimeout(timer);
    }
    const timer = window.setTimeout(() => {
      loadPermissions();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [session?.uid, authLoading]);

  // Periodic background refresh so stale permissions don't silently gate pages
  useEffect(() => {
    if (authLoading || !session?.uid) return;
    const interval = setInterval(() => {
      loadPermissions(/* silent = */ true);
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [session?.uid, authLoading]);

  async function loadPermissions(silent = false) {
    const currentSession = sessionRef.current;
    if (!currentSession?.uid) {
      setPermissions([]);
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    // Don't show the spinner on background refreshes
    if (!silent) setLoading(true);

    try {
      const res = await authFetch(
        `/api/auth/sync-user?uid=${encodeURIComponent(currentSession.uid)}`,
      );

      if (!res.ok) {
        // 404 = user has no internal profile (normal teacher) — expected, not an error
        if (res.status !== 404) {
          console.error('[PermissionsContext] Failed to load permissions:', res.status);
        }
        if (!silent) {
          setPermissions([]);
          setIsAdmin(false);
          setLoading(false);
        }
        return;
      }

      const json = await res.json();
      const profile = json?.data?.profile;
      if (!profile?.is_active || !profile?.role_id) {
        setPermissions([]);
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      const adminRole = String(profile?.roles?.name || '').toLowerCase() === 'admin';
      const rolePermissions = (profile?.roles?.role_permissions || []) as RolePermissionRow[];
      const perms: PagePermission[] = rolePermissions
        .filter((rp) => rp?.pages)
        .map((rp) => ({
          page_key: rp.pages?.key || '',
          page_name: rp.pages?.page_name || '',
          can_view: rp.can_view,
          can_edit: rp.can_edit,
        }))
        .filter((permission) => Boolean(permission.page_key));

      setPermissions(perms);
      setIsAdmin(adminRole);
      setLoading(false);
    } catch (error) {
      console.error('[PermissionsContext] Error loading permissions:', error);
      if (!silent) {
        setPermissions([]);
        setIsAdmin(false);
        setLoading(false);
      }
    }
  }

  function canView(pageKey: string): boolean {
    if (loading) return false;
    if (isAdmin) return true;
    return permissions.some(p => p.page_key === pageKey && p.can_view);
  }

  function canEdit(pageKey: string): boolean {
    if (loading) return false;
    if (isAdmin) return true;
    return permissions.some(p => p.page_key === pageKey && p.can_view && p.can_edit);
  }

  return (
    <PermissionsContext.Provider value={{
      permissions,
      loading,
      isAdmin,
      canView,
      canEdit,
      reload: loadPermissions,
    }}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissionsContext() {
  const context = useContext(PermissionsContext);
  if (context === undefined) {
    throw new Error('usePermissionsContext must be used within PermissionsProvider');
  }
  return context;
}
