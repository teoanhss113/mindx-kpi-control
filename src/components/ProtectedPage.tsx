'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase/client';

interface ProtectedPageProps {
  children: React.ReactNode;
  pageKey: string;
  requireEdit?: boolean;
}

export function ProtectedPage({ children, pageKey, requireEdit = false }: ProtectedPageProps) {
  const { session, logout } = useAuth();
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    checkAccess();
  }, [session?.email, pageKey]);

  async function checkAccess() {
    if (!session?.email) {
      router.replace('/login');
      return;
    }

    try {
      // Get user profile by EMAIL (not UID)
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role_id, is_active')
        .eq('email', session.email)
        .single();

      if (profileError || !profile) {
        console.log('[ProtectedPage] No profile found for email:', session.email);
        // No profile = regular user, redirect to user view
        router.replace('/');
        return;
      }

      if (!profile.is_active) {
        console.log('[ProtectedPage] User account is inactive');
        setHasAccess(false);
        setChecking(false);
        return;
      }

      if (!profile.role_id) {
        console.log('[ProtectedPage] No role assigned to user');
        // No role = regular user, redirect to user view
        router.replace('/');
        return;
      }

      // Get role permissions for this page
      const { data: permissions, error: permissionsError } = await supabase
        .from('role_permissions')
        .select(`
          can_view,
          can_edit,
          pages!inner (key)
        `)
        .eq('role_id', profile.role_id)
        .eq('pages.key', pageKey)
        .single();

      if (permissionsError || !permissions) {
        console.log('[ProtectedPage] No permission for page:', pageKey);
        setHasAccess(false);
        setChecking(false);
        return;
      }

      // Check if user has required permission
      const canView = permissions.can_view;
      const canEdit = permissions.can_edit;

      if (requireEdit) {
        setHasAccess(canView && canEdit);
      } else {
        setHasAccess(canView);
      }

      setChecking(false);
    } catch (error) {
      console.error('[ProtectedPage] Error checking access:', error);
      setHasAccess(false);
      setChecking(false);
    }
  }

  // Show loading while checking
  if (checking) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '50vh',
        flexDirection: 'column',
        gap: 'var(--space-3)'
      }}>
        <div style={{
          width: 32,
          height: 32,
          border: '3px solid var(--border-primary)',
          borderTopColor: 'var(--brand-indigo)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }} />
        <p style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>
          Đang kiểm tra quyền truy cập...
        </p>
      </div>
    );
  }

  // Show access denied if no permission
  if (!hasAccess) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh',
        flexDirection: 'column',
        gap: 'var(--space-4)',
        padding: 'var(--space-6)',
        background: 'var(--bg-marketing)'
      }}>
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="10" stroke="#dc2626" />
          <line x1="15" y1="9" x2="9" y2="15" stroke="#dc2626" />
          <line x1="9" y1="9" x2="15" y2="15" stroke="#dc2626" />
        </svg>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ 
            margin: 0, 
            marginBottom: 'var(--space-2)', 
            fontSize: 20, 
            fontWeight: 590,
            color: 'var(--text-primary)'
          }}>
            Không có quyền truy cập
          </h2>
          <p style={{ 
            margin: 0, 
            fontSize: 14, 
            color: 'var(--text-secondary)',
            maxWidth: 400,
            lineHeight: 1.6
          }}>
            Tài khoản của bạn chưa được cấp quyền truy cập trang này.
            <br />
            Vui lòng liên hệ quản trị viên để được phân quyền.
          </p>
        </div>
        <button
          onClick={() => {
            logout();
          }}
          style={{
            padding: 'var(--space-3) var(--space-5)',
            background: 'var(--brand-indigo)',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--radius-comfortable)',
            fontSize: 14,
            fontWeight: 510,
            cursor: 'pointer'
          }}
        >
          Đăng xuất
        </button>
      </div>
    );
  }

  // Render children if has access
  return <>{children}</>;
}
