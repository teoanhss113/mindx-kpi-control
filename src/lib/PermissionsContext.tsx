'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
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

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [permissions, setPermissions] = useState<PagePermission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.uid) {
      setPermissions([]);
      setLoading(false);
      return;
    }
    loadPermissions();
  }, [session?.uid]);

  async function loadPermissions() {
    if (!session?.uid) {
      setPermissions([]);
      setLoading(false);
      return;
    }

    try {
      const res = await authFetch(
        `/api/auth/sync-user?uid=${encodeURIComponent(session.uid)}`,
      );
      if (!res.ok) {
        setPermissions([]);
        setLoading(false);
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
    } catch {
      setPermissions([]);
      setLoading(false);
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
