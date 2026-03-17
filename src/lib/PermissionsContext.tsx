'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase/client';

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
    if (!session?.email) {
      setPermissions([]);
      setLoading(false);
      return;
    }

    loadPermissions();
  }, [session?.email]);

  async function loadPermissions() {
    if (!session?.email) {
      setPermissions([]);
      setLoading(false);
      return;
    }

    try {
      // Get user profile by EMAIL
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role_id, is_active')
        .eq('email', session.email)
        .single();

      if (profileError || !profile || !profile.is_active || !profile.role_id) {
        setPermissions([]);
        setLoading(false);
        return;
      }

      // Get role permissions with page details
      const { data: rolePermissions, error: permissionsError } = await supabase
        .from('role_permissions')
        .select(`
          can_view,
          can_edit,
          pages (
            key,
            page_name
          )
        `)
        .eq('role_id', profile.role_id);

      if (permissionsError) {
        console.error('[PermissionsContext] Error loading permissions:', permissionsError);
        setPermissions([]);
        setLoading(false);
        return;
      }

      // Transform to flat structure
      const perms: PagePermission[] = (rolePermissions || []).map((rp: any) => ({
        page_key: rp.pages.key,
        page_name: rp.pages.page_name,
        can_view: rp.can_view,
        can_edit: rp.can_edit,
      }));

      setPermissions(perms);
      setLoading(false);
    } catch (error) {
      console.error('[PermissionsContext] Error loading permissions:', error);
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
      reload: loadPermissions 
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
// Improved context handling

// Improved context
