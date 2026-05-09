'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { AuthenticatedPage } from '@/components/AuthenticatedPage';
import { UserLayout } from '@/components/UserLayout';
import { useAuth } from '@/lib/AuthContext';
import { useToast, ToastContainer, TableGroupHeader, EmptyState, Modal, ModalHeader, BatchStatusBadge, ParticipationStatusBadge } from '@/components/ui';
import { authFetch } from '@/lib/auth/clientAuth';
import { searchTeachers, type Teacher } from '@/services/officeHoursService';
import { dateRangeToUtcRange, fetchAllClasses } from '@/services/classesService';
import { LABELS } from '@/constants';
import { motion, AnimatePresence } from 'framer-motion';
import styles from '@/app/dashboard.module.css';
import type { Session, TeacherSlot } from '@/types/classes';

// ─── Types ────────────────────────────────────────────────────────────────────

interface JudgeRequest {
  id: string;
  final_session_id: string;
  teacher_email: string;
  teacher_name?: string | null;
  teacher_id?: string | null;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason: string | null;
}

interface FinalSession {
  id: string;
  lms_class_id: string;
  lms_slot_id: string;
  class_name: string;
  course_short_name: string | null;
  centre_id: string | null;
  centre_name: string | null;
  category: string | null;
  session_date: string;           // YYYY-MM-DD
  start_time_utc: string | null;
  end_time_utc: string | null;
  main_teacher: string | null;
  student_count: number;
  notes: string | null;
  myRequest: JudgeRequest | null;
  approvedJudge: JudgeRequest | null;
}

interface Batch {
  id: string;
  slug: string;
  title: string;
  week_from: string;
  week_to: string;
  notes: string | null;
  is_active: boolean;
  sessions: FinalSession[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DOW_VI = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

const CATEGORY_COLORS: Record<string, string> = {
  Coding:   '#059669',
  Robotics: 'var(--brand-indigo, #3b82f6)',
  Art:      '#d97706',
  Others:   'var(--border)',
};

const CATEGORY_ORDER: Record<string, number> = { Coding: 0, Robotics: 1, Art: 2, Others: 3 };
const SESSION_ORDER: Record<string, number>  = { Sáng: 0, Chiều: 1, Tối: 2 };

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sessionLabel(endUtc: string | null): 'Sáng' | 'Chiều' | 'Tối' {
  if (!endUtc) return 'Sáng';
  const h = parseInt(
    new Intl.DateTimeFormat('vi-VN', { hour: 'numeric', timeZone: 'Asia/Ho_Chi_Minh', hour12: false }).format(new Date(endUtc)),
    10,
  );
  if (h <= 12) return 'Sáng';
  if (h <= 18) return 'Chiều';
  return 'Tối';
}

function dateLabelParts(ymd: string): { dow: string; display: string } {
  const d = new Date(ymd + 'T12:00:00');
  return {
    dow:     DOW_VI[d.getDay()],
    display: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`,
  };
}

function formatTime(utc: string | null): string {
  if (!utc) return '—';
  try {
    return new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit',
    }).format(new Date(utc));
  } catch { return '—'; }
}

function formatDate(ymd: string): string {
  if (!ymd) return '';
  const [yyyy, mm, dd] = ymd.split('-');
  return `${dd}/${mm}/${yyyy}`;
}

function getTeacherRoleShortName(t: TeacherSlot): string {
  const role = t.role;
  return (role?.shortName || role?.name || '').toUpperCase();
}

function getJudgeTeacher(slot: Session): string | null {
  const teacherSlot = (slot.teachers || []).find(t => getTeacherRoleShortName(t) === 'JUDGE');
  return teacherSlot?.teacher?.fullName || teacherSlot?.teacher?.email || null;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function JudgeRequestsSlugPage() {
  const { slug } = useParams() as { slug: string };
  const { session, isLoading: authLoading } = useAuth();
  const { toasts, addToast, removeToast } = useToast();

  const [batch, setBatch] = useState<Batch | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [teacherInfo, setTeacherInfo] = useState<Teacher | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showTable, setShowTable] = useState(true);
  const [detailSession, setDetailSession] = useState<FinalSession | null>(null);
  const [lmsJudgeBySlot, setLmsJudgeBySlot] = useState<Record<string, string>>({});

  const loadBatch = useCallback(async () => {
    setLoading(true);
    setNotFound(false);
    try {
      const res = await authFetch(`/api/judge-batches/${slug}`);
      if (res.status === 404) { setNotFound(true); return; }
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP Error ${res.status}`);
      }
      const json = await res.json();
      setBatch(json.data);
    } catch (err) {
      console.error('Failed to load batch:', err);
      addToast(err instanceof Error ? err.message : 'Không thể tải dữ liệu', 'error');
      // If it's not a 404, we don't set notFound, but batch remains null
    } finally {
      setLoading(false);
    }
  }, [addToast, slug]);

  // Wait until Firebase auth is fully initialised before fetching.
  // Without this guard, authFetch fires before the token is ready → 401 error.
  useEffect(() => {
    if (authLoading || !session) return;
    void loadBatch();
  }, [authLoading, session, loadBatch]);

  useEffect(() => {
    if (session?.email) {
      searchTeachers(session.email, 0, 1)
        .then(r => { if (r.data.length > 0) setTeacherInfo(r.data[0]); })
        .catch(() => {});
    }
  }, [session?.email]);

  useEffect(() => {
    if (!batch?.week_from || !batch.week_to) return;
    const controller = new AbortController();

    (async () => {
      try {
        const { endDateFrom, endDateTo } = dateRangeToUtcRange(
          new Date(batch.week_from),
          new Date(batch.week_to),
        );
        const classes = await fetchAllClasses({ endDateFrom, endDateTo }, undefined, controller.signal);
        const next: Record<string, string> = {};
        classes.forEach(cls => {
          cls.slots.forEach(slot => {
            const judge = getJudgeTeacher(slot);
            if (judge) next[slot._id] = judge;
          });
        });
        if (!controller.signal.aborted) setLmsJudgeBySlot(next);
      } catch {
        if (!controller.signal.aborted) setLmsJudgeBySlot({});
      }
    })();

    return () => controller.abort();
  }, [batch?.week_from, batch?.week_to]);

  // ─── Request actions ────────────────────────────────────────────────────

  async function handleRequest(fs: FinalSession) {
    if (!teacherInfo) return;
    setSubmitting(true);
    try {
      const res = await authFetch('/api/judge-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          finalSessionId: fs.id,
          teacherName: teacherInfo.fullName,
          teacherId: teacherInfo.id,
        }),
      });
      if (res.status === 409) { addToast('Bạn đã đăng ký cho buổi này rồi', 'info'); return; }
      if (!res.ok) throw new Error();
      addToast('Đã gửi đăng ký làm giám khảo', 'success');
      await loadBatch();
    } catch {
      addToast('Không thể gửi đăng ký', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel(fs: FinalSession) {
    setSubmitting(true);
    try {
      const res = await authFetch(`/api/judge-requests?sessionId=${fs.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      addToast('Đã huỷ đăng ký', 'success');
      await loadBatch();
    } catch {
      addToast('Không thể huỷ đăng ký', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Merged-cell table rows ───────────────────────────────────────────────

  const tableRows = useMemo(() => {
    if (!batch?.sessions) return [];

    const enriched = batch.sessions.map(fs => {
      const dKey    = fs.session_date;
      const dParts  = dateLabelParts(fs.session_date);
      const centreId = fs.centre_id || '';
      const centreLabel = fs.centre_name || '—';
      const cat     = fs.category || 'Others';
      const sesLabel = sessionLabel(fs.end_time_utc);
      const startMs  = fs.start_time_utc ? new Date(fs.start_time_utc).getTime() : 0;
      return { fs, dKey, dParts, centreId, centreLabel, cat, sesLabel, startMs };
    });

    enriched.sort((a, b) => {
      if (a.dKey !== b.dKey) return a.dKey.localeCompare(b.dKey);
      if (a.centreLabel !== b.centreLabel) return a.centreLabel.localeCompare(b.centreLabel, 'vi');
      const ca = CATEGORY_ORDER[a.cat] ?? 99;
      const cb = CATEGORY_ORDER[b.cat] ?? 99;
      if (ca !== cb) return ca - cb;
      const sa = SESSION_ORDER[a.sesLabel] ?? 99;
      const sb = SESSION_ORDER[b.sesLabel] ?? 99;
      if (sa !== sb) return sa - sb;
      return a.startMs - b.startMs;
    });

    type Spans = { dateSpan: number; centreSpan: number; catSpan: number; sesSpan: number };
    const out: Array<typeof enriched[number] & Spans> = enriched.map(e => ({
      ...e, dateSpan: 0, centreSpan: 0, catSpan: 0, sesSpan: 0,
    }));

    for (let i = 0; i < out.length; i++) {
      const e   = out[i];
      const k1  = e.dKey;
      const k2  = `${k1}|${e.centreId}`;
      const k3  = `${k2}|${e.cat}`;
      const k4  = `${k3}|${e.sesLabel}`;
      const prev = i > 0 ? out[i - 1] : null;
      const pk1  = prev?.dKey ?? null;
      const pk2  = prev ? `${prev.dKey}|${prev.centreId}` : null;
      const pk3  = prev ? `${prev.dKey}|${prev.centreId}|${prev.cat}` : null;
      const pk4  = prev ? `${prev.dKey}|${prev.centreId}|${prev.cat}|${prev.sesLabel}` : null;

      if (k1 !== pk1) { let n = 1; while (i + n < out.length && out[i + n].dKey === k1) n++; e.dateSpan = n; }
      if (k2 !== pk2) { let n = 1; while (i + n < out.length && `${out[i + n].dKey}|${out[i + n].centreId}` === k2) n++; e.centreSpan = n; }
      if (k3 !== pk3) { let n = 1; while (i + n < out.length && `${out[i + n].dKey}|${out[i + n].centreId}|${out[i + n].cat}` === k3) n++; e.catSpan = n; }
      if (k4 !== pk4) { let n = 1; while (i + n < out.length && `${out[i + n].dKey}|${out[i + n].centreId}|${out[i + n].cat}|${out[i + n].sesLabel}` === k4) n++; e.sesSpan = n; }
    }

    return out;
  }, [batch]);

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <AuthenticatedPage>
        <UserLayout title="Giám khảo Cuối khoá" activePage="judge-requests">
          <div style={{ padding: 'var(--space-6)', color: 'var(--text-secondary)' }}>Đang tải...</div>
        </UserLayout>
      </AuthenticatedPage>
    );
  }

  if (notFound) {
    return (
      <AuthenticatedPage>
        <UserLayout title="Giám khảo Cuối khoá" activePage="judge-requests">
          <EmptyState
            icon={<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>}
            title="Không tìm thấy đợt đăng ký"
            subtitle="Link có thể đã hết hạn hoặc không hợp lệ"
          />
        </UserLayout>
      </AuthenticatedPage>
    );
  }

  if (!batch) {
    return (
      <AuthenticatedPage>
        <UserLayout title="Giám khảo Cuối khoá" activePage="judge-requests">
          <EmptyState
            icon={<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>}
            title="Không thể tải đợt đăng ký"
            subtitle="Vui lòng thử lại sau"
          />
        </UserLayout>
      </AuthenticatedPage>
    );
  }

  return (
    <AuthenticatedPage>
      <UserLayout title="Giám khảo Cuối khoá" activePage="judge-requests">
        <ToastContainer toasts={toasts} onRemove={removeToast} />

        {/* Batch header */}
        <div style={{ marginBottom: 'var(--space-5)', padding: 'var(--space-4)', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{batch.title}</h2>
                {!batch.is_active && (
                  <BatchStatusBadge active={false} />
                )}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 3 }}>
                {formatDate(batch.week_from)} – {formatDate(batch.week_to)} · {batch.sessions.length} buổi cuối khoá
              </div>
              {batch.notes && <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4, fontStyle: 'italic' }}>{batch.notes}</div>}
            </div>
            {!batch.is_active && (
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'right' }}>
                Đợt đăng ký này đã đóng
              </div>
            )}
          </div>
        </div>

        {batch.sessions.length === 0 ? (
          <EmptyState
            icon={<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg>}
            title="Chưa có buổi nào trong đợt này"
            subtitle="Admin chưa thêm buổi. Quay lại sau."
          />
        ) : (
          <div className={styles.tableSection}>
            <TableGroupHeader
              title="Danh sách buổi cuối khoá"
              count={batch.sessions.length}
              loading={false}
              progress={{ loaded: 0, total: 0 }}
              isExpanded={showTable}
              onToggle={() => setShowTable(p => !p)}
            />

            <AnimatePresence initial={false}>
              {showTable && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  style={{ overflow: 'hidden' }}
                >
                  <div className={styles.tableScrollWrapper}>
                    <table className={styles.mergedTable} style={{ minWidth: 1100 }}>
                      <thead>
                        <tr>
                          <th>{LABELS.DATE}</th>
                          <th>{LABELS.CENTRE}</th>
                          <th>{LABELS.COURSE_LINE}</th>
                          <th>{LABELS.SESSION}</th>
                          <th>Giờ</th>
                          <th>{LABELS.CLASS_TITLE}</th>
                          <th>{LABELS.COURSE}</th>
                          <th>{LABELS.MAIN_TEACHER}</th>
                          <th style={{ textAlign: 'center' }}>{LABELS.STUDENTS}</th>
                          <th>Giám khảo</th>
                          <th>{LABELS.REGISTRATION_STATUS}</th>
                          <th>{LABELS.ACTION}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tableRows.map(row => {
                          const { fs } = row;
                          const req = fs.myRequest;
                          const approvedJudgeName = fs.approvedJudge?.teacher_name || fs.approvedJudge?.teacher_email || lmsJudgeBySlot[fs.lms_slot_id] || '';
                          const isNewDate = row.dateSpan > 0;

                          return (
                            <tr
                              key={fs.id}
                              style={{
                                borderTop: isNewDate ? '2px solid var(--border)' : '1px solid var(--border-subtle)',
                                background: req ? 'rgba(59,130,246,0.06)' : undefined,
                              }}
                            >
                              {row.dateSpan > 0 && (
                                <td rowSpan={row.dateSpan} className={styles.mergedCell} style={{ fontWeight: 600, lineHeight: 1.3 }}>
                                  <div>{row.dParts.dow}</div>
                                  <div style={{ color: 'var(--text-secondary)', fontWeight: 500, fontSize: 12 }}>{row.dParts.display}</div>
                                </td>
                              )}
                              {row.centreSpan > 0 && (
                                <td rowSpan={row.centreSpan} className={styles.mergedCell} style={{ whiteSpace: 'normal', wordBreak: 'break-word', maxWidth: 150, fontSize: 14, fontWeight: 600, lineHeight: 1.35 }}>
                                  {row.centreLabel}
                                </td>
                              )}
                              {row.catSpan > 0 && (
                                <td rowSpan={row.catSpan} className={styles.mergedCell} style={{ fontWeight: 700, backgroundColor: CATEGORY_COLORS[row.cat] || 'var(--border)', color: 'white', borderLeft: 'none' }}>
                                  {row.cat}
                                </td>
                              )}
                              {row.sesSpan > 0 && (
                                <td rowSpan={row.sesSpan} className={styles.mergedCell} style={{ fontStyle: 'italic' }}>
                                  {row.sesLabel}
                                </td>
                              )}

                              <td onClick={() => setDetailSession(fs)} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                {formatTime(fs.start_time_utc)} – {formatTime(fs.end_time_utc)}
                              </td>
                              <td onClick={() => setDetailSession(fs)} style={{ cursor: 'pointer', fontWeight: 510, fontSize: 13 }}>
                                {fs.class_name}
                              </td>
                              <td onClick={() => setDetailSession(fs)} style={{ cursor: 'pointer' }}>
                                {fs.course_short_name ? (
                                  <span className={styles.reasonTag}>{fs.course_short_name}</span>
                                ) : <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                              </td>
                              <td onClick={() => setDetailSession(fs)} style={{ cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)' }}>
                                {fs.main_teacher || '—'}
                              </td>
                              <td onClick={() => setDetailSession(fs)} style={{ cursor: 'pointer', textAlign: 'center', fontSize: 13 }}>
                                {fs.student_count}
                              </td>
                              <td onClick={() => setDetailSession(fs)} style={{ cursor: 'pointer', fontSize: 13, color: approvedJudgeName ? 'var(--text-primary)' : 'var(--text-tertiary)', fontWeight: approvedJudgeName ? 510 : 400 }}>
                                {approvedJudgeName || '—'}
                              </td>
                              <td onClick={() => setDetailSession(fs)} style={{ cursor: 'pointer' }}>
                                <ParticipationStatusBadge status={req?.status === 'approved' ? 'confirmed' : req?.status} />
                              </td>
                              <td onClick={e => e.stopPropagation()}>
                                <div style={{ display: 'flex', justifyContent: 'center' }}>
                                  {!batch.is_active ? (
                                    <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>Đã đóng</span>
                                  ) : req?.status === 'pending' ? (
                                    <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                                      <span style={{ color: 'var(--brand-indigo)', fontSize: 12, fontWeight: 510 }}>Đã đăng ký</span>
                                      <button
                                        className={styles.clearCacheBtn}
                                        style={{ padding: '4px 8px', fontSize: 11, minWidth: 'auto', color: 'var(--status-error)', borderColor: 'rgba(220,38,38,0.3)' }}
                                        disabled={submitting}
                                        onClick={() => handleCancel(fs)}
                                      >
                                        Huỷ
                                      </button>
                                    </div>
                                  ) : req?.status === 'approved' ? (
                                    <ParticipationStatusBadge status="confirmed" />
                                  ) : req?.status === 'rejected' ? (
                                    <ParticipationStatusBadge status="rejected" />
                                  ) : approvedJudgeName ? (
                                    <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>Đã có giám khảo</span>
                                  ) : (
                                    <button
                                      className={styles.clearCacheBtn}
                                      style={{ fontSize: 12, padding: '5px 12px' }}
                                      disabled={submitting}
                                      onClick={() => handleRequest(fs)}
                                    >
                                      Đăng ký làm giám khảo
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Detail modal */}
        <Modal open={!!detailSession} onClose={() => setDetailSession(null)}>
          {detailSession && (
            <>
              <ModalHeader
                title={detailSession.class_name}
                subtitle={`Buổi cuối khoá · ${detailSession.centre_name || ''}`}
                onClose={() => setDetailSession(null)}
              />
              <div style={{ padding: 'var(--space-4)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                {[
                  ['Ngày', formatDate(detailSession.session_date)],
                  ['Giờ', `${formatTime(detailSession.start_time_utc)} – ${formatTime(detailSession.end_time_utc)}`],
                  ['Cơ sở', detailSession.centre_name || '—'],
                  [LABELS.COURSE, detailSession.course_short_name || '—'],
                  ['Giáo viên chính', detailSession.main_teacher || '—'],
                  [LABELS.STUDENTS, `${detailSession.student_count}`],
                ].map(([label, value]) => (
                  <div key={label as string}>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>{label}</div>
                    <div style={{ fontSize: 14, fontWeight: 510 }}>{value}</div>
                  </div>
                ))}
                {detailSession.notes && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>Ghi chú</div>
                    <div style={{ fontSize: 13, fontStyle: 'italic' }}>{detailSession.notes}</div>
                  </div>
                )}
              </div>
            </>
          )}
        </Modal>
      </UserLayout>
    </AuthenticatedPage>
  );
}
