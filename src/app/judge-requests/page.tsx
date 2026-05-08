'use client';

import { useState, useEffect, useMemo } from 'react';
import { AuthenticatedPage } from '@/components/AuthenticatedPage';
import { UserLayout } from '@/components/UserLayout';
import { useAuth } from '@/lib/AuthContext';
import { useToast, ToastContainer, Toolbar, TableGroupHeader, EmptyState, Modal, ModalHeader } from '@/components/ui';
import { fetchAllClasses } from '@/services/classesService';
import { searchTeachers, type Teacher } from '@/services/officeHoursService';
import { createJudgeRequest, hasRequestedJudge, cancelJudgeRequest, getMyJudgeRequests, type JudgeRequest } from '@/lib/judge-request-actions';
import { getCourseCategory } from '@/lib/courseCategories';
import type { Class, Session, TeacherSlot } from '@/types/classes';
import { MESSAGES } from '@/constants';
import { motion, AnimatePresence } from 'framer-motion';
import styles from '@/app/dashboard.module.css';

const DOW_VI = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

const CATEGORY_ORDER: Record<string, number> = { Coding: 0, Robotics: 1, Art: 2, Others: 3 };
const SESSION_ORDER: Record<string, number> = { Sáng: 0, Chiều: 1, Tối: 2 };

const CATEGORY_COLORS: Record<string, string> = {
  Coding:   '#059669',
  Robotics: 'var(--brand-indigo, #3b82f6)',
  Art:      '#d97706',
  Others:   'var(--border)',
};

// ─── Date helpers ─────────────────────────────────────────────────────────────

function vnDateParts(iso: string) {
  const d = new Date(iso);
  const v = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
  return { year: v.getFullYear(), month: v.getMonth() + 1, day: v.getDate(), dow: v.getDay() };
}

function dateKey(iso: string) {
  const p = vnDateParts(iso);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

function dateLabelParts(iso: string): { dow: string; ymd: string } {
  const p = vnDateParts(iso);
  return {
    dow: DOW_VI[p.dow],
    ymd: `${String(p.day).padStart(2, '0')}/${String(p.month).padStart(2, '0')}/${p.year}`,
  };
}

function sessionLabel(endIso: string): 'Sáng' | 'Chiều' | 'Tối' {
  const h = parseInt(
    new Intl.DateTimeFormat('vi-VN', { hour: 'numeric', timeZone: 'Asia/Ho_Chi_Minh', hour12: false }).format(new Date(endIso)),
    10,
  );
  if (h <= 12) return 'Sáng';
  if (h <= 18) return 'Chiều';
  return 'Tối';
}

function formatTime(iso: string) {
  try {
    return new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit',
    }).format(new Date(iso));
  } catch { return 'N/A'; }
}

// Convert local YYYY-MM-DD to UTC ISO boundaries for LMS API (Vietnam = GMT+7)
function localDateToUtcRange(from: string, to: string): { haveSlotFrom: string; haveSlotTo: string } {
  const fromLocal = new Date(`${from}T00:00:00+07:00`);
  const toLocal   = new Date(`${to}T23:59:59.999+07:00`);
  return {
    haveSlotFrom: fromLocal.toISOString(),
    haveSlotTo:   toLocal.toISOString(),
  };
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface FinalSession {
  class: Class;
  slot: Session;
  category: string;
  myRequest: JudgeRequest | null;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function JudgeRequestsPage() {
  const { session } = useAuth();
  const { toasts, addToast, removeToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ loaded: 0, total: 0 });
  const [sessions, setSessions] = useState<FinalSession[]>([]);
  const [teacherInfo, setTeacherInfo] = useState<Teacher | null>(null);
  const [regionCentres, setRegionCentres] = useState<string[]>([]);
  const [centres, setCentres] = useState<any[]>([]);

  const [timeFrom, setTimeFrom] = useState('');
  const [timeTo, setTimeTo] = useState('');
  const [selectedCentres, setSelectedCentres] = useState<string[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [showTable, setShowTable] = useState(true);
  const [detailSession, setDetailSession] = useState<FinalSession | null>(null);

  // Default to current week (Mon–Sun)
  useEffect(() => {
    const now = new Date();
    const vnTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
    const day = vnTime.getDay(); // 0=Sun
    const monday = new Date(vnTime);
    monday.setDate(vnTime.getDate() - (day === 0 ? 6 : day - 1));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    setTimeFrom(fmt(monday));
    setTimeTo(fmt(sunday));
  }, []);

  useEffect(() => {
    if (session?.email) {
      loadTeacherInfo();
      loadCentres();
    }
  }, [session?.email]);

  async function loadCentres() {
    try {
      const { getCache } = await import('@/lib/idb');
      const { CACHE_KEYS } = await import('@/constants');
      const cached = await getCache(CACHE_KEYS.CENTRES);
      if (cached?.centres?.length) { setCentres(cached.centres); return; }
      const { fetchAllCentres } = await import('@/services/centresService');
      const data = await fetchAllCentres();
      setCentres(data);
      const { setCache } = await import('@/lib/idb');
      await setCache(CACHE_KEYS.CENTRES, { centres: data });
    } catch { /* silent */ }
  }

  async function loadTeacherInfo() {
    if (!session?.email) return;
    try {
      const result = await searchTeachers(session.email, 0, 1);
      if (result.data.length > 0) {
        const teacher = result.data[0];
        setTeacherInfo(teacher);
        if (teacher.centres?.length) {
          await loadRegionCentres(teacher.centres.map(c => c.id));
        }
      }
    } catch { /* silent */ }
  }

  async function loadRegionCentres(teacherCentreIds: string[]) {
    try {
      const { supabase } = await import('@/lib/supabase/client');
      const { data: regionData } = await supabase
        .from('region_centres')
        .select('region_id, centre_id')
        .in('centre_id', teacherCentreIds);

      if (!regionData?.length) { setRegionCentres(teacherCentreIds); return; }

      const regionIds = [...new Set(regionData.map(r => r.region_id))];
      const { data: allRC } = await supabase
        .from('region_centres')
        .select('centre_id')
        .in('region_id', regionIds);

      setRegionCentres([...new Set((allRC || []).map(rc => rc.centre_id))]);
    } catch {
      setRegionCentres(teacherCentreIds);
    }
  }

  useEffect(() => {
    if (regionCentres.length > 0) {
      setSelectedCentres(regionCentres);
      if (timeFrom && timeTo) handleFetch();
    }
  }, [regionCentres]);

  async function handleFetch() {
    if (!teacherInfo || regionCentres.length === 0) return;

    const centresToFetch = selectedCentres.length > 0 ? selectedCentres : regionCentres;
    setLoading(true);
    setProgress({ loaded: 0, total: 0 });
    setSessions([]);
    const tid = addToast(MESSAGES.LOADING.CONNECTING, 'loading');

    try {
      const { haveSlotFrom, haveSlotTo } = localDateToUtcRange(timeFrom, timeTo);

      // Fetch my existing judge requests for fast lookup
      const myRequests = await getMyJudgeRequests().catch(() => [] as JudgeRequest[]);
      const myRequestMap = new Map(myRequests.map(r => [r.session_id, r]));

      let allFinalSessions: FinalSession[] = [];

      await fetchAllClasses(
        {
          centres: centresToFetch,
          haveSlotFrom,
          haveSlotTo,
        } as any,
        (loaded, total, chunk) => {
          setProgress({ loaded, total });

          // Find final sessions: slots that are within the date range AND are the last slot of the class
          for (const cls of chunk) {
            if (!cls.slots?.length) continue;

            // Sort slots by date ascending
            const sortedSlots = [...cls.slots].sort((a, b) =>
              new Date(a.date).getTime() - new Date(b.date).getTime()
            );

            // The last slot of this class
            const lastSlot = sortedSlots[sortedSlots.length - 1];
            if (!lastSlot) continue;

            // Check if last slot is within the selected date range
            const slotKey = dateKey(lastSlot.date);
            if (slotKey < timeFrom || slotKey > timeTo) continue;

            const category = getCourseCategory(cls);

            allFinalSessions.push({
              class: cls,
              slot: lastSlot,
              category,
              myRequest: myRequestMap.get(lastSlot._id) || null,
            });
          }

          setSessions([...allFinalSessions]);
        },
      );

      removeToast(tid);
      addToast(MESSAGES.LOADING.SUCCESS(allFinalSessions.length, 'buổi cuối khoá'), 'success');
    } catch (error: any) {
      removeToast(tid);
      addToast('Không thể tải danh sách buổi cuối khoá', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleRequestJudge(fs: FinalSession) {
    if (!session?.email || !teacherInfo) return;
    try {
      setSubmitting(true);
      const alreadyRequested = await hasRequestedJudge(fs.slot._id);
      if (alreadyRequested) {
        addToast('Bạn đã gửi yêu cầu cho buổi học này rồi', 'info');
        return;
      }
      await createJudgeRequest(fs.slot._id, fs.class.id, teacherInfo.fullName, teacherInfo.id);
      addToast('Đã gửi yêu cầu làm giám khảo', 'success');
      await handleFetch();
    } catch (error: any) {
      addToast(error.message || 'Không thể gửi yêu cầu', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancelRequest(fs: FinalSession) {
    try {
      setSubmitting(true);
      await cancelJudgeRequest(fs.slot._id);
      addToast('Đã huỷ yêu cầu', 'success');
      await handleFetch();
    } catch (error: any) {
      addToast(error.message || 'Không thể huỷ yêu cầu', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Table rows with merged-cell spans ───────────────────────────────────

  const tableRows = useMemo(() => {
    const enriched = sessions.map(fs => {
      const dKey = dateKey(fs.slot.date);
      const dParts = dateLabelParts(fs.slot.date);
      const centreId = fs.class.centre?.id || '';
      const centreLabel = fs.class.centre?.name || '—';
      const sesLabel = fs.slot.endTime ? sessionLabel(fs.slot.endTime) : 'Sáng';
      const startMs = fs.slot.startTime ? new Date(fs.slot.startTime).getTime() : 0;
      return { fs, dKey, dParts, centreId, centreLabel, sesLabel, startMs };
    });

    enriched.sort((a, b) => {
      if (a.dKey !== b.dKey) return a.dKey.localeCompare(b.dKey);
      if (a.centreLabel !== b.centreLabel) return a.centreLabel.localeCompare(b.centreLabel, 'vi');
      const ca = CATEGORY_ORDER[a.fs.category] ?? 99;
      const cb = CATEGORY_ORDER[b.fs.category] ?? 99;
      if (ca !== cb) return ca - cb;
      const sa = SESSION_ORDER[a.sesLabel] ?? 99;
      const sb = SESSION_ORDER[b.sesLabel] ?? 99;
      if (sa !== sb) return sa - sb;
      return a.startMs - b.startMs;
    });

    type Spans = { dateSpan: number; centreSpan: number; categorySpan: number; sessionSpan: number };
    const out: Array<typeof enriched[number] & Spans> = enriched.map(e => ({
      ...e, dateSpan: 0, centreSpan: 0, categorySpan: 0, sessionSpan: 0,
    }));

    for (let i = 0; i < out.length; i++) {
      const e = out[i];
      const k1 = e.dKey;
      const k2 = `${k1}|${e.centreId}`;
      const k3 = `${k2}|${e.fs.category}`;
      const k4 = `${k3}|${e.sesLabel}`;
      const prev = i > 0 ? out[i - 1] : null;
      const pk1 = prev?.dKey ?? null;
      const pk2 = prev ? `${prev.dKey}|${prev.centreId}` : null;
      const pk3 = prev ? `${prev.dKey}|${prev.centreId}|${prev.fs.category}` : null;
      const pk4 = prev ? `${prev.dKey}|${prev.centreId}|${prev.fs.category}|${prev.sesLabel}` : null;

      if (k1 !== pk1) { let n = 1; while (i + n < out.length && out[i + n].dKey === k1) n++; e.dateSpan = n; }
      if (k2 !== pk2) { let n = 1; while (i + n < out.length && `${out[i + n].dKey}|${out[i + n].centreId}` === k2) n++; e.centreSpan = n; }
      if (k3 !== pk3) { let n = 1; while (i + n < out.length && `${out[i + n].dKey}|${out[i + n].centreId}|${out[i + n].fs.category}` === k3) n++; e.categorySpan = n; }
      if (k4 !== pk4) { let n = 1; while (i + n < out.length && `${out[i + n].dKey}|${out[i + n].centreId}|${out[i + n].fs.category}|${out[i + n].sesLabel}` === k4) n++; e.sessionSpan = n; }
    }

    return out;
  }, [sessions]);

  // ─── Main teacher from slot teachers ─────────────────────────────────────

  function getMainTeacher(slot: Session, cls: Class): string {
    const teachers: TeacherSlot[] = slot.teachers?.length ? slot.teachers : cls.teachers || [];
    const active = teachers.filter(t => t.isActive);
    if (!active.length) return '—';
    // Prefer role with "Chính" or fallback to first
    const main = active.find(t => t.role?.name?.includes('Chính') || t.role?.shortName === 'GVC') || active[0];
    return main.teacher?.fullName || '—';
  }

  // ─── Detail modal content ─────────────────────────────────────────────────

  function renderDetail(fs: FinalSession) {
    const cls = fs.class;
    const slot = fs.slot;
    const activeStudents = cls.students?.filter(s => s.activeInClass) || [];
    const teachers = (slot.teachers?.length ? slot.teachers : cls.teachers || []).filter(t => t.isActive);

    return (
      <div style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {/* Class info */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Tên lớp</div>
            <div style={{ fontWeight: 600 }}>{cls.name}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Cơ sở</div>
            <div>{cls.centre?.name || '—'}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Khóa học</div>
            <div>{cls.course?.shortName || cls.course?.name || '—'}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Số buổi</div>
            <div>{cls.numberOfSessions} buổi</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Thời gian</div>
            <div>{formatTime(slot.startTime)} – {formatTime(slot.endTime)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Học sinh</div>
            <div>{activeStudents.length} học sinh</div>
          </div>
        </div>

        {/* Teachers */}
        {teachers.length > 0 && (
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Giáo viên</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {teachers.map(t => (
                <div key={t._id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', flexShrink: 0 }}>
                    {t.teacher?.fullName?.charAt(0) || '?'}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 510 }}>{t.teacher?.fullName}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{t.role?.name || t.role?.shortName}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <AuthenticatedPage>
      <UserLayout title="Yêu cầu làm giám khảo" activePage="judge-requests">
        <ToastContainer toasts={toasts} onRemove={removeToast} />

        <Toolbar
          centres={centres}
          selectedCentres={selectedCentres}
          onCentresChange={setSelectedCentres}
          centresLoading={false}
          filterToIds={regionCentres}
          showRegionQuickSelect={true}
          dateFrom={timeFrom}
          dateTo={timeTo}
          onDateFromChange={setTimeFrom}
          onDateToChange={setTimeTo}
          onFetch={handleFetch}
          onClearCache={async () => { setSessions([]); addToast('Đã xoá dữ liệu', 'success'); }}
          loading={loading}
          progress={progress}
          hasData={sessions.length > 0}
        />

        {sessions.length === 0 && !loading && (
          <EmptyState
            icon={<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>}
            title="Chưa có buổi cuối khoá"
            subtitle={'Chọn tuần và nhấn "Tải dữ liệu"'}
          />
        )}

        {sessions.length > 0 && (
          <div className={styles.tableSection}>
            <TableGroupHeader
              title="Danh sách buổi cuối khoá"
              count={sessions.length}
              loading={loading}
              progress={progress}
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
                    <table className={styles.mergedTable} style={{ minWidth: '1200px' }}>
                      <thead>
                        <tr>
                          <th>Ngày</th>
                          <th>Cơ sở</th>
                          <th>Khối</th>
                          <th>Buổi</th>
                          <th>Giờ</th>
                          <th>Tên lớp</th>
                          <th>Khóa học</th>
                          <th>Giáo viên chính</th>
                          <th>HS</th>
                          <th>Hành động</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tableRows.map((row) => {
                          const { fs } = row;
                          const cls = fs.class;
                          const slot = fs.slot;
                          const activeStudents = cls.students?.filter(s => s.activeInClass).length || 0;
                          const mainTeacher = getMainTeacher(slot, cls);
                          const isNewDate = row.dateSpan > 0;
                          const hasMyRequest = !!fs.myRequest;

                          return (
                            <tr
                              key={`${cls.id}-${slot._id}`}
                              style={{
                                borderTop: isNewDate ? '2px solid var(--border)' : '1px solid var(--border-subtle)',
                              }}
                            >
                              {row.dateSpan > 0 && (
                                <td rowSpan={row.dateSpan} className={styles.mergedCell} style={{ fontWeight: 600, lineHeight: 1.3 }}>
                                  <div>{row.dParts.dow}</div>
                                  <div style={{ color: 'var(--text-secondary)', fontWeight: 500, fontSize: 12 }}>{row.dParts.ymd}</div>
                                </td>
                              )}
                              {row.centreSpan > 0 && (
                                <td rowSpan={row.centreSpan} className={styles.mergedCell} style={{ whiteSpace: 'normal', wordBreak: 'break-word', maxWidth: 160, fontSize: 14, fontWeight: 600, lineHeight: 1.35 }}>
                                  {row.centreLabel}
                                </td>
                              )}
                              {row.categorySpan > 0 && (
                                <td rowSpan={row.categorySpan} className={styles.mergedCell} style={{ fontWeight: 700, backgroundColor: CATEGORY_COLORS[row.fs.category] || 'var(--border)', color: 'white', borderLeft: 'none' }}>
                                  {row.fs.category}
                                </td>
                              )}
                              {row.sessionSpan > 0 && (
                                <td rowSpan={row.sessionSpan} className={styles.mergedCell} style={{ fontStyle: 'italic' }}>
                                  {row.sesLabel}
                                </td>
                              )}

                              <td onClick={() => setDetailSession(fs)} style={{ cursor: 'pointer' }}>
                                {formatTime(slot.startTime)} – {formatTime(slot.endTime)}
                              </td>
                              <td onClick={() => setDetailSession(fs)} style={{ cursor: 'pointer', fontWeight: 510, fontSize: 13 }}>
                                {cls.name}
                              </td>
                              <td onClick={() => setDetailSession(fs)} style={{ cursor: 'pointer' }}>
                                <span className={styles.reasonTag}>{cls.course?.shortName || '—'}</span>
                              </td>
                              <td onClick={() => setDetailSession(fs)} style={{ fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                {mainTeacher}
                              </td>
                              <td onClick={() => setDetailSession(fs)} style={{ textAlign: 'center', cursor: 'pointer' }}>
                                {activeStudents}
                              </td>
                              <td onClick={e => e.stopPropagation()}>
                                <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'center' }}>
                                  {hasMyRequest ? (
                                    fs.myRequest?.status === 'pending' ? (
                                      <button
                                        onClick={() => handleCancelRequest(fs)}
                                        disabled={submitting}
                                        className={styles.clearCacheBtn}
                                        style={{ padding: '6px 12px', fontSize: 12, minWidth: 'auto', color: 'var(--status-warning)' }}
                                      >
                                        Huỷ yêu cầu
                                      </button>
                                    ) : fs.myRequest?.status === 'approved' ? (
                                      <span style={{ color: '#065f46', fontSize: 12, fontWeight: 510 }}>Đã được duyệt</span>
                                    ) : (
                                      <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>Đã từ chối</span>
                                    )
                                  ) : (
                                    <button
                                      onClick={() => handleRequestJudge(fs)}
                                      disabled={submitting}
                                      className={styles.clearCacheBtn}
                                      style={{ padding: '6px 12px', fontSize: 12, minWidth: 'auto' }}
                                    >
                                      Yêu cầu làm giám khảo
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
                title={detailSession.class.name}
                subtitle={`Buổi cuối · ${detailSession.class.centre?.name || ''}`}
                onClose={() => setDetailSession(null)}
              />
              {renderDetail(detailSession)}
            </>
          )}
        </Modal>
      </UserLayout>
    </AuthenticatedPage>
  );
}
