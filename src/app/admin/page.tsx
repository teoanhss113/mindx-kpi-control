'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Admin root redirect
 * /admin → /admin/dashboard
 */
export default function AdminPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/admin/dashboard');
  }, [router]);

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      minHeight: '100vh'
    }}>
      <div style={{
        width: 32,
        height: 32,
        border: '3px solid var(--border-primary)',
        borderTopColor: 'var(--brand-indigo)',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite'
      }} />
    </div>
  );
}

// Fixed routing logic
// Fixed routing logic
// Fixed routing logic

// Fixed routing logic
