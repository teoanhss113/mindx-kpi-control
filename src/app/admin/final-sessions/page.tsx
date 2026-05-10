'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { PageLayout } from '@/components/PageLayout';
import {
  useToast, ToastContainer, Toolbar, TableGroupHeader, EmptyState, Modal, ModalHeader, ModalFooter, SortIcon, Badge,
  AttendanceSessionCell, AttendanceStatusBadge, CommentStatusBadge, isAttendanceStatus,
  BatchStatusBadge, COMMENT_STATUS_COUNT_LABELS, CourseCategoryBadge, RescheduleStatusBadge,
  Icon, TableActionButton, TableActionGroup,
} from '@/components/ui';
import { authFetch } from '@/lib/auth/clientAuth';
import { dateRangeToUtcRange, fetchAllClasses } from '@/services/classesService';
import { getCourseCategory } from '@/lib/courseCategories';
import { analyzeClassQuality } from '@/lib/classQualityAnalysis';
import { getRankColor } from '@/lib/courseGrading';
import { getStudentAttendanceCommentContent, stripCommentHtml } from '@/lib/commentContent';
import { COURSE_CATEGORY_COLORS, COURSE_CATEGORY_ORDER, LABELS, MESSAGES } from '@/constants';
import type { Class, Session, StudentAttendance, TeacherSlot } from '@/types/classes';
import type { StudentCheckpointScore, StudentDemoScore } from '@/types/classQuality';
import type { Centre } from '@/services/centresService';
import { motion, AnimatePresence } from 'framer-motion';
import styles from '@/app/dashboard.module.css';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Candidate {
  cls: Class;
  slot: Session;
  category: string;
  mainTeacher: string;
  studentCount: number;
}

interface Dot {  // "đợt"
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

// ─── Constants ────────────────────────────────────────────────────────────────

const SESSION_ORDER: Record<string, number>  = { Sáng: 0, Chiều: 1, Tối: 2 };
const DOW_VI = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtTime(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit',
    }).format(new Date(iso));
  } catch { return '—'; }
}

function fmtDateYMD(ymd: string): string {
  if (!ymd) return '';
  const [y, m, d] = ymd.split('-');
  return `${d}/${m}/${y}`;
}

function dateKey(iso: string): string {
  const d = new Date(iso);
  const v = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
  return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
}

function sessionLabel(endIso: string | null): 'Sáng' | 'Chiều' | 'Tối' {
  if (!endIso) return 'Sáng';
  const h = parseInt(
    new Intl.DateTimeFormat('vi-VN', { hour: 'numeric', timeZone: 'Asia/Ho_Chi_Minh', hour12: false }).format(new Date(endIso)),
    10,
  );
  return h <= 12 ? 'Sáng' : h <= 18 ? 'Chiều' : 'Tối';
}

function getMainTeacher(cls: Class, slot: Session): string {
  const ts = (slot.teachers?.length ? slot.teachers : cls.teachers || []).filter(t => t.isActive);
  if (!ts.length) return '—';
  const main = ts.find(t => t.role?.name?.includes('Chính') || t.role?.shortName === 'GVC') || ts[0];
  return main.teacher?.fullName || '—';
}

function stripHtml(value: string): string {
  return stripCommentHtml(value);
}

type ModalCheckpointStudent = (StudentCheckpointScore | StudentDemoScore) & {
  checkpointScore?: number | null;
  demoScore?: number | null;
  tbck?: number | null;
  rank?: 'A' | 'B' | 'C' | 'D' | null;
};

function getTeacherRoleShortName(t: TeacherSlot): string {
  const r = t.role as TeacherSlot['role'] | string | null | undefined;
  if (!r) return '';
  const raw = typeof r === 'string' ? r : (r.shortName ?? r.name ?? '');
  return raw.toUpperCase();
}

function getJudgeTeacher(slot: Session): string | null {
  const ts = slot.teachers || [];
  const judge = ts.find(t => getTeacherRoleShortName(t) === 'JUDGE');
  return judge?.teacher?.fullName || null;
}

function autoSlug(from: string): string {
  if (!from) return '';
  const [y, m, d] = from.split('-');
  return `dot-${d}-${m}-${y}`;
}

function autoTitle(from: string, to: string): string {
  if (!from || !to) return '';
  return `Đợt ${fmtDateYMD(from)} – ${fmtDateYMD(to)}`;
}

function getDefaultWeekRange(): { from: string; to: string } {
  const now = new Date();
  const vn = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
  const day = vn.getDay();
  const mon = new Date(vn); mon.setDate(vn.getDate() - (day === 0 ? 6 : day - 1));
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  return { from: fmt(mon), to: fmt(sun) };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FinalSessionsAdminPage() {
  const router = useRouter();
  const { toasts, addToast, removeToast } = useToast();

  const abortRef = useRef<AbortController | null>(null);

  // Toolbar state
  const [centres, setCentres] = useState<Centre[]>([]);
  const [selectedCentres, setSelectedCentres] = useState<string[]>([]);
  const defaultWeek = useMemo(() => getDefaultWeekRange(), []);
  const [dateFrom, setDateFrom] = useState(defaultWeek.from);
  const [dateTo, setDateTo] = useState(defaultWeek.to);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ loaded: 0, total: 0 });
  const [fetchedOnce, setFetchedOnce] = useState(false);

  // LMS candidates
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [showCandidates, setShowCandidates] = useState(true);

  // Sort
  const [sortKey, setSortKey] = useState('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Row detail modal
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [candidateModalTab, setCandidateModalTab] = useState<'students' | 'comments' | 'schedule' | 'checkpoints'>('students');
  const [commentSessionIndex, setCommentSessionIndex] = useState<number | null>(null);

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set()); // slot._id

  // Existing đợt
  const [dots, setDots] = useState<Dot[]>([]);
  const [dotsLoading, setDotsLoading] = useState(true);
  const [showDots, setShowDots] = useState(true);


  // Create đợt modal
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', slug: '', weekFrom: '', weekTo: '', notes: '' });
  const [saving, setSaving] = useState(false);

  // Load centres
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

  // Load existing đợt
  const loadDots = useCallback(async () => {
    setDotsLoading(true);
    try {
      const res = await authFetch('/api/admin/judge-batches');
      const json = await res.json();
      setDots(json.data || []);
    } catch { addToast('Không thể tải danh sách đợt', 'error'); }
    finally { setDotsLoading(false); }
  }, [addToast]);

  useEffect(() => {
    queueMicrotask(() => { void loadDots(); });
  }, [loadDots]);

  // ─── LMS fetch ────────────────────────────────────────────────────────────

  async function handleFetch() {
    if (!dateFrom || !dateTo) { addToast('Chọn khoảng thời gian', 'error'); return; }
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;

    setLoading(true);
    setProgress({ loaded: 0, total: 0 });
    setCandidates([]);
    setSelected(new Set());
    setFetchedOnce(false);
    const tid = addToast(MESSAGES.LOADING.CONNECTING, 'loading');

    const centreIds = selectedCentres.length > 0 ? selectedCentres : centres.map(c => c.id);
    const { endDateFrom, endDateTo } = dateRangeToUtcRange(
      new Date(dateFrom),
      new Date(dateTo),
    );

    // The LMS filters by class end date, so this only loads classes whose final
    // session is expected in the selected window.
    const accumulated: Candidate[] = [];

    try {
      await fetchAllClasses(
        { centres: centreIds, endDateFrom, endDateTo },
        (loaded, total, chunk) => {
          setProgress({ loaded, total });
          for (const cls of chunk) {
            if (!cls.slots?.length) continue;
            const sorted = [...cls.slots].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            const last = sorted[sorted.length - 1];
            if (!last) continue;
            const lastSlotKey = dateKey(last.date);
            if (lastSlotKey < dateFrom || lastSlotKey > dateTo) continue;
            accumulated.push({
              cls, slot: last,
              category: getCourseCategory(cls),
              mainTeacher: getMainTeacher(cls, last),
              studentCount: cls.students?.filter(s => s.activeInClass).length || 0,
            });
          }
          setCandidates([...accumulated]);
        },
        signal,
      );
      if (!signal.aborted) {
        removeToast(tid);
        setFetchedOnce(true);
        const finalCount = accumulated.length;
        if (finalCount === 0) addToast('Không tìm thấy buổi cuối khoá trong khoảng này', 'info');
        else addToast(MESSAGES.LOADING.SUCCESS(finalCount, 'buổi cuối khoá'), 'success');
      }
    } catch {
      if (signal.aborted) {
        removeToast(tid);
        addToast(MESSAGES.LOADING.STOPPED, 'info');
      } else {
        removeToast(tid);
        addToast('Lỗi khi tải dữ liệu từ LMS', 'error');
      }
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }

  function handleCancelFetch() {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
      setLoading(false);
      setFetchedOnce(true);
    }
  }

  // ─── Selection ────────────────────────────────────────────────────────────

  function handleSort(key: string) {
    setSortDir(prev => (sortKey === key ? (prev === 'asc' ? 'desc' : 'asc') : 'asc'));
    setSortKey(key);
  }

  const sortedCandidates = useMemo(() => {
    // During loading show all accumulated so rows appear progressively.
    // Once loading completes, narrow to final sessions (last slot in selected range).
    const filtered = loading
      ? candidates
      : candidates.filter(c => {
          const dk = dateKey(c.slot.date);
          return dk >= dateFrom && dk <= dateTo;
        });

    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'date') {
        const da = dateKey(a.slot.date), db = dateKey(b.slot.date);
        cmp = da.localeCompare(db);
        if (cmp === 0) {
          const ca = COURSE_CATEGORY_ORDER[a.category as keyof typeof COURSE_CATEGORY_ORDER] ?? 99, cb = COURSE_CATEGORY_ORDER[b.category as keyof typeof COURSE_CATEGORY_ORDER] ?? 99;
          cmp = ca - cb;
        }
        if (cmp === 0) {
          const sa = SESSION_ORDER[sessionLabel(a.slot.endTime)] ?? 99;
          const sb = SESSION_ORDER[sessionLabel(b.slot.endTime)] ?? 99;
          cmp = sa - sb;
        }
        if (cmp === 0) cmp = (a.slot.startTime || '').localeCompare(b.slot.startTime || '');
      } else if (sortKey === 'centre') {
        cmp = (a.cls.centre?.name || '').localeCompare(b.cls.centre?.name || '');
      } else if (sortKey === 'category') {
        cmp = (COURSE_CATEGORY_ORDER[a.category as keyof typeof COURSE_CATEGORY_ORDER] ?? 99) - (COURSE_CATEGORY_ORDER[b.category as keyof typeof COURSE_CATEGORY_ORDER] ?? 99);
      } else if (sortKey === 'name') {
        cmp = a.cls.name.localeCompare(b.cls.name);
      } else if (sortKey === 'teacher') {
        cmp = a.mainTeacher.localeCompare(b.mainTeacher);
      } else if (sortKey === 'students') {
        cmp = a.studentCount - b.studentCount;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [candidates, dateFrom, dateTo, sortKey, sortDir, loading]);

  function toggleSelect(slotId: string) {
    setSelected(prev => {
      const n = new Set(prev);
      if (n.has(slotId)) n.delete(slotId);
      else n.add(slotId);
      return n;
    });
  }
  function selectAll() { setSelected(new Set(sortedCandidates.map(c => c.slot._id))); }
  function clearAll()  { setSelected(new Set()); }

  // ─── Open create modal ────────────────────────────────────────────────────

  function openCreate() {
    setForm({
      title: autoTitle(dateFrom, dateTo),
      slug: autoSlug(dateFrom),
      weekFrom: dateFrom,
      weekTo: dateTo,
      notes: '',
    });
    setShowCreate(true);
  }

  // ─── Create đợt ──────────────────────────────────────────────────────────

  async function handleCreate() {
    if (!form.title || !form.slug || !form.weekFrom || !form.weekTo) {
      addToast('Vui lòng điền đầy đủ thông tin', 'error');
      return;
    }
    setSaving(true);
    try {
      // 1. Create đợt
      const bRes = await authFetch('/api/admin/judge-batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: form.slug.trim(),
          title: form.title.trim(),
          week_from: form.weekFrom,
          week_to: form.weekTo,
          notes: form.notes.trim() || null,
        }),
      });
      if (bRes.status === 409) { addToast('Đường dẫn đã tồn tại, hãy đổi sang giá trị khác', 'error'); return; }
      if (!bRes.ok) throw new Error();
      const { data: dot } = await bRes.json();

      // 2. Add selected sessions
      if (selected.size > 0) {
        const sessions = sortedCandidates
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

        await authFetch(`/api/admin/judge-batches/${dot.id}/sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessions }),
        });
      }

      addToast(`Đã tạo đợt "${form.title}" với ${selected.size} buổi`, 'success');
      setShowCreate(false);
      setSelected(new Set());
      await loadDots();
      router.push(`/admin/final-sessions/${dot.id}`);
    } catch {
      addToast('Không thể tạo đợt', 'error');
    } finally { setSaving(false); }
  }

  // ─── đợt management ──────────────────────────────────────────────────────

  async function toggleActive(dot: Dot) {
    try {
      await authFetch(`/api/admin/judge-batches/${dot.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !dot.is_active }),
      });
      setDots(prev => prev.map(d => d.id === dot.id ? { ...d, is_active: !d.is_active } : d));
    } catch { addToast('Không thể cập nhật trạng thái', 'error'); }
  }

  async function deleteDot(dot: Dot) {
    if (!confirm(`Xoá đợt "${dot.title}"? Toàn bộ buổi và yêu cầu sẽ bị xoá.`)) return;
    try {
      await authFetch(`/api/admin/judge-batches/${dot.id}`, { method: 'DELETE' });
      setDots(prev => prev.filter(d => d.id !== dot.id));
      addToast('Đã xoá đợt', 'success');
    } catch { addToast('Không thể xoá đợt', 'error'); }
  }

  function copyLink(slug: string) {
    navigator.clipboard.writeText(`${window.location.origin}/judge-requests/${slug}`)
      .then(() => addToast('Đã sao chép link', 'success'));
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <PageLayout title="Giám khảo Cuối khoá" activePage="final-sessions">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Toolbar */}
      <Toolbar
        centres={centres}
        selectedCentres={selectedCentres}
        onCentresChange={setSelectedCentres}
        centresLoading={false}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        onFetch={handleFetch}
        onCancel={handleCancelFetch}
        onClearCache={() => { setCandidates([]); setSelected(new Set()); setFetchedOnce(false); addToast('Đã xoá kết quả', 'success'); }}
        loading={loading}
        progress={progress}
        hasData={candidates.length > 0}
        showRegionQuickSelect={true}
      />

      {/* ── No results empty state ── */}
      {fetchedOnce && !loading && candidates.length === 0 && (
        <EmptyState
          icon={<Icon.BookOpen size={40} />}
          title="Không tìm thấy buổi cuối khoá"
          subtitle="Thử điều chỉnh khoảng thời gian hoặc cơ sở"
        />
      )}

      {/* ── Candidates table ── */}
      {(candidates.length > 0 || loading) && (
        <div className={styles.tableSection} style={{ marginBottom: 'var(--space-5)' }}>
          <TableGroupHeader
            title="Buổi cuối khoá"
            count={candidates.length}
            loading={loading}
            progress={progress}
            isExpanded={showCandidates}
            onToggle={() => setShowCandidates(p => !p)}
          />

          <AnimatePresence initial={false}>
            {showCandidates && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>

                {/* Selection bar */}
                {candidates.length > 0 && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                    padding: '8px 16px', background: 'var(--bg-secondary)',
                    borderBottom: '1px solid var(--border-subtle)', flexWrap: 'wrap',
                  }}>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)', flex: 1 }}>
                      {selected.size > 0
                        ? <><strong style={{ color: 'var(--text-primary)' }}>{selected.size}</strong> / {candidates.length} buổi đã chọn</>
                        : `${candidates.length} buổi — chọn để đưa vào đợt`}
                    </span>
                    <button
                      className={styles.textActionBtn}
                      onClick={selected.size === candidates.length ? clearAll : selectAll}
                    >
                      {selected.size === candidates.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                    </button>
                    {selected.size > 0 && (
                      <button
                        className={styles.primaryBtn}
                        style={{ fontSize: 12, padding: '6px 14px' }}
                        onClick={openCreate}
                      >
                        Tạo đợt với {selected.size} buổi →
                      </button>
                    )}
                  </div>
                )}

                <div className={styles.tableScrollWrapper}>
                  {/* Header row */}
                  <div className={styles.classItemHeader} style={{ gridTemplateColumns: '36px minmax(0,0.9fr) minmax(0,1.3fr) minmax(0,0.65fr) minmax(0,0.85fr) minmax(0,1.8fr) minmax(0,1.2fr) 60px minmax(0,1.2fr)', minWidth: 900 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <input
                        type="checkbox"
                        checked={selected.size === sortedCandidates.length && sortedCandidates.length > 0}
                        onChange={selected.size === sortedCandidates.length ? clearAll : selectAll}
                      />
                    </div>
                    <div className={`${styles.sortableCol} ${sortKey === 'date' ? styles.activeSort : ''}`} onClick={() => handleSort('date')}>Ngày <SortIcon col="date" sortKey={sortKey} sortDir={sortDir} /></div>
                    <div className={`${styles.sortableCol} ${sortKey === 'centre' ? styles.activeSort : ''}`} onClick={() => handleSort('centre')}>Cơ sở <SortIcon col="centre" sortKey={sortKey} sortDir={sortDir} /></div>
                    <div className={`${styles.sortableCol} ${sortKey === 'category' ? styles.activeSort : ''}`} onClick={() => handleSort('category')}>Khối <SortIcon col="category" sortKey={sortKey} sortDir={sortDir} /></div>
                    <div>Giờ</div>
                    <div className={`${styles.sortableCol} ${sortKey === 'name' ? styles.activeSort : ''}`} onClick={() => handleSort('name')}>Tên lớp <SortIcon col="name" sortKey={sortKey} sortDir={sortDir} /></div>
                    <div className={`${styles.sortableCol} ${sortKey === 'teacher' ? styles.activeSort : ''}`} onClick={() => handleSort('teacher')}>Giáo viên chính <SortIcon col="teacher" sortKey={sortKey} sortDir={sortDir} /></div>
                    <div className={`${styles.sortableCol} ${sortKey === 'students' ? styles.activeSort : ''}`} onClick={() => handleSort('students')} style={{ justifyContent: 'center' }}>{LABELS.STUDENTS} <SortIcon col="students" sortKey={sortKey} sortDir={sortDir} /></div>
                    <div>Giám khảo</div>
                  </div>

                  {/* Skeleton rows while loading with no data yet */}
                  {loading && sortedCandidates.length === 0 && (
                    Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className={styles.skeletonRow}>
                        <div className={styles.skeletonBlock} style={{ width: '30%' }} />
                        <div className={styles.skeletonBlock} style={{ width: '50%' }} />
                        <div className={styles.skeletonBlock} style={{ width: '40%' }} />
                        <div className={styles.skeletonBlock} style={{ width: '65%' }} />
                      </div>
                    ))
                  )}

                  {/* Data rows */}
                  <AnimatePresence initial={false}>
                    {sortedCandidates.map((c, idx) => {
                      const dk = dateKey(c.slot.date);
                      const d = new Date(dk + 'T12:00:00');
                      const dow = DOW_VI[d.getDay()];
                      const [, m, day] = dk.split('-');
                      const isSelected = selected.has(c.slot._id);
                      return (
                        <motion.div
                          key={c.slot._id}
                          className={styles.classItem}
                          style={{
                            gridTemplateColumns: '36px minmax(0,0.9fr) minmax(0,1.3fr) minmax(0,0.65fr) minmax(0,0.85fr) minmax(0,1.8fr) minmax(0,1.2fr) 60px minmax(0,1.2fr)',
                            minWidth: 900,
                            background: isSelected ? 'rgba(59,130,246,0.07)' : undefined,
                          }}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.18, delay: Math.min(idx * 0.015, 0.3) }}
                          onClick={() => { setSelectedCandidate(c); setCommentSessionIndex(null); }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={e => { e.stopPropagation(); toggleSelect(c.slot._id); }}>
                            <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(c.slot._id)} onClick={e => e.stopPropagation()} />
                          </div>
                          <div style={{ fontWeight: 600, whiteSpace: 'nowrap', lineHeight: 1.3 }}>
                            <div style={{ fontSize: 13 }}>{dow}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500 }}>{`${day}/${m}`}</div>
                          </div>
                          <div style={{ fontSize: 13 }}>{c.cls.centre?.name || '—'}</div>
                          <div>
                            <CourseCategoryBadge category={c.category} />
                          </div>
                          <div style={{ fontSize: 13, whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>{fmtTime(c.slot.startTime)} – {fmtTime(c.slot.endTime)}</div>
                          <div className={styles.className}>{c.cls.name}</div>
                          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{c.mainTeacher}</div>
                          <div style={{ textAlign: 'center', fontSize: 13 }}>{c.studentCount}</div>
                          <div>
                            {(() => {
                              const judge = getJudgeTeacher(c.slot);
                              if (judge) return (
                                <span style={{ fontSize: 12, fontWeight: 510, color: 'var(--text-primary)' }}>{judge}</span>
                              );
                              return <span style={{ fontSize: 11, color: 'var(--text-quaternary)' }}>Chưa có</span>;
                            })()}
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── Existing đợt table ── */}
      {!dotsLoading && dots.length === 0 ? (
        <EmptyState
          icon={<Icon.BookOpen size={40} />}
          title="Chưa có đợt nào"
          subtitle="Tải dữ liệu bên trên, chọn buổi và tạo đợt đầu tiên"
        />
      ) : (
      <div className={styles.tableSection}>
        <TableGroupHeader
          title="Các đợt đã tạo"
          count={dots.length}
          loading={dotsLoading}
          progress={{ loaded: 0, total: 0 }}
          isExpanded={showDots}
          onToggle={() => setShowDots(p => !p)}
        />

        <AnimatePresence initial={false}>
          {showDots && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
              <div className={styles.tableScrollWrapper}>
                <div className={styles.classItemHeader} style={{ gridTemplateColumns: 'minmax(0,2fr) minmax(0,1.2fr) 60px 60px minmax(0,0.8fr) 140px', minWidth: 640 }}>
                  <div>Tiêu đề</div>
                  <div>Thời gian</div>
                  <div style={{ textAlign: 'center' }}>Buổi</div>
                  <div style={{ textAlign: 'center' }}>Yêu cầu</div>
                  <div>Trạng thái</div>
                  <div></div>
                </div>
                <AnimatePresence initial={false}>
                  {dots.map((dot, idx) => (
                    <motion.div
                      key={dot.id}
                      className={styles.classItem}
                      style={{ gridTemplateColumns: 'minmax(0,2fr) minmax(0,1.2fr) 60px 60px minmax(0,0.8fr) 140px', minWidth: 640, opacity: dot.is_active ? 1 : 0.55 }}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: dot.is_active ? 1 : 0.55, y: 0 }}
                      transition={{ duration: 0.18, delay: Math.min(idx * 0.015, 0.3) }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{dot.title}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>/{dot.slug}</div>
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {fmtDateYMD(dot.week_from)} – {fmtDateYMD(dot.week_to)}
                      </div>
                      <div style={{ textAlign: 'center', fontWeight: 700, color: 'var(--brand-indigo)', fontSize: 13 }}>{dot.session_count}</div>
	                      <div style={{ textAlign: 'center', fontWeight: 700, color: 'var(--status-success)', fontSize: 13 }}>{dot.request_count}</div>
	                      <div>
	                        <BatchStatusBadge active={dot.is_active} />
	                      </div>
                      <TableActionGroup>
                        <TableActionButton label="Xem chi tiết" icon={<Icon.Eye />} onClick={() => router.push(`/admin/final-sessions/${dot.id}`)} />
                        <TableActionButton label="Sao chép link chia sẻ" icon={<Icon.Copy />} onClick={() => copyLink(dot.slug)} />
                        <TableActionButton label={dot.is_active ? 'Đóng đợt' : 'Mở lại đợt'} icon={dot.is_active ? <Icon.XCircle /> : <Icon.CheckCircle />} onClick={() => toggleActive(dot)} />
                        <TableActionButton label="Xoá" icon={<Icon.Trash />} onClick={() => deleteDot(dot)} variant="danger" />
                      </TableActionGroup>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      )}

      {/* ── Create đợt modal ── */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)}>
        <ModalHeader
          title="Tạo đợt giám khảo"
          subtitle={`${selected.size} buổi đã chọn sẽ được thêm vào đợt này`}
          onClose={() => setShowCreate(false)}
        />
        <div className={styles.modalBody}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', padding: 'var(--space-5)' }}>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 510, color: 'var(--text-primary)', marginBottom: 'var(--space-2)' }}>Từ ngày *</label>
                <input
                  type="date"
                  className={styles.dateInput}
                  style={{ width: '100%', boxSizing: 'border-box' }}
                  value={form.weekFrom}
                  onChange={e => {
                    const v = e.target.value;
                    setForm(f => ({ ...f, weekFrom: v, slug: autoSlug(v), title: autoTitle(v, f.weekTo) }));
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 510, color: 'var(--text-primary)', marginBottom: 'var(--space-2)' }}>Đến ngày *</label>
                <input
                  type="date"
                  className={styles.dateInput}
                  style={{ width: '100%', boxSizing: 'border-box' }}
                  value={form.weekTo}
                  onChange={e => {
                    const v = e.target.value;
                    setForm(f => ({ ...f, weekTo: v, title: autoTitle(f.weekFrom, v) }));
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 510, color: 'var(--text-primary)', marginBottom: 'var(--space-2)' }}>Tiêu đề *</label>
              <input
                type="text"
                className={styles.dateInput}
                style={{ width: '100%', boxSizing: 'border-box' }}
                placeholder="VD: Đợt 19/05 – 25/05"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 510, color: 'var(--text-primary)', marginBottom: 'var(--space-2)' }}>Đường dẫn (slug) *</label>
              <input
                type="text"
                className={styles.dateInput}
                style={{ width: '100%', boxSizing: 'border-box' }}
                placeholder="dot-19-05-2026"
                value={form.slug}
                onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') }))}
              />
              <p style={{ fontSize: 13, color: 'var(--text-quaternary)', marginTop: 'var(--space-1)' }}>
                Link chia sẻ: <strong style={{ color: 'var(--text-secondary)' }}>/judge-requests/{form.slug || '...'}</strong>
              </p>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 510, color: 'var(--text-primary)', marginBottom: 'var(--space-2)' }}>Ghi chú nội bộ</label>
              <textarea
                className={styles.dateInput}
                style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', minHeight: 80 }}
                placeholder="Ghi chú cho admin (không hiển thị với giáo viên)..."
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>

          </div>
        </div>
        <ModalFooter
          primaryButton={{
            label: 'Tạo đợt',
            variant: 'primary',
            loading: saving,
            loadingText: 'Đang tạo...',
            onClick: handleCreate,
          }}
          secondaryButton={{ label: 'Huỷ', variant: 'secondary', onClick: () => setShowCreate(false) }}
        />
      </Modal>

      {/* ── Class detail modal ── */}
      <Modal open={!!selectedCandidate} onClose={() => { setSelectedCandidate(null); setCandidateModalTab('students'); setCommentSessionIndex(null); }}>
        {selectedCandidate && (() => {
          const c = selectedCandidate;
          const dk = dateKey(c.slot.date);
          const d = new Date(dk + 'T12:00:00');
          const todayDk = dateKey(new Date().toISOString());
          const allSlots = [...(c.cls.slots || [])].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
          const finalIdx = allSlots.findIndex(s => s._id === c.slot._id);
          const totalSessions = c.cls.numberOfSessions || allSlots.length;
          const passedSessions = allSlots.filter(s => dateKey(s.date) < todayDk).length;
          const judgeTeacher = getJudgeTeacher(c.slot);
          const allStudents = c.cls.students || [];
          const quality = analyzeClassQuality(c.cls);
          const checkpointTabs = [
            { key: 'cp1', label: 'CP1', title: 'CP1 (Buổi 5)', analysis: quality.cp1Analysis },
            { key: 'cp2', label: 'CP2', title: 'CP2 (Buổi 9)', analysis: quality.cp2Analysis },
            { key: 'demo', label: 'Demo', title: 'Demo (Buổi 14)', analysis: quality.demoAnalysis },
          ];

          // Build per-student data for both tabs
          const studentRows = allStudents.map(st => {
            const attDots = allSlots.map((slot, i) => {
              const att = slot.studentAttendance?.find((a: StudentAttendance) => a.student?.id === st.student?.id);
              return { i, slot, status: att?.status || null, comment: getStudentAttendanceCommentContent(att), sendStatus: att?.sendCommentStatus || '' };
            });
            const absentCount  = attDots.filter(d => isAttendanceStatus(d.status, 'absent')).length;
            const excusedCount = attDots.filter(d => isAttendanceStatus(d.status, 'excused')).length;
            const lateCount    = attDots.filter(d => isAttendanceStatus(d.status, 'late')).length;
            const emptyComments   = attDots.filter(d => dateKey(d.slot.date) < todayDk && !stripHtml(d.comment)).length;
            const briefComments   = attDots.filter(d => {
              const text = stripHtml(d.comment);
              return text.length > 0 && text.length < 20;
            }).length;
            return { st, attDots, absentCount, excusedCount, lateCount, emptyComments, briefComments };
          });

          const defaultCommentSessionIndex = finalIdx >= 0 ? finalIdx : Math.max(allSlots.length - 1, 0);
          const activeCommentSessionIndex = commentSessionIndex !== null && commentSessionIndex >= 0 && commentSessionIndex < allSlots.length
            ? commentSessionIndex
            : defaultCommentSessionIndex;
          const activeCommentSlot = allSlots[activeCommentSessionIndex];
          const commentSessionStats = allSlots.map((slot, sessionIndex) => {
            const rows = studentRows.map(row => row.attDots[sessionIndex]).filter(Boolean);
            const isPast = dateKey(slot.date) < todayDk;
            const missing = rows.filter(dot => isPast && !stripHtml(dot.comment)).length;
            const brief = rows.filter(dot => {
              const text = stripHtml(dot.comment);
              return text.length > 0 && text.length < 20;
            }).length;
            const ok = rows.filter(dot => stripHtml(dot.comment).length >= 20).length;
            const total = rows.length;
            const isFinal = slot._id === c.slot._id;
            return { slot, sessionIndex, isPast, missing, brief, ok, total, isFinal };
          });

          const TAB_STYLE = (active: boolean) => ({
            padding: '6px 14px', fontSize: 12, fontWeight: active ? 600 : 510,
            color: active ? 'var(--brand-indigo)' : 'var(--text-secondary)',
            background: 'transparent', border: 'none',
            borderBottom: active ? '2px solid var(--brand-indigo)' : '2px solid transparent',
            cursor: 'pointer', transition: 'all 0.15s',
          });

          return (
            <>
              <ModalHeader
                title={c.cls.name}
                subtitle={`${c.cls.centre?.name} · ${DOW_VI[d.getDay()]} ${dk.split('-').reverse().slice(0, 2).join('/')} · ${c.category}`}
                onClose={() => { setSelectedCandidate(null); setCandidateModalTab('students'); setCommentSessionIndex(null); }}
              />
              <div className={styles.modalBody} style={{ padding: '16px 20px 20px' }}>

                {/* Summary bar */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-5)', marginBottom: 'var(--space-4)', padding: '12px 16px', background: 'var(--bg-elevated)', borderRadius: 6, border: '1px solid var(--border-primary)' }}>
                  {([
                    [LABELS.COURSE,       c.cls.course?.shortName || '—'],
                    ['Giờ buổi cuối',  `${fmtTime(c.slot.startTime)} – ${fmtTime(c.slot.endTime)}`],
                    ['Giáo viên chính', c.mainTeacher],
                    ['Giám khảo',      judgeTeacher || 'Chưa có'],
                    ['Tiến độ',        `Buổi ${finalIdx + 1}/${totalSessions} · ${passedSessions} đã qua`],
                    [LABELS.STUDENTS,       `${c.studentCount}`],
                  ] as [string, string][]).map(([label, value]) => (
                    <div key={label}>
                      <div className={styles.statLabel}>{label}</div>
                      <div style={{ fontSize: 13, fontWeight: 510, marginTop: 2, color: label === 'Giám khảo' && !judgeTeacher ? 'var(--text-quaternary)' : 'var(--text-primary)' }}>{value}</div>
                    </div>
                  ))}
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border-primary)', marginBottom: 'var(--space-3)' }}>
                  <button style={TAB_STYLE(candidateModalTab === 'students')} onClick={() => setCandidateModalTab('students')}>
                    Chuyên cần ({allStudents.length} học viên)
                  </button>
                  <button style={TAB_STYLE(candidateModalTab === 'comments')} onClick={() => setCandidateModalTab('comments')}>
                    Nhận xét giáo viên ({allSlots.length} buổi)
                  </button>
                  <button style={TAB_STYLE(candidateModalTab === 'schedule')} onClick={() => setCandidateModalTab('schedule')}>
                    Lịch học ({allSlots.length} buổi)
                  </button>
                  <button style={TAB_STYLE(candidateModalTab === 'checkpoints')} onClick={() => setCandidateModalTab('checkpoints')}>
                    Checkpoint / Demo
                  </button>
                </div>

                {/* ── Tab: Chuyên cần ── */}
                {candidateModalTab === 'students' && (
                  allStudents.length > 0 ? (
                    <div className={styles.tableScrollWrapper}>
                      <table className={styles.studentTable}>
                        <thead>
                          <tr>
                            <th style={{ width: 28 }}>#</th>
                            <th>{LABELS.STUDENT}</th>
                            <th>Trạng thái</th>
                            <th>Điểm danh ({allSlots.length} buổi)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {studentRows.map(({ st, attDots, absentCount, excusedCount, lateCount }, idx) => (
                            <tr key={st._id} style={{ opacity: st.activeInClass ? 1 : 0.5 }}>
                              <td style={{ color: 'var(--text-quaternary)', fontSize: 11 }}>{idx + 1}</td>
                              <td style={{ fontWeight: 510, fontSize: 13 }}>{st.student?.fullName || '—'}</td>
                              <td>
                                <Badge variant={st.activeInClass ? 'passed' : 'failed'} size="sm">
                                  {st.activeInClass ? 'Đang học' : 'Đã nghỉ'}
                                </Badge>
                                {(absentCount > 0 || excusedCount > 0 || lateCount > 0) && (
                                  <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                                    {absentCount > 0 && <Badge variant="failed" size="sm">{absentCount} vắng KP</Badge>}
                                    {excusedCount > 0 && <Badge variant="demo" size="sm">{excusedCount} có phép</Badge>}
                                    {lateCount > 0 && <Badge variant="warning" size="sm">{lateCount} muộn</Badge>}
                                  </div>
                                )}
                              </td>
                              <td>
                                <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'center' }}>
                                  {attDots.map(dot => {
                                    const isFinal = dot.slot._id === c.slot._id;
                                    return (
                                      <AttendanceSessionCell
                                        key={dot.i}
                                        status={dot.status}
                                        index={dot.i}
                                        date={dot.slot.date}
                                        size={22}
                                        highlight={isFinal}
                                        highlightColor={COURSE_CATEGORY_COLORS[c.category as keyof typeof COURSE_CATEGORY_COLORS] || 'var(--brand-indigo)'}
                                        highlightLabel={isFinal ? 'Buổi cuối' : undefined}
                                      />
                                    );
                                  })}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-quaternary)', fontSize: 13 }}>Chưa có học viên trong lớp.</div>
                  )
                )}

                {/* ── Tab: Nhận xét ── */}
                {candidateModalTab === 'comments' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
	                    <div className={styles.tableScrollWrapper}>
	                      <table className={styles.studentTable}>
	                        <thead>
	                          <tr>
	                            <th style={{ minWidth: 160 }}>{LABELS.STUDENT}</th>
	                            <th>Tổng quan</th>
	                            {commentSessionStats.map(stat => (
	                              <th
	                                key={stat.slot._id}
	                                onClick={() => setCommentSessionIndex(stat.sessionIndex)}
	                                style={{
	                                  minWidth: 82,
	                                  textAlign: 'center',
	                                  cursor: 'pointer',
	                                  background: stat.sessionIndex === activeCommentSessionIndex ? 'rgba(59,130,246,0.08)' : undefined,
	                                }}
	                              >
	                                <div>Buổi {stat.sessionIndex + 1}</div>
	                                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2, textTransform: 'none', letterSpacing: 0 }}>
	                                  {new Date(stat.slot.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
	                                </div>
	                                {stat.isFinal && <div style={{ marginTop: 4 }}><Badge variant="info" size="sm" shape="rounded">Cuối</Badge></div>}
	                              </th>
	                            ))}
	                          </tr>
	                        </thead>
	                        <tbody>
	                          {studentRows.map(({ st, attDots }) => {
	                            const visibleCommentStatuses = commentSessionStats.map(stat => {
	                              const dot = attDots[stat.sessionIndex];
	                              const comment = stripHtml(dot?.comment || '');
	                              if (stat.isPast && !comment) return 'empty';
	                              if (comment.length > 0 && comment.length < 20) return 'brief';
	                              if (comment) return 'ok';
	                              return 'not_required';
	                            });
	                            const emptyCount = visibleCommentStatuses.filter(status => status === 'empty').length;
	                            const briefCount = visibleCommentStatuses.filter(status => status === 'brief').length;
	                            const issues = emptyCount + briefCount;
	                            return (
	                              <tr key={st._id} style={{ opacity: st.activeInClass ? 1 : 0.5 }}>
	                                <td style={{ fontWeight: 510, fontSize: 13 }}>{st.student?.fullName || '—'}</td>
	                                <td>
	                                  {issues === 0 ? (
	                                    <CommentStatusBadge status="ok" />
	                                  ) : (
	                                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
	                                      {emptyCount > 0 && <CommentStatusBadge status="empty">{emptyCount} {COMMENT_STATUS_COUNT_LABELS.empty}</CommentStatusBadge>}
	                                      {briefCount > 0 && <CommentStatusBadge status="brief">{briefCount} {COMMENT_STATUS_COUNT_LABELS.brief}</CommentStatusBadge>}
	                                    </div>
	                                  )}
	                                </td>
	                                {commentSessionStats.map(stat => {
	                                  const dot = attDots[stat.sessionIndex];
	                                  const comment = stripHtml(dot?.comment || '');
	                                  const isEmpty = stat.isPast && !comment;
	                                  const isBrief = comment.length > 0 && comment.length < 20;
	                                  const isSelectedSession = stat.sessionIndex === activeCommentSessionIndex;
	                                  return (
	                                    <td
	                                      key={`${stat.slot._id}-${st._id}`}
	                                      onClick={() => setCommentSessionIndex(stat.sessionIndex)}
	                                      style={{
	                                        textAlign: 'center',
	                                        cursor: 'pointer',
	                                        background: isSelectedSession ? 'rgba(59,130,246,0.06)' : undefined,
	                                      }}
	                                    >
	                                      {isEmpty ? (
	                                        <CommentStatusBadge status="empty" />
	                                      ) : isBrief ? (
	                                        <CommentStatusBadge status="brief" />
	                                      ) : comment ? (
	                                        <CommentStatusBadge status="ok" />
	                                      ) : (
	                                        <CommentStatusBadge status="not_required" />
	                                      )}
	                                    </td>
	                                  );
	                                })}
	                              </tr>
	                            );
	                          })}
	                        </tbody>
	                      </table>
	                    </div>

                    {activeCommentSlot && (
                      <div style={{ border: '1px solid var(--border-primary)', borderRadius: 6, overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)', padding: '10px 12px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-primary)', flexWrap: 'wrap' }}>
                          <div>
                            <div style={{ fontWeight: 590, color: 'var(--text-primary)', fontSize: 13 }}>Nhận xét buổi {activeCommentSessionIndex + 1}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                              {new Date(activeCommentSlot.date).toLocaleDateString('vi-VN')} · {fmtTime(activeCommentSlot.startTime)} – {fmtTime(activeCommentSlot.endTime)}
                            </div>
                          </div>
                          {activeCommentSlot._id === c.slot._id && <Badge variant="info" size="sm" shape="rounded">Buổi cuối</Badge>}
                        </div>
                        <div className={styles.tableScrollWrapper}>
                          <table className={styles.studentTable}>
                            <thead>
                              <tr>
                                <th style={{ width: 28 }}>#</th>
                                <th>{LABELS.STUDENT}</th>
                                <th>Điểm danh</th>
                                <th>Trạng thái nhận xét</th>
                                <th>Nội dung nhận xét</th>
                              </tr>
                            </thead>
                            <tbody>
                              {studentRows.map(({ st, attDots }, idx) => {
                                const dot = attDots[activeCommentSessionIndex];
                                const comment = stripHtml(dot?.comment || '');
                                const isPast = dot ? dateKey(dot.slot.date) < todayDk : false;
                                const isEmpty = isPast && !comment;
                                const isBrief = comment.length > 0 && comment.length < 20;
                                return (
                                  <tr key={`${st._id}-${activeCommentSlot._id}`} style={{ opacity: st.activeInClass ? 1 : 0.5 }}>
                                    <td style={{ color: 'var(--text-quaternary)', fontSize: 11 }}>{idx + 1}</td>
                                    <td style={{ fontWeight: 510, fontSize: 13 }}>{st.student?.fullName || '—'}</td>
                                    <td><AttendanceStatusBadge status={dot?.status} /></td>
                                    <td>
	                                      {isEmpty ? (
	                                        <CommentStatusBadge status="empty" />
	                                      ) : isBrief ? (
	                                        <CommentStatusBadge status="brief" />
	                                      ) : comment ? (
	                                        <CommentStatusBadge status="ok" />
	                                      ) : (
	                                        <CommentStatusBadge status="not_required">Chưa có</CommentStatusBadge>
	                                      )}
                                    </td>
                                    <td style={{ fontSize: 12, color: comment ? 'var(--text-primary)' : 'var(--text-quaternary)', minWidth: 360, maxWidth: 640, lineHeight: 1.45 }}>
                                      {comment || <em>Chưa có nhận xét</em>}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Tab: Lịch học ── */}
                {candidateModalTab === 'schedule' && (
                  <div className={styles.tableScrollWrapper}>
                    <table className={styles.studentTable}>
                      <thead>
                        <tr>
                          <th>Buổi</th>
                          <th>Ngày học</th>
                          <th>Giờ</th>
                          <th>Khoảng cách</th>
                          <th>Trạng thái lịch</th>
                          <th>Giáo viên</th>
                        </tr>
                      </thead>
                      <tbody>
                        {quality.reschedulingAnalysis.sessions.map(sess => {
                          const slot = allSlots[sess.sessionIndex];
                          const isFinal = slot?._id === c.slot._id;
                          const isSameDay = sess.daysSincePrevious === 0;
                          const teacher = slot ? getMainTeacher(c.cls, slot) : '—';
                          return (
                            <tr key={sess.sessionIndex} style={{ background: isFinal ? 'rgba(59,130,246,0.04)' : sess.isRescheduled ? 'rgba(245,158,11,0.03)' : 'transparent' }}>
                              <td style={{ textAlign: 'center', fontWeight: 510 }}>Buổi {sess.sessionIndex + 1}</td>
                              <td style={{ whiteSpace: 'nowrap' }}>{new Date(sess.date).toLocaleDateString('vi-VN')}</td>
                              <td style={{ whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>{fmtTime(slot?.startTime || null)} – {fmtTime(slot?.endTime || null)}</td>
                              <td style={{ textAlign: 'center' }}>{sess.daysSincePrevious === null ? '—' : isSameDay ? 'Cùng ngày' : `${sess.daysSincePrevious} ngày`}</td>
                              <td>
                                {isFinal ? (
                                  <Badge variant="info" size="sm" shape="rounded">Buổi cuối</Badge>
                                ) : isSameDay ? (
                                  <RescheduleStatusBadge status="same_day" />
                                ) : sess.isRescheduled ? (
                                  <RescheduleStatusBadge status={sess.reschedulingType === 'early' ? 'early' : 'late'} />
                                ) : (
                                  <RescheduleStatusBadge status="on_schedule" />
                                )}
                              </td>
                              <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{teacher}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* ── Tab: Checkpoint / Demo ── */}
                {candidateModalTab === 'checkpoints' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    {checkpointTabs.map(item => {
                      const analysis = item.analysis;
                      return (
                        <div key={item.key} style={{ border: '1px solid var(--border-primary)', borderRadius: 6, overflow: 'hidden' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 1fr) repeat(4, minmax(80px, 0.7fr))', gap: 'var(--space-3)', alignItems: 'center', padding: '10px 12px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-primary)', fontSize: 12 }}>
                            <div style={{ fontWeight: 590, color: 'var(--text-primary)' }}>{item.title}</div>
                            <div><span className={styles.statLabel}>Có điểm</span><div style={{ fontWeight: 590 }}>{analysis.studentsWithScores}</div></div>
                            <div><span className={styles.statLabel}>Tỷ lệ đạt</span><div style={{ fontWeight: 590, color: analysis.passRate >= 80 ? 'var(--status-success)' : analysis.passRate >= 60 ? 'var(--status-warning)' : 'var(--status-error)' }}>{analysis.passRate.toFixed(1)}%</div></div>
                            <div><span className={styles.statLabel}>Điểm TB</span><div style={{ fontWeight: 590 }}>{analysis.averageScore !== null ? analysis.averageScore.toFixed(2) : '—'}</div></div>
                            <div><span className={styles.statLabel}>Thiếu điểm</span><div style={{ fontWeight: 590, color: analysis.missingScoreCount > 0 ? 'var(--status-error)' : 'var(--status-success)' }}>{analysis.missingScoreCount}</div></div>
                          </div>
                          {!analysis.hasSession ? (
                            <div style={{ padding: 14, color: 'var(--text-quaternary)', fontSize: 13 }}>Lớp chưa có dữ liệu {item.label}.</div>
                          ) : analysis.students.length === 0 ? (
                            <div style={{ padding: 14, color: 'var(--text-quaternary)', fontSize: 13 }}>Buổi này chưa có dữ liệu học viên.</div>
                          ) : (
                            <div className={styles.tableScrollWrapper}>
                              <table className={styles.studentTable}>
                                <thead>
                                  <tr>
                                    <th>{LABELS.STUDENT}</th>
                                    <th>Điểm danh</th>
                                    <th>{item.key === 'demo' ? 'Điểm Demo' : 'Điểm CP'}</th>
                                    {item.key === 'demo' && <th>TBCK</th>}
                                    {item.key === 'demo' && <th>Xếp loại</th>}
                                    <th>Nhận xét</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {analysis.students.map((st: ModalCheckpointStudent) => {
                                    const score = (item.key === 'demo' ? st.demoScore : st.checkpointScore) ?? null;
                                    const rankColor = st.rank ? getRankColor(st.rank) : 'var(--text-quaternary)';
                                    const comment = stripHtml(st.comment || '');
                                    return (
                                      <tr key={`${item.key}-${st.studentId}`}>
                                        <td style={{ fontWeight: 510 }}>{st.studentName}</td>
                                        <td><AttendanceStatusBadge status={st.attendanceStatus} /></td>
                                        <td style={{ textAlign: 'center', fontWeight: 600, color: score !== null ? (score >= (item.key === 'demo' ? 3 : 3.5) ? 'var(--status-success)' : 'var(--status-error)') : 'var(--text-quaternary)' }}>
                                          {score !== null ? score.toFixed(2) : '—'}
                                        </td>
                                        {item.key === 'demo' && (
                                          <td style={{ textAlign: 'center', fontWeight: 600, color: st.tbck !== null && st.tbck !== undefined ? (st.tbck >= 4 ? 'var(--status-success)' : st.tbck >= 3.5 ? 'var(--status-warning)' : 'var(--status-error)') : 'var(--text-quaternary)' }}>
                                            {st.tbck !== null && st.tbck !== undefined ? st.tbck.toFixed(2) : '—'}
                                          </td>
                                        )}
                                        {item.key === 'demo' && (
                                          <td>{st.rank ? <Badge variant="custom" size="sm" shape="rounded" customColors={{ background: `${rankColor}15`, color: rankColor, border: `${rankColor}40` }}>{st.rank}</Badge> : '—'}</td>
                                        )}
                                        <td style={{ fontSize: 12, color: comment ? 'var(--text-primary)' : 'var(--text-quaternary)', maxWidth: 280 }}>
                                          {comment ? <span title={comment}>{comment.length > 90 ? `${comment.slice(0, 90)}...` : comment}</span> : <em>Chưa có nhận xét</em>}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

              </div>
              <ModalFooter
                primaryButton={{
                  label: selected.has(c.slot._id) ? 'Bỏ chọn buổi này' : 'Chọn buổi này',
                  variant: selected.has(c.slot._id) ? 'secondary' : 'primary',
                  onClick: () => { toggleSelect(c.slot._id); setSelectedCandidate(null); setCandidateModalTab('students'); setCommentSessionIndex(null); },
                }}
                secondaryButton={{ label: 'Đóng', variant: 'secondary', onClick: () => { setSelectedCandidate(null); setCandidateModalTab('students'); setCommentSessionIndex(null); } }}
              />
            </>
          );
        })()}
      </Modal>
    </PageLayout>
  );
}
