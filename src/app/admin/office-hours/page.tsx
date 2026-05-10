'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart, Bar, LineChart, Line, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
  ResponsiveContainer, Cell, Legend,
} from 'recharts';
import { useAuth } from '@/lib/AuthContext';
import { loadSession } from '@/services/authService';
import { fetchOfficeHours, updateOfficeHour, approveOfficeHour, loadAllTeachers, searchTeachers, Teacher } from '@/services/officeHoursService';
import { fetchAllCentres, Centre } from '@/services/centresService';
import { searchUsers } from '@/services/ticketService';
import { getCache, setCache, clearCache } from '@/lib/idb';
import { getOfficeHourCategory } from '@/lib/courseCategories';
import { sendNotification, NotificationTemplates } from '@/lib/sendNotification';
import { OfficeHour, OFFICE_HOUR_STATUS, OFFICE_HOUR_TYPE } from '@/types/officeHours';
import { useToast, ToastContainer, initials, EmptyState, Toolbar, SelectOption, TableGroupHeader, AdminTableSection, Modal, ModalHeader, MultiSelect, TableToolbar, ChartSectionHeader, StandardXAxis, StandardYAxisCategory, StandardYAxisNumber, ChartLegend, ComposedChartConfig, CustomTooltip, UserSearchInput, type UserSearchResult, ModalFooter, CentreSelect, QuickFilterChips, ShiftRequestSuggestions, type ShiftRequest, OfficeHourTypeBadge, getOfficeHourTypeLabel, KPIThresholdSuggestions, Icon, ViewModeToggle, DetailGrid, DetailField, DetailText, Badge, CentreBadge, RawStatusBadge, getRawStatusVariant } from '@/components/ui';
import { useQuickFilterChips } from '@/hooks/useUserPreferences';
import { PageLayout } from '@/components/PageLayout';
import { getNavItemsWithRouter } from '@/lib/navigation';
import { useAllowedPages } from '@/hooks/useAllowedPages';
import { useFilterOptions } from '@/hooks/useFilterOptions';
import { CACHE_KEYS, MESSAGES, ENTITIES, LABELS, CHART_COLORS } from '@/constants';
import { useSharedDateRange, useSharedCentres } from '@/hooks/useSharedFilterState';
import { conversionColor, KPI_COLORS, CONVERSION_LEGEND } from '@/lib/kpiScoring';
import { ProtectedPage } from '@/components/ProtectedPage';
import styles from '../../dashboard.module.css';

// Helper function to parse teacher note from custom field
function parseTeacherNote(customField: string | null | undefined): string {
  if (!customField) return '';
  try {
    const parsed = JSON.parse(customField);
    return parsed.teacherNote || '';
  } catch {
    return '';
  }
}

import { Suspense } from 'react';

const CONVERSION_TARGETS = [
  { value: 15, label: '15%' },
  { value: 26, label: '26%' },
  { value: 31, label: '31%' },
  { value: 40.1, label: '> 40%' },
];
const DEFAULT_EXEMPT_TYPES = ['Event', 'Makeup', 'Tutor'];
const DEFAULT_EXEMPT_STATUSES = ['ABANDONED', 'DENIED', 'REJECTED'];
const DEFAULT_EXEMPT_APPOINTMENT_STATUSES = ['CANCELED'];
const OFFICE_HOUR_LIST_GRID = 'minmax(0, 1.2fr) minmax(0, 0.8fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 0.7fr) minmax(0, 0.6fr) minmax(0, 0.9fr) minmax(0, 0.8fr) minmax(0, 0.9fr) minmax(0, 1fr) minmax(0, 1fr)';
const TEACHER_OFFICE_HOUR_GRID = 'minmax(0, 1.2fr) minmax(0, 0.8fr) minmax(0, 1fr) minmax(0, 0.7fr) minmax(0, 0.6fr) minmax(0, 0.9fr) minmax(0, 0.8fr) minmax(0, 0.9fr) minmax(0, 1fr) minmax(0, 1fr)';

function getEvaluationStatusCounts(appointments?: OfficeHour['appointments']) {
  const counts: Record<string, number> = {};
  appointments?.forEach(apt => {
    const status = apt.status || 'UNKNOWN';
    counts[status] = (counts[status] || 0) + 1;
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function getDominantEvaluationStatus(officeHour: OfficeHour): string {
  return getEvaluationStatusCounts(officeHour.appointments)[0]?.[0] || '';
}

function EvaluationStatusSummary({ appointments }: { appointments?: OfficeHour['appointments'] }) {
  const counts = getEvaluationStatusCounts(appointments);
  if (counts.length === 0) {
    return <span style={{ color: 'var(--text-tertiary)' }}>—</span>;
  }

  return (
    <div className={styles.reasonsPreview}>
      {counts.slice(0, 3).map(([status, count]) => (
        <Badge
          key={status}
          variant={getRawStatusVariant(status)}
          size="sm"
          shape="rounded"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)' }}
        >
          {count > 1 ? `${status}: ${count}` : status}
        </Badge>
      ))}
      {counts.length > 3 && (
        <Badge variant="exempt" size="sm" shape="rounded">+{counts.length - 3}</Badge>
      )}
    </div>
  );
}

function OfficeHoursPageInner() {
  const { session, isLoading: authLoading, logout } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toasts, addToast, removeToast } = useToast();

  // Deep-link from notification: ?date=YYYY-MM-DD&centre=id&open=officeHourId
  const pendingOpenIdRef = useRef<string | null>(null);
  const deepLinkAppliedRef = useRef(false);
  const { hasPreferences } = useQuickFilterChips();

  const [officeHours, setOfficeHours] = useState<OfficeHour[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [centres, setCentres] = useState<Centre[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ loaded: 0, total: 0 });
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  // Shared filter state (synced across pages)
  const [timeFrom, timeTo, setTimeFrom, setTimeTo, datesLoaded] = useSharedDateRange();
  const [selectedCentres, setSelectedCentres, centresLoaded] = useSharedCentres();

  // Table-level filters (for client-side filtering)
  const [tableSelectedCentres, setTableSelectedCentres] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedEvaluationStatuses, setSelectedEvaluationStatuses] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedGrades, setSelectedGrades] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Toolbar-level course filter (separate from table-level)
  const [toolbarSelectedGrades, setToolbarSelectedGrades] = useState<string[]>([]);

  // Exemption states
  const [showExemptPanel, setShowExemptPanel] = useState(true);
  const [exemptTypes, setExemptTypes] = useState<string[]>(DEFAULT_EXEMPT_TYPES);
  const [exemptStatuses, setExemptStatuses] = useState<string[]>(DEFAULT_EXEMPT_STATUSES);
  const [exemptAppointmentStatuses, setExemptAppointmentStatuses] = useState<string[]>(DEFAULT_EXEMPT_APPOINTMENT_STATUSES);

  // UI state
  const [sortBy, setSortBy] = useState<'time' | 'status' | 'students' | 'type' | 'course' | 'teacher' | 'centre' | 'evaluation' | 'paid' | 'comments' | 'confirmed'>('time');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedOfficeHourId, setSelectedOfficeHourId] = useState<string | null>(null);
  const [showActiveTable, setShowActiveTable] = useState(true);
  const [viewMode, setViewMode] = useState<'all' | 'by-teacher'>('all');
  const [selectedTeacherForModal, setSelectedTeacherForModal] = useState<{ teacherId: string; teacherName: string; teacher: any; officeHours: OfficeHour[] } | null>(null);

  // Edit state (similar to tickets page)
  const [editDraft, setEditDraft] = useState<{ teacherId: string; teacherNote: string } | null>(null);
  // Teacher search states (similar to tickets assignee search)
  const [teacherSearch, setTeacherSearch] = useState('');
  const [teacherSearchResults, setTeacherSearchResults] = useState<Teacher[]>([]);
  const [showTeacherDropdown, setShowTeacherDropdown] = useState(false);
  const [teachersLoading, setTeachersLoading] = useState(false);
  const [savingOfficeHour, setSavingOfficeHour] = useState(false);
  const [approvingOfficeHour, setApprovingOfficeHour] = useState(false);
  
  // Shift requests state
  const [shiftRequests, setShiftRequests] = useState<ShiftRequest[]>([]);
  
  // Sort state for by-teacher view
  const [teacherSortBy, setTeacherSortBy] = useState<'name' | 'sessions' | 'students' | 'confirmed' | 'paid' | 'comments' | 'conversion'>('sessions');
  const [teacherSortOrder, setTeacherSortOrder] = useState<'asc' | 'desc'>('desc');

  // Memoize teacher search results to prevent unnecessary re-renders
  const memoizedTeacherResults = useMemo(() => teacherSearchResults, [teacherSearchResults]);
  
  // Memoize current teacher display to prevent re-calculation
  const currentTeacherDisplay = useMemo(() => {
    if (!editDraft?.teacherId || teacherSearch) return null;
    const currentTeacher = memoizedTeacherResults.find(t => t.id === editDraft.teacherId);
    return currentTeacher?.fullName || 'Giáo viên đã chọn';
  }, [editDraft?.teacherId, teacherSearch, memoizedTeacherResults]);
  useEffect(() => {
    return () => {
      if (teacherSearchTimerRef.current) {
        clearTimeout(teacherSearchTimerRef.current);
      }
    };
  }, []);
  useEffect(() => {
    (async () => {
      try {
        const cached = await getCache(CACHE_KEYS.OFFICE_HOURS);
        if (cached) {
          if (cached.officeHours) setOfficeHours(cached.officeHours);
          if (cached.timeFrom) setTimeFrom(cached.timeFrom);
          if (cached.timeTo) setTimeTo(cached.timeTo);
          if (cached.selectedCentres) setSelectedCentres(cached.selectedCentres);
          if (cached.exemptTypes) setExemptTypes(cached.exemptTypes);
          if (cached.exemptStatuses) setExemptStatuses(cached.exemptStatuses);
          return; // Use cached dates
        }
      } catch (e) {
        console.error('Cache load error:', e);
      }
      
      // Default to current month if no cache
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      setTimeFrom(firstDay.toISOString().split('T')[0]);
      setTimeTo(lastDay.toISOString().split('T')[0]);
    })();
  }, []);

  // Deep-link: apply URL params once filters are loaded from cache, then auto-fetch
  useEffect(() => {
    if (deepLinkAppliedRef.current || !datesLoaded) return;
    const date   = searchParams.get('date');
    const centre = searchParams.get('centre');
    const open   = searchParams.get('open');
    if (!date && !centre && !open) return;

    deepLinkAppliedRef.current = true;
    if (open) pendingOpenIdRef.current = open;

    if (date) { setTimeFrom(date); setTimeTo(date); }
    if (centre) setSelectedCentres([centre]);

    // Fetch with explicit params to bypass state-update timing
    handleFetch({ date: date ?? undefined, centreIds: centre ? [centre] : undefined });

    // Clean up URL so refresh doesn't re-trigger
    router.replace('/admin/office-hours', { scroll: false });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datesLoaded]);

  // Fetch centres on mount
  useEffect(() => {
    if (!session) return;
    
    (async () => {
      try {
        const cached = await getCache(CACHE_KEYS.CENTRES);
        if (cached?.centres?.length) {
          setCentres(cached.centres);
          return;
        }
        const data = await fetchAllCentres();
        setCentres(data);
        await setCache(CACHE_KEYS.CENTRES, { centres: data });
      } catch (err) {
        console.error('Failed to fetch centres:', err);
      }
    })();
  }, [session]);

  // Centre IDs that appear in loaded data (for table-level filter)
  const tableCentreIds = useMemo(() => {
    const ids = new Set<string>();
    officeHours.forEach(oh => {
      if (oh.centre?.id) {
        ids.add(oh.centre.id);
      }
    });
    return Array.from(ids);
  }, [officeHours]);

  // Status options (based on actual data, not just enum)
  const statusOptions: SelectOption[] = useMemo(() => {
    const statuses = new Set<string>();
    officeHours.forEach(oh => {
      if (oh.status) {
        statuses.add(oh.status);
      }
    });
    return Array.from(statuses).sort().map(status => ({ value: status, label: status }));
  }, [officeHours]);

  const evaluationStatusOptions: SelectOption[] = useMemo(() => {
    const statuses = new Set<string>();
    officeHours.forEach(oh => {
      oh.appointments?.forEach(apt => {
        if (apt.status) {
          statuses.add(apt.status);
        }
      });
    });
    return Array.from(statuses).sort().map(status => ({ value: status, label: status }));
  }, [officeHours]);

  // Type options (based on actual data, not just enum)
  const typeOptions: SelectOption[] = useMemo(() => {
    const types = new Set<string>();
    officeHours.forEach(oh => {
      if (oh.type) {
        types.add(oh.type);
      }
    });
    return Array.from(types).sort().map(type => ({ value: type, label: getOfficeHourTypeLabel(type) }));
  }, [officeHours]);

  // Course line options (categorized into Coding, Robotics, Art, Others)
  const courseLineOptions: SelectOption[] = useMemo(() => {
    const categories = new Set<string>();
    officeHours.forEach(oh => {
      const category = getOfficeHourCategory(oh);
      if (category) categories.add(category);
    });
    return Array.from(categories).sort().map(cat => ({ value: cat, label: cat }));
  }, [officeHours]);

  // Count maps for exemption panel badges
  const exemptionCounts = useMemo(() => {
    const typeCounts: Record<string, number> = {};
    const statusCounts: Record<string, number> = {};
    const appointmentStatusCounts: Record<string, number> = {};

    officeHours.forEach(oh => {
      // Count types
      if (oh.type) {
        typeCounts[oh.type] = (typeCounts[oh.type] || 0) + 1;
      }
      // Count statuses
      if (oh.status) {
        statusCounts[oh.status] = (statusCounts[oh.status] || 0) + 1;
      }
      // Count appointment statuses
      oh.appointments?.forEach(apt => {
        if (apt.status) {
          appointmentStatusCounts[apt.status] = (appointmentStatusCounts[apt.status] || 0) + 1;
        }
      });
    });

    return { typeCounts, statusCounts, appointmentStatusCounts };
  }, [officeHours]);

  // Fetch office hours (override params used by deep-link to bypass state timing)
  const handleFetch = async (override?: { date?: string; centreIds?: string[] }) => {
    const resolvedFrom = override?.date ?? timeFrom;
    const resolvedTo   = override?.date ?? timeTo;
    const resolvedCentres = override?.centreIds ?? selectedCentres;

    if (!resolvedFrom || !resolvedTo) {
      addToast(MESSAGES.ERROR.DATE_RANGE_REQUIRED, 'error');
      return;
    }

    const controller = new AbortController();
    setAbortController(controller);
    setLoading(true);
    setProgress({ loaded: 0, total: 0 });
    setOfficeHours([]); // Clear existing data
    const tid = addToast(MESSAGES.LOADING.CONNECTING, 'loading');

    let accumulated: OfficeHour[] = [];

    try {
      const fromUTC = new Date(resolvedFrom + 'T00:00:00+07:00').toISOString();
      const toUTC = new Date(resolvedTo + 'T23:59:59+07:00').toISOString();

      const result = await fetchOfficeHours(
        {
          centreIn: resolvedCentres.length > 0 ? resolvedCentres : undefined,
          timeFrom: fromUTC,
          timeTo: toUTC,
        },
        (loaded, total, chunk) => {
          // Update progress
          setProgress({ loaded, total });
          // Accumulate and display data as it loads (like other pages)
          accumulated = [...accumulated, ...chunk];
          setOfficeHours([...accumulated]);
        },
        controller.signal
      );

      // Save to cache
      await setCache(CACHE_KEYS.OFFICE_HOURS, {
        officeHours: result.data,
        timeFrom,
        timeTo,
        selectedCentres,
        exemptTypes,
        exemptStatuses,
        timestamp: Date.now(),
      });
      
      removeToast(tid);
      addToast(MESSAGES.LOADING.SUCCESS(result.data.length, ENTITIES.OFFICE_HOURS), 'success');
    } catch (error: any) {
      if (error.message === 'Aborted' || error.name === 'AbortError') {
        removeToast(tid);
        addToast(MESSAGES.LOADING.STOPPED, 'info');
      } else {
        console.error('Failed to fetch office hours:', error);
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
    await clearCache(CACHE_KEYS.OFFICE_HOURS);
    setOfficeHours([]);
    setSelectedCentres([]);
    setSelectedStatuses([]);
    setSelectedTypes([]);
    setSearchQuery('');
    addToast(MESSAGES.CACHE.CLEARED, 'success');
  };

  const handleResetExemptions = () => {
    setExemptTypes(DEFAULT_EXEMPT_TYPES);
    setExemptStatuses(DEFAULT_EXEMPT_STATUSES);
    setExemptAppointmentStatuses(DEFAULT_EXEMPT_APPOINTMENT_STATUSES);
    addToast('Đã khôi phục quy tắc miễn trừ mặc định', 'success');
  };

  // Load teachers for edit modal
  // Handle teacher search with debouncing (similar to tickets assignee search)
  const teacherSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Separate function for immediate UI update (no delay)
  const handleTeacherInputChange = useCallback((value: string) => {
    setTeacherSearch(value);
    if (value.length >= 2) {
      setShowTeacherDropdown(true);
    }
  }, []);
  
  // Debounced search function
  const debouncedSearch = useCallback((q: string) => {
    // Clear previous timer
    if (teacherSearchTimerRef.current) {
      clearTimeout(teacherSearchTimerRef.current);
    }
    
    if (q.length < 2) { 
      // Don't clear results if we have a selected teacher and no search query
      // This preserves the selected teacher display
      if (!editDraft?.teacherId) {
        setTeacherSearchResults([]);
      }
      setTeachersLoading(false);
      return; 
    }
    
    // Debounce the search with 300ms delay (reduced from 400ms)
    teacherSearchTimerRef.current = setTimeout(async () => {
      setTeachersLoading(true);
      try {
        const res = await searchTeachers(q, 0, 20);
        setTeacherSearchResults(res.data);
      } catch (error) {
        console.error('Teacher search error:', error);
        setTeacherSearchResults([]);
      } finally {
        setTeachersLoading(false);
      }
    }, 300);
  }, [editDraft?.teacherId]);
  
  // Effect to trigger search when teacherSearch changes
  useEffect(() => {
    debouncedSearch(teacherSearch);
  }, [teacherSearch, debouncedSearch]);

  // Open edit mode for office hour (simplified with search approach)
  const openEditForOfficeHour = useCallback(async (oh: OfficeHour) => {
    // Set edit draft immediately with current teacher info
    setEditDraft({
      teacherId: oh.teacher?.id || '',
      teacherNote: parseTeacherNote(oh.custom),
    });
    
    // Clear search state first
    setTeacherSearch('');
    
    // If there's a current teacher, add it to search results for immediate display
    if (oh.teacher?.id && oh.teacher?.fullName) {
      const currentTeacher: Teacher = {
        id: oh.teacher.id,
        username: oh.teacher.username || '',
        email: oh.teacher.email || '',
        fullName: oh.teacher.fullName,
        code: oh.teacher.code || '',
        phoneNumber: oh.teacher.phoneNumber || '',
        isActive: true,
        centres: []
      };
      setTeacherSearchResults([currentTeacher]);
    } else {
      setTeacherSearchResults([]);
    }
    
    // Load shift requests for this office hour
    try {
      const { getShiftRequestsForOfficeHour } = await import('@/lib/shift-request-actions');
      const requests = await getShiftRequestsForOfficeHour(oh.id);
      const pendingRequests = requests.filter(r => r.status === 'pending');
      setShiftRequests(pendingRequests);
    } catch (error) {
      setShiftRequests([]);
    }
  }, []);

  // Auto-open modal when the target office hour arrives in loaded data (deep-link)
  useEffect(() => {
    if (!pendingOpenIdRef.current || officeHours.length === 0) return;
    const target = officeHours.find(oh => oh.id === pendingOpenIdRef.current);
    if (!target) return;
    pendingOpenIdRef.current = null;
    setSelectedOfficeHourId(target.id);
    openEditForOfficeHour(target);
  // openEditForOfficeHour is stable (useCallback with [])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [officeHours]);

  // Approve office hour
  const handleApproveOfficeHour = useCallback(async (officeHourId: string) => {
    setApprovingOfficeHour(true);
    try {
      const approvedOfficeHour = await approveOfficeHour(officeHourId);

      // Update the office hour in the list
      setOfficeHours(prev =>
        prev.map(oh => oh.id === officeHourId ? approvedOfficeHour : oh)
      );

      // Notify assigned teacher
      if (approvedOfficeHour.teacher?.email) {
        sendNotification({
          userId: approvedOfficeHour.teacher.email,
          notification: NotificationTemplates.officeHourApproved({
            centreName: approvedOfficeHour.centre?.name,
            startTime: approvedOfficeHour.startTime,
            endTime: approvedOfficeHour.endTime,
            courses: approvedOfficeHour.courses?.map(c => c.shortName),
          }),
        }).catch(() => {});
      }

      addToast('Phê duyệt ca trực thành công', 'success');
    } catch (error: any) {
      
      let errorMessage = 'Không thể phê duyệt ca trực';
      
      if (error?.response?.errors?.length > 0) {
        const graphqlError = error.response.errors[0];
        let rawMessage = graphqlError.message;
        
        if (rawMessage.includes('GraphQL error:') && rawMessage.includes('UNKNOWN:')) {
          const unknownIndex = rawMessage.indexOf('UNKNOWN:');
          if (unknownIndex !== -1) {
            rawMessage = rawMessage.substring(unknownIndex + 8).trim();
          }
        } else if (rawMessage.includes('GraphQL error:')) {
          const graphqlIndex = rawMessage.indexOf('GraphQL error:');
          if (graphqlIndex !== -1) {
            rawMessage = rawMessage.substring(graphqlIndex + 14).trim();
          }
        }
        
        errorMessage = rawMessage;
      } else if (error?.message) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      addToast(errorMessage, 'error');
    } finally {
      setApprovingOfficeHour(false);
    }
  }, [addToast, officeHours]);

  // Save office hour changes
  const handleSaveOfficeHour = useCallback(async (officeHourId: string) => {
    if (!editDraft) return;

    // Find the current office hour to get required fields
    const currentOfficeHour = officeHours.find(oh => oh.id === officeHourId);
    if (!currentOfficeHour) {
      addToast('Không tìm thấy ca trực', 'error');
      return;
    }

    setSavingOfficeHour(true);
    try {
      const updatedOfficeHour = await updateOfficeHour({
        id: officeHourId,
        teacher: editDraft.teacherId || undefined,
        teacherNote: editDraft.teacherNote,
        // Preserve required fields from current office hour (excluding status)
        studentCount: currentOfficeHour.studentCount || 0,
        centre: currentOfficeHour.centre?.id,
        startTime: currentOfficeHour.startTime,
        endTime: currentOfficeHour.endTime,
        type: currentOfficeHour.type,
        // Note: status is not accepted by UpdateOfficeHourCommand
      });

      // Update the office hour in the list
      setOfficeHours(prev =>
        prev.map(oh => oh.id === officeHourId ? updatedOfficeHour : oh)
      );

      // Notify assigned teacher
      if (updatedOfficeHour.teacher?.email) {
        sendNotification({
          userId: updatedOfficeHour.teacher.email,
          notification: NotificationTemplates.officeHourAssigned({
            centreName: updatedOfficeHour.centre?.name,
            startTime: updatedOfficeHour.startTime,
            endTime: updatedOfficeHour.endTime,
            courses: updatedOfficeHour.courses?.map(c => c.shortName),
          }),
        }).catch(() => {});
      }

      addToast('Cập nhật ca trực thành công', 'success');
    } catch (error: any) {
      
      // Extract meaningful error message from API
      let errorMessage = 'Không thể cập nhật ca trực';
      
      if (error?.response?.errors?.length > 0) {
        // GraphQL errors - clean up the message for user display
        const graphqlError = error.response.errors[0];
        let rawMessage = graphqlError.message;
        
        // Clean up technical prefixes - use simple string operations
        // Handle "GraphQL error: 2 UNKNOWN: " pattern specifically
        if (rawMessage.includes('GraphQL error:') && rawMessage.includes('UNKNOWN:')) {
          // Find the position after "UNKNOWN: " and take everything after it
          const unknownIndex = rawMessage.indexOf('UNKNOWN:');
          if (unknownIndex !== -1) {
            rawMessage = rawMessage.substring(unknownIndex + 8).trim(); // 8 = length of "UNKNOWN:"
          }
        } else if (rawMessage.includes('GraphQL error:')) {
          // Handle other GraphQL error patterns
          const graphqlIndex = rawMessage.indexOf('GraphQL error:');
          if (graphqlIndex !== -1) {
            rawMessage = rawMessage.substring(graphqlIndex + 14).trim(); // 14 = length of "GraphQL error:"
          }
        }
        
        errorMessage = rawMessage;
      } else if (error?.message) {
        // Network or other errors
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      addToast(errorMessage, 'error');
    } finally {
      setSavingOfficeHour(false);
    }
  }, [editDraft, addToast, officeHours]);

  // Check if any table filter is active
  const hasTableFilter = useMemo(() => {
    return tableSelectedCentres.length > 0 || selectedStatuses.length > 0 || selectedEvaluationStatuses.length > 0 || selectedTypes.length > 0 || selectedGrades.length > 0 || searchQuery.trim().length > 0;
  }, [tableSelectedCentres, selectedStatuses, selectedEvaluationStatuses, selectedTypes, selectedGrades, searchQuery]);

  // Clear all table filters
  const clearTableFilters = () => {
    setTableSelectedCentres([]);
    setSelectedStatuses([]);
    setSelectedEvaluationStatuses([]);
    setSelectedTypes([]);
    setSelectedGrades([]);
    setSearchQuery('');
  };

  // Filter and sort office hours
  const filteredOfficeHours = useMemo(() => {
    let filtered = [...officeHours];

    // Centre filter (table-level)
    if (tableSelectedCentres.length > 0) {
      filtered = filtered.filter(oh => 
        oh.centre && tableSelectedCentres.includes(oh.centre.id)
      );
    }

    // Status filter
    if (selectedStatuses.length > 0 && selectedStatuses.length !== statusOptions.length) {
      filtered = filtered.filter(oh => selectedStatuses.includes(oh.status));
    }

    // Evaluation status filter (appointment-level)
    if (selectedEvaluationStatuses.length > 0 && selectedEvaluationStatuses.length !== evaluationStatusOptions.length) {
      filtered = filtered.filter(oh => oh.appointments?.some(apt => selectedEvaluationStatuses.includes(apt.status)));
    }

    // Type filter
    if (selectedTypes.length > 0 && selectedTypes.length !== typeOptions.length) {
      filtered = filtered.filter(oh => selectedTypes.includes(oh.type));
    }

    // Grade filter (by category: Coding, Robotics, Art, Others)
    if (selectedGrades.length > 0 && selectedGrades.length !== courseLineOptions.length) {
      filtered = filtered.filter(oh => {
        const category = getOfficeHourCategory(oh);
        return selectedGrades.includes(category);
      });
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(oh =>
        oh.teacher?.fullName?.toLowerCase().includes(query) ||
        oh.courses?.some(c => c.name?.toLowerCase().includes(query) || c.shortName?.toLowerCase().includes(query)) ||
        oh.centre?.name?.toLowerCase().includes(query) ||
        oh.centre?.shortName?.toLowerCase().includes(query) ||
        oh.appointments?.some(apt => apt.status?.toLowerCase().includes(query)) ||
        oh.note?.toLowerCase().includes(query)
      );
    }

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0;
      
      if (sortBy === 'time') {
        comparison = new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
      } else if (sortBy === 'status') {
        comparison = (a.status || '').localeCompare(b.status || '');
      } else if (sortBy === 'students') {
        const aCount = a.appointments?.length || 0;
        const bCount = b.appointments?.length || 0;
        comparison = aCount - bCount;
      } else if (sortBy === 'type') {
        comparison = (a.type || '').localeCompare(b.type || '');
      } else if (sortBy === 'course') {
        const aCourse = a.courses?.[0]?.shortName || '';
        const bCourse = b.courses?.[0]?.shortName || '';
        comparison = aCourse.localeCompare(bCourse);
      } else if (sortBy === 'teacher') {
        const aTeacher = a.teacher?.fullName || '';
        const bTeacher = b.teacher?.fullName || '';
        comparison = aTeacher.localeCompare(bTeacher);
      } else if (sortBy === 'centre') {
        const aCentre = a.centre?.shortName || a.centre?.name || '';
        const bCentre = b.centre?.shortName || b.centre?.name || '';
        comparison = aCentre.localeCompare(bCentre);
      } else if (sortBy === 'evaluation') {
        comparison = getDominantEvaluationStatus(a).localeCompare(getDominantEvaluationStatus(b));
      } else if (sortBy === 'paid') {
        const aPaid = a.appointments?.filter(apt => apt.resultAfterTrial?.isHasPayment).length || 0;
        const bPaid = b.appointments?.filter(apt => apt.resultAfterTrial?.isHasPayment).length || 0;
        comparison = aPaid - bPaid;
      } else if (sortBy === 'comments') {
        const aComments = a.appointments?.filter(apt => apt.note).length || 0;
        const bComments = b.appointments?.filter(apt => apt.note).length || 0;
        comparison = aComments - bComments;
      } else if (sortBy === 'confirmed') {
        const aConfirmed = a.appointments?.filter(apt => 
          apt.status && !['WAITING', 'PENDING'].includes(apt.status.toUpperCase())
        ).length || 0;
        const bConfirmed = b.appointments?.filter(apt => 
          apt.status && !['WAITING', 'PENDING'].includes(apt.status.toUpperCase())
        ).length || 0;
        comparison = aConfirmed - bConfirmed;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [officeHours, tableSelectedCentres, selectedStatuses, selectedEvaluationStatuses, selectedTypes, selectedGrades, searchQuery, sortBy, sortOrder, statusOptions, evaluationStatusOptions, typeOptions, courseLineOptions]);

  // Group by teacher for 'by-teacher' view
  const groupedByTeacher = useMemo(() => {
    const groups: Record<string, OfficeHour[]> = {};
    
    filteredOfficeHours.forEach(oh => {
      const teacherId = oh.teacher?.id || 'unassigned';
      if (!groups[teacherId]) {
        groups[teacherId] = [];
      }
      groups[teacherId].push(oh);
    });

    return groups;
  }, [filteredOfficeHours]);

  // Calculate KPIs (áp dụng miễn trừ)
  const kpis = useMemo(() => {
    // Lọc theo miễn trừ
    const filtered = filteredOfficeHours.filter(oh => {
      // Miễn trừ type
      if (exemptTypes.includes(oh.type)) return false;
      // Miễn trừ status
      if (exemptStatuses.includes(oh.status)) return false;
      return true;
    });

    const total = filtered.length;
    if (total === 0) return null;

    const withTeacher = filtered.filter(oh => oh.teacher).length;
    const approved = filtered.filter(oh => oh.status === OFFICE_HOUR_STATUS.APPROVED).length;
    const rejected = filtered.filter(oh => oh.status === OFFICE_HOUR_STATUS.REJECTED).length;
    const abandoned = filtered.filter(oh => oh.status === OFFICE_HOUR_STATUS.ABANDONED).length;
    const totalStudents = filtered.reduce((sum, oh) => sum + (oh.studentCount || 0), 0);
    const trialSessions = filtered.filter(oh => oh.type === OFFICE_HOUR_TYPE.TRIAL).length;
    const officeSessions = filtered.filter(oh => oh.type === OFFICE_HOUR_TYPE.OFFICE).length;

    // Tính tỷ lệ chuyển đổi (conversion rate)
    // Conversion = học viên có Order HOẶC có Payment (vì có Payment thì chắc chắn đã có Order)
    // Áp dụng miễn trừ theo trạng thái học viên (appointment status)
    let totalAppointments = 0;
    let paidAppointments = 0;
    let trialedAppointments = 0;
    let hasOrderAppointments = 0;
    let convertedAppointments = 0; // Có Order HOẶC có Payment

    filtered.forEach(oh => {
      if (oh.appointments && oh.appointments.length > 0) {
        oh.appointments.forEach(apt => {
          // Bỏ qua appointment nếu status nằm trong danh sách miễn trừ
          if (exemptAppointmentStatuses.includes(apt.status)) return;
          
          totalAppointments++;
          if (apt.resultAfterTrial?.isHasPayment) paidAppointments++;
          if (apt.resultAfterTrial?.isTrialed) trialedAppointments++;
          if (apt.resultAfterTrial?.isHasOrder) hasOrderAppointments++;
          
          // Converted = có Order HOẶC có Payment (để xử lý trường hợp dữ liệu không nhất quán)
          if (apt.resultAfterTrial?.isHasOrder || apt.resultAfterTrial?.isHasPayment) {
            convertedAppointments++;
          }
        });
      }
    });

    return {
      total,
      teacherAssignmentRate: (withTeacher / total) * 100,
      approvalRate: (approved / total) * 100,
      cancellationRate: ((rejected + abandoned) / total) * 100,
      avgStudentsPerSession: totalStudents / total,
      trialSessions,
      officeSessions,
      trialPercentage: (trialSessions / total) * 100,
      totalAppointments,
      paidAppointments,
      trialedAppointments,
      hasOrderAppointments,
      convertedAppointments,
      conversionRate: totalAppointments > 0 ? (convertedAppointments / totalAppointments) * 100 : 0,
    };
  }, [filteredOfficeHours, exemptTypes, exemptStatuses, exemptAppointmentStatuses]);

  const conversionSuggestions = useMemo(() => {
    if (!kpis || kpis.totalAppointments === 0) {
      return [{
        key: 'conversion-data',
        target: '31%',
        content: 'cần dữ liệu học viên trải nghiệm để tính mốc',
      }];
    }

    return CONVERSION_TARGETS.map(({ value, label }) => {
      const reached = kpis.conversionRate >= value;
      const needed = reached
        ? 0
        : Math.max(1, Math.ceil((value / 100) * kpis.totalAppointments) - kpis.convertedAppointments);

      return {
        key: label,
        target: label,
        done: reached,
        content: reached
          ? <><Icon.Check size={11} /> Đã đạt</>
          : <>cần thêm <strong>{needed}</strong> học viên có đơn</>,
      };
    });
  }, [kpis]);

  // Chart data: By Centre
  const centreChartData = useMemo(() => {
    const map = new Map<string, { sessions: number; students: number; converted: number; conversionRate: number }>();
    
    filteredOfficeHours.forEach(oh => {
      // Apply exemptions
      if (exemptTypes.includes(oh.type) || exemptStatuses.includes(oh.status)) return;
      
      const centreName = oh.centre?.shortName || oh.centre?.name || 'Không rõ';
      if (!map.has(centreName)) {
        map.set(centreName, { sessions: 0, students: 0, converted: 0, conversionRate: 0 });
      }
      const entry = map.get(centreName)!;
      entry.sessions++;
      
      oh.appointments?.forEach(apt => {
        if (exemptAppointmentStatuses.includes(apt.status)) return;
        entry.students++;
        if (apt.resultAfterTrial?.isHasOrder || apt.resultAfterTrial?.isHasPayment) {
          entry.converted++;
        }
      });
    });

    return Array.from(map.entries())
      .map(([name, data]) => ({
        name,
        'Số ca': data.sessions,
        'Tỷ lệ chuyển đổi (%)': data.students > 0 ? parseFloat(((data.converted / data.students) * 100).toFixed(1)) : 0,
        _students: data.students,
        _converted: data.converted
      }))
      .filter(d => d['Số ca'] > 0)
      .sort((a, b) => b['Số ca'] - a['Số ca'])
      .slice(0, 10);
  }, [filteredOfficeHours, exemptTypes, exemptStatuses, exemptAppointmentStatuses]);

  // Chart data: By Course Category
  const courseLineChartData = useMemo(() => {
    const map = new Map<string, { sessions: number; students: number; converted: number }>();
    
    filteredOfficeHours.forEach(oh => {
      // Apply exemptions
      if (exemptTypes.includes(oh.type) || exemptStatuses.includes(oh.status)) return;
      
      const category = getOfficeHourCategory(oh);
      if (!map.has(category)) {
        map.set(category, { sessions: 0, students: 0, converted: 0 });
      }
      const entry = map.get(category)!;
      entry.sessions++;
      
      oh.appointments?.forEach(apt => {
        if (exemptAppointmentStatuses.includes(apt.status)) return;
        entry.students++;
        if (apt.resultAfterTrial?.isHasOrder || apt.resultAfterTrial?.isHasPayment) {
          entry.converted++;
        }
      });
    });

    return Array.from(map.entries())
      .map(([name, data]) => ({
        name,
        'Số ca': data.sessions,
        'Tỷ lệ chuyển đổi (%)': data.students > 0 ? parseFloat(((data.converted / data.students) * 100).toFixed(1)) : 0,
        _students: data.students,
        _converted: data.converted
      }))
      .filter(d => d['Số ca'] > 0)
      .sort((a, b) => b['Số ca'] - a['Số ca']);
  }, [filteredOfficeHours, exemptTypes, exemptStatuses, exemptAppointmentStatuses]);

  // Format date/time
  const formatDateTime = (isoString: string) => {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const handleSort = (key: typeof sortBy) => {
    if (sortBy === key) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      setSortOrder('asc');
    }
  };

  const handleTeacherSort = (key: typeof teacherSortBy) => {
    if (teacherSortBy === key) {
      setTeacherSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setTeacherSortBy(key);
      setTeacherSortOrder('asc');
    }
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  };

  // getConversionRateColor replaced by conversionColor from '@/lib/kpiScoring'
  // Thresholds: < 15% → 1, 15–25% → 2, 26–30% → 3, 31–40% → 4, > 40% → 5

  const formatTimestamp = (timestamp: number | undefined) => {
    if (!timestamp || isNaN(timestamp)) return '—';
    // Handle both seconds and milliseconds timestamps
    const ms = timestamp < 10000000000 ? timestamp * 1000 : timestamp;
    const date = new Date(ms);
    if (isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const selectedEntry = useMemo(() => 
    officeHours.find(oh => oh.id === selectedOfficeHourId),
    [officeHours, selectedOfficeHourId]
  );

  // User display
  const _storedSession = session ?? loadSession();
  const _displayName = _storedSession?.displayName?.trim() || '';
  const _email = _storedSession?.email || '';
  const userAvatar = _displayName ? initials(_displayName) : _email.charAt(0).toUpperCase();
  const userName = _displayName || _email.split('@')[0];
  const userEmail = _email;

  // Allowed pages (for navigation filtering)
  const { allowedPages } = useAllowedPages();

  // Navigation items
  const navItems = getNavItemsWithRouter('office-hours', router, allowedPages);

  if (authLoading) return null;

  return (
    <>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <PageLayout
        title="Ca Trải nghiệm"
        activePage="office-hours"
        sidebarOpen={sidebarOpen}
        onSidebarToggle={setSidebarOpen}
      >
        {/* Toolbar */}
        <Toolbar
          centres={centres}
          selectedCentres={selectedCentres}
          onCentresChange={setSelectedCentres}
          centresLoading={false}
          dateFrom={timeFrom}
          dateTo={timeTo}
          onDateFromChange={setTimeFrom}
          onDateToChange={setTimeTo}
          onFetch={handleFetch}
          onCancel={handleCancelFetch}
          loading={loading}
          progress={progress}
          hasData={officeHours.length > 0}
          onClearCache={handleClearCache}
          showRegionQuickSelect={true}
          quickFilterSlots={
            hasPreferences && (
              <QuickFilterChips
                centres={centres}
                selectedCentres={selectedCentres}
                onCentresChange={setSelectedCentres}
                selectedCourses={toolbarSelectedGrades}
                onCoursesChange={setToolbarSelectedGrades}
                showCentres={true}
                showCourses={true}
              />
            )
          }
        />

          <div className={styles.dashboardLayout}>
            <div>
              {/* KPI Cards */}
              {kpis && (
                <div className={styles.statsGrid}>
                  <div className={styles.statCard}>
                    <div className={styles.statLabel}>TỶ LỆ CHUYỂN ĐỔI</div>
                    <div className={styles.statValue} style={{ color: conversionColor(kpis.conversionRate) }}>
                      {kpis.conversionRate.toFixed(1)}%
                    </div>
                    <div className={styles.statDesc}>
                      {kpis.convertedAppointments}/{kpis.totalAppointments} học viên có đơn hàng
                    </div>
                  </div>

                  <div className={styles.statCard}>
                    <div className={styles.statLabel}>TỔNG SỐ CA</div>
                    <div className={styles.statValue}>{kpis.total}</div>
                    <div className={styles.statDesc}>
                      {kpis.trialSessions} ca trực tuyến · {kpis.officeSessions} ca tại cơ sở
                    </div>
                  </div>

                  <div className={styles.statCard}>
                    <div className={styles.statLabel}>TỔNG HỌC VIÊN</div>
                    <div className={styles.statValue}>{kpis.totalAppointments}</div>
                    <div className={styles.statDesc}>
                      {kpis.trialedAppointments} đã học thử · {kpis.hasOrderAppointments} có đơn
                    </div>
                  </div>

                  <div className={styles.statCard}>
                    <div className={styles.statLabel}>TỶ LỆ ĐIỀU PHỐI GV</div>
                    <div className={styles.statValue}>{kpis.teacherAssignmentRate.toFixed(1)}%</div>
                    <div className={styles.statDesc}>
                      {filteredOfficeHours.filter(oh => oh.teacher).length}/{kpis.total} ca có giáo viên
                    </div>
                  </div>

                  <div className={styles.statCard}>
                    <div className={styles.statLabel}>TỶ LỆ XÁC NHẬN</div>
                    <div className={styles.statValue}>{kpis.approvalRate.toFixed(1)}%</div>
                    <div className={styles.statDesc}>
                      {filteredOfficeHours.filter(oh => oh.status === OFFICE_HOUR_STATUS.APPROVED).length} ca đã xác nhận
                    </div>
                  </div>

                  <div className={styles.statCard}>
                    <div className={styles.statLabel}>TỶ LỆ HỦY/TỪ CHỐI</div>
                    <div className={styles.statValue}>{kpis.cancellationRate.toFixed(1)}%</div>
                    <div className={styles.statDesc}>
                      {filteredOfficeHours.filter(oh => 
                        oh.status === OFFICE_HOUR_STATUS.REJECTED || 
                        oh.status === OFFICE_HOUR_STATUS.ABANDONED
                      ).length} ca bị huỷ
                    </div>
                  </div>
                </div>
              )}

              {kpis && (
                <KPIThresholdSuggestions
                  label="Chuyển đổi:"
                  items={conversionSuggestions}
                />
              )}

              {/* CHARTS */}
              {filteredOfficeHours.length > 1 && (centreChartData.length > 0 || courseLineChartData.length > 0) && (
                <div className={styles.chartsSection}>
                  <ChartSectionHeader
                    title="Biểu Đồ Phân Tích"
                  />
                  <div className={styles.chartsGrid}>
                    
                    {/* Chart: By Centre - Composed Chart với Dual Axis */}
                    {centreChartData.length > 0 && (
                      <div className={styles.chartCard}>
                        <div className={styles.chartTitle}>Theo Cơ Sở - Số Ca & Tỷ Lệ Chuyển Đổi</div>
                        <div style={{ flex: 1, minHeight: 0 }}>
                          <ResponsiveContainer width="100%" height={Math.max(240, centreChartData.length * 36)}>
                            <ComposedChart 
                              data={centreChartData} 
                              layout="vertical"
                              margin={{ top: 20, right: 20, left: 8, bottom: 20 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" horizontal={false} />
                              <XAxis 
                                type="number"
                                tick={{ fontSize: 11, fill: 'var(--text-quaternary)' }}
                                axisLine={false}
                                tickLine={false}
                                label={{ value: 'Số ca', angle: 0, position: 'insideBottom', offset: -5, style: { fontSize: 11, fill: 'var(--text-tertiary)', fontWeight: 590, textTransform: 'uppercase', letterSpacing: '0.04em' } }}
                              />
                              <YAxis 
                                dataKey="name"
                                type="category"
                                width={80}
                                tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                                axisLine={false}
                                tickLine={false}
                                label={{ value: 'Cơ sở', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: 'var(--text-tertiary)', fontWeight: 590, textTransform: 'uppercase', letterSpacing: '0.04em' } }}
                              />
                              <ReTooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
                              <Bar dataKey="Số ca" radius={[0, 4, 4, 0]} minPointSize={3}>
                                {centreChartData.map((d, i) => (
                                  <Cell 
                                    key={i} 
                                    fill={conversionColor(d['Tỷ lệ chuyển đổi (%)'])} 
                                    fillOpacity={0.85}
                                  />
                                ))}
                              </Bar>
                            </ComposedChart>
                          </ResponsiveContainer>
                        </div>
                        <ChartLegend items={CONVERSION_LEGEND.map(l => ({
                          color: KPI_COLORS[l.score],
                          label: l.label,
                        }))} />
                      </div>
                    )}

                    {/* Chart: By Course Category - Composed Chart với Dual Axis */}
                    {courseLineChartData.length > 0 && (
                      <div className={styles.chartCard}>
                        <div className={styles.chartTitle}>Theo Khối - Số Ca & Tỷ Lệ Chuyển Đổi</div>
                        <div style={{ flex: 1, minHeight: 0 }}>
                          <ResponsiveContainer width="100%" height={Math.max(240, courseLineChartData.length * 44)}>
                            <ComposedChart 
                              data={courseLineChartData} 
                              layout="vertical"
                              margin={{ top: 20, right: 20, left: 8, bottom: 20 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" horizontal={false} />
                              <XAxis 
                                type="number"
                                tick={{ fontSize: 11, fill: 'var(--text-quaternary)' }}
                                axisLine={false}
                                tickLine={false}
                                label={{ value: 'Số ca', angle: 0, position: 'insideBottom', offset: -5, style: { fontSize: 11, fill: 'var(--text-tertiary)', fontWeight: 590, textTransform: 'uppercase', letterSpacing: '0.04em' } }}
                              />
                              <YAxis 
                                dataKey="name"
                                type="category"
                                width={80}
                                tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                                axisLine={false}
                                tickLine={false}
                                label={{ value: 'Khối học', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: 'var(--text-tertiary)', fontWeight: 590, textTransform: 'uppercase', letterSpacing: '0.04em' } }}
                              />
                              <ReTooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
                              <Bar dataKey="Số ca" radius={[0, 4, 4, 0]} minPointSize={3}>
                                {courseLineChartData.map((d, i) => (
                                  <Cell 
                                    key={i} 
                                    fill={conversionColor(d['Tỷ lệ chuyển đổi (%)'])} 
                                    fillOpacity={0.85}
                                  />
                                ))}
                              </Bar>
                            </ComposedChart>
                          </ResponsiveContainer>
                        </div>
                        <ChartLegend items={CONVERSION_LEGEND.map(l => ({
                          color: KPI_COLORS[l.score],
                          label: l.label,
                        }))} />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Table */}
              {(officeHours.length > 0 || loading) && (
                <>
                  <ViewModeToggle
                    value={viewMode}
                    onChange={setViewMode}
                    options={[
                      { value: 'all', label: 'Danh sách', icon: <Icon.Table /> },
                      { value: 'by-teacher', label: 'Theo giáo viên', icon: <Icon.User /> },
                    ]}
                  />

                  <AdminTableSection
                    title={viewMode === 'all' ? 'Danh sách ca trải nghiệm' : 'Phân tích theo Giáo viên'}
                    count={viewMode === 'all' ? filteredOfficeHours.length : Object.keys(groupedByTeacher).length}
                    loading={loading}
                    progress={progress}
                    isExpanded={showActiveTable}
                    onToggle={() => setShowActiveTable(p => !p)}
                    toolbarSlot={
                      officeHours.length > 0 ? (
                          <TableToolbar
                            search={searchQuery}
                            onSearchChange={setSearchQuery}
                            searchPlaceholder="Tìm kiếm..."
                            quickFilterSlots={
                              hasPreferences && (
                                <QuickFilterChips
                                  centres={centres}
                                  selectedCentres={tableSelectedCentres}
                                  onCentresChange={setTableSelectedCentres}
                                  selectedCourses={selectedGrades}
                                  onCoursesChange={setSelectedGrades}
                                  showCentres={true}
                                  showCourses={true}
                                />
                              )
                            }
                            filterSlots={
                              <>
                                {tableCentreIds.length > 1 && (
                                  <CentreSelect menuPosition="fixed"
                                    centres={centres}
                                    selected={tableSelectedCentres}
                                    onChange={setTableSelectedCentres}
                                    filterToIds={tableCentreIds}
                                    placeholder="Tất cả cơ sở"
                                    searchable
                                  />
                                )}
                                {courseLineOptions.length > 1 && (
                                  <MultiSelect menuPosition="fixed"
                                    options={courseLineOptions}
                                    selected={selectedGrades}
                                    onChange={setSelectedGrades}
                                    placeholder="Tất cả khối"
                                    maxDisplay={2}
                                  />
                                )}
                                {statusOptions.length > 1 && (
                                  <MultiSelect menuPosition="fixed"
                                    options={statusOptions}
                                    selected={selectedStatuses}
                                    onChange={setSelectedStatuses}
                                    placeholder="Tất cả trạng thái ca"
                                  />
                                )}
                                {evaluationStatusOptions.length > 1 && (
                                  <MultiSelect menuPosition="fixed"
                                    options={evaluationStatusOptions}
                                    selected={selectedEvaluationStatuses}
                                    onChange={setSelectedEvaluationStatuses}
                                    placeholder="Tất cả đánh giá"
                                  />
                                )}
                                {typeOptions.length > 1 && (
                                  <MultiSelect menuPosition="fixed"
                                    options={typeOptions}
                                    selected={selectedTypes}
                                    onChange={setSelectedTypes}
                                    placeholder="Tất cả loại"
                                  />
                                )}
                              </>
                            }
                            hasFilter={hasTableFilter}
                            onClearFilter={clearTableFilters}
                          />
                      ) : null
                    }
                  >
                        <div className={styles.tableScrollWrapper}>
                {/* Conditional rendering based on viewMode */}
                {viewMode === 'all' ? (
                  <>
                    {/* Inner wrapper with min-width for "Danh sách" view */}
                    <div style={{ minWidth: '1450px' }}>
                    {/* Table Header - View: Danh sách */}
                    <div className={styles.classItemHeader} style={{ gridTemplateColumns: OFFICE_HOUR_LIST_GRID }}>
                  <div
                    className={`${styles.sortableCol} ${sortBy === 'time' ? styles.activeSort : ''}`}
                    onClick={() => handleSort('time')}
                  >
                    Thời gian
                    {sortBy === 'time' ? (
                      sortOrder === 'asc' ? (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="18 15 12 9 6 15" /></svg>
                      ) : (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
                      )
                    ) : (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="17 11 12 6 7 11" /><polyline points="17 18 12 13 7 18" /></svg>
                    )}
                  </div>
                  <div
                    className={`${styles.sortableCol} ${sortBy === 'type' ? styles.activeSort : ''}`}
                    onClick={() => handleSort('type')}
                  >
                    Loại ca
                    {sortBy === 'type' ? (
                      sortOrder === 'asc' ? (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="18 15 12 9 6 15" /></svg>
                      ) : (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
                      )
                    ) : (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="17 11 12 6 7 11" /><polyline points="17 18 12 13 7 18" /></svg>
                    )}
                  </div>
                  <div
                    className={`${styles.sortableCol} ${sortBy === 'course' ? styles.activeSort : ''}`}
                    onClick={() => handleSort('course')}
                  >
                    Khoá học
                    {sortBy === 'course' ? (
                      sortOrder === 'asc' ? (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="18 15 12 9 6 15" /></svg>
                      ) : (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
                      )
                    ) : (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="17 11 12 6 7 11" /><polyline points="17 18 12 13 7 18" /></svg>
                    )}
                  </div>
                  <div
                    className={`${styles.sortableCol} ${sortBy === 'teacher' ? styles.activeSort : ''}`}
                    onClick={() => handleSort('teacher')}
                  >
                    Giáo viên
                    {sortBy === 'teacher' ? (
                      sortOrder === 'asc' ? (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="18 15 12 9 6 15" /></svg>
                      ) : (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
                      )
                    ) : (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="17 11 12 6 7 11" /><polyline points="17 18 12 13 7 18" /></svg>
                    )}
                  </div>
                  <div
                    className={`${styles.sortableCol} ${sortBy === 'centre' ? styles.activeSort : ''}`}
                    onClick={() => handleSort('centre')}
                  >
                    Cơ sở
                    {sortBy === 'centre' ? (
                      sortOrder === 'asc' ? (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="18 15 12 9 6 15" /></svg>
                      ) : (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
                      )
                    ) : (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="17 11 12 6 7 11" /><polyline points="17 18 12 13 7 18" /></svg>
                    )}
                  </div>
                  <div
                    className={`${styles.sortableCol} ${sortBy === 'students' ? styles.activeSort : ''}`}
                    onClick={() => handleSort('students')}
                  >
                    {LABELS.STUDENTS}
                    {sortBy === 'students' ? (
                      sortOrder === 'asc' ? (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="18 15 12 9 6 15" /></svg>
                      ) : (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
                      )
                    ) : (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="17 11 12 6 7 11" /><polyline points="17 18 12 13 7 18" /></svg>
                    )}
                  </div>
                  <div
                    className={`${styles.sortableCol} ${sortBy === 'status' ? styles.activeSort : ''}`}
                    onClick={() => handleSort('status')}
                  >
                    Trạng thái ca
                    {sortBy === 'status' ? (
                      sortOrder === 'asc' ? (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="18 15 12 9 6 15" /></svg>
                      ) : (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
                      )
                    ) : (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="17 11 12 6 7 11" /><polyline points="17 18 12 13 7 18" /></svg>
                    )}
                  </div>
                  <div
                    className={`${styles.sortableCol} ${sortBy === 'evaluation' ? styles.activeSort : ''}`}
                    onClick={() => handleSort('evaluation')}
                  >
                    Đánh giá
                    {sortBy === 'evaluation' ? (
                      sortOrder === 'asc' ? (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="18 15 12 9 6 15" /></svg>
                      ) : (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
                      )
                    ) : (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="17 11 12 6 7 11" /><polyline points="17 18 12 13 7 18" /></svg>
                    )}
                  </div>
                  <div
                    className={`${styles.sortableCol} ${sortBy === 'confirmed' ? styles.activeSort : ''}`}
                    onClick={() => handleSort('confirmed')}
                  >
                    Đã xác nhận
                    {sortBy === 'confirmed' ? (
                      sortOrder === 'asc' ? (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="18 15 12 9 6 15" /></svg>
                      ) : (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
                      )
                    ) : (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="17 11 12 6 7 11" /><polyline points="17 18 12 13 7 18" /></svg>
                    )}
                  </div>
                  <div
                    className={`${styles.sortableCol} ${sortBy === 'paid' ? styles.activeSort : ''}`}
                    onClick={() => handleSort('paid')}
                  >
                    Đã thanh toán
                    {sortBy === 'paid' ? (
                      sortOrder === 'asc' ? (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="18 15 12 9 6 15" /></svg>
                      ) : (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
                      )
                    ) : (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="17 11 12 6 7 11" /><polyline points="17 18 12 13 7 18" /></svg>
                    )}
                  </div>
                  <div
                    className={`${styles.sortableCol} ${sortBy === 'comments' ? styles.activeSort : ''}`}
                    onClick={() => handleSort('comments')}
                  >
                    Nhận xét GV
                    {sortBy === 'comments' ? (
                      sortOrder === 'asc' ? (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="18 15 12 9 6 15" /></svg>
                      ) : (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
                      )
                    ) : (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="17 11 12 6 7 11" /><polyline points="17 18 12 13 7 18" /></svg>
                    )}
                  </div>
                </div>

                {/* Skeleton loading */}
                {loading && officeHours.length === 0 && Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className={styles.skeletonRow} style={{ gridTemplateColumns: OFFICE_HOUR_LIST_GRID, minWidth: 1450 }}>
                    {Array.from({ length: 11 }).map((_, j) => (
                      <div key={j} className={styles.skeletonBlock} style={{ width: `${[70, 50, 60, 40, 30, 50, 65, 45, 40, 40, 80][j]}%` }} />
                    ))}
                  </div>
                ))}

                {/* Data rows */}
                {filteredOfficeHours.map(oh => {
                  // Tính số học viên đã thanh toán
                  const paidCount = oh.appointments?.filter(apt => apt.resultAfterTrial?.isHasPayment).length || 0;
                  const totalAppointments = oh.appointments?.length || 0;
                  
                  // Tính số học viên đã có nhận xét
                  const commentedCount = oh.appointments?.filter(apt => apt.note).length || 0;
                  
                  // Tính số học viên đã xác nhận trạng thái (không phải WAITING/PENDING)
                  const confirmedCount = oh.appointments?.filter(apt => 
                    apt.status && !['WAITING', 'PENDING'].includes(apt.status.toUpperCase())
                  ).length || 0;
                  
                  return (
                    <div
                      key={oh.id}
                      className={styles.classItem}
                      style={{ 
                        gridTemplateColumns: OFFICE_HOUR_LIST_GRID,
                        cursor: 'pointer'
                      }}
                      onClick={() => { setSelectedOfficeHourId(oh.id); openEditForOfficeHour(oh); }}
                    >
                      <div className={styles.className}>
                        <span>{formatDateTime(oh.startTime)}</span>
                        <span className={styles.centreName}>
                          {formatTime(oh.startTime)} - {formatTime(oh.endTime)}
                        </span>
                      </div>

                      <div className={styles.sizeCol}>
	                        <OfficeHourTypeBadge type={oh.type} />
                      </div>

                      <div className={styles.reasonsPreview}>
                        {oh.courses?.map(course => (
                          <Badge key={course.id} variant="default" size="sm" shape="rounded">
                            {course.shortName}
                          </Badge>
                        ))}
                      </div>

                      <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                        {oh.teacher?.fullName || '—'}
                      </div>

                      <div><CentreBadge name={oh.centre?.shortName || oh.centre?.name} /></div>

                      <div className={styles.sizeCol}>{totalAppointments}</div>

                      <div className={styles.sizeCol}>
                        <RawStatusBadge status={oh.status} />
                      </div>

                      <EvaluationStatusSummary appointments={oh.appointments} />

                      {/* Cột Đã xác nhận */}
                      <div className={styles.sizeCol}>
                        {totalAppointments > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-1)' }}>
                            <span style={{ 
                              fontSize: 15, 
                              fontWeight: 590, 
                              color: confirmedCount > 0 ? 'var(--brand-indigo)' : '#9ca3af' 
                            }}>
                              {confirmedCount}/{totalAppointments}
                            </span>
                            {confirmedCount > 0 && (
                              <span style={{ 
                                fontSize: 10, 
                                fontWeight: 600, 
                                color: 'rgba(59, 130, 246, 1)',
                                background: 'rgba(59, 130, 246, 0.1)',
                                padding: '2px 6px',
                                borderRadius: 4
                              }}>
                                {((confirmedCount / totalAppointments) * 100).toFixed(0)}%
                              </span>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-tertiary)' }}>—</span>
                        )}
                      </div>

                      {/* Cột Đã thanh toán - NỔI BẬT */}
                      <div className={styles.sizeCol}>
                        {totalAppointments > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-1)' }}>
                            <span style={{ 
                              fontSize: 15, 
                              fontWeight: 590, 
                              color: paidCount > 0 ? 'var(--status-success)' : '#9ca3af' 
                            }}>
                              {paidCount}/{totalAppointments}
                            </span>
                            {paidCount > 0 && (
                              <span style={{ 
                                fontSize: 10, 
                                fontWeight: 600, 
                                color: 'var(--status-success)',
                                background: 'rgba(5, 150, 105, 0.08)',
                                padding: '2px 6px',
                                borderRadius: 4
                              }}>
                                {((paidCount / totalAppointments) * 100).toFixed(0)}%
                              </span>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-tertiary)' }}>—</span>
                        )}
                      </div>

                      {/* Cột Nhận xét GV - Số liệu */}
                      <div className={styles.sizeCol}>
                        {totalAppointments > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-1)' }}>
                            <span style={{ 
                              fontSize: 15, 
                              fontWeight: 590, 
                              color: commentedCount > 0 ? 'var(--status-warning)' : '#9ca3af' 
                            }}>
                              {commentedCount}/{totalAppointments}
                            </span>
                            {commentedCount > 0 && (
                              <span style={{ 
                                fontSize: 10, 
                                fontWeight: 600, 
                                color: 'var(--status-warning)',
                                background: 'rgba(245, 158, 11, 0.1)',
                                padding: '2px 6px',
                                borderRadius: 4
                              }}>
                                {((commentedCount / totalAppointments) * 100).toFixed(0)}%
                              </span>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-tertiary)' }}>—</span>
                        )}
                      </div>
                    </div>
                  );
                })}
                    </div>
                    {/* End of min-width wrapper for "Danh sách" view */}
                  </>
                ) : (
                  // View: Theo giáo viên - Table View
                  <>
                    {/* Inner wrapper with min-width for "Theo giáo viên" view (7 columns) */}
                    <div style={{ minWidth: '1000px' }}>
                    {/* Table Header */}
                    <div className={styles.classItemHeader} style={{ gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 0.8fr) minmax(0, 0.8fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)' }}>
                      <div
                        className={`${styles.sortableCol} ${teacherSortBy === 'name' ? styles.activeSort : ''}`}
                        onClick={() => handleTeacherSort('name')}
                      >
                        Giáo viên
                        {teacherSortBy === 'name' ? (
                          teacherSortOrder === 'asc' ? (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="18 15 12 9 6 15" /></svg>
                          ) : (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
                          )
                        ) : (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="17 11 12 6 7 11" /><polyline points="17 18 12 13 7 18" /></svg>
                        )}
                      </div>
                      <div
                        className={`${styles.sortableCol} ${teacherSortBy === 'sessions' ? styles.activeSort : ''}`}
                        onClick={() => handleTeacherSort('sessions')}
                      >
                        Số ca
                        {teacherSortBy === 'sessions' ? (
                          teacherSortOrder === 'asc' ? (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="18 15 12 9 6 15" /></svg>
                          ) : (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
                          )
                        ) : (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="17 11 12 6 7 11" /><polyline points="17 18 12 13 7 18" /></svg>
                        )}
                      </div>
                      <div
                        className={`${styles.sortableCol} ${teacherSortBy === 'students' ? styles.activeSort : ''}`}
                        onClick={() => handleTeacherSort('students')}
                      >
                        Học viên
                        {teacherSortBy === 'students' ? (
                          teacherSortOrder === 'asc' ? (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="18 15 12 9 6 15" /></svg>
                          ) : (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
                          )
                        ) : (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="17 11 12 6 7 11" /><polyline points="17 18 12 13 7 18" /></svg>
                        )}
                      </div>
                      <div
                        className={`${styles.sortableCol} ${teacherSortBy === 'confirmed' ? styles.activeSort : ''}`}
                        onClick={() => handleTeacherSort('confirmed')}
                      >
                        Đã xác nhận
                        {teacherSortBy === 'confirmed' ? (
                          teacherSortOrder === 'asc' ? (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="18 15 12 9 6 15" /></svg>
                          ) : (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
                          )
                        ) : (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="17 11 12 6 7 11" /><polyline points="17 18 12 13 7 18" /></svg>
                        )}
                      </div>
                      <div
                        className={`${styles.sortableCol} ${teacherSortBy === 'paid' ? styles.activeSort : ''}`}
                        onClick={() => handleTeacherSort('paid')}
                      >
                        Đã thanh toán
                        {teacherSortBy === 'paid' ? (
                          teacherSortOrder === 'asc' ? (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="18 15 12 9 6 15" /></svg>
                          ) : (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
                          )
                        ) : (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="17 11 12 6 7 11" /><polyline points="17 18 12 13 7 18" /></svg>
                        )}
                      </div>
                      <div
                        className={`${styles.sortableCol} ${teacherSortBy === 'comments' ? styles.activeSort : ''}`}
                        onClick={() => handleTeacherSort('comments')}
                      >
                        Có nhận xét
                        {teacherSortBy === 'comments' ? (
                          teacherSortOrder === 'asc' ? (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="18 15 12 9 6 15" /></svg>
                          ) : (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
                          )
                        ) : (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="17 11 12 6 7 11" /><polyline points="17 18 12 13 7 18" /></svg>
                        )}
                      </div>
                      <div
                        className={`${styles.sortableCol} ${teacherSortBy === 'conversion' ? styles.activeSort : ''}`}
                        onClick={() => handleTeacherSort('conversion')}
                      >
                        Tỷ lệ chuyển đổi
                        {teacherSortBy === 'conversion' ? (
                          teacherSortOrder === 'asc' ? (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="18 15 12 9 6 15" /></svg>
                          ) : (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
                          )
                        ) : (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="17 11 12 6 7 11" /><polyline points="17 18 12 13 7 18" /></svg>
                        )}
                      </div>
                    </div>

                    {/* Table Rows */}
                    {Object.entries(groupedByTeacher)
                      .map(([teacherId, teacherOhs]) => {
                        const teacher = teacherOhs[0]?.teacher;
                        const teacherName = teacher?.fullName || 'Chưa phân công';
                        const totalAppointments = teacherOhs.reduce((sum, oh) => sum + (oh.appointments?.length || 0), 0);
                        const totalConfirmed = teacherOhs.reduce((sum, oh) => 
                          sum + (oh.appointments?.filter(apt => apt.status && !['WAITING', 'PENDING'].includes(apt.status.toUpperCase())).length || 0), 0
                        );
                        const totalPaid = teacherOhs.reduce((sum, oh) => 
                          sum + (oh.appointments?.filter(apt => apt.resultAfterTrial?.isHasPayment).length || 0), 0
                        );
                        const totalCommented = teacherOhs.reduce((sum, oh) => 
                          sum + (oh.appointments?.filter(apt => apt.note).length || 0), 0
                        );
                        const conversionRate = totalAppointments > 0 ? (totalPaid / totalAppointments * 100) : 0;
                        
                        return {
                          teacherId,
                          teacherOhs,
                          teacher,
                          teacherName,
                          totalAppointments,
                          totalConfirmed,
                          totalPaid,
                          totalCommented,
                          conversionRate
                        };
                      })
                      .sort((a, b) => {
                        let comparison = 0;
                        
                        if (teacherSortBy === 'name') {
                          comparison = a.teacherName.localeCompare(b.teacherName);
                        } else if (teacherSortBy === 'sessions') {
                          comparison = a.teacherOhs.length - b.teacherOhs.length;
                        } else if (teacherSortBy === 'students') {
                          comparison = a.totalAppointments - b.totalAppointments;
                        } else if (teacherSortBy === 'confirmed') {
                          comparison = a.totalConfirmed - b.totalConfirmed;
                        } else if (teacherSortBy === 'paid') {
                          comparison = a.totalPaid - b.totalPaid;
                        } else if (teacherSortBy === 'comments') {
                          comparison = a.totalCommented - b.totalCommented;
                        } else if (teacherSortBy === 'conversion') {
                          comparison = a.conversionRate - b.conversionRate;
                        }
                        
                        return teacherSortOrder === 'asc' ? comparison : -comparison;
                      })
                      .map(({ teacherId, teacherOhs, teacher, teacherName, totalAppointments, totalConfirmed, totalPaid, totalCommented, conversionRate }) => {
                        return (
                          <div
                            key={teacherId}
                            className={styles.classItem}
                            style={{ 
                              gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 0.8fr) minmax(0, 0.8fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)',
                              cursor: 'pointer'
                            }}
                            onClick={() => setSelectedTeacherForModal({ 
                              teacherId, 
                              teacherName, 
                              teacher,
                              officeHours: teacherOhs 
                            })}
                          >
                            {/* Teacher Name with Avatar */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                              {teacher?.imageUrl ? (
                                <img 
                                  src={teacher.imageUrl} 
                                  alt={teacherName}
                                  style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: '50%',
                                    objectFit: 'cover',
                                    flexShrink: 0
                                  }}
                                />
                              ) : (
                                <div style={{
                                  width: 32,
                                  height: 32,
                                  borderRadius: '50%',
                                  background: 'var(--brand-indigo)',
                                  color: 'white',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: 12,
                                  fontWeight: 600,
                                  flexShrink: 0
                                }}>
                                  {initials(teacherName)}
                                </div>
                              )}
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 510, color: 'var(--text-primary)' }}>
                                  {teacherName}
                                </div>
                                {teacher?.code && (
                                  <div style={{ fontSize: 11, color: 'var(--text-quaternary)' }}>
                                    {teacher.code}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Số ca */}
                            <div className={styles.sizeCol}>
                              <span style={{ fontSize: 15, fontWeight: 590, color: 'var(--text-primary)' }}>
                                {teacherOhs.length}
                              </span>
                            </div>

                            {/* Học viên */}
                            <div className={styles.sizeCol}>
                              <span style={{ fontSize: 15, fontWeight: 590, color: 'var(--text-primary)' }}>
                                {totalAppointments}
                              </span>
                            </div>

                            {/* Đã xác nhận */}
                            <div className={styles.sizeCol}>
                              {totalAppointments > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-1)' }}>
                                  <span style={{ 
                                    fontSize: 15, 
                                    fontWeight: 590, 
                                    color: totalConfirmed > 0 ? 'var(--brand-indigo)' : '#9ca3af' 
                                  }}>
                                    {totalConfirmed}/{totalAppointments}
                                  </span>
                                  {totalConfirmed > 0 && (
                                    <span style={{ 
                                      fontSize: 10, 
                                      fontWeight: 600, 
                                      color: 'rgba(59, 130, 246, 1)',
                                      background: 'rgba(59, 130, 246, 0.1)',
                                      padding: '2px 6px',
                                      borderRadius: 4
                                    }}>
                                      {((totalConfirmed / totalAppointments) * 100).toFixed(0)}%
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span style={{ color: 'var(--text-tertiary)' }}>—</span>
                              )}
                            </div>

                            {/* Đã thanh toán */}
                            <div className={styles.sizeCol}>
                              {totalAppointments > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-1)' }}>
                                  <span style={{ 
                                    fontSize: 15, 
                                    fontWeight: 590, 
                                    color: totalPaid > 0 ? 'var(--status-success)' : '#9ca3af' 
                                  }}>
                                    {totalPaid}/{totalAppointments}
                                  </span>
                                  {totalPaid > 0 && (
                                    <span style={{ 
                                      fontSize: 10, 
                                      fontWeight: 600, 
                                      color: 'var(--status-success)',
                                      background: 'rgba(5, 150, 105, 0.08)',
                                      padding: '2px 6px',
                                      borderRadius: 4
                                    }}>
                                      {((totalPaid / totalAppointments) * 100).toFixed(0)}%
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span style={{ color: 'var(--text-tertiary)' }}>—</span>
                              )}
                            </div>

                            {/* Có nhận xét */}
                            <div className={styles.sizeCol}>
                              {totalAppointments > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-1)' }}>
                                  <span style={{ 
                                    fontSize: 15, 
                                    fontWeight: 590, 
                                    color: totalCommented > 0 ? 'var(--status-warning)' : '#9ca3af' 
                                  }}>
                                    {totalCommented}/{totalAppointments}
                                  </span>
                                  {totalCommented > 0 && (
                                    <span style={{ 
                                      fontSize: 10, 
                                      fontWeight: 600, 
                                      color: 'var(--status-warning)',
                                      background: 'rgba(245, 158, 11, 0.1)',
                                      padding: '2px 6px',
                                      borderRadius: 4
                                    }}>
                                      {((totalCommented / totalAppointments) * 100).toFixed(0)}%
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span style={{ color: 'var(--text-tertiary)' }}>—</span>
                              )}
                            </div>

                            {/* Tỷ lệ chuyển đổi */}
                            <div className={styles.sizeCol}>
                              {totalAppointments > 0 ? (
                                <div style={{ 
                                  fontSize: 16, 
                                  fontWeight: 590, 
                                  color: conversionColor(conversionRate)
                                }}>
                                  {conversionRate.toFixed(1)}%
                                </div>
                              ) : (
                                <span style={{ color: 'var(--text-tertiary)' }}>—</span>
                              )}
                            </div>
                          </div>
                        );
                      })}

                    {Object.keys(groupedByTeacher).length === 0 && (
                      <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--text-quaternary)', fontSize: 13 }}>
                        Không có dữ liệu để hiển thị.
                      </div>
                    )}
                    </div>
                    {/* End of min-width wrapper for "Theo giáo viên" view */}
                  </>
                )}
              </div>
              {/* End of tableScrollWrapper */}
                </AdminTableSection>
                </>
          )}
            </div>

            {/* Right Column: Exemption Rules Panel */}
            {(officeHours.length > 0 || loading) && (
              <div>
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
                          {/* Miễn trừ Loại ca */}
                          <div style={{ marginBottom: 'var(--space-4)' }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 'var(--space-2)' }}>
                              Miễn trừ Loại ca
                            </div>
                            <div className={styles.reasonList}>
                              {Array.from(new Set(officeHours.map(oh => oh.type))).sort().map(type => (
                                <label key={type} className={styles.reasonItem}>
                                  <input 
                                    type="checkbox" 
                                    className={styles.reasonCheckbox}
                                    checked={exemptTypes.includes(type)}
                                    onChange={() => {
                                      if (exemptTypes.includes(type)) {
                                        setExemptTypes(exemptTypes.filter(t => t !== type));
                                      } else {
                                        setExemptTypes([...exemptTypes, type]);
                                      }
                                    }}
                                  />
                                  <div className={styles.reasonLabel}>
                                    <span>{getOfficeHourTypeLabel(type)}</span>
                                    <span className={styles.reasonCount}>{exemptionCounts.typeCounts[type] || 0}</span>
                                  </div>
                                </label>
                              ))}
                            </div>
                          </div>

                          {/* Miễn trừ Trạng thái Ca */}
                          <div style={{ marginBottom: 'var(--space-4)' }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 'var(--space-2)' }}>
                              Miễn trừ Trạng thái Ca
                            </div>
                            <div className={styles.reasonList}>
                              {Array.from(new Set(officeHours.map(oh => oh.status))).sort().map(status => (
                                <label key={status} className={styles.reasonItem}>
                                  <input 
                                    type="checkbox" 
                                    className={styles.reasonCheckbox}
                                    checked={exemptStatuses.includes(status)}
                                    onChange={() => {
                                      if (exemptStatuses.includes(status)) {
                                        setExemptStatuses(exemptStatuses.filter(s => s !== status));
                                      } else {
                                        setExemptStatuses([...exemptStatuses, status]);
                                      }
                                    }}
                                  />
                                  <div className={styles.reasonLabel}>
                                    <span>{status}</span>
                                    <span className={styles.reasonCount}>{exemptionCounts.statusCounts[status] || 0}</span>
                                  </div>
                                </label>
                              ))}
                            </div>
                          </div>

                          {/* Miễn trừ Trạng thái Học viên */}
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 'var(--space-2)' }}>
                              Miễn trừ Trạng thái Học viên
                            </div>
                            <div className={styles.reasonList}>
                              {Array.from(new Set(officeHours.flatMap(oh => oh.appointments?.map(apt => apt.status) || []))).filter(Boolean).sort().map(status => (
                                <label key={status} className={styles.reasonItem}>
                                  <input 
                                    type="checkbox" 
                                    className={styles.reasonCheckbox}
                                    checked={exemptAppointmentStatuses.includes(status)}
                                    onChange={() => {
                                      if (exemptAppointmentStatuses.includes(status)) {
                                        setExemptAppointmentStatuses(exemptAppointmentStatuses.filter(s => s !== status));
                                      } else {
                                        setExemptAppointmentStatuses([...exemptAppointmentStatuses, status]);
                                      }
                                    }}
                                  />
                                  <div className={styles.reasonLabel}>
                                    <span>{status}</span>
                                    <span className={styles.reasonCount}>{exemptionCounts.appointmentStatusCounts[status] || 0}</span>
                                  </div>
                                </label>
                              ))}
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
          {officeHours.length === 0 && !loading && (
            <EmptyState
              icon={<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>}
              title="Chưa có dữ liệu ca trải nghiệm"
              subtitle={'Chọn khoảng thời gian và nhấn "Tải dữ liệu"'}
            />
          )}

        {/* Modal chi tiết */}
        <Modal open={!!selectedEntry} onClose={() => { setSelectedOfficeHourId(null); setEditDraft(null); }}>
          {selectedEntry && editDraft && (() => {
            return (
              <>
                <ModalHeader
                  title={`Ca ${selectedEntry.type} - ${formatDateTime(selectedEntry.startTime)}`}
                  subtitle={`${selectedEntry.centre?.name || ''} · ${selectedEntry.courses?.map(c => c.shortName).join(', ') || ''}`}
                  onClose={() => { setSelectedOfficeHourId(null); setEditDraft(null); }}
                />

              <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
                {/* Thông tin cơ bản */}
                <DetailGrid>
                  <DetailField label="Thời gian">
                    <DetailText meta={formatDate(selectedEntry.startTime)}>
                      {formatTime(selectedEntry.startTime)} - {formatTime(selectedEntry.endTime)}
                    </DetailText>
                  </DetailField>

                  <DetailField label="Trạng thái">
                    <RawStatusBadge status={selectedEntry.status} />
                  </DetailField>

                  <DetailField label="Loại ca">
	                    <OfficeHourTypeBadge type={selectedEntry.type} />
                  </DetailField>

                  <DetailField label="Số học viên">
                    <DetailText>
                      {selectedEntry.studentCount || 0} học viên
                    </DetailText>
                  </DetailField>

                  <DetailField label="Cơ sở">
                    <DetailText>
                      {selectedEntry.centre?.shortName || selectedEntry.centre?.name || '—'}
                    </DetailText>
                  </DetailField>

                  <DetailField label="Giáo viên">
                    <UserSearchInput
                      value={teacherSearch}
                      onChange={handleTeacherInputChange}
                      onSelect={(teacher) => {
                        setEditDraft(d => d ? { ...d, teacherId: teacher.id } : d);
                        setTeacherSearch('');
                        // Keep the selected teacher in results for display
                        setTeacherSearchResults([teacher as any]);
                      }}
                      onClear={() => {
                        setEditDraft(d => d ? { ...d, teacherId: '' } : d);
                        setTeacherSearchResults([]);
                        setTeacherSearch('');
                      }}
                      results={memoizedTeacherResults as any}
                      loading={teachersLoading}
                      placeholder="Tìm kiếm theo tên hoặc email..."
                      selectedUserName={currentTeacherDisplay || undefined}
                    />
                    
                    {/* Shift Requests Suggestions - Using reusable component */}
                    <ShiftRequestSuggestions
                      requests={shiftRequests}
                      onSelect={(request) => {
                        // Skip if missing required data
                        if (!request.teacher_id || !request.teacher_name) {
                          return;
                        }
                        
                        // Auto-fill teacher
                        setEditDraft(d => d ? { ...d, teacherId: request.teacher_id! } : d);
                        setTeacherSearch('');
                        // Add to search results for display
                        const teacher: Teacher = {
                          id: request.teacher_id,
                          username: '',
                          email: request.teacher_email,
                          fullName: request.teacher_name,
                          code: '',
                          phoneNumber: '',
                          isActive: true,
                          centres: [],
                        };
                        setTeacherSearchResults([teacher]);
                      }}
                    />
                  </DetailField>

                  <DetailField label="Ghi chú giáo viên">
                    <textarea
                      value={editDraft.teacherNote}
                      onChange={(e) => setEditDraft(d => d ? { ...d, teacherNote: e.target.value } : d)}
                      placeholder="Nhập ghi chú..."
                      style={{
                        width: '100%',
                        minHeight: 60,
                        padding: '8px 12px',
                        border: '1px solid var(--border-secondary)',
                        borderRadius: "var(--radius-comfortable)",
                        fontSize: 13,
                        fontFamily: 'inherit',
                        resize: 'vertical',
                        outline: 'none',
                        background: 'var(--bg-surface)',
                        color: 'var(--text-primary)',
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = 'var(--brand-indigo)';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = 'var(--border-secondary)';
                      }}
                    />
                  </DetailField>
                </DetailGrid>

                {/* Khoá học */}
                {selectedEntry.courses && selectedEntry.courses.length > 0 && (
                  <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-primary)' }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>
                      Khoá học ({selectedEntry.courses.length})
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                      {selectedEntry.courses.map(course => (
                        <div key={course.id} style={{ padding: 'var(--space-2) var(--space-3)', background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)', borderRadius: "var(--radius-comfortable)" }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                            {course.shortName}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                            {course.name}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Lớp học */}
                {selectedEntry.class && (
                  <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-primary)' }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>
                      Lớp học
                    </div>
                    <div style={{ padding: '12px', background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-card)' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                        {selectedEntry.class.name}
                      </div>
                      {selectedEntry.class.sessions && selectedEntry.class.sessions.length > 0 && (
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                          {selectedEntry.class.sessions.length} buổi học
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Ghi chú */}
                {(selectedEntry.note || selectedEntry.managerNote) && (
                  <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-primary)' }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>
                      Ghi chú
                    </div>
                    {selectedEntry.note && (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 12, fontWeight: 590, color: 'var(--text-tertiary)', marginBottom: 4 }}>
                          Ghi chú vận hành:
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-comfortable)' }}>
                          {selectedEntry.note}
                        </div>
                      </div>
                    )}
                    {selectedEntry.managerNote && (
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 590, color: 'var(--text-tertiary)', marginBottom: 4 }}>
                          Ghi chú quản lý:
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-comfortable)' }}>
                          {selectedEntry.managerNote}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Liên kết */}
                {selectedEntry.links && selectedEntry.links.length > 0 && (
                  <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-primary)' }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>
                      Liên kết ({selectedEntry.links.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                      {selectedEntry.links.map(link => (
                        <a
                          key={link._id}
                          href={link.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            padding: '10px 12px',
                            background: 'var(--bg-elevated)',
                            border: '1px solid var(--border-primary)',
                            borderRadius: "var(--radius-comfortable)",
                            color: 'var(--accent-primary)',
                            textDecoration: 'none',
                            fontSize: 13,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--space-2)',
                          }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                          </svg>
                          {link.title}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Lịch hẹn */}
                {selectedEntry.appointments && selectedEntry.appointments.length > 0 && (
                  <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-primary)' }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>
                      Lịch hẹn học viên ({selectedEntry.appointments.length})
                    </div>
                    
                    {/* Table wrapper with horizontal scroll */}
                    <div style={{ overflowX: 'auto', marginTop: 12 }}>
                      <div style={{ minWidth: '900px' }}>
                        {/* Table Header */}
                        <div style={{ 
                          display: 'grid', 
                          gridTemplateColumns: 'minmax(150px, 2fr) minmax(120px, 1fr) minmax(100px, 1fr) minmax(150px, 1.5fr) minmax(150px, 1.5fr) minmax(120px, 1fr)',
                          padding: '10px 12px',
                          background: 'var(--bg-elevated)',
                          borderRadius: '8px 8px 0 0',
                          border: '1px solid var(--border-primary)',
                          borderBottom: 'none',
                          fontSize: 11,
                          fontWeight: 590,
                          color: 'var(--text-quaternary)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>
                          <div>Học viên</div>
                          <div>Trạng thái</div>
                          <div>Khoá học</div>
                          <div>Nhận xét GV</div>
                          <div>Kết quả</div>
                          <div>Liên hệ</div>
                        </div>

                        {/* Table Body */}
                        {selectedEntry.appointments.map((apt, index) => (
                          <div
                            key={apt.id}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: 'minmax(150px, 2fr) minmax(120px, 1fr) minmax(100px, 1fr) minmax(150px, 1.5fr) minmax(150px, 1.5fr) minmax(120px, 1fr)',
                              padding: '12px',
                              background: 'var(--bg-surface)',
                              border: '1px solid var(--border-primary)',
                              borderTop: index === 0 ? '1px solid var(--border-primary)' : 'none',
                              borderRadius: index === (selectedEntry.appointments?.length ?? 0) - 1 ? '0 0 8px 8px' : '0',
                              fontSize: 13,
                              alignItems: 'start',
                              gap: 'var(--space-3)'
                            }}
                          >
                            {/* Học viên */}
                            <div>
                              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                                {apt.candidate.fullName}
                              </div>
                              {apt.title && (
                                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                                  {apt.title}
                                </div>
                              )}
                            </div>

                            {/* Trạng thái */}
                            <div>
                              <RawStatusBadge status={apt.status} />
                            </div>

                            {/* Khoá học */}
                            <div>
                              {apt.courses && apt.courses.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                                  {apt.courses.map(c => (
                                    <Badge key={c.id} variant="default" size="sm" shape="rounded">
                                      {c.shortName}
                                    </Badge>
                                  ))}
                                </div>
                              ) : (
                                <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>—</span>
                              )}
                            </div>

                            {/* Nhận xét GV */}
                            <div style={{ 
                              padding: '8px 10px', 
                              background: apt.note ? 'rgba(245, 158, 11, 0.1)' : 'var(--bg-elevated)', 
                              border: `1px solid ${apt.note ? 'var(--status-warning)' : 'var(--border-secondary)'}`,
                              borderRadius: "var(--radius-comfortable)",
                              fontSize: 12,
                              color: apt.note ? 'var(--status-warning)' : 'var(--text-tertiary)',
                              lineHeight: 1.4,
                              maxHeight: '80px',
                              overflowY: 'auto'
                            }}>
                              {apt.note || 'Chưa có nhận xét'}
                            </div>

                            {/* Kết quả */}
                            <div>
                              {apt.resultAfterTrial && (apt.resultAfterTrial.isTrialed || apt.resultAfterTrial.isHasOrder || apt.resultAfterTrial.isHasPayment) ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                                  {apt.resultAfterTrial.isTrialed && (
                                    <div style={{ fontSize: 12, color: 'var(--status-dark-green)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--status-success)' }} />
                                      Đã học thử
                                    </div>
                                  )}
                                  {apt.resultAfterTrial.isHasOrder && (
                                    <div style={{ fontSize: 12, color: 'var(--status-dark-green)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--status-success)' }} />
                                      Có đơn hàng
                                    </div>
                                  )}
                                  {apt.resultAfterTrial.isHasPayment && (
                                    <div style={{ fontSize: 12, color: 'var(--status-dark-green)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--status-success)' }} />
                                      Đã thanh toán
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>Chưa có kết quả</span>
                              )}
                            </div>

                            {/* Liên hệ */}
                            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                              {apt.candidate.phoneNumber && (
                                <div style={{ marginBottom: 4, display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                                  <span>📞</span>
                                  <span>{apt.candidate.phoneNumber}</span>
                                </div>
                              )}
                              {apt.candidate.email && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', wordBreak: 'break-all' }}>
                                  <span>✉️</span>
                                  <span>{apt.candidate.email}</span>
                                </div>
                              )}
                              {!apt.candidate.phoneNumber && !apt.candidate.email && (
                                <span style={{ color: 'var(--text-tertiary)' }}>—</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Bài kiểm tra đầu vào - Hiển thị riêng nếu có */}
                    {selectedEntry.appointments.some(apt => apt.entranceTest && (apt.entranceTest.testFileUrl || apt.entranceTest.submitUrl)) && (
                      <div style={{ marginTop: 16, padding: '12px', background: 'var(--bg-elevated)', borderRadius: "var(--radius-card)", border: '1px solid var(--border-primary)' }}>
                        <div style={{ fontSize: 12, fontWeight: 590, color: 'var(--text-quaternary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          📄 Bài kiểm tra đầu vào
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                          {selectedEntry.appointments.filter(apt => apt.entranceTest && (apt.entranceTest.testFileUrl || apt.entranceTest.submitUrl)).map(apt => (
                            <div key={apt.id} style={{ padding: '8px 10px', background: 'var(--bg-surface)', borderRadius: "var(--radius-comfortable)", border: '1px solid var(--border-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
                                  {apt.candidate.fullName}
                                </div>
                                {apt.entranceTest?.originalFilename && (
                                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                                    File: {apt.entranceTest.originalFilename}
                                  </div>
                                )}
                                {apt.entranceTest?.submittedAt && (
                                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                                    Nộp lúc: {formatTimestamp(apt.entranceTest.submittedAt)}
                                  </div>
                                )}
                              </div>
                              {(apt.entranceTest?.testFileUrl || apt.entranceTest?.submitUrl) && (
                                <a
                                  href={apt.entranceTest.testFileUrl || apt.entranceTest.submitUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    padding: '5px 10px',
                                    fontSize: 11,
                                    color: 'var(--link-light)',
                                    background: 'var(--bg-elevated)',
                                    border: '1px solid var(--border-primary)',
                                    borderRadius: "var(--radius-comfortable)",
                                    textDecoration: 'none',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 'var(--space-2)',
                                    fontWeight: 510,
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                    <polyline points="14 2 14 8 20 8" />
                                  </svg>
                                  Xem file
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Học viên thi lên lớp */}
                {selectedEntry.uplevelTestStudents && selectedEntry.uplevelTestStudents.length > 0 && (
                  <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-primary)' }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>
                      Học viên thi lên lớp ({selectedEntry.uplevelTestStudents.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                      {selectedEntry.uplevelTestStudents.map(uts => (
                        <div
                          key={uts.id}
                          style={{
                            padding: '14px',
                            background: 'var(--bg-elevated)',
                            border: '1px solid var(--border-primary)',
                            borderRadius: "var(--radius-card)",
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 10 }}>
                            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                              {uts.student?.fullName}
                            </div>
                            {uts.status && (
                              <RawStatusBadge status={uts.status} />
                            )}
                          </div>

                          {uts.class && (
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
                              Lớp: {uts.class.name}
                            </div>
                          )}

                          {uts.centre && (
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
                              Cơ sở: {uts.centre.shortName || uts.centre.name}
                            </div>
                          )}

                          {uts.note && (
                            <div style={{ marginTop: 8, padding: '8px 10px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-comfortable)' }}>
                              <div style={{ fontSize: 11, fontWeight: 590, color: 'var(--text-quaternary)', marginBottom: 4 }}>
                                GHI CHÚ:
                              </div>
                              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                {uts.note}
                              </div>
                            </div>
                          )}

                          {uts.fileUrl && (
                            <a
                              href={uts.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                marginTop: 10,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 'var(--space-2)',
                                padding: '6px 12px',
                                fontSize: 12,
                                color: 'var(--accent-primary)',
                                background: 'var(--bg-surface)',
                                border: '1px solid var(--border-primary)',
                                borderRadius: "var(--radius-comfortable)",
                                textDecoration: 'none',
                              }}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <polyline points="14 2 14 8 20 8" />
                              </svg>
                              Xem file bài thi
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Thông tin tạo/cập nhật */}
                <div style={{ padding: '16px 20px', fontSize: 11, color: 'var(--text-tertiary)' }}>
                  {selectedEntry.createdBy && selectedEntry.createdAt && (
                    <div>Tạo bởi: {selectedEntry.createdBy.username} · {formatTimestamp(selectedEntry.createdAt)}</div>
                  )}
                  {selectedEntry.lastModifiedBy && selectedEntry.lastModifiedAt && (
                    <div>Cập nhật bởi: {selectedEntry.lastModifiedBy.username} · {formatTimestamp(selectedEntry.lastModifiedAt)}</div>
                  )}
                </div>
              </div>

              {/* Save and Approve Buttons - Fixed at bottom */}
              <ModalFooter
                secondaryButton={{
                  label: 'Huỷ',
                  onClick: () => setSelectedOfficeHourId(null),
                  variant: 'secondary',
                  disabled: savingOfficeHour || approvingOfficeHour,
                }}
                additionalButtons={selectedEntry.status === OFFICE_HOUR_STATUS.PENDING ? [{
                  label: 'Phê duyệt',
                  onClick: () => handleApproveOfficeHour(selectedEntry.id),
                  variant: 'success',
                  loading: approvingOfficeHour,
                  loadingText: 'Đang phê duyệt...',
                  disabled: savingOfficeHour,
                }] : []}
                primaryButton={{
                  label: 'Lưu thay đổi',
                  onClick: () => handleSaveOfficeHour(selectedEntry.id),
                  variant: 'primary',
                  loading: savingOfficeHour,
                  loadingText: 'Đang lưu...',
                  disabled: approvingOfficeHour,
                }}
              />
            </>
          );
        })()}
        </Modal>

        {/* Modal Teacher Detail */}
        <Modal open={!!selectedTeacherForModal} onClose={() => setSelectedTeacherForModal(null)}>
          {selectedTeacherForModal && (
            <>
              <ModalHeader
                title={selectedTeacherForModal.teacherName}
                subtitle={`${selectedTeacherForModal.officeHours.length} ca trải nghiệm`}
                onClose={() => setSelectedTeacherForModal(null)}
              />
              <div style={{ padding: '16px', maxHeight: '70vh', overflowY: 'auto' }}>
                <div className={styles.tableScrollWrapper}>
                  {/* Table Header */}
                  <div className={styles.classItemHeader} style={{ gridTemplateColumns: TEACHER_OFFICE_HOUR_GRID, minWidth: 1200 }}>
                    <div>Thời gian</div>
                    <div>Loại ca</div>
                    <div>Khoá học</div>
                    <div>Cơ sở</div>
                    <div>Học viên</div>
                    <div>Trạng thái ca</div>
                    <div>Đánh giá</div>
                    <div>Đã xác nhận</div>
                    <div>Đã thanh toán</div>
                    <div>Nhận xét GV</div>
                  </div>

                  {/* Table Rows */}
                  {selectedTeacherForModal.officeHours.map(oh => {
                    const paidCount = oh.appointments?.filter(apt => apt.resultAfterTrial?.isHasPayment).length || 0;
                    const totalAppointments = oh.appointments?.length || 0;
                    const commentedCount = oh.appointments?.filter(apt => apt.note).length || 0;
                    const confirmedCount = oh.appointments?.filter(apt => 
                      apt.status && !['WAITING', 'PENDING'].includes(apt.status.toUpperCase())
                    ).length || 0;

                    return (
                      <div
                        key={oh.id}
                        className={styles.classItem}
                        style={{ 
                          gridTemplateColumns: TEACHER_OFFICE_HOUR_GRID,
                          minWidth: 1200,
                          cursor: 'pointer'
                        }}
                        onClick={() => {
                          setSelectedTeacherForModal(null);
                          setSelectedOfficeHourId(oh.id);
                          openEditForOfficeHour(oh);
                        }}
                      >
                        <div className={styles.className}>
                          <span>{formatDateTime(oh.startTime)}</span>
                          <span className={styles.centreName}>
                            {formatTime(oh.startTime)} - {formatTime(oh.endTime)}
                          </span>
                        </div>

                        <div className={styles.sizeCol}>
	                          <OfficeHourTypeBadge type={oh.type} />
                        </div>

                        <div className={styles.reasonsPreview}>
                          {oh.courses?.map(course => (
                            <Badge key={course.id} variant="default" size="sm" shape="rounded">
                              {course.shortName}
                            </Badge>
                          ))}
                        </div>

                        <div><CentreBadge name={oh.centre?.shortName || oh.centre?.name} /></div>

                        <div className={styles.sizeCol}>{totalAppointments}</div>

                        <div className={styles.sizeCol}>
                          <RawStatusBadge status={oh.status} />
                        </div>

                        <EvaluationStatusSummary appointments={oh.appointments} />

                        <div className={styles.sizeCol}>
                          {totalAppointments > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-1)' }}>
                              <span style={{ 
                                fontSize: 15, 
                                fontWeight: 590, 
                                color: confirmedCount > 0 ? 'var(--brand-indigo)' : '#9ca3af' 
                              }}>
                                {confirmedCount}/{totalAppointments}
                              </span>
                              {confirmedCount > 0 && (
                                <span style={{ 
                                  fontSize: 10, 
                                  fontWeight: 600, 
                                  color: 'rgba(59, 130, 246, 1)',
                                  background: 'rgba(59, 130, 246, 0.1)',
                                  padding: '2px 6px',
                                  borderRadius: 4
                                }}>
                                  {((confirmedCount / totalAppointments) * 100).toFixed(0)}%
                                </span>
                              )}
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-tertiary)' }}>—</span>
                          )}
                        </div>

                        <div className={styles.sizeCol}>
                          {totalAppointments > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-1)' }}>
                              <span style={{ 
                                fontSize: 15, 
                                fontWeight: 590, 
                                color: paidCount > 0 ? 'var(--status-success)' : '#9ca3af' 
                              }}>
                                {paidCount}/{totalAppointments}
                              </span>
                              {paidCount > 0 && (
                                <span style={{ 
                                  fontSize: 10, 
                                  fontWeight: 600, 
                                  color: 'var(--status-success)',
                                  background: 'rgba(5, 150, 105, 0.08)',
                                  padding: '2px 6px',
                                  borderRadius: 4
                                }}>
                                  {((paidCount / totalAppointments) * 100).toFixed(0)}%
                                </span>
                              )}
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-tertiary)' }}>—</span>
                          )}
                        </div>

                        <div className={styles.sizeCol}>
                          {totalAppointments > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-1)' }}>
                              <span style={{ 
                                fontSize: 15, 
                                fontWeight: 590, 
                                color: commentedCount > 0 ? 'var(--status-warning)' : '#9ca3af' 
                              }}>
                                {commentedCount}/{totalAppointments}
                              </span>
                              {commentedCount > 0 && (
                                <span style={{ 
                                  fontSize: 10, 
                                  fontWeight: 600, 
                                  color: 'var(--status-warning)',
                                  background: 'rgba(245, 158, 11, 0.1)',
                                  padding: '2px 6px',
                                  borderRadius: 4
                                }}>
                                  {((commentedCount / totalAppointments) * 100).toFixed(0)}%
                                </span>
                              )}
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-tertiary)' }}>—</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </Modal>
      </PageLayout>
    </>
  );
}

export default function OfficeHoursPage() {
  return (
    <ProtectedPage pageKey="office-hours">
      <Suspense fallback={<div>Đang tải...</div>}>
        <OfficeHoursPageInner />
      </Suspense>
    </ProtectedPage>
  );
}
