'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AuthenticatedPage } from '@/components/AuthenticatedPage';
import { UserLayout } from '@/components/UserLayout';
import { useToast, ToastContainer } from '@/components/ui';
import { authFetch } from '@/lib/auth/clientAuth';
import styles from '@/app/dashboard.module.css';

interface Batch {
  id: string;
  slug: string;
  title: string;
  week_from: string;
  week_to: string;
  notes: string | null;
  is_active: boolean;
  session_count: number;
  request_count: number;
}

function formatDate(ymd: string): string {
  if (!ymd) return '';
  const [yyyy, mm, dd] = ymd.split('-');
  return `${dd}/${mm}`;
}

export default function JudgeRequestsIndexPage() {
  const router = useRouter();
  const { toasts, addToast, removeToast } = useToast();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authFetch('/api/admin/judge-batches')
      .then(r => r.json())
      .then(j => setBatches((j.data || []).filter((b: Batch) => b.is_active)))
      .catch(() => addToast('Không thể tải danh sách', 'error'))
      .finally(() => setLoading(false));
  }, []);

  function copyLink(slug: string, e: React.MouseEvent) {
    e.stopPropagation();
    navigator.clipboard.writeText(`${window.location.origin}/judge-requests/${slug}`)
      .then(() => addToast('Đã copy link', 'success'));
  }

  return (
    <AuthenticatedPage>
      <UserLayout title="Giám khảo Cuối khoá" activePage="judge-requests">
        <ToastContainer toasts={toasts} onRemove={removeToast} />

        <div style={{ marginBottom: 'var(--space-5)' }}>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 13 }}>
            Các đợt đăng ký giám khảo đang mở — mở link để đăng ký buổi cuối khoá bạn có thể làm giám khảo.
          </p>
        </div>

        {loading ? (
          <div style={{ color: 'var(--text-secondary)', padding: 'var(--space-6)', textAlign: 'center' }}>Đang tải...</div>
        ) : batches.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-10)', color: 'var(--text-tertiary)' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.35, marginBottom: 12 }}>
              <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
            </svg>
            <div style={{ fontWeight: 600, fontSize: 15 }}>Chưa có đợt đăng ký nào đang mở</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>Admin sẽ gửi link khi có đợt mới</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {batches.map(batch => (
              <div
                key={batch.id}
                onClick={() => router.push(`/judge-requests/${batch.slug}`)}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: 'var(--space-4)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-4)',
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--brand-indigo)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
              >
                {/* Icon */}
                <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)', background: 'rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--brand-indigo)" strokeWidth="2">
                    <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
                  </svg>
                </div>

                {/* Info */}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{batch.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                    {formatDate(batch.week_from)} – {formatDate(batch.week_to)} · {batch.session_count} buổi
                  </div>
                  {batch.notes && (
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3, fontStyle: 'italic' }}>
                      {batch.notes}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                  <button
                    className={styles.clearCacheBtn}
                    style={{ fontSize: 12, padding: '5px 10px' }}
                    onClick={e => copyLink(batch.slug, e)}
                    title="Copy link"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  </button>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              </div>
            ))}
          </div>
        )}
      </UserLayout>
    </AuthenticatedPage>
  );
}
