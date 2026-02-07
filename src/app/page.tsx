'use client';

import { AuthenticatedPage } from '@/components/AuthenticatedPage';
import { UserLayout } from '@/components/UserLayout';

export default function UserHomePage() {
  return (
    <AuthenticatedPage>
      <UserLayout title="Trang chủ" activePage="home">
        {/* Empty home page */}
      </UserLayout>
    </AuthenticatedPage>
  );
}
