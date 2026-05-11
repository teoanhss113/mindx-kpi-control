'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AuthenticatedPage } from '@/components/AuthenticatedPage';
import { UserLayout } from '@/components/UserLayout';
import {
  useToast, ToastContainer, EmptyState, TableGroupHeader, BatchStatusBadge, Badge, Icon,
} from '@/components/ui';
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
  is_public: boolean;
  session_count: number;
}

function formatDate(ymd: string): string {
  if (!ymd) return '';
  const [yyyy, mm, dd] = ymd.split('-');
  return `${dd}/${mm}/${yyyy}`;
}

export default function JudgeRequestsIndexPage() {
  const router = useRouter();
  const { toasts, addToast, removeToast } = useToast();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    authFetch('/api/judge-batches')
      .then(r => r.json())
      .then(j => setBatches(j.data || []))
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

        {!loading && batches.length === 0 ? (
          <EmptyState
            icon={<Icon.BookOpen size={40} />}
            title="Chưa có đợt đăng ký nào đang mở"
            subtitle="Admin sẽ thông báo khi có đợt mới"
          />
        ) : (
          <div className={styles.tableSection}>
            <TableGroupHeader
              title="Các đợt đăng ký"
              count={batches.length}
              loading={loading}
              progress={{ loaded: 0, total: 0 }}
              isExpanded={expanded}
              onToggle={() => setExpanded(p => !p)}
            />

            {expanded && (
              <>
                <div className={styles.tableScrollWrapper}>
                  <div
                    className={styles.classItemHeader}
                    style={{ gridTemplateColumns: 'minmax(0,2fr) minmax(0,1.4fr) 64px minmax(0,0.8fr) 40px', minWidth: 520 }}
                  >
                    <div>Tiêu đề</div>
                    <div>Thời gian</div>
                    <div style={{ textAlign: 'center' }}>Buổi</div>
                    <div>Trạng thái</div>
                    <div></div>
                  </div>

                  {loading && (
                    Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className={styles.skeletonRow}>
                        <div className={styles.skeletonBlock} style={{ width: '40%' }} />
                        <div className={styles.skeletonBlock} style={{ width: '55%' }} />
                        <div className={styles.skeletonBlock} style={{ width: '25%' }} />
                      </div>
                    ))
                  )}

                  {batches.map(batch => (
                    <div
                      key={batch.id}
                      className={styles.classItem}
                      style={{
                        gridTemplateColumns: 'minmax(0,2fr) minmax(0,1.4fr) 64px minmax(0,0.8fr) 40px',
                        minWidth: 520,
                        cursor: 'pointer',
                      }}
                      onClick={() => router.push(`/judge-requests/${batch.slug}`)}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{batch.title}</div>
                        {batch.notes && (
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2, fontStyle: 'italic' }}>
                            {batch.notes}
                          </div>
                        )}
                      </div>

                      <div style={{ fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {formatDate(batch.week_from)} – {formatDate(batch.week_to)}
                      </div>

                      <div style={{ textAlign: 'center', fontWeight: 700, color: 'var(--brand-indigo)', fontSize: 13 }}>
                        {batch.session_count}
                      </div>

                      <div>
                        <BatchStatusBadge active={batch.is_active} />
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                        <button
                          className={styles.textActionBtn}
                          style={{ padding: '4px 6px' }}
                          onClick={e => copyLink(batch.slug, e)}
                          title="Copy link"
                        >
                          <Icon.Copy size={13} />
                        </button>
                        <Icon.ChevronRight size={14} color="var(--text-quaternary)" />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </UserLayout>
    </AuthenticatedPage>
  );
}
