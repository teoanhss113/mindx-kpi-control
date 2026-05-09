'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
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
import { getNavItemsWithRouter } from '@/lib/navigation';
import { useAllowedPages } from '@/hooks/useAllowedPages';
import { Class } from '@/types/classes';
import { AnalyzedClassForQuality } from '@/types/classQuality';
import { analyzeClassQuality } from '@/lib/classQualityAnalysis';
import { computeTBCK, determineRank, getRankColor } from '@/lib/courseGrading';
import { PageLayout } from '@/components/PageLayout';
import {
  SortIcon, useToast, ToastContainer,
  MultiSelect, SelectOption,
  Toolbar, StatCard, ChartSectionHeader,
  TableToolbar, TableGroupHeader,
  Modal, ModalHeader, EmptyState,
  initials,
  StandardXAxis, StandardYAxisCategory, ChartLegend, VerticalBarChartConfig, CustomTooltip,
  CentreSelect, QuickFilterChips, ExportButton,
  CSVExportSettings, type CSVColumnConfig,
  Icon,
  ATTENDANCE_ALERT_LABELS, AttendanceAlertBadge, Badge, AttendanceSessionCell, AttendanceStatusBadge, CommentStatusBadge,
  COMMENT_STATUS_COUNT_LABELS, COMMENT_STATUS_GROUP_LABELS,
  RESCHEDULE_STATUS_LABELS, RescheduleStatusBadge,
} from '@/components/ui';
import { useFilterOptions } from '@/hooks/useFilterOptions';
import { useQuickFilterChips } from '@/hooks/useUserPreferences';
import { useCSVExportPreferences } from '@/hooks/useCSVExportPreferences';
import { CACHE_KEYS, LABELS, MESSAGES, ENTITIES, CHART_COLORS } from '@/constants';
import { useSharedDateRange, useSharedCentres } from '@/hooks/useSharedFilterState';
import { exportToCSV, CSVColumn, CSVFormatters } from '@/lib/csvExport';
import styles from '@/app/dashboard.module.css';

const CACHE_KEY = CACHE_KEYS.CLASS_QUALITY;

// Helper to get primary teacher name from class
function getPrimaryTeacher(cls: Class): string {
  // Try to get from first slot's teacher attendance
  if (cls.slots && cls.slots.length > 0) {
    for (const slot of cls.slots) {
      if (slot.teacherAttendance && slot.teacherAttendance.length > 0) {
        return slot.teacherAttendance[0].teacher.fullName;
      }
      if (slot.teachers && slot.teachers.length > 0) {
        return slot.teachers[0].teacher.fullName;
      }
    }
  }
  // Fallback to class teachers
  if (cls.teachers && cls.teachers.length > 0) {
    return cls.teachers[0].teacher.fullName;
  }
  return 'Không rõ';
}

// Copy Button Component
function CopyButton({ content, label }: { content: string; label: string }) {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = async () => {
    try {
      // Strip markdown formatting for plain text copy (better for Excel)
      const plainText = content
        .replace(/\*\*/g, '')  // Remove bold markers
        .replace(/\*/g, '')    // Remove italic markers
        .replace(/`/g, '');    // Remove code markers
      
      await navigator.clipboard.writeText(plainText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };
  
  return (
    <button 
      onClick={handleCopy} 
      className={styles.copyBtn}
      title={`Copy ${label}`}
    >
      {copied ? '✓ Đã copy' : 'Copy'}
    </button>
  );
}

// Content generation functions for summary blocks
function generateCheckpointContent(data: any): string {
  const lines: string[] = [];
  
  if (data.cp1TotalStudents > 0) {
    const cp1FailCount = data.cp1TotalStudents - data.cp1PassCount;
    lines.push(`**CP1:**`);
    lines.push(`- Tỷ lệ học viên đạt/không đạt: ${data.cp1PassCount}/${cp1FailCount} (${data.cp1PassRate.toFixed(1)}% đạt).`);
    lines.push(`- Điểm CP1 trung bình: ${data.cp1AverageScore.toFixed(3)}.`);
    lines.push('');
  }
  
  if (data.cp2TotalStudents > 0) {
    const cp2FailCount = data.cp2TotalStudents - data.cp2PassCount;
    lines.push(`**CP2:**`);
    lines.push(`- Tỷ lệ học viên đạt/không đạt: ${data.cp2PassCount}/${cp2FailCount} (${data.cp2PassRate.toFixed(1)}% đạt).`);
    lines.push(`- Điểm CP2 trung bình: ${data.cp2AverageScore.toFixed(3)}.`);
  }
  
  if (data.cp1TotalStudents === 0 && data.cp2TotalStudents === 0) {
    lines.push('*Chưa có dữ liệu Checkpoint cho cơ sở này (hoặc chỉ có khối Art).*');
    lines.push('');
  }
  
  lines.push('');
  lines.push(`*Thang đo: Đạt khi điểm CP ≥ 3.5.*`);
  lines.push(`*Lưu ý: Khối Coding có CP ở buổi 5 & 9; Robotics có CP ở buổi 4 & 8; Art chỉ có điểm cuối khoá (Demo).*`);
  
  return lines.join('\n');
}

function generateDemoContent(data: any): string {
  const lines: string[] = [];
  
  if (data.demoTotalStudents > 0) {
    lines.push(`**Chất lượng sản phẩm học viên:**`);
    lines.push(`- Phân hóa (Tốt/Trung bình/Kém): ${data.demoGoodCount}/${data.demoMediumCount}/${data.demoPoorCount}.`);
    lines.push(`- Điểm Demo trung bình: ${data.demoAverageScore.toFixed(3)}.`);
    lines.push('');
  }
  
  if (data.totalStudentsWithTBCK > 0) {
    const passedCount = data.rankACount + data.rankBCount + data.rankCCount;
    const passedRate = ((passedCount / data.totalStudentsWithTBCK) * 100).toFixed(1);
    
    lines.push(`**Xếp loại TBCK (Tổng hợp CP & Demo):**`);
    lines.push(`- Tổng đạt (A+B+C): ${passedCount}/${data.totalStudentsWithTBCK} (${passedRate}%).`);
    lines.push(`- Hạng A (Xuất sắc): ${data.rankACount} học viên.`);
    lines.push(`- Hạng B (Tốt): ${data.rankBCount} học viên.`);
    lines.push(`- Hạng C (Đạt): ${data.rankCCount} học viên.`);
    lines.push(`- Hạng D (Chưa đạt): ${data.rankDCount} học viên.`);
    lines.push('');
    lines.push(`*Thang đo: Tốt (≥4), Trung bình (≥3), Kém (<3).*`);
    lines.push(`*Công thức TBCK: 0.4 × (CP1+CP2)/2 + 0.6 × Demo (nếu không có CP thì 100% Demo).*`);
    lines.push(`*Xếp hạng: A (TBCK≥4.5 & Demo≥3.5); B (TBCK≥4.0 & Demo≥2.5); C (TBCK≥2.5); D (TBCK<2.5).*`);
  }
  
  if (data.demoTotalStudents === 0) {
    lines.push('*Chưa có dữ liệu Demo cho cơ sở này.*');
  }
  
  return lines.join('\n');
}

function generateOperationsContent(data: any): string {
  const lines: string[] = [];
  
  const commentRate = ((data.classesWithCommentIssues / data.totalClasses) * 100).toFixed(1);
  const attendanceRate = ((data.classesWithAttendanceAlerts / data.totalClasses) * 100).toFixed(1);
  
  lines.push(`**Tỷ lệ dời buổi học:**`);
  lines.push(`- ${data.reschedulingRate.toFixed(1)}% buổi học bị dời lịch.`);
  lines.push(`- ${data.classesWithRescheduling}/${data.totalClasses} lớp có buổi bị dời.`);
  lines.push(`- *Tính dựa trên khoảng cách giữa các buổi học (chuẩn 7 ngày).*`);
  lines.push('');
  
  lines.push(`**Vi phạm nhận xét giáo viên:**`);
  lines.push(`- ${data.classesWithCommentIssues}/${data.totalClasses} lớp (${commentRate}%) có nhận xét ${COMMENT_STATUS_COUNT_LABELS.brief}/${COMMENT_STATUS_COUNT_LABELS.empty}.`);
  lines.push(`- *Vi phạm: Nhận xét ${COMMENT_STATUS_COUNT_LABELS.empty}, <20 ký tự, ${COMMENT_STATUS_COUNT_LABELS.duplicate}, hoặc ${COMMENT_STATUS_COUNT_LABELS.overdue} >48h.*`);
  lines.push('');
  
  lines.push(`**Cảnh báo chuyên cần:**`);
  lines.push(`- ${data.classesWithAttendanceAlerts}/${data.totalClasses} lớp (${attendanceRate}%) có học viên vi phạm chuyên cần.`);
  lines.push(`- *Cảnh báo: Nghỉ ≥3 buổi hoặc nghỉ liên tiếp ≥2 buổi.*`);
  
  return lines.join('\n');
}

export default function ClassQualityPage() {
  const { session, isLoading: authLoading, logout } = useAuth();
  const router = useRouter();
  const { hasPreferences } = useQuickFilterChips();

  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ loaded: 0, total: 0 });
  const [centres, setCentres] = useState<Centre[]>([]);
  const [centresLoading, setCentresLoading] = useState(false);
  
  // Shared filter state (synced across pages)
  const [dateFrom, dateTo, setDateFrom, setDateTo, datesLoaded] = useSharedDateRange();
  const [selectedCentres, setSelectedCentres, centresLoaded] = useSharedCentres();
  
  const [toolbarSelectedCourses, setToolbarSelectedCourses] = useState<string[]>([]); // NEW: Toolbar-level courses
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Comment Table States
  const [searchC, setSearchC] = useState('');
  const [selectedCourseLinesC, setSelectedCourseLinesC] = useState<string[]>([]);
  const [selectedStatusesC, setSelectedStatusesC] = useState<string[]>([]);
  const [selectedCentreIdsC, setSelectedCentreIdsC] = useState<string[]>([]);
  const [selectedLevelsC, setSelectedLevelsC] = useState<string[]>([]);
  const [sortKeyC, setSortKeyC] = useState<'name' | 'teacher' | 'progress' | 'brief' | 'empty' | 'duplicate' | 'commentIssues'>('commentIssues');
  const [sortDirC, setSortDirC] = useState<'asc' | 'desc'>('desc');
  const [quickFilterC, setQuickFilterC] = useState<string | null>(null);

  // Attendance Table States
  const [searchA, setSearchA] = useState('');
  const [selectedCourseLinesA, setSelectedCourseLinesA] = useState<string[]>([]);
  const [selectedStatusesA, setSelectedStatusesA] = useState<string[]>([]);
  const [selectedCentreIdsA, setSelectedCentreIdsA] = useState<string[]>([]);
  const [selectedLevelsA, setSelectedLevelsA] = useState<string[]>([]);
  const [sortKeyA, setSortKeyA] = useState<'name' | 'teacher' | 'totalStudents' | 'frequent' | 'consecutive' | 'lateStage' | 'attendanceAlerts'>('attendanceAlerts');
  const [sortDirA, setSortDirA] = useState<'asc' | 'desc'>('desc');
  const [quickFilterA, setQuickFilterA] = useState<string | null>(null);

  // Session Rescheduling Table States
  const [searchR, setSearchR] = useState('');
  const [selectedCourseLinesR, setSelectedCourseLinesR] = useState<string[]>([]);
  const [selectedStatusesR, setSelectedStatusesR] = useState<string[]>([]);
  const [selectedCentreIdsR, setSelectedCentreIdsR] = useState<string[]>([]);
  const [selectedLevelsR, setSelectedLevelsR] = useState<string[]>([]);
  const [sortKeyR, setSortKeyR] = useState<'name' | 'teacher' | 'classType' | 'avgDays' | 'rescheduledCount' | 'rescheduledRate'>('rescheduledCount');
  const [sortDirR, setSortDirR] = useState<'asc' | 'desc'>('desc');
  const [quickFilterR, setQuickFilterR] = useState<string | null>(null);

  const [selectedClassForComment, setSelectedClassForComment] = useState<AnalyzedClassForQuality | null>(null);
  const [commentModalSessionIndex, setCommentModalSessionIndex] = useState<number | null>(null);
  const [selectedClassForAttendance, setSelectedClassForAttendance] = useState<AnalyzedClassForQuality | null>(null);
  const [selectedClassForRescheduling, setSelectedClassForRescheduling] = useState<AnalyzedClassForQuality | null>(null);

  const [showCommentTable, setShowCommentTable] = useState(true);
  const [showAttendanceTable, setShowAttendanceTable] = useState(true);
  const [showReschedulingTable, setShowReschedulingTable] = useState(true);
  const [showSummarySection, setShowSummarySection] = useState(true);
  const [showCancelledTable, setShowCancelledTable] = useState(false);
  const [showCheckpointTable, setShowCheckpointTable] = useState(true);
  const [showExemptSessions, setShowExemptSessions] = useState(true);
  const [showReschedulingExemptRules, setShowReschedulingExemptRules] = useState(true);
  const [showOutline, setShowOutline] = useState(true);

  // Checkpoint table states
  const [searchCP, setSearchCP] = useState('');
  const [selectedCourseLinesCP, setSelectedCourseLinesCP] = useState<string[]>([]);
  const [selectedStatusesCP, setSelectedStatusesCP] = useState<string[]>([]);
  const [selectedCentreIdsCP, setSelectedCentreIdsCP] = useState<string[]>([]);
  const [selectedLevelsCP, setSelectedLevelsCP] = useState<string[]>([]);
  const [sortKeyCP, setSortKeyCP] = useState<'name' | 'teacher' | 'cp1Pass' | 'cp2Pass' | 'demoPass' | 'cp1Avg' | 'cp2Avg' | 'demoAvg'>('cp2Pass');
  const [sortDirCP, setSortDirCP] = useState<'asc' | 'desc'>('desc');
  const [quickFilterCP, setQuickFilterCP] = useState<string | null>(null);
  const [selectedClassForCheckpoint, setSelectedClassForCheckpoint] = useState<AnalyzedClassForQuality | null>(null);
  const [checkpointView, setCheckpointView] = useState<'cp1' | 'cp2' | 'demo'>('cp2'); // Which checkpoint to show in modal
  const [selectedSummaryCentre, setSelectedSummaryCentre] = useState<string>('all');
  const [summaryStatusFilter, setSummaryStatusFilter] = useState<string[]>(['RUNNING', 'FINISHED']);

  // CSV Export Settings - separate for each table
  const [showCommentCSVSettings, setShowCommentCSVSettings] = useState(false);
  const [showAttendanceCSVSettings, setShowAttendanceCSVSettings] = useState(false);
  const [showReschedulingCSVSettings, setShowReschedulingCSVSettings] = useState(false);
  
  const { columns: commentCSVColumns, saveColumns: saveCommentColumns } = useCSVExportPreferences(
    'class-quality-comments',
    getDefaultCommentCSVColumns()
  );
  
  const { columns: attendanceCSVColumns, saveColumns: saveAttendanceColumns } = useCSVExportPreferences(
    'class-quality-attendance',
    getDefaultAttendanceCSVColumns()
  );
  
  const { columns: reschedulingCSVColumns, saveColumns: saveReschedulingColumns } = useCSVExportPreferences(
    'class-quality-rescheduling',
    getDefaultReschedulingCSVColumns()
  );

  // Exemption sessions (1-indexed): sessions where comments are required even if student is absent
  const [exemptedSessions, setExemptedSessions] = useState<number[]>(Array.from({length: 30}, (_, i) => i + 1).filter(s => ![5, 9, 14].includes(s)));
  
  // Rescheduling exemption rules
  const [exemptOneOnOneClasses, setExemptOneOnOneClasses] = useState(true); // Exempt (1:1) classes
  const [holidayPeriods, setHolidayPeriods] = useState<Array<{ name: string; from: string; to: string }>>([
    { name: 'Tết Dương lịch', from: '2026-01-01', to: '2026-01-01' },
    { name: 'Tết Âm lịch', from: '2026-02-14', to: '2026-02-22' },
    { name: 'Giỗ Tổ Hùng Vương', from: '2026-04-25', to: '2026-04-26' },
    { name: 'Giải phóng miền Nam & Quốc tế Lao động', from: '2026-04-30', to: '2026-05-02' }
  ]);
  const [showHolidayForm, setShowHolidayForm] = useState(false);
  const [newHolidayName, setNewHolidayName] = useState('');
  const [newHolidayFrom, setNewHolidayFrom] = useState('');
  const [newHolidayTo, setNewHolidayTo] = useState('');

  const { toasts, addToast, removeToast } = useToast();

  useEffect(() => {
    if (!authLoading && !isAuthenticated()) router.replace('/login');
  }, [authLoading, router]);

  const _session = session ?? loadSession();
  const _name = _session?.displayName?.trim() || '';
  const _email = _session?.email || '';
  const userAvatar = _name ? initials(_name) : _email.charAt(0).toUpperCase();
  const userName = _name || _email.split('@')[0];

  // Allowed pages (for navigation filtering)
  const { allowedPages } = useAllowedPages();

  // Navigation items
  const navItems = getNavItemsWithRouter('class-quality', router, allowedPages);

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
        const saved = await getCache(CACHE_KEY);
        if (saved) {
          if (saved.classes) setClasses(saved.classes);
          if (saved.exemptedSessions) setExemptedSessions(saved.exemptedSessions);
          if (saved.exemptOneOnOneClasses !== undefined) setExemptOneOnOneClasses(saved.exemptOneOnOneClasses);
          
          // Merge default holidays with cached holidays (avoid duplicates)
          if (saved.holidayPeriods) {
            const defaultHolidays = [
              { name: 'Tết Dương lịch', from: '2026-01-01', to: '2026-01-01' },
              { name: 'Tết Âm lịch', from: '2026-02-14', to: '2026-02-22' },
              { name: 'Giỗ Tổ Hùng Vương', from: '2026-04-25', to: '2026-04-26' },
              { name: 'Giải phóng miền Nam & Quốc tế Lao động', from: '2026-04-30', to: '2026-05-02' }
            ];
            
            // Check which defaults are missing from cache
            const cachedPeriods = saved.holidayPeriods as Array<{ name: string; from: string; to: string }>;
            const missingDefaults = defaultHolidays.filter(def => 
              !cachedPeriods.some(cached => 
                cached.from === def.from && cached.to === def.to
              )
            );
            
            // Merge: cached periods + missing defaults
            if (missingDefaults.length > 0) {
              setHolidayPeriods([...cachedPeriods, ...missingDefaults]);
            } else {
              setHolidayPeriods(cachedPeriods);
            }
          }
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
      
      await setCache(CACHE_KEY, { classes: result, exemptedSessions, timestamp: Date.now() });
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
    await clearCache(CACHE_KEY);
    setClasses([]);
    addToast(MESSAGES.CACHE.CLEARED, 'success');
  };

  useEffect(() => {
    if (classes.length > 0 && !loading)
      setCache(CACHE_KEY, { classes, exemptedSessions, exemptOneOnOneClasses, holidayPeriods, timestamp: Date.now() }).catch(console.error);
  }, [classes, loading, exemptedSessions, exemptOneOnOneClasses, holidayPeriods]);

  const analyzedClasses = useMemo(() => {
    return classes.map(cls => analyzeClassQuality(cls, exemptedSessions));
  }, [classes, exemptedSessions]);

  // Separate normal and cancelled classes
  const { normalClasses, cancelledClasses } = useMemo(() => {
    const norm: typeof analyzedClasses = [];
    const canc: typeof analyzedClasses = [];
    
    analyzedClasses.forEach(a => {
      const status = a.cls.status?.toUpperCase() || '';
      const isCancelled = status === 'ABANDONED' || status === 'REJECTED';
      
      if (isCancelled) {
        canc.push(a);
      } else {
        norm.push(a);
      }
    });
    
    return { normalClasses: norm, cancelledClasses: canc };
  }, [analyzedClasses]);

  // Calculate max sessions from all classes to show in exemption UI
  const maxSessions = useMemo(() => {
    if (classes.length === 0) return 14;
    return Math.max(...classes.map(cls => cls.numberOfSessions || cls.slots?.length || 14));
  }, [classes]);

  const courseLineOptions = useFilterOptions(normalClasses, (a) => a.courseLineName);

  const tableCentreIds = useMemo(() => {
    const ids = new Set<string>();
    normalClasses.forEach(a => {
      if (a.cls.centre?.id) ids.add(a.cls.centre.id);
    });
    return Array.from(ids);
  }, [normalClasses]);

  const statusOptions = useFilterOptions(normalClasses, (a) => a.cls.status);

  const levelOptions = useFilterOptions(normalClasses, (a) => a.cls.level);

  const filteredCommentClasses = useMemo(() => {
    let list = normalClasses;
    if (searchC.trim()) {
      const q = searchC.toLowerCase();
      list = list.filter(a => a.cls.name.toLowerCase().includes(q) || a.cls.centre?.name?.toLowerCase()?.includes(q));
    }
    if (selectedCourseLinesC.length > 0) list = list.filter(a => selectedCourseLinesC.includes(a.courseLineName));
    if (selectedStatusesC.length > 0) list = list.filter(a => selectedStatusesC.includes(a.cls.status || ''));
    if (selectedCentreIdsC.length > 0) list = list.filter(a => selectedCentreIdsC.includes(a.cls.centre?.id || ''));
    if (selectedLevelsC.length > 0) list = list.filter(a => selectedLevelsC.includes(a.cls.level || ''));
    if (quickFilterC === 'commentIssues') {
      list = list.filter(a => (a.commentAnalysis.emptyCount + a.commentAnalysis.briefCount + a.commentAnalysis.duplicateCount + a.commentAnalysis.overdueCount) > 0);
    }
    
    return list.sort((a, b) => {
      const d = sortDirC === 'asc' ? 1 : -1;
      if (sortKeyC === 'name') return d * a.cls.name.localeCompare(b.cls.name);
      if (sortKeyC === 'teacher') return d * getPrimaryTeacher(a.cls).localeCompare(getPrimaryTeacher(b.cls));
      if (sortKeyC === 'progress') return d * (a.commentAnalysis.passedSlots - b.commentAnalysis.passedSlots);
      if (sortKeyC === 'brief') return d * (a.commentAnalysis.briefCount - b.commentAnalysis.briefCount);
      if (sortKeyC === 'empty') return d * ((a.commentAnalysis.emptyCount + a.commentAnalysis.overdueCount) - (b.commentAnalysis.emptyCount + b.commentAnalysis.overdueCount));
      if (sortKeyC === 'duplicate') return d * (a.commentAnalysis.duplicateCount - b.commentAnalysis.duplicateCount);
      if (sortKeyC === 'commentIssues') {
        const aIssues = a.commentAnalysis.emptyCount + a.commentAnalysis.briefCount + a.commentAnalysis.duplicateCount + a.commentAnalysis.overdueCount;
        const bIssues = b.commentAnalysis.emptyCount + b.commentAnalysis.briefCount + b.commentAnalysis.duplicateCount + b.commentAnalysis.overdueCount;
        return d * (aIssues - bIssues);
      }
      return 0;
    });
  }, [normalClasses, searchC, selectedCourseLinesC, selectedStatusesC, selectedCentreIdsC, selectedLevelsC, sortKeyC, sortDirC, quickFilterC]);

  const filteredAttendanceClasses = useMemo(() => {
    let list = normalClasses;
    if (searchA.trim()) {
      const q = searchA.toLowerCase();
      list = list.filter(a => a.cls.name.toLowerCase().includes(q) || a.cls.centre?.name?.toLowerCase()?.includes(q));
    }
    if (selectedCourseLinesA.length > 0) list = list.filter(a => selectedCourseLinesA.includes(a.courseLineName));
    if (selectedStatusesA.length > 0) list = list.filter(a => selectedStatusesA.includes(a.cls.status || ''));
    if (selectedCentreIdsA.length > 0) list = list.filter(a => selectedCentreIdsA.includes(a.cls.centre?.id || ''));
    if (selectedLevelsA.length > 0) list = list.filter(a => selectedLevelsA.includes(a.cls.level || ''));
    if (quickFilterA === 'attendanceAlerts') {
      list = list.filter(a => a.attendanceAnalysis.totalAlerts > 0);
    }
    
    return list.sort((a, b) => {
      const d = sortDirA === 'asc' ? 1 : -1;
      if (sortKeyA === 'name') return d * a.cls.name.localeCompare(b.cls.name);
      if (sortKeyA === 'teacher') return d * getPrimaryTeacher(a.cls).localeCompare(getPrimaryTeacher(b.cls));
      if (sortKeyA === 'totalStudents') return d * (a.attendanceAnalysis.totalStudents - b.attendanceAnalysis.totalStudents);
      if (sortKeyA === 'frequent') {
        const aFreq = a.attendanceAnalysis.studentsWithAlerts.filter(st => st.alerts.includes('frequent_absent')).length;
        const bFreq = b.attendanceAnalysis.studentsWithAlerts.filter(st => st.alerts.includes('frequent_absent')).length;
        return d * (aFreq - bFreq);
      }
      if (sortKeyA === 'consecutive') {
        const aCons = a.attendanceAnalysis.studentsWithAlerts.filter(st => st.alerts.includes('consecutive_absent')).length;
        const bCons = b.attendanceAnalysis.studentsWithAlerts.filter(st => st.alerts.includes('consecutive_absent')).length;
        return d * (aCons - bCons);
      }
      if (sortKeyA === 'lateStage') {
        const aLate = a.attendanceAnalysis.studentsWithAlerts.filter(st => st.alerts.includes('late_stage_absent')).length;
        const bLate = b.attendanceAnalysis.studentsWithAlerts.filter(st => st.alerts.includes('late_stage_absent')).length;
        return d * (aLate - bLate);
      }
      if (sortKeyA === 'attendanceAlerts') return d * (a.attendanceAnalysis.totalAlerts - b.attendanceAnalysis.totalAlerts);
      return 0;
    });
  }, [normalClasses, searchA, selectedCourseLinesA, selectedStatusesA, selectedCentreIdsA, selectedLevelsA, sortKeyA, sortDirA, quickFilterA]);

  const filteredReschedulingClasses = useMemo(() => {
    let list = normalClasses;
    
    // Apply exemption rules
    if (exemptOneOnOneClasses) {
      list = list.filter(a => !a.cls.name.includes('(1:1)'));
    }
    
    if (searchR.trim()) {
      const q = searchR.toLowerCase();
      list = list.filter(a => a.cls.name.toLowerCase().includes(q) || a.cls.centre?.name?.toLowerCase()?.includes(q));
    }
    if (selectedCourseLinesR.length > 0) list = list.filter(a => selectedCourseLinesR.includes(a.courseLineName));
    if (selectedStatusesR.length > 0) list = list.filter(a => selectedStatusesR.includes(a.cls.status || ''));
    if (selectedCentreIdsR.length > 0) list = list.filter(a => selectedCentreIdsR.includes(a.cls.centre?.id || ''));
    if (selectedLevelsR.length > 0) list = list.filter(a => selectedLevelsR.includes(a.cls.level || ''));
    if (quickFilterR === 'hasRescheduling') {
      list = list.filter(a => a.reschedulingAnalysis.rescheduledSessions > 0);
    }
    
    return list.sort((a, b) => {
      const d = sortDirR === 'asc' ? 1 : -1;
      if (sortKeyR === 'name') return d * a.cls.name.localeCompare(b.cls.name);
      if (sortKeyR === 'teacher') return d * getPrimaryTeacher(a.cls).localeCompare(getPrimaryTeacher(b.cls));
      if (sortKeyR === 'classType') return d * a.reschedulingAnalysis.classType.localeCompare(b.reschedulingAnalysis.classType);
      if (sortKeyR === 'avgDays') return d * (a.reschedulingAnalysis.averageDaysBetweenSessions - b.reschedulingAnalysis.averageDaysBetweenSessions);
      if (sortKeyR === 'rescheduledCount') return d * (a.reschedulingAnalysis.rescheduledSessions - b.reschedulingAnalysis.rescheduledSessions);
      if (sortKeyR === 'rescheduledRate') {
        const aRate = a.reschedulingAnalysis.totalSessions > 0 ? a.reschedulingAnalysis.rescheduledSessions / a.reschedulingAnalysis.totalSessions : 0;
        const bRate = b.reschedulingAnalysis.totalSessions > 0 ? b.reschedulingAnalysis.rescheduledSessions / b.reschedulingAnalysis.totalSessions : 0;
        return d * (aRate - bRate);
      }
      return 0;
    });
  }, [normalClasses, searchR, selectedCourseLinesR, selectedStatusesR, selectedCentreIdsR, selectedLevelsR, sortKeyR, sortDirR, quickFilterR, exemptOneOnOneClasses]);

  const handleSortC = (key: typeof sortKeyC) => {
    if (sortKeyC === key) setSortDirC(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKeyC(key); setSortDirC('desc'); }
  };

  const handleSortA = (key: typeof sortKeyA) => {
    if (sortKeyA === key) setSortDirA(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKeyA(key); setSortDirA('desc'); }
  };

  const handleSortR = (key: typeof sortKeyR) => {
    if (sortKeyR === key) setSortDirR(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKeyR(key); setSortDirR('desc'); }
  };

  const hasTableFilterC = !!(searchC || selectedCourseLinesC.length || selectedStatusesC.length || selectedCentreIdsC.length || selectedLevelsC.length || quickFilterC);
  const clearTableFiltersC = () => { setSearchC(''); setSelectedCourseLinesC([]); setSelectedStatusesC([]); setSelectedCentreIdsC([]); setSelectedLevelsC([]); setQuickFilterC(null); };

  const hasTableFilterA = !!(searchA || selectedCourseLinesA.length || selectedStatusesA.length || selectedCentreIdsA.length || selectedLevelsA.length || quickFilterA);
  const clearTableFiltersA = () => { setSearchA(''); setSelectedCourseLinesA([]); setSelectedStatusesA([]); setSelectedCentreIdsA([]); setSelectedLevelsA([]); setQuickFilterA(null); };

  const hasTableFilterR = !!(searchR || selectedCourseLinesR.length || selectedStatusesR.length || selectedCentreIdsR.length || selectedLevelsR.length || quickFilterR);
  const clearTableFiltersR = () => { setSearchR(''); setSelectedCourseLinesR([]); setSelectedStatusesR([]); setSelectedCentreIdsR([]); setSelectedLevelsR([]); setQuickFilterR(null); };

  // Filtered Checkpoint Classes
  const filteredCheckpointClasses = useMemo(() => {
    let list = normalClasses;
    
    if (searchCP.trim()) {
      const q = searchCP.toLowerCase();
      list = list.filter(a => a.cls.name.toLowerCase().includes(q) || a.cls.centre?.name?.toLowerCase()?.includes(q));
    }
    if (selectedCourseLinesCP.length > 0) list = list.filter(a => selectedCourseLinesCP.includes(a.courseLineName));
    if (selectedStatusesCP.length > 0) list = list.filter(a => selectedStatusesCP.includes(a.cls.status || ''));
    if (selectedCentreIdsCP.length > 0) list = list.filter(a => selectedCentreIdsCP.includes(a.cls.centre?.id || ''));
    if (selectedLevelsCP.length > 0) list = list.filter(a => selectedLevelsCP.includes(a.cls.level || ''));
    if (quickFilterCP === 'hasIssues') {
      list = list.filter(a => 
        a.cp1Analysis.issueType !== null || 
        a.cp2Analysis.issueType !== null || 
        a.demoAnalysis.issueType !== null
      );
    }
    
    return list.sort((a, b) => {
      const d = sortDirCP === 'asc' ? 1 : -1;
      if (sortKeyCP === 'name') return d * a.cls.name.localeCompare(b.cls.name);
      if (sortKeyCP === 'teacher') return d * getPrimaryTeacher(a.cls).localeCompare(getPrimaryTeacher(b.cls));
      if (sortKeyCP === 'cp1Pass') return d * (a.cp1Analysis.passRate - b.cp1Analysis.passRate);
      if (sortKeyCP === 'cp2Pass') return d * (a.cp2Analysis.passRate - b.cp2Analysis.passRate);
      if (sortKeyCP === 'demoPass') return d * (a.demoAnalysis.passRate - b.demoAnalysis.passRate);
      if (sortKeyCP === 'cp1Avg') return d * ((a.cp1Analysis.averageScore || 0) - (b.cp1Analysis.averageScore || 0));
      if (sortKeyCP === 'cp2Avg') return d * ((a.cp2Analysis.averageScore || 0) - (b.cp2Analysis.averageScore || 0));
      if (sortKeyCP === 'demoAvg') return d * ((a.demoAnalysis.averageScore || 0) - (b.demoAnalysis.averageScore || 0));
      return 0;
    });
  }, [normalClasses, searchCP, selectedCourseLinesCP, selectedStatusesCP, selectedCentreIdsCP, selectedLevelsCP, sortKeyCP, sortDirCP, quickFilterCP]);

  const handleSortCP = (key: typeof sortKeyCP) => {
    if (sortKeyCP === key) setSortDirCP(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKeyCP(key); setSortDirCP('desc'); }
  };

  const hasTableFilterCP = !!(searchCP || selectedCourseLinesCP.length || selectedStatusesCP.length || selectedCentreIdsCP.length || selectedLevelsCP.length || quickFilterCP);
  const clearTableFiltersCP = () => { setSearchCP(''); setSelectedCourseLinesCP([]); setSelectedStatusesCP([]); setSelectedCentreIdsCP([]); setSelectedLevelsCP([]); setQuickFilterCP(null); };

  // CSV Export handlers
  const handleExportCommentCSV = useCallback(() => {
    if (filteredCommentClasses.length === 0) {
      addToast('Không có dữ liệu để xuất', 'info');
      return;
    }
    
    try {
      const columns = getCommentCSVColumnsFromConfig(commentCSVColumns);
      
      if (columns.length === 0) {
        addToast('Vui lòng chọn ít nhất một cột để xuất', 'info');
        return;
      }
      
      exportToCSV(filteredCommentClasses, columns, 'chat-luong-lop-hoc-nhan-xet');
      addToast(`Đã xuất ${filteredCommentClasses.length} lớp với ${columns.length} cột`, 'success');
    } catch (error) {
      console.error('Export error:', error);
      addToast('Có lỗi xảy ra khi xuất file', 'error');
    }
  }, [filteredCommentClasses, commentCSVColumns, addToast]);

  const handleExportAttendanceCSV = useCallback(() => {
    if (filteredAttendanceClasses.length === 0) {
      addToast('Không có dữ liệu để xuất', 'info');
      return;
    }
    
    try {
      const columns = getAttendanceCSVColumnsFromConfig(attendanceCSVColumns);
      
      if (columns.length === 0) {
        addToast('Vui lòng chọn ít nhất một cột để xuất', 'info');
        return;
      }
      
      exportToCSV(filteredAttendanceClasses, columns, 'chat-luong-lop-hoc-chuyen-can');
      addToast(`Đã xuất ${filteredAttendanceClasses.length} lớp với ${columns.length} cột`, 'success');
    } catch (error) {
      console.error('Export error:', error);
      addToast('Có lỗi xảy ra khi xuất file', 'error');
    }
  }, [filteredAttendanceClasses, attendanceCSVColumns, addToast]);

  const handleExportReschedulingCSV = useCallback(() => {
    if (filteredReschedulingClasses.length === 0) {
      addToast('Không có dữ liệu để xuất', 'info');
      return;
    }
    
    try {
      const columns = getReschedulingCSVColumnsFromConfig(reschedulingCSVColumns);
      
      if (columns.length === 0) {
        addToast('Vui lòng chọn ít nhất một cột để xuất', 'info');
        return;
      }
      
      exportToCSV(filteredReschedulingClasses, columns, 'chat-luong-lop-hoc-thay-doi-lich');
      addToast(`Đã xuất ${filteredReschedulingClasses.length} lớp với ${columns.length} cột`, 'success');
    } catch (error) {
      console.error('Export error:', error);
      addToast('Có lỗi xảy ra khi xuất file', 'error');
    }
  }, [filteredReschedulingClasses, reschedulingCSVColumns, addToast]);

    const stats = useMemo(() => {
    let totalCommentsExpected = 0, okSlots = 0;
    let totalStudents = 0, alertsCounts = 0;
    let classesWithCommentIssues = 0;
    let classesWithAttendanceAlerts = 0;
    let classesWithRescheduling = 0;
    let totalRescheduledSessions = 0;
    let totalSessions = 0;

    // Checkpoint stats
    let cp1TotalStudents = 0, cp1PassCount = 0;
    let cp2TotalStudents = 0, cp2PassCount = 0;
    let demoTotalStudents = 0, demoPassCount = 0;
    let classesWithCP1 = 0, classesWithCP2 = 0, classesWithDemo = 0;
    let cp1ScoreSum = 0, cp2ScoreSum = 0, demoScoreSum = 0;
    
    // Rank stats (A/B/C/D) - based on TBCK
    let rankACount = 0, rankBCount = 0, rankCCount = 0, rankDCount = 0;
    let totalStudentsWithTBCK = 0;
    
    // Quality band stats for Demo
    let demoGoodCount = 0, demoMediumCount = 0, demoPoorCount = 0;

    normalClasses.forEach(a => {
      // Sum up total comments expected from all students (not total slots)
      a.commentAnalysis.students.forEach(st => {
        totalCommentsExpected += st.totalCommentsExpected;
      });
      okSlots += a.commentAnalysis.okCount;
      totalStudents += a.attendanceAnalysis.totalStudents;
      alertsCounts += a.attendanceAnalysis.totalAlerts;

      const issues = a.commentAnalysis.emptyCount + a.commentAnalysis.briefCount + a.commentAnalysis.duplicateCount + a.commentAnalysis.overdueCount;
      if (issues > 0) classesWithCommentIssues++;

      if (a.attendanceAnalysis.totalAlerts > 0) classesWithAttendanceAlerts++;

      if (a.reschedulingAnalysis.rescheduledSessions > 0) classesWithRescheduling++;
      totalRescheduledSessions += a.reschedulingAnalysis.rescheduledSessions;
      totalSessions += a.reschedulingAnalysis.totalSessions;

      // CP1 stats
      if (a.cp1Analysis.hasSession && a.cp1Analysis.studentsWithScores > 0) {
        classesWithCP1++;
        cp1TotalStudents += a.cp1Analysis.studentsWithScores;
        cp1PassCount += a.cp1Analysis.passCount;
        if (a.cp1Analysis.averageScore !== null) {
          cp1ScoreSum += a.cp1Analysis.averageScore * a.cp1Analysis.studentsWithScores;
        }
      }

      // CP2 stats
      if (a.cp2Analysis.hasSession && a.cp2Analysis.studentsWithScores > 0) {
        classesWithCP2++;
        cp2TotalStudents += a.cp2Analysis.studentsWithScores;
        cp2PassCount += a.cp2Analysis.passCount;
        if (a.cp2Analysis.averageScore !== null) {
          cp2ScoreSum += a.cp2Analysis.averageScore * a.cp2Analysis.studentsWithScores;
        }
      }

      // Demo stats
      if (a.demoAnalysis.hasSession && a.demoAnalysis.studentsWithScores > 0) {
        classesWithDemo++;
        demoTotalStudents += a.demoAnalysis.studentsWithScores;
        demoPassCount += a.demoAnalysis.passCount;
        if (a.demoAnalysis.averageScore !== null) {
          demoScoreSum += a.demoAnalysis.averageScore * a.demoAnalysis.studentsWithScores;
        }
        
        // Count demo quality bands
        demoGoodCount += a.demoAnalysis.goodCount;
        demoMediumCount += a.demoAnalysis.averageCount;
        demoPoorCount += a.demoAnalysis.poorCount;
      }
      
      // Calculate ranks for all students with complete scores
      // Collect all students from all checkpoints
      const studentMap = new Map<string, { cp1?: number; cp2?: number; demo?: number }>();
      
      a.cp1Analysis.students.forEach((st: any) => {
        if (st.checkpointScore !== null) {
          const existing = studentMap.get(st.studentId) || {};
          studentMap.set(st.studentId, { ...existing, cp1: st.checkpointScore });
        }
      });
      
      a.cp2Analysis.students.forEach((st: any) => {
        if (st.checkpointScore !== null) {
          const existing = studentMap.get(st.studentId) || {};
          studentMap.set(st.studentId, { ...existing, cp2: st.checkpointScore });
        }
      });
      
      a.demoAnalysis.students.forEach((st: any) => {
        if (st.demoScore !== null) {
          const existing = studentMap.get(st.studentId) || {};
          studentMap.set(st.studentId, { ...existing, demo: st.demoScore });
        }
      });
      
      // Calculate TBCK and rank for each student
      studentMap.forEach((scores) => {
        const tbck = computeTBCK(scores.cp1 ?? null, scores.cp2 ?? null, scores.demo ?? null);
        if (tbck !== null) {
          totalStudentsWithTBCK++;
          const { rank } = determineRank(tbck, scores.demo ?? null);
          if (rank === 'A') rankACount++;
          else if (rank === 'B') rankBCount++;
          else if (rank === 'C') rankCCount++;
          else if (rank === 'D') rankDCount++;
        }
      });
    });

    return {
      classesWithCommentIssues,
      classesWithAttendanceAlerts,
      classesWithRescheduling,
      commentOkRate: totalCommentsExpected > 0 ? (okSlots / totalCommentsExpected) * 100 : 0,
      attendanceAlertRate: totalStudents > 0 ? (alertsCounts / totalStudents) * 100 : 0,
      reschedulingRate: totalSessions > 0 ? (totalRescheduledSessions / totalSessions) * 100 : 0,
      // Checkpoint stats
      cp1PassRate: cp1TotalStudents > 0 ? (cp1PassCount / cp1TotalStudents) * 100 : 0,
      cp2PassRate: cp2TotalStudents > 0 ? (cp2PassCount / cp2TotalStudents) * 100 : 0,
      demoPassRate: demoTotalStudents > 0 ? (demoPassCount / demoTotalStudents) * 100 : 0,
      cp1AverageScore: cp1TotalStudents > 0 ? cp1ScoreSum / cp1TotalStudents : 0,
      cp2AverageScore: cp2TotalStudents > 0 ? cp2ScoreSum / cp2TotalStudents : 0,
      demoAverageScore: demoTotalStudents > 0 ? demoScoreSum / demoTotalStudents : 0,
      classesWithCP1,
      classesWithCP2,
      classesWithDemo,
      cp1TotalStudents,
      cp2TotalStudents,
      demoTotalStudents,
      cp1PassCount,
      cp2PassCount,
      demoPassCount,
      // Rank stats
      rankACount,
      rankBCount,
      rankCCount,
      rankDCount,
      totalStudentsWithTBCK,
      // Demo quality stats
      demoGoodCount,
      demoMediumCount,
      demoPoorCount,
    };
  }, [normalClasses]);

  // Centre-level stats for summary analysis
  const centreStats = useMemo(() => {
    const map = new Map<string, {
      cp2Total: number; cp2Pass: number; cp2ScoreSum: number;
      demoTotal: number; demoGood: number; demoMedium: number; demoPoor: number; demoScoreSum: number;
      rankA: number; rankB: number; rankC: number; rankD: number; totalWithTBCK: number;
      reschedulingCount: number; reschedulingSessions: number; totalSessions: number;
      commentIssues: number; attendanceAlerts: number; totalClasses: number;
    }>();
    
    normalClasses.forEach(a => {
      const centreName = a.cls.centre?.shortName || 'Không rõ';
      if (!map.has(centreName)) {
        map.set(centreName, {
          cp2Total: 0, cp2Pass: 0, cp2ScoreSum: 0,
          demoTotal: 0, demoGood: 0, demoMedium: 0, demoPoor: 0, demoScoreSum: 0,
          rankA: 0, rankB: 0, rankC: 0, rankD: 0, totalWithTBCK: 0,
          reschedulingCount: 0, reschedulingSessions: 0, totalSessions: 0,
          commentIssues: 0, attendanceAlerts: 0, totalClasses: 0,
        });
      }
      const entry = map.get(centreName)!;
      
      // CP2
      if (a.cp2Analysis.hasSession && a.cp2Analysis.studentsWithScores > 0) {
        entry.cp2Total += a.cp2Analysis.studentsWithScores;
        entry.cp2Pass += a.cp2Analysis.passCount;
        if (a.cp2Analysis.averageScore !== null) {
          entry.cp2ScoreSum += a.cp2Analysis.averageScore * a.cp2Analysis.studentsWithScores;
        }
      }
      
      // Demo
      if (a.demoAnalysis.hasSession && a.demoAnalysis.studentsWithScores > 0) {
        entry.demoTotal += a.demoAnalysis.studentsWithScores;
        entry.demoGood += a.demoAnalysis.goodCount;
        entry.demoMedium += a.demoAnalysis.averageCount;
        entry.demoPoor += a.demoAnalysis.poorCount;
        if (a.demoAnalysis.averageScore !== null) {
          entry.demoScoreSum += a.demoAnalysis.averageScore * a.demoAnalysis.studentsWithScores;
        }
      }
      
      // Operations
      entry.totalClasses++;
      if (a.reschedulingAnalysis.rescheduledSessions > 0) entry.reschedulingCount++;
      entry.reschedulingSessions += a.reschedulingAnalysis.rescheduledSessions;
      entry.totalSessions += a.reschedulingAnalysis.totalSessions;
      
      const issues = a.commentAnalysis.emptyCount + a.commentAnalysis.briefCount + 
                     a.commentAnalysis.duplicateCount + a.commentAnalysis.overdueCount;
      if (issues > 0) entry.commentIssues++;
      
      if (a.attendanceAnalysis.totalAlerts > 0) entry.attendanceAlerts++;
      
      // Ranks
      const studentMap = new Map<string, { cp1?: number; cp2?: number; demo?: number }>();
      a.cp1Analysis.students.forEach((st: any) => {
        if (st.checkpointScore !== null) {
          const existing = studentMap.get(st.studentId) || {};
          studentMap.set(st.studentId, { ...existing, cp1: st.checkpointScore });
        }
      });
      a.cp2Analysis.students.forEach((st: any) => {
        if (st.checkpointScore !== null) {
          const existing = studentMap.get(st.studentId) || {};
          studentMap.set(st.studentId, { ...existing, cp2: st.checkpointScore });
        }
      });
      a.demoAnalysis.students.forEach((st: any) => {
        if (st.demoScore !== null) {
          const existing = studentMap.get(st.studentId) || {};
          studentMap.set(st.studentId, { ...existing, demo: st.demoScore });
        }
      });
      
      studentMap.forEach((scores) => {
        const tbck = computeTBCK(scores.cp1 ?? null, scores.cp2 ?? null, scores.demo ?? null);
        if (tbck !== null) {
          entry.totalWithTBCK++;
          const { rank } = determineRank(tbck, scores.demo ?? null);
          if (rank === 'A') entry.rankA++;
          else if (rank === 'B') entry.rankB++;
          else if (rank === 'C') entry.rankC++;
          else if (rank === 'D') entry.rankD++;
        }
      });
    });
    
    return Array.from(map.entries()).map(([name, data]) => ({
      name,
      cp2PassRate: data.cp2Total > 0 ? (data.cp2Pass / data.cp2Total) * 100 : 0,
      cp2AvgScore: data.cp2Total > 0 ? data.cp2ScoreSum / data.cp2Total : 0,
      cp2Total: data.cp2Total,
      cp2Pass: data.cp2Pass,
      demoGoodRate: data.demoTotal > 0 ? (data.demoGood / data.demoTotal) * 100 : 0,
      demoAvgScore: data.demoTotal > 0 ? data.demoScoreSum / data.demoTotal : 0,
      demoTotal: data.demoTotal,
      demoGood: data.demoGood,
      demoMedium: data.demoMedium,
      demoPoor: data.demoPoor,
      rankARate: data.totalWithTBCK > 0 ? (data.rankA / data.totalWithTBCK) * 100 : 0,
      rankA: data.rankA,
      rankB: data.rankB,
      rankC: data.rankC,
      rankD: data.rankD,
      totalWithTBCK: data.totalWithTBCK,
      reschedulingRate: data.totalSessions > 0 ? (data.reschedulingSessions / data.totalSessions) * 100 : 0,
      classesWithRescheduling: data.reschedulingCount,
      classesWithCommentIssues: data.commentIssues,
      classesWithAttendanceAlerts: data.attendanceAlerts,
      totalClasses: data.totalClasses,
    })).filter(c => c.cp2Total > 0 || c.demoTotal > 0).sort((a, b) => b.cp2Total - a.cp2Total);
  }, [normalClasses]);

  // Summary centre options
  const summaryCentreOptions = useMemo(() => {
    const options: Centre[] = [{ id: 'all', shortName: 'Tất cả', name: 'Tất cả cơ sở', isActive: true }];
    centreStats.forEach(c => {
      options.push({ id: c.name, shortName: c.name, name: c.name, isActive: true });
    });
    return options;
  }, [centreStats]);

  // Filter classes for summary by status
  const summaryFilteredClasses = useMemo(() => {
    // If no filter or both selected, return all
    if (summaryStatusFilter.length === 0 || summaryStatusFilter.length === 2) {
      return normalClasses;
    }
    // Filter by selected status
    return normalClasses.filter(a => 
      summaryStatusFilter.includes(a.cls.status?.toUpperCase() || '')
    );
  }, [normalClasses, summaryStatusFilter]);

  // Recalculate stats from filtered classes
  const summaryStats = useMemo(() => {
    const classesToUse = summaryFilteredClasses;
    
    // Recalculate all stats from filtered classes
    let cp1Total = 0, cp1Pass = 0, cp1Sum = 0;
    let cp2Total = 0, cp2Pass = 0, cp2Sum = 0;
    let demoTotal = 0, demoSum = 0, demoGood = 0, demoMedium = 0, demoPoor = 0;
    let rankA = 0, rankB = 0, rankC = 0, rankD = 0, totalWithTBCK = 0;
    let classesWithCommentIssues = 0, classesWithAttendanceAlerts = 0, classesWithRescheduling = 0;
    let totalRescheduledSessions = 0, totalSessions = 0;
    
    classesToUse.forEach(a => {
      // CP1
      if (a.cp1Analysis.studentsWithScores > 0) {
        cp1Total += a.cp1Analysis.studentsWithScores;
        cp1Pass += a.cp1Analysis.passCount;
        if (a.cp1Analysis.averageScore !== null) {
          cp1Sum += a.cp1Analysis.averageScore * a.cp1Analysis.studentsWithScores;
        }
      }
      
      // CP2
      if (a.cp2Analysis.studentsWithScores > 0) {
        cp2Total += a.cp2Analysis.studentsWithScores;
        cp2Pass += a.cp2Analysis.passCount;
        if (a.cp2Analysis.averageScore !== null) {
          cp2Sum += a.cp2Analysis.averageScore * a.cp2Analysis.studentsWithScores;
        }
      }
      
      // Demo
      if (a.demoAnalysis.studentsWithScores > 0) {
        demoTotal += a.demoAnalysis.studentsWithScores;
        if (a.demoAnalysis.averageScore !== null) {
          demoSum += a.demoAnalysis.averageScore * a.demoAnalysis.studentsWithScores;
        }
        demoGood += a.demoAnalysis.goodCount;
        demoMedium += a.demoAnalysis.averageCount; // Note: averageCount is the "medium" band
        demoPoor += a.demoAnalysis.poorCount;
        
        // TBCK & Rank - count from students array
        a.demoAnalysis.students.forEach((s: any) => {
          if (s.tbck !== undefined && s.tbck !== null) {
            totalWithTBCK++;
            if (s.rank === 'A') rankA++;
            else if (s.rank === 'B') rankB++;
            else if (s.rank === 'C') rankC++;
            else if (s.rank === 'D') rankD++;
          }
        });
      }
      
      // Operations
      const commentIssues = a.commentAnalysis.emptyCount + a.commentAnalysis.briefCount + a.commentAnalysis.duplicateCount + a.commentAnalysis.overdueCount;
      if (commentIssues > 0) classesWithCommentIssues++;
      if (a.attendanceAnalysis.totalAlerts > 0) classesWithAttendanceAlerts++;
      if (a.reschedulingAnalysis.rescheduledSessions > 0) classesWithRescheduling++;
      
      totalRescheduledSessions += a.reschedulingAnalysis.rescheduledSessions;
      totalSessions += a.reschedulingAnalysis.totalSessions;
    });
    
    return {
      cp1PassRate: cp1Total > 0 ? (cp1Pass / cp1Total) * 100 : 0,
      cp1AverageScore: cp1Total > 0 ? cp1Sum / cp1Total : 0,
      cp1TotalStudents: cp1Total,
      cp1PassCount: cp1Pass,
      cp2PassRate: cp2Total > 0 ? (cp2Pass / cp2Total) * 100 : 0,
      cp2AverageScore: cp2Total > 0 ? cp2Sum / cp2Total : 0,
      cp2TotalStudents: cp2Total,
      cp2PassCount: cp2Pass,
      demoPassRate: demoTotal > 0 ? ((demoGood + demoMedium) / demoTotal) * 100 : 0,
      demoAverageScore: demoTotal > 0 ? demoSum / demoTotal : 0,
      demoTotalStudents: demoTotal,
      demoGoodCount: demoGood,
      demoMediumCount: demoMedium,
      demoPoorCount: demoPoor,
      rankACount: rankA,
      rankBCount: rankB,
      rankCCount: rankC,
      rankDCount: rankD,
      totalStudentsWithTBCK: totalWithTBCK,
      reschedulingRate: totalSessions > 0 ? (totalRescheduledSessions / totalSessions) * 100 : 0,
      classesWithCommentIssues,
      classesWithAttendanceAlerts,
      classesWithRescheduling,
      totalClasses: classesToUse.length,
    };
  }, [summaryFilteredClasses]);

  // Get data for selected centre (using filtered classes)
  const selectedCentreData = useMemo(() => {
    if (selectedSummaryCentre === 'all') {
      return {
        name: 'Tất cả cơ sở',
        ...summaryStats,
      };
    }
    
    // Filter by centre and recalculate
    const centreClasses = summaryFilteredClasses.filter(a => 
      a.cls.centre?.shortName === selectedSummaryCentre
    );
    
    if (centreClasses.length === 0) {
      return {
        name: selectedSummaryCentre,
        cp1PassRate: 0, cp1AverageScore: 0, cp1TotalStudents: 0, cp1PassCount: 0,
        cp2PassRate: 0, cp2AverageScore: 0, cp2TotalStudents: 0, cp2PassCount: 0,
        demoPassRate: 0, demoAverageScore: 0, demoTotalStudents: 0,
        demoGoodCount: 0, demoMediumCount: 0, demoPoorCount: 0,
        rankACount: 0, rankBCount: 0, rankCCount: 0, rankDCount: 0, totalStudentsWithTBCK: 0,
        reschedulingRate: 0, classesWithCommentIssues: 0, classesWithAttendanceAlerts: 0,
        classesWithRescheduling: 0, totalClasses: 0,
      };
    }
    
    // Recalculate for this centre
    let cp1Total = 0, cp1Pass = 0, cp1Sum = 0;
    let cp2Total = 0, cp2Pass = 0, cp2Sum = 0;
    let demoTotal = 0, demoSum = 0, demoGood = 0, demoMedium = 0, demoPoor = 0;
    let rankA = 0, rankB = 0, rankC = 0, rankD = 0, totalWithTBCK = 0;
    let classesWithCommentIssues = 0, classesWithAttendanceAlerts = 0, classesWithRescheduling = 0;
    let totalRescheduledSessions = 0, totalSessions = 0;
    
    centreClasses.forEach(a => {
      if (a.cp1Analysis.studentsWithScores > 0) {
        cp1Total += a.cp1Analysis.studentsWithScores;
        cp1Pass += a.cp1Analysis.passCount;
        if (a.cp1Analysis.averageScore !== null) {
          cp1Sum += a.cp1Analysis.averageScore * a.cp1Analysis.studentsWithScores;
        }
      }
      if (a.cp2Analysis.studentsWithScores > 0) {
        cp2Total += a.cp2Analysis.studentsWithScores;
        cp2Pass += a.cp2Analysis.passCount;
        if (a.cp2Analysis.averageScore !== null) {
          cp2Sum += a.cp2Analysis.averageScore * a.cp2Analysis.studentsWithScores;
        }
      }
      if (a.demoAnalysis.studentsWithScores > 0) {
        demoTotal += a.demoAnalysis.studentsWithScores;
        if (a.demoAnalysis.averageScore !== null) {
          demoSum += a.demoAnalysis.averageScore * a.demoAnalysis.studentsWithScores;
        }
        demoGood += a.demoAnalysis.goodCount;
        demoMedium += a.demoAnalysis.averageCount;
        demoPoor += a.demoAnalysis.poorCount;
        
        a.demoAnalysis.students.forEach((s: any) => {
          if (s.tbck !== undefined && s.tbck !== null) {
            totalWithTBCK++;
            if (s.rank === 'A') rankA++;
            else if (s.rank === 'B') rankB++;
            else if (s.rank === 'C') rankC++;
            else if (s.rank === 'D') rankD++;
          }
        });
      }
      
      const commentIssues = a.commentAnalysis.emptyCount + a.commentAnalysis.briefCount + a.commentAnalysis.duplicateCount + a.commentAnalysis.overdueCount;
      if (commentIssues > 0) classesWithCommentIssues++;
      if (a.attendanceAnalysis.totalAlerts > 0) classesWithAttendanceAlerts++;
      if (a.reschedulingAnalysis.rescheduledSessions > 0) classesWithRescheduling++;
      totalRescheduledSessions += a.reschedulingAnalysis.rescheduledSessions;
      totalSessions += a.reschedulingAnalysis.totalSessions;
    });
    
    return {
      name: selectedSummaryCentre,
      cp1PassRate: cp1Total > 0 ? (cp1Pass / cp1Total) * 100 : 0,
      cp1AverageScore: cp1Total > 0 ? cp1Sum / cp1Total : 0,
      cp1TotalStudents: cp1Total,
      cp1PassCount: cp1Pass,
      cp2PassRate: cp2Total > 0 ? (cp2Pass / cp2Total) * 100 : 0,
      cp2AverageScore: cp2Total > 0 ? cp2Sum / cp2Total : 0,
      cp2TotalStudents: cp2Total,
      cp2PassCount: cp2Pass,
      demoPassRate: demoTotal > 0 ? ((demoGood + demoMedium) / demoTotal) * 100 : 0,
      demoAverageScore: demoTotal > 0 ? demoSum / demoTotal : 0,
      demoTotalStudents: demoTotal,
      demoGoodCount: demoGood,
      demoMediumCount: demoMedium,
      demoPoorCount: demoPoor,
      rankACount: rankA,
      rankBCount: rankB,
      rankCCount: rankC,
      rankDCount: rankD,
      totalStudentsWithTBCK: totalWithTBCK,
      reschedulingRate: totalSessions > 0 ? (totalRescheduledSessions / totalSessions) * 100 : 0,
      classesWithCommentIssues,
      classesWithAttendanceAlerts,
      classesWithRescheduling,
      totalClasses: centreClasses.length,
    };
  }, [selectedSummaryCentre, summaryFilteredClasses, summaryStats]);

  // Chart data: By Centre
  const centreChartData = useMemo(() => {
    const map = new Map<string, { commentIssues: number; attendanceAlerts: number; totalClasses: number }>();
    
    normalClasses.forEach(a => {
      const centreName = a.cls.centre?.shortName || 'Không rõ';
      if (!map.has(centreName)) {
        map.set(centreName, { commentIssues: 0, attendanceAlerts: 0, totalClasses: 0 });
      }
      const entry = map.get(centreName)!;
      entry.totalClasses++;
      
      const issues = a.commentAnalysis.emptyCount + a.commentAnalysis.briefCount + a.commentAnalysis.duplicateCount + a.commentAnalysis.overdueCount;
      if (issues > 0) entry.commentIssues++;
      if (a.attendanceAnalysis.totalAlerts > 0) entry.attendanceAlerts++;
    });

    return Array.from(map.entries())
      .map(([name, data]) => ({
        name,
        'Vi phạm Nhận xét': data.commentIssues,
        'Cảnh báo Chuyên cần': data.attendanceAlerts,
        _total: data.totalClasses
      }))
      .filter(d => d._total > 0)
      .sort((a, b) => b._total - a._total)
      .slice(0, 10);
  }, [normalClasses]);

  // Chart data: By Course Category
  const courseLineChartData = useMemo(() => {
    const map = new Map<string, { commentIssues: number; attendanceAlerts: number; totalClasses: number }>();
    
    normalClasses.forEach(a => {
      const category = getCourseCategory(a.cls);
      if (!map.has(category)) {
        map.set(category, { commentIssues: 0, attendanceAlerts: 0, totalClasses: 0 });
      }
      const entry = map.get(category)!;
      entry.totalClasses++;
      
      const issues = a.commentAnalysis.emptyCount + a.commentAnalysis.briefCount + a.commentAnalysis.duplicateCount + a.commentAnalysis.overdueCount;
      if (issues > 0) entry.commentIssues++;
      if (a.attendanceAnalysis.totalAlerts > 0) entry.attendanceAlerts++;
    });

    return Array.from(map.entries())
      .map(([name, data]) => ({
        name,
        'Vi phạm Nhận xét': data.commentIssues,
        'Cảnh báo Chuyên cần': data.attendanceAlerts,
        _total: data.totalClasses
      }))
      .filter(d => d._total > 0)
      .sort((a, b) => b._total - a._total);
  }, [normalClasses]);

  const handleToggleExemptSession = (session: number) => {
    if (exemptedSessions.includes(session)) {
      setExemptedSessions(exemptedSessions.filter(s => s !== session));
    } else {
      setExemptedSessions([...exemptedSessions, session].sort((a, b) => a - b));
    }
  };
  
  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };
  
  const handleAddHolidayPeriod = () => {
    if (!newHolidayName.trim()) {
      addToast('Vui lòng nhập tên dịp', 'error');
      return;
    }
    if (!newHolidayFrom || !newHolidayTo) {
      addToast('Vui lòng chọn ngày bắt đầu và kết thúc', 'error');
      return;
    }
    if (new Date(newHolidayFrom) > new Date(newHolidayTo)) {
      addToast('Ngày bắt đầu phải trước ngày kết thúc', 'error');
      return;
    }
    setHolidayPeriods([...holidayPeriods, { name: newHolidayName.trim(), from: newHolidayFrom, to: newHolidayTo }]);
    setNewHolidayName('');
    setNewHolidayFrom('');
    setNewHolidayTo('');
    setShowHolidayForm(false);
    addToast('Đã thêm khoảng thời gian nghỉ', 'success');
  };
  
  const handleRemoveHolidayPeriod = (index: number) => {
    setHolidayPeriods(holidayPeriods.filter((_, i) => i !== index));
    addToast('Đã xoá khoảng thời gian nghỉ', 'success');
  };
  
  // Check if a class should be exempt from rescheduling analysis
  const isClassExemptFromRescheduling = (cls: Class): boolean => {
    // Check if it's a 1:1 class
    if (exemptOneOnOneClasses && cls.name.includes('(1:1)')) {
      return true;
    }
    return false;
  };
  
  // Check if a date falls within holiday periods
  const isDateInHolidayPeriod = (date: string): boolean => {
    const checkDate = new Date(date);
    return holidayPeriods.some(period => {
      const from = new Date(period.from);
      const to = new Date(period.to);
      return checkDate >= from && checkDate <= to;
    });
  };

  if (authLoading) return null;

  return (
    <>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <PageLayout
        title="Chất lượng Lớp học"
        activePage="class-quality"
        sidebarOpen={sidebarOpen}
        onSidebarToggle={setSidebarOpen}
      >
        <Toolbar
          centres={centres}
          selectedCentres={selectedCentres}
          onCentresChange={setSelectedCentres} centresLoading={centresLoading}
          dateFrom={dateFrom} dateTo={dateTo}
          onDateFromChange={setDateFrom} onDateToChange={setDateTo}
          onFetch={handleFetch} onCancel={handleCancelFetch}
          loading={loading} progress={progress}
          hasData={classes.length > 0} onClearCache={handleClearCache}
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

          <div className={styles.dashboardLayout}>

            <div>
              {(analyzedClasses.length > 0 || loading) && (
                <motion.div id="section-stats" className={styles.statsGrid} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <StatCard label="NHẬN XÉT HỢP LỆ" value={`${stats.commentOkRate.toFixed(1)}%`} desc="Trên tổng số buổi đã học" valueColor={stats.commentOkRate >= 90 ? 'var(--status-success)' : (stats.commentOkRate >= 70 ? 'var(--status-warning)' : 'var(--status-error)')} delay={0.0} />
                  <StatCard label="VI PHẠM NHẬN XÉT" value={String(stats.classesWithCommentIssues)} desc={`Số lớp có nhận xét ${COMMENT_STATUS_COUNT_LABELS.brief} / ${COMMENT_STATUS_COUNT_LABELS.empty}`} delay={0.07} />
                  <StatCard label="CẢNH BÁO CHUYÊN CẦN" value={`${stats.attendanceAlertRate.toFixed(1)}%`} desc="Tỉ lệ học viên có cảnh báo" valueColor={stats.attendanceAlertRate <= 5 ? 'var(--status-success)' : 'var(--status-error)'} delay={0.14} />
                  <StatCard label="LỚP BÁO ĐỘNG" value={String(stats.classesWithAttendanceAlerts)} desc="Số lớp có học viên vi phạm chuyên cần" delay={0.21} />
                  <StatCard label="BUỔI HỌC BỊ DỜI" value={`${stats.reschedulingRate.toFixed(1)}%`} desc="Tỉ lệ buổi học bị thay đổi lịch" valueColor={stats.reschedulingRate <= 10 ? 'var(--status-success)' : (stats.reschedulingRate <= 20 ? 'var(--status-warning)' : 'var(--status-error)')} delay={0.28} />
                  <StatCard label="LỚP THAY ĐỔI LỊCH" value={String(stats.classesWithRescheduling)} desc="Số lớp có buổi học bị dời" delay={0.35} />
                  <StatCard label="CP1 ĐẠT (BUỔI 5)" value={`${stats.cp1PassRate.toFixed(1)}%`} desc={`${stats.cp1TotalStudents} học viên • Điểm TB: ${stats.cp1AverageScore.toFixed(1)}`} valueColor={stats.cp1PassRate >= 85 ? 'var(--status-success)' : (stats.cp1PassRate >= 70 ? 'var(--status-warning)' : 'var(--status-error)')} delay={0.42} />
                  <StatCard label="CP2 ĐẠT (BUỔI 9)" value={`${stats.cp2PassRate.toFixed(1)}%`} desc={`${stats.cp2TotalStudents} học viên • Điểm TB: ${stats.cp2AverageScore.toFixed(1)}`} valueColor={stats.cp2PassRate >= 85 ? 'var(--status-success)' : (stats.cp2PassRate >= 70 ? 'var(--status-warning)' : 'var(--status-error)')} delay={0.49} />
                  <StatCard label="DEMO ĐẠT (BUỔI 14)" value={`${stats.demoPassRate.toFixed(1)}%`} desc={`${stats.demoTotalStudents} học viên • Điểm TB: ${stats.demoAverageScore.toFixed(1)}`} valueColor={stats.demoPassRate >= 85 ? 'var(--status-success)' : (stats.demoPassRate >= 70 ? 'var(--status-warning)' : 'var(--status-error)')} delay={0.56} />
                </motion.div>
              )}

              {/* Summary Analysis Section */}
              {analyzedClasses.length > 0 && (stats.cp2TotalStudents > 0 || stats.demoTotalStudents > 0) && (
                <div>
                  {/* Filters above the panel */}
                  <div style={{ marginBottom: 'var(--space-3)', display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                    <CentreSelect
                      centres={summaryCentreOptions}
                      selected={selectedSummaryCentre ? [selectedSummaryCentre] : []}
                      onChange={(selected) => setSelectedSummaryCentre(selected[0] || '')}
                      placeholder="Chọn cơ sở"
                      searchable={false}
                      maxDisplay={1}
                      filterToIds={summaryCentreOptions.map(c => c.id)}
                    />
                    <MultiSelect
                      options={[
                        { value: 'RUNNING', label: 'Đang học' },
                        { value: 'FINISHED', label: 'Đã kết thúc' }
                      ]}
                      selected={summaryStatusFilter}
                      onChange={setSummaryStatusFilter}
                      placeholder="Trạng thái"
                      maxDisplay={2}
                    />
                  </div>
                  
                  <div className={styles.tableSection} id="section-summary">
                  <TableGroupHeader
                    title="Tóm tắt Phân tích Chất lượng"
                    count={selectedCentreData?.totalClasses || 0}
                    isExpanded={showSummarySection}
                    onToggle={() => setShowSummarySection(!showSummarySection)}
                  />
                  <AnimatePresence initial={false}>
                    {showSummarySection && selectedCentreData && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }} 
                        animate={{ height: 'auto', opacity: 1 }} 
                        exit={{ height: 0, opacity: 0 }} 
                        style={{ overflow: 'hidden' }}
                      >
                        <div style={{ padding: 'var(--space-4)', display: 'grid', gap: 'var(--space-4)' }}>
                          {(selectedCentreData.cp1TotalStudents > 0 || selectedCentreData.cp2TotalStudents > 0) && (
                            <div className={styles.summaryBlock}>
                              <div className={styles.summaryBlockHeader}>
                                <div className={styles.summaryBlockTitle}>
                                  <Icon.ClipboardCheck size={16} /> Điểm Checkpoint (CP1 & CP2)
                                </div>
                                <CopyButton content={generateCheckpointContent(selectedCentreData)} label="Checkpoint" />
                              </div>
                              <div className={styles.summaryBlockContent}>
                                {generateCheckpointContent(selectedCentreData).split('\n').map((line, i) => {
                                  if (line.includes('**') || line.includes('*')) {
                                    const parts: (string | React.ReactElement)[] = [];
                                    let key = 0;
                                    const boldParts = line.split('**');
                                    boldParts.forEach((part, j) => {
                                      if (j % 2 === 1) {
                                        parts.push(<strong key={`b${key++}`}>{part}</strong>);
                                      } else if (part.includes('*')) {
                                        const italicParts = part.split('*');
                                        italicParts.forEach((iPart, k) => {
                                          if (k % 2 === 1) {
                                            parts.push(<em key={`i${key++}`} style={{ color: 'var(--text-tertiary)', fontSize: '12px' }}>{iPart}</em>);
                                          } else if (iPart) {
                                            parts.push(iPart);
                                          }
                                        });
                                      } else if (part) {
                                        parts.push(part);
                                      }
                                    });
                                    return <div key={i}>{parts}</div>;
                                  }
                                  return <div key={i}>{line || '\u00A0'}</div>;
                                })}
                              </div>
                            </div>
                          )}
                          <div className={styles.summaryBlock}>
                            <div className={styles.summaryBlockHeader}>
                              <div className={styles.summaryBlockTitle}>
                                <Icon.Target size={16} /> Tiêu chí Cuối khoá (Demo & Xếp loại TBCK)
                              </div>
                              <CopyButton content={generateDemoContent(selectedCentreData)} label="Demo" />
                            </div>
                            <div className={styles.summaryBlockContent}>
                              {generateDemoContent(selectedCentreData).split('\n').map((line, i) => {
                                if (line.includes('**') || line.includes('*')) {
                                  const parts: (string | React.ReactElement)[] = [];
                                  let key = 0;
                                  const boldParts = line.split('**');
                                  boldParts.forEach((part, j) => {
                                    if (j % 2 === 1) {
                                      parts.push(<strong key={`b${key++}`}>{part}</strong>);
                                    } else if (part.includes('*')) {
                                      const italicParts = part.split('*');
                                      italicParts.forEach((iPart, k) => {
                                        if (k % 2 === 1) {
                                          parts.push(<em key={`i${key++}`} style={{ color: 'var(--text-tertiary)', fontSize: '12px' }}>{iPart}</em>);
                                        } else if (iPart) {
                                          parts.push(iPart);
                                        }
                                      });
                                    } else if (part) {
                                      parts.push(part);
                                    }
                                  });
                                  return <div key={i}>{parts}</div>;
                                }
                                return <div key={i}>{line || '\u00A0'}</div>;
                              })}
                            </div>
                          </div>
                          <div className={styles.summaryBlock}>
                            <div className={styles.summaryBlockHeader}>
                              <div className={styles.summaryBlockTitle}>
                                <Icon.Settings size={16} /> Tiêu chí Vận hành (Ổn định & Rủi ro)
                              </div>
                              <CopyButton content={generateOperationsContent(selectedCentreData)} label="Operations" />
                            </div>
                            <div className={styles.summaryBlockContent}>
                              {generateOperationsContent(selectedCentreData).split('\n').map((line, i) => {
                                if (line.includes('**') || line.includes('*')) {
                                  const parts: (string | React.ReactElement)[] = [];
                                  let key = 0;
                                  const boldParts = line.split('**');
                                  boldParts.forEach((part, j) => {
                                    if (j % 2 === 1) {
                                      parts.push(<strong key={`b${key++}`}>{part}</strong>);
                                    } else if (part.includes('*')) {
                                      const italicParts = part.split('*');
                                      italicParts.forEach((iPart, k) => {
                                        if (k % 2 === 1) {
                                          parts.push(<em key={`i${key++}`} style={{ color: 'var(--text-tertiary)', fontSize: '12px' }}>{iPart}</em>);
                                        } else if (iPart) {
                                          parts.push(iPart);
                                        }
                                      });
                                    } else if (part) {
                                      parts.push(part);
                                    }
                                  });
                                  return <div key={i}>{parts}</div>;
                                }
                                return <div key={i}>{line || '\u00A0'}</div>;
                              })}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                </div>
              )}

          {/* CHARTS */}
          {analyzedClasses.length > 1 && (centreChartData.length > 0 || courseLineChartData.length > 0) && (
            <div id="section-charts" className={styles.chartsSection} style={{ marginTop: 'var(--space-6)' }}>
              <ChartSectionHeader
                title="Biểu Đồ Phân Tích"
              />
              <div className={styles.chartsGrid}>
                
                {/* Chart: By Centre - Grouped Bar */}
                {centreChartData.length > 0 && (
                  <div className={styles.chartCard}>
                    <div className={styles.chartTitle}>Theo Cơ Sở - Vi Phạm Nhận Xét & Cảnh Báo Chuyên Cần</div>
                    <div style={{ flex: 1, minHeight: 0 }}>
                      <ResponsiveContainer width="100%" height={Math.max(240, centreChartData.length * 36)}>
                        <BarChart data={centreChartData} {...VerticalBarChartConfig} barGap={2}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" horizontal={false} />
                          <StandardXAxis label="Số lớp" />
                          <StandardYAxisCategory dataKey="name" label="Cơ sở" />
                          <ReTooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
                          <Bar dataKey="Vi phạm Nhận xét" fill={CHART_COLORS.SECONDARY[2]} radius={[0, 4, 4, 0]} />
                          <Bar dataKey="Cảnh báo Chuyên cần" fill={CHART_COLORS.SECONDARY[3]} radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <ChartLegend items={[
                      { color: 'var(--status-warning)', label: 'Vi phạm Nhận xét' },
                      { color: 'var(--status-error)', label: 'Cảnh báo Chuyên cần' },
                    ]} />
                  </div>
                )}

                {/* Chart: By Course Category - Grouped Bar */}
                {courseLineChartData.length > 0 && (
                  <div className={styles.chartCard}>
                    <div className={styles.chartTitle}>Theo Khối - Vi Phạm Nhận Xét & Cảnh Báo Chuyên Cần</div>
                    <div style={{ flex: 1, minHeight: 0 }}>
                      <ResponsiveContainer width="100%" height={Math.max(240, courseLineChartData.length * 44)}>
                        <BarChart data={courseLineChartData} {...VerticalBarChartConfig} barGap={2}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" horizontal={false} />
                          <StandardXAxis label="Số lớp" />
                          <StandardYAxisCategory dataKey="name" label="Khối học" />
                          <ReTooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
                          <Bar dataKey="Vi phạm Nhận xét" fill={CHART_COLORS.SECONDARY[2]} radius={[0, 4, 4, 0]} />
                          <Bar dataKey="Cảnh báo Chuyên cần" fill={CHART_COLORS.SECONDARY[3]} radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <ChartLegend items={[
                      { color: 'var(--status-warning)', label: 'Vi phạm Nhận xét' },
                      { color: 'var(--status-error)', label: 'Cảnh báo Chuyên cần' },
                    ]} />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Section 1: Comment Status */}
          {(analyzedClasses.length > 0 || loading) && (
            <>
              <TableToolbar
                search={searchC} onSearchChange={setSearchC}
                searchPlaceholder="Tìm lớp học, cơ sở..."
                quickFilterSlots={
                  <>
                    {/* User preference chips */}
                    {hasPreferences && (
                      <QuickFilterChips
                        centres={centres}
                        selectedCentres={selectedCentreIdsC}
                        onCentresChange={setSelectedCentreIdsC}
                        selectedCourses={selectedCourseLinesC}
                        onCoursesChange={setSelectedCourseLinesC}
                        showCentres={true}
                        showCourses={true}
                      />
                    )}
                    <button className={`${styles.filterChip} ${quickFilterC === 'commentIssues' ? styles.chipActive : ''}`} onClick={() => setQuickFilterC(q => q === 'commentIssues' ? null : 'commentIssues')}>
                      <Icon.AlertTriangle size={12} /> Vi phạm nhận xét
                      {quickFilterC === 'commentIssues' && filteredCommentClasses.filter(c => (c.commentAnalysis.emptyCount + c.commentAnalysis.briefCount + c.commentAnalysis.duplicateCount + c.commentAnalysis.overdueCount) > 0).length > 0 && (
                        <span className={styles.chipBadge}>{filteredCommentClasses.filter(c => (c.commentAnalysis.emptyCount + c.commentAnalysis.briefCount + c.commentAnalysis.duplicateCount + c.commentAnalysis.overdueCount) > 0).length}</span>
                      )}
                    </button>
                  </>
                }
                filterSlots={
                  <>
                    {/* 1. Centre */}
                    {tableCentreIds.length > 1 && <CentreSelect centres={centres} selected={selectedCentreIdsC} onChange={setSelectedCentreIdsC} filterToIds={tableCentreIds} placeholder="Tất cả cơ sở" maxDisplay={1} searchable />}
                    {/* 2. Course Line */}
                    <MultiSelect options={courseLineOptions} selected={selectedCourseLinesC} onChange={setSelectedCourseLinesC} placeholder="Tất cả khối" maxDisplay={2} />
                    {/* 3. Status */}
                    {statusOptions.length > 1 && <MultiSelect options={statusOptions} selected={selectedStatusesC} onChange={setSelectedStatusesC} placeholder="Tất cả trạng thái" />}
                    {/* 4. Specific: Level */}
                    {levelOptions.length > 1 && <MultiSelect options={levelOptions} selected={selectedLevelsC} onChange={setSelectedLevelsC} placeholder="Tất cả cấp độ" />}
                  </>
                }
                hasFilter={hasTableFilterC} onClearFilter={clearTableFiltersC}
              />
              
              <div className={styles.tableSection} id="section-comments">
                <TableGroupHeader
                  title="Tình trạng Nhận xét Giáo viên"
                  count={filteredCommentClasses.length}
                  isExpanded={showCommentTable} onToggle={() => setShowCommentTable(!showCommentTable)}
                  actionSlot={
                    <ExportButton
                      onClick={handleExportCommentCSV}
                      onSettingsClick={() => setShowCommentCSVSettings(true)}
                      disabled={filteredCommentClasses.length === 0}
                      count={filteredCommentClasses.length}
                    />
                  }
                />
                <AnimatePresence initial={false}>
                  {showCommentTable && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                      <div className={styles.tableScrollWrapper}>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'minmax(0,2fr) minmax(0,1.2fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)',
                        padding: '7px 16px', minWidth: 900,
                        borderBottom: '1px solid var(--border-primary)',
                        fontSize: 11, fontWeight: 590, color: 'var(--text-quaternary)',
                        textTransform: 'uppercase', background: 'var(--bg-elevated)',
                      }}>
                        <div className={`${styles.sortableCol} ${sortKeyC === 'name' ? styles.activeSort : ''}`} onClick={() => handleSortC('name')} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>Lớp học <SortIcon col="name" sortKey={sortKeyC} sortDir={sortDirC} /></div>
                        <div className={`${styles.sortableCol} ${sortKeyC === 'teacher' ? styles.activeSort : ''}`} onClick={() => handleSortC('teacher')} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>Giáo viên <SortIcon col="teacher" sortKey={sortKeyC} sortDir={sortDirC} /></div>
                        <div className={`${styles.sortableCol} ${sortKeyC === 'progress' ? styles.activeSort : ''}`} onClick={() => handleSortC('progress')} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>Tiến độ <SortIcon col="progress" sortKey={sortKeyC} sortDir={sortDirC} /></div>
                        <div className={`${styles.sortableCol} ${sortKeyC === 'brief' ? styles.activeSort : ''}`} onClick={() => handleSortC('brief')} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>{COMMENT_STATUS_GROUP_LABELS.brief} <SortIcon col="brief" sortKey={sortKeyC} sortDir={sortDirC} /></div>
                        <div className={`${styles.sortableCol} ${sortKeyC === 'empty' ? styles.activeSort : ''}`} onClick={() => handleSortC('empty')} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>{COMMENT_STATUS_GROUP_LABELS.emptyOrOverdue} <SortIcon col="empty" sortKey={sortKeyC} sortDir={sortDirC} /></div>
                        <div className={`${styles.sortableCol} ${sortKeyC === 'duplicate' ? styles.activeSort : ''}`} onClick={() => handleSortC('duplicate')} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>{COMMENT_STATUS_GROUP_LABELS.duplicate} <SortIcon col="duplicate" sortKey={sortKeyC} sortDir={sortDirC} /></div>
                        <div className={`${styles.sortableCol} ${sortKeyC === 'commentIssues' ? styles.activeSort : ''}`} onClick={() => handleSortC('commentIssues')} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>Tổng Vi phạm <SortIcon col="commentIssues" sortKey={sortKeyC} sortDir={sortDirC} /></div>
                      </div>

                      {filteredCommentClasses.map(a => {
                        const issues = a.commentAnalysis.emptyCount + a.commentAnalysis.briefCount + a.commentAnalysis.duplicateCount + a.commentAnalysis.overdueCount;
                        const teacherName = getPrimaryTeacher(a.cls);
                        return (
                          <div key={a.cls.id} style={{
                            display: 'grid',
                            gridTemplateColumns: 'minmax(0,2fr) minmax(0,1.2fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)',
                            padding: '12px 16px', minWidth: 900,
                            borderBottom: '1px solid var(--border-primary)',
                            alignItems: 'center', cursor: 'pointer',
                            background: 'var(--bg-surface)'
	                          }} onClick={() => { setSelectedClassForComment(a); setCommentModalSessionIndex(null); }}>
                            <div>
                               <div style={{ fontWeight: 590, color: 'var(--text-primary)' }}>{a.cls.name}</div>
                               <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{a.cls.centre?.shortName}</div>
                            </div>
                            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{teacherName}</div>
                            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{a.commentAnalysis.passedSlots} / {a.commentAnalysis.totalSlots}</div>
                            <div style={{ fontSize: 13, color: a.commentAnalysis.briefCount > 0 ? 'var(--status-warning)' : 'var(--text-secondary)' }}>{a.commentAnalysis.briefCount}</div>
                            <div style={{ fontSize: 13, color: (a.commentAnalysis.emptyCount + a.commentAnalysis.overdueCount) > 0 ? 'var(--status-error)' : 'var(--text-secondary)' }}>{a.commentAnalysis.emptyCount + a.commentAnalysis.overdueCount}</div>
                            <div style={{ fontSize: 13, color: a.commentAnalysis.duplicateCount > 0 ? 'var(--status-orange)' : 'var(--text-secondary)' }}>{a.commentAnalysis.duplicateCount}</div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: issues > 0 ? 'var(--status-error)' : 'var(--status-success)' }}>{issues}</div>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              </div>
            </>
          )}

          {/* Section 2: Attendance Status */}
          {(analyzedClasses.length > 0 || loading) && (
            <div style={{ marginTop: 'var(--space-4)' }}>
              <TableToolbar
                search={searchA} onSearchChange={setSearchA}
                searchPlaceholder="Tìm lớp học, cơ sở..."
                quickFilterSlots={
                  <>
                    {/* User preference chips */}
                    {hasPreferences && (
                      <QuickFilterChips
                        centres={centres}
                        selectedCentres={selectedCentreIdsA}
                        onCentresChange={setSelectedCentreIdsA}
                        selectedCourses={selectedCourseLinesA}
                        onCoursesChange={setSelectedCourseLinesA}
                        showCentres={true}
                        showCourses={true}
                      />
                    )}
                    <button className={`${styles.filterChip} ${quickFilterA === 'attendanceAlerts' ? styles.chipActive : ''}`} onClick={() => setQuickFilterA(q => q === 'attendanceAlerts' ? null : 'attendanceAlerts')}>
                      <Icon.Bell size={12} /> Báo động vắng mặt
                      {quickFilterA === 'attendanceAlerts' && filteredAttendanceClasses.filter(c => c.attendanceAnalysis.totalAlerts > 0).length > 0 && (
                        <span className={styles.chipBadge}>{filteredAttendanceClasses.filter(c => c.attendanceAnalysis.totalAlerts > 0).length}</span>
                      )}
                    </button>
                  </>
                }
                filterSlots={
                  <>
                    {/* 1. Centre */}
                    {tableCentreIds.length > 1 && <CentreSelect centres={centres} selected={selectedCentreIdsA} onChange={setSelectedCentreIdsA} filterToIds={tableCentreIds} placeholder="Tất cả cơ sở" maxDisplay={1} searchable />}
                    {/* 2. Course Line */}
                    <MultiSelect options={courseLineOptions} selected={selectedCourseLinesA} onChange={setSelectedCourseLinesA} placeholder="Tất cả khối" maxDisplay={2} />
                    {/* 3. Status */}
                    {statusOptions.length > 1 && <MultiSelect options={statusOptions} selected={selectedStatusesA} onChange={setSelectedStatusesA} placeholder="Tất cả trạng thái" />}
                    {/* 4. Specific: Level */}
                    {levelOptions.length > 1 && <MultiSelect options={levelOptions} selected={selectedLevelsA} onChange={setSelectedLevelsA} placeholder="Tất cả cấp độ" />}
                  </>
                }
                hasFilter={hasTableFilterA} onClearFilter={clearTableFiltersA}
              />
              
              <div className={styles.tableSection} id="section-attendance">
                <TableGroupHeader
                  title="Tình trạng Chuyên cần học viên"
                  count={filteredAttendanceClasses.length}
                  isExpanded={showAttendanceTable} onToggle={() => setShowAttendanceTable(!showAttendanceTable)}
                  actionSlot={
                    <ExportButton
                      onClick={handleExportAttendanceCSV}
                      onSettingsClick={() => setShowAttendanceCSVSettings(true)}
                      disabled={filteredAttendanceClasses.length === 0}
                      count={filteredAttendanceClasses.length}
                    />
                  }
                />
              <AnimatePresence initial={false}>
                {showAttendanceTable && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                    <div className={styles.tableScrollWrapper}>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'minmax(0,2fr) minmax(0,1.2fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)',
                        padding: '7px 16px', minWidth: 900,
                        borderBottom: '1px solid var(--border-primary)',
                        fontSize: 11, fontWeight: 590, color: 'var(--text-quaternary)',
                        textTransform: 'uppercase', background: 'var(--bg-elevated)',
                      }}>
                        <div className={`${styles.sortableCol} ${sortKeyA === 'name' ? styles.activeSort : ''}`} onClick={() => handleSortA('name')} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>Lớp học <SortIcon col="name" sortKey={sortKeyA} sortDir={sortDirA} /></div>
                        <div className={`${styles.sortableCol} ${sortKeyA === 'teacher' ? styles.activeSort : ''}`} onClick={() => handleSortA('teacher')} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>Giáo viên <SortIcon col="teacher" sortKey={sortKeyA} sortDir={sortDirA} /></div>
                        <div className={`${styles.sortableCol} ${sortKeyA === 'totalStudents' ? styles.activeSort : ''}`} onClick={() => handleSortA('totalStudents')} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>Tổng học viên <SortIcon col="totalStudents" sortKey={sortKeyA} sortDir={sortDirA} /></div>
                        <div className={`${styles.sortableCol} ${sortKeyA === 'frequent' ? styles.activeSort : ''}`} onClick={() => handleSortA('frequent')} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>{ATTENDANCE_ALERT_LABELS.frequent_absent} <SortIcon col="frequent" sortKey={sortKeyA} sortDir={sortDirA} /></div>
                        <div className={`${styles.sortableCol} ${sortKeyA === 'consecutive' ? styles.activeSort : ''}`} onClick={() => handleSortA('consecutive')} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>{ATTENDANCE_ALERT_LABELS.consecutive_absent} (2+) <SortIcon col="consecutive" sortKey={sortKeyA} sortDir={sortDirA} /></div>
                        <div className={`${styles.sortableCol} ${sortKeyA === 'lateStage' ? styles.activeSort : ''}`} onClick={() => handleSortA('lateStage')} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>{ATTENDANCE_ALERT_LABELS.late_stage_absent} (Buổi 10+) <SortIcon col="lateStage" sortKey={sortKeyA} sortDir={sortDirA} /></div>
                        <div className={`${styles.sortableCol} ${sortKeyA === 'attendanceAlerts' ? styles.activeSort : ''}`} onClick={() => handleSortA('attendanceAlerts')} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>Tổng Cảnh báo <SortIcon col="attendanceAlerts" sortKey={sortKeyA} sortDir={sortDirA} /></div>
                      </div>

                      {filteredAttendanceClasses.map(a => {
                        let freq = 0, cons = 0, late = 0;
                        a.attendanceAnalysis.studentsWithAlerts.forEach(st => {
                           if (st.alerts.includes('frequent_absent')) freq++;
                           if (st.alerts.includes('consecutive_absent')) cons++;
                           if (st.alerts.includes('late_stage_absent')) late++;
                        });
                        const teacherName = getPrimaryTeacher(a.cls);

                        return (
                          <div key={a.cls.id} style={{
                            display: 'grid',
                            gridTemplateColumns: 'minmax(0,2fr) minmax(0,1.2fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)',
                            padding: '12px 16px', minWidth: 900,
                            borderBottom: '1px solid var(--border-primary)',
                            alignItems: 'center', cursor: 'pointer',
                            background: 'var(--bg-surface)'
                          }} onClick={() => setSelectedClassForAttendance(a)}>
                            <div>
                               <div style={{ fontWeight: 590, color: 'var(--text-primary)' }}>{a.cls.name}</div>
                               <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{a.cls.centre?.shortName}</div>
                            </div>
                            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{teacherName}</div>
                            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{a.attendanceAnalysis.totalStudents}</div>
                            <div style={{ fontSize: 13, color: freq > 0 ? 'var(--status-warning)' : 'var(--text-secondary)' }}>{freq} học viên</div>
                            <div style={{ fontSize: 13, color: cons > 0 ? 'var(--status-orange)' : 'var(--text-secondary)' }}>{cons} học viên</div>
                            <div style={{ fontSize: 13, color: late > 0 ? 'var(--status-error)' : 'var(--text-secondary)' }}>{late} học viên</div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: a.attendanceAnalysis.totalAlerts > 0 ? 'var(--status-error)' : 'var(--status-success)' }}>{a.attendanceAnalysis.totalAlerts}</div>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              </div>
            </div>
          )}

          {/* Section 3: Session Rescheduling */}
          {(analyzedClasses.length > 0 || loading) && (
            <div style={{ marginTop: 'var(--space-4)' }}>
              <TableToolbar
                search={searchR} onSearchChange={setSearchR}
                searchPlaceholder="Tìm lớp học, cơ sở..."
                quickFilterSlots={
                  <>
                    {/* User preference chips */}
                    {hasPreferences && (
                      <QuickFilterChips
                        centres={centres}
                        selectedCentres={selectedCentreIdsR}
                        onCentresChange={setSelectedCentreIdsR}
                        selectedCourses={selectedCourseLinesR}
                        onCoursesChange={setSelectedCourseLinesR}
                        showCentres={true}
                        showCourses={true}
                      />
                    )}
                    <button className={`${styles.filterChip} ${quickFilterR === 'hasRescheduling' ? styles.chipActive : ''}`} onClick={() => setQuickFilterR(q => q === 'hasRescheduling' ? null : 'hasRescheduling')}>
                      <Icon.Clock size={12} /> Có thay đổi lịch
                      {quickFilterR === 'hasRescheduling' && filteredReschedulingClasses.filter(c => c.reschedulingAnalysis.rescheduledSessions > 0).length > 0 && (
                        <span className={styles.chipBadge}>{filteredReschedulingClasses.filter(c => c.reschedulingAnalysis.rescheduledSessions > 0).length}</span>
                      )}
                    </button>
                  </>
                }
                filterSlots={
                  <>
                    {/* 1. Centre */}
                    {tableCentreIds.length > 1 && <CentreSelect centres={centres} selected={selectedCentreIdsR} onChange={setSelectedCentreIdsR} filterToIds={tableCentreIds} placeholder="Tất cả cơ sở" maxDisplay={1} searchable />}
                    {/* 2. Course Line */}
                    <MultiSelect options={courseLineOptions} selected={selectedCourseLinesR} onChange={setSelectedCourseLinesR} placeholder="Tất cả khối" maxDisplay={2} />
                    {/* 3. Status */}
                    {statusOptions.length > 1 && <MultiSelect options={statusOptions} selected={selectedStatusesR} onChange={setSelectedStatusesR} placeholder="Tất cả trạng thái" />}
                    {/* 4. Specific: Level */}
                    {levelOptions.length > 1 && <MultiSelect options={levelOptions} selected={selectedLevelsR} onChange={setSelectedLevelsR} placeholder="Tất cả cấp độ" />}
                  </>
                }
                hasFilter={hasTableFilterR} onClearFilter={clearTableFiltersR}
              />
              
              <div className={styles.tableSection} id="section-rescheduling">
                <TableGroupHeader
                  title="Tình trạng Thay đổi lịch học"
                  count={filteredReschedulingClasses.length}
                  isExpanded={showReschedulingTable} onToggle={() => setShowReschedulingTable(!showReschedulingTable)}
                  actionSlot={
                    <ExportButton
                      onClick={handleExportReschedulingCSV}
                      onSettingsClick={() => setShowReschedulingCSVSettings(true)}
                      disabled={filteredReschedulingClasses.length === 0}
                      count={filteredReschedulingClasses.length}
                    />
                  }
                />
              <AnimatePresence initial={false}>
                {showReschedulingTable && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                    <div className={styles.tableScrollWrapper}>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'minmax(0,2fr) minmax(0,1.2fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)',
                        padding: '7px 16px', minWidth: 900,
                        borderBottom: '1px solid var(--border-primary)',
                        fontSize: 11, fontWeight: 590, color: 'var(--text-quaternary)',
                        textTransform: 'uppercase', background: 'var(--bg-elevated)',
                      }}>
                        <div className={`${styles.sortableCol} ${sortKeyR === 'name' ? styles.activeSort : ''}`} onClick={() => handleSortR('name')} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>Lớp học <SortIcon col="name" sortKey={sortKeyR} sortDir={sortDirR} /></div>
                        <div className={`${styles.sortableCol} ${sortKeyR === 'teacher' ? styles.activeSort : ''}`} onClick={() => handleSortR('teacher')} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>Giáo viên <SortIcon col="teacher" sortKey={sortKeyR} sortDir={sortDirR} /></div>
                        <div className={`${styles.sortableCol} ${sortKeyR === 'classType' ? styles.activeSort : ''}`} onClick={() => handleSortR('classType')} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>Loại lớp <SortIcon col="classType" sortKey={sortKeyR} sortDir={sortDirR} /></div>
                        <div className={`${styles.sortableCol} ${sortKeyR === 'avgDays' ? styles.activeSort : ''}`} onClick={() => handleSortR('avgDays')} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>TB ngày/buổi <SortIcon col="avgDays" sortKey={sortKeyR} sortDir={sortDirR} /></div>
                        <div className={`${styles.sortableCol} ${sortKeyR === 'rescheduledCount' ? styles.activeSort : ''}`} onClick={() => handleSortR('rescheduledCount')} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>Buổi bị dời <SortIcon col="rescheduledCount" sortKey={sortKeyR} sortDir={sortDirR} /></div>
                        <div className={`${styles.sortableCol} ${sortKeyR === 'rescheduledRate' ? styles.activeSort : ''}`} onClick={() => handleSortR('rescheduledRate')} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>Tỷ lệ dời (%) <SortIcon col="rescheduledRate" sortKey={sortKeyR} sortDir={sortDirR} /></div>
                      </div>

                      {filteredReschedulingClasses.map(a => {
                        const teacherName = getPrimaryTeacher(a.cls);
                        const rescheduledRate = a.reschedulingAnalysis.totalSessions > 0 
                          ? (a.reschedulingAnalysis.rescheduledSessions / a.reschedulingAnalysis.totalSessions) * 100 
                          : 0;
                        const classTypeLabel = a.reschedulingAnalysis.classType === 'regular' ? 'Thường' : 'Tăng cường';

                        return (
                          <div key={a.cls.id} style={{
                            display: 'grid',
                            gridTemplateColumns: 'minmax(0,2fr) minmax(0,1.2fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)',
                            padding: '12px 16px', minWidth: 900,
                            borderBottom: '1px solid var(--border-primary)',
                            alignItems: 'center', cursor: 'pointer',
                            background: 'var(--bg-surface)'
                          }} onClick={() => setSelectedClassForRescheduling(a)}>
                            <div>
                               <div style={{ fontWeight: 590, color: 'var(--text-primary)' }}>{a.cls.name}</div>
                               <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{a.cls.centre?.shortName}</div>
                            </div>
                            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{teacherName}</div>
                            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
	                              <Badge variant={a.reschedulingAnalysis.classType === 'regular' ? 'passed' : 'info'} size="sm" shape="rounded">
	                                {classTypeLabel}
	                              </Badge>
                            </div>
                            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{a.reschedulingAnalysis.averageDaysBetweenSessions.toFixed(1)} ngày</div>
                            <div style={{ fontSize: 13, color: a.reschedulingAnalysis.rescheduledSessions > 0 ? 'var(--status-warning)' : 'var(--text-secondary)' }}>
                              {a.reschedulingAnalysis.rescheduledSessions} / {a.reschedulingAnalysis.totalSessions}
                            </div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: rescheduledRate > 20 ? 'var(--status-error)' : (rescheduledRate > 10 ? 'var(--status-warning)' : 'var(--status-success)') }}>
                              {rescheduledRate.toFixed(1)}%
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              </div>
            </div>
          )}

          {/* Section 4: Cancelled Classes */}
          {cancelledClasses.length > 0 && (
            <div className={styles.tableSection} style={{ opacity: 0.5, marginTop: 'var(--space-4)' }} id="section-cancelled">
              <TableGroupHeader
                title="Lớp đã Huỷ"
                count={cancelledClasses.length}
                note="Không tính vào phân tích chất lượng"
                isExpanded={showCancelledTable}
                onToggle={() => setShowCancelledTable(!showCancelledTable)}
              />
              <AnimatePresence initial={false}>
                {showCancelledTable && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                    <div className={styles.tableScrollWrapper}>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'minmax(0,2fr) minmax(0,1.2fr) minmax(0,1fr) minmax(0,1fr)',
                        padding: '7px 16px', minWidth: 600,
                        borderBottom: '1px solid var(--border-primary)',
                        fontSize: 11, fontWeight: 590, color: 'var(--text-quaternary)',
                        textTransform: 'uppercase', background: 'var(--bg-elevated)',
                      }}>
                        <div>Lớp học</div>
                        <div>Giáo viên</div>
                        <div>Cơ sở</div>
                        <div>Trạng thái</div>
                      </div>

                      {cancelledClasses.map(a => {
                        const teacherName = getPrimaryTeacher(a.cls);
                        return (
                          <div key={a.cls.id} style={{
                            display: 'grid',
                            gridTemplateColumns: 'minmax(0,2fr) minmax(0,1.2fr) minmax(0,1fr) minmax(0,1fr)',
                            padding: '12px 16px', minWidth: 600,
                            borderBottom: '1px solid var(--border-primary)',
                            alignItems: 'center',
                            background: 'var(--bg-surface)'
                          }}>
                            <div>
                               <div style={{ fontWeight: 590, color: 'var(--text-primary)' }}>{a.cls.name}</div>
                               <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{a.courseLineName}</div>
                            </div>
                            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{teacherName}</div>
                            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{a.cls.centre?.shortName}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-quaternary)' }}>{a.cls.status}</div>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Section 5: Checkpoint Scores */}
          {(analyzedClasses.length > 0 || loading) && (
            <div style={{ marginTop: 'var(--space-4)' }}>
              <TableToolbar
                search={searchCP} onSearchChange={setSearchCP}
                searchPlaceholder="Tìm lớp học, cơ sở..."
                quickFilterSlots={
                  <>
                    {hasPreferences && (
                      <QuickFilterChips
                        centres={centres}
                        selectedCentres={selectedCentreIdsCP}
                        onCentresChange={setSelectedCentreIdsCP}
                        selectedCourses={selectedCourseLinesCP}
                        onCoursesChange={setSelectedCourseLinesCP}
                        showCentres={true}
                        showCourses={true}
                      />
                    )}
                    <button className={`${styles.filterChip} ${quickFilterCP === 'hasIssues' ? styles.chipActive : ''}`} onClick={() => setQuickFilterCP(q => q === 'hasIssues' ? null : 'hasIssues')}>
                      <Icon.AlertTriangle size={12} /> Có vấn đề điểm
                      {quickFilterCP === 'hasIssues' && filteredCheckpointClasses.filter(c => c.cp1Analysis.issueType || c.cp2Analysis.issueType || c.demoAnalysis.issueType).length > 0 && (
                        <span className={styles.chipBadge}>{filteredCheckpointClasses.filter(c => c.cp1Analysis.issueType || c.cp2Analysis.issueType || c.demoAnalysis.issueType).length}</span>
                      )}
                    </button>
                  </>
                }
                filterSlots={
                  <>
                    {tableCentreIds.length > 1 && <CentreSelect centres={centres} selected={selectedCentreIdsCP} onChange={setSelectedCentreIdsCP} filterToIds={tableCentreIds} placeholder="Tất cả cơ sở" maxDisplay={1} searchable />}
                    <MultiSelect options={courseLineOptions} selected={selectedCourseLinesCP} onChange={setSelectedCourseLinesCP} placeholder="Tất cả khối" maxDisplay={2} />
                    {statusOptions.length > 1 && <MultiSelect options={statusOptions} selected={selectedStatusesCP} onChange={setSelectedStatusesCP} placeholder="Tất cả trạng thái" />}
                    {levelOptions.length > 1 && <MultiSelect options={levelOptions} selected={selectedLevelsCP} onChange={setSelectedLevelsCP} placeholder="Tất cả cấp độ" />}
                  </>
                }
                hasFilter={hasTableFilterCP} onClearFilter={clearTableFiltersCP}
              />
              
              <div className={styles.tableSection} id="section-checkpoints">
                <TableGroupHeader
                  title="Điểm Checkpoint & Cuối khoá"
                  count={filteredCheckpointClasses.length}
                  isExpanded={showCheckpointTable} onToggle={() => setShowCheckpointTable(!showCheckpointTable)}
                />
                <AnimatePresence initial={false}>
                  {showCheckpointTable && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                      <div className={styles.tableScrollWrapper}>
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'minmax(0,2fr) minmax(0,1.2fr) minmax(0,0.8fr) minmax(0,0.8fr) minmax(0,0.8fr) minmax(0,0.8fr) minmax(0,0.8fr) minmax(0,0.8fr) minmax(0,1fr)',
                          padding: '7px 16px', minWidth: 1200,
                          borderBottom: '1px solid var(--border-primary)',
                          fontSize: 11, fontWeight: 590, color: 'var(--text-quaternary)',
                          textTransform: 'uppercase', background: 'var(--bg-elevated)',
                        }}>
                          <div className={`${styles.sortableCol} ${sortKeyCP === 'name' ? styles.activeSort : ''}`} onClick={() => handleSortCP('name')} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>Lớp học <SortIcon col="name" sortKey={sortKeyCP} sortDir={sortDirCP} /></div>
                          <div className={`${styles.sortableCol} ${sortKeyCP === 'teacher' ? styles.activeSort : ''}`} onClick={() => handleSortCP('teacher')} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>Giáo viên <SortIcon col="teacher" sortKey={sortKeyCP} sortDir={sortDirCP} /></div>
                          <div className={`${styles.sortableCol} ${sortKeyCP === 'cp1Pass' ? styles.activeSort : ''}`} onClick={() => handleSortCP('cp1Pass')} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>CP1 Đạt <SortIcon col="cp1Pass" sortKey={sortKeyCP} sortDir={sortDirCP} /></div>
                          <div className={`${styles.sortableCol} ${sortKeyCP === 'cp1Avg' ? styles.activeSort : ''}`} onClick={() => handleSortCP('cp1Avg')} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>CP1 ĐTB <SortIcon col="cp1Avg" sortKey={sortKeyCP} sortDir={sortDirCP} /></div>
                          <div className={`${styles.sortableCol} ${sortKeyCP === 'cp2Pass' ? styles.activeSort : ''}`} onClick={() => handleSortCP('cp2Pass')} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>CP2 Đạt <SortIcon col="cp2Pass" sortKey={sortKeyCP} sortDir={sortDirCP} /></div>
                          <div className={`${styles.sortableCol} ${sortKeyCP === 'cp2Avg' ? styles.activeSort : ''}`} onClick={() => handleSortCP('cp2Avg')} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>CP2 ĐTB <SortIcon col="cp2Avg" sortKey={sortKeyCP} sortDir={sortDirCP} /></div>
                          <div className={`${styles.sortableCol} ${sortKeyCP === 'demoPass' ? styles.activeSort : ''}`} onClick={() => handleSortCP('demoPass')} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>Demo Đạt <SortIcon col="demoPass" sortKey={sortKeyCP} sortDir={sortDirCP} /></div>
                          <div className={`${styles.sortableCol} ${sortKeyCP === 'demoAvg' ? styles.activeSort : ''}`} onClick={() => handleSortCP('demoAvg')} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>Demo ĐTB <SortIcon col="demoAvg" sortKey={sortKeyCP} sortDir={sortDirCP} /></div>
                          <div style={{ display: 'flex', alignItems: 'center', fontWeight: 600, color: 'var(--brand-indigo)' }}>TBCK</div>
                        </div>

                        {filteredCheckpointClasses.map(a => {
                          const teacherName = getPrimaryTeacher(a.cls);
                          
                          // Helper to get color based on pass rate
                          const getPassRateColor = (rate: number) => {
                            if (rate >= 85) return 'var(--status-success)';
                            if (rate >= 70) return 'var(--status-warning)';
                            return 'var(--status-error)';
                          };
                          
                          // Helper to get color based on average score
                          const getAvgScoreColor = (score: number | null) => {
                            if (score === null) return 'var(--text-quaternary)';
                            if (score >= 4) return 'var(--status-success)';
                            if (score >= 3.5) return 'var(--status-warning)';
                            return 'var(--status-error)';
                          };
                          
                          // Calculate TBCK for this class (average of all students)
                          const cp1Avg = a.cp1Analysis.averageScore;
                          const cp2Avg = a.cp2Analysis.averageScore;
                          const demoAvg = a.demoAnalysis.averageScore;
                          
                          let tbckAvg: number | null = null;
                          if (demoAvg !== null) {
                            if (cp1Avg !== null && cp2Avg !== null) {
                              tbckAvg = 0.4 * ((cp1Avg + cp2Avg) / 2) + 0.6 * demoAvg;
                            } else if (cp1Avg !== null || cp2Avg !== null) {
                              const cpAvg = cp1Avg ?? cp2Avg!;
                              tbckAvg = 0.4 * cpAvg + 0.6 * demoAvg;
                            } else {
                              tbckAvg = demoAvg;
                            }
                          }

                          return (
                            <div key={a.cls.id} style={{
                              display: 'grid',
                              gridTemplateColumns: 'minmax(0,2fr) minmax(0,1.2fr) minmax(0,0.8fr) minmax(0,0.8fr) minmax(0,0.8fr) minmax(0,0.8fr) minmax(0,0.8fr) minmax(0,0.8fr) minmax(0,1fr)',
                              padding: '12px 16px', minWidth: 1200,
                              borderBottom: '1px solid var(--border-primary)',
                              alignItems: 'center', cursor: 'pointer',
                              background: 'var(--bg-surface)'
                            }} onClick={() => { setSelectedClassForCheckpoint(a); setCheckpointView('cp2'); }}>
                              <div>
                                 <div style={{ fontWeight: 590, color: 'var(--text-primary)' }}>{a.cls.name}</div>
                                 <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{a.cls.centre?.shortName}</div>
                              </div>
                              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{teacherName}</div>
                              
                              {/* CP1 */}
                              <div style={{ fontSize: 13, fontWeight: 600, color: a.cp1Analysis.hasSession ? getPassRateColor(a.cp1Analysis.passRate) : 'var(--text-quaternary)' }}>
                                {a.cp1Analysis.hasSession ? `${a.cp1Analysis.passRate.toFixed(0)}%` : '—'}
                                {a.cp1Analysis.issueType && <span style={{ fontSize: 10, marginLeft: 4, color: 'var(--status-error)' }}>⚠</span>}
                              </div>
                              <div style={{ fontSize: 13, color: getAvgScoreColor(a.cp1Analysis.averageScore) }}>
                                {a.cp1Analysis.averageScore !== null ? a.cp1Analysis.averageScore.toFixed(1) : '—'}
                              </div>
                              
                              {/* CP2 */}
                              <div style={{ fontSize: 13, fontWeight: 600, color: a.cp2Analysis.hasSession ? getPassRateColor(a.cp2Analysis.passRate) : 'var(--text-quaternary)' }}>
                                {a.cp2Analysis.hasSession ? `${a.cp2Analysis.passRate.toFixed(0)}%` : '—'}
                                {a.cp2Analysis.issueType && <span style={{ fontSize: 10, marginLeft: 4, color: 'var(--status-error)' }}>⚠</span>}
                              </div>
                              <div style={{ fontSize: 13, color: getAvgScoreColor(a.cp2Analysis.averageScore) }}>
                                {a.cp2Analysis.averageScore !== null ? a.cp2Analysis.averageScore.toFixed(1) : '—'}
                              </div>
                              
                              {/* Demo */}
                              <div style={{ fontSize: 13, fontWeight: 600, color: a.demoAnalysis.hasSession ? getPassRateColor(a.demoAnalysis.passRate) : 'var(--text-quaternary)' }}>
                                {a.demoAnalysis.hasSession ? `${a.demoAnalysis.passRate.toFixed(0)}%` : '—'}
                                {a.demoAnalysis.issueType && <span style={{ fontSize: 10, marginLeft: 4, color: 'var(--status-error)' }}>⚠</span>}
                              </div>
                              <div style={{ fontSize: 13, color: getAvgScoreColor(a.demoAnalysis.averageScore) }}>
                                {a.demoAnalysis.averageScore !== null ? a.demoAnalysis.averageScore.toFixed(1) : '—'}
                              </div>
                              
                              {/* TBCK */}
                              <div style={{ 
                                fontSize: 14, 
                                fontWeight: 600, 
                                color: getAvgScoreColor(tbckAvg),
                                background: tbckAvg !== null ? `${getAvgScoreColor(tbckAvg)}10` : 'transparent',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                textAlign: 'center'
                              }}>
                                {tbckAvg !== null ? tbckAvg.toFixed(2) : '—'}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}
          
            </div>

            {/* Right Column: Exemption Rules Panel */}
            {(analyzedClasses.length > 0 || loading) && (
              <div>
                {/* Outline Panel - FIRST for easy access */}
                <div className={styles.chartsSection}>
                  <div className={styles.chartsSectionHeader} onClick={() => setShowOutline(!showOutline)} style={{ cursor: 'pointer' }}>
                    <div className={styles.chartsSectionTitle}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                        <polyline points="9 22 9 12 15 12 15 22" />
                      </svg>
                      Mục lục
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" 
                      style={{ 
                        color: 'var(--text-tertiary)',
                        transform: showOutline ? 'rotate(180deg)' : 'rotate(0deg)', 
                        transition: 'transform 0.2s ease' 
                      }}>
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                  <AnimatePresence initial={false}>
                    {showOutline && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                        <div style={{ padding: 'var(--space-3)' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                            <button
                              onClick={() => scrollToSection('section-stats')}
                              style={{
                                padding: 'var(--space-2) var(--space-3)',
                                fontSize: 12,
                                fontWeight: 510,
                                color: 'var(--text-secondary)',
                                background: 'transparent',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                textAlign: 'left',
                                transition: 'all 0.15s ease',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'var(--bg-elevated)';
                                e.currentTarget.style.color = 'var(--text-primary)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.color = 'var(--text-secondary)';
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <rect x="3" y="3" width="7" height="7" />
                                  <rect x="14" y="3" width="7" height="7" />
                                  <rect x="14" y="14" width="7" height="7" />
                                  <rect x="3" y="14" width="7" height="7" />
                                </svg>
                                Thống kê Tổng quan
                              </div>
                            </button>
                            
                            <button
                              onClick={() => scrollToSection('section-charts')}
                              style={{
                                padding: 'var(--space-2) var(--space-3)',
                                fontSize: 12,
                                fontWeight: 510,
                                color: 'var(--text-secondary)',
                                background: 'transparent',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                textAlign: 'left',
                                transition: 'all 0.15s ease',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'var(--bg-elevated)';
                                e.currentTarget.style.color = 'var(--text-primary)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.color = 'var(--text-secondary)';
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <line x1="18" y1="20" x2="18" y2="10" />
                                  <line x1="12" y1="20" x2="12" y2="4" />
                                  <line x1="6" y1="20" x2="6" y2="14" />
                                </svg>
                                Biểu đồ Phân tích
                              </div>
                            </button>
                            
                            <button
                              onClick={() => scrollToSection('section-comments')}
                              style={{
                                padding: 'var(--space-2) var(--space-3)',
                                fontSize: 12,
                                fontWeight: 510,
                                color: 'var(--text-secondary)',
                                background: 'transparent',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                textAlign: 'left',
                                transition: 'all 0.15s ease',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'var(--bg-elevated)';
                                e.currentTarget.style.color = 'var(--text-primary)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.color = 'var(--text-secondary)';
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                </svg>
                                Nhận xét Giáo viên
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 24, marginTop: 2 }}>
                                {filteredCommentClasses.length} lớp
                              </div>
                            </button>
                            
                            <button
                              onClick={() => scrollToSection('section-attendance')}
                              style={{
                                padding: 'var(--space-2) var(--space-3)',
                                fontSize: 12,
                                fontWeight: 510,
                                color: 'var(--text-secondary)',
                                background: 'transparent',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                textAlign: 'left',
                                transition: 'all 0.15s ease',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'var(--bg-elevated)';
                                e.currentTarget.style.color = 'var(--text-primary)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.color = 'var(--text-secondary)';
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                  <circle cx="9" cy="7" r="4" />
                                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                                </svg>
                                Chuyên cần học viên
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 24, marginTop: 2 }}>
                                {filteredAttendanceClasses.length} lớp
                              </div>
                            </button>
                            
                            <button
                              onClick={() => scrollToSection('section-rescheduling')}
                              style={{
                                padding: 'var(--space-2) var(--space-3)',
                                fontSize: 12,
                                fontWeight: 510,
                                color: 'var(--text-secondary)',
                                background: 'transparent',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                textAlign: 'left',
                                transition: 'all 0.15s ease',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'var(--bg-elevated)';
                                e.currentTarget.style.color = 'var(--text-primary)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.color = 'var(--text-secondary)';
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <circle cx="12" cy="12" r="10" />
                                  <polyline points="12 6 12 12 16 14" />
                                </svg>
                                Thay đổi lịch học
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 24, marginTop: 2 }}>
                                {filteredReschedulingClasses.length} lớp
                              </div>
                            </button>
                            
                            <button
                              onClick={() => scrollToSection('section-checkpoints')}
                              style={{
                                padding: 'var(--space-2) var(--space-3)',
                                fontSize: 12,
                                fontWeight: 510,
                                color: 'var(--text-secondary)',
                                background: 'transparent',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                textAlign: 'left',
                                transition: 'all 0.15s ease',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'var(--bg-elevated)';
                                e.currentTarget.style.color = 'var(--text-primary)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.color = 'var(--text-secondary)';
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M9 11l3 3L22 4" />
                                  <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
                                </svg>
                                Điểm Checkpoint
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 24, marginTop: 2 }}>
                                {filteredCheckpointClasses.length} lớp
                              </div>
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                
                {/* Comment Exemption Rules */}
                <div className={styles.chartsSection} style={{ marginTop: 'var(--space-4)' }}>
                  <div className={styles.chartsSectionHeader} onClick={() => setShowExemptSessions(!showExemptSessions)} style={{ cursor: 'pointer' }}>
                    <div className={styles.chartsSectionTitle}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Quy tắc Miễn trừ Nhận xét
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" 
                      style={{ 
                        color: 'var(--text-tertiary)',
                        transform: showExemptSessions ? 'rotate(180deg)' : 'rotate(0deg)', 
                        transition: 'transform 0.2s ease' 
                      }}>
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                  <AnimatePresence initial={false}>
                    {showExemptSessions && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                        <div style={{ padding: 'var(--space-4)' }}>
                          <div className={styles.reasonList}>
                            {Array.from({ length: maxSessions }, (_, i) => i + 1).map(session => (
                              <label key={session} className={styles.reasonItem}>
                                <input 
                                  type="checkbox" 
                                  className={styles.reasonCheckbox}
                                  checked={exemptedSessions.includes(session)}
                                  onChange={() => handleToggleExemptSession(session)}
                                />
                                <div className={styles.reasonLabel}>
                                  <span>Buổi {session}</span>
                                </div>
                              </label>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                
                {/* Rescheduling Exemption Rules */}
                <div className={styles.chartsSection} style={{ marginTop: 'var(--space-4)' }}>
                  <div className={styles.chartsSectionHeader} onClick={() => setShowReschedulingExemptRules(!showReschedulingExemptRules)} style={{ cursor: 'pointer' }}>
                    <div className={styles.chartsSectionTitle}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Quy tắc miễn trừ lịch học
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" 
                      style={{ 
                        color: 'var(--text-tertiary)',
                        transform: showReschedulingExemptRules ? 'rotate(180deg)' : 'rotate(0deg)', 
                        transition: 'transform 0.2s ease' 
                      }}>
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                  <AnimatePresence initial={false}>
                    {showReschedulingExemptRules && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                        <div style={{ padding: 'var(--space-4)' }}>
                          {/* Exempt 1:1 Classes */}
                          <label className={styles.reasonItem} style={{ marginBottom: 'var(--space-3)' }}>
                            <input 
                              type="checkbox" 
                              className={styles.reasonCheckbox}
                              checked={exemptOneOnOneClasses}
                              onChange={(e) => setExemptOneOnOneClasses(e.target.checked)}
                            />
                            <div className={styles.reasonLabel}>
                              <span>Lớp (1:1)</span>
                            </div>
                          </label>
                          
                          {/* Holiday Periods */}
                          <div style={{ marginTop: 'var(--space-4)' }}>
                            <div style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'space-between',
                              marginBottom: 'var(--space-2)',
                              fontSize: 12,
                              fontWeight: 590,
                              color: 'var(--text-secondary)'
                            }}>
                              <span>Khoảng thời gian nghỉ</span>
                              <button
                                onClick={() => setShowHolidayForm(!showHolidayForm)}
                                style={{
                                  padding: '4px 8px',
                                  fontSize: 11,
                                  background: 'var(--brand-indigo)',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontWeight: 600
                                }}
                              >
                                + Thêm
                              </button>
                            </div>
                            
                            {/* Add Holiday Form */}
                            <AnimatePresence>
                              {showHolidayForm && (
                                <motion.div 
                                  initial={{ height: 0, opacity: 0 }} 
                                  animate={{ height: 'auto', opacity: 1 }} 
                                  exit={{ height: 0, opacity: 0 }}
                                  style={{ 
                                    overflow: 'hidden',
                                    marginBottom: 'var(--space-3)',
                                    padding: 'var(--space-3)',
                                    background: 'var(--bg-elevated)',
                                    borderRadius: '6px',
                                    border: '1px solid var(--border-primary)'
                                  }}
                                >
                                  <div style={{ marginBottom: 'var(--space-2)' }}>
                                    <label style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'block', marginBottom: 4 }}>
                                      Tên dịp
                                    </label>
                                    <input
                                      type="text"
                                      value={newHolidayName}
                                      onChange={(e) => setNewHolidayName(e.target.value)}
                                      placeholder="VD: Tết Dương lịch, 30/4 - 1/5..."
                                      style={{
                                        width: '100%',
                                        padding: '6px 8px',
                                        fontSize: 12,
                                        border: '1px solid var(--border-input)',
                                        borderRadius: '4px',
                                        background: 'var(--bg-surface)'
                                      }}
                                    />
                                  </div>
                                  <div style={{ marginBottom: 'var(--space-2)' }}>
                                    <label style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'block', marginBottom: 4 }}>
                                      Từ ngày
                                    </label>
                                    <input
                                      type="date"
                                      value={newHolidayFrom}
                                      onChange={(e) => setNewHolidayFrom(e.target.value)}
                                      style={{
                                        width: '100%',
                                        padding: '6px 8px',
                                        fontSize: 12,
                                        border: '1px solid var(--border-input)',
                                        borderRadius: '4px',
                                        background: 'var(--bg-surface)'
                                      }}
                                    />
                                  </div>
                                  <div style={{ marginBottom: 'var(--space-2)' }}>
                                    <label style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'block', marginBottom: 4 }}>
                                      Đến ngày
                                    </label>
                                    <input
                                      type="date"
                                      value={newHolidayTo}
                                      onChange={(e) => setNewHolidayTo(e.target.value)}
                                      style={{
                                        width: '100%',
                                        padding: '6px 8px',
                                        fontSize: 12,
                                        border: '1px solid var(--border-input)',
                                        borderRadius: '4px',
                                        background: 'var(--bg-surface)'
                                      }}
                                    />
                                  </div>
                                  <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                    <button
                                      onClick={handleAddHolidayPeriod}
                                      style={{
                                        flex: 1,
                                        padding: '6px 12px',
                                        fontSize: 11,
                                        background: 'var(--brand-indigo)',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        fontWeight: 600
                                      }}
                                    >
                                      Thêm
                                    </button>
                                    <button
                                      onClick={() => {
                                        setShowHolidayForm(false);
                                        setNewHolidayName('');
                                        setNewHolidayFrom('');
                                        setNewHolidayTo('');
                                      }}
                                      style={{
                                        flex: 1,
                                        padding: '6px 12px',
                                        fontSize: 11,
                                        background: 'var(--bg-elevated)',
                                        color: 'var(--text-secondary)',
                                        border: '1px solid var(--border-primary)',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        fontWeight: 600
                                      }}
                                    >
                                      Huỷ
                                    </button>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                            
                            {/* Holiday Periods List */}
                            <div className={styles.reasonList}>
                              {holidayPeriods.map((period, index) => (
                                <div key={index} style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: 'var(--space-2) var(--space-3)',
                                  background: 'var(--bg-elevated)',
                                  borderRadius: '4px',
                                  marginBottom: 'var(--space-2)',
                                  fontSize: 12
                                }}>
                                  <div>
                                    <div style={{ fontWeight: 590, color: 'var(--text-primary)', marginBottom: 2 }}>
                                      {period.name}
                                    </div>
                                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                                      {new Date(period.from).toLocaleDateString('vi-VN')} - {new Date(period.to).toLocaleDateString('vi-VN')}
                                    </div>
                                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                                      {Math.ceil((new Date(period.to).getTime() - new Date(period.from).getTime()) / (1000 * 60 * 60 * 24)) + 1} ngày
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => handleRemoveHolidayPeriod(index)}
                                    style={{
                                      padding: '4px 8px',
                                      fontSize: 11,
                                      background: 'transparent',
                                      color: 'var(--status-error)',
                                      border: 'none',
                                      cursor: 'pointer',
                                      fontWeight: 600
                                    }}
                                  >
                                    Xoá
                                  </button>
                                </div>
                              ))}
                              {holidayPeriods.length === 0 && (
                                <div style={{ 
                                  textAlign: 'center', 
                                  padding: 'var(--space-4)', 
                                  color: 'var(--text-quaternary)',
                                  fontSize: 12
                                }}>
                                  Chưa có khoảng thời gian nghỉ nào
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            )}
          </div>

          {/* Empty State */}
          {!loading && classes.length === 0 && (
            <EmptyState
              icon={<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>}
              title="Chưa có dữ liệu lớp học"
              subtitle={'Chọn khoảng thời gian và nhấn "Tải dữ liệu"'}
            />
          )}

      <Modal open={!!selectedClassForComment} onClose={() => { setSelectedClassForComment(null); setCommentModalSessionIndex(null); }}>
        {selectedClassForComment && (() => {
          const commentSlots = (selectedClassForComment.cls.slots || [])
            .filter(slot => slot.date)
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
          const commentStudents = selectedClassForComment.commentAnalysis.students;
          const firstIssueSessionIndex = commentStudents
            .flatMap(st => st.comments.filter(c => c.status !== 'ok').map(c => c.sessionIndex))
            .sort((a, b) => a - b)[0];
          const defaultSessionIndex = firstIssueSessionIndex ?? Math.max(Math.min(selectedClassForComment.commentAnalysis.passedSlots - 1, commentSlots.length - 1), 0);
          const activeSessionIndex = commentModalSessionIndex !== null && commentModalSessionIndex >= 0 && commentModalSessionIndex < commentSlots.length
            ? commentModalSessionIndex
            : defaultSessionIndex;
          const activeSlot = commentSlots[activeSessionIndex];
          const commentSessionStats = commentSlots.map((slot, sessionIndex) => {
            const comments = commentStudents.map(st => st.comments.find(c => c.sessionIndex === sessionIndex)).filter(Boolean);
            const ok = comments.filter(c => c?.status === 'ok').length;
            const brief = comments.filter(c => c?.status === 'brief').length;
            const empty = comments.filter(c => c?.status === 'empty' || c?.status === 'overdue').length;
            const duplicate = comments.filter(c => c?.status === 'duplicate_self' || c?.status === 'duplicate_other').length;
            const hasIssues = brief > 0 || empty > 0 || duplicate > 0;
            return { slot, sessionIndex, ok, brief, empty, duplicate, hasIssues };
          });

          return (
           <>
             <ModalHeader title={`Nhận xét Giáo viên: ${selectedClassForComment.cls.name}`} 
                          subtitle={`${selectedClassForComment.cls.centre?.shortName} • ${selectedClassForComment.commentAnalysis.totalSlots} buổi`}
                          onClose={() => { setSelectedClassForComment(null); setCommentModalSessionIndex(null); }} />
             <div className={styles.modalBody} style={{ padding: '16px 20px 20px' }}>
               <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                 <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', padding: '12px 16px', background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)', borderRadius: 6 }}>
                   {([
                     [COMMENT_STATUS_GROUP_LABELS.ok, selectedClassForComment.commentAnalysis.okCount, 'var(--status-success)'],
                     [COMMENT_STATUS_GROUP_LABELS.brief, selectedClassForComment.commentAnalysis.briefCount, 'var(--status-warning)'],
                     [COMMENT_STATUS_GROUP_LABELS.emptyOrOverdue, selectedClassForComment.commentAnalysis.emptyCount + selectedClassForComment.commentAnalysis.overdueCount, 'var(--status-error)'],
                     [COMMENT_STATUS_GROUP_LABELS.duplicate, selectedClassForComment.commentAnalysis.duplicateCount, 'var(--status-dark-orange)'],
                   ] as [string, number, string][]).map(([label, value, color]) => (
                     <div key={label} style={{ minWidth: 110 }}>
                       <div className={styles.statLabel}>{label}</div>
                       <div style={{ fontSize: 14, fontWeight: 590, color }}>{value}</div>
                     </div>
                   ))}
                 </div>

                 <div className={styles.tableScrollWrapper}>
                   <table className={styles.studentTable}>
                     <thead>
                       <tr>
                         <th style={{ minWidth: 160 }}>{LABELS.STUDENT}</th>
                         <th>Tổng quan</th>
                         {commentSessionStats.map(stat => (
                           <th
                             key={stat.slot._id}
                             onClick={() => setCommentModalSessionIndex(stat.sessionIndex)}
                             style={{
                               minWidth: 82,
                               textAlign: 'center',
                               cursor: 'pointer',
                               background: stat.sessionIndex === activeSessionIndex ? 'rgba(59,130,246,0.08)' : undefined,
                             }}
                           >
                             <div>Buổi {stat.sessionIndex + 1}</div>
                             <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2, textTransform: 'none', letterSpacing: 0 }}>
                               {new Date(stat.slot.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                             </div>
                           </th>
                         ))}
                       </tr>
                     </thead>
                     <tbody>
                       {commentStudents.map(st => {
                         const visibleStatuses = commentSessionStats.map(stat => (
                           st.comments.find(c => c.sessionIndex === stat.sessionIndex)?.status ?? 'not_required'
                         ));
                         const missingCount = visibleStatuses.filter(status => status === 'empty' || status === 'overdue').length;
                         const briefCount = visibleStatuses.filter(status => status === 'brief').length;
                         const duplicateCount = visibleStatuses.filter(status => status === 'duplicate_self' || status === 'duplicate_other').length;
                         const totalIssues = missingCount + briefCount + duplicateCount;
                         return (
                           <tr key={st.studentId}>
                             <td style={{ fontWeight: 510, fontSize: 13 }}>{st.studentName}</td>
                             <td>
                               {totalIssues === 0 ? (
                                 <CommentStatusBadge status="ok" />
                               ) : (
                                 <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                   {missingCount > 0 && <CommentStatusBadge status="empty">{missingCount} {COMMENT_STATUS_COUNT_LABELS.empty}</CommentStatusBadge>}
                                   {briefCount > 0 && <CommentStatusBadge status="brief">{briefCount} {COMMENT_STATUS_COUNT_LABELS.brief}</CommentStatusBadge>}
                                   {duplicateCount > 0 && <CommentStatusBadge status="duplicate_self">{duplicateCount} {COMMENT_STATUS_COUNT_LABELS.duplicate}</CommentStatusBadge>}
                                 </div>
                               )}
                             </td>
                             {commentSessionStats.map(stat => {
                               const comment = st.comments.find(c => c.sessionIndex === stat.sessionIndex);
                               const status = comment?.status ?? 'not_required';
                               return (
                                 <td
                                   key={`${st.studentId}-${stat.sessionIndex}`}
                                   onClick={() => setCommentModalSessionIndex(stat.sessionIndex)}
                                   style={{
                                     textAlign: 'center',
                                     cursor: 'pointer',
                                     background: stat.sessionIndex === activeSessionIndex ? 'rgba(59,130,246,0.06)' : undefined,
                                   }}
                                 >
                                   <CommentStatusBadge status={status} />
                                 </td>
                               );
                             })}
                           </tr>
                         );
                       })}
                     </tbody>
                   </table>
                 </div>

                 {activeSlot && (
                   <div style={{ border: '1px solid var(--border-primary)', borderRadius: 6, overflow: 'hidden' }}>
                     <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)', padding: '10px 12px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-primary)', flexWrap: 'wrap' }}>
                       <div>
                         <div style={{ fontWeight: 590, color: 'var(--text-primary)', fontSize: 13 }}>Nhận xét buổi {activeSessionIndex + 1}</div>
                         <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                           {new Date(activeSlot.date).toLocaleDateString('vi-VN')} • {commentSessionStats[activeSessionIndex]?.ok || 0} {COMMENT_STATUS_COUNT_LABELS.ok} • {commentSessionStats[activeSessionIndex]?.brief || 0} {COMMENT_STATUS_COUNT_LABELS.brief} • {commentSessionStats[activeSessionIndex]?.empty || 0} {COMMENT_STATUS_COUNT_LABELS.empty} • {commentSessionStats[activeSessionIndex]?.duplicate || 0} {COMMENT_STATUS_COUNT_LABELS.duplicate}
                         </div>
                       </div>
                       {commentSessionStats[activeSessionIndex]?.hasIssues ? (
                         <Badge variant="warning" size="sm" shape="rounded">Có vấn đề</Badge>
                       ) : (
                         <Badge variant="passed" size="sm" shape="rounded">Ổn</Badge>
                       )}
                     </div>
                     <div className={styles.tableScrollWrapper}>
                       <table className={styles.studentTable}>
                         <thead>
                           <tr>
                             <th style={{ width: 28 }}>#</th>
                             <th>{LABELS.STUDENT}</th>
                             <th>Giáo viên</th>
                             <th>Trạng thái</th>
                             <th>Nội dung nhận xét</th>
                           </tr>
                         </thead>
                         <tbody>
                           {commentStudents.map((st, idx) => {
                             const c = st.comments.find(comment => comment.sessionIndex === activeSessionIndex);
                             const status = c?.status ?? 'not_required';
                             return (
                               <tr key={`${st.studentId}-${activeSessionIndex}`}>
                                 <td style={{ color: 'var(--text-quaternary)', fontSize: 11 }}>{idx + 1}</td>
                                 <td style={{ fontWeight: 510 }}>{st.studentName}</td>
                                 <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{c?.teacherName || '—'}</td>
                                 <td>
                                   <CommentStatusBadge status={status}>
                                     {status === 'duplicate_self' ? 'Trùng bản thân' : status === 'duplicate_other' ? 'Trùng học viên khác' : undefined}
                                   </CommentStatusBadge>
                                   {c?.isOverdue && c.overdueHours !== undefined && (
                                     <span style={{ fontSize: 10, marginLeft: 6, color: 'var(--text-tertiary)' }}>
                                       {Math.floor(c.overdueHours / 24)}d
                                     </span>
                                   )}
                                 </td>
	                                 <td style={{ fontSize: 12, color: c?.text ? 'var(--text-primary)' : 'var(--text-quaternary)', minWidth: 360, maxWidth: 640, lineHeight: 1.45 }}>
	                                   {c ? (
	                                     <div>
	                                       {c.text ? (
	                                         <div style={{ color: 'var(--text-primary)' }}>{c.text}</div>
	                                       ) : (
	                                         <em>Không có nội dung</em>
	                                       )}
	                                       {(c.status === 'duplicate_self' || c.status === 'duplicate_other' || c.isOverdue) && (
	                                         <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
	                                           {c.status === 'duplicate_self' && <CommentStatusBadge status="duplicate_self">Trùng với nhận xét trước của học viên</CommentStatusBadge>}
	                                           {c.status === 'duplicate_other' && <CommentStatusBadge status="duplicate_other">Trùng với học viên khác</CommentStatusBadge>}
	                                           {c.isOverdue && c.overdueHours !== undefined && (
	                                             <CommentStatusBadge status="overdue">Quá hạn {Math.floor(c.overdueHours / 24)} ngày</CommentStatusBadge>
	                                           )}
	                                         </div>
	                                       )}
	                                     </div>
	                                   ) : (
	                                     <em>Không yêu cầu nhận xét / không có dữ liệu điểm danh</em>
	                                   )}
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
             </div>
           </>
          );
        })()}
      </Modal>

      <Modal open={!!selectedClassForAttendance} onClose={() => setSelectedClassForAttendance(null)}>
        {selectedClassForAttendance && (
           <>
             <ModalHeader title={`Chuyên cần học viên: ${selectedClassForAttendance.cls.name}`}
                          subtitle={`${selectedClassForAttendance.cls.centre?.shortName}`}
                          onClose={() => setSelectedClassForAttendance(null)} />
             <div className={styles.modalBody} style={{ padding: '16px 20px 20px' }}>
                 {selectedClassForAttendance.attendanceAnalysis.studentsWithAlerts.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-quaternary)' }}>Không có học viên nào vi phạm chuyên cần.</div>
                 ) : (
                    <div className={styles.tableScrollWrapper}>
                      <table className={styles.studentTable}>
                       <thead>
                          <tr>
                             <th>{LABELS.STUDENT}</th>
                             <th>Cảnh báo</th>
                             <th>Lịch sử điểm danh</th>
                          </tr>
                       </thead>
                       <tbody>
                          {selectedClassForAttendance.attendanceAnalysis.studentsWithAlerts.map(st => (
                             <tr key={st.studentId}>
                                <td style={{ fontWeight: 510 }}>{st.studentName}</td>
                                <td>
                                   <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
	                                      {st.alerts.includes('frequent_absent') && (
	                                         <AttendanceAlertBadge type="frequent_absent" />
	                                      )}
	                                      {st.alerts.includes('consecutive_absent') && (
	                                         <AttendanceAlertBadge type="consecutive_absent" />
	                                      )}
	                                      {st.alerts.includes('late_stage_absent') && (
	                                         <AttendanceAlertBadge type="late_stage_absent" />
	                                      )}
                                   </div>
                                </td>
                                <td>
                                   <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                      {st.sessions.map((sess, idx) => (
                                         <AttendanceSessionCell
                                            key={idx}
                                            status={sess.status}
                                            index={idx}
                                            date={sess.date}
                                            size={28}
                                         />
                                      ))}
                                   </div>
                                </td>
                             </tr>
                          ))}
                       </tbody>
                    </table>
                    </div>
                 )}
             </div>
           </>
        )}
      </Modal>

      <Modal open={!!selectedClassForRescheduling} onClose={() => setSelectedClassForRescheduling(null)}>
        {selectedClassForRescheduling && (() => {
          // Debug: Log slots data when modal opens
          console.log('=== DEBUG: Class Rescheduling Analysis ===');
          console.log('Class Name:', selectedClassForRescheduling.cls.name);
          console.log('Class ID:', selectedClassForRescheduling.cls.id);
          console.log('Total Slots:', selectedClassForRescheduling.cls.slots?.length);
          console.log('\nRaw Slots (sorted by startTime):');
          const sortedSlots = (selectedClassForRescheduling.cls.slots || [])
            .filter(s => s.startTime || s.date)
            .sort((a, b) => {
              const aTime = a.startTime || a.date;
              const bTime = b.startTime || b.date;
              return new Date(aTime).getTime() - new Date(bTime).getTime();
            });
          sortedSlots.forEach((slot, idx) => {
            const sessionDate = slot.startTime || slot.date;
            const dateObj = new Date(sessionDate);
            console.log(`  Slot ${idx + 1}:`, {
              _id: slot._id,
              date: slot.date,
              startTime: slot.startTime,
              endTime: slot.endTime,
              sessionDate: sessionDate,
              sessionDateObj: dateObj.toISOString(),
              localDate: dateObj.toLocaleDateString('vi-VN'),
              localDateTime: dateObj.toLocaleString('vi-VN'),
            });
          });
          
          // Detect pattern for debugging
          const gaps = selectedClassForRescheduling.reschedulingAnalysis.sessions
            .slice(1)
            .map(s => s.daysSincePrevious)
            .filter((d): d is number => d !== null && d > 0 && d <= 14);
          const gapFrequency = new Map<number, number>();
          gaps.forEach(gap => gapFrequency.set(gap, (gapFrequency.get(gap) || 0) + 1));
          const sortedGaps = Array.from(gapFrequency.entries())
            .sort((a, b) => b[1] - a[1]);
          
          console.log('\nGap Analysis:');
          console.log('All gaps:', selectedClassForRescheduling.reschedulingAnalysis.sessions.slice(1).map(s => s.daysSincePrevious));
          console.log('Gap frequency:', Object.fromEntries(sortedGaps));
          console.log('Most common gaps:', sortedGaps.slice(0, 3).map(([gap, count]) => `${gap} days (${count}x)`).join(', '));
          
          console.log('\nAnalysis Results:');
          console.log('Class Type:', selectedClassForRescheduling.reschedulingAnalysis.classType);
          console.log('Average Days:', selectedClassForRescheduling.reschedulingAnalysis.averageDaysBetweenSessions);
          console.log('Rescheduled Sessions:', selectedClassForRescheduling.reschedulingAnalysis.rescheduledSessions);
          console.log('\nSession Analysis:');
          selectedClassForRescheduling.reschedulingAnalysis.sessions.forEach((sess, idx) => {
            console.log(`  Session ${idx + 1}:`, {
              date: sess.date,
              localDate: new Date(sess.date).toLocaleDateString('vi-VN'),
              daysSincePrevious: sess.daysSincePrevious,
              expectedDays: sess.expectedDays,
              deviation: sess.deviation,
              isRescheduled: sess.isRescheduled,
              reschedulingType: sess.reschedulingType,
            });
          });
          console.log('=== END DEBUG ===\n');
          
          return (
           <>
             <ModalHeader title={`Lịch sử Thay đổi Lịch: ${selectedClassForRescheduling.cls.name}`}
                          subtitle={`${selectedClassForRescheduling.cls.centre?.shortName} • ${selectedClassForRescheduling.reschedulingAnalysis.classType === 'regular' ? 'Lớp thường' : 'Lớp tăng cường'}`}
                          onClose={() => setSelectedClassForRescheduling(null)} />
             <div className={styles.modalBody} style={{ padding: '16px 20px 20px' }}>
                 <>
                   <div style={{ marginBottom: '16px', padding: '12px', background: 'var(--bg-elevated)', borderRadius: '6px', fontSize: 13 }}>
                     <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                       <div>
                         <div style={{ color: 'var(--text-tertiary)', fontSize: 11, marginBottom: 4 }}>Tổng buổi học</div>
                         <div style={{ fontWeight: 590, color: 'var(--text-primary)' }}>{selectedClassForRescheduling.reschedulingAnalysis.totalSessions} buổi</div>
                       </div>
                       <div>
                         <div style={{ color: 'var(--text-tertiary)', fontSize: 11, marginBottom: 4 }}>Buổi bị dời</div>
                         <div style={{ fontWeight: 590, color: selectedClassForRescheduling.reschedulingAnalysis.rescheduledSessions > 0 ? 'var(--status-warning)' : 'var(--status-success)' }}>
                           {selectedClassForRescheduling.reschedulingAnalysis.rescheduledSessions} buổi
                         </div>
                       </div>
                       <div>
                         <div style={{ color: 'var(--text-tertiary)', fontSize: 11, marginBottom: 4 }}>TB khoảng cách</div>
                         <div style={{ fontWeight: 590, color: 'var(--text-primary)' }}>{selectedClassForRescheduling.reschedulingAnalysis.averageDaysBetweenSessions.toFixed(1)} ngày</div>
                       </div>
                     </div>
                   </div>
                      <div className={styles.tableScrollWrapper}>
                        <table className={styles.studentTable}>
                         <thead>
                            <tr>
                               <th>Buổi</th>
                               <th>Ngày học</th>
                               <th>Khoảng cách (ngày)</th>
                               <th>Dự kiến (ngày)</th>
                               <th>Chênh lệch</th>
                               <th>Trạng thái</th>
                            </tr>
                         </thead>
                         <tbody>
                            {selectedClassForRescheduling.reschedulingAnalysis.sessions.map((sess) => {
                               const isSameDay = sess.daysSincePrevious === 0;
                               return (
                               <tr key={sess.sessionIndex} style={{ 
                                 background: sess.isRescheduled ? 'rgba(245, 158, 11, 0.03)' : isSameDay ? 'rgba(59, 130, 246, 0.03)' : 'transparent' 
                               }}>
                                  <td style={{ textAlign: 'center', fontWeight: 510 }}>Buổi {sess.sessionIndex + 1}</td>
                                  <td style={{ whiteSpace: 'nowrap' }}>{new Date(sess.date).toLocaleDateString('vi-VN')}</td>
                                  <td style={{ textAlign: 'center' }}>
                                    {sess.daysSincePrevious !== null ? (
                                      isSameDay ? (
	                                        <span style={{ color: 'var(--brand-indigo)', fontWeight: 600 }}>{RESCHEDULE_STATUS_LABELS.same_day}</span>
                                      ) : (
                                        `${sess.daysSincePrevious} ngày`
                                      )
                                    ) : '—'}
                                  </td>
                                  <td style={{ textAlign: 'center', color: 'var(--text-tertiary)' }}>
                                    {sess.sessionIndex > 0 ? `${sess.expectedDays} ngày` : '—'}
                                  </td>
	                                  <td style={{ textAlign: 'center', fontWeight: 600, color: sess.isRescheduled ? (sess.deviation < 0 ? 'var(--brand-indigo)' : 'var(--status-warning)') : isSameDay ? 'var(--brand-indigo)' : 'var(--text-tertiary)' }}>
                                    {sess.sessionIndex > 0 ? (sess.deviation > 0 ? `+${sess.deviation}` : sess.deviation) : '—'}
                                  </td>
                                  <td>
                                     {isSameDay ? (
	                                       <RescheduleStatusBadge status="same_day" />
	                                     ) : sess.isRescheduled ? (
	                                       <RescheduleStatusBadge status={sess.reschedulingType === 'early' ? 'early' : 'late'} />
	                                     ) : (
	                                       <RescheduleStatusBadge status="on_schedule" />
	                                     )}
                                  </td>
                               </tr>
                            )})}
                         </tbody>
                      </table>
                      </div>
                 </>
             </div>
           </>
        );
        })()}
      </Modal>
      </PageLayout>

      {/* CSV Export Settings Modals */}
      <CSVExportSettings
        isOpen={showCommentCSVSettings}
        onClose={() => setShowCommentCSVSettings(false)}
        columns={commentCSVColumns}
        onSave={saveCommentColumns}
        title="Cài đặt xuất CSV - Tình trạng Nhận xét"
      />
      
      {/* Checkpoint Detail Modal */}
      <Modal open={!!selectedClassForCheckpoint} onClose={() => setSelectedClassForCheckpoint(null)}>
        {selectedClassForCheckpoint && (() => {
          const analysis = checkpointView === 'cp1' ? selectedClassForCheckpoint.cp1Analysis 
            : checkpointView === 'cp2' ? selectedClassForCheckpoint.cp2Analysis 
            : selectedClassForCheckpoint.demoAnalysis;
          
          const title = checkpointView === 'cp1' ? 'CP1 (Buổi 5)' 
            : checkpointView === 'cp2' ? 'CP2 (Buổi 9)' 
            : 'Demo (Buổi 14)';
          
          return (
            <>
              <ModalHeader 
                title={`${title}: ${selectedClassForCheckpoint.cls.name}`}
                subtitle={`${selectedClassForCheckpoint.cls.centre?.shortName} • ${analysis.studentsWithScores} học viên có điểm`}
                onClose={() => setSelectedClassForCheckpoint(null)}
              />
              <div className={styles.modalBody} style={{ padding: '16px 20px 20px' }}>
                {/* Formula info box */}
                <div style={{ 
                  marginBottom: 'var(--space-4)', 
                  padding: '12px 16px', 
                  background: 'var(--bg-elevated)', 
                  borderRadius: '6px',
                  border: '1px solid var(--border-primary)',
                  fontSize: 12,
                  color: 'var(--text-secondary)'
                }}>
                  <div style={{ fontWeight: 590, marginBottom: 6, color: 'var(--text-primary)' }}>
                    📐 Công thức tính điểm
                  </div>
                  {checkpointView !== 'demo' ? (
                    <div>
                      <strong>CP = 40% × (Lý thuyết + Thực hành)/2 + 60% × Năng lực</strong>
                      <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-tertiary)' }}>
                        Lưu ý: Với các năm không có bài kiểm tra, điểm tính 100% theo điểm năng lực
                      </div>
                    </div>
                  ) : (
                    <div>
                      <strong>DEMO = 60% × Điểm sản phẩm cuối khoá + 40% × Năng lực</strong>
                      <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-tertiary)' }}>
                        Điểm trung bình cả khoá: TBCK = 40% × (CP1+CP2)/2 + 60% × DEMO
                      </div>
                    </div>
                  )}
                </div>

                {/* Checkpoint selector tabs */}
                <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)', borderBottom: '1px solid var(--border-primary)', paddingBottom: 'var(--space-2)' }}>
                  <button
                    onClick={() => setCheckpointView('cp1')}
                    style={{
                      padding: 'var(--space-2) var(--space-3)',
                      fontSize: 12,
                      fontWeight: checkpointView === 'cp1' ? 600 : 510,
                      color: checkpointView === 'cp1' ? 'var(--brand-indigo)' : 'var(--text-secondary)',
                      background: 'transparent',
                      border: 'none',
                      borderBottom: checkpointView === 'cp1' ? '2px solid var(--brand-indigo)' : 'none',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    CP1 (Buổi 5)
                  </button>
                  <button
                    onClick={() => setCheckpointView('cp2')}
                    style={{
                      padding: 'var(--space-2) var(--space-3)',
                      fontSize: 12,
                      fontWeight: checkpointView === 'cp2' ? 600 : 510,
                      color: checkpointView === 'cp2' ? 'var(--brand-indigo)' : 'var(--text-secondary)',
                      background: 'transparent',
                      border: 'none',
                      borderBottom: checkpointView === 'cp2' ? '2px solid var(--brand-indigo)' : 'none',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    CP2 (Buổi 9)
                  </button>
                  <button
                    onClick={() => setCheckpointView('demo')}
                    style={{
                      padding: 'var(--space-2) var(--space-3)',
                      fontSize: 12,
                      fontWeight: checkpointView === 'demo' ? 600 : 510,
                      color: checkpointView === 'demo' ? 'var(--brand-indigo)' : 'var(--text-secondary)',
                      background: 'transparent',
                      border: 'none',
                      borderBottom: checkpointView === 'demo' ? '2px solid var(--brand-indigo)' : 'none',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    Demo (Buổi 14)
                  </button>
                </div>

                {/* Summary stats */}
                {analysis.hasSession && (() => {
                  // Calculate TBCK average for this checkpoint view
                  const cp1Avg = selectedClassForCheckpoint.cp1Analysis.averageScore;
                  const cp2Avg = selectedClassForCheckpoint.cp2Analysis.averageScore;
                  const demoAvg = selectedClassForCheckpoint.demoAnalysis.averageScore;
                  
                  let tbckAvg: number | null = null;
                  if (demoAvg !== null) {
                    if (cp1Avg !== null && cp2Avg !== null) {
                      tbckAvg = 0.4 * ((cp1Avg + cp2Avg) / 2) + 0.6 * demoAvg;
                    } else if (cp1Avg !== null || cp2Avg !== null) {
                      const cpAvg = cp1Avg ?? cp2Avg!;
                      tbckAvg = 0.4 * cpAvg + 0.6 * demoAvg;
                    } else {
                      tbckAvg = demoAvg;
                    }
                  }
                  
                  return (
                    <div style={{ marginBottom: '16px', padding: '12px', background: 'var(--bg-elevated)', borderRadius: '6px', fontSize: 13 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
                        <div>
                          <div style={{ color: 'var(--text-tertiary)', fontSize: 11, marginBottom: 4 }}>Tỷ lệ đạt</div>
                          <div style={{ fontWeight: 590, color: analysis.passRate >= 85 ? 'var(--status-success)' : analysis.passRate >= 70 ? 'var(--status-warning)' : 'var(--status-error)' }}>
                            {analysis.passRate.toFixed(1)}%
                          </div>
                        </div>
                        <div>
                          <div style={{ color: 'var(--text-tertiary)', fontSize: 11, marginBottom: 4 }}>Điểm TB</div>
                          <div style={{ fontWeight: 590, color: 'var(--text-primary)' }}>
                            {analysis.averageScore !== null ? analysis.averageScore.toFixed(2) : '—'}
                          </div>
                        </div>
                        <div>
                          <div style={{ color: 'var(--text-tertiary)', fontSize: 11, marginBottom: 4 }}>Đạt / Tổng</div>
                          <div style={{ fontWeight: 590, color: 'var(--text-primary)' }}>
                            {analysis.passCount} / {analysis.studentsWithScores}
                          </div>
                        </div>
                        <div>
                          <div style={{ color: 'var(--text-tertiary)', fontSize: 11, marginBottom: 4 }}>TBCK TB</div>
                          <div style={{ fontWeight: 590, color: tbckAvg !== null ? (tbckAvg >= 4 ? 'var(--status-success)' : tbckAvg >= 3.5 ? 'var(--status-warning)' : 'var(--status-error)') : 'var(--text-quaternary)' }}>
                            {tbckAvg !== null ? tbckAvg.toFixed(2) : '—'}
                          </div>
                        </div>
                        <div>
                          <div style={{ color: 'var(--text-tertiary)', fontSize: 11, marginBottom: 4 }}>Thiếu điểm</div>
                          <div style={{ fontWeight: 590, color: analysis.missingScoreCount > 0 ? 'var(--status-error)' : 'var(--status-success)' }}>
                            {analysis.missingScoreCount}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {!analysis.hasSession ? (
                  <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-quaternary)' }}>
                    Lớp chưa có buổi {checkpointView === 'cp1' ? '5' : checkpointView === 'cp2' ? '9' : '14'}
                  </div>
                ) : analysis.students.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-quaternary)' }}>
                    Buổi học chưa có dữ liệu học viên
                  </div>
                ) : (
                  <div className={styles.tableScrollWrapper}>
                    <table className={styles.studentTable}>
                      <thead>
                        <tr>
                          <th>{LABELS.STUDENT}</th>
                          <th>Trạng thái</th>
                          {checkpointView !== 'demo' ? (
                            <>
                              <th>Lý thuyết</th>
                              <th>Thực hành</th>
                              <th>Năng lực</th>
                              <th>Điểm CP</th>
                            </>
                          ) : (
                            <>
                              <th>Sản phẩm</th>
                              <th>Năng lực</th>
                              <th>Điểm Demo</th>
                            </>
                          )}
                          <th>TBCK</th>
                          <th>Xếp loại</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analysis.students.map((st: any) => {
                          const qualityBandLabel = checkpointView === 'demo'
                            ? (st.qualityBand === 'good' ? 'Tốt' : st.qualityBand === 'medium' ? 'Trung bình' : st.qualityBand === 'poor' ? 'Kém' : '—')
                            : (st.qualityBand === 'excellent' ? 'Xuất sắc' : st.qualityBand === 'good' ? 'Tốt' : st.qualityBand === 'average' ? 'Trung bình' : st.qualityBand === 'poor' ? 'Yếu' : '—');
                          
                          const qualityBandColor = checkpointView === 'demo'
                            ? (st.qualityBand === 'good' ? 'var(--status-success)' : st.qualityBand === 'medium' ? 'var(--status-warning)' : 'var(--status-error)')
                            : (st.qualityBand === 'excellent' ? 'var(--status-success)' : st.qualityBand === 'good' ? 'var(--status-success)' : st.qualityBand === 'average' ? 'var(--status-warning)' : 'var(--status-error)');
                          
                          const finalScore = checkpointView === 'demo' ? st.demoScore : st.checkpointScore;
                          
                          // Calculate TBCK for this student
                          // Need to find this student's scores across all checkpoints
                          const cp1Student = selectedClassForCheckpoint.cp1Analysis.students.find((s: any) => s.studentId === st.studentId) as any;
                          const cp2Student = selectedClassForCheckpoint.cp2Analysis.students.find((s: any) => s.studentId === st.studentId) as any;
                          const demoStudent = selectedClassForCheckpoint.demoAnalysis.students.find((s: any) => s.studentId === st.studentId) as any;
                          
                          const cp1Score = cp1Student?.checkpointScore ?? null;
                          const cp2Score = cp2Student?.checkpointScore ?? null;
                          const demoScore = demoStudent?.demoScore ?? null;
                          
                          const tbck = computeTBCK(cp1Score, cp2Score, demoScore);
                          const { rank, label: rankLabel } = determineRank(tbck, demoScore);
                          
                          return (
                            <tr key={st.studentId}>
                              <td style={{ fontWeight: 510 }}>{st.studentName}</td>
                              <td><AttendanceStatusBadge status={st.attendanceStatus} /></td>
                              {checkpointView !== 'demo' ? (
                                <>
                                  <td style={{ textAlign: 'center' }}>{st.theoryScore !== null ? st.theoryScore.toFixed(1) : '—'}</td>
                                  <td style={{ textAlign: 'center' }}>{st.practiceScore !== null ? st.practiceScore.toFixed(1) : '—'}</td>
                                  <td style={{ textAlign: 'center' }}>{st.abilityScore !== null ? st.abilityScore.toFixed(1) : '—'}</td>
                                  <td style={{ textAlign: 'center', fontWeight: 600, color: finalScore !== null ? (finalScore >= 3.5 ? 'var(--status-success)' : 'var(--status-error)') : 'var(--text-quaternary)' }}>
                                    {finalScore !== null ? finalScore.toFixed(2) : '—'}
                                  </td>
                                </>
                              ) : (
                                <>
                                  <td style={{ textAlign: 'center' }}>{st.productScore !== null ? st.productScore.toFixed(1) : '—'}</td>
                                  <td style={{ textAlign: 'center' }}>{st.abilityScore !== null ? st.abilityScore.toFixed(1) : '—'}</td>
                                  <td style={{ textAlign: 'center', fontWeight: 600, color: finalScore !== null ? (finalScore >= 3 ? 'var(--status-success)' : 'var(--status-error)') : 'var(--text-quaternary)' }}>
                                    {finalScore !== null ? finalScore.toFixed(2) : '—'}
                                  </td>
                                </>
                              )}
                              <td style={{ textAlign: 'center', fontWeight: 600, fontSize: 13, color: tbck !== null ? (tbck >= 4 ? 'var(--status-success)' : tbck >= 3.5 ? 'var(--status-warning)' : 'var(--status-error)') : 'var(--text-quaternary)' }}>
                                {tbck !== null ? tbck.toFixed(2) : '—'}
                              </td>
                              <td>
                                {rank && (
                                  <span style={{ 
                                    fontSize: '11px', 
                                    padding: '4px 10px', 
                                    borderRadius: '4px', 
                                    background: `${getRankColor(rank)}15`,
                                    color: getRankColor(rank), 
                                    fontWeight: 600,
                                    border: `1px solid ${getRankColor(rank)}40`
                                  }}>
                                    {rank} - {rankLabel}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          );
        })()}
      </Modal>

      <CSVExportSettings
        isOpen={showCommentCSVSettings}
        onClose={() => setShowCommentCSVSettings(false)}
        columns={commentCSVColumns}
        onSave={saveCommentColumns}
        title="Cài đặt xuất CSV - Tình trạng Nhận xét"
      />
      
      <CSVExportSettings
        isOpen={showAttendanceCSVSettings}
        onClose={() => setShowAttendanceCSVSettings(false)}
        columns={attendanceCSVColumns}
        onSave={saveAttendanceColumns}
        title="Cài đặt xuất CSV - Tình trạng Chuyên cần"
      />
      
      <CSVExportSettings
        isOpen={showReschedulingCSVSettings}
        onClose={() => setShowReschedulingCSVSettings(false)}
        columns={reschedulingCSVColumns}
        onSave={saveReschedulingColumns}
        title="Cài đặt xuất CSV - Thay đổi lịch học"
      />
    </>
  );
}

// ─── CSV Export Configuration ─────────────────────────────────────────────────
// Comment Violations Table
function getDefaultCommentCSVColumns(): CSVColumnConfig[] {
  return [
    { id: 'code', label: 'Mã lớp', enabled: true },
    { id: 'courseLine', label: 'Khối học', enabled: true },
    { id: 'centre', label: 'Cơ sở', enabled: true },
    { id: 'teacher', label: 'Giáo viên', enabled: true },
    { id: 'sessionsCompleted', label: 'Buổi đã học', enabled: true },
    { id: 'totalSessions', label: 'Tổng buổi', enabled: true },
    { id: 'briefCount', label: `Nhận xét ${COMMENT_STATUS_COUNT_LABELS.brief}`, enabled: true },
    { id: 'emptyCount', label: `Nhận xét ${COMMENT_STATUS_COUNT_LABELS.empty}`, enabled: true },
    { id: 'overdueCount', label: `Nhận xét ${COMMENT_STATUS_COUNT_LABELS.overdue}`, enabled: true },
    { id: 'duplicateCount', label: `Nhận xét ${COMMENT_STATUS_COUNT_LABELS.duplicate}`, enabled: true },
    { id: 'totalViolations', label: 'Tổng vi phạm', enabled: true },
  ];
}

function getCommentCSVColumnsFromConfig(config: CSVColumnConfig[]): CSVColumn<AnalyzedClassForQuality>[] {
  const columnMap: Record<string, CSVColumn<AnalyzedClassForQuality>> = {
    code: { header: 'Mã lớp', accessor: (row) => row.cls.name },
    courseLine: { header: 'Khối học', accessor: 'courseLineName' },
    centre: { header: 'Cơ sở', accessor: (row) => row.cls.centre?.name || '—' },
    teacher: { header: 'Giáo viên', accessor: (row) => getPrimaryTeacher(row.cls) },
    sessionsCompleted: { header: 'Buổi đã học', accessor: (row) => row.commentAnalysis.passedSlots },
    totalSessions: { header: 'Tổng buổi', accessor: (row) => row.cls.numberOfSessions || row.cls.slots?.length || 0 },
    briefCount: { header: `Nhận xét ${COMMENT_STATUS_COUNT_LABELS.brief}`, accessor: (row) => row.commentAnalysis.briefCount },
    emptyCount: { header: `Nhận xét ${COMMENT_STATUS_COUNT_LABELS.empty}`, accessor: (row) => row.commentAnalysis.emptyCount },
    overdueCount: { header: `Nhận xét ${COMMENT_STATUS_COUNT_LABELS.overdue}`, accessor: (row) => row.commentAnalysis.overdueCount },
    duplicateCount: { header: `Nhận xét ${COMMENT_STATUS_COUNT_LABELS.duplicate}`, accessor: (row) => row.commentAnalysis.duplicateCount },
    totalViolations: { 
      header: 'Tổng vi phạm', 
      accessor: (row) => 
        row.commentAnalysis.emptyCount + 
        row.commentAnalysis.briefCount + 
        row.commentAnalysis.duplicateCount + 
        row.commentAnalysis.overdueCount 
    },
  };
  
  return config
    .filter(col => col.enabled)
    .map(col => columnMap[col.id])
    .filter(Boolean);
}

// Attendance Alerts Table
function getDefaultAttendanceCSVColumns(): CSVColumnConfig[] {
  return [
    { id: 'code', label: 'Mã lớp', enabled: true },
    { id: 'courseLine', label: 'Khối học', enabled: true },
    { id: 'centre', label: 'Cơ sở', enabled: true },
    { id: 'teacher', label: 'Giáo viên', enabled: true },
    { id: 'totalStudents', label: 'Tổng học viên', enabled: true },
    { id: 'frequentAbsent', label: ATTENDANCE_ALERT_LABELS.frequent_absent, enabled: true },
    { id: 'consecutiveAbsent', label: ATTENDANCE_ALERT_LABELS.consecutive_absent, enabled: true },
    { id: 'lateStageAbsent', label: ATTENDANCE_ALERT_LABELS.late_stage_absent, enabled: true },
    { id: 'totalAlerts', label: 'Tổng cảnh báo', enabled: true },
  ];
}

function getAttendanceCSVColumnsFromConfig(config: CSVColumnConfig[]): CSVColumn<AnalyzedClassForQuality>[] {
  const columnMap: Record<string, CSVColumn<AnalyzedClassForQuality>> = {
    code: { header: 'Mã lớp', accessor: (row) => row.cls.name },
    courseLine: { header: 'Khối học', accessor: 'courseLineName' },
    centre: { header: 'Cơ sở', accessor: (row) => row.cls.centre?.name || '—' },
    teacher: { header: 'Giáo viên', accessor: (row) => getPrimaryTeacher(row.cls) },
    totalStudents: { header: 'Tổng học viên', accessor: (row) => row.attendanceAnalysis.totalStudents },
    frequentAbsent: { 
      header: ATTENDANCE_ALERT_LABELS.frequent_absent, 
      accessor: (row) => row.attendanceAnalysis.studentsWithAlerts.filter(st => st.alerts.includes('frequent_absent')).length 
    },
    consecutiveAbsent: { 
      header: ATTENDANCE_ALERT_LABELS.consecutive_absent, 
      accessor: (row) => row.attendanceAnalysis.studentsWithAlerts.filter(st => st.alerts.includes('consecutive_absent')).length 
    },
    lateStageAbsent: { 
      header: ATTENDANCE_ALERT_LABELS.late_stage_absent, 
      accessor: (row) => row.attendanceAnalysis.studentsWithAlerts.filter(st => st.alerts.includes('late_stage_absent')).length 
    },
    totalAlerts: { header: 'Tổng cảnh báo', accessor: (row) => row.attendanceAnalysis.totalAlerts },
  };
  
  return config
    .filter(col => col.enabled)
    .map(col => columnMap[col.id])
    .filter(Boolean);
}


// Session Rescheduling Table
function getDefaultReschedulingCSVColumns(): CSVColumnConfig[] {
  return [
    { id: 'code', label: 'Mã lớp', enabled: true },
    { id: 'courseLine', label: 'Khối học', enabled: true },
    { id: 'centre', label: 'Cơ sở', enabled: true },
    { id: 'teacher', label: 'Giáo viên', enabled: true },
    { id: 'classType', label: 'Loại lớp', enabled: true },
    { id: 'avgDays', label: 'TB ngày/buổi', enabled: true },
    { id: 'totalSessions', label: 'Tổng buổi', enabled: true },
    { id: 'rescheduledCount', label: 'Buổi bị dời', enabled: true },
    { id: 'rescheduledRate', label: 'Tỷ lệ dời (%)', enabled: true },
  ];
}

function getReschedulingCSVColumnsFromConfig(config: CSVColumnConfig[]): CSVColumn<AnalyzedClassForQuality>[] {
  const columnMap: Record<string, CSVColumn<AnalyzedClassForQuality>> = {
    code: { header: 'Mã lớp', accessor: (row) => row.cls.name },
    courseLine: { header: 'Khối học', accessor: 'courseLineName' },
    centre: { header: 'Cơ sở', accessor: (row) => row.cls.centre?.name || '—' },
    teacher: { header: 'Giáo viên', accessor: (row) => getPrimaryTeacher(row.cls) },
    classType: { 
      header: 'Loại lớp', 
      accessor: (row) => row.reschedulingAnalysis.classType === 'regular' ? 'Thường' : 'Tăng cường' 
    },
    avgDays: { 
      header: 'TB ngày/buổi', 
      accessor: (row) => row.reschedulingAnalysis.averageDaysBetweenSessions.toFixed(1) 
    },
    totalSessions: { 
      header: 'Tổng buổi', 
      accessor: (row) => row.reschedulingAnalysis.totalSessions 
    },
    rescheduledCount: { 
      header: 'Buổi bị dời', 
      accessor: (row) => row.reschedulingAnalysis.rescheduledSessions 
    },
    rescheduledRate: { 
      header: 'Tỷ lệ dời (%)', 
      accessor: (row) => {
        const rate = row.reschedulingAnalysis.totalSessions > 0 
          ? (row.reschedulingAnalysis.rescheduledSessions / row.reschedulingAnalysis.totalSessions) * 100 
          : 0;
        return rate.toFixed(1);
      }
    },
  };
  
  return config
    .filter(col => col.enabled)
    .map(col => columnMap[col.id])
    .filter(Boolean);
}
