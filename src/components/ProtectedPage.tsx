'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { usePermissionsContext } from '@/lib/PermissionsContext';

interface ProtectedPageProps {
  children: React.ReactNode;
  pageKey: string;
  requireEdit?: boolean;
}

/**
 * ProtectedPage
 *
 * Uses the shared PermissionsContext (loaded once per login) instead of
 * making a new API call on every page mount. This eliminates the race
 * conditions and redundant fetches that caused intermittent redirects to /.
 */
export function ProtectedPage({ children, pageKey, requireEdit = false }: ProtectedPageProps) {
  const { session, logout, isLoading: authLoading } = useAuth();
  const { loading, canView, canEdit } = usePermissionsContext();
  const router = useRouter();

  // Only redirect once auth has finished initialising — otherwise a hard reload
  // would redirect to /login before localStorage tokens are restored.
  useEffect(() => {
    if (authLoading) return;
    if (!session) {
      const callbackUrl = encodeURIComponent(window.location.pathname + window.location.search);
      router.replace(`/login?callbackUrl=${callbackUrl}`);
    }
  }, [session, authLoading, router]);

  // Show nothing while auth is still loading (prevents flash of redirect)
  if (authLoading || !session) return null;

  // Show spinner while permissions are being fetched (only on initial login load)
  if (loading) {
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

  const hasAccess = requireEdit ? canEdit(pageKey) : canView(pageKey);

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
          <circle cx="12" cy="12" r="10" stroke="var(--status-error)" />
          <line x1="15" y1="9" x2="9" y2="15" stroke="var(--status-error)" />
          <line x1="9" y1="9" x2="15" y2="15" stroke="var(--status-error)" />
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
          onClick={logout}
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

  return <>{children}</>;
}
