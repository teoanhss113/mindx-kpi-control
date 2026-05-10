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
import { fetchAllClasses, haveSlotInToUtcRange } from '@/services/classesService';
import { fetchAllCentres, Centre } from '@/services/centresService';
import { getCache, setCache, clearCache } from '@/lib/idb';
import { getCourseCategory } from '@/lib/courseCategories';
import {
  KPI_COLORS, kpiColor,
  teacherChangeScore as lecChangeScore,
  multiTeacherScore,
  TEACHER_CHANGE_LEGEND,
} from '@/lib/kpiScoring';
import { getNavItemsWithRouter } from '@/lib/navigation';
import { useAllowedPages } from '@/hooks/useAllowedPages';
import { Class, Session, TeacherSlot } from '@/types/classes';
import {
  Icon, SortIcon, useToast, ToastContainer,
  MultiSelect, SelectOption,
  Toolbar, StatCard, ChartSectionHeader,
  TableToolbar, TableGroupHeader, AdminTableSection,
  Modal, ModalHeader, EmptyState,
  initials,
  StandardXAxis, StandardYAxisCategory, CustomTooltip, VerticalBarChartConfig,
  SortableColumn, SortableHeader,
  CentreSelect, QuickFilterChips, ExportButton, KPIThresholdSuggestions,
  CSVExportSettings, RoleBadge as SharedRoleBadge, TeacherAssignmentStatusBadge, FilterChip, type CSVColumnConfig,
} from '@/components/ui';
import { PageLayout } from '@/components/PageLayout';
import { useTableSort } from '@/hooks/useTableSort';
import { useFilterOptions } from '@/hooks/useFilterOptions';
import { useQuickFilterChips } from '@/hooks/useUserPreferences';
import { useCSVExportPreferences } from '@/hooks/useCSVExportPreferences';
import { CACHE_KEYS, LABELS, MESSAGES, ENTITIES, FORMAT, CLASS_INACTIVE_STATUSES } from '@/constants';
import { useSharedDateRange, useSharedCentres } from '@/hooks/useSharedFilterState';
import { exportToCSV, CSVColumn, CSVFormatters } from '@/lib/csvExport';
import { ProtectedPage } from '@/components/ProtectedPage';
import styles from '@/app/dashboard.module.css';

// ─── Constants ────────────────────────────────────────────────────────────────
// Linear Design System: Import chart colors from constants
import { CHART_COLORS as CHART_COLOR_CONSTANTS } from '@/constants';
const CHART_COLORS = CHART_COLOR_CONSTANTS.PALETTE;

// Role shortName constants
const ROLE_LEC    = 'LEC';
const ROLE_SUPPLY = 'SUPPLY';

/** Returns role.shortName normalised to UPPERCASE (handles both string & object from API).
 *  API may return mixed case e.g. "Supply" instead of "SUPPLY" — normalise for safe comparison. */
function getRoleShortName(t: TeacherSlot): string {
  const r = t.role as any;
  if (!r) return '';
  const raw = typeof r === 'string' ? r : (r.shortName ?? r.name ?? '');
  return raw.toUpperCase();
}

// ─── KPI scoring ─────────────────────────────────────────────────────────────
// Centralized in src/lib/kpiScoring.ts — imported above.

// ─── Types ────────────────────────────────────────────────────────────────────
interface SlotChangeDetail {
  slot: Session;
  /** true when slot's LEC ≠ primary LEC of the class */
  lecChanged: boolean;
  /** Actual LEC who taught this slot (null if no LEC assigned) */
  slotLEC: TeacherSlot | null;
  /** SUPPLY teacher for this slot (if any) */
  slotSUPPLY: TeacherSlot | null;
  /** The primary LEC (expected teacher) */
  primaryLEC: TeacherSlot | null;
}

interface ClassAnalyzed {
  cls: Class;
  totalSlots: number;
  /** Slots where LEC ≠ primary LEC */
  changedSlots: number;
  /** lecChanged rate as 0–100 */
  changeRate: number;
  slotDetails: SlotChangeDetail[];
  courseLineName: string;
  /** Unique LEC + SUPPLY teachers across class + all slots */
  uniqueTeacherCount: number;
  uniqueTeachers: Array<{ id: string; name: string; role: string }>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function pad2(n: number) { return String(n).padStart(2, '0'); }

function defaultMonthRange() {
  const now   = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last  = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    from: `${first.getFullYear()}-${pad2(first.getMonth()+1)}-${pad2(first.getDate())}`,
    to:   `${last.getFullYear()}-${pad2(last.getMonth()+1)}-${pad2(last.getDate())}`,
  };
}

/**
 * KPI 1 — LEC change rate per class:
 *   Primary LEC = LEC of first slot (fallback: cls.teachers LEC).
 *   Changed slot = slot whose LEC ≠ primary LEC.
 *   TA ignored, SUPPLY ignored in this KPI.
 *
 * KPI 2 — Unique teacher count (LEC + SUPPLY, no TA).
 *   Sources: cls.teachers + every slot.
 */
function analyzeTeacherChanges(cls: Class): Omit<ClassAnalyzed, 'cls' | 'courseLineName'> {
  const slots = (cls.slots ?? [])
    .filter(s => s.date)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());



  // Primary LEC: from first slot's LEC (most authoritative)
  let primaryLEC: TeacherSlot | null = null;
  for (const slot of slots) {
    const lec = (slot.teachers ?? []).find(t => getRoleShortName(t) === ROLE_LEC);
    if (lec) { primaryLEC = lec; break; }
  }
  if (!primaryLEC) {
    primaryLEC = (cls.teachers ?? []).find(t => getRoleShortName(t) === ROLE_LEC) ?? null;
  }

  const slotDetails: SlotChangeDetail[] = slots.map(slot => {
    const slotLEC    = (slot.teachers ?? []).find(t => getRoleShortName(t) === ROLE_LEC) ?? null;
    const slotSUPPLY = (slot.teachers ?? []).find(t => getRoleShortName(t) === ROLE_SUPPLY) ?? null;
    const lecChanged = !!(primaryLEC && slotLEC && slotLEC.teacher.id !== primaryLEC.teacher.id);
    return { slot, lecChanged, slotLEC, slotSUPPLY, primaryLEC };
  });

  const changedSlots = slotDetails.filter(d => d.lecChanged).length;
  const totalSlots   = slots.length;

  // KPI 2: gather all unique LEC + SUPPLY teachers
  const teacherMap = new Map<string, { id: string; name: string; role: string }>();
  (cls.teachers ?? []).forEach(t => {
    const role = getRoleShortName(t);
    if (role === ROLE_LEC || role === ROLE_SUPPLY)
      teacherMap.set(t.teacher.id, { id: t.teacher.id, name: t.teacher.fullName, role });
  });
  slots.forEach(slot => {
    (slot.teachers ?? []).forEach(t => {
      const role = getRoleShortName(t);
      if ((role === ROLE_LEC || role === ROLE_SUPPLY) && !teacherMap.has(t.teacher.id))
        teacherMap.set(t.teacher.id, { id: t.teacher.id, name: t.teacher.fullName, role });
    });
  });

  return {
    totalSlots,
    changedSlots,
    changeRate: totalSlots > 0 ? (changedSlots / totalSlots) * 100 : 0,
    slotDetails,
    uniqueTeacherCount: teacherMap.size,
    uniqueTeachers: Array.from(teacherMap.values()),
  };
}

// ─── Chart tooltip ────────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{
      background: 'var(--text-primary)', color: 'var(--bg-surface)', padding: '8px 12px',
      borderRadius: "var(--radius-comfortable)", fontSize: 12, lineHeight: 1.6, boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
    }}>
      <div style={{ fontWeight: 590, marginBottom: 'var(--space-1)' }}>{label}</div>
      {d.rate !== undefined && (
        <div>Tỷ lệ: <strong style={{ color: kpiColor(lecChangeScore(d.rate)) }}>{(d.rate).toFixed(1)}%</strong></div>
      )}
      {d.changed !== undefined && d.total !== undefined && (
        <div style={{ color: 'var(--text-quaternary)' }}>{d.changed}/{d.total} lớp thay GV chính (LEC)</div>
      )}
      {d.multiCount !== undefined && d.total !== undefined && (
        <div style={{ color: 'var(--text-quaternary)' }}>{d.multiCount}/{d.total} lớp có 3+ GV</div>
      )}
      {d.classes !== undefined && (
        <div style={{ color: 'var(--text-quaternary)' }}>{d.classes} lớp</div>
      )}
    </div>
  );
}

// ─── Teacher chip ─────────────────────────────────────────────────────────────
function TeacherChip({ name, role }: { name: string; role: string }) {
  const isSupply = role === ROLE_SUPPLY;
  const chipClass = isSupply ? styles.teacherChipSUPPLY : styles.teacherChipLEC;
  
  return (
    <span className={`${styles.reasonTag} ${chipClass}`} style={{
      fontSize: 12, padding: 'var(--space-1) var(--space-3)', borderRadius: "var(--radius-comfortable)", fontWeight: 510,
      display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)',
    }}>
      {name}
      <SharedRoleBadge role={role} shape="rounded" style={{ verticalAlign: 'middle' }} />
    </span>
  );
}

// ─── Mini KPI score dot ───────────────────────────────────────────────────────
function ScoreDot({ score }: { score: 1 | 2 | 3 | 4 | 5 }) {
  return (
    <span style={{
      display: 'inline-block', width: 'var(--space-2)', height: 'var(--space-2)', borderRadius: '50%',
      background: kpiColor(score), flexShrink: 0,
    }} title={`Mức độ: ${score}/5`} />
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function TeacherChangePage() {
  const { session, isLoading: authLoading, logout } = useAuth();
  const router = useRouter();
  const { hasPreferences } = useQuickFilterChips();

  const [classes,       setClasses]       = useState<Class[]>([]);
  const [loading,       setLoading]       = useState(false);
  const [progress,      setProgress]      = useState({ loaded: 0, total: 0 });
  const [centres,       setCentres]       = useState<Centre[]>([]);
  const [centresLoading, setCentresLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Shared filter state (synced across pages)
  const [dateFrom, dateTo, setDateFrom, setDateTo, datesLoaded] = useSharedDateRange();
  const [selectedCentres, setSelectedCentres, centresLoaded] = useSharedCentres();
  
  const [toolbarSelectedCourses, setToolbarSelectedCourses] = useState<string[]>([]); // NEW: Toolbar-level courses
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  const [search,              setSearch]              = useState('');
  const [rateRange,           setRateRange]           = useState<[number, number]>([0, 100]);
  const [selectedCourseLines, setSelectedCourseLines] = useState<string[]>([]);
  const [selectedStatuses,    setSelectedStatuses]    = useState<string[]>([]);
  const [selectedCentreIds,   setSelectedCentreIds]   = useState<string[]>([]);
  const [selectedLevels,      setSelectedLevels]      = useState<string[]>([]);
  const [selectedOperations,  setSelectedOperations]  = useState<string[]>([]);
  const [sortKey, setSortKey] = useState<'name' | 'total' | 'changed' | 'teachers' | 'status' | 'progress'>('changed');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [sortKeyInactive, setSortKeyInactive] = useState<'name' | 'centre' | 'status'>('name');
  const [sortDirInactive, setSortDirInactive] = useState<'asc' | 'desc'>('asc');
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [showCharts, setShowCharts] = useState(true);

  const [showActiveTable, setShowActiveTable] = useState(true);
  const [showInactiveTable, setShowInactiveTable] = useState(true);
  const [quickFilter, setQuickFilter] = useState<string | null>(null);

  // CSV Export Settings
  const [showCSVSettings, setShowCSVSettings] = useState(false);
  const { columns: csvColumns, saveColumns } = useCSVExportPreferences(
    'teacher-change',
    getDefaultCSVColumns()
  );

  const { toasts, addToast, removeToast } = useToast();



  const _session   = session ?? loadSession();
  const _name      = _session?.displayName?.trim() || '';
  const _email     = _session?.email || '';
  const userAvatar = _name ? initials(_name) : _email.charAt(0).toUpperCase();
  const userName   = _name || _email.split('@')[0];
  const userEmail  = _email;

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

  useEffect(() => {
    (async () => {
      try {
        const saved = await getCache(CACHE_KEYS.TEACHER_CHANGE);
        if (saved) {
          if (saved.classes) setClasses(saved.classes);
        }
      } catch (e) { console.error(e); }
    })();
  }, []);

  const handleFetch = async () => {
    if (!dateFrom || !dateTo) { addToast(MESSAGES.ERROR.DATE_RANGE_REQUIRED, 'error'); return; }
    const from = new Date(dateFrom), to = new Date(dateTo);
    if (from > to) { addToast(MESSAGES.ERROR.DATE_RANGE_INVALID, 'error'); return; }

    const controller = new AbortController();
    setAbortController(controller);
    setLoading(true);
    setProgress({ loaded: 0, total: 0 });
    setClasses([]);
    const tid = addToast(MESSAGES.LOADING.CONNECTING, 'loading');
    let accumulated: Class[] = [];
    try {
      const { from: hFrom, to: hTo } = haveSlotInToUtcRange(from, to);
      const centreIds = selectedCentres.length > 0 ? selectedCentres : centres.map(c => c.id);
      const result = await fetchAllClasses(
        { haveSlotIn: { from: hFrom, to: hTo }, centres: centreIds },
        (loaded, total, chunk) => {
          setProgress({ loaded, total });
          accumulated = [...accumulated, ...chunk];
          setClasses([...accumulated]);
        },
        controller.signal
      );
      await setCache(CACHE_KEYS.TEACHER_CHANGE, { classes: result, timestamp: Date.now() });
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
    await clearCache(CACHE_KEYS.TEACHER_CHANGE);
    setClasses([]);
    addToast(MESSAGES.CACHE.CLEARED, 'success');
  };

  useEffect(() => {
    if (classes.length > 0 && !loading)
      setCache(CACHE_KEYS.TEACHER_CHANGE, { classes, timestamp: Date.now() }).catch(console.error);
  }, [classes, loading]);

  // ── Analyze ───────────────────────────────────────────────────────────────
  const { activeClasses, inactiveClasses } = useMemo(() => {
    const active: ClassAnalyzed[] = [], inactive: ClassAnalyzed[] = [];
    classes.forEach(cls => {
      const analysis = analyzeTeacherChanges(cls);
      const courseLineName = getCourseCategory(cls);
      const entry: ClassAnalyzed = { cls, ...analysis, courseLineName };
      (CLASS_INACTIVE_STATUSES.has(cls.status?.toUpperCase?.()) ? inactive : active).push(entry);
    });
    return { activeClasses: active, inactiveClasses: inactive };
  }, [classes]);

  // ── Global KPI stats ──────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const totalClasses            = activeClasses.length;
    const classesWithLECChange    = activeClasses.filter(a => a.changedSlots > 0).length;
    const classesMultipleTeachers = activeClasses.filter(a => a.uniqueTeacherCount >= 3).length;
    // KPI 1: % of classes with LEC change
    const lecChangeRate           = totalClasses > 0 ? (classesWithLECChange / totalClasses) * 100 : 0;
    // KPI 2: % of classes with 3+ teachers
    const multiTeacherRate        = totalClasses > 0 ? (classesMultipleTeachers / totalClasses) * 100 : 0;
    const kpi1Score = lecChangeScore(lecChangeRate);
    const kpi2Score = multiTeacherScore(multiTeacherRate);
    return {
      totalClasses, classesWithLECChange, classesMultipleTeachers,
      lecChangeRate, multiTeacherRate, kpi1Score, kpi2Score,
    };
  }, [activeClasses]);

  const warningSuggestions = useMemo(() => {
    if (stats.totalClasses === 0) return [];
    const thresholds = [1, 3, 5, 7];
    const suggestions: { target: number; limit: number }[] = [];
    for (const t of thresholds) {
      if (stats.lecChangeRate <= t) {
        const maxAllowed = Math.floor((t * stats.totalClasses) / 100);
        const remaining = maxAllowed - stats.classesWithLECChange;
        if (remaining >= 0) {
          suggestions.push({ target: t, limit: remaining + 1 });
        }
      }
    }
    return suggestions.slice(0, 3);
  }, [stats]);

  // ── Chart data — dynamic domain ───────────────────────────────────────────
  const centreChartData = useMemo(() => {
    const map = new Map<string, { total: number; changed: number; multiCount: number }>();
    activeClasses.forEach(a => {
      const key = a.cls.centre?.shortName ?? a.cls.centre?.name ?? '?';
      const cur = map.get(key) ?? { total: 0, changed: 0, multiCount: 0 };
      cur.total++;
      if (a.changedSlots > 0) cur.changed++;
      if (a.uniqueTeacherCount >= 3) cur.multiCount++;
      map.set(key, cur);
    });
    return Array.from(map.entries())
      .map(([name, d]) => ({
        name,
        rate: d.total > 0 ? (d.changed / d.total) * 100 : 0,
        ...d,
      }))
      .sort((a, b) => b.rate - a.rate);
  }, [activeClasses]);

  const courseLineChartData = useMemo(() => {
    const map = new Map<string, { total: number; changed: number; multiCount: number }>();
    ['Coding', 'Robotics', 'Art', 'Others'].forEach(k => map.set(k, { total: 0, changed: 0, multiCount: 0 }));

    activeClasses.forEach(a => {
      const key = a.courseLineName || 'Others';
      const cur = map.get(key) ?? { total: 0, changed: 0, multiCount: 0 };
      cur.total++;
      if (a.changedSlots > 0) cur.changed++;
      if (a.uniqueTeacherCount >= 3) cur.multiCount++;
      map.set(key, cur);
    });
    return Array.from(map.entries())
      .map(([name, d]) => ({
        name,
        rate: d.total > 0 ? (d.changed / d.total) * 100 : 0,
        ...d,
      }))
      .sort((a, b) => b.rate - a.rate);
  }, [activeClasses]);

  // Dynamic X-axis domain: cap at max+padding, never 100
  const maxCentreRate    = Math.max(...centreChartData.map(d => d.rate), 0);
  const maxCourseRate    = Math.max(...courseLineChartData.map(d => d.rate), 0);
  const centreXDomain: [number, number]    = [0, Math.min(100, Math.ceil(maxCentreRate * 1.3 + 0.5) || 10)];
  const courseLineXDomain: [number, number] = [0, Math.min(100, Math.ceil(maxCourseRate * 1.3 + 0.5) || 10)];

  // ── Filters ───────────────────────────────────────────────────────────────

  const courseLineOptions = useFilterOptions(activeClasses, (a) => a.courseLineName);

  const statusOptions = useFilterOptions(activeClasses, (a) => a.cls.status);

  const tableCentreIds = useMemo(() => {
    const ids = new Set<string>();
    activeClasses.forEach(a => {
      if (a.cls.centre?.id) ids.add(a.cls.centre.id);
    });
    return Array.from(ids);
  }, [activeClasses]);

  const levelOptions = useFilterOptions(activeClasses, (a) => a.cls.level);

  const operationOptions: SelectOption[] = useMemo(() => {
    const seen = new Map<string, string>(); // id -> name
    activeClasses.forEach(a => {
      const op = a.cls.operationMethod;
      if (op?.id && op?.name) seen.set(op.id, op.name);
    });
    return Array.from(seen.entries()).map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [activeClasses]);

  const filteredClasses = useMemo(() => {
    let list = activeClasses;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(a => a.cls.name.toLowerCase().includes(q) || a.cls.centre?.name?.toLowerCase?.()?.includes(q));
    }
    if (selectedCourseLines.length > 0 && selectedCourseLines.length !== courseLineOptions.length) list = list.filter(a => selectedCourseLines.includes(a.courseLineName));
    if (selectedStatuses.length > 0 && selectedStatuses.length !== statusOptions.length) list = list.filter(a => selectedStatuses.includes(a.cls.status || ''));
    if (selectedCentreIds.length > 0 && selectedCentreIds.length !== tableCentreIds.length) list = list.filter(a => selectedCentreIds.includes(a.cls.centre?.id || ''));
    if (selectedLevels.length > 0 && selectedLevels.length !== levelOptions.length) list = list.filter(a => selectedLevels.includes(a.cls.level || ''));
    if (selectedOperations.length > 0 && selectedOperations.length !== operationOptions.length) list = list.filter(a => selectedOperations.includes(a.cls.operationMethod?.id || ''));
    if (rateRange[0] > 0 || rateRange[1] < 100) {
      // Range filter: on uniqueTeacherCount percentage (0-100 mapped to 0-N)
      list = list.filter(a => {
        const pct = a.uniqueTeacherCount >= 3 ? 100 : 0;
        return pct >= rateRange[0] && pct <= rateRange[1];
      });
    }
    if (quickFilter === 'changedLEC') list = list.filter(a => a.changedSlots > 0);
    if (quickFilter === 'multiTeachers') list = list.filter(a => a.uniqueTeacherCount >= 3);
    
    return [...list].sort((a, b) => {
      const d = sortDir === 'asc' ? 1 : -1;
      if (sortKey === 'name')     return d * a.cls.name.localeCompare(b.cls.name);
      if (sortKey === 'total')    return d * (a.totalSlots - b.totalSlots);
      if (sortKey === 'changed')  return d * (a.changedSlots - b.changedSlots);
      if (sortKey === 'teachers') return d * (a.uniqueTeacherCount - b.uniqueTeacherCount);
      if (sortKey === 'status')   return d * (a.cls.status || '').localeCompare(b.cls.status || '');
      if (sortKey === 'progress') {
        const aProgress = a.slotDetails.filter(d => new Date(d.slot.date) <= new Date()).length;
        const bProgress = b.slotDetails.filter(d => new Date(d.slot.date) <= new Date()).length;
        return d * (aProgress - bProgress);
      }
      return 0;
    });
  }, [activeClasses, search, selectedCourseLines, selectedStatuses, selectedCentreIds, selectedLevels, selectedOperations, rateRange, sortKey, sortDir]);

  const changedLECCount = useMemo(
    () => filteredClasses.filter(c => c.changedSlots > 0).length,
    [filteredClasses]
  );

  const multiTeacherCount = useMemo(
    () => filteredClasses.filter(c => c.uniqueTeacherCount >= 3).length,
    [filteredClasses]
  );

  // CSV Export handler
  const handleExportCSV = useCallback(() => {
    if (filteredClasses.length === 0) {
      addToast('Không có dữ liệu để xuất', 'info');
      return;
    }
    
    try {
      const columns = getCSVColumnsFromConfig(csvColumns);
      
      if (columns.length === 0) {
        addToast('Vui lòng chọn ít nhất một cột để xuất', 'info');
        return;
      }
      
      exportToCSV(filteredClasses, columns, 'ty-le-thay-doi-giao-vien');
      addToast(`Đã xuất ${filteredClasses.length} lớp với ${columns.length} cột`, 'success');
    } catch (error) {
      console.error('Export error:', error);
      addToast('Có lỗi xảy ra khi xuất file', 'error');
    }
  }, [filteredClasses, csvColumns, addToast]);

  const handleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const handleSortInactive = (key: typeof sortKeyInactive) => {
    if (sortKeyInactive === key) setSortDirInactive(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKeyInactive(key); setSortDirInactive('asc'); }
  };

  const hasTableFilter = !!(search || selectedCourseLines.length || selectedStatuses.length || selectedCentreIds.length || selectedLevels.length || selectedOperations.length || rateRange[0] > 0 || rateRange[1] < 100 || quickFilter);
  const clearTableFilters = () => { setSearch(''); setSelectedCourseLines([]); setSelectedStatuses([]); setSelectedCentreIds([]); setSelectedLevels([]); setSelectedOperations([]); setRateRange([0, 100]); setQuickFilter(null); };

  const sortedInactiveClasses = useMemo(() => {
    return [...inactiveClasses].sort((a, b) => {
      const d = sortDirInactive === 'asc' ? 1 : -1;
      if (sortKeyInactive === 'name') return d * a.cls.name.localeCompare(b.cls.name, 'vi-VN');
      if (sortKeyInactive === 'centre') return d * (a.cls.centre?.name || '').localeCompare(b.cls.centre?.name || '', 'vi-VN');
      if (sortKeyInactive === 'status') return d * (a.cls.status || '').localeCompare(b.cls.status || '', 'vi-VN');
      return 0;
    });
  }, [inactiveClasses, sortKeyInactive, sortDirInactive]);

  const selectedEntry = useMemo(() =>
    selectedClassId
      ? (activeClasses.find(a => a.cls.id === selectedClassId) ?? inactiveClasses.find(a => a.cls.id === selectedClassId) ?? null)
      : null,
    [selectedClassId, activeClasses, inactiveClasses]);

  // Prepare sortable slot data for modal
  const modalSlotData = useMemo(() => {
    if (!selectedEntry) return [];
    
    return selectedEntry.slotDetails.map((d, i) => {
      const primaryName = d.primaryLEC?.teacher.fullName ?? '—';
      const slotLECName = d.slotLEC?.teacher.fullName;
      const slotSupplyName = d.slotSUPPLY?.teacher.fullName;
      const actualTeacher = slotLECName ?? slotSupplyName ?? '(không xác định)';
      const slotDate = d.slot.date ? new Date(d.slot.date) : null;
      const statusOrder = !d.slotLEC && !d.slotSUPPLY ? 3 : d.lecChanged ? 2 : !d.slotLEC && !!d.slotSUPPLY ? 1 : 0;
      
      return {
        ...d,
        slotNumber: i + 1,
        date: slotDate,
        primaryTeacher: primaryName,
        actualTeacher,
        statusOrder
      };
    });
  }, [selectedEntry]);

  type ModalSlotSortKey = 'slotNumber' | 'date' | 'primaryTeacher' | 'actualTeacher' | 'statusOrder';
  
  const { 
    sortedData: sortedModalSlots, 
    sortBy: modalSlotSortBy, 
    sortOrder: modalSlotSortOrder, 
    handleSort: handleModalSlotSort 
  } = useTableSort<typeof modalSlotData[0], ModalSlotSortKey>({
    data: modalSlotData,
    defaultSortKey: 'slotNumber' as ModalSlotSortKey,
    defaultSortOrder: 'asc'
  });

  const BAR_H        = 28;
  const centreH      = Math.max(180, centreChartData.length * BAR_H);
  const courseH      = Math.max(180, courseLineChartData.length * BAR_H);
  const sharedChartH = Math.max(centreH, courseH);
  const cardHeight   = sharedChartH + 56 + 32;

  // Allowed pages (for navigation filtering)
  const { allowedPages } = useAllowedPages();

  // Navigation items
  const navItems = getNavItemsWithRouter('teacher-change', router, allowedPages);

  const skeletonRows = Array.from({ length: 8 }).map((_, i) => (
    <div key={i} className={styles.skeletonRow}
      style={{ gridTemplateColumns: 'minmax(0,2.5fr) minmax(0,0.6fr) minmax(0,0.9fr) minmax(0,2fr)' }}>
      {Array.from({ length: 4 }).map((_, j) => (
        <div key={j} className={styles.skeletonBlock} style={{ width: `${[70, 40, 50, 80][j]}%` }} />
      ))}
    </div>
  ));

  if (authLoading) return null;

  return (
    <ProtectedPage pageKey="teacher-change">
      <>
        <ToastContainer toasts={toasts} onRemove={removeToast} />
      <PageLayout
        title="Thay đổi Giáo viên"
        activePage="teacher-change"
        sidebarOpen={sidebarOpen}
        onSidebarToggle={setSidebarOpen}
      >
        {/* ── Toolbar ───────────────────────────────────────────────────── */}
        <Toolbar
          centres={centres} selectedCentres={selectedCentres}
          onCentresChange={setSelectedCentres} centresLoading={centresLoading}
          dateFrom={dateFrom} dateTo={dateTo}
          onDateFromChange={setDateFrom} onDateToChange={setDateTo}
          onFetch={handleFetch} loading={loading} progress={progress}
          hasData={classes.length > 0} onClearCache={handleClearCache}
          onCancel={handleCancelFetch}
          showRegionQuickSelect={true}
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

          {/* ── Stats cards (main KPIs first, then context) ───────────────── */}
          {classes.length > 0 && (
            <motion.div className={styles.statsGrid}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>

              {/* KPI 1 — MAIN: % of classes with LEC change */}
              <StatCard
                label="TỶ LỆ THAY GV CHÍNH (LEC)"
                value={stats.totalClasses > 0 ? `${stats.lecChangeRate.toFixed(1)}%` : '—'}
                desc={`${stats.classesWithLECChange}/${stats.totalClasses} lớp thay GV chính`}
                valueColor={kpiColor(stats.kpi1Score)}
                delay={0}
              />

              {/* KPI 2 — MAIN: % of classes with 3+ teachers */}
              <StatCard
                label="TỶ LỆ LỚP CÓ 3+ GV"
                value={stats.totalClasses > 0 ? `${stats.multiTeacherRate.toFixed(1)}%` : '—'}
                desc={`${stats.classesMultipleTeachers}/${stats.totalClasses} lớp (LEC + SUPPLY)`}
                valueColor={kpiColor(stats.kpi2Score)}
                delay={0.07}
              />

              {/* Context: total classes */}
              <StatCard
                label="TỔNG SỐ LỚP"
                value={String(stats.totalClasses)}
                desc="lớp có buổi học trong kỳ"
                delay={0.14}
              />

              {/* Context: classes with LEC change count */}
              <StatCard
                label="SỐ LỚP THAY GV CH­ÍNH"
                value={String(stats.classesWithLECChange)}
                desc={`${stats.classesMultipleTeachers} lớp có 3+ GV (LEC+SUPPLY)`}
                valueColor={stats.classesWithLECChange > 0 ? kpiColor(stats.kpi1Score) : 'var(--status-success)'}
                delay={0.21}
              />
            </motion.div>
          )}

          {/* SUGGESTIONS / WARNINGS */}
          {classes.length > 0 && stats.totalClasses > 0 && warningSuggestions.length > 0 && (
            <KPIThresholdSuggestions
              label="Cảnh báo:"
              variant="warning"
              targetPosition="end"
              className={styles.kpiSuggestionSpacing}
              items={warningSuggestions.map(({ target, limit }) => ({
                key: String(target),
                target: `để giữ mốc ≤ ${target}%`,
                content: <>chỉ được thay tối đa <strong>{limit - 1}</strong> lớp nữa</>,
              }))}
            />
          )}

          {/* ── Charts ────────────────────────────────────────────────────── */}
          {classes.length > 0 && (centreChartData.length > 0 || courseLineChartData.length > 0) && (
            <div className={styles.chartsSection} style={{ marginBottom: 'var(--space-4)' }}>
              <ChartSectionHeader
                title="Biểu Đồ So Sánh"
                visible={showCharts}
                onToggle={() => setShowCharts(p => !p)}
              />
              <AnimatePresence>
                {showCharts && (
                  <motion.div className={styles.chartsGrid}
                    initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25 }}>

                    {centreChartData.length > 0 && (
                      <div className={styles.chartCard} style={{ height: cardHeight, display: 'flex', flexDirection: 'column' }}>
                        <div className={styles.chartTitle}>Theo Cơ Sở — % Lớp Thay GV</div>
                        <div style={{ flex: 1, minHeight: 0 }}>
                          <ResponsiveContainer width="100%" height={sharedChartH}>
                            <BarChart data={centreChartData} {...VerticalBarChartConfig}>
                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" horizontal={false} />
                              <StandardXAxis label="Tỷ lệ (%)" domain={centreXDomain} tickFormatter={v => `${v}%`} />
                              <StandardYAxisCategory dataKey="name" label="Cơ sở" />
                              <ReTooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
                              <Bar dataKey="rate" radius={[0, 4, 4, 0]} maxBarSize={16}
                                label={{ position: 'right', fontSize: 10, fill: 'var(--text-quaternary)', formatter: (v: any) => (typeof v === 'number' && v > 0) ? `${v.toFixed(1)}%` : '' }}>
                                {centreChartData.map((d, i) =>
                                  <Cell key={i} fill={kpiColor(lecChangeScore(d.rate))} fillOpacity={0.85} />)}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                        <div className={styles.chartLegend}>
                          {TEACHER_CHANGE_LEGEND.map(l => (
                            <div key={l.score} className={styles.legendItem}>
                              <span className={styles.legendSwatch} style={{ background: KPI_COLORS[l.score] }} />
                              {l.label}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {courseLineChartData.length > 0 && (
                      <div className={styles.chartCard} style={{ height: cardHeight, display: 'flex', flexDirection: 'column' }}>
                        <div className={styles.chartTitle}>Theo Khối — % Lớp Thay GV</div>
                        <div style={{ flex: 1, minHeight: 0 }}>
                          <ResponsiveContainer width="100%" height={sharedChartH}>
                            <BarChart data={courseLineChartData} {...VerticalBarChartConfig}>
                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" horizontal={false} />
                              <StandardXAxis label="Tỷ lệ (%)" domain={courseLineXDomain} tickFormatter={v => `${v}%`} />
                              <StandardYAxisCategory dataKey="name" label="Khối học" />
                              <ReTooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
                              <Bar dataKey="rate" radius={[0, 4, 4, 0]} maxBarSize={16}
                                label={{ position: 'right', fontSize: 10, fill: 'var(--text-quaternary)', formatter: (v: any) => (typeof v === 'number' && v > 0) ? `${v.toFixed(1)}%` : '' }}>
                                {courseLineChartData.map((d, i) =>
                                  <Cell key={i} fill={kpiColor(lecChangeScore(d.rate))} fillOpacity={0.85} />)}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                        <div className={styles.chartLegend}>
                          {TEACHER_CHANGE_LEGEND.map(l => (
                            <div key={l.score} className={styles.legendItem}>
                              <span className={styles.legendSwatch} style={{ background: KPI_COLORS[l.score] }} />
                              {l.label}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* ── Table — active classes ─────────────────────────────────────── */}
          {(loading || classes.length > 0) && (
            <AdminTableSection
              title="Danh sách lớp học"
              count={filteredClasses.length}
              loading={loading}
              progress={progress}
              isExpanded={showActiveTable}
              onToggle={() => setShowActiveTable(p => !p)}
              actionSlot={
                <ExportButton
                  onClick={handleExportCSV}
                  onSettingsClick={() => setShowCSVSettings(true)}
                  disabled={filteredClasses.length === 0}
                  count={filteredClasses.length}
                />
              }
              toolbarSlot={
                <TableToolbar
                  search={search} onSearchChange={setSearch}
                  searchPlaceholder="Tìm lớp học, cơ sở, khoá học..."
                  quickFilterSlots={
                    <>
                      {hasPreferences && (
                        <QuickFilterChips
                          centres={centres}
                          selectedCentres={selectedCentreIds}
                          onCentresChange={setSelectedCentreIds}
                          selectedCourses={selectedCourseLines}
                          onCoursesChange={setSelectedCourseLines}
                          showCentres={true}
                          showCourses={true}
                        />
                      )}
                      <FilterChip
                        active={quickFilter === 'changedLEC'}
                        count={changedLECCount}
                        countDisplay="always"
                        onClick={() => setQuickFilter(q => q === 'changedLEC' ? null : 'changedLEC')}
                      >
                        Có thay Giáo viên
                      </FilterChip>
                      <FilterChip
                        active={quickFilter === 'multiTeachers'}
                        count={multiTeacherCount}
                        countDisplay="always"
                        onClick={() => setQuickFilter(q => q === 'multiTeachers' ? null : 'multiTeachers')}
                      >
                        Nhiều Giáo viên (3+)
                      </FilterChip>
                    </>
                  }
                  filterSlots={
                    <>
                      {tableCentreIds.length > 1 && <CentreSelect menuPosition="fixed" centres={centres} selected={selectedCentreIds} onChange={setSelectedCentreIds} filterToIds={tableCentreIds} placeholder="Tất cả cơ sở" maxDisplay={1} searchable />}
                      <MultiSelect menuPosition="fixed" options={courseLineOptions} selected={selectedCourseLines}
                        onChange={setSelectedCourseLines} placeholder="Tất cả khối" maxDisplay={2} />
                      {statusOptions.length > 1 && <MultiSelect menuPosition="fixed" options={statusOptions} selected={selectedStatuses}
                        onChange={setSelectedStatuses} placeholder="Tất cả trạng thái" />}
                      {levelOptions.length > 1 && <MultiSelect menuPosition="fixed" options={levelOptions} selected={selectedLevels}
                        onChange={setSelectedLevels} placeholder="Tất cả cấp độ" />}
                      {operationOptions.length > 1 && <MultiSelect menuPosition="fixed" options={operationOptions} selected={selectedOperations}
                        onChange={setSelectedOperations} placeholder="Tất cả hình thức" />}
                    </>
                  }
                  rangeValue={rateRange} onRangeChange={setRateRange} rangeLabel="Số GV"
                  hasFilter={hasTableFilter} onClearFilter={clearTableFilters}
                />
              }
            >
                    <div className={styles.tableScrollWrapper}>
                      {/* Column headers: Name | Status | Tiến độ | Số GV | Danh sách GV (LEC+SUPPLY) */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'minmax(0,2.5fr) minmax(0,0.8fr) minmax(0,0.7fr) minmax(0,1.1fr) minmax(0,2.5fr)',
                        padding: '7px 16px', minWidth: 720,
                        borderBottom: '1px solid var(--border-primary)',
                        fontSize: 11, fontWeight: 590, color: 'var(--text-quaternary)',
                        letterSpacing: '0.04em', textTransform: 'uppercase',
                        background: 'var(--bg-elevated)',
                      }}>
                        {(['name', 'status', 'progress', 'teachers'] as const).map((col, i) => {
                          const isSortable = true; // All columns are now sortable
                          return (
                            <div key={col}
                              className={isSortable ? `${styles.sortableCol} ${sortKey === col ? styles.activeSort : ''}` : ''}
                              style={isSortable ? { display: 'flex', alignItems: 'center', gap: 'var(--space-1)', userSelect: 'none' } : { display: 'flex', alignItems: 'center', userSelect: 'none' }}
                              onClick={() => isSortable && handleSort(col)}>
                              {['Lớp học', 'Trạng thái', 'Tiến độ', 'Số GV (LEC+SUP)'][i]}
                              {isSortable && <SortIcon col={col} sortKey={sortKey} sortDir={sortDir} />}
                            </div>
                          );
                        })}
                        <div style={{ display: 'flex', alignItems: 'center', userSelect: 'none' }}>
                          Danh sách GV &nbsp;
                          <span style={{ fontSize: 10, opacity: 0.6, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
                            (LEC — xanh · SUPPLY — cam)
                          </span>
                        </div>
                      </div>

                      {loading && classes.length === 0 && skeletonRows}

                <AnimatePresence initial={false}>
                  {filteredClasses.map((a, idx) => {
                    const hasLECChange  = a.changedSlots > 0;
                    const hasMulti      = a.uniqueTeacherCount >= 3;
                    const rowKpi1Score  = hasLECChange ? lecChangeScore(a.changeRate) : 5;
                    const sortedTeachers = [
                      ...a.uniqueTeachers.filter(t => t.role === ROLE_LEC),
                      ...a.uniqueTeachers.filter(t => t.role === ROLE_SUPPLY),
                    ];
                    return (
                      <motion.div key={a.cls.id}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'minmax(0,2.5fr) minmax(0,0.8fr) minmax(0,0.7fr) minmax(0,1.1fr) minmax(0,2.5fr)',
                          padding: '10px 16px', minWidth: 720,
                          borderBottom: '1px solid var(--border-primary)',
                          alignItems: 'start', cursor: 'pointer',
                          background: 'var(--bg-surface)',
                          transition: 'background 0.1s ease',
                        }}
                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.18, delay: Math.min(idx * 0.012, 0.3) }}
                        onClick={() => setSelectedClassId(a.cls.id)}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-surface)'}>

                        {/* Class name */}
                        <div className={styles.className}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                            {(hasLECChange || hasMulti) && (
                              <ScoreDot score={Math.min(rowKpi1Score, hasMulti ? multiTeacherScore(100) : 5) as any} />
                            )}
                            {a.cls.name}
                          </span>
                          <span className={styles.centreName}>
                            {a.courseLineName ? `${a.courseLineName} — ` : ''}{a.cls.centre?.name}
                          </span>
                        </div>

                        {/* Status replacing Total slots */}
                        <div style={{ fontSize: 11, fontWeight: 510, color: 'var(--text-secondary)', paddingTop: 2 }}>
                          {a.cls.status || '—'}
                        </div>

                        {/* Progress: show completed/total slots */}
                        <div style={{ fontSize: 11, fontWeight: 510, color: 'var(--text-secondary)', paddingTop: 2 }}>
                          {FORMAT.progress(
                            a.slotDetails.filter(d => new Date(d.slot.date) <= new Date()).length,
                            a.totalSlots
                          )}
                        </div>

                        {/* Unique teacher count */}
                        <div style={{ paddingTop: 'var(--space-1)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                          <span style={{
                            fontSize: 15, fontWeight: 590, letterSpacing: '-0.3px',
                            color: hasMulti ? kpiColor(multiTeacherScore(100)) : 'var(--text-quaternary)',
                          }}>
                            {a.uniqueTeacherCount}
                          </span>
                          {hasMulti && (
                            <span className={`${styles.reasonTag} ${styles.multiTeacherChip}`} style={{
                              fontSize: 10, fontWeight: 590, padding: '1px 5px', borderRadius: "var(--radius-standard)",
                            }}>3+</span>
                          )}
                          {hasLECChange && (
                            <span className={`${styles.reasonTag} ${styles.changeChip}`} style={{
                              fontSize: 10, fontWeight: 590, padding: '1px 5px', borderRadius: "var(--radius-standard)",
                            }}>Thay LEC</span>
                          )}
                        </div>

                        {/* Teacher list (LEC blue, SUPPLY amber) */}
                        <div className={styles.reasonsPreview} style={{ paddingTop: 2 }}>
                          {sortedTeachers.length === 0
                            ? <span style={{ color: 'var(--text-quaternary)' }}>—</span>
                            : sortedTeachers.map(t => (
                                <TeacherChip key={t.id} name={t.name} role={t.role} />
                              ))
                          }
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>

                      {!loading && filteredClasses.length === 0 && classes.length > 0 && (
                        <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--text-quaternary)', fontSize: 13 }}>
                          Không có lớp nào khớp với bộ lọc hiện tại.
                        </div>
                      )}
                    </div>
            </AdminTableSection>
          )}

          {/* ── Inactive table ──────────────────────────────────────────────── */}
          {inactiveClasses.length > 0 && (
            <div className={styles.tableSection} style={{ opacity: 0.5, marginTop: 'var(--space-4)' }}>
              <TableGroupHeader
                title="Lớp đã Huỷ / Từ chối"
                count={inactiveClasses.length}
                note="Không tính vào tỷ lệ"
                isExpanded={showInactiveTable}
                onToggle={() => setShowInactiveTable(p => !p)}
              />
              <AnimatePresence initial={false}>
                {showInactiveTable && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                    <div className={styles.tableScrollWrapper} style={{ minWidth: 0 }}>
                      {/* Column headers */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'minmax(0,2.5fr) minmax(0,1.2fr) minmax(0,1.2fr)',
                        padding: '7px 16px', minWidth: 520,
                        borderBottom: '1px solid var(--border-primary)',
                        fontSize: 11, fontWeight: 590, color: 'var(--text-quaternary)',
                        letterSpacing: '0.04em', textTransform: 'uppercase',
                        background: 'var(--bg-elevated)',
                      }}>
                        <SortableColumn
                          label="Lớp học"
                          sortKey="name"
                          currentSortKey={sortKeyInactive}
                          sortOrder={sortDirInactive}
                          onSort={(key) => handleSortInactive(key as typeof sortKeyInactive)}
                        />
                        <SortableColumn
                          label="Cơ sở"
                          sortKey="centre"
                          currentSortKey={sortKeyInactive}
                          sortOrder={sortDirInactive}
                          onSort={(key) => handleSortInactive(key as typeof sortKeyInactive)}
                        />
                        <SortableColumn
                          label="Trạng thái"
                          sortKey="status"
                          currentSortKey={sortKeyInactive}
                          sortOrder={sortDirInactive}
                          onSort={(key) => handleSortInactive(key as typeof sortKeyInactive)}
                        />
                      </div>

                      {sortedInactiveClasses.map(a => (
                        <div key={a.cls.id} className={styles.classItem}
                          style={{ gridTemplateColumns: 'minmax(0,2.5fr) minmax(0,1.2fr) minmax(0,1.2fr)', minWidth: 520, cursor: 'pointer', padding: '8px 16px' }}
                          onClick={() => setSelectedClassId(a.cls.id)}>
                          <div className={styles.className}>{a.cls.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-quaternary)' }}>{a.cls.centre?.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-quaternary)' }}>{a.cls.status}</div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* ── Empty state ──────────────────────────────────────────────────── */}
          {!loading && classes.length === 0 && (
            <EmptyState
              icon={<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>}
              title="Chưa có dữ liệu"
              subtitle={'Chọn khoảng thời gian và nhấn "Tải dữ liệu"'}
            />
          )}

      {/* ── Modal ──────────────────────────────────────────────────────────────── */}
      <Modal open={!!selectedEntry} onClose={() => setSelectedClassId(null)}>
        {selectedEntry && (() => {
          const hasLECChange = selectedEntry.changedSlots > 0;
          const hasMulti     = selectedEntry.uniqueTeacherCount >= 3;
          return (
            <>
              <ModalHeader
                title={selectedEntry.cls.name}
                subtitle={`${selectedEntry.cls.course?.name ? selectedEntry.cls.course.name + ' — ' : ''}${selectedEntry.cls.centre?.name} · ${selectedEntry.cls.status}`}
                onClose={() => setSelectedClassId(null)}
              />

              {/* ── KPI summary cards — with proper inner padding so borders don't touch */}
              <div style={{ padding: 'var(--space-4) var(--space-5) 0', display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                {/* KPI 1 */}
                <div style={{
                  flex: 1, minWidth: 140, padding: '12px 16px',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-primary)',
                  borderRadius: "var(--radius-card)",
                }}>
                  <div style={{ fontSize: 11, fontWeight: 590, color: 'var(--text-quaternary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
                    Thay GV chính (LEC)
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 590, letterSpacing: '-0.5px', color: hasLECChange ? kpiColor(lecChangeScore(selectedEntry.changeRate)) : 'var(--status-success)' }}>
                    {selectedEntry.changedSlots}
                    <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--text-tertiary)', marginLeft: 4 }}>
                      / {selectedEntry.totalSlots} buổi
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-quaternary)', marginTop: 4 }}>
                    {selectedEntry.totalSlots > 0
                      ? `${selectedEntry.changeRate.toFixed(1)}% buổi thay GV chính`
                      : 'Không có buổi học'}
                  </div>
                </div>

                {/* KPI 2 */}
                <div style={{
                  flex: 1, minWidth: 140, padding: '12px 16px',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-primary)',
                  borderRadius: "var(--radius-card)",
                }}>
                  <div style={{ fontSize: 11, fontWeight: 590, color: 'var(--text-quaternary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
                    Số GV (LEC + SUPPLY)
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 590, letterSpacing: '-0.5px', color: hasMulti ? kpiColor(multiTeacherScore(100)) : 'var(--text-primary)' }}>
                    {selectedEntry.uniqueTeacherCount}
                    {hasMulti && <span style={{ fontSize: 12, marginLeft: 6, color: 'var(--status-warning)', fontWeight: 590 }}>3+</span>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-quaternary)', marginTop: 4 }}>
                    {hasMulti ? 'Lớp có nhiều giáo viên' : 'Giáo viên ổn định'}
                  </div>
                </div>
              </div>

              {/* ── Teacher legend */}
              {selectedEntry.uniqueTeachers.length > 0 && (
                <div style={{ padding: 'var(--space-3) var(--space-5) 0', display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                  {[
                    ...selectedEntry.uniqueTeachers.filter(t => t.role === ROLE_LEC),
                    ...selectedEntry.uniqueTeachers.filter(t => t.role === ROLE_SUPPLY),
                  ].map(t => <TeacherChip key={t.id} name={t.name} role={t.role} />)}
                </div>
              )}

              {/* ── Per-slot table */}
              <div className={styles.modalBody} style={{ padding: '12px 20px 20px' }}>
                <div className={styles.tableScrollWrapper}>
                  <table className={styles.studentTable}>
                  <thead>
                    <tr>
                      <SortableHeader label="#" sortKey="slotNumber" currentSortKey={modalSlotSortBy} sortOrder={modalSlotSortOrder} onSort={(key) => handleModalSlotSort(key as ModalSlotSortKey)} />
                      <SortableHeader label="Ngày" sortKey="date" currentSortKey={modalSlotSortBy} sortOrder={modalSlotSortOrder} onSort={(key) => handleModalSlotSort(key as ModalSlotSortKey)} />
                      <SortableHeader label="GV chính (LEC gốc)" sortKey="primaryTeacher" currentSortKey={modalSlotSortBy} sortOrder={modalSlotSortOrder} onSort={(key) => handleModalSlotSort(key as ModalSlotSortKey)} />
                      <SortableHeader label="GV buổi này" sortKey="actualTeacher" currentSortKey={modalSlotSortBy} sortOrder={modalSlotSortOrder} onSort={(key) => handleModalSlotSort(key as ModalSlotSortKey)} />
                      <SortableHeader label="Trạng thái" sortKey="statusOrder" currentSortKey={modalSlotSortBy} sortOrder={modalSlotSortOrder} onSort={(key) => handleModalSlotSort(key as ModalSlotSortKey)} />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedModalSlots.map((d) => {
                      const primaryName = d.primaryTeacher;
                      const slotLECName   = d.slotLEC?.teacher.fullName;
                      const slotSupplyName = d.slotSUPPLY?.teacher.fullName;
                      const displayName = slotLECName ?? slotSupplyName ?? '(không xác định)';
                      const displayRole = slotLECName ? ROLE_LEC : slotSupplyName ? ROLE_SUPPLY : null;
                      const noTeacher = !d.slotLEC && !d.slotSUPPLY;
                      const isLECChange = d.lecChanged;
                      const isSubstitute = !d.slotLEC && !!d.slotSUPPLY;

                      return (
                        <tr key={d.slot._id}>
                          <td style={{ color: 'var(--text-tertiary)', fontWeight: 510 }}>{d.slotNumber}</td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            {d.date ? d.date.toLocaleDateString('vi-VN') : '—'}
                          </td>
                          <td style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{primaryName}</td>
                          <td>
                            <span style={{
                              fontSize: 13,
                              fontWeight: (isLECChange || isSubstitute) ? 590 : 400,
                              color: isLECChange ? 'var(--status-error)'
                                : isSubstitute ? 'var(--status-warning)'
                                : noTeacher ? 'var(--text-quaternary)'
                                : 'var(--text-primary)',
                            }}>
                              {displayName}
                            </span>
                            {displayRole && <SharedRoleBadge role={displayRole} shape="rounded" style={{ marginLeft: 'var(--space-1)' }} />}
                          </td>
                          <td>
                            <TeacherAssignmentStatusBadge
                              status={noTeacher ? 'unknown' : isLECChange ? 'main_changed' : isSubstitute ? 'supply' : 'on_schedule'}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>
              </div>
            </>
          );
        })()}
      </Modal>
      </PageLayout>

      {/* CSV Export Settings Modal */}
      <CSVExportSettings
        isOpen={showCSVSettings}
        onClose={() => setShowCSVSettings(false)}
        columns={csvColumns}
        onSave={saveColumns}
        title="Cài đặt xuất CSV - Tỷ lệ thay đổi Giáo viên"
      />
    </>
    </ProtectedPage>
  );
}

// ─── CSV Export Configuration ─────────────────────────────────────────────────
function getDefaultCSVColumns(): CSVColumnConfig[] {
  return [
    { id: 'code', label: 'Mã lớp', enabled: true },
    { id: 'courseLine', label: 'Khối học', enabled: true },
    { id: 'centre', label: 'Cơ sở', enabled: true },
    { id: 'centreCode', label: 'Mã cơ sở', enabled: true },
    { id: 'status', label: 'Trạng thái', enabled: true },
    { id: 'sessionsCompleted', label: 'Buổi đã học', enabled: true },
    { id: 'totalSessions', label: 'Tổng buổi', enabled: true },
    { id: 'changedSlots', label: 'Buổi thay GV', enabled: true },
    { id: 'changeRate', label: 'Tỷ lệ thay GV (%)', enabled: true },
    { id: 'teacherCount', label: 'Số GV', enabled: true },
    { id: 'lecTeachers', label: 'GV chính (LEC)', enabled: true },
    { id: 'supplyTeachers', label: 'GV thay thế (SUPPLY)', enabled: true },
    { id: 'allTeachers', label: 'Tất cả GV', enabled: true },
  ];
}

function getCSVColumnsFromConfig(config: CSVColumnConfig[]): CSVColumn<ClassAnalyzed>[] {
  const columnMap: Record<string, CSVColumn<ClassAnalyzed>> = {
    code: { header: 'Mã lớp', accessor: (row) => row.cls.name },
    courseLine: { header: 'Khối học', accessor: 'courseLineName' },
    centre: { header: 'Cơ sở', accessor: (row) => row.cls.centre?.name || '—' },
    centreCode: { header: 'Mã cơ sở', accessor: (row) => row.cls.centre?.shortName || '—' },
    status: { header: 'Trạng thái', accessor: (row) => row.cls.status || '—' },
    sessionsCompleted: { header: 'Buổi đã học', accessor: (row) => row.slotDetails.filter(d => new Date(d.slot.date) <= new Date()).length },
    totalSessions: { header: 'Tổng buổi', accessor: 'totalSlots' },
    changedSlots: { header: 'Buổi thay GV', accessor: 'changedSlots' },
    changeRate: { header: 'Tỷ lệ thay GV (%)', accessor: 'changeRate', formatter: CSVFormatters.number(1) },
    teacherCount: { header: 'Số GV', accessor: 'uniqueTeacherCount' },
    lecTeachers: { 
      header: 'GV chính (LEC)', 
      accessor: (row) => row.uniqueTeachers
        .filter(t => t.role === ROLE_LEC)
        .map(t => t.name)
        .join(', ') || '—'
    },
    supplyTeachers: { 
      header: 'GV thay thế (SUPPLY)', 
      accessor: (row) => row.uniqueTeachers
        .filter(t => t.role === ROLE_SUPPLY)
        .map(t => t.name)
        .join(', ') || '—'
    },
    allTeachers: { 
      header: 'Tất cả GV', 
      accessor: (row) => row.uniqueTeachers
        .map(t => `${t.name} (${t.role})`)
        .join(', ')
    },
  };
  
  return config
    .filter(col => col.enabled)
    .map(col => columnMap[col.id])
    .filter(Boolean);
}
