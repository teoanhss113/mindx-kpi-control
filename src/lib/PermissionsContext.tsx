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
  canView: (pageKey: string) => boolean;
  canEdit: (pageKey: string) => boolean;
  reload: () => Promise<void>;
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);

// How often to silently re-fetch permissions in the background (30 minutes).
// This keeps the in-memory cache fresh without forcing a full re-login.
const REFRESH_INTERVAL_MS = 30 * 60 * 1000;

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [permissions, setPermissions] = useState<PagePermission[]>([]);
  const [loading, setLoading] = useState(true);
  // Keep a ref so loadPermissions can always see the current session
  const sessionRef = useRef(session);
  sessionRef.current = session;

  // Initial load + reload whenever the logged-in user changes
  useEffect(() => {
    if (!session?.uid) {
      setPermissions([]);
      setLoading(false);
      return;
    }
    loadPermissions();
  }, [session?.uid]);

  // Periodic background refresh so stale permissions don't silently gate pages
  useEffect(() => {
    if (!session?.uid) return;
    const interval = setInterval(() => {
      loadPermissions(/* silent = */ true);
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [session?.uid]);

  async function loadPermissions(silent = false) {
    const currentSession = sessionRef.current;
    if (!currentSession?.uid) {
      setPermissions([]);
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
        console.error('[PermissionsContext] Failed to load permissions:', res.status);
        if (!silent) {
          setPermissions([]);
          setLoading(false);
        }
        return;
      }

      const json = await res.json();
      const profile = json?.data?.profile;
      if (!profile?.is_active || !profile?.role_id) {
        setPermissions([]);
        setLoading(false);
        return;
      }

      const rolePermissions = profile?.roles?.role_permissions || [];
      const perms: PagePermission[] = rolePermissions
        .filter((rp: any) => rp?.pages)
        .map((rp: any) => ({
          page_key: rp.pages.key,
          page_name: rp.pages.page_name,
          can_view: rp.can_view,
          can_edit: rp.can_edit,
        }));

      setPermissions(perms);
      setLoading(false);
    } catch (error) {
      console.error('[PermissionsContext] Error loading permissions:', error);
      if (!silent) {
        setPermissions([]);
        setLoading(false);
      }
    }
  }

  function canView(pageKey: string): boolean {
    if (loading) return false;
    return permissions.some(p => p.page_key === pageKey && p.can_view);
  }

  function canEdit(pageKey: string): boolean {
    if (loading) return false;
    return permissions.some(p => p.page_key === pageKey && p.can_view && p.can_edit);
  }

  return (
    <PermissionsContext.Provider value={{
      permissions,
      loading,
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
