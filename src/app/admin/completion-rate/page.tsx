'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import { useAuth } from '@/lib/AuthContext';
import { isAuthenticated, loadSession } from '@/services/authService';
import { fetchAllClasses, dateRangeToUtcRange, GET_CLASSES_LIGHT_QUERY } from '@/services/classesService';
import { fetchAllCentres, Centre } from '@/services/centresService';
import { getCache, setCache, clearCache } from '@/lib/idb';
import { KPI_COLORS, completionScore, completionColor, COMPLETION_LEGEND } from '@/lib/kpiScoring';
import { getCourseCategory } from '@/lib/courseCategories';
import { getNavItemsWithRouter } from '@/lib/navigation';
import { useAllowedPages } from '@/hooks/useAllowedPages';
import { Class, StudentSlot } from '@/types/classes';
import { PageLayout } from '@/components/PageLayout';
import { ProtectedPage } from '@/components/ProtectedPage';
import {
  Icon, SortIcon, Spinner, useToast, ToastContainer,
  MultiSelect, SelectOption, RangeSlider, Toolbar, KPIStatCard,
  ChartSectionHeader, TableToolbar, TableGroupHeader, AdminTableSection,
  Modal, ModalHeader, EmptyState,
  initials,
  StandardXAxis, StandardYAxisCategory, CustomTooltip, VerticalBarChartConfig,
  SortableHeader, CentreSelect, QuickFilterChips, ExportButton,
  KPIThresholdSuggestions,
  CSVExportSettings, FilterChip, type CSVColumnConfig,
  COMPLETION_STATUS_LABELS, CompletionStatusBadge, type CompletionStatusKind,
  Badge, CourseCategoryBadge, CentreBadge,
} from '@/components/ui';
import { useTableSort } from '@/hooks/useTableSort';
import { useQuickFilterChips } from '@/hooks/useUserPreferences';
import { useCSVExportPreferences } from '@/hooks/useCSVExportPreferences';
import { CACHE_KEYS, LABELS, MESSAGES, ENTITIES, FORMAT, CLASS_INACTIVE_STATUSES, KPI_LABELS } from '@/constants';
import { useSharedDateRange, useSharedCentres } from '@/hooks/useSharedFilterState';
import { exportToCSV, CSVColumn, CSVFormatters } from '@/lib/csvExport';
import { isExemptStudent, DEFAULT_EXEMPTED_REASONS } from '@/lib/kpiCalculations';
import styles from '../../dashboard.module.css';

// ─── Constants ──────────────────────────────────────────────────────────────
// Reasons that are EXEMPTED by default (checked = exempt = excluded from formula)
// Imported from shared kpiCalculations to keep in sync with dashboard
const DEMO_REASON_KEY = 'DEMO_NOT_ARRANGED';
const COMPLETION_TARGETS = [100, 95, 90];

const REASON_LABELS: Record<string, string> = {
  'CHANGE_CLASS_SCHEDULE_CHANGE': 'Đổi lịch học',
  'TRANSFER_COURSE_LINE': 'Chuyển khối',
  'WRONG_ENROLL': 'Đăng ký nhầm',
  'DEMO_NOT_ARRANGED': 'Chưa sắp xếp thuyết trình cuối khoá',
  'DROP_OUT': 'Nghỉ học',
  'On hold': 'Tạm dừng',
  'ON_HOLD': 'Tạm dừng',
  'STUDENT_REFUSE_DEMO': 'Từ chối thuyết trình cuối khoá',
  'Class finished': 'Kết thúc khoá',
};

// KPI scoring is centralized in src/lib/kpiScoring.ts
const rateColor = completionColor;


// ─── Helpers ───────────────────────────────────────────────────────────────────
function normalizeCompletionReason(reason?: string | null): string {
  const trimmed = reason?.trim();
  if (!trimmed) return '';
  if (trimmed.toUpperCase().replace(/\s+/g, '_') === 'ON_HOLD') return 'ON_HOLD';
  return trimmed;
}

function normalizeCompletionReasonMap(map: Record<string, boolean>): Record<string, boolean> {
  return Object.entries(map).reduce((acc, [reason, checked]) => {
    const normalizedReason = normalizeCompletionReason(reason);
    if (!normalizedReason) return acc;
    acc[normalizedReason] = acc[normalizedReason] === true || checked;
    return acc;
  }, {} as Record<string, boolean>);
}

// isExemptStudent is imported from @/lib/kpiCalculations (shared with dashboard)

// ─── Multi-Select Dropdown ───────────────────────────────────────────────────


// ─── Custom Recharts Tooltip ─────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{ background: 'var(--text-primary)', color: 'var(--bg-surface)', padding: '8px 12px', borderRadius: "var(--radius-comfortable)", fontSize: 12, lineHeight: 1.6, boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
      <div style={{ fontWeight: 590, marginBottom: 'var(--space-1)' }}>{label}</div>
      <div>Tỷ lệ: <strong style={{ color: rateColor(d.rate) }}>{d.rate.toFixed(1)}%</strong></div>
      <div style={{ color: 'var(--text-quaternary)' }}>{d.pass}/{d.base} học viên</div>
      {d.classes !== undefined && <div style={{ color: 'var(--text-quaternary)' }}>{d.classes} lớp</div>}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { session, isLoading: authLoading, logout } = useAuth();
  const router = useRouter();

  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ loaded: 0, total: 0 });
  const [search, setSearch] = useState('');
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [centres, setCentres] = useState<Centre[]>([]);
  const [centresLoading, setCentresLoading] = useState(false);
  
  // Shared filter state (synced across pages)
  const [fromDate, toDate, setFromDate, setToDate, datesLoaded] = useSharedDateRange();
  const [selectedCentres, setSelectedCentres, centresLoaded] = useSharedCentres();
  
  const [toolbarSelectedCourses, setToolbarSelectedCourses] = useState<string[]>([]); // NEW: Toolbar-level courses

  // Quick filter chips from user preferences
  const { hasPreferences } = useQuickFilterChips();

  // Table filters
  const [selectedCourseLines, setSelectedCourseLines] = useState<string[]>([]);
  const [filterCentres, setFilterCentres] = useState<string[]>([]);
  const [filterReasons, setFilterReasons] = useState<string[]>([]);
  const [rateRange, setRateRange] = useState<[number, number]>([0, 100]);
  const [showDemoOnly, setShowDemoOnly] = useState(false);
  const [classCodeSearch, setClassCodeSearch] = useState('');

  // Table collapse states
  const [showActiveTable, setShowActiveTable] = useState(true);
  const [showInactiveTable, setShowInactiveTable] = useState(true);
  const [showExemptPanel, setShowExemptPanel] = useState(true);

  // CSV Export Settings
  const [showCSVSettings, setShowCSVSettings] = useState(false);
  const { columns: csvColumns, saveColumns } = useCSVExportPreferences(
    'completion-rate',
    getDefaultCSVColumns()
  );

  // Sorting
  const [sortKey, setSortKey] = useState<'name' | 'base' | 'rate' | 'pass' | 'teacher' | 'progress'>('rate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // exemptedReasons: true = checked = this reason is EXEMPTED (student not counted)
  //                  false/undefined = unchecked = student IS counted
  const [exemptedReasons, setExemptedReasons] = useState<Record<string, boolean>>({});
  const [exemptedCourses, setExemptedCourses] = useState<Record<string, boolean>>({});

  // UI
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [showCharts, setShowCharts] = useState(true);

  // Toast
  const { toasts, addToast, removeToast } = useToast();

  // Allowed pages (for navigation filtering)
  const { allowedPages, loading: permissionsLoading } = useAllowedPages();

  // ESC key handler for class detail modal
  useEffect(() => {
    if (!selectedClassId) return;
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedClassId(null);
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [selectedClassId]);


  // Load centres
  useEffect(() => {
    if (!isAuthenticated()) return;
    setCentresLoading(true);
    (async () => {
      try {
        const cached = await getCache(CACHE_KEYS.CENTRES);
        if (cached?.centres?.length) { setCentres(cached.centres); return; }
        const data = await fetchAllCentres();
        setCentres(data);
        await setCache(CACHE_KEYS.CENTRES, { centres: data });
      } catch (e) { console.error(e); }
      finally { setCentresLoading(false); }
    })();
  }, []);

  // Load class cache
  useEffect(() => {
    (async () => {
      try {
        const parsed = await getCache(CACHE_KEYS.COMPLETION);
        if (parsed) {
          if (parsed.classes) setClasses(parsed.classes);
          if (parsed.exemptedReasons) setExemptedReasons(normalizeCompletionReasonMap(parsed.exemptedReasons));
          if (parsed.exemptedCourses) setExemptedCourses(parsed.exemptedCourses);
        }
      } catch (e) { console.error(e); }
    })();
  }, []);

  const handleFetch = async () => {
    if (!fromDate || !toDate) return;
    const controller = new AbortController();
    setAbortController(controller);
    setLoading(true);
    setProgress({ loaded: 0, total: 0 });
    setClasses([]);
    let curReasons = normalizeCompletionReasonMap(exemptedReasons);
    let curClasses: Class[] = [];
    let curExcluded = { ...exemptedCourses };
    const tid = addToast(MESSAGES.LOADING.CONNECTING, 'loading');
    try {
      const { endDateFrom, endDateTo } = dateRangeToUtcRange(new Date(fromDate), new Date(toDate));
      const centreIds = selectedCentres.length > 0 ? selectedCentres : centres.map(c => c.id);
      const result = await fetchAllClasses({ endDateFrom, endDateTo, centres: centreIds, ...(classCodeSearch.trim() ? { search: classCodeSearch.trim() } : {}) }, (loaded, total, chunk) => {
        setProgress({ loaded, total });
        curClasses = [...curClasses, ...chunk];
        setClasses([...curClasses]);
        chunk.forEach(cls => {
          cls.students.forEach(st => {
            if (st.completionInfo?.status === 'UNCOMPLETED' && st.completionInfo.reason) {
              const r = normalizeCompletionReason(st.completionInfo.reason);
              if (curReasons[r] === undefined) curReasons[r] = DEFAULT_EXEMPTED_REASONS.includes(r);
            }
          });
          const cKey = getCourseKey(cls);
          // Exclude PREPARING classes as they are considered cancelled (forgotten to update status)
          if (cKey && !(cls.status === 'ABANDONED' || cls.status === 'REJECTED' || cls.status === 'PREPARING')) {
            if (curExcluded[cKey] === undefined) curExcluded[cKey] = false;
          }
        });
        setExemptedReasons({ ...curReasons });
        setExemptedCourses({ ...curExcluded });
      }, controller.signal, GET_CLASSES_LIGHT_QUERY);
      await setCache(CACHE_KEYS.COMPLETION, { classes: result, exemptedReasons: curReasons, exemptedCourses: curExcluded, timestamp: Date.now() });
      removeToast(tid);
      addToast(MESSAGES.LOADING.SUCCESS(result.length, ENTITIES.CLASSES), 'success');
    } catch (err: any) {
      if (err.message === 'Aborted' || err.name === 'AbortError') {
        removeToast(tid);
        addToast(MESSAGES.LOADING.STOPPED, 'info');
      } else {
        console.error(err);
        removeToast(tid);
        addToast(MESSAGES.ERROR.GENERIC, 'error');
      }
    } finally { 
      setLoading(false);
      setAbortController(null);
    }
  };

  const handleCancelFetch = () => {
    if (abortController) {
      abortController.abort();
    }
  };

  const handleClearCache = async () => {
    await clearCache(CACHE_KEYS.COMPLETION);
    setClasses([]); setExemptedReasons({}); setExemptedCourses({});
    addToast(MESSAGES.CACHE.CLEARED, 'success');
  };

  useEffect(() => {
    if (classes.length > 0 && !loading)
      setCache(CACHE_KEYS.COMPLETION, { classes, exemptedReasons, exemptedCourses, timestamp: Date.now() }).catch(console.error);
  }, [exemptedReasons, exemptedCourses, classes, loading]);

  // ─── Core Data Processing ────────────────────────────────────────────────
  const { normalClasses, cancelledClasses, availableCourseLines, courseOptions, reasonCounts, demoCount } = useMemo(() => {
    const rCounts: Record<string, number> = {};
    const norm: any[] = [], canc: any[] = [];
    const clSet = new Set<string>();
    const cOptions = new Map<string, { label: string; courseLine: string; course: string; count: number }>();
    let demoCount = 0;

    classes.forEach(cls => {
      const isCancelled = CLASS_INACTIVE_STATUSES.has(cls.status?.toUpperCase?.() || '');
      const cKey = getCourseCategory(cls);
      const courseKey = getCourseKey(cls);
      const isExcludedByCourse = courseKey ? exemptedCourses[courseKey] === true : false;
      let clsPass = 0, clsExcluded = 0, clsExempt = 0;
      const clsBase = cls.students.length;
      const uncompReasons: string[] = [];
      let hasDemo = false;

      cls.students.forEach(st => {
        const info = st.completionInfo;
        if (isExemptStudent(st, cls.slots)) { clsExempt++; return; }
        if (info?.status === 'PASSED' || info?.status === 'COMPLETED' || info?.status === 'FINISHED') { clsPass++; }
        else if (info?.status === 'UNCOMPLETED' && info.reason) {
          const reason = normalizeCompletionReason(info.reason);
          uncompReasons.push(reason);
          if (!isCancelled) rCounts[reason] = (rCounts[reason] || 0) + 1;
          // Checked = exempted = student NOT counted in formula
          if (exemptedReasons[reason] === true) clsExcluded++;
          if (reason === DEMO_REASON_KEY) hasDemo = true;
        }
      });
      if (hasDemo) demoCount++;

      const effectiveBase = clsBase - clsExcluded - clsExempt;
      const rate = effectiveBase > 0 ? (clsPass / effectiveBase) * 100 : 0;
      const reasonsSummary = uncompReasons.reduce((acc, r) => { acc[r] = (acc[r] || 0) + 1; return acc; }, {} as Record<string, number>);
      const cLine = getCourseCategory(cls);
      if (!isCancelled && cLine) clSet.add(cLine);
      
      // Build course options map with actual course names
      if (courseKey && !isCancelled) {
        const existing = cOptions.get(courseKey);
        if (existing) {
          existing.count++;
        } else {
          cOptions.set(courseKey, { 
            label: buildCourseLabel(cls), 
            courseLine: cls.course?.courseLine?.name || '', 
            course: courseKey,
            count: 1
          });
        }
      }

      const mapped = { ...cls, clsPass, clsBase, clsExempt, effectiveBase, rate, reasonsSummary, courseLineName: cLine, courseKey, isExcludedByCourse };
      if (isCancelled) canc.push(mapped); else norm.push(mapped);
    });

    return { normalClasses: norm, cancelledClasses: canc, availableCourseLines: Array.from(clSet).sort(), courseOptions: cOptions, reasonCounts: rCounts, demoCount };
  }, [classes, exemptedReasons, exemptedCourses]);

  // Centre IDs that appear in loaded data (for table-level filter)
  const tableCentreIds = useMemo(() => {
    const ids = new Set(normalClasses.map((c: any) => c.centre?.id).filter(Boolean));
    return Array.from(ids);
  }, [normalClasses]);

  const tableReasonOptions: SelectOption[] = useMemo(() =>
    Object.entries(reasonCounts).filter(([, c]) => c > 0).sort((a, b) => a[0].localeCompare(b[0]))
      .map(([r, count]) => ({ value: r, label: `${REASON_LABELS[r] || r} (${count})` })), [reasonCounts]);

  const courseLineOptions: SelectOption[] = useMemo(
    () => availableCourseLines.map(cl => ({ value: cl, label: cl })), [availableCourseLines]);

  // ─── Filter + Sort ───────────────────────────────────────────────────────
  const filteredNormalClasses = useMemo(() => {
    let filtered = normalClasses.filter(c => {
      if (c.isExcludedByCourse) return false;
      if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (selectedCourseLines.length > 0 && selectedCourseLines.length !== availableCourseLines.length && !selectedCourseLines.includes(c.courseLineName)) return false;
      if (filterCentres.length > 0 && filterCentres.length !== tableCentreIds.length && !filterCentres.includes(c.centre?.id)) return false;
      // Note: filterReasons uses tableReasonOptions, but computing it matches keys. If not ALL are selected, filter it.
      if (filterReasons.length > 0 && filterReasons.length !== Object.keys(reasonCounts).length && !filterReasons.some(r => Object.keys(c.reasonsSummary).includes(r))) return false;
      if (c.rate < rateRange[0] || c.rate > rateRange[1]) return false;
      if (showDemoOnly && !Object.keys(c.reasonsSummary).includes(DEMO_REASON_KEY)) return false;
      return true;
    });
    filtered.sort((a, b) => {
      let va: any, vb: any;
      if (sortKey === 'name') { va = a.name; vb = b.name; }
      else if (sortKey === 'base') { va = a.effectiveBase; vb = b.effectiveBase; }
      else if (sortKey === 'pass') { va = a.clsPass; vb = b.clsPass; }
      else if (sortKey === 'teacher') { va = getClassTeacher(a); vb = getClassTeacher(b); }
      else if (sortKey === 'progress') { va = getCompletedSessions(a); vb = getCompletedSessions(b); }
      else { va = a.rate; vb = b.rate; }
      if (va < vb) return sortOrder === 'asc' ? -1 : 1;
      if (va > vb) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    return filtered;
  }, [normalClasses, search, selectedCourseLines, filterCentres, filterReasons, rateRange, showDemoOnly, sortKey, sortOrder]);

  // ─── Stats ────────────────────────────────────────────────────────────────
  const filteredStats = useMemo(() => {
    const totalPass = filteredNormalClasses.reduce((acc, c) => acc + c.clsPass, 0);
    const totalBase = filteredNormalClasses.reduce((acc, c) => acc + c.effectiveBase, 0);
    const totalOriginal = filteredNormalClasses.reduce((acc, c) => acc + c.clsBase, 0);
    const totalExempt = filteredNormalClasses.reduce((acc, c) => acc + c.clsExempt, 0);
    const totalExcluded = totalOriginal - totalBase - totalExempt;
    const overallRate = totalBase > 0 ? (totalPass / totalBase) * 100 : 0;
    return { totalPass, totalBase, totalOriginal, totalExcluded, totalExempt, overallRate, totalClasses: filteredNormalClasses.length };
  }, [filteredNormalClasses]);

  const completionSuggestions = useMemo(() => COMPLETION_TARGETS.map(target => {
    const needed = Math.ceil((target / 100) * filteredStats.totalBase) - filteredStats.totalPass;
    return { target, needed: Math.max(0, needed) };
  }), [filteredStats]);

  // ─── Chart Data ──────────────────────────────────────────────────────────
  const centreChartData = useMemo(() => {
    const map: Record<string, { pass: number; base: number; name: string; classes: number }> = {};
    filteredNormalClasses.forEach((cls: any) => {
      const id = cls.centre?.id || 'unknown';
      const name = cls.centre?.shortName || cls.centre?.name || 'Không rõ';
      if (!map[id]) map[id] = { pass: 0, base: 0, name, classes: 0 };
      map[id].pass += cls.clsPass;
      map[id].base += cls.effectiveBase;
      map[id].classes += 1;
    });
    return Object.values(map)
      .map(d => ({ ...d, rate: d.base > 0 ? (d.pass / d.base) * 100 : 0 }))
      .sort((a, b) => b.rate - a.rate);
  }, [filteredNormalClasses]);

  // CSV Export handler
  const handleExportCSV = useCallback(() => {
    if (filteredNormalClasses.length === 0) {
      addToast('Không có dữ liệu để xuất', 'info');
      return;
    }
    
    try {
      const columns = getCSVColumnsFromConfig(csvColumns);
      
      if (columns.length === 0) {
        addToast('Vui lòng chọn ít nhất một cột để xuất', 'info');
        return;
      }
      
      exportToCSV(filteredNormalClasses, columns, 'ty-le-hoan-thanh');
      addToast(`Đã xuất ${filteredNormalClasses.length} lớp với ${columns.length} cột`, 'success');
    } catch (error) {
      console.error('Export error:', error);
      addToast('Có lỗi xảy ra khi xuất file', 'error');
    }
  }, [filteredNormalClasses, csvColumns, addToast]);

  const courseLineChartData = useMemo(() => {
    const map: Record<string, { pass: number; base: number; classes: number }> = {
      Coding: { pass: 0, base: 0, classes: 0 },
      Robotics: { pass: 0, base: 0, classes: 0 },
      Art: { pass: 0, base: 0, classes: 0 },
      Others: { pass: 0, base: 0, classes: 0 },
    };
    filteredNormalClasses.forEach((cls: any) => {
      const key = getCourseCategory(cls);
      if (!map[key]) map[key] = { pass: 0, base: 0, classes: 0 };
      map[key].pass += cls.clsPass;
      map[key].base += cls.effectiveBase;
      map[key].classes += 1;
    });
    return Object.entries(map)
      .map(([name, d]) => ({ name, ...d, rate: d.base > 0 ? (d.pass / d.base) * 100 : 0 }))
      .sort((a, b) => b.rate - a.rate);
  }, [filteredNormalClasses]);

  const handleToggleReason = (r: string) => setExemptedReasons(prev => ({ ...prev, [r]: !prev[r] }));
  const handleToggleCourse = (k: string) => setExemptedCourses(prev => ({ ...prev, [k]: !prev[k] }));
  const handleResetExemptions = () => {
    const nextReasons: Record<string, boolean> = {};
    Object.keys(exemptedReasons).forEach(reason => {
      nextReasons[reason] = DEFAULT_EXEMPTED_REASONS.includes(reason);
    });
    setExemptedReasons(nextReasons);
    setExemptedCourses({});
    addToast('Đã khôi phục quy tắc miễn trừ mặc định', 'success');
  };
  const handleSort = (k: typeof sortKey) => {
    if (sortKey === k) setSortOrder(p => p === 'asc' ? 'desc' : 'asc');
    else { setSortKey(k); setSortOrder('asc'); }
  };

  const selectedClassData = useMemo(() => classes.find(c => c.id === selectedClassId), [classes, selectedClassId]);

  const modalStudentData = useMemo(() => {
    if (!selectedClassData) return [];
    
    return selectedClassData.students.map((st: StudentSlot) => {
      const exempt = isExemptStudent(st, selectedClassData.slots);
      let absentCount = 0;
      selectedClassData.slots?.forEach(slot => {
        const att = slot.studentAttendance?.find(a => a.student.id === st.student.id);
        if (att && (att.status === 'ABSENT' || att.status === 'ABSENT_WITH_NOTICE')) {
          absentCount++;
        }
      });
      const info = st.completionInfo;
      const isPassed = info?.status === 'PASSED' || info?.status === 'COMPLETED' || info?.status === 'FINISHED';
      // LMS-recorded status (raw, no exemption rule applied)
      const statusKind: CompletionStatusKind = exempt ? 'exempt' : isPassed ? 'completed' : 'incomplete';
      const statusLabel = COMPLETION_STATUS_LABELS[statusKind];

      // Final/effective status after applying exemption rules
      const normalizedReason = normalizeCompletionReason(info?.reason);
      const exemptedByReason = !exempt && !isPassed && !!normalizedReason && exemptedReasons[normalizedReason] === true;
      const finalStatusKind: CompletionStatusKind = (exempt || exemptedByReason) ? 'exempt' : isPassed ? 'completed' : 'incomplete';
      
      return {
        ...st,
        name: st.student.fullName || st.student.customer?.fullName || '',
        statusLabel,
        statusKind,
        finalStatusKind,
        exemptedByReason,
        statusOrder: exempt ? 0 : isPassed ? 1 : 2,
        reason: normalizedReason,
        absentCount,
        exempt
      };
    });
  }, [selectedClassData, exemptedReasons]);

  type ModalStudentSortKey = 'name' | 'statusOrder' | 'reason' | 'absentCount';
  
  const { 
    sortedData: sortedModalStudents, 
    sortBy: modalSortBy, 
    sortOrder: modalSortOrder, 
    handleSort: handleModalSort 
  } = useTableSort<typeof modalStudentData[0], ModalStudentSortKey>({
    data: modalStudentData,
    defaultSortKey: 'name' as ModalStudentSortKey,
    defaultSortOrder: 'asc'
  });

  const hasTableFilter = selectedCourseLines.length > 0 || filterCentres.length > 0 || filterReasons.length > 0
    || showDemoOnly || rateRange[0] > 0 || rateRange[1] < 100 || search.trim().length > 0;
  const clearTableFilters = () => { setSelectedCourseLines([]); setFilterCentres([]); setFilterReasons([]); setRateRange([0, 100]); setShowDemoOnly(false); setSearch(''); };

  if (authLoading) return null;

  // SortIcon from @/components/ui — used below with sortKey and sortDir props

  // User display — read directly from localStorage as the authoritative source.
  // Context session may lag during rehydration (brief null window after authLoading=false).
  const _storedSession = session ?? loadSession();
  const _displayName = _storedSession?.displayName?.trim() || '';
  const _email = _storedSession?.email || '';
  const userAvatar = _displayName ? initials(_displayName) : _email.charAt(0).toUpperCase();
  const userName = _displayName || _email.split('@')[0];
  const userEmail = _email;

  // Navigation items
  const navItems = getNavItemsWithRouter('completion', router, allowedPages);

  return (
    <ProtectedPage pageKey="completion">
      <>
        <ToastContainer toasts={toasts} onRemove={removeToast} />
        <PageLayout
          title="Tỷ lệ Hoàn thành"
          activePage="completion"
          sidebarOpen={sidebarOpen}
          onSidebarToggle={setSidebarOpen}
        >
          {/* TOOLBAR: Cơ sở → Từ → Đến → Tải dữ liệu → Làm mới dữ liệu */}
          <Toolbar
            centres={centres} selectedCentres={selectedCentres}
            onCentresChange={setSelectedCentres} centresLoading={centresLoading}
            dateFrom={fromDate} dateTo={toDate}
            onDateFromChange={setFromDate} onDateToChange={setToDate}
            onFetch={handleFetch} loading={loading} progress={progress}
            hasData={classes.length > 0} onClearCache={handleClearCache}
            onCancel={handleCancelFetch}
            showRegionQuickSelect={true}
            classCodeSearch={classCodeSearch}
            onClassCodeSearchChange={setClassCodeSearch}
          quickFilterSlots={
            hasPreferences && (
              <QuickFilterChips
                centres={centres}
                selectedCentres={selectedCentres}
                onCentresChange={setSelectedCentres}
                selectedCourses={toolbarSelectedCourses}
                onCoursesChange={setToolbarSelectedCourses}
                showCentres={true}
                showCourses={true}
              />
            )
          }
        />

          <AnimatePresence mode="wait">
            {(classes.length > 0 || loading) && (
              <motion.div key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}
                className={styles.dashboardLayout}>
                {/* LEFT */}
                <div>
                  {/* STAT CARDS */}
                  <div className={styles.statsGrid}>
                    {(() => {
                      const score = completionScore(filteredStats.overallRate);
                      const needed95 = completionSuggestions.find(s => s.target === 95)?.needed ?? 0;
                      return [
                        { label: KPI_LABELS.COMPLETION_RATE, value: `${filteredStats.overallRate.toFixed(1)}%`, desc: `${filteredStats.totalPass} / ${filteredStats.totalBase} học viên`, color: rateColor(filteredStats.overallRate), score },
                        { label: 'CẦN THÊM ĐỂ ĐẠT 95%', value: String(needed95), desc: needed95 === 0 ? 'Đã đạt mốc 95%' : 'học viên cần chuyển sang đạt', color: needed95 === 0 ? 'var(--status-success)' : 'var(--status-warning)' },
                        { label: KPI_LABELS.DATA_SCOPE, value: String(filteredStats.totalClasses), desc: `${filteredStats.totalExcluded + filteredStats.totalExempt} học viên được miễn trừ`, color: 'var(--text-secondary)' },
                      ];
                    })().map((card, i) => (
                      <KPIStatCard
                        key={card.label}
                        label={card.label}
                        value={card.value}
                        desc={card.desc}
                        valueColor={card.color}
                        score={card.score}
                        icon={card.score ? <Icon.CheckCircle size={18} /> : undefined}
                        delay={i * 0.07}
                      />
                    ))}
                  </div>

                  {/* SUGGESTIONS */}
                  {filteredNormalClasses.length > 0 && (
                    <KPIThresholdSuggestions
                      label="Để đạt mục tiêu:"
                      items={completionSuggestions.map(({ target, needed }) => ({
                        key: String(target),
                        target: `${target}%`,
                        done: needed === 0,
                        content: needed === 0
                          ? <><Icon.Check size={11} /> Đã đạt</>
                          : <>cần thêm <strong>{needed}</strong> học viên</>,
                      }))}
                    />
                  )}

                  {/* CHARTS */}
                  {filteredNormalClasses.length > 1 && (centreChartData.length > 1 || courseLineChartData.length > 1) && (
                    <div className={styles.chartsSection}>
                      <ChartSectionHeader
                        title="Biểu Đồ So Sánh"
                        visible={showCharts}
                        onToggle={() => setShowCharts(p => !p)}
                      />
                      <AnimatePresence>
                        {showCharts && (
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25 }}
                            className={styles.chartsGrid}>

                            {/* Both chart cards share the same total height so legends align at bottom */}
                            {(() => {
                              const LEGEND_H = 44; // px reserved for legend at bottom
                              const TITLE_H = 28;  // px for the chart title
                              const centreH = Math.max(120, centreChartData.length * 32);
                              const courseH = Math.max(120, courseLineChartData.length * 32);
                              // Both cards use the taller chart's height so they align
                              const sharedChartH = Math.max(centreH, courseH);
                              const cardH = sharedChartH + LEGEND_H + TITLE_H;
                              return (
                                <>
                                  {/* Chart cơ sở */}
                                  {centreChartData.length > 1 && (
                                    <div className={styles.chartCard} style={{ height: cardH, display: 'flex', flexDirection: 'column' }}>
                                      <div className={styles.chartTitle}>Theo Cơ Sở</div>
                                      <div style={{ flex: 1, minHeight: 0 }}>
                                        <ResponsiveContainer width="100%" height={sharedChartH}>
                                          <BarChart data={centreChartData} {...VerticalBarChartConfig}>
                                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(0,0,0,0.06)" />
                                            <StandardXAxis label="Tỷ lệ (%)" domain={[0, 100]} tickFormatter={v => `${v}%`} />
                                            <StandardYAxisCategory dataKey="name" label="Cơ sở" />
                                            <ReTooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
                                            <Bar dataKey="rate" radius={[0, 4, 4, 0]} maxBarSize={16}>
                                              {centreChartData.map((d, i) => (
                                                <Cell key={i} fill={rateColor(d.rate)} fillOpacity={0.85} />
                                              ))}
                                            </Bar>
                                          </BarChart>
                                        </ResponsiveContainer>
                                      </div>
                                      <div className={styles.chartLegend}>
                                        {COMPLETION_LEGEND.map(l => ({ color: KPI_COLORS[l.score], label: l.label })).map(l => (
                                          <div key={l.label} className={styles.legendItem}>
                                            <span className={styles.legendSwatch} style={{ background: l.color }} />
                                            {l.label}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Chart khối */}
                                  {courseLineChartData.length > 1 && (
                                    <div className={styles.chartCard} style={{ height: cardH, display: 'flex', flexDirection: 'column' }}>
                                      <div className={styles.chartTitle}>Theo Khối</div>
                                      <div style={{ flex: 1, minHeight: 0 }}>
                                        <ResponsiveContainer width="100%" height={sharedChartH}>
                                          <BarChart data={courseLineChartData} {...VerticalBarChartConfig}>
                                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(0,0,0,0.06)" />
                                            <StandardXAxis label="Tỷ lệ (%)" domain={[0, 100]} tickFormatter={v => `${v}%`} />
                                            <StandardYAxisCategory dataKey="name" label="Khối học" />
                                            <ReTooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
                                            <Bar dataKey="rate" radius={[0, 4, 4, 0]} maxBarSize={16}>
                                              {courseLineChartData.map((d, i) => (
                                                <Cell key={i} fill={rateColor(d.rate)} fillOpacity={0.85} />
                                              ))}
                                            </Bar>
                                          </BarChart>
                                        </ResponsiveContainer>
                                      </div>
                                      <div className={styles.chartLegend}>
                                        {COMPLETION_LEGEND.map(l => ({ color: KPI_COLORS[l.score], label: l.label })).map(l => (
                                          <div key={l.label} className={styles.legendItem}>
                                            <span className={styles.legendSwatch} style={{ background: l.color }} />
                                            {l.label}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </>
                              );
                            })()}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  {/* TABLE */}
                  <AdminTableSection
                    title="Danh sách Lớp học"
                    count={filteredNormalClasses.length}
                    isExpanded={showActiveTable}
                    onToggle={() => setShowActiveTable(p => !p)}
                    actionSlot={
                      <ExportButton
                        onClick={handleExportCSV}
                        onSettingsClick={() => setShowCSVSettings(true)}
                        disabled={filteredNormalClasses.length === 0}
                        count={filteredNormalClasses.length}
                      />
                    }
                    toolbarSlot={
                      <TableToolbar
                        search={search} onSearchChange={setSearch} searchPlaceholder="Tìm tên lớp..."
                        quickFilterSlots={
                          <>
                            {hasPreferences && (
                              <QuickFilterChips
                                centres={centres}
                                selectedCentres={filterCentres}
                                onCentresChange={setFilterCentres}
                                selectedCourses={selectedCourseLines}
                                onCoursesChange={setSelectedCourseLines}
                                showCentres={true}
                                showCourses={true}
                              />
                            )}
                            <FilterChip
                              active={showDemoOnly}
                              count={demoCount}
                              countDisplay="always"
                              onClick={() => setShowDemoOnly(p => !p)}
                            >
                              Chưa thuyết trình
                            </FilterChip>
                          </>
                        }
                        filterSlots={
                          <>
                            {tableCentreIds.length > 1 && (
                              <CentreSelect menuPosition="fixed"
                                centres={centres}
                                selected={filterCentres}
                                onChange={setFilterCentres}
                                filterToIds={tableCentreIds}
                                placeholder="Tất cả cơ sở"
                                maxDisplay={1}
                                searchable
                              />
                            )}
                            {courseLineOptions.length > 1 && (
                              <MultiSelect menuPosition="fixed" options={courseLineOptions} selected={selectedCourseLines}
                                onChange={setSelectedCourseLines} placeholder="Tất cả khối" maxDisplay={2} />
                            )}
                            {tableReasonOptions.length > 1 && (
                              <MultiSelect menuPosition="fixed" options={tableReasonOptions} selected={filterReasons}
                                onChange={setFilterReasons} placeholder="Mọi lý do" maxDisplay={1} />
                            )}
                          </>
                        }
                        rangeValue={rateRange} onRangeChange={setRateRange}
                        hasFilter={hasTableFilter} onClearFilter={clearTableFilters}
                      />
                    }
                  >
                          <div className={styles.tableScrollWrapper}>
                            <div className={styles.classItemHeader}>
                        <div className={`${styles.sortableCol} ${sortKey === 'name' ? styles.activeSort : ''}`} onClick={() => handleSort('name')}>Lớp học <SortIcon col="name" sortKey={sortKey} sortDir={sortOrder} /></div>
                        <div className={`${styles.sortableCol} ${sortKey === 'teacher' ? styles.activeSort : ''}`} onClick={() => handleSort('teacher')}>Giáo viên <SortIcon col="teacher" sortKey={sortKey} sortDir={sortOrder} /></div>
                        <div className={`${styles.sortableCol} ${sortKey === 'progress' ? styles.activeSort : ''}`} onClick={() => handleSort('progress')}>Tiến độ <SortIcon col="progress" sortKey={sortKey} sortDir={sortOrder} /></div>
                        <div className={`${styles.sortableCol} ${sortKey === 'base' ? styles.activeSort : ''}`} onClick={() => handleSort('base')}>{LABELS.STUDENTS} <SortIcon col="base" sortKey={sortKey} sortDir={sortOrder} /></div>
                        <div className={`${styles.sortableCol} ${sortKey === 'rate' ? styles.activeSort : ''}`} onClick={() => handleSort('rate')}>Tỷ lệ <SortIcon col="rate" sortKey={sortKey} sortDir={sortOrder} /></div>
                        <div>Lý do chưa hoàn thành</div>
                      </div>

                      {loading && classes.length === 0
                        ? Array.from({ length: 8 }).map((_, i) => (
                          <div key={i} className={styles.skeletonRow}>
                            <div className={styles.skeletonBlock} style={{ width: '65%' }} />
                            <div className={styles.skeletonBlock} style={{ width: '40%' }} />
                            <div className={styles.skeletonBlock} style={{ width: '50%' }} />
                            <div className={styles.skeletonBlock} style={{ width: '85%' }} />
                          </div>
                        ))
                        : (
                          <AnimatePresence initial={false}>
                            {filteredNormalClasses.map((cls: any, idx: number) => (
                              <motion.div key={cls.id} className={styles.classItem}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.18, delay: Math.min(idx * 0.015, 0.3) }}
                                onClick={() => setSelectedClassId(cls.id)}>
                                <div className={styles.className}>
                                  {cls.name}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', marginTop: 2 }}>
                                    <CourseCategoryBadge category={cls.courseLineName} size="sm" />
                                    <CentreBadge name={cls.centre?.name} />
                                  </div>
                                </div>
                                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                                  {getClassTeacher(cls)}
                                </div>
                                <div className={styles.sizeCol}>
                                  <span style={{ fontWeight: 590, color: 'var(--text-primary)' }}>{getCompletedSessions(cls)}</span>
                                  <span style={{ color: 'var(--text-quaternary)' }}>/{cls.numberOfSessions || 0}</span>
                                </div>
                                <div className={styles.sizeCol}>
                                  <span style={{ fontWeight: 590, color: 'var(--text-primary)' }}>{cls.clsPass}</span>
                                  <span style={{ color: 'var(--text-quaternary)' }}>/{cls.effectiveBase}</span>
                                </div>
                                <div className={styles.completionCol}>
                                  <span style={{ color: rateColor(cls.rate), fontWeight: 590, minWidth: 38 }}>
                                    {cls.effectiveBase > 0 ? `${cls.rate.toFixed(0)}%` : 'N/A'}
                                  </span>
                                  <div className={styles.miniBarHolder}>
                                    <motion.div className={styles.miniBarFill}
                                      initial={{ width: 0 }}
                                      animate={{ width: `${Math.min(cls.rate, 100)}%` }}
                                      transition={{ duration: 0.5, delay: Math.min(idx * 0.015, 0.3) }}
                                      style={{ background: rateColor(cls.rate) }} />
                                  </div>
                                </div>
                                <div className={styles.reasonsPreview}>
                                  {Object.keys(cls.reasonsSummary).length > 0
                                    ? Object.entries(cls.reasonsSummary).map(([res, count], i) => (
                                      <Badge key={i} variant={res === DEMO_REASON_KEY ? 'demo' : 'default'} size="sm" shape="rounded"
                                        style={{ opacity: exemptedReasons[res] === true ? 0.35 : 1 }}>
                                        {REASON_LABELS[res] || res}: {count as number}
                                      </Badge>
                                    ))
                                    : <span style={{ color: 'var(--text-quaternary)' }}>—</span>}
                                  {cls.clsExempt > 0 && <Badge variant="exempt" size="sm" shape="rounded">Miễn trừ: {cls.clsExempt}</Badge>}
                                </div>
                              </motion.div>
                            ))}
                          </AnimatePresence>
                        )}

                      {!loading && filteredNormalClasses.length === 0 && classes.length > 0 && (
                        <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--text-quaternary)', fontSize: 13 }}>
                          Không có lớp nào khớp với bộ lọc hiện tại.
                        </div>
                      )}
                            </div>{/* end tableScrollWrapper */}
                  </AdminTableSection>

                  {cancelledClasses.length > 0 && (
                    <div className={styles.tableSection} style={{ opacity: 0.5, marginTop: 'var(--space-4)' }}>
                      <TableGroupHeader
                        title="Lớp đã Huỷ"
                        count={cancelledClasses.length}
                        note="Không tính vào Tỷ lệ Hoàn thành"
                        isExpanded={showInactiveTable}
                        onToggle={() => setShowInactiveTable(p => !p)}
                      />
                      <AnimatePresence initial={false}>
                        {showInactiveTable && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                            <div className={styles.tableScrollWrapper} style={{ minWidth: 0 }}>
                              {cancelledClasses.map((cls: any) => (
                                <div key={cls.id} className={styles.classItem} style={{ gridTemplateColumns: '2fr 1fr' }} onClick={() => setSelectedClassId(cls.id)}>
                                  <div className={styles.className}>{cls.name}</div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', marginTop: 2 }}>
                                    <CourseCategoryBadge category={cls.courseLineName} size="sm" />
                                    <CentreBadge name={cls.centre?.name} />
                                    <span style={{ fontSize: 11, color: 'var(--text-quaternary)', marginLeft: 4 }}>• {cls.status}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </div>

                {/* RIGHT PANELS */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                  <div className={styles.chartsSection}>
                    <div className={styles.chartsSectionHeader} onClick={() => setShowExemptPanel(!showExemptPanel)} style={{ cursor: 'pointer' }}>
                      <div className={styles.chartsSectionTitle}>
                        <Icon.CheckCircle size={15} />
	                        Quy tắc Miễn trừ
	                      </div>
	                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
	                        <button
	                          type="button"
	                          className={styles.chartToggle}
	                          aria-label="Khôi phục quy tắc mặc định"
	                          title="Khôi phục quy tắc mặc định"
	                          onClick={(e) => {
	                            e.stopPropagation();
	                            handleResetExemptions();
	                          }}
	                        >
	                          <Icon.Refresh />
	                        </button>
	                        <Icon.ChevronDown
	                          size={16}
	                          color="var(--text-tertiary)"
	                          style={{
	                            transform: showExemptPanel ? 'rotate(180deg)' : 'rotate(0deg)',
	                            transition: 'transform 0.2s ease'
	                          }}
	                        />
	                      </div>
	                    </div>
                    <AnimatePresence initial={false}>
                      {showExemptPanel && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                          <div style={{ padding: 'var(--space-4)' }}>
                            {(() => {
                              const visibleReasons = Object.keys(exemptedReasons)
                                .sort()
                                .filter(reason => (reasonCounts[reason] || 0) > 0 || DEFAULT_EXEMPTED_REASONS.includes(reason));

                              if (visibleReasons.length === 0) {
                                return (
                                  <div style={{ color: 'var(--text-quaternary)', fontSize: 12, lineHeight: 1.5, marginBottom: 'var(--space-4)' }}>
                                    Học viên vắng ở các buổi được chọn sẽ không bắt buộc có nhận xét.
                                  </div>
                                );
                              }

                              return (
                                <div style={{ marginBottom: 'var(--space-4)' }}>
                                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 'var(--space-2)' }}>
                                    Miễn trừ theo Lý do
                                  </div>
                                  <div className={styles.reasonList}>
                                    {visibleReasons.map(reason => {
                                      const count = reasonCounts[reason] || 0;
                                      return (
                                        <label key={reason} className={styles.reasonItem}>
                                          <input type="checkbox" className={styles.reasonCheckbox}
                                            checked={exemptedReasons[reason] === true} onChange={() => handleToggleReason(reason)} />
                                          <div className={styles.reasonLabel}>
                                            <span>{REASON_LABELS[reason] || reason}</span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', flexShrink: 0 }}>
                                              <span className={styles.reasonCount}>{count}</span>
                                              <div className={styles.tooltipWrap}>
                                                <i className={styles.tooltipIcon}>i</i>
                                                <div className={styles.tooltipBox}>{reason}</div>
                                              </div>
                                            </div>
                                          </div>
                                        </label>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })()}

                            {/* Miễn trừ theo Khoá học */}
                            {courseOptions.size > 0 && (
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 'var(--space-2)' }}>
                                  Miễn trừ theo Khoá học
                                </div>
                                <div className={styles.reasonList}>
                                  {Array.from(courseOptions.entries()).sort((a, b) => a[1].label.localeCompare(b[1].label)).map(([key, { label, count }]) => (
                                    <label key={key} className={styles.reasonItem}>
                                      <input type="checkbox" className={styles.reasonCheckbox}
                                        checked={exemptedCourses[key] === true} onChange={() => handleToggleCourse(key)} />
                                      <div className={styles.reasonLabel}>
                                        <span style={{ fontSize: 12 }}>{label}</span>
                                        <span className={styles.reasonCount}>{count}</span>
                                      </div>
                                    </label>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Empty State */}
          {!loading && classes.length === 0 && (
            <EmptyState
              icon={<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="3" y1="9" x2="21" y2="9" />
                <line x1="9" y1="21" x2="9" y2="9" />
              </svg>}
              title="Chưa có dữ liệu lớp học"
              subtitle={'Chọn khoảng thời gian và nhấn "Tải dữ liệu"'}
            />
          )}

      {/* MODAL */}
      <AnimatePresence>
        {selectedClassData && (
          <motion.div className={styles.modalOverlay}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setSelectedClassId(null)}>
            <motion.div className={styles.modalContent}
              initial={{ scale: 0.95, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 8 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              onClick={e => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <div style={{ minWidth: 0 }}>
                  <h2 className={styles.modalTitle}>{selectedClassData.name}</h2>
                  <p className={styles.modalSubtitle}>
                    {selectedClassData.course?.name} — {selectedClassData.centre?.name} &nbsp;·&nbsp; {selectedClassData.students.length} học viên
                  </p>
                </div>
                <button className={styles.closeModalBtn} onClick={() => setSelectedClassId(null)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
              </div>
              <div className={styles.modalBody} style={{ padding: '16px 20px 20px' }}>
                <div className={styles.tableScrollWrapper}>
                  <table className={styles.studentTable}>
                  <thead>
                    <tr>
                      <SortableHeader label="Học viên" sortKey="name" currentSortKey={modalSortBy} sortOrder={modalSortOrder} onSort={(key) => handleModalSort(key as ModalStudentSortKey)} />
                      <SortableHeader label="Trạng thái trên LMS" sortKey="statusOrder" currentSortKey={modalSortBy} sortOrder={modalSortOrder} onSort={(key) => handleModalSort(key as ModalStudentSortKey)} />
                      <th style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Trạng thái chốt</th>
                      <SortableHeader label="Lý do" sortKey="reason" currentSortKey={modalSortBy} sortOrder={modalSortOrder} onSort={(key) => handleModalSort(key as ModalStudentSortKey)} />
                      <SortableHeader label="Buổi vắng" sortKey="absentCount" currentSortKey={modalSortBy} sortOrder={modalSortOrder} onSort={(key) => handleModalSort(key as ModalStudentSortKey)} />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedModalStudents.map((st) => {
                      const absentSlots: string[] = [];
                      selectedClassData.slots?.forEach(slot => {
                        const att = slot.studentAttendance?.find(a => a.student.id === st.student.id);
                        if (att && (att.status === 'ABSENT' || att.status === 'ABSENT_WITH_NOTICE')) {
                          const d = slot.date ? new Date(slot.date).toLocaleDateString('vi-VN') : '?';
                          absentSlots.push(`${d} (${att.status === 'ABSENT_WITH_NOTICE' ? 'Có phép' : 'KX'})`);
                        }
                      });
                      const info = st.completionInfo;
                      const isPassed = info?.status === 'PASSED' || info?.status === 'COMPLETED' || info?.status === 'FINISHED';
                      const statusKind: CompletionStatusKind = st.exempt ? 'exempt' : isPassed ? 'completed' : 'incomplete';
                      return (
                        <tr key={st._id}>
                          <td style={{ fontWeight: 510 }}>{st.name}</td>
                          <td><CompletionStatusBadge status={statusKind} /></td>
                          <td>
                            {/* Final status after exemption rules */}
                            <CompletionStatusBadge status={st.finalStatusKind} />
                            {st.exemptedByReason && (
                              <div style={{ fontSize: 11, color: 'var(--text-quaternary)', marginTop: 2 }}>Miễn trừ theo lý do</div>
                            )}
                          </td>
                          <td style={{ fontSize: 12, color: st.reason === DEMO_REASON_KEY ? 'var(--status-dark-orange)' : 'var(--text-tertiary)' }}>
                            {st.exempt ? <em style={{ color: 'var(--text-quaternary)' }}>Chưa phát sinh buổi học</em>
                              : st.reason ? (REASON_LABELS[st.reason] || st.reason) : '—'}
                          </td>
                          <td>
                            {absentSlots.length > 0
                              ? <div className={styles.datesList}>
                                <div style={{ color: 'var(--status-error)', fontWeight: 590, marginBottom: 'var(--space-1)' }}>{absentSlots.length} buổi</div>
                                {absentSlots.map((d, i) => <div key={i} style={{ fontSize: 11 }}>• {d}</div>)}
                              </div>
                              : <span style={{ fontSize: 12, color: 'var(--text-quaternary)' }}>{st.exempt ? '—' : 'Đầy đủ'}</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      </PageLayout>

      {/* CSV Export Settings Modal */}
      <CSVExportSettings
        isOpen={showCSVSettings}
        onClose={() => setShowCSVSettings(false)}
        columns={csvColumns}
        onSave={saveColumns}
        title="Cài đặt xuất CSV - Tỷ lệ hoàn thành"
      />
    </>
    </ProtectedPage>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getCourseKey(cls: Class): string | null {
  const courseName = cls.course?.name;
  if (!courseName) return null;
  return courseName;
}
function buildCourseLabel(cls: Class): string {
  const cl = cls.course?.courseLine?.name;
  const cn = cls.course?.name;
  if (cl && cn) return `[${cl}] ${cn}`;
  return cn || cl || 'Không rõ';
}
function getClassTeacher(cls: Class): string {
  // Try to get from slots, prioritizing LEC role
  if (cls.slots && cls.slots.length > 0) {
    for (const slot of cls.slots) {
      // First try to find LEC from slot.teachers (has role info)
      if (slot.teachers && slot.teachers.length > 0) {
        const lec = slot.teachers.find(t => t.role?.shortName === 'LEC');
        if (lec) return lec.teacher.fullName;
        // If no LEC found, take first teacher as fallback
        return slot.teachers[0].teacher.fullName;
      }
      // Fallback to teacherAttendance (no role info, but better than nothing)
      if (slot.teacherAttendance && slot.teacherAttendance.length > 0) {
        return slot.teacherAttendance[0].teacher.fullName;
      }
    }
  }
  // Fallback to class teachers, prioritizing LEC
  if (cls.teachers && cls.teachers.length > 0) {
    const lec = cls.teachers.find(t => t.role?.shortName === 'LEC');
    if (lec) return lec.teacher.fullName;
    return cls.teachers[0].teacher.fullName;
  }
  return 'Không rõ';
}

function getCompletedSessions(cls: Class): number {
  // Count slots that have passed (date is in the past)
  if (!cls.slots || cls.slots.length === 0) return 0;
  
  const now = new Date();
  return cls.slots.filter(slot => {
    try {
      const slotDate = new Date(slot.date);
      return slotDate < now;
    } catch {
      return false;
    }
  }).length;
}

// ─── CSV Export Configuration ─────────────────────────────────────────────────
function getDefaultCSVColumns(): CSVColumnConfig[] {
  const allReasons = Object.keys(REASON_LABELS);
  
  const baseColumns: CSVColumnConfig[] = [
    { id: 'code', label: 'Mã lớp', enabled: true },
    { id: 'courseLine', label: 'Khối học', enabled: true },
    { id: 'centre', label: 'Cơ sở', enabled: true },
    { id: 'centreCode', label: 'Mã cơ sở', enabled: true },
    { id: 'teacher', label: 'Giáo viên', enabled: true },
    { id: 'sessionsCompleted', label: 'Buổi đã học', enabled: true },
    { id: 'totalSessions', label: 'Tổng buổi', enabled: true },
    { id: 'studentsCompleted', label: 'Học viên hoàn thành', enabled: true },
    { id: 'effectiveBase', label: 'Tổng học viên (hiệu lực)', enabled: true },
    { id: 'totalBase', label: 'Tổng học viên (gốc)', enabled: true },
    { id: 'rate', label: 'Tỷ lệ hoàn thành (%)', enabled: true },
    { id: 'status', label: 'Trạng thái', enabled: true },
  ];
  
  const reasonColumns: CSVColumnConfig[] = allReasons.map(reason => ({
    id: `reason_${reason}`,
    label: REASON_LABELS[reason] || reason,
    enabled: true,
  }));
  
  const exemptColumn: CSVColumnConfig = {
    id: 'exempt',
    label: 'Miễn trừ',
    enabled: true,
  };
  
  return [...baseColumns, ...reasonColumns, exemptColumn];
}

function getCSVColumnsFromConfig(config: CSVColumnConfig[]): CSVColumn<any>[] {
  const columnMap: Record<string, CSVColumn<any>> = {
    code: { header: 'Mã lớp', accessor: 'name' },
    courseLine: { header: 'Khối học', accessor: 'courseLineName' },
    centre: { header: 'Cơ sở', accessor: (row) => row.centre?.name || '—' },
    centreCode: { header: 'Mã cơ sở', accessor: (row) => row.centre?.shortName || '—' },
    teacher: { header: 'Giáo viên', accessor: (row) => getClassTeacher(row) },
    sessionsCompleted: { header: 'Buổi đã học', accessor: (row) => getCompletedSessions(row) },
    totalSessions: { header: 'Tổng buổi', accessor: (row) => row.numberOfSessions || 0 },
    studentsCompleted: { header: 'Học viên hoàn thành', accessor: 'clsPass' },
    effectiveBase: { header: 'Tổng học viên (hiệu lực)', accessor: 'effectiveBase' },
    totalBase: { header: 'Tổng học viên (gốc)', accessor: 'clsBase' },
    rate: { header: 'Tỷ lệ hoàn thành (%)', accessor: 'rate', formatter: CSVFormatters.number(1) },
    status: { header: 'Trạng thái', accessor: (row) => row.status || '—' },
    exempt: { header: 'Miễn trừ', accessor: 'clsExempt' },
  };
  
  // Add reason columns dynamically
  Object.keys(REASON_LABELS).forEach(reason => {
    columnMap[`reason_${reason}`] = {
      header: REASON_LABELS[reason] || reason,
      accessor: (row) => row.reasonsSummary[reason] || 0,
    };
  });
  
  return config
    .filter(col => col.enabled)
    .map(col => columnMap[col.id])
    .filter(Boolean);
}

// Fixed calculation logic
// Fixed calculation logic
// Fixed calculation edge cases
// Improved data validation

// Fixed edge cases
