'use client';
 
import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AuthenticatedPage } from '@/components/AuthenticatedPage';
import { UserLayout } from '@/components/UserLayout';
import { usePermissionsContext } from '@/lib/PermissionsContext';
import Link from 'next/link';
import { Icon } from '@/components/ui';

export default function UserHomePage() {
  const router = useRouter();
  const { permissions, loading } = usePermissionsContext();
  const hasAdminAccess = permissions.length > 0;

  // Post-login redirection hook:
  // Automatically push to /admin IF they just finished logging in AND have access.
  useEffect(() => {
    if (!loading && hasAdminAccess) {
      const justLoggedIn = sessionStorage.getItem('mindx_just_logged_in');
      if (justLoggedIn === 'true') {
        // Consume the flag so this ONLY happens once per login event
        sessionStorage.removeItem('mindx_just_logged_in');
        
        console.log('[HomePage] Auto-redirecting Admin to dashboard...');
        router.replace('/admin');
      }
    }
  }, [loading, hasAdminAccess, router]);

  return (
    <AuthenticatedPage>
      <UserLayout title="Trang chủ" activePage="home">
        <div style={{ 
          padding: 'var(--space-6)', 
          maxWidth: 600, 
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-6)'
        }}>
        {/* Empty landing area */}
        </div>
      </UserLayout>
    </AuthenticatedPage>
  );
}
