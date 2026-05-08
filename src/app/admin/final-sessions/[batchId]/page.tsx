'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PageLayout } from '@/components/PageLayout';
import { useAuth } from '@/lib/AuthContext';
import { BatchStatusBadge, Badge, CourseCategoryBadge, DateMarkerBadge, useToast, ToastContainer, Modal, ModalHeader, ModalFooter, EmptyState, Toolbar, SortIcon, TableGroupHeader } from '@/components/ui';
import { motion, AnimatePresence } from 'framer-motion';
import { authFetch } from '@/lib/auth/clientAuth';
import { fetchAllClasses, haveSlotInToUtcRange } from '@/services/classesService';
import { getCourseCategory } from '@/lib/courseCategories';
import type { Class, Session } from '@/types/classes';
import styles from '@/app/dashboard.module.css';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FinalSession {
  id: string;
  lms_class_id: string;
  lms_slot_id: string;
  class_name: string;
  course_short_name: string | null;
  centre_name: string | null;
  category: string | null;
  session_date: string;
  start_time_utc: string | null;
  end_time_utc: string | null;
  main_teacher: string | null;
  student_count: number;
  notes: string | null;
  judge_requests: any[];
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

// Candidate to add from LMS
interface LmsCandidate {
  cls: Class;
  slot: Session;
  category: string;
  mainTeacher: string;
  studentCount: number;
  alreadyAdded: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit',
    }).format(new Date(iso));
  } catch { return '—'; }
}

const WEEKDAYS = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

function formatDate(ymd: string): string {
  if (!ymd) return '';
  const [yyyy, mm, dd] = ymd.split('-');
  return `${dd}/${mm}/${yyyy}`;
}

function formatDateWithDay(ymd: string): { date: string; weekday: string } {
  if (!ymd) return { date: '', weekday: '' };
  const [yyyy, mm, dd] = ymd.split('-');
  const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  return { date: `${dd}/${mm}`, weekday: WEEKDAYS[d.getDay()] };
}

function todayVN(): string {
  const now = new Date();
  const v = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
  return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
}

function dateKey(iso: string): string {
  const d = new Date(iso);
  const v = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
  return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
}

function getMainTeacher(cls: Class, slot: Session): string {
  const teachers = (slot.teachers?.length ? slot.teachers : cls.teachers || []).filter(t => t.isActive);
  if (!teachers.length) return '—';
  const main = teachers.find(t => t.role?.name?.includes('Chính') || t.role?.shortName === 'GVC') || teachers[0];
  return main.teacher?.fullName || '—';
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BatchDetailPage() {
  const params = useParams();
  const batchId = params.batchId as string;
  const router = useRouter();
  const { session } = useAuth();
  const { toasts, addToast, removeToast } = useToast();

  const [batch, setBatch] = useState<Batch | null>(null);
  const [loading, setLoading] = useState(true);

  const lmsAbortRef = useRef<AbortController | null>(null);

  // LMS fetch panel
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [centres, setCentres] = useState<any[]>([]);
  const [lmsSelectedCentres, setLmsSelectedCentres] = useState<string[]>([]);
  const [lmsProgress, setLmsProgress] = useState({ loaded: 0, total: 0 });
  const [lmsLoading, setLmsLoading] = useState(false);
  const [candidates, setCandidates] = useState<LmsCandidate[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set()); // lms_slot_id
  const [lmsDateFrom, setLmsDateFrom] = useState('');
  const [lmsDateTo, setLmsDateTo] = useState('');
  const [saving, setSaving] = useState(false);

  const loadBatch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`/api/admin/judge-batches/${batchId}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      setBatch(json.data);
      // Pre-fill LMS date range from batch week
      setLmsDateFrom(json.data.week_from);
      setLmsDateTo(json.data.week_to);
    } catch {
      addToast('Không thể tải đợt', 'error');
    } finally {
      setLoading(false);
    }
  }, [batchId]);

  useEffect(() => { loadBatch(); }, [loadBatch]);

  useEffect(() => {
    (async () => {
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
    })();
  }, []);

  // ─── LMS fetch ────────────────────────────────────────────────────────────

  function handleCancelLmsFetch() {
    if (lmsAbortRef.current) {
      lmsAbortRef.current.abort();
      lmsAbortRef.current = null;
      setLmsLoading(false);
    }
  }

  async function fetchFromLms() {
    if (!lmsDateFrom || !lmsDateTo) { addToast('Chọn khoảng thời gian', 'error'); return; }
    if (lmsAbortRef.current) lmsAbortRef.current.abort();
    lmsAbortRef.current = new AbortController();
    const signal = lmsAbortRef.current.signal;

    setLmsLoading(true);
    setLmsProgress({ loaded: 0, total: 0 });
    setCandidates([]);
    setSelected(new Set());

    const alreadyAddedSlotIds = new Set((batch?.sessions || []).map(s => s.lms_slot_id));

    try {
      const { from: slotFrom, to: slotTo } = haveSlotInToUtcRange(
        new Date(lmsDateFrom),
        new Date(lmsDateTo),
      );
      const centreIds = lmsSelectedCentres.length > 0
        ? lmsSelectedCentres
        : centres.map((c: any) => c.id);

      const found: LmsCandidate[] = [];

      await fetchAllClasses(
        { centres: centreIds, haveSlotIn: { from: slotFrom, to: slotTo } },
        (loaded, total, chunk) => {
          setLmsProgress({ loaded, total });
          for (const cls of chunk) {
            if (!cls.slots?.length) continue;
            const sorted = [...cls.slots].sort((a, b) =>
              new Date(a.date).getTime() - new Date(b.date).getTime()
            );
            const lastSlot = sorted[sorted.length - 1];
            if (!lastSlot) continue;
            const slotKey = dateKey(lastSlot.date);
            if (slotKey < lmsDateFrom || slotKey > lmsDateTo) continue;

            found.push({
              cls,
              slot: lastSlot,
              category: getCourseCategory(cls),
              mainTeacher: getMainTeacher(cls, lastSlot),
              studentCount: cls.students?.filter(s => s.activeInClass).length || 0,
              alreadyAdded: alreadyAddedSlotIds.has(lastSlot._id),
            });
          }
          setCandidates([...found]);
        },
        signal,
      );

      if (!signal.aborted && found.length === 0) addToast('Không tìm thấy buổi cuối khoá trong khoảng này', 'info');
    } catch (err: any) {
      if (!signal.aborted) addToast('Lỗi khi tải dữ liệu từ LMS', 'error');
    } finally {
      if (!signal.aborted) setLmsLoading(false);
    }
  }

  function toggleSelect(slotId: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(slotId) ? next.delete(slotId) : next.add(slotId);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(candidates.filter(c => !c.alreadyAdded).map(c => c.slot._id)));
  }

  async function addSelected() {
    if (selected.size === 0) { addToast('Chưa chọn buổi nào', 'info'); return; }
    setSaving(true);
    try {
      const sessions = candidates
        .filter(c => selected.has(c.slot._id))
        .map(c => ({
          lms_class_id: c.cls.id,
          lms_slot_id: c.slot._id,
          class_name: c.cls.name,
          course_short_name: c.cls.course?.shortName || null,
          centre_id: c.cls.centre?.id || null,
          centre_name: c.cls.centre?.name || null,
          category: c.category,
          session_date: dateKey(c.slot.date),
          start_time_utc: c.slot.startTime || null,
          end_time_utc: c.slot.endTime || null,
          main_teacher: c.mainTeacher !== '—' ? c.mainTeacher : null,
          student_count: c.studentCount,
        }));

      const res = await authFetch(`/api/admin/judge-batches/${batchId}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessions }),
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      addToast(`Đã thêm ${json.inserted} buổi vào đợt`, 'success');
      setShowAddPanel(false);
      await loadBatch();
    } catch {
      addToast('Không thể thêm buổi', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function removeSession(sessionId: string) {
    if (!confirm('Xoá buổi này khỏi đợt?')) return;
    try {
      await authFetch(`/api/admin/judge-batches/${batchId}/sessions?sessionId=${sessionId}`, {
        method: 'DELETE',
      });
      addToast('Đã xoá buổi', 'success');
      await loadBatch();
    } catch {
      addToast('Không thể xoá buổi', 'error');
    }
  }

  function copyLink() {
    if (!batch) return;
    const url = `${window.location.origin}/judge-requests/${batch.slug}`;
    navigator.clipboard.writeText(url).then(() => addToast('Đã copy link', 'success'));
  }

  // ─── Sort ─────────────────────────────────────────────────────────────────

  const [sortKey, setSortKey] = useState('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  function handleSort(key: string) {
    setSortDir(prev => (sortKey === key ? (prev === 'asc' ? 'desc' : 'asc') : 'asc'));
    setSortKey(key);
  }

  // ─── Sorted sessions ──────────────────────────────────────────────────────

  const sortedSessions = useMemo(() => {
    const list = [...(batch?.sessions || [])];
    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'date') {
        cmp = a.session_date.localeCompare(b.session_date);
        if (cmp === 0) cmp = (a.start_time_utc || '').localeCompare(b.start_time_utc || '');
      } else if (sortKey === 'centre') {
        cmp = (a.centre_name || '').localeCompare(b.centre_name || '');
      } else if (sortKey === 'category') {
        cmp = (a.category || '').localeCompare(b.category || '');
      } else if (sortKey === 'name') {
        cmp = a.class_name.localeCompare(b.class_name);
      } else if (sortKey === 'teacher') {
        cmp = (a.main_teacher || '').localeCompare(b.main_teacher || '');
      } else if (sortKey === 'students') {
        cmp = a.student_count - b.student_count;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [batch, sortKey, sortDir]);

  // ─── Candidates sorted ────────────────────────────────────────────────────

  const sortedCandidates = useMemo(() =>
    [...candidates].sort((a, b) => {
      const da = dateKey(a.slot.date);
      const db = dateKey(b.slot.date);
      if (da !== db) return da.localeCompare(db);
      return (a.slot.startTime || '').localeCompare(b.slot.startTime || '');
    }),
  [candidates]);

  if (loading) {
    return (
      <PageLayout title="Giám khảo Cuối khoá" activePage="final-sessions">
        <div style={{ padding: 'var(--space-6)', color: 'var(--text-secondary)' }}>Đang tải...</div>
      </PageLayout>
    );
  }

  if (!batch) {
    return (
      <PageLayout title="Giám khảo Cuối khoá" activePage="final-sessions">
        <div style={{ padding: 'var(--space-6)', color: 'var(--text-secondary)' }}>Không tìm thấy đợt</div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="Giám khảo Cuối khoá" activePage="final-sessions">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Back + Batch header */}
      <div style={{ marginBottom: 'var(--space-5)' }}>
        <button
          onClick={() => router.push('/admin/final-sessions')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, padding: 0, marginBottom: 'var(--space-3)' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Danh sách đợt
        </button>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{batch.title}</h2>
	              <BatchStatusBadge active={batch.is_active} />
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
              {formatDate(batch.week_from)} – {formatDate(batch.week_to)}
              <span style={{ marginLeft: 12, color: 'var(--text-tertiary)' }}>/{batch.slug}</span>
            </div>
            {batch.notes && <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4, fontStyle: 'italic' }}>{batch.notes}</div>}
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button className={styles.clearCacheBtn} style={{ fontSize: 13, padding: '7px 14px' }} onClick={copyLink}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 5 }}>
                <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              Copy link
            </button>
            <button className={styles.primaryBtn} style={{ fontSize: 13, padding: '7px 14px' }} onClick={() => setShowAddPanel(true)}>
              + Thêm buổi từ LMS
            </button>
          </div>
        </div>
      </div>

      {/* Sessions table */}
      {sortedSessions.length === 0 ? (
        <EmptyState
          icon={<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg>}
          title="Chưa có buổi nào"
          subtitle={'Nhấn "Thêm buổi từ LMS" để tải và chọn'}
        />
      ) : (
        <div className={styles.tableSection}>
          <TableGroupHeader
            title="Buổi cuối khoá"
            count={sortedSessions.length}
            isExpanded={true}
            onToggle={() => {}}
          />
          <div className={styles.tableScrollWrapper}>
            {/* Header */}
            <div className={styles.classItemHeader} style={{ gridTemplateColumns: 'minmax(0,1.1fr) minmax(0,1.2fr) minmax(0,0.7fr) minmax(0,2fr) minmax(0,0.9fr) minmax(0,1.4fr) 64px minmax(0,1.3fr) 60px', minWidth: 860 }}>
              <div className={`${styles.sortableCol} ${sortKey === 'date' ? styles.activeSort : ''}`} onClick={() => handleSort('date')}>Ngày <SortIcon col="date" sortKey={sortKey} sortDir={sortDir} /></div>
              <div className={`${styles.sortableCol} ${sortKey === 'centre' ? styles.activeSort : ''}`} onClick={() => handleSort('centre')}>Cơ sở <SortIcon col="centre" sortKey={sortKey} sortDir={sortDir} /></div>
              <div className={`${styles.sortableCol} ${sortKey === 'category' ? styles.activeSort : ''}`} onClick={() => handleSort('category')}>Khối <SortIcon col="category" sortKey={sortKey} sortDir={sortDir} /></div>
              <div className={`${styles.sortableCol} ${sortKey === 'name' ? styles.activeSort : ''}`} onClick={() => handleSort('name')}>Tên lớp <SortIcon col="name" sortKey={sortKey} sortDir={sortDir} /></div>
              <div>Giờ</div>
              <div className={`${styles.sortableCol} ${sortKey === 'teacher' ? styles.activeSort : ''}`} onClick={() => handleSort('teacher')}>Giáo viên chính <SortIcon col="teacher" sortKey={sortKey} sortDir={sortDir} /></div>
              <div className={`${styles.sortableCol} ${sortKey === 'students' ? styles.activeSort : ''}`} onClick={() => handleSort('students')} style={{ justifyContent: 'center' }}>Học sinh <SortIcon col="students" sortKey={sortKey} sortDir={sortDir} /></div>
              <div>Giám khảo</div>
              <div></div>
            </div>

            {/* Rows */}
            <AnimatePresence initial={false}>
              {sortedSessions.map((s, idx) => {
                const { date, weekday } = formatDateWithDay(s.session_date);
                const today = todayVN();
                const isPast = s.session_date < today;
                const isToday = s.session_date === today;
                const approved = s.judge_requests?.find((r: any) => r.status === 'approved');
                const pending = s.judge_requests?.filter((r: any) => r.status === 'pending') ?? [];
                return (
                  <motion.div
                    key={s.id}
                    className={styles.classItem}
                    style={{ gridTemplateColumns: 'minmax(0,1.1fr) minmax(0,1.2fr) minmax(0,0.7fr) minmax(0,2fr) minmax(0,0.9fr) minmax(0,1.4fr) 64px minmax(0,1.3fr) 60px', minWidth: 860, opacity: isPast ? 0.6 : 1 }}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: isPast ? 0.6 : 1, y: 0 }}
                    transition={{ duration: 0.18, delay: Math.min(idx * 0.015, 0.3) }}
                  >
                    <div style={{ whiteSpace: 'nowrap' }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{weekday}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{date}</div>
                      {isPast && (
	                        <DateMarkerBadge status="past" />
                      )}
                      {isToday && (
	                        <DateMarkerBadge status="today" />
                      )}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{s.centre_name || '—'}</div>
                    <div>
                      <CourseCategoryBadge category={s.category} />
                    </div>
                    <div className={styles.className}>{s.class_name}</div>
                    <div style={{ whiteSpace: 'nowrap', fontSize: 13, color: 'var(--text-secondary)' }}>
                      {formatTime(s.start_time_utc)} – {formatTime(s.end_time_utc)}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{s.main_teacher || '—'}</div>
                    <div style={{ textAlign: 'center', fontSize: 13 }}>{s.student_count}</div>
                    <div>
                      {approved ? (
	                        <Badge variant="passed" size="sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
	                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
	                          {approved.teacher_name || approved.teacher_email}
	                        </Badge>
	                      ) : pending.length > 0 ? (
	                        <Badge variant="warning" size="sm">
	                          {pending.length} chờ duyệt
	                        </Badge>
                      ) : (
                        <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>Chưa có</span>
                      )}
                    </div>
                    <div>
                      <button
                        className={styles.clearCacheBtn}
                        style={{ fontSize: 11, padding: '3px 8px', color: 'var(--status-error)' }}
                        onClick={() => removeSession(s.id)}
                      >
                        Xoá
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Add sessions panel (full modal) */}
      <Modal open={showAddPanel} onClose={() => setShowAddPanel(false)}>
        <ModalHeader
          title="Thêm buổi cuối khoá từ LMS"
          subtitle="Hệ thống tải lớp có slot trong khoảng chọn và lọc buổi cuối"
          onClose={() => setShowAddPanel(false)}
        />

        {/* Filters */}
        <Toolbar
          centres={centres}
          selectedCentres={lmsSelectedCentres}
          onCentresChange={setLmsSelectedCentres}
          centresLoading={false}
          dateFrom={lmsDateFrom}
          dateTo={lmsDateTo}
          onDateFromChange={setLmsDateFrom}
          onDateToChange={setLmsDateTo}
          onFetch={fetchFromLms}
          onCancel={handleCancelLmsFetch}
          onClearCache={() => { setCandidates([]); setSelected(new Set()); }}
          loading={lmsLoading}
          progress={lmsProgress}
          hasData={candidates.length > 0}
        />

        {/* Candidate list */}
        <div style={{ maxHeight: '55vh', overflowY: 'auto' }}>
          {candidates.length === 0 && !lmsLoading && (
            <EmptyState
              icon={<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg>}
              title="Chưa có dữ liệu"
              subtitle='Chọn cơ sở, khoảng ngày rồi nhấn "Tải dữ liệu"'
            />
          )}
          {candidates.length > 0 && (
            <>
              <div style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {sortedCandidates.filter(c => !c.alreadyAdded).length} buổi khả dụng · {selected.size} đã chọn
                </span>
                <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--brand-indigo)', padding: 0 }} onClick={selectAll}>
                  Chọn tất cả
                </button>
              </div>
              <div className={styles.classItemHeader} style={{ gridTemplateColumns: '36px minmax(0,0.9fr) minmax(0,2fr) minmax(0,1.3fr) minmax(0,0.7fr) minmax(0,0.9fr) minmax(0,1.4fr) 64px', minWidth: 640 }}>
                <div></div>
                <div>Ngày</div>
                <div>Lớp</div>
                <div>Cơ sở</div>
                <div>Khối</div>
                <div>Giờ</div>
                <div>Giáo viên chính</div>
                <div style={{ textAlign: 'center' }}>Học sinh</div>
              </div>
              {sortedCandidates.map(c => {
                const slotId = c.slot._id;
                const isSelected = selected.has(slotId);
                return (
                  <div
                    key={slotId}
                    className={styles.classItem}
                    style={{
                      gridTemplateColumns: '36px minmax(0,0.9fr) minmax(0,2fr) minmax(0,1.3fr) minmax(0,0.7fr) minmax(0,0.9fr) minmax(0,1.4fr) 64px',
                      minWidth: 640,
                      opacity: c.alreadyAdded ? 0.4 : 1,
                      background: isSelected ? 'rgba(59,130,246,0.08)' : undefined,
                      cursor: c.alreadyAdded ? 'default' : 'pointer',
                    }}
                    onClick={() => !c.alreadyAdded && toggleSelect(slotId)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {c.alreadyAdded ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--status-success)" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                      ) : (
                        <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(slotId)} onClick={e => e.stopPropagation()} />
                      )}
                    </div>
                    <div style={{ fontSize: 12, whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>{formatDate(dateKey(c.slot.date))}</div>
                    <div style={{ fontSize: 12, fontWeight: 510 }}>{c.cls.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{c.cls.centre?.name || '—'}</div>
                    <div>
                      <CourseCategoryBadge category={c.category} />
                    </div>
                    <div style={{ fontSize: 12, whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                      {formatTime(c.slot.startTime)} – {formatTime(c.slot.endTime)}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{c.mainTeacher}</div>
                    <div style={{ textAlign: 'center', fontSize: 12 }}>{c.studentCount}</div>
                  </div>
                );
              })}
            </>
          )}
        </div>

        <ModalFooter
          primaryButton={{
            label: `Thêm ${selected.size} buổi vào đợt`,
            variant: 'primary',
            loading: saving,
            loadingText: 'Đang thêm...',
            disabled: saving || selected.size === 0,
            onClick: addSelected,
          }}
          secondaryButton={{ label: 'Đóng', variant: 'secondary', onClick: () => setShowAddPanel(false) }}
        />
      </Modal>
    </PageLayout>
  );
}
