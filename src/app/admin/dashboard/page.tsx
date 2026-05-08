'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { PageLayout } from '@/components/PageLayout';
import { ProtectedPage } from '@/components/ProtectedPage';
import { Icon, ToastContainer, useToast, EmptyState, Toolbar, StatCard } from '@/components/ui';
import { KPICard } from '@/components/dashboard/KPICard';
import { ActionableInsight } from '@/components/dashboard/ActionableInsight';
import { getCache, setCache, clearCache } from '@/lib/idb';
import { CACHE_KEYS, LABELS, FORMAT, ANIMATION, DATE_UTILS, MESSAGES, CLASS_INACTIVE_STATUSES } from '@/constants';
import { useSharedFilterState } from '@/hooks/useSharedFilterState';
import { analyzeComments, analyzeAttendance } from '@/lib/classQualityAnalysis';
import { 
  completionColor, 
  teacherChangeColor, 
  surveyColor, 
  conversionColor,
  multiTeacherScore,
  kpiColor,
  KPI_COLORS
} from '@/lib/kpiScoring';
import { fetchAllClasses, dateRangeToUtcRange } from '@/services/classesService';
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
    const officeHoursController = new AbortController();
    const teachersController = new AbortController();
    const teacherSchedulesController = new AbortController();
    
    // Store all controllers so we can abort all
    abortControllerRef.current = {
      abort: () => {
        classesController.abort();
        ticketsController.abort();
        officeHoursController.abort();
        teachersController.abort();
        teacherSchedulesController.abort();
      }
    } as any;

    try {
      const { endDateFrom, endDateTo } = dateRangeToUtcRange(new Date(fromDate), new Date(toDate));
      const centreIds = selectedCentres.length > 0 ? selectedCentres : centres.map(c => c.id);

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
      setProgress({ loaded: 0, total: 0 }); // Initialize progress immediately
      
      const dateFrom = new Date(fromDate);
      const dateTo = new Date(toDate);
      dateFrom.setHours(0, 0, 0, 0);
      dateTo.setHours(23, 59, 59, 999);
      
      const teacherSchedulesResult = await fetchTeacherSchedules(
        dateFrom,
        dateTo,
        centreIds,
        undefined, // selectedTeachers - load all teachers
        (loaded, total) => {
          setProgress({ loaded, total: total || Math.max(loaded, 1) });
        },
        teacherSchedulesController.signal
      );
      
      removeToast(teacherSchedulesToastId);

      // Step 2: Fetch classes separately for KPI calculations
      const classesToastId = addToast(MESSAGES.LOADING.LOADING_CLASSES, 'loading');
      setProgress({ loaded: 0, total: 0 }); // Initialize progress immediately
      const classesResult = await fetchAllClasses(
        {
          centres: centreIds,
          endDateFrom,
          endDateTo,
        },
        (loaded, total) => {
          setProgress({ loaded, total });
        },
        classesController.signal
      );
      removeToast(classesToastId);

      // Step 2: Fetch tickets
      const ticketsToastId = addToast(MESSAGES.LOADING.LOADING_TICKETS, 'loading');
      setProgress({ loaded: 0, total: 0 }); // Initialize progress immediately
      const ticketsResult = await fetchTickets(
        {
          centreId_in: centreIds,
          createdAt_gte: new Date(fromDate).toISOString(),
          createdAt_lte: new Date(toDate).toISOString(),
        },
        (loaded, total) => {
          setProgress({ loaded, total });
        },
        ticketsController.signal
      );
      removeToast(ticketsToastId);

      // Step 3: Fetch office hours
      const officeHoursToastId = addToast(MESSAGES.LOADING.LOADING_OFFICE_HOURS, 'loading');
      setProgress({ loaded: 0, total: 0 }); // Initialize progress immediately
      const officeHoursResult = await fetchOfficeHours(
        {
          centreIn: centreIds,
          timeFrom: new Date(fromDate).toISOString(),
          timeTo: new Date(toDate).toISOString(),
        },
        (loaded, total) => {
          setProgress({ loaded, total });
        },
        officeHoursController.signal
      );
      removeToast(officeHoursToastId);

      // Step 4: Fetch teachers
      const teachersToastId = addToast('Đang tải dữ liệu giáo viên...', 'loading');
      setProgress({ loaded: 0, total: 0 }); // Initialize progress immediately
      
      // Fetch teachers with pagination (same logic as teachers page)
      const teachersVariables: any = {
        pageIndex: 0,
        itemsPerPage: 100,
        orderBy: 'createdAt_desc',
        centers: centreIds,
      };
      
      const firstTeachersPage = await getTeachers(teachersVariables, teachersController.signal);
      const teachersTotal = firstTeachersPage.total;
      let allTeachers = [...firstTeachersPage.data];
      setProgress({ loaded: allTeachers.length, total: teachersTotal });
      
      // Fetch remaining pages if needed
      if (teachersTotal > 100) {
        const totalPages = Math.ceil(teachersTotal / 100);
        const remainingPages = [];
        
        for (let page = 1; page < totalPages; page++) {
          remainingPages.push(
            getTeachers({
              ...teachersVariables,
              pageIndex: page,
            }, teachersController.signal)
          );
        }
        
        const teachersResults = await Promise.all(remainingPages);
        teachersResults.forEach(result => {
          allTeachers = [...allTeachers, ...result.data];
          setProgress({ loaded: allTeachers.length, total: teachersTotal });
        });
      }
      
      removeToast(teachersToastId);

      // Process and cache data for each KPI
      const completionCache = { classes: classesResult, timestamp: Date.now() };
      const teacherChangeCache = { classes: classesResult, timestamp: Date.now() };
      const classQualityCache = { 
        classes: classesResult, 
        violations: [], // TODO: Extract from classes
        attendanceWarnings: [], // TODO: Extract from classes
        timestamp: Date.now() 
      };
      const ticketsCache = { tickets: ticketsResult.data, timestamp: Date.now() };
      const officeHoursCache = { officeHours: officeHoursResult.data, timestamp: Date.now() };
      const teachersCache = { teachers: allTeachers, timestamp: Date.now() };
      const teacherSchedulesCache = { schedules: teacherSchedulesResult, timestamp: Date.now() };

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
        `Tải thành công ${classesResult.length} lớp, ${ticketsResult.data.length} phiếu, ${officeHoursResult.data.length} ca, ${allTeachers.length} GV, ${teacherSchedulesResult.length} lịch dạy!`, 
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
      
      addToast('Đã xóa tất cả dữ liệu tạm', 'success');
    } catch (err) {
      console.error('Failed to clear caches:', err);
      addToast('Không thể xóa dữ liệu tạm', 'error');
    }
  }

  // KPI Calculations
  const completionRate = useMemo(() => {
    if (!completionData?.classes) return null;
    try {
      let totalPass = 0;
      let totalBase = 0;
      
      completionData.classes.forEach((cls: any) => {
        const isCancelled = cls.status === 'ABANDONED' || cls.status === 'REJECTED';
        if (isCancelled) return;
        
        let clsPass = 0;
        let clsBase = 0;
        
        (cls.students || []).forEach((st: any) => {
          const info = st.completionInfo;
          // Skip exempt students (students with no attendance)
          const isExempt = info?.status === 'WAITING' && !(cls.slots || []).some((slot: any) => 
            (slot.studentAttendance || []).some((a: any) => a.student.id === st.student.id)
          );
          if (isExempt) return;
          
          clsBase++;
          if (info?.status === 'PASSED' || info?.status === 'COMPLETED' || info?.status === 'FINISHED') {
            clsPass++;
          }
        });
        
        totalPass += clsPass;
        totalBase += clsBase;
      });
      
      return totalBase > 0 ? (totalPass / totalBase) * 100 : null;
    } catch (err) {
      console.error('Error calculating completion rate:', err);
      return null;
    }
  }, [completionData]);

  // Count active classes (excluding ABANDONED/REJECTED)
  const activeClassesCount = useMemo(() => {
    if (!completionData?.classes) return 0;
    return completionData.classes.filter((cls: any) => {
      const status = cls.status?.toUpperCase();
      return status !== 'ABANDONED' && status !== 'REJECTED';
    }).length;
  }, [completionData]);

  const teacherChangeRate = useMemo(() => {
    if (!teacherChangeData?.classes) return null;
    try {
      const activeClasses = teacherChangeData.classes.filter((cls: any) => 
        !CLASS_INACTIVE_STATUSES.has(cls.status?.toUpperCase?.())
      );
      
      // Use EXACT logic from teacher-change page
      const classesWithChange = activeClasses.filter((cls: any) => {
        const slots = (cls.slots ?? [])
          .filter((s: any) => s.date)
          .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        // Primary LEC: from first slot's LEC (most authoritative)
        let primaryLEC: any = null;
        for (const slot of slots) {
          const lec = (slot.teachers ?? []).find((t: any) => {
            const role = typeof t.role === 'string' ? t.role : (t.role?.shortName ?? t.role?.name ?? '');
            return role.toUpperCase() === 'LEC';
          });
          if (lec) { primaryLEC = lec; break; }
        }
        if (!primaryLEC) {
          primaryLEC = (cls.teachers ?? []).find((t: any) => {
            const role = typeof t.role === 'string' ? t.role : (t.role?.shortName ?? t.role?.name ?? '');
            return role.toUpperCase() === 'LEC';
          }) ?? null;
        }
        
        // Check if any slot has different LEC
        let hasChange = false;
        for (const slot of slots) {
          const slotLEC = (slot.teachers ?? []).find((t: any) => {
            const role = typeof t.role === 'string' ? t.role : (t.role?.shortName ?? t.role?.name ?? '');
            return role.toUpperCase() === 'LEC';
          }) ?? null;
          
          if (primaryLEC && slotLEC && slotLEC.teacher.id !== primaryLEC.teacher.id) {
            hasChange = true;
            break;
          }
        }
        
        return hasChange;
      }).length;
      
      const totalClasses = activeClasses.length;
      return totalClasses > 0 ? (classesWithChange / totalClasses) * 100 : null;
    } catch (err) {
      console.error('Error calculating teacher change rate:', err);
      return null;
    }
  }, [teacherChangeData]);

  // Count active classes for teacher change (excluding ABANDONED/REJECTED/CANCELLED)
  const activeTeacherChangeClassesCount = useMemo(() => {
    if (!teacherChangeData?.classes) return 0;
    return teacherChangeData.classes.filter((cls: any) => 
      !CLASS_INACTIVE_STATUSES.has(cls.status?.toUpperCase?.())
    ).length;
  }, [teacherChangeData]);

  const surveyScore = useMemo(() => {
    if (!ticketsData?.tickets) return null;
    try {
      // Use EXACT logic from tickets page - extract teacher score from _groupScores
      let totalScore = 0;
      let scoredTicketsCount = 0;
      
      ticketsData.tickets.forEach((t: any) => {
        // Process each ticket to extract group scores (same as tickets page)
        const groupScores: Record<string, { total: number; count: number }> = {};
        
        if (t.ticketSource?.answers?.length) {
          t.ticketSource.answers.forEach((ans: any) => {
            const question = t.ticketSource?.questions?.find((q: any) => q.id === ans.questionId);
            if (!question) return;

            const val = parseFloat(ans.value);
            if (!isNaN(val) && val > 0 && val <= 5) {
              const g = question.group || 'Khác';
              if (!groupScores[g]) groupScores[g] = { total: 0, count: 0 };
              groupScores[g].total += val;
              groupScores[g].count++;
            }
          });
        }
        
        // Find teacher score group
        const teacherScoreEntry = Object.entries(groupScores).find(([group]) => {
          const gName = group.toUpperCase();
          return gName.includes('TEACHER') || gName.includes('GIÁO VIÊN') || gName === 'GV';
        });
        
        if (teacherScoreEntry) {
          const [, data] = teacherScoreEntry;
          totalScore += (data.total / data.count);
          scoredTicketsCount++;
        }
      });
      
      return scoredTicketsCount > 0 ? parseFloat((totalScore / scoredTicketsCount).toFixed(1)) : null;
    } catch (err) {
      console.error('Error calculating survey score:', err);
      return null;
    }
  }, [ticketsData]);

  const conversionRate = useMemo(() => {
    if (!officeHoursData?.officeHours) return null;
    try {
      // Use EXACT logic from office-hours page
      // Conversion = học viên có Order HOẶC có Payment
      let totalAppointments = 0;
      let convertedAppointments = 0;
      
      officeHoursData.officeHours.forEach((oh: any) => {
        if (oh.appointments && oh.appointments.length > 0) {
          oh.appointments.forEach((apt: any) => {
            // Skip canceled appointments (same exemption logic as office-hours page)
            if (apt.status === 'CANCELED') return;
            
            totalAppointments++;
            
            // Converted = có Order HOẶC có Payment
            if (apt.resultAfterTrial?.isHasOrder || apt.resultAfterTrial?.isHasPayment) {
              convertedAppointments++;
            }
          });
        }
      });
      
      return totalAppointments > 0 ? (convertedAppointments / totalAppointments) * 100 : null;
    } catch (err) {
      console.error('Error calculating conversion rate:', err);
      return null;
    }
  }, [officeHoursData]);

  // Multi-teacher rate calculation
  const multiTeacherRate = useMemo(() => {
    if (!teacherChangeData?.classes) return null;
    try {
      const activeClasses = teacherChangeData.classes.filter((cls: any) => 
        !CLASS_INACTIVE_STATUSES.has(cls.status?.toUpperCase?.())
      );
      
      // Use EXACT logic from teacher-change page
      const classesWithMultiTeachers = activeClasses.filter((cls: any) => {
        // Gather all unique LEC + SUPPLY teachers (same logic as teacher-change page)
        const teacherMap = new Map<string, any>();
        
        // From cls.teachers
        (cls.teachers ?? []).forEach((t: any) => {
          const role = typeof t.role === 'string' ? t.role : (t.role?.shortName ?? t.role?.name ?? '');
          const roleUpper = role.toUpperCase();
          if (roleUpper === 'LEC' || roleUpper === 'SUPPLY') {
            teacherMap.set(t.teacher.id, t);
          }
        });
        
        // From slots
        (cls.slots ?? []).forEach((slot: any) => {
          (slot.teachers ?? []).forEach((t: any) => {
            const role = typeof t.role === 'string' ? t.role : (t.role?.shortName ?? t.role?.name ?? '');
            const roleUpper = role.toUpperCase();
            if ((roleUpper === 'LEC' || roleUpper === 'SUPPLY') && !teacherMap.has(t.teacher.id)) {
              teacherMap.set(t.teacher.id, t);
            }
          });
        });
        
        return teacherMap.size >= 3;
      }).length;
      
      const totalClasses = activeClasses.length;
      return totalClasses > 0 ? (classesWithMultiTeachers / totalClasses) * 100 : null;
    } catch (err) {
      console.error('Error calculating multi-teacher rate:', err);
      return null;
    }
  }, [teacherChangeData]);

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

    // 1. Demo not arranged - Critical
    if (completionData?.classes) {
      const demoCount = completionData.classes.filter((c: any) => 
        c.reasons?.some((r: any) => r.reason === 'DEMO_NOT_ARRANGED')
      ).length;
      if (demoCount > 0) {
        result.push({
          id: 'demo-not-arranged',
          title: `${demoCount} lớp chưa sắp xếp thuyết trình cuối khóa`,
          description: 'Cần xử lý ngay',
          severity: 'critical' as const,
          icon: <Icon.AlertTriangle size={16} />,
          href: '/admin/completion-rate?filter=demo',
          priority: 100,
        });
      }
    }

    // 2. Completion Rate Gap
    if (completionRate !== null) {
      if (completionRate < 95) {
        const severity = completionRate < 80 ? 'critical' : 'warning';
        const studentsNeeded = completionData?.classes 
          ? Math.ceil((0.95 * completionData.classes.reduce((sum: number, c: any) => sum + (c.base || 0), 0)) - 
              completionData.classes.reduce((sum: number, c: any) => sum + (c.pass || 0), 0))
          : 0;
        result.push({
          id: 'completion-gap',
          title: `Tỷ lệ hoàn thành đang ở mức ${FORMAT.percentage(completionRate)}`,
          description: studentsNeeded > 0 ? `Cần thêm ${studentsNeeded} HV để đạt 95%` : 'Cần cải thiện',
          severity,
          icon: <Icon.TrendingDown size={16} />,
          href: '/admin/completion-rate',
          priority: severity === 'critical' ? 90 : 70,
        });
      }
    }

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
        href: '/admin/class-quality?tab=violations',
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
        href: '/admin/class-quality?tab=attendance',
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

    // 6. Teacher Change Rate
    if (teacherChangeRate !== null && teacherChangeRate > 3) {
      let severity: 'info' | 'warning' | 'critical' = 'info';
      if (teacherChangeRate > 7) severity = 'critical';
      else if (teacherChangeRate > 5) severity = 'warning';
      
      result.push({
        id: 'teacher-change',
        title: `Tỷ lệ thay GV đang ở mức ${FORMAT.percentage(teacherChangeRate)}`,
        description: 'Mục tiêu dưới 3%',
        severity,
        icon: <Icon.Repeat size={16} />,
        href: '/admin/teacher-change',
        priority: severity === 'critical' ? 70 : severity === 'warning' ? 50 : 30,
      });
    }

    // 7. Survey Score Low
    if (surveyScore !== null && surveyScore < 4.5) {
      let severity: 'info' | 'warning' | 'critical' = 'info';
      if (surveyScore < 3.5) severity = 'critical';
      else if (surveyScore < 4.0) severity = 'warning';
      
      result.push({
        id: 'survey-score',
        title: `Điểm khảo sát đang ở mức ${surveyScore.toFixed(2)}`,
        description: 'Cần cải thiện',
        severity,
        icon: <Icon.User size={16} />,
        href: '/admin/tickets',
        priority: severity === 'critical' ? 65 : severity === 'warning' ? 45 : 25,
      });
    }

    // 8. Conversion Rate Low
    if (conversionRate !== null && conversionRate < 30) {
      let severity: 'info' | 'warning' | 'critical' = 'info';
      if (conversionRate < 15) severity = 'critical';
      else if (conversionRate < 25) severity = 'warning';
      
      result.push({
        id: 'conversion-rate',
        title: `Tỷ lệ chuyển đổi đang ở mức ${FORMAT.percentage(conversionRate)}`,
        description: 'Mục tiêu trên 30%',
        severity,
        icon: <Icon.TrendingDown size={16} />,
        href: '/admin/office-hours',
        priority: severity === 'critical' ? 60 : severity === 'warning' ? 40 : 20,
      });
    }

    // Sort by priority (higher = more important) and limit to top 6
    return result.sort((a, b) => b.priority - a.priority).slice(0, 6);
  }, [
    completionData, 
    completionRate, 
    commentViolationsCount, 
    attendanceAlertsCount, 
    newTicketsCount,
    teacherChangeRate,
    surveyScore,
    conversionRate
  ]);

  // KPI Cards - Organized by category
  const kpiCards = useMemo(() => {
    const cards = {
      // Core KPIs - Primary metrics (percentage-based)
      core: [
        {
          key: 'completion',
          label: 'Tỷ lệ Hoàn thành',
          value: completionRate !== null ? FORMAT.percentage(completionRate) : 'N/A',
          description: `${activeClassesCount} lớp học`,
          color: completionRate !== null ? completionColor(completionRate) : 'var(--text-quaternary)',
          icon: <Icon.CheckCircle size={18} />,
          href: '/admin/completion-rate',
        },
        {
          key: 'teacher-change',
          label: 'Tỷ lệ thay đổi GV',
          value: teacherChangeRate !== null ? FORMAT.percentage(teacherChangeRate) : 'N/A',
          description: `${activeTeacherChangeClassesCount} lớp học`,
          color: teacherChangeRate !== null ? teacherChangeColor(teacherChangeRate) : 'var(--text-quaternary)',
          icon: <Icon.Repeat size={18} />,
          href: '/admin/teacher-change',
        },
        {
          key: 'tickets',
          label: 'Điểm Khảo sát',
          value: surveyScore !== null ? surveyScore.toFixed(2) : 'N/A',
          description: `${ticketsData?.tickets?.length || 0} phiếu`,
          color: surveyScore !== null ? surveyColor(surveyScore) : 'var(--text-quaternary)',
          icon: <Icon.User size={18} />,
          href: '/admin/tickets',
        },
        {
          key: 'office-hours',
          label: 'Tỷ lệ chuyển đổi',
          value: conversionRate !== null ? FORMAT.percentage(conversionRate) : 'N/A',
          description: `${officeHoursData?.officeHours?.length || 0} ca học`,
          color: conversionRate !== null ? conversionColor(conversionRate) : 'var(--text-quaternary)',
          icon: <Icon.TrendingUp size={18} />,
          href: '/admin/office-hours',
        },
      ],
      
      // Quality Alerts - Count-based metrics
      quality: [
        {
          key: 'comment-violations',
          label: 'Vi phạm Nhận xét',
          value: commentViolationsCount !== null ? FORMAT.number(commentViolationsCount) : 'N/A',
          description: `${activeClassesCount} lớp học`,
          color: commentViolationsCount !== null ? getCountColor(commentViolationsCount, [5, 10, 20, Infinity]) : 'var(--text-quaternary)',
          icon: <Icon.XCircle size={18} />,
          href: '/admin/class-quality?tab=violations',
        },
        {
          key: 'attendance-alerts',
          label: 'Cảnh báo Chuyên cần',
          value: attendanceAlertsCount !== null ? FORMAT.number(attendanceAlertsCount) : 'N/A',
          description: `${activeClassesCount} lớp học`,
          color: attendanceAlertsCount !== null ? getCountColor(attendanceAlertsCount, [3, 6, 10, Infinity]) : 'var(--text-quaternary)',
          icon: <Icon.AlertCircle size={18} />,
          href: '/admin/class-quality?tab=attendance',
        },
        {
          key: 'multi-teacher',
          label: 'Lớp có 3+ GV',
          value: multiTeacherRate !== null ? FORMAT.percentage(multiTeacherRate) : 'N/A',
          description: `${activeTeacherChangeClassesCount} lớp học`,
          color: multiTeacherRate !== null ? kpiColor(multiTeacherScore(multiTeacherRate)) : 'var(--text-quaternary)',
          icon: <Icon.Users size={18} />,
          href: '/admin/teacher-change',
        },
        {
          key: 'new-tickets',
          label: 'Phiếu đánh giá mới',
          value: newTicketsCount !== null ? FORMAT.number(newTicketsCount) : 'N/A',
          description: `${ticketsData?.tickets?.length || 0} phiếu`,
          color: newTicketsCount !== null ? getCountColor(newTicketsCount, [5, 10, 20, Infinity]) : 'var(--text-quaternary)',
          icon: <Icon.Bell size={18} />,
          href: '/admin/tickets?status=new',
        },
      ],
    };

    return cards;
  }, [
    completionRate, 
    teacherChangeRate, 
    surveyScore, 
    conversionRate,
    multiTeacherRate,
    commentViolationsCount,
    attendanceAlertsCount,
    newTicketsCount,
    activeClassesCount,
    activeTeacherChangeClassesCount,
    ticketsData,
    officeHoursData,
  ]);

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
              {kpiCards.core.map((card, index) => (
                <KPICard
                  key={card.key}
                  label={card.label}
                  value={card.value}
                  description={card.description}
                  color={card.color}
                  icon={card.icon}
                  href={card.href}
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
              {kpiCards.quality.map((card, index) => (
                <KPICard
                  key={card.key}
                  label={card.label}
                  value={card.value}
                  description={card.description}
                  color={card.color}
                  icon={card.icon}
                  href={card.href}
                  delay={(kpiCards.core.length + index) * ANIMATION.STAT_CARD_DELAY}
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
