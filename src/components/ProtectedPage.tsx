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

export function ProtectedPage({ children, pageKey, requireEdit = false }: ProtectedPageProps) {
  const { session, isLoading: authLoading } = useAuth();
  const { loading, canView, canEdit } = usePermissionsContext();
  const router = useRouter();

  const hasAccess = !loading && (requireEdit ? canEdit(pageKey) : canView(pageKey));

  // Redirect to login when not authenticated (preserve current URL as callbackUrl)
  useEffect(() => {
    if (authLoading || session) return;
    const callbackUrl = encodeURIComponent(window.location.pathname + window.location.search);
    router.replace(`/login?callbackUrl=${callbackUrl}`);
  }, [session, authLoading, router]);

  // Redirect to home when authenticated but lacks permission.
  // Guard on session+loading prevents this from firing during logout
  // (which would override the /login redirect above).
  useEffect(() => {
    if (authLoading || !session || loading) return;
    if (!hasAccess) {
      router.replace('/');
    }
  }, [authLoading, session, loading, hasAccess, router]);

  if (authLoading || !session) return null;

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

  if (!hasAccess) return null;

  return <>{children}</>;
}
