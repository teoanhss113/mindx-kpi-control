'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PageLayout } from '@/components/PageLayout';
import { BatchStatusBadge, Badge, CourseCategoryBadge, DateMarkerBadge, JudgeRequestStatusBadge, useToast, ToastContainer, Modal, ModalHeader, ModalFooter, EmptyState, Toolbar, SortIcon, TableGroupHeader, UserSearchInput, ShiftRequestSuggestions, type ShiftRequest, type UserSearchResult, Icon, TableActionButton, TableActionGroup, DetailGrid, DetailField, DetailText, SortableColumnWithCopy } from '@/components/ui';
import { motion, AnimatePresence } from 'framer-motion';
import { authFetch } from '@/lib/auth/clientAuth';
import { dateRangeToUtcRange, fetchAllClasses } from '@/services/classesService';
import { searchTeachers, type Teacher } from '@/services/officeHoursService';
import { addJudgeTeacherToSession } from '@/services/teacherScheduleService';
import { getCourseCategory } from '@/lib/courseCategories';
import { LABELS, MESSAGES } from '@/constants';
import type { Class, Session } from '@/types/classes';
import styles from '@/app/dashboard.module.css';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FinalSession {
  id: string;
  lms_class_id: string;
  lms_slot_id: string;
  class_name: string;
  course_short_name: string | null;
  centre_id: string | null;
  centre_name: string | null;
  category: string | null;
  session_date: string;
  start_time_utc: string | null;
  end_time_utc: string | null;
  main_teacher: string | null;
  student_count: number;
  notes: string | null;
  judge_requests: JudgeRequest[];
}

interface JudgeRequest {
  id: string;
  teacher_id: string | null;
  teacher_name: string | null;
  teacher_email: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  request_note?: string | null;
  rejection_reason?: string | null;
}

interface JudgeDraft {
  teacherId: string;
  teacherName: string;
  teacherEmail: string;
  requestId?: string;
}

interface CentreOption {
  id: string;
  shortName: string;
  name: string;
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
  judgeTeacher: string | null;
  judgeTeacherId: string | null;
  judgeTeacherEmail: string | null;
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

function getTeacherRoleShortName(t: { role?: { name?: string; shortName?: string } | string | null }): string {
  const role = t.role;
  if (!role) return '';
  return (typeof role === 'string' ? role : role.shortName || role.name || '').toUpperCase();
}

function getJudgeTeacherInfo(slot: Session): { name: string; id: string | null; email: string | null } | null {
  const teacherSlot = (slot.teachers || []).find(t => getTeacherRoleShortName(t) === 'JUDGE');
  if (!teacherSlot?.teacher) return null;
  return {
    name: teacherSlot.teacher.fullName || teacherSlot.teacher.email || teacherSlot.teacher.username || '—',
    id: teacherSlot.teacher.id || null,
    email: teacherSlot.teacher.email || null,
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BatchDetailPage() {
  const params = useParams();
  const batchId = params.batchId as string;
  const router = useRouter();
  const { toasts, addToast, removeToast } = useToast();

  const [batch, setBatch] = useState<Batch | null>(null);
  const [loading, setLoading] = useState(true);

  const lmsAbortRef = useRef<AbortController | null>(null);

  // LMS fetch panel
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [centres, setCentres] = useState<CentreOption[]>([]);
  const [lmsSelectedCentres, setLmsSelectedCentres] = useState<string[]>([]);
  const [lmsProgress, setLmsProgress] = useState({ loaded: 0, total: 0 });
  const [lmsLoading, setLmsLoading] = useState(false);
  const [candidates, setCandidates] = useState<LmsCandidate[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set()); // lms_slot_id
  const [lmsDateFrom, setLmsDateFrom] = useState('');
  const [lmsDateTo, setLmsDateTo] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [judgeDraft, setJudgeDraft] = useState<JudgeDraft | null>(null);
  const [teacherSearch, setTeacherSearch] = useState('');
  const [teacherSearchResults, setTeacherSearchResults] = useState<Teacher[]>([]);
  const [teachersLoading, setTeachersLoading] = useState(false);
  const [savingJudge, setSavingJudge] = useState(false);
  const [lmsJudgeBySlot, setLmsJudgeBySlot] = useState<Record<string, string>>({});
  const teacherSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  }, [addToast, batchId]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadBatch();
    });
  }, [loadBatch]);

  useEffect(() => {
    return () => {
      if (teacherSearchTimerRef.current) clearTimeout(teacherSearchTimerRef.current);
    };
  }, []);

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
            const judge = getJudgeTeacherInfo(slot);
            if (judge?.name) next[slot._id] = judge.name;
          });
        });
        if (!controller.signal.aborted) setLmsJudgeBySlot(next);
      } catch {
        if (!controller.signal.aborted) setLmsJudgeBySlot({});
      }
    })();

    return () => controller.abort();
  }, [batch?.week_from, batch?.week_to]);

  // ─── LMS fetch ────────────────────────────────────────────────────────────

  function handleCancelLmsFetch() {
    if (lmsAbortRef.current) {
      lmsAbortRef.current.abort();
      lmsAbortRef.current = null;
      setLmsLoading(false);
    }
  }

  async function fetchFromLms() {
    if ((lmsDateFrom && !lmsDateTo) || (!lmsDateFrom && lmsDateTo)) { addToast('Chọn khoảng thời gian', 'error'); return; }
    if (lmsDateFrom && lmsDateTo && lmsDateFrom > lmsDateTo) { addToast(MESSAGES.ERROR.DATE_RANGE_INVALID, 'error'); return; }
    if (lmsAbortRef.current) lmsAbortRef.current.abort();
    lmsAbortRef.current = new AbortController();
    const signal = lmsAbortRef.current.signal;

    setLmsLoading(true);
    setLmsProgress({ loaded: 0, total: 0 });
    setCandidates([]);
    setSelected(new Set());

    const alreadyAddedSlotIds = new Set((batch?.sessions || []).map(s => s.lms_slot_id));

    try {
      const rangeParams = lmsDateFrom && lmsDateTo
        ? dateRangeToUtcRange(new Date(lmsDateFrom), new Date(lmsDateTo))
        : {};
      const centreIds = lmsSelectedCentres.length > 0
        ? lmsSelectedCentres
        : centres.map(c => c.id);

      const found: LmsCandidate[] = [];

      await fetchAllClasses(
        { centres: centreIds, ...rangeParams },
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
            if (lmsDateFrom && slotKey < lmsDateFrom) continue;
            if (lmsDateTo && slotKey > lmsDateTo) continue;
            const judge = getJudgeTeacherInfo(lastSlot);

            found.push({
              cls,
              slot: lastSlot,
              category: getCourseCategory(cls),
              mainTeacher: getMainTeacher(cls, lastSlot),
              judgeTeacher: judge?.name || null,
              judgeTeacherId: judge?.id || null,
              judgeTeacherEmail: judge?.email || null,
              studentCount: cls.students?.filter(s => s.activeInClass).length || 0,
              alreadyAdded: alreadyAddedSlotIds.has(lastSlot._id),
            });
          }
          setCandidates([...found]);
        },
        signal,
      );

      if (!signal.aborted && found.length === 0) addToast('Không tìm thấy buổi cuối khoá trong khoảng này', 'info');
    } catch {
      if (!signal.aborted) addToast('Lỗi khi tải dữ liệu từ LMS', 'error');
    } finally {
      if (!signal.aborted) setLmsLoading(false);
    }
  }

  function toggleSelect(slotId: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(slotId)) {
        next.delete(slotId);
      } else {
        next.add(slotId);
      }
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
          judge_teacher: c.judgeTeacher,
          judge_teacher_id: c.judgeTeacherId,
          judge_teacher_email: c.judgeTeacherEmail,
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

  const selectedFinalSession = useMemo(
    () => batch?.sessions.find(s => s.id === selectedSessionId) || null,
    [batch, selectedSessionId],
  );

  const currentTeacherDisplay = useMemo(() => {
    if (!judgeDraft?.teacherId || teacherSearch) return null;
    return judgeDraft.teacherName || teacherSearchResults.find(t => t.id === judgeDraft.teacherId)?.fullName || 'Giáo viên đã chọn';
  }, [judgeDraft, teacherSearch, teacherSearchResults]);

  const pendingJudgeRequests = useMemo(() =>
    (selectedFinalSession?.judge_requests || []).filter(request => request.status === 'pending'),
  [selectedFinalSession]);

  function openSessionModal(finalSession: FinalSession) {
    const approved = finalSession.judge_requests?.find(request => request.status === 'approved');
    setSelectedSessionId(finalSession.id);
    setTeacherSearch('');
    if (approved?.teacher_id) {
      setJudgeDraft({
        teacherId: approved.teacher_id,
        teacherName: approved.teacher_name || approved.teacher_email || '',
        teacherEmail: approved.teacher_email || '',
        requestId: approved.id,
      });
      setTeacherSearchResults([{
        id: approved.teacher_id,
        username: '',
        email: approved.teacher_email || '',
        fullName: approved.teacher_name || approved.teacher_email || '',
        code: '',
        phoneNumber: '',
        isActive: true,
        centres: [],
      }]);
    } else {
      setJudgeDraft(null);
      setTeacherSearchResults([]);
    }
  }

  function closeSessionModal() {
    setSelectedSessionId(null);
    setJudgeDraft(null);
    setTeacherSearch('');
    setTeacherSearchResults([]);
  }

  const handleTeacherInputChange = useCallback((value: string) => {
    setTeacherSearch(value);
    if (teacherSearchTimerRef.current) clearTimeout(teacherSearchTimerRef.current);
    if (value.trim().length < 2) {
      setTeachersLoading(false);
      setTeacherSearchResults([]);
      return;
    }

    teacherSearchTimerRef.current = setTimeout(async () => {
      setTeachersLoading(true);
      try {
        const res = await searchTeachers(value, 0, 20);
        setTeacherSearchResults(res.data);
      } catch {
        setTeacherSearchResults([]);
      } finally {
        setTeachersLoading(false);
      }
    }, 300);
  }, []);

  async function handleSaveJudge() {
    if (!selectedFinalSession || !judgeDraft?.teacherId || !judgeDraft.teacherName) {
      addToast('Chưa chọn giáo viên làm giám khảo', 'info');
      return;
    }

    setSavingJudge(true);
    try {
      await addJudgeTeacherToSession({
        classId: selectedFinalSession.lms_class_id,
        className: selectedFinalSession.class_name,
        centreId: selectedFinalSession.centre_id || undefined,
        sessionId: selectedFinalSession.lms_slot_id,
        sessionStartTime: selectedFinalSession.start_time_utc || '',
        sessionEndTime: selectedFinalSession.end_time_utc || '',
        teacherId: judgeDraft.teacherId,
        teacherName: judgeDraft.teacherName,
        teacherHandleScore: 7,
        teacherPrimaryCenters: [selectedFinalSession.centre_id || null],
      });

      const res = await authFetch(`/api/admin/judge-batches/${batchId}/sessions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: selectedFinalSession.id,
          requestId: judgeDraft.requestId,
          teacherId: judgeDraft.teacherId,
          teacherName: judgeDraft.teacherName,
          teacherEmail: judgeDraft.teacherEmail,
        }),
      });
      if (!res.ok) throw new Error('Không thể cập nhật giám khảo');
      const json = await res.json();

      setBatch(prev => prev ? {
        ...prev,
        sessions: prev.sessions.map(item => item.id === selectedFinalSession.id ? json.data : item),
      } : prev);
      addToast('Đã cập nhật giám khảo cho buổi cuối khoá', 'success');
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Không thể cập nhật giám khảo', 'error');
    } finally {
      setSavingJudge(false);
    }
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
          className={styles.backLinkBtn}
        >
          <Icon.ChevronLeft size={14} />
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
            <button className={styles.clearCacheBtn} onClick={copyLink}>
              <Icon.Copy />
              Copy link
            </button>
            <button className={styles.primaryBtn} onClick={() => setShowAddPanel(true)}>
              <Icon.Plus />
              Thêm buổi từ LMS
            </button>
          </div>
        </div>
      </div>

      {/* Sessions table */}
      {sortedSessions.length === 0 ? (
        <EmptyState
          icon={<Icon.BookOpen size={40} />}
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
            actionSlot={undefined}
          />
          <div className={styles.tableScrollWrapper}>
            {/* Header */}
            <div className={styles.classItemHeader} style={{ gridTemplateColumns: 'minmax(0,1.1fr) minmax(0,1.2fr) minmax(0,0.7fr) minmax(0,2fr) minmax(0,0.9fr) minmax(0,1.4fr) 64px minmax(0,1.3fr) minmax(0,1.1fr) 60px', minWidth: 980 }}>
              <div className={`${styles.sortableCol} ${sortKey === 'date' ? styles.activeSort : ''}`} onClick={() => handleSort('date')}>{LABELS.DATE} <SortIcon col="date" sortKey={sortKey} sortDir={sortDir} /></div>
              <div className={`${styles.sortableCol} ${sortKey === 'centre' ? styles.activeSort : ''}`} onClick={() => handleSort('centre')}>{LABELS.CENTRE} <SortIcon col="centre" sortKey={sortKey} sortDir={sortDir} /></div>
              <div className={`${styles.sortableCol} ${sortKey === 'category' ? styles.activeSort : ''}`} onClick={() => handleSort('category')}>{LABELS.COURSE_LINE} <SortIcon col="category" sortKey={sortKey} sortDir={sortDir} /></div>
              <SortableColumnWithCopy
                label={LABELS.CLASS_TITLE}
                sortKey="name"
                currentSortKey={sortKey}
                sortDir={sortDir}
                onSort={() => handleSort('name')}
                classCodes={sortedSessions.map(s => s.class_name)}
                disabled={sortedSessions.length === 0}
              />
              <div>Giờ</div>
              <div className={`${styles.sortableCol} ${sortKey === 'teacher' ? styles.activeSort : ''}`} onClick={() => handleSort('teacher')}>{LABELS.MAIN_TEACHER} <SortIcon col="teacher" sortKey={sortKey} sortDir={sortDir} /></div>
              <div className={`${styles.sortableCol} ${sortKey === 'students' ? styles.activeSort : ''}`} onClick={() => handleSort('students')} style={{ justifyContent: 'center' }}>{LABELS.STUDENTS} <SortIcon col="students" sortKey={sortKey} sortDir={sortDir} /></div>
              <div>Giám khảo</div>
              <div>{LABELS.REGISTRATION_STATUS}</div>
              <div></div>
            </div>

            {/* Rows */}
            <AnimatePresence initial={false}>
              {sortedSessions.map((s, idx) => {
                const { date, weekday } = formatDateWithDay(s.session_date);
                const today = todayVN();
                const isPast = s.session_date < today;
                const isToday = s.session_date === today;
                const approved = s.judge_requests?.find(r => r.status === 'approved');
                const pending = s.judge_requests?.filter(r => r.status === 'pending') ?? [];
                const rejected = s.judge_requests?.filter(r => r.status === 'rejected') ?? [];
                const judgeName = approved?.teacher_name || approved?.teacher_email || lmsJudgeBySlot[s.lms_slot_id] || '';
                return (
                  <motion.div
                    key={s.id}
                    className={styles.classItem}
                    style={{ gridTemplateColumns: 'minmax(0,1.1fr) minmax(0,1.2fr) minmax(0,0.7fr) minmax(0,2fr) minmax(0,0.9fr) minmax(0,1.4fr) 64px minmax(0,1.3fr) minmax(0,1.1fr) 60px', minWidth: 980, opacity: isPast ? 0.6 : 1, cursor: 'pointer' }}
                    onClick={() => openSessionModal(s)}
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
                      {judgeName ? (
                        <span style={{ fontSize: 13, fontWeight: 510, color: 'var(--text-primary)' }}>
                          {judgeName}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>—</span>
                      )}
                    </div>
                    <div>
                      {approved ? (
                        <JudgeRequestStatusBadge status="approved" />
                      ) : pending.length > 0 ? (
	                        <Badge variant="warning" size="sm">
	                          {pending.length} chờ duyệt
	                        </Badge>
                      ) : rejected.length > 0 ? (
                        <JudgeRequestStatusBadge status="rejected" />
                      ) : (
                        <JudgeRequestStatusBadge status={null} />
                      )}
                    </div>
                    <TableActionGroup>
                      <TableActionButton
                        label="Xoá khỏi đợt"
                        icon={<Icon.Trash />}
                        variant="danger"
                        onClick={(event) => {
                          event.stopPropagation();
                          removeSession(s.id);
                        }}
                      />
                    </TableActionGroup>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      )}

      <Modal open={!!selectedFinalSession} onClose={closeSessionModal}>
        {selectedFinalSession && (
          <>
            <ModalHeader
              title={selectedFinalSession.class_name}
              subtitle={`${formatDate(selectedFinalSession.session_date)} · ${formatTime(selectedFinalSession.start_time_utc)} - ${formatTime(selectedFinalSession.end_time_utc)}`}
              onClose={closeSessionModal}
            />

            <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
              <DetailGrid>
                <DetailField label="Thời gian">
                  <DetailText meta={formatDate(selectedFinalSession.session_date)}>
                    {formatTime(selectedFinalSession.start_time_utc)} - {formatTime(selectedFinalSession.end_time_utc)}
                  </DetailText>
                </DetailField>
                <DetailField label={LABELS.CLASS_TITLE}>
                  <DetailText>{selectedFinalSession.class_name}</DetailText>
                </DetailField>
                <DetailField label={LABELS.COURSE}>
                  <DetailText>{selectedFinalSession.course_short_name || selectedFinalSession.category || '—'}</DetailText>
                </DetailField>
                <DetailField label={LABELS.STUDENTS}>
                  <DetailText>{selectedFinalSession.student_count} học viên</DetailText>
                </DetailField>
                <DetailField label={LABELS.CENTRE}>
                  <DetailText meta={`${LABELS.MAIN_TEACHER}: ${selectedFinalSession.main_teacher || '—'}`}>
                    {selectedFinalSession.centre_name || '—'}
                  </DetailText>
                </DetailField>
                <DetailField label="Giám khảo">
                  <UserSearchInput
                    value={teacherSearch}
                    onChange={handleTeacherInputChange}
                    onSelect={(teacher) => {
                      setJudgeDraft({
                        teacherId: teacher.id,
                        teacherName: teacher.fullName || teacher.username || teacher.email || teacher.id,
                        teacherEmail: teacher.email || '',
                      });
                      setTeacherSearch('');
                      setTeacherSearchResults([teacher as Teacher]);
                    }}
                    onClear={() => {
                      setJudgeDraft(null);
                      setTeacherSearch('');
                      setTeacherSearchResults([]);
                    }}
                    results={teacherSearchResults as UserSearchResult[]}
                    loading={teachersLoading}
                    placeholder="Tìm kiếm theo tên hoặc email..."
                    selectedUserName={currentTeacherDisplay || undefined}
                  />

                  <ShiftRequestSuggestions
                    title="Giáo viên đăng ký làm giám khảo"
                    requests={pendingJudgeRequests.map(request => ({
                      id: request.id,
                      teacher_id: request.teacher_id,
                      teacher_name: request.teacher_name,
                      teacher_email: request.teacher_email,
                      status: request.status,
                      created_at: request.created_at,
                      request_note: request.request_note,
                    })) as ShiftRequest[]}
                    onSelect={(request) => {
                      if (!request.teacher_id || !request.teacher_name) return;
                      setJudgeDraft({
                        teacherId: request.teacher_id,
                        teacherName: request.teacher_name,
                        teacherEmail: request.teacher_email,
                        requestId: request.id,
                      });
                      setTeacherSearch('');
                      setTeacherSearchResults([{
                        id: request.teacher_id,
                        username: '',
                        email: request.teacher_email,
                        fullName: request.teacher_name,
                        code: '',
                        phoneNumber: '',
                        isActive: true,
                        centres: [],
                      }]);
                    }}
                  />
                </DetailField>
              </DetailGrid>
            </div>

            <ModalFooter
              secondaryButton={{
                label: 'Đóng',
                variant: 'secondary',
                onClick: closeSessionModal,
                disabled: savingJudge,
              }}
              primaryButton={{
                label: 'Lưu giám khảo',
                variant: 'primary',
                loading: savingJudge,
                loadingText: 'Đang lưu...',
                disabled: savingJudge || !judgeDraft?.teacherId,
                onClick: handleSaveJudge,
              }}
            />
          </>
        )}
      </Modal>

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
              icon={<Icon.BookOpen size={36} />}
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
                <button className={styles.textActionBtn} onClick={selectAll}>
                  Chọn tất cả
                </button>
              </div>
              <div className={styles.classItemHeader} style={{ gridTemplateColumns: '36px minmax(0,0.9fr) minmax(0,2fr) minmax(0,1.3fr) minmax(0,0.7fr) minmax(0,0.9fr) minmax(0,1.4fr) minmax(0,1.2fr) 64px', minWidth: 780 }}>
                <div></div>
                <div>{LABELS.DATE}</div>
                <div>{LABELS.CLASS_NAME}</div>
                <div>{LABELS.CENTRE}</div>
                <div>{LABELS.COURSE_LINE}</div>
                <div>Giờ</div>
                <div>{LABELS.MAIN_TEACHER}</div>
                <div>Giám khảo</div>
                <div style={{ textAlign: 'center' }}>{LABELS.STUDENTS}</div>
              </div>
              {sortedCandidates.map(c => {
                const slotId = c.slot._id;
                const isSelected = selected.has(slotId);
                return (
                  <div
                    key={slotId}
                    className={styles.classItem}
                    style={{
                      gridTemplateColumns: '36px minmax(0,0.9fr) minmax(0,2fr) minmax(0,1.3fr) minmax(0,0.7fr) minmax(0,0.9fr) minmax(0,1.4fr) minmax(0,1.2fr) 64px',
                      minWidth: 780,
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
                    <div style={{ fontSize: 12, color: c.judgeTeacher ? 'var(--text-primary)' : 'var(--text-tertiary)', fontWeight: c.judgeTeacher ? 510 : 400 }}>{c.judgeTeacher || '—'}</div>
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
