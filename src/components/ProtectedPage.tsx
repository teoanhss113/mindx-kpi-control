'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { authFetch } from '@/lib/auth/clientAuth';

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
  }, [session?.uid, pageKey]);

  async function checkAccess() {
    if (!session?.uid) {
      router.replace('/login');
      return;
    }

    try {
      const res = await authFetch(
        `/api/auth/sync-user?uid=${encodeURIComponent(session.uid)}`,
      );
      if (!res.ok) {
        router.replace('/');
        return;
      }
      const json = await res.json();
      const profile = json?.data?.profile;
      if (!profile) {
        router.replace('/');
        return;
      }
      if (!profile.is_active) {
        setHasAccess(false);
        setChecking(false);
        return;
      }
      if (!profile.role_id) {
        router.replace('/');
        return;
      }

      const rolePermissions: Array<{
        can_view: boolean;
        can_edit: boolean;
        pages?: { key?: string };
      }> = profile?.roles?.role_permissions || [];

      const match = rolePermissions.find(rp => rp?.pages?.key === pageKey);
      if (!match) {
        setHasAccess(false);
        setChecking(false);
        return;
      }

      setHasAccess(requireEdit ? !!(match.can_view && match.can_edit) : !!match.can_view);
      setChecking(false);
    } catch {
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
