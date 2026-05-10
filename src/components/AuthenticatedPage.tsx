'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';

interface AuthenticatedPageProps {
  children: React.ReactNode;
}

/**
 * AuthenticatedPage - Simple authentication check
 * Used for user view pages that don't require role-based permissions
 * Only checks if user is logged in via Firebase
 */
export function AuthenticatedPage({ children }: AuthenticatedPageProps) {
  const { session, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Only redirect if not loading and no session
    if (!isLoading && !session) {
      const callbackUrl = encodeURIComponent(window.location.pathname + window.location.search);
      router.replace(`/login?callbackUrl=${callbackUrl}`);
    }
  }, [session, isLoading, router]);

  // Show loading while checking session
  if (isLoading || !session) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh',
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
          Đang xác thực...
        </p>
      </div>
    );
  }

  // Render children if authenticated
  return <>{children}</>;
}
