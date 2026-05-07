// Debug Permissions Page
// Shows current user's permissions for debugging

'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { usePermissionsContext } from '@/lib/PermissionsContext';
import { authFetch } from '@/lib/auth/clientAuth';
import { PageLayout } from '@/components/PageLayout';
import styles from './page.module.css';

export default function DebugPermissionsPage() {
  const { session } = useAuth();
  const { permissions, loading } = usePermissionsContext();
  const [profileData, setProfileData] = useState<any>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    if (session?.uid) {
      loadProfile();
    }
  }, [session?.uid]);

  async function loadProfile() {
    try {
      const res = await authFetch(
        `/api/auth/sync-user?uid=${encodeURIComponent(session!.uid)}`,
      );
      if (res.ok) {
        const json = await res.json();
        setProfileData(json?.data?.profile);
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
    } finally {
      setLoadingProfile(false);
    }
  }

  const pageKeys = [
    { key: 'dashboard', name: 'Tổng quan' },
    { key: 'completion', name: 'Tỷ lệ Hoàn thành' },
    { key: 'teacher-change', name: 'Thay đổi Giáo viên' },
    { key: 'tickets', name: 'Phiếu Đánh giá' },
    { key: 'class-quality', name: 'Chất lượng Lớp học' },
    { key: 'office-hours', name: 'Ca Trải nghiệm' },
    { key: 'teacher-schedule', name: 'Điều phối Giáo viên' },
    { key: 'teachers', name: 'Quản lý Giáo viên' },
    { key: 'admin-users', name: 'Quản lý Tài khoản' },
    { key: 'admin-regions', name: 'Quản lý Khu vực' },
    { key: 'admin-roles', name: 'Quản lý Vai trò' },
  ];

  return (
    <PageLayout title="Debug Permissions" activePage="dashboard">
      <div className={styles.container}>
        <h1>🔍 Debug Permissions</h1>

        {/* Session Info */}
        <section className={styles.section}>
          <h2>Session Info</h2>
          <div className={styles.card}>
            <div className={styles.row}>
              <span className={styles.label}>UID:</span>
              <span className={styles.value}>{session?.uid || 'N/A'}</span>
            </div>
            <div className={styles.row}>
              <span className={styles.label}>Email:</span>
              <span className={styles.value}>{session?.email || 'N/A'}</span>
            </div>
            <div className={styles.row}>
              <span className={styles.label}>Display Name:</span>
              <span className={styles.value}>{session?.displayName || 'N/A'}</span>
            </div>
          </div>
        </section>

        {/* Profile Info */}
        <section className={styles.section}>
          <h2>Profile Info</h2>
          {loadingProfile ? (
            <p>Loading...</p>
          ) : profileData ? (
            <div className={styles.card}>
              <div className={styles.row}>
                <span className={styles.label}>Active:</span>
                <span className={styles.value}>
                  {profileData.is_active ? '✅ Yes' : '❌ No'}
                </span>
              </div>
              <div className={styles.row}>
                <span className={styles.label}>Role ID:</span>
                <span className={styles.value}>{profileData.role_id || 'N/A'}</span>
              </div>
              <div className={styles.row}>
                <span className={styles.label}>Role Name:</span>
                <span className={styles.value}>
                  {profileData.roles?.role_name || 'N/A'}
                </span>
              </div>
            </div>
          ) : (
            <p className={styles.error}>No profile data</p>
          )}
        </section>

        {/* Permissions */}
        <section className={styles.section}>
          <h2>Permissions ({permissions.length} pages)</h2>
          {loading ? (
            <p>Loading permissions...</p>
          ) : permissions.length === 0 ? (
            <p className={styles.error}>⚠️ No permissions found!</p>
          ) : (
            <div className={styles.permissionsGrid}>
              {pageKeys.map(({ key, name }) => {
                const perm = permissions.find(p => p.page_key === key);
                return (
                  <div
                    key={key}
                    className={`${styles.permCard} ${
                      perm?.can_view ? styles.hasAccess : styles.noAccess
                    }`}
                  >
                    <div className={styles.permHeader}>
                      <span className={styles.permIcon}>
                        {perm?.can_view ? '✅' : '❌'}
                      </span>
                      <span className={styles.permName}>{name}</span>
                    </div>
                    <div className={styles.permDetails}>
                      <div className={styles.permRow}>
                        <span>Key:</span>
                        <code>{key}</code>
                      </div>
                      <div className={styles.permRow}>
                        <span>Can View:</span>
                        <strong>{perm?.can_view ? 'Yes' : 'No'}</strong>
                      </div>
                      <div className={styles.permRow}>
                        <span>Can Edit:</span>
                        <strong>{perm?.can_edit ? 'Yes' : 'No'}</strong>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Raw Data */}
        <section className={styles.section}>
          <h2>Raw Permissions Data</h2>
          <pre className={styles.code}>
            {JSON.stringify(permissions, null, 2)}
          </pre>
        </section>

        {/* Raw Profile Data */}
        <section className={styles.section}>
          <h2>Raw Profile Data</h2>
          <pre className={styles.code}>
            {JSON.stringify(profileData, null, 2)}
          </pre>
        </section>

        {/* Instructions */}
        <section className={styles.section}>
          <h2>📋 Troubleshooting</h2>
          <div className={styles.instructions}>
            <h3>Nếu không có permissions:</h3>
            <ol>
              <li>Check database: <code>profiles</code> table</li>
              <li>Verify <code>role_id</code> is set</li>
              <li>Check <code>roles</code> table has role</li>
              <li>Check <code>role_permissions</code> table has entries</li>
              <li>Verify <code>pages</code> table has correct keys</li>
            </ol>

            <h3>Page Keys cần có:</h3>
            <ul>
              {pageKeys.map(({ key, name }) => (
                <li key={key}>
                  <code>{key}</code> - {name}
                </li>
              ))}
            </ul>

            <h3>Để truy cập /admin/dashboard:</h3>
            <p>Cần có quyền xem page với key = <code>dashboard</code></p>
          </div>
        </section>
      </div>
    </PageLayout>
  );
}
