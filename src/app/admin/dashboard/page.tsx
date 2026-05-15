'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { PageLayout } from '@/components/PageLayout';
import { ProtectedPage } from '@/components/ProtectedPage';
import { Icon, ToastContainer, useToast, Toolbar, KPIStatCard } from '@/components/ui';
import { ActionableInsight } from '@/components/dashboard/ActionableInsight';
import { getCache, setCache, clearCache } from '@/lib/idb';
import { authFetch } from '@/lib/auth/clientAuth';
import { CACHE_KEYS, FORMAT, ANIMATION, DATE_UTILS, MESSAGES, CLASS_INACTIVE_STATUSES, ENTITIES, TEACHER_SCHEDULE_CACHE_VERSION, KPI_LABELS } from '@/constants';
import { useSharedFilterState } from '@/hooks/useSharedFilterState';
import { analyzeComments, analyzeAttendance } from '@/lib/classQualityAnalysis';
import {
  calcCompletionRate,
  calcTeacherChangeRate,
  calcSurveyScore,
  calcConversionRate,
} from '@/lib/kpiCalculations';
import { buildTeacherPointRowsFromGoogleSheets, calcTeacherPointRate } from '@/lib/teacherPointKpi';
import {
  completionScore,
  teacherChangeScore,
  surveyScore as surveyKpiScore,
  teacherPointScore,
  conversionScore,
  multiTeacherScore,
  kpiColor,
  KPI_COLORS
} from '@/lib/kpiScoring';
import { fetchAllClasses, fetchPendingSurveyClasses, fetchStudentCommentAreas, dateRangeToUtcRange, GET_CLASSES_LIGHT_QUERY } from '@/services/classesService';
import { fetchAllCentres, Centre } from '@/services/centresService';
import { fetchTickets } from '@/services/ticketService';
import { fetchOfficeHours } from '@/services/officeHoursService';
import { getTeachers } from '@/services/teacherService';
import { fetchTeacherSchedules } from '@/services/teacherScheduleService';
import styles from '../../dashboard.module.css';

export default function DashboardPage() {
  const { toasts, addToast, removeToast } = useToast();
  const { saveFilterState } = useSharedFilterState(false); // Don't auto-load, we manage state here

  // Centres
  const [centres, setCentres] = useState<Centre[]>([]);
  const [centresLoading, setCentresLoading] = useState(false);
  const [selectedCentres, setSelectedCentres] = useState<string[]>([]);

  // Date range
  const defaultRange = DATE_UTILS.defaultMonthRange();
  const [fromDate, setFromDate] = useState(defaultRange.from);
  const [toDate, setToDate] = useState(defaultRange.to);

  // Loading states
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ loaded: 0, total: 0 });
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cache data states
  const [completionData, setCompletionData] = useState<any>(null);
  const [teacherChangeData, setTeacherChangeData] = useState<any>(null);
  const [ticketsData, setTicketsData] = useState<any>(null);
  const [officeHoursData, setOfficeHoursData] = useState<any>(null);
  const [classQualityData, setClassQualityData] = useState<any>(null);

  // Load centres on mount
  useEffect(() => {
    loadCentres();
    loadCachedData();
    loadFilterState();
  }, []);

  async function loadCentres() {
    setCentresLoading(true);
    try {
      // Check cache first
      const cached = await getCache(CACHE_KEYS.CENTRES);
      if (cached?.centres?.length) {
        setCentres(cached.centres);
        return;
      }
      
      // Fetch from API if not cached
      const data = await fetchAllCentres();
      setCentres(data);
      await setCache(CACHE_KEYS.CENTRES, { centres: data });
    } catch (err) {
      console.error('Failed to load centres:', err);
      addToast('Không thể tải danh sách cơ sở', 'error');
    } finally {
      setCentresLoading(false);
    }
  }

  async function loadCachedData() {
    try {
      const [completion, teacherChange, tickets, officeHours, classQuality, teachers] = await Promise.all([
        getCache(CACHE_KEYS.COMPLETION),
        getCache(CACHE_KEYS.TEACHER_CHANGE),
        getCache(CACHE_KEYS.TICKETS),
        getCache(CACHE_KEYS.OFFICE_HOURS),
        getCache(CACHE_KEYS.CLASS_QUALITY),
        getCache(CACHE_KEYS.TEACHERS),
      ]);

      setCompletionData(completion);
      setTeacherChangeData(teacherChange);
      setTicketsData(tickets);
      setOfficeHoursData(officeHours);
      setClassQualityData(classQuality);
    } catch (err) {
      console.error('Failed to load cached data:', err);
    }
  }

  async function loadFilterState() {
    try {
      const filterState = await getCache(CACHE_KEYS.FILTER_STATE);
      if (filterState) {
        if (filterState.selectedCentres) setSelectedCentres(filterState.selectedCentres);
        if (filterState.fromDate) setFromDate(filterState.fromDate);
        if (filterState.toDate) setToDate(filterState.toDate);
      }
    } catch (err) {
      console.error('Failed to load filter state:', err);
    }
  }

  // Fetch all data from APIs
  async function handleFetchData() {
    if (!fromDate || !toDate) {
      addToast('Vui lòng chọn khoảng thời gian', 'error');
      return;
    }

    if (new Date(fromDate) > new Date(toDate)) {
      addToast('Ngày bắt đầu phải trước ngày kết thúc', 'error');
      return;
    }

    setLoading(true);
    setProgress({ loaded: 0, total: 0 });
    
    // Create separate abort controllers for each request
    const classesController = new AbortController();
    const ticketsController = new AbortController();
    const pendingSurveyController = new AbortController();
    const sheetsController = new AbortController();
    const commentAreasController = new AbortController();
    const officeHoursController = new AbortController();
    const teachersController = new AbortController();
    const teacherSchedulesController = new AbortController();
    
    // Store all controllers so we can abort all
    abortControllerRef.current = {
      abort: () => {
        classesController.abort();
        ticketsController.abort();
        pendingSurveyController.abort();
        sheetsController.abort();
        commentAreasController.abort();
        officeHoursController.abort();
        teachersController.abort();
        teacherSchedulesController.abort();
      }
    } as any;

    try {
      const { endDateFrom, endDateTo } = dateRangeToUtcRange(new Date(fromDate), new Date(toDate));
      const centreIds = selectedCentres.length > 0 ? selectedCentres : centres.map(c => c.id);
      let sheetUrl = `/api/google-sheets?_t=${Date.now()}`;
      if (fromDate) sheetUrl += `&fromDate=${encodeURIComponent(fromDate)}`;
      if (toDate) sheetUrl += `&toDate=${encodeURIComponent(toDate)}`;
      if (selectedCentres.length > 0) {
        const shortCodes = selectedCentres
          .map(id => centres.find(c => c.id === id)?.shortName)
          .filter(Boolean);
        if (shortCodes.length > 0) sheetUrl += `&center=${encodeURIComponent(shortCodes.join(','))}`;
      }

      // Save filter state for other pages to use
      console.log('[Dashboard] Saving filter state:', {
        selectedCentres: centreIds,
        fromDate,
        toDate,
      });
      await saveFilterState({
        selectedCentres: centreIds,
        fromDate,
        toDate,
      });

      // Step 1: Fetch teacher schedules (includes classes data)
      const teacherSchedulesToastId = addToast('Đang tải lịch giáo viên...', 'loading');
      const classesToastId = addToast(MESSAGES.LOADING.LOADING_CLASSES, 'loading');
      const ticketsToastId = addToast(MESSAGES.LOADING.LOADING_TICKETS, 'loading');
      const teachersToastId = addToast('Đang tải dữ liệu giáo viên...', 'loading');
      
      const dateFrom = new Date(fromDate);
      const dateTo = new Date(toDate);
      dateFrom.setHours(0, 0, 0, 0);
      dateTo.setHours(23, 59, 59, 999);
      
      // 🚀 CONCURRENT FUSION: Fire ALL four massive data streams in parallel for ultimate speed!
      let schLoaded = 0, schTotal = 0;
      let clsLoaded = 0, clsTotal = 0;
      let ticLoaded = 0, ticTotal = 0;
      let pendingLoaded = 0, pendingTotal = 0;
      let teaLoaded = 0, teaTotal = 0;

      const refreshAggProgress = () => {
        const finalLoaded = schLoaded + clsLoaded + ticLoaded + pendingLoaded + teaLoaded;
        const finalTotal = Math.max((schTotal || 0) + (clsTotal || 0) + (ticTotal || 0) + (pendingTotal || 0) + (teaTotal || 0), 1);
        setProgress({ loaded: finalLoaded, total: finalTotal });
      };

      const [
        scheduleData,
        classesResult,
        ticketsResult,
        pendingSurveyClasses,
        googleSheetsResult,
        studentCommentAreas,
        teachersResult
      ] = await Promise.all([
        // 1. Teacher Schedules
        fetchTeacherSchedules(
          dateFrom,
          dateTo,
          centreIds,
          undefined,
          (loaded, total) => {
            schLoaded = loaded;
            schTotal = total || 0;
            refreshAggProgress();
          },
          teacherSchedulesController.signal
        ).then(res => { removeToast(teacherSchedulesToastId); return res; }),

        // 2. All Classes (KPIs)
        fetchAllClasses(
          { centres: centreIds, endDateFrom, endDateTo },
          (loaded, total) => {
            clsLoaded = loaded;
            clsTotal = total || 0;
            refreshAggProgress();
          },
          classesController.signal,
          GET_CLASSES_LIGHT_QUERY
        ).then(res => { removeToast(classesToastId); return res; }),

        // 3. Tickets
        fetchTickets(
          {
            centreId_in: centreIds,
            createdAt_gte: new Date(fromDate).toISOString(),
            createdAt_lte: new Date(toDate).toISOString(),
          },
          (loaded, total) => {
            ticLoaded = loaded;
            ticTotal = total || 0;
            refreshAggProgress();
          },
          ticketsController.signal
        ).then(res => { removeToast(ticketsToastId); return res; }),

        // 4. Classes that need teacher survey collection
        fetchPendingSurveyClasses(
          dateFrom,
          dateTo,
          centreIds,
          (loaded, total) => {
            pendingLoaded = loaded;
            pendingTotal = total || 0;
            refreshAggProgress();
          },
          pendingSurveyController.signal
        ),

        // 5. Google Sheets Teacher Survey submissions
        authFetch(sheetUrl, { signal: sheetsController.signal })
          .then(r => r.json())
          .catch(err => {
            console.error('Sheet fetch error:', err);
            return { data: [] };
          }),

        // 6. Comment area definitions used by /admin/operations quality table
        fetchStudentCommentAreas(
          Array.from({ length: 30 }, (_, i) => String(i + 1)).concat('final'),
          commentAreasController.signal
        ).catch(err => {
          console.warn('Unable to fetch student comment areas:', err);
          return [];
        }),

        // 7. Teachers (Internal paging handles concurrency flawlessly now!)
        getTeachers(
          { centers: centreIds, orderBy: 'createdAt_desc' },
          teachersController.signal,
          (loaded, total) => {
            teaLoaded = loaded;
            teaTotal = total || 0;
            refreshAggProgress();
          }
        ).then(res => { removeToast(teachersToastId); return res; }),
      ]);

      // Extract result data correctly
      const { schedules: teacherSchedulesResult, rawClasses: activeClassesResult, rawOfficeHours: officeHoursResultData } = scheduleData;
      const allTeachers = teachersResult.data;

      // Process and cache data for each KPI
      const completionCache = { classes: classesResult, timestamp: Date.now() };
      const teacherChangeCache = { classes: classesResult, timestamp: Date.now() };
      const classQualityCache = { 
        classes: activeClassesResult, // Quality uses ACTIVE classes derived from operations fetch
        violations: [], 
        attendanceWarnings: [], 
        timestamp: Date.now() 
      };
      const ticketsCache = {
        tickets: ticketsResult.data,
        pendingClasses: pendingSurveyClasses,
        googleSheetsRawData: googleSheetsResult?.data || [],
        timestamp: Date.now(),
      };
      const officeHoursCache = { officeHours: officeHoursResultData, timestamp: Date.now() };
      const teachersCache = { teachers: allTeachers, timestamp: Date.now() };
      const teacherSchedulesCache = { 
        version: TEACHER_SCHEDULE_CACHE_VERSION,
        schedules: teacherSchedulesResult, 
        rawClasses: activeClassesResult, // Critical hydration for /admin/operations visibility
        studentCommentAreas,
        dateFrom: fromDate,
        dateTo: toDate,
        loadedCentreIds: centreIds,
        loadedRange: { from: fromDate, to: toDate },
        timestamp: Date.now(),
        selectedTeachers: [],
        selectedCourseLines: [],
        calendarCentreFilter: [],
        scheduleTypeFilter: 'ALL',
        exemptedSessions: [],
        exemptOneOnOneClasses: true,
        holidayPeriods: []
      };

      await Promise.all([
        setCache(CACHE_KEYS.COMPLETION, completionCache),
        setCache(CACHE_KEYS.TEACHER_CHANGE, teacherChangeCache),
        setCache(CACHE_KEYS.CLASS_QUALITY, classQualityCache),
        setCache(CACHE_KEYS.TICKETS, ticketsCache),
        setCache(CACHE_KEYS.OFFICE_HOURS, officeHoursCache),
        setCache(CACHE_KEYS.TEACHERS, teachersCache),
        setCache(CACHE_KEYS.TEACHER_SCHEDULE, teacherSchedulesCache),
      ]);

      setCompletionData(completionCache);
      setTeacherChangeData(teacherChangeCache);
      setClassQualityData(classQualityCache);
      setTicketsData(ticketsCache);
      setOfficeHoursData(officeHoursCache);

      addToast(
        `Tải thành công ${classesResult.length} lớp, ${ticketsResult.data.length} phiếu, ${officeHoursResultData.length} ca, ${allTeachers.length} GV, ${teacherSchedulesResult.length} lịch dạy!`, 
        'success'
      );
    } catch (err: any) {
      if (err.message === 'Aborted' || err.name === 'AbortError') {
        addToast('Đã dừng tải dữ liệu', 'info');
      } else {
        console.error('Failed to fetch data:', err);
        addToast('Không thể tải dữ liệu', 'error');
      }
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  }

  function handleCancel() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }

  async function handleClearCache() {
    try {
      await Promise.all([
        clearCache(CACHE_KEYS.COMPLETION),
        clearCache(CACHE_KEYS.TEACHER_CHANGE),
        clearCache(CACHE_KEYS.TICKETS),
        clearCache(CACHE_KEYS.OFFICE_HOURS),
        clearCache(CACHE_KEYS.CLASS_QUALITY),
        clearCache(CACHE_KEYS.TEACHERS),
        clearCache(CACHE_KEYS.TEACHER_SCHEDULE),
      ]);
      
      setCompletionData(null);
      setTeacherChangeData(null);
      setTicketsData(null);
      setOfficeHoursData(null);
      setClassQualityData(null);
      
      addToast('Đã xoá tất cả dữ liệu tạm', 'success');
    } catch (err) {
      console.error('Failed to clear caches:', err);
      addToast('Không thể xoá dữ liệu tạm', 'error');
    }
  }

  // KPI Calculations — all use shared functions from kpiCalculations.ts so numbers
  // match the individual pages (default exemptions applied consistently).
  const completionKpi = useMemo(() => {
    if (!completionData?.classes) return null;
    try {
      return calcCompletionRate(
        completionData.classes,
        completionData.exemptedReasons,   // use saved user preferences if present
        completionData.exemptedCourses
      );
    } catch (err) {
      console.error('Error calculating completion rate:', err);
      return null;
    }
  }, [completionData]);

  const completionRate = completionKpi?.rate ?? null;

  const { teacherChangeRate, multiTeacherRate, activeTeacherChangeClassesCount } = useMemo(() => {
    if (!teacherChangeData?.classes) return { teacherChangeRate: null, multiTeacherRate: null, activeTeacherChangeClassesCount: 0 };
    try {
      const result = calcTeacherChangeRate(teacherChangeData.classes);
      return {
        teacherChangeRate: result.changeRate,
        multiTeacherRate: result.multiTeacherRate,
        activeTeacherChangeClassesCount: result.totalClasses,
      };
    } catch (err) {
      console.error('Error calculating teacher change rate:', err);
      return { teacherChangeRate: null, multiTeacherRate: null, activeTeacherChangeClassesCount: 0 };
    }
  }, [teacherChangeData]);

  const surveyScore = useMemo(() => {
    if (!ticketsData?.tickets) return null;
    try {
      return calcSurveyScore(ticketsData.tickets);
    } catch (err) {
      console.error('Error calculating survey score:', err);
      return null;
    }
  }, [ticketsData]);

  const teacherPointKpi = useMemo(() => {
    if (!ticketsData?.pendingClasses || !ticketsData?.googleSheetsRawData) return null;
    try {
      const rows = buildTeacherPointRowsFromGoogleSheets({
        rawData: ticketsData.googleSheetsRawData,
        classes: ticketsData.pendingClasses,
        fromDate,
        toDate,
        centres,
        selectedCentres,
      });
      return calcTeacherPointRate({
        classes: ticketsData.pendingClasses,
        rows,
        fromDate,
        toDate,
      });
    } catch (err) {
      console.error('Error calculating teacher survey rate:', err);
      return null;
    }
  }, [ticketsData, fromDate, toDate, centres, selectedCentres]);

  const conversionKpi = useMemo(() => {
    if (!officeHoursData?.officeHours) return null;
    try {
      return calcConversionRate(
        officeHoursData.officeHours,
        officeHoursData.exemptTypes,
        officeHoursData.exemptStatuses,
        officeHoursData.exemptAppointmentStatuses
      );
    } catch (err) {
      console.error('Error calculating conversion rate:', err);
      return null;
    }
  }, [officeHoursData]);

  const conversionRate = conversionKpi?.rate ?? null;

  // Count-based color helper
  const getCountColor = (count: number, thresholds: [number, number, number, number]): string => {
    if (count === 0) return KPI_COLORS[5]; // Green
    if (count <= thresholds[0]) return KPI_COLORS[4]; // Lime
    if (count <= thresholds[1]) return KPI_COLORS[3]; // Amber
    if (count <= thresholds[2]) return KPI_COLORS[2]; // Orange
    return KPI_COLORS[1]; // Red
  };

  // Comment violations count
  const commentViolationsCount = useMemo(() => {
    if (!classQualityData?.classes) return null;
    try {
      const activeClasses = classQualityData.classes.filter((cls: any) => 
        !CLASS_INACTIVE_STATUSES.has(cls.status?.toUpperCase?.())
      );
      
      // Use EXACT logic from class-quality page - use analyzeComments function
      let violationCount = 0;
      activeClasses.forEach((cls: any) => {
        const analysis = analyzeComments(cls);
        const issues = analysis.emptyCount + analysis.briefCount + analysis.duplicateCount + analysis.overdueCount;
        if (issues > 0) violationCount++;
      });
      
      return violationCount;
    } catch (err) {
      console.error('Error calculating comment violations:', err);
      return null;
    }
  }, [classQualityData]);

  // Attendance alerts count
  const attendanceAlertsCount = useMemo(() => {
    if (!classQualityData?.classes) return null;
    try {
      const activeClasses = classQualityData.classes.filter((cls: any) => 
        !CLASS_INACTIVE_STATUSES.has(cls.status?.toUpperCase?.())
      );
      
      // Use EXACT logic from class-quality page - use analyzeAttendance function
      let alertCount = 0;
      activeClasses.forEach((cls: any) => {
        const analysis = analyzeAttendance(cls);
        if (analysis.totalAlerts > 0) alertCount++;
      });
      
      return alertCount;
    } catch (err) {
      console.error('Error calculating attendance alerts:', err);
      return null;
    }
  }, [classQualityData]);

  // New tickets count
  const newTicketsCount = useMemo(() => {
    if (!ticketsData?.tickets) return null;
    try {
      return ticketsData.tickets.filter((t: any) => 
        t.status === 'NEW' || t.status === 'OPEN'
      ).length;
    } catch {
      return null;
    }
  }, [ticketsData]);

  const kpiHealth = useMemo(() => {
    const items: Array<{
      id: string;
      label: string;
      value: string;
      score: 1 | 2 | 3 | 4 | 5;
      description: string;
      action: string;
      href: string;
      icon: React.ReactNode;
      color: string;
      priority: number;
    }> = [];

    if (completionRate !== null) {
      const score = completionScore(completionRate);
      const neededFor95 = completionKpi
        ? Math.max(0, Math.ceil(0.95 * completionKpi.totalBase - completionKpi.totalPass))
        : 0;
      items.push({
        id: 'completion',
        label: KPI_LABELS.COMPLETION_RATE,
        value: FORMAT.percentage(completionRate),
        score,
        description: `${completionKpi?.totalPass ?? 0}/${completionKpi?.totalBase ?? 0} học viên đạt`,
        action: neededFor95 > 0 ? `Cần thêm ${neededFor95} học viên đạt để chạm mốc 95%` : 'Đang đạt mốc vận hành 95%',
        href: '/admin/completion-rate',
        icon: <Icon.CheckCircle size={18} />,
        color: kpiColor(score),
        priority: 100 - score * 10,
      });
    }

    if (teacherChangeRate !== null) {
      const score = teacherChangeScore(teacherChangeRate);
      items.push({
        id: 'teacher-change',
        label: KPI_LABELS.TEACHER_CHANGE_RATE,
        value: FORMAT.percentage(teacherChangeRate),
        score,
        description: `${activeTeacherChangeClassesCount} lớp có buổi học trong kỳ`,
        action: teacherChangeRate > 3 ? 'Ưu tiên các lớp đã đổi LEC để giữ tỷ lệ về dưới 3%' : 'Tỷ lệ thay LEC đang trong vùng kiểm soát',
        href: '/admin/teacher-change',
        icon: <Icon.Repeat size={18} />,
        color: kpiColor(score),
        priority: 90 - score * 10,
      });
    }

    if (multiTeacherRate !== null) {
      const score = multiTeacherScore(multiTeacherRate);
      items.push({
        id: 'multi-teacher',
        label: KPI_LABELS.MULTI_TEACHER_RATE,
        value: FORMAT.percentage(multiTeacherRate),
        score,
        description: `${activeTeacherChangeClassesCount} lớp có buổi học trong kỳ`,
        action: multiTeacherRate > 0.5 ? 'Rà các lớp có 3+ giáo viên để khóa lại phương án nhân sự' : 'Tỷ lệ lớp có nhiều giáo viên đang thấp',
        href: '/admin/teacher-change',
        icon: <Icon.Users size={18} />,
        color: kpiColor(score),
        priority: 80 - score * 10,
      });
    }

    if (surveyScore !== null) {
      const score = surveyKpiScore(surveyScore);
      items.push({
        id: 'survey-score',
        label: KPI_LABELS.SURVEY_SCORE,
        value: surveyScore.toFixed(1),
        score,
        description: `${ticketsData?.tickets?.length || 0} phiếu phản hồi`,
        action: surveyScore < 4.5 ? 'Mở nhóm phiếu điểm thấp để xử lý nguyên nhân theo giáo viên/lớp' : 'Điểm khảo sát đang đạt vùng tốt',
        href: '/admin/tickets',
        icon: <Icon.User size={18} />,
        color: kpiColor(score),
        priority: 70 - score * 10,
      });
    }

    if (teacherPointKpi?.rate !== null && teacherPointKpi?.rate !== undefined) {
      const score = teacherPointScore(teacherPointKpi.rate);
      items.push({
        id: 'teacher-point-rate',
        label: KPI_LABELS.TEACHER_POINT_RATE,
        value: FORMAT.percentage(teacherPointKpi.rate),
        score,
        description: `${teacherPointKpi.collected}/${teacherPointKpi.eligible} học viên đã làm khảo sát`,
        action: teacherPointKpi.rate < 81 ? 'Ưu tiên các lớp tới mốc khảo sát nhưng chưa đủ phản hồi học viên' : 'Tỷ lệ lấy khảo sát đang trong vùng tốt',
        href: '/admin/tickets',
        icon: <Icon.CheckCircle size={18} />,
        color: kpiColor(score),
        priority: 65 - score * 10,
      });
    }

    if (conversionRate !== null) {
      const score = conversionScore(conversionRate);
      items.push({
        id: 'conversion-rate',
        label: KPI_LABELS.CONVERSION_RATE,
        value: FORMAT.percentage(conversionRate),
        score,
        description: `${conversionKpi?.convertedAppointments ?? 0}/${conversionKpi?.totalAppointments ?? 0} học viên có đơn`,
        action: conversionRate < 31 ? 'Kiểm tra các ca đã học thử nhưng chưa có đơn để follow-up' : 'Tỷ lệ chuyển đổi đang đạt vùng mục tiêu',
        href: '/admin/office-hours',
        icon: <Icon.TrendingUp size={18} />,
        color: kpiColor(score),
        priority: 60 - score * 10,
      });
    }

    return items;
  }, [
    completionRate,
    completionKpi,
    teacherChangeRate,
    multiTeacherRate,
    activeTeacherChangeClassesCount,
    surveyScore,
    teacherPointKpi,
    ticketsData,
    conversionRate,
    conversionKpi,
  ]);

  // Actionable Insights with severity calculation
  const insights = useMemo(() => {
    const result: Array<{
      id: string;
      title: string;
      description: string;
      severity: 'info' | 'warning' | 'critical';
      icon: React.ReactNode;
      href: string;
      priority: number;
    }> = [];

    kpiHealth
      .filter(kpi => kpi.score <= 3)
      .forEach((kpi, index) => {
        result.push({
          id: `kpi-${kpi.id}`,
          title: `${kpi.label}: KPI ${kpi.score}/5`,
          description: kpi.action,
          severity: kpi.score <= 2 ? 'critical' : 'warning',
          icon: kpi.icon,
          href: kpi.href,
          priority: 100 - kpi.score * 10 - index,
        });
      });

    // 3. Comment Violations
    if (commentViolationsCount !== null && commentViolationsCount > 0) {
      let severity: 'info' | 'warning' | 'critical' = 'info';
      if (commentViolationsCount > 20) severity = 'critical';
      else if (commentViolationsCount > 10) severity = 'warning';
      
      result.push({
        id: 'comment-violations',
        title: `${commentViolationsCount} vi phạm nhận xét cần kiểm tra`,
        description: severity === 'critical' ? 'Cần xử lý ngay' : 'Cần theo dõi',
        severity,
        icon: <Icon.XCircle size={16} />,
        href: '/admin/operations?view=quality-table&tab=violations',
        priority: severity === 'critical' ? 85 : severity === 'warning' ? 65 : 45,
      });
    }

    // 4. Attendance Alerts
    if (attendanceAlertsCount !== null && attendanceAlertsCount > 0) {
      let severity: 'info' | 'warning' | 'critical' = 'info';
      if (attendanceAlertsCount > 10) severity = 'critical';
      else if (attendanceAlertsCount > 6) severity = 'warning';
      
      result.push({
        id: 'attendance-alerts',
        title: `${attendanceAlertsCount} cảnh báo chuyên cần cần theo dõi`,
        description: severity === 'critical' ? 'Cần xử lý ngay' : 'Cần theo dõi',
        severity,
        icon: <Icon.AlertCircle size={16} />,
        href: '/admin/operations?view=quality-table&tab=attendance',
        priority: severity === 'critical' ? 80 : severity === 'warning' ? 60 : 40,
      });
    }

    // 5. New Tickets
    if (newTicketsCount !== null && newTicketsCount > 0) {
      let severity: 'info' | 'warning' | 'critical' = 'info';
      if (newTicketsCount > 20) severity = 'critical';
      else if (newTicketsCount > 10) severity = 'warning';
      
      result.push({
        id: 'new-tickets',
        title: `${newTicketsCount} phiếu đánh giá mới cần xử lý`,
        description: severity === 'critical' ? 'Cần xử lý ngay' : 'Cần xem xét',
        severity,
        icon: <Icon.Bell size={16} />,
        href: '/admin/tickets?status=new',
        priority: severity === 'critical' ? 75 : severity === 'warning' ? 55 : 35,
      });
    }

    return result.sort((a, b) => b.priority - a.priority).slice(0, 5);
  }, [
    kpiHealth,
    commentViolationsCount, 
    attendanceAlertsCount, 
    newTicketsCount,
  ]);

  const qualitySignals = useMemo(() => [
    {
      key: 'comment-violations',
      label: KPI_LABELS.COMMENT_QUALITY,
      value: commentViolationsCount !== null ? FORMAT.number(commentViolationsCount) : 'N/A',
      description: commentViolationsCount === 0 ? 'Không có lớp vi phạm nhận xét' : 'Lớp có nhận xét trống, ngắn, trùng hoặc quá hạn',
      color: commentViolationsCount !== null ? getCountColor(commentViolationsCount, [5, 10, 20, Infinity]) : 'var(--text-quaternary)',
      href: '/admin/operations?view=quality-table&tab=comments',
    },
    {
      key: 'attendance-alerts',
      label: KPI_LABELS.ATTENDANCE_QUALITY,
      value: attendanceAlertsCount !== null ? FORMAT.number(attendanceAlertsCount) : 'N/A',
      description: attendanceAlertsCount === 0 ? 'Không có lớp cần cảnh báo chuyên cần' : 'Lớp có chuỗi nghỉ/vắng cần theo dõi',
      color: attendanceAlertsCount !== null ? getCountColor(attendanceAlertsCount, [3, 6, 10, Infinity]) : 'var(--text-quaternary)',
      href: '/admin/operations?view=quality-table&tab=attendance',
    },
    {
      key: 'new-tickets',
      label: KPI_LABELS.NEW_FEEDBACK,
      value: newTicketsCount !== null ? FORMAT.number(newTicketsCount) : 'N/A',
      description: newTicketsCount === 0 ? 'Không có phiếu mới đang chờ xử lý' : 'Phiếu NEW/OPEN cần được đọc và phân loại',
      color: newTicketsCount !== null ? getCountColor(newTicketsCount, [5, 10, 20, Infinity]) : 'var(--text-quaternary)',
      href: '/admin/tickets?status=new',
    },
  ], [commentViolationsCount, attendanceAlertsCount, newTicketsCount]);

  // No quick links needed - removed per requirements

  // Check if user has any data
  const hasAnyData = completionData || teacherChangeData || ticketsData || officeHoursData || classQualityData;

  return (
    <ProtectedPage pageKey="dashboard">
      <PageLayout title="Tổng quan" activePage="dashboard">
        <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Toolbar */}
      <Toolbar
        centres={centres}
        selectedCentres={selectedCentres}
        onCentresChange={setSelectedCentres}
        centresLoading={centresLoading}
        dateFrom={fromDate}
        dateTo={toDate}
        onDateFromChange={setFromDate}
        onDateToChange={setToDate}
        onFetch={handleFetchData}
        loading={loading}
        progress={progress}
        hasData={hasAnyData}
        onClearCache={handleClearCache}
        onCancel={handleCancel}
        showRegionQuickSelect={true}
      />

      {/* Dashboard content */}
      {hasAnyData && (
        <>
          {/* Core KPIs Section */}
          <section aria-labelledby="core-kpi-section">
            <h2 id="core-kpi-section" style={{ 
              fontSize: 17, 
              fontWeight: 590, 
              marginBottom: 'var(--space-4)', 
              color: 'var(--text-primary)' 
            }}>
              Chỉ số KPI Chính
            </h2>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: 'var(--space-4)',
              marginBottom: 'var(--space-6)',
            }}>
              {kpiHealth.map((card, index) => (
                <KPIStatCard
                  key={card.id}
                  label={card.label}
                  value={card.value}
                  desc={card.description}
                  valueColor={card.color}
                  icon={card.icon}
                  href={card.href}
                  score={card.score}
                  delay={index * ANIMATION.STAT_CARD_DELAY}
                />
              ))}
            </div>
          </section>

          {/* Quality Metrics Section */}
          <section aria-labelledby="quality-kpi-section">
            <h2 id="quality-kpi-section" style={{ 
              fontSize: 17, 
              fontWeight: 590, 
              marginBottom: 'var(--space-4)', 
              color: 'var(--text-primary)' 
            }}>
              Chỉ số Chất lượng
            </h2>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: 'var(--space-4)',
              marginBottom: 'var(--space-6)',
            }}>
              {qualitySignals.map((card, index) => (
                <KPIStatCard
                  key={card.key}
                  label={card.label}
                  value={card.value}
                  desc={card.description}
                  valueColor={card.color}
                  href={card.href}
                  delay={(kpiHealth.length + index) * ANIMATION.STAT_CARD_DELAY}
                />
              ))}
            </div>
          </section>

          {/* Actionable Insights Section */}
          {insights.length > 0 && (
            <section aria-labelledby="insights-section">
              <h2 id="insights-section" style={{ fontSize: 17, fontWeight: 590, marginBottom: 'var(--space-4)', color: 'var(--text-primary)' }}>
                Gợi ý Hành động
              </h2>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: 'var(--space-3)',
                marginBottom: 'var(--space-6)',
              }}>
                {insights.map((insight, index) => (
                  <ActionableInsight
                    key={insight.id}
                    title={insight.title}
                    description={insight.description}
                    severity={insight.severity}
                    icon={insight.icon}
                    href={insight.href}
                    delay={index * ANIMATION.STAT_CARD_DELAY}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </PageLayout>
    </ProtectedPage>
  );
}
// Improved navigation

// Improved navigation
