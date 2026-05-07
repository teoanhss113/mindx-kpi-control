'use client';

import { AuthenticatedPage } from '@/components/AuthenticatedPage';
import { UserLayout } from '@/components/UserLayout';

export default function UserHomePage() {
  return (
    <AuthenticatedPage>
      <UserLayout title="Trang chủ" activePage="home">
        <div style={{ padding: '24px' }}>
          <p>Chào mừng đến với hệ thống quản lý KPI MindX</p>
        </div>
      </UserLayout>
    </AuthenticatedPage>
  );
}
