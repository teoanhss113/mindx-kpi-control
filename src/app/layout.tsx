import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/AuthContext';
import { PermissionsProvider } from '@/lib/PermissionsContext';
import { ActivityTracker } from '@/components/ActivityTracker';

export const metadata: Metadata = {
  title: 'MindX Teaching Hub HCM1&4',
  description: 'Trung tâm vận hành lớp học, giáo viên và chất lượng đào tạo cho MindX HCM1&4.',
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
