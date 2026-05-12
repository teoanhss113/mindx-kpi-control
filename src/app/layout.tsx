import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/AuthContext';
import { PermissionsProvider } from '@/lib/PermissionsContext';
import { ActivityTracker } from '@/components/ActivityTracker';

export const metadata: Metadata = {
  title: 'MindX KPI Control — Tổng quan Quản trị',
  description: 'Hệ thống theo dõi Tỷ lệ Hoàn thành và Hiệu suất Lớp học — MindX Education. Thiết kế lấy cảm hứng từ Linear với Inter Variable và OpenType features.',
  icons: {
    icon: '/logo/logo.svg',
    apple: '/logo/logo.svg',
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
  },
  themeColor: '#5e6ad2',  // Linear Indigo
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <head>
        <link rel="icon" type="image/svg+xml" href="/logo/logo.svg" />
        <meta name="color-scheme" content="light" />
      </head>
      <body>
        <AuthProvider>
          <PermissionsProvider>
            <ActivityTracker />
            {children}
          </PermissionsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
