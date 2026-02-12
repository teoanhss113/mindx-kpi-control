'use client';

import { ReactNode, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageLayout } from '@/components/PageLayout';
import { useAuth } from '@/lib/AuthContext';
import styles from '@/app/dashboard.module.css';

interface AdminPageWrapperProps {
  children: ReactNode;
  title: string;
  activePage?: 'admin-users' | 'admin-regions' | 'admin-roles';
}

export function AdminPageWrapper({ children, title, activePage = 'admin-users' }: AdminPageWrapperProps) {
  const router = useRouter();
  const { session, isLoading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Admin protection - simplified, no role check, no loading screen
  useEffect(() => {
    if (isLoading) return;
    
    if (!session) {
      router.replace('/');
    }
  }, [session, isLoading, router]);

  // Show UI immediately - no permission checks needed
  return (
    <PageLayout
      title={title}
      activePage={activePage}
      sidebarOpen={sidebarOpen}
      onSidebarToggle={setSidebarOpen}
    >
      {children}
    </PageLayout>
  );
}
