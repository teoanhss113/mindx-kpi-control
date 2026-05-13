'use client';

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/lib/AuthContext';
import { loadSession } from '@/services/authService';
import { fetchAllCentres, Centre } from '@/services/centresService';
import { getCache, setCache, clearCache } from '@/lib/idb';
import { getCourseCategory } from '@/lib/courseCategories';
import { getNavItemsWithRouter } from '@/lib/navigation';
import { useAllowedPages } from '@/hooks/useAllowedPages';
import { surveyColor, surveyScore, SURVEY_LEGEND } from '@/lib/kpiScoring';
import { fetchTickets, updateTicket, searchUsers } from '@/services/ticketService';
import { fetchPendingSurveyClasses } from '@/services/classesService';
import { classSurveyKey, fetchStudentClassSurveys, STUDENT_TEACHING_SURVEY_ID } from '@/services/classSurveyService';
import { Ticket, LmsUser, TicketQuestion } from '@/types/ticket';
import { Class } from '@/types/classes';
import {
  Icon, SortIcon, MultiSelect, SelectOption, CompactSelect,
  Toolbar, KPIStatCard, ChartSectionHeader,
  TableToolbar, TableGroupHeader, SubTableGroupHeader, AdminTableSection, Modal, ModalHeader, EmptyState,
  ViewModeToggle,
  initials,
  ToastContainer,
  useToast,
  KPIBarChart, KPIChartCard, getKPILegendItems, getSharedChartLayout,
  SortableHeader, SortableColumn, TopicBadge, UserSearchInput, type UserSearchResult, ModalFooter,
  CentreSelect, CourseCategoryBadge, CentreBadge, QuickFilterChips, TicketStatusBadge, FilterChip, KPIThresholdSuggestions, getPriorityMeta, getTicketStatusMeta, Badge,
  SortableColumnWithCopy,
} from '@/components/ui';
import { useTableSort } from '@/hooks/useTableSort';
import { useFilterOptions } from '@/hooks/useFilterOptions';
import { useQuickFilterChips } from '@/hooks/useUserPreferences';
import { PageLayout } from '@/components/PageLayout';
import { CACHE_KEYS, LABELS, MESSAGES, ENTITIES, FORMAT, CHART_COLORS, TICKET_LABELS, CLASS_INACTIVE_STATUSES, KPI_LABELS } from '@/constants';
import { useSharedDateRange, useSharedCentres } from '@/hooks/useSharedFilterState';
import { ProtectedPage } from '@/components/ProtectedPage';
import styles from '@/app/dashboard.module.css';
import GoogleSheetsSection from '@/components/tickets/GoogleSheetsSection';
import { normalizeString } from '@/lib/googleSheetsMatching';

// ─── Constants ────────────────────────────────────────────────────────────────
const SURVEY_TARGETS = [
  { value: 4.0, label: '4.0' },
  { value: 4.5, label: '4.5' },
  { value: 4.8, label: '> 4.7' },
];

const SURVEY_CHART_LEGEND = getKPILegendItems(SURVEY_LEGEND);

const TICKET_EXEMPTED_REASONS = [
  'CHANGE_CLASS_SCHEDULE_CHANGE',
  'TRANSFER_COURSE_LINE',
  'WRONG_ENROLL',
  'ON_HOLD',
  'DROP_OUT',
  'On hold'
];

function normalizeCompletionReason(reason?: string | null): string {
  const trimmed = reason?.trim();
  if (!trimmed) return '';
  if (trimmed.toUpperCase().replace(/\s+/g, '_') === 'ON_HOLD') return 'ON_HOLD';
  return trimmed;
}

function isExemptStudent(st: any, classSlots?: any[]): boolean {
  const info = st.completionInfo;
  const hasAttendance = classSlots?.some(slot => 
    slot.studentAttendance?.some((a: any) => a.student?.id === st.student?.id)
  );
  
  // Original logic: WAITING status with no attendance
  if (info && (info as any).status === 'WAITING' && !hasAttendance) {
    return true;
  }
  
  // Deactivated student with no attendance
  if (!st.activeInClass && !hasAttendance) {
    return true;
  }

  // Exclude explicitly based on completion reasons (on hold, dropped out, etc)
  if (info?.reason) {
    const normReason = normalizeCompletionReason(info.reason);
    if (TICKET_EXEMPTED_REASONS.includes(normReason)) {
      return true;
    }
  }
  
  return false;
}

function getPriorityColor(priority: string) {
  return getPriorityMeta(priority).color;
}

function getStatusColor(status: string) {
  return getTicketStatusMeta(status).color;
}

function getSurveyBadgeMeta(group: {
  uniqueStudentsDone: number;
  count: number;
  courseCategory?: string;
  surveySessions?: Class['surveySessions'];
}) {
  const sessions = group.surveySessions || [];
  if (sessions.length === 0) {
    if ((group.uniqueStudentsDone || group.count || 0) > 0) {
      return { label: 'Đã mở', color: 'var(--status-success)', bg: 'rgba(16, 185, 129, 0.12)' };
    }
    if (group.courseCategory === 'Robotics') {
      return { label: 'Chưa rõ', color: 'var(--text-quaternary)', bg: 'var(--bg-panel)' };
    }
    return { label: 'Chưa mở', color: 'var(--status-error)', bg: 'rgba(239, 68, 68, 0.10)' };
  }

  const unopened = sessions.filter(session => !session.opened).length;
  if (unopened === sessions.length) {
    return { label: 'Chưa mở', color: 'var(--status-error)', bg: 'rgba(239, 68, 68, 0.10)' };
  }

  return { label: 'Đã mở', color: 'var(--status-success)', bg: 'rgba(16, 185, 129, 0.12)' };
}

export default function TicketsDashboard() {
  const router = useRouter();
  const { logout } = useAuth();
  const { toasts, addToast, removeToast } = useToast();
  const { hasPreferences } = useQuickFilterChips();

  const [session, setSession] = useState<{ displayName?: string, email?: string } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ── Data states ─────────────────────────────────────────────────────────────
  const [centres, setCentres] = useState<Centre[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [pendingClasses, setPendingClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(false);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [progress, setProgress] = useState({ loaded: 0, total: 100 });

  // ── Shared filter state (synced across pages) ──────────────────────────────
  const [fromDate, toDate, setFromDate, setToDate, datesLoaded] = useSharedDateRange();
  const [selectedCentres, setSelectedCentres, centresLoaded] = useSharedCentres();
  
  const [toolbarSelectedCourses, setToolbarSelectedCourses] = useState<string[]>([]); // NEW: Toolbar-level courses
  // Table-level (client): sub-filters on already-loaded data
  const [tableSelectedCentres, setTableSelectedCentres] = useState<string[]>([]);
  const [selectedCourseLines, setSelectedCourseLines] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedFeedbackTopics, setSelectedFeedbackTopics] = useState<string[]>([]);
  const [selectedSessions, setSelectedSessions] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [classCodeSearch, setClassCodeSearch] = useState('');
  
  // Storage for post-processed Google Sheet data pulled UP from the child component!
  const [sheetProcessedRows, setSheetProcessedRows] = useState<any[]>([]);
  const [googleSheetsRawData, setGoogleSheetsRawData] = useState<any[]>([]);

  // ── Layout states ──────────────────────────────────────────────────────────
  const [showActiveTable, setShowActiveTable] = useState(true);
  const [showLmsList, setShowLmsList] = useState(true);
  const [quickFilter, setQuickFilter] = useState<string | null>(null);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  const [sortKey, setSortKey] = useState<'title' | 'centre' | 'status' | 'createdAt'>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // ── View Mode: 'list' | 'by-class' | 'by-teacher' | 'pending' ──
  const [viewMode, setViewMode] = useState<'list' | 'by-class' | 'by-teacher' | 'pending'>('by-class');
  
  // Sort state for by-class view
  const [classSortBy, setClassSortBy] = useState<'className' | 'sessions' | 'students' | 'count' | 'avgScore' | 'surveyStatus' | 'ticketStatus'>('avgScore');
  const [classSortOrder, setClassSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // ── Modal states for grouped views ──
  const [selectedClassForModal, setSelectedClassForModal] = useState<{ className: string; tickets: typeof filteredTickets; classData?: any | null } | null>(null);
  
  // Single state to view detail popup for Google Sheet rows
  const [viewingSheetRow, setViewingSheetRow] = useState<any | null>(null);
  
  // Section expansion states
  const [standardExpanded, setStandardExpanded] = useState(true);
  const [earlyLateExpanded, setEarlyLateExpanded] = useState(true);
  const [inactiveExpanded, setInactiveExpanded] = useState(true);

  // ── Edit / Save states ──────────────────────────────────────────────────
  const [editDraft, setEditDraft] = useState<{ status: string; priority: string; feedbackTopic: string; assigneeId: string; assigneeName: string } | null>(null);
  const [savingTicket, setSavingTicket] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [userResults, setUserResults] = useState<LmsUser[]>([]);
  const [userSearchLoading, setUserSearchLoading] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const userSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Bulk Select states ──────────────────────────────────────────────────
  const [selectedTicketIds, setSelectedTicketIds] = useState<Set<string>>(new Set());
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkUpdates, setBulkUpdates] = useState({
    status: '',
    priority: '',
    feedbackTopic: '',
    assigneeId: '',
    assigneeName: ''
  });
  const [bulkAssigneeSearch, setBulkAssigneeSearch] = useState('');
  const [bulkAssigneeResults, setBulkAssigneeResults] = useState<LmsUser[]>([]);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [showBulkAssigneeDropdown, setShowBulkAssigneeDropdown] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  // ── Data Fetching ───────────────────────────────────────────────────────────
  const loadData = useCallback(async (start: string, end: string) => {
    if (!start || !end) {
      addToast(MESSAGES.ERROR.DATE_RANGE_REQUIRED, 'error');
      return;
    }
    const fDate = new Date(start), tDate = new Date(end);
    if (fDate > tDate) {
      addToast(MESSAGES.ERROR.DATE_RANGE_INVALID, 'error');
      return;
    }

    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;

    setLoading(true);
    setPendingLoading(true);
    setProgress({ loaded: 0, total: 100 });
    setTickets([]);
    setPendingClasses([]);
    
    let curTickets: Ticket[] = [];
    let _centres = centres;

    const tid = addToast(MESSAGES.LOADING.CONNECTING, 'loading');

    try {
      if (_centres.length === 0) {
        const cachedCentres = await getCache(CACHE_KEYS.CENTRES);
        if (cachedCentres?.centres) _centres = cachedCentres.centres;
        else _centres = await fetchAllCentres();
        setCentres(_centres);
        await setCache(CACHE_KEYS.CENTRES, { centres: _centres });
      }
      
      const dStart = new Date(start); dStart.setHours(0, 0, 0, 0);
      const dEnd = new Date(end); dEnd.setHours(23, 59, 59, 999);

      // Construct google sheet URL based on current filter parameters
      let sheetUrl = `/api/google-sheets?_t=${Date.now()}`; 
      if (start) sheetUrl += `&fromDate=${encodeURIComponent(start)}`;
      if (end) sheetUrl += `&toDate=${encodeURIComponent(end)}`;
      if (selectedCentres.length > 0 && _centres.length > 0) {
        const shortCodes = selectedCentres
          .map(id => _centres.find(c => c.id === id)?.shortName)
          .filter(Boolean);
        if (shortCodes.length > 0) {
          sheetUrl += `&center=${encodeURIComponent(shortCodes.join(','))}`;
        }
      }

      let tLoaded = 0, tTotal = 0, cLoaded = 0, cTotal = 0;
      const refreshProgress = () => {
        const finalLoaded = tLoaded + cLoaded;
        const finalTotal = Math.max((tTotal || 0) + (cTotal || 0), 1);
        setProgress({ loaded: finalLoaded, total: finalTotal });
      };

      // Fetch tickets, pending classes, and Google Sheets data in parallel
      const [ticketsRes, pendingRes, sheetsRes] = await Promise.all([
        fetchTickets({
          createdAt_gte: dStart.toISOString(),
          createdAt_lte: dEnd.toISOString(),
          centreId_in: selectedCentres.length > 0 ? selectedCentres : [],
          ...(classCodeSearch.trim() ? { search: classCodeSearch.trim() } : {}),
        }, (loaded, total, chunk) => {
          tLoaded = loaded;
          tTotal = total || 0;
          refreshProgress();
          
          curTickets = [...curTickets, ...chunk];
          setTickets([...curTickets]);
        }, signal),
        fetchPendingSurveyClasses(
          dStart,
          dEnd,
          selectedCentres,
          (loaded, total) => {
            cLoaded = loaded;
            cTotal = total || 0;
            refreshProgress();
          },
          signal
        ).then(res => {
           addToast('Đã nạp cấu trúc lớp học!', 'success');
           return res;
        }),
        fetch(sheetUrl, { signal }).then(r => r.json()).catch(err => {
          console.error('Sheet fetch error:', err);
          return { data: [] };
        })
      ]);

      const surveyLookups = pendingRes.flatMap(c => {
        const slots = c.slots || [];
        return [3, 7].flatMap(slotIndex => {
          const slot = slots[slotIndex];
          if (!slot?._id) return [];
          const slotDate = new Date(slot.date);
          if (slotDate < dStart || slotDate > dEnd) return [];
          return [{
            classId: c.id,
            sessionId: slot._id,
            sessionNumber: slotIndex + 1,
            surveyId: STUDENT_TEACHING_SURVEY_ID,
          }];
        });
      });

      let enrichedPending = pendingRes;
      if (surveyLookups.length > 0) {
        try {
          addToast(`Bắt đầu đối soát khảo sát (${surveyLookups.length} lớp)...`, 'info');
          const surveyMap = await fetchStudentClassSurveys(surveyLookups, signal);
          enrichedPending = pendingRes.map(c => {
            const surveySessions = (c.slots || []).flatMap((slot, slotIndex) => {
              if (![3, 7].includes(slotIndex) || !slot?._id) return [];
              const slotDate = new Date(slot.date);
              if (slotDate < dStart || slotDate > dEnd) return [];
              const status = surveyMap.get(classSurveyKey(c.id, slot._id));
              return status ? [{
                sessionNumber: slotIndex + 1,
                sessionId: slot._id,
                classSurveyId: status.classSurveyId,
                surveyId: status.surveyId || STUDENT_TEACHING_SURVEY_ID,
                status: status.status,
                responseCount: status.responseCount,
                opened: status.opened,
              }] : [];
            });
            return { ...c, surveySessions };
          });
        } catch (surveyErr) {
          if (!signal.aborted) {
            console.error('Failed to fetch class survey status', surveyErr);
            addToast('Không tải được trạng thái mở form khảo sát. Dữ liệu phiếu vẫn được giữ lại.', 'info');
          }
        }
      }

      if (!signal.aborted) {
        const rawSheetData = sheetsRes?.data || [];
        setTickets(ticketsRes.data);
        setPendingClasses(enrichedPending);
        setGoogleSheetsRawData(rawSheetData);
        
        await setCache(CACHE_KEYS.TICKETS, { 
          tickets: ticketsRes.data, 
          pendingClasses: enrichedPending, 
          googleSheetsRawData: rawSheetData,
          timestamp: Date.now() 
        });
        removeToast(tid);
        addToast(MESSAGES.LOADING.SUCCESS(ticketsRes.data.length, ENTITIES.TICKETS), 'success');
      }
    } catch (err: any) {
      if (!signal.aborted) {
        removeToast(tid);
        if (err.message === 'Aborted' || err.name === 'AbortError') {
          addToast(MESSAGES.LOADING.STOPPED, 'info');
        } else {
          console.error(err);
          addToast(MESSAGES.ERROR.GENERIC, 'error');
        }
      }
    } finally {
      if (!signal.aborted) {
        setLoading(false);
        setPendingLoading(false);
        setProgress({ loaded: 100, total: 100 });
      }
    }
  }, [centres, addToast, selectedCentres]);

  const handleCancelFetch = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
      setLoading(false);
      addToast(MESSAGES.LOADING.STOPPED, 'info');
    }
  };

  // ── Edit Ticket handlers ──────────────────────────────────────────────
  const openEditForTicket = useCallback((t: Ticket) => {
    setEditDraft({
      status: t.status || '',
      priority: t.priority || '',
      feedbackTopic: t.feedbackTopic || '',
      assigneeId: t.assignee?.id || '',
      assigneeName: (t.assignee as any)?.displayName || t.assignee?.username || '',
    });
    
    // Clear search state
    setUserSearch('');
    setShowUserDropdown(false);
    
    // If there's a current assignee, add them to results for immediate display
    if (t.assignee?.id && ((t.assignee as any)?.displayName || t.assignee?.username)) {
      const currentUser = {
        id: t.assignee.id,
        displayName: (t.assignee as any)?.displayName || t.assignee?.username || '',
        username: t.assignee?.username || '',
        email: (t.assignee as any)?.email || '',
        centres: (t.assignee as any)?.centres || []
      };
      setUserResults([currentUser]);
    } else {
      setUserResults([]);
    }
  }, []);

  const handleSaveTicket = useCallback(async (ticketId: string) => {
    if (!editDraft) return;
    setSavingTicket(true);
    try {
      const updated = await updateTicket({
        id: ticketId,
        status: editDraft.status,
        priority: editDraft.priority,
        feedbackTopic: editDraft.feedbackTopic,
        asigneeId: editDraft.assigneeId || undefined,
        attachments: [],
      });
      // Patch tickets list in-place
      setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, ...updated } : t));
      addToast(MESSAGES.LOADING.SUCCESS(1, ENTITIES.TICKETS), 'success');
    } catch (err: any) {
      addToast(MESSAGES.ERROR.GENERIC, 'error');
    } finally {
      setSavingTicket(false);
    }
  }, [editDraft, addToast]);

  // Separate function for immediate UI update (no delay)
  const handleAssigneeInputChange = useCallback((value: string) => {
    setUserSearch(value);
    if (value.length >= 2) {
      setShowUserDropdown(true);
    }
  }, []);
  
  // Debounced search function
  const debouncedAssigneeSearch = useCallback((q: string) => {
    // Clear previous timer
    if (userSearchTimerRef.current) clearTimeout(userSearchTimerRef.current);
    
    // If clearing search and we have a selected assignee, don't clear results
    if (q.length < 2) { 
      if (!editDraft?.assigneeId) {
        setUserResults([]);
      }
      setUserSearchLoading(false);
      return; 
    }
    
    // Debounced search with 300ms delay
    userSearchTimerRef.current = setTimeout(async () => {
      setUserSearchLoading(true);
      try {
        const res = await searchUsers(q);
        setUserResults(res.data);
      } catch (error) {
        console.error('User search error:', error);
        setUserResults([]);
      } finally { 
        setUserSearchLoading(false); 
      }
    }, 300);
  }, [editDraft?.assigneeId]);
  
  // Effect to trigger search when userSearch changes
  useEffect(() => {
    debouncedAssigneeSearch(userSearch);
  }, [userSearch, debouncedAssigneeSearch]);

  // ── Bulk Action handlers ──────────────────────────────────────────────
  const handleToggleTicket = useCallback((ticketId: string) => {
    setSelectedTicketIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(ticketId)) {
        newSet.delete(ticketId);
      } else {
        newSet.add(ticketId);
      }
      return newSet;
    });
  }, []);

  const handleOpenBulkModal = useCallback(() => {
    setBulkUpdates({
      status: '',
      priority: '',
      feedbackTopic: '',
      assigneeId: '',
      assigneeName: ''
    });
    setBulkAssigneeSearch('');
    setBulkAssigneeResults([]);
    setShowBulkModal(true);
  }, []);

  // Bulk assignee search - separate immediate UI update from debounced search
  const bulkAssigneeSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const handleBulkAssigneeInputChange = useCallback((value: string) => {
    setBulkAssigneeSearch(value);
    if (value.length >= 2) {
      setShowBulkAssigneeDropdown(true);
    }
  }, []);
  
  const debouncedBulkAssigneeSearch = useCallback((q: string) => {
    // Clear previous timer
    if (bulkAssigneeSearchTimerRef.current) clearTimeout(bulkAssigneeSearchTimerRef.current);
    
    if (q.length < 2) { 
      setBulkAssigneeResults([]);
      return; 
    }
    
    // Debounced search with 300ms delay
    bulkAssigneeSearchTimerRef.current = setTimeout(async () => {
      try {
        const res = await searchUsers(q);
        setBulkAssigneeResults(res.data);
      } catch { 
        setBulkAssigneeResults([]); 
      }
    }, 300);
  }, []);
  
  // Effect to trigger bulk search when bulkAssigneeSearch changes
  useEffect(() => {
    debouncedBulkAssigneeSearch(bulkAssigneeSearch);
  }, [bulkAssigneeSearch, debouncedBulkAssigneeSearch]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (userSearchTimerRef.current) {
        clearTimeout(userSearchTimerRef.current);
      }
      if (bulkAssigneeSearchTimerRef.current) {
        clearTimeout(bulkAssigneeSearchTimerRef.current);
      }
    };
  }, []);

  const handleApplyBulkUpdates = useCallback(async () => {
    if (selectedTicketIds.size === 0) return;
    
    // Check if at least one field is filled
    const hasUpdates = bulkUpdates.status || bulkUpdates.priority || bulkUpdates.feedbackTopic || bulkUpdates.assigneeId;
    if (!hasUpdates) {
      addToast('Vui lòng chọn ít nhất một trường để cập nhật', 'info');
      return;
    }
    
    setBulkSaving(true);
    try {
      const updates: any = { attachments: [] };
      if (bulkUpdates.status) updates.status = bulkUpdates.status;
      if (bulkUpdates.priority) updates.priority = bulkUpdates.priority;
      if (bulkUpdates.feedbackTopic) updates.feedbackTopic = bulkUpdates.feedbackTopic;
      if (bulkUpdates.assigneeId) updates.asigneeId = bulkUpdates.assigneeId;

      // Update all selected tickets
      const promises = Array.from(selectedTicketIds).map(id =>
        updateTicket({ id, ...updates })
      );
      
      await Promise.all(promises);

      // Update local state
      setTickets(prev => prev.map(t => {
        if (selectedTicketIds.has(t.id)) {
          const updated: any = { ...t };
          if (bulkUpdates.status) updated.status = bulkUpdates.status;
          if (bulkUpdates.priority) updated.priority = bulkUpdates.priority;
          if (bulkUpdates.feedbackTopic) updated.feedbackTopic = bulkUpdates.feedbackTopic;
          if (bulkUpdates.assigneeId) {
            updated.assignee = {
              id: bulkUpdates.assigneeId,
              username: bulkUpdates.assigneeName,
              displayName: bulkUpdates.assigneeName
            };
          }
          return updated;
        }
        return t;
      }));

      addToast(MESSAGES.SUCCESS.UPDATED(`${selectedTicketIds.size} phiếu`), 'success');
      setSelectedTicketIds(new Set());
      setShowBulkModal(false);
    } catch (err) {
      addToast(MESSAGES.ERROR.GENERIC, 'error');
    } finally {
      setBulkSaving(false);
    }
  }, [bulkUpdates, selectedTicketIds, addToast]);

  // Handle Hydration + Auto-fetch
  useEffect(() => {
    const s = loadSession();
    if (!s) return;
    setSession(s);

    (async () => {
      try {
        // Load centres first so the Toolbar filter is populated immediately
        const cachedCentres = await getCache(CACHE_KEYS.CENTRES);
        if (cachedCentres?.centres?.length) {
          setCentres(cachedCentres.centres);
        } else {
          const freshCentres = await fetchAllCentres();
          setCentres(freshCentres);
          await setCache(CACHE_KEYS.CENTRES, { centres: freshCentres });
        }

        // Restore ticket data from cache (filter state is handled by useSharedFilterState)
        const cached = await getCache(CACHE_KEYS.TICKETS);
        if (cached?.tickets) {
          setTickets(cached.tickets);
        }
        if (cached?.pendingClasses) {
          setPendingClasses(cached.pendingClasses);
        }
        if (cached?.googleSheetsRawData) {
          setGoogleSheetsRawData(cached.googleSheetsRawData);
        }
      } catch (e) {
        console.error('State parse error', e);
      }
    })();
  }, []);

  // Persist layout state (for simple layout states like selected categories)
  useEffect(() => {
    localStorage.setItem(CACHE_KEYS.TICKETS, JSON.stringify({
      selectedCourseLines, selectedStatuses
    }));
  }, [selectedCourseLines, selectedStatuses]);

  // ── Derived Data & Options ───────────────────────────────────────────────────
  // Memoize expensive ticket processing with individual ticket caching
  const mappedTickets = useMemo(() => {
    const processTicket = (t: Ticket) => {
      // Try to find matching class in pendingClasses for more accurate categorization
      const matchingClass = pendingClasses.find(pc => pc.id === t.ticketSource?.classId);
      const courseCategory = matchingClass 
        ? getCourseCategory(matchingClass) 
        : getCourseCategory({ name: t.ticketSource?.className || '' });
      
      let dateStr = '—';
      if (t.createdAt) {
        let timestamp = Number(t.createdAt);
        if (isNaN(timestamp)) {
          const d = new Date(t.createdAt);
          if (!isNaN(d.getTime())) dateStr = d.toLocaleDateString('vi-VN');
        } else {
          if (timestamp < 10000000000) timestamp *= 1000;
          dateStr = new Date(timestamp).toLocaleDateString('vi-VN');
        }
      }

      // Only compute scores if ticket has answers (avoid unnecessary work)
      let totalValue = 0;
      let numericCount = 0;
      const groupScores: Record<string, { total: number; count: number }> = {};
      
      if (t.ticketSource?.answers?.length) {
        t.ticketSource.answers.forEach(ans => {
          const question = t.ticketSource?.questions?.find(q => q.id === ans.questionId);
          if (!question) return;

          const val = parseFloat(ans.value);
          if (!isNaN(val) && val > 0 && val <= 5) {
            totalValue += val;
            numericCount++;

            const g = question.group || 'Khác';
            if (!groupScores[g]) groupScores[g] = { total: 0, count: 0 };
            groupScores[g].total += val;
            groupScores[g].count++;
          }
        });
      }
      
      const avgScore = numericCount > 0 ? (totalValue / numericCount).toFixed(1) : null;
      const parsedGroupScores = Object.entries(groupScores).map(([group, data]) => ({
        group,
        avg: (data.total / data.count).toFixed(1)
      }));

      return { ...t, courseCategory, _safeDate: dateStr, _avgScore: avgScore, _groupScores: parsedGroupScores };
    };

    const base = tickets.map(processTicket);
    
    // Map Google Sheets data into standard simulated Ticket shapes for seamless integration into Stats and Charts!
    const sheetMapped = sheetProcessedRows.map((row, idx) => {
      const cls = row.matchedClass;
      
      // Derive course category natively using canonical system utilities to ensure filter alignment
      const courseCategory = cls 
        ? getCourseCategory(cls) 
        : getCourseCategory({ name: row.normalizedClassCode || '' });

      // Standardize centre resolution and reverse ID linkage
      let centreShort = 'Không rõ';
      let centreId = '';
      if (cls?.centre) {
        centreShort = cls.centre.shortName;
        centreId = cls.centre.id;
      } else {
        const segs = row.normalizedClassCode?.split('-') || [];
        centreShort = segs[0] || 'Không rõ';
        const match = centres.find(c => c.shortName === centreShort);
        if (match) centreId = match.id;
      }

      // Inject teacher score with precise compatible keys recognized by down-stream hooks
      const parsedGroupScores = row.avgScore != null
        ? [{ group: 'GIÁO VIÊN', avg: row.avgScore.toFixed(1) }]
        : [];

      return {
        id: `sheet-row-${idx}-${row.timestamp}`,
        status: 'CLOSED', // Sheets are treated as resolved submittals
        feedbackTopic: 'TEACHER', // Defaults to Teaching surveys
        priority: 'LOW',
        courseCategory,
        _isGoogleSheet: true,
        _safeDate: row.timestamp ? new Date(row.timestamp).toLocaleDateString('vi-VN') : '—',
        _avgScore: row.avgScore != null ? row.avgScore.toFixed(1) : null,
        _groupScores: parsedGroupScores,
        ticketSource: {
          centre: { shortName: centreShort, id: centreId },
          centreId,
          className: cls?.name || row.normalizedClassCode,
          studentName: row.studentName,
        }
      } as any;
    });

    return [...base, ...sheetMapped];
  }, [tickets, pendingClasses, sheetProcessedRows, centres]);

  const courseLineOptions = useMemo(() => {
    const cats = new Set<string>();
    mappedTickets.forEach(t => cats.add(t.courseCategory));
    pendingClasses.forEach(c => cats.add(getCourseCategory(c)));
    return Array.from(cats).sort().map(cat => ({ value: cat, label: cat }));
  }, [mappedTickets, pendingClasses]);

  // tableCentreIds: only centre IDs that appear in the loaded tickets (for table-level filtering)
  const tableCentreIds = useMemo(() => {
    const ids = new Set<string>();
    mappedTickets.forEach(t => {
      if (t.ticketSource?.centreId) ids.add(t.ticketSource.centreId);
    });
    return Array.from(ids);
  }, [mappedTickets, pendingClasses]);

  const statusOptions = useFilterOptions(
    mappedTickets,
    (t) => t.status,
    { seedValues: ['NEW', 'ASSIGNED', 'IN_PROCESS', 'COMPLAIN', 'RESOLVED', 'CLOSED'] }
  );

  const priorityEnumOptions = useFilterOptions(
    mappedTickets,
    (t) => t.priority,
    { seedValues: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] }
  );

  const feedbackTopicEnumOptions = useFilterOptions(
    mappedTickets,
    (t) => t.feedbackTopic,
    { seedValues: ['TEACHER', 'DOCUMENT', 'EQUIPMENT', 'OPERATION', 'OTHER'] }
  );

  // ── Pre-filter computations (KPIs ignore text search) ─────────────────────
  const baseFilteredTickets = useMemo(() => {
    return mappedTickets.filter(t => {
      // tableSelectedCentres filters client-side within loaded data (NOT the same as request-level selectedCentres)
      if (tableSelectedCentres.length > 0 && tableSelectedCentres.length !== tableCentreIds.length && !tableSelectedCentres.includes(t.ticketSource?.centreId || '')) return false;
      if (selectedCourseLines.length > 0 && selectedCourseLines.length !== courseLineOptions.length && !selectedCourseLines.includes(t.courseCategory)) return false;
      if (selectedStatuses.length > 0 && selectedStatuses.length !== statusOptions.length && !selectedStatuses.includes(t.status || '')) return false;
      if (selectedFeedbackTopics.length > 0 && selectedFeedbackTopics.length !== feedbackTopicEnumOptions.length && !selectedFeedbackTopics.includes(t.feedbackTopic || '')) return false;
      return true;
    });
  }, [mappedTickets, tableSelectedCentres, selectedCourseLines, selectedStatuses, selectedFeedbackTopics]);

  const stats = useMemo(() => {
    let newTickets = 0;
    let closedTickets = 0;
    let inProgressTickets = 0;
    
    let totalScore = 0;
    let scoredTicketsCount = 0;

    baseFilteredTickets.forEach(t => {
      const s = (t.status || '').toUpperCase();
      if (s === 'NEW' || s === 'OPEN') newTickets++;
      else if (s === 'CLOSED' || s === 'RESOLVED') closedTickets++;
      else inProgressTickets++;
      
      const teacherScoreObj = (t as any)._groupScores?.find((gs: any) => {
        const gName = gs.group.toUpperCase();
        return gName.includes('TEACHER') || gName.includes('GIÁO VIÊN') || gName === 'GV';
      });
      if (teacherScoreObj) {
        totalScore += parseFloat(teacherScoreObj.avg);
        scoredTicketsCount++;
      }
    });

    const avgDisplayScore = scoredTicketsCount > 0 ? parseFloat((totalScore / scoredTicketsCount).toFixed(1)) : 0;

    return {
      total: baseFilteredTickets.length,
      newTickets,
      closedTickets,
      inProgressTickets,
      resolveRate: baseFilteredTickets.length > 0 ? (closedTickets / baseFilteredTickets.length) * 100 : 0,
      avgScore: avgDisplayScore,
      scoredTickets: scoredTicketsCount,
      totalScore,
    };
  }, [baseFilteredTickets]);

  const surveySuggestions = useMemo(() => {
    if (stats.scoredTickets === 0) {
      return [{
        key: 'survey-data',
        target: '4.5',
        content: 'cần thêm phiếu đánh giá giáo viên để tính mốc',
      }];
    }

    return SURVEY_TARGETS.map(({ value, label }) => {
      const reached = stats.avgScore >= value;
      const needed = reached
        ? 0
        : Math.max(1, Math.ceil(((value * stats.scoredTickets) - stats.totalScore) / (5 - value)));

      return {
        key: label,
        target: label,
        done: reached,
        content: reached
          ? <><Icon.Check size={11} /> Đã đạt</>
          : <>cần thêm <strong>{needed}</strong> phiếu 5★</>,
      };
    });
  }, [stats]);

  // Chart data: By Centre
  const centreChartData = useMemo(() => {
    const map = new Map<string, { count: number; totalScore: number; scoredCount: number }>();
    
    baseFilteredTickets.forEach(t => {
      const centreName = t.ticketSource?.centre?.shortName || 'Không rõ';
      if (!map.has(centreName)) {
        map.set(centreName, { count: 0, totalScore: 0, scoredCount: 0 });
      }
      const entry = map.get(centreName)!;
      entry.count++;
      
      const teacherScoreObj = (t as any)._groupScores?.find((gs: any) => {
        const gName = gs.group.toUpperCase();
        return gName.includes('TEACHER') || gName.includes('GIÁO VIÊN') || gName === 'GV';
      });
      if (teacherScoreObj) {
        entry.totalScore += parseFloat(teacherScoreObj.avg);
        entry.scoredCount++;
      }
    });

    return Array.from(map.entries())
      .map(([name, data]) => ({
        name,
        'Số phiếu': data.count,
        'Điểm TB (GV)': data.scoredCount > 0 ? parseFloat((data.totalScore / data.scoredCount).toFixed(1)) : 0,
        _scoredCount: data.scoredCount
      }))
      .filter(d => d['Số phiếu'] > 0)
      .sort((a, b) => b['Số phiếu'] - a['Số phiếu'])
      .slice(0, 10);
  }, [baseFilteredTickets]);

  // Chart data: By Course Category
  const courseLineChartData = useMemo(() => {
    const map = new Map<string, { count: number; totalScore: number; scoredCount: number }>();
    
    baseFilteredTickets.forEach(t => {
      const category = t.courseCategory;
      if (!map.has(category)) {
        map.set(category, { count: 0, totalScore: 0, scoredCount: 0 });
      }
      const entry = map.get(category)!;
      entry.count++;
      
      const teacherScoreObj = (t as any)._groupScores?.find((gs: any) => {
        const gName = gs.group.toUpperCase();
        return gName.includes('TEACHER') || gName.includes('GIÁO VIÊN') || gName === 'GV';
      });
      if (teacherScoreObj) {
        entry.totalScore += parseFloat(teacherScoreObj.avg);
        entry.scoredCount++;
      }
    });

    return Array.from(map.entries())
      .map(([name, data]) => ({
        name,
        'Số phiếu': data.count,
        'Điểm TB (GV)': data.scoredCount > 0 ? parseFloat((data.totalScore / data.scoredCount).toFixed(1)) : 0,
        _scoredCount: data.scoredCount
      }))
      .filter(d => d['Số phiếu'] > 0)
      .sort((a, b) => b['Số phiếu'] - a['Số phiếu']);
  }, [baseFilteredTickets]);

  // ── Table filtering & Sorting ───────────────────────────────────────────────
  const filteredTickets = useMemo(() => {
    let list = baseFilteredTickets.filter(t => !(t as any)._isGoogleSheet);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(t => 
        (t.ticketCode?.toLowerCase().includes(q)) ||
        (t.ticketSource?.className?.toLowerCase().includes(q)) ||
        (t.ticketSource?.studentName?.toLowerCase().includes(q)) ||
        (t.title?.toLowerCase().includes(q))
      );
    }
    if (quickFilter === 'low_score') {
      list = list.filter(t => (t as any)._groupScores?.some((g: any) => {
         const gName = g.group.toUpperCase();
         return (gName.includes('TEACHER') || gName.includes('GIÁO VIÊN') || gName === 'GV') && parseFloat(g.avg) <= 3;
      }));
    }
    return list.sort((a, b) => {
      let va: any = '', vb: any = '';
      if (sortKey === 'title') { va = a.title || ''; vb = b.title || ''; }
      else if (sortKey === 'centre') { va = a.ticketSource?.centre?.shortName || ''; vb = b.ticketSource?.centre?.shortName || ''; }
      else if (sortKey === 'status') { va = a.status || ''; vb = b.status || ''; }
      else if (sortKey === 'createdAt') { va = a.createdAt || 0; vb = b.createdAt || 0; }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [baseFilteredTickets, search, sortKey, sortDir, quickFilter]);

  const lowScoreCount = useMemo(() => {
    return baseFilteredTickets.filter(t => (t as any)._groupScores?.some((g: any) => {
      const gName = g.group.toUpperCase();
      return (gName.includes('TEACHER') || gName.includes('GIÁO VIÊN') || gName === 'GV') && parseFloat(g.avg) <= 3;
    })).length;
  }, [baseFilteredTickets]);
  const handleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const handleClassSort = (key: typeof classSortBy) => {
    if (classSortBy === key) {
      setClassSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setClassSortBy(key);
      setClassSortOrder('desc');
    }
  };

  const hasTableFilter = tableSelectedCentres.length > 0 || selectedCourseLines.length > 0 || selectedStatuses.length > 0 || selectedFeedbackTopics.length > 0 || search.trim().length > 0 || !!quickFilter;
  const clearTableFilters = () => {
    setTableSelectedCentres([]); setSelectedCourseLines([]); setSelectedStatuses([]); setSelectedFeedbackTopics([]); setSearch(''); setQuickFilter(null);
  };

  // handleToggleAll - must be after filteredTickets is defined
  const handleToggleAll = useCallback(() => {
    if (selectedTicketIds.size === filteredTickets.length) {
      setSelectedTicketIds(new Set());
    } else {
      setSelectedTicketIds(new Set(filteredTickets.map(t => t.id)));
    }
  }, [filteredTickets, selectedTicketIds.size]);

  // ── Grouped Data ──────────────────────────────────────────────────────────
  const sessionOptions = [
    { value: '4', label: 'Buổi 4' },
    { value: '8', label: 'Buổi 8' },
    { value: 'other', label: 'Khác (Sớm/Muộn)' },
  ];

  const filteredPendingClasses = useMemo(() => {
    let list = pendingClasses;

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.course?.name?.toLowerCase().includes(q) ||
        c.centre?.shortName?.toLowerCase().includes(q)
      );
    }

    if (tableSelectedCentres.length > 0) {
      list = list.filter(c => tableSelectedCentres.includes(c.centre?.id));
    }

    if (selectedCourseLines.length > 0 && selectedCourseLines.length !== courseLineOptions.length) {
      list = list.filter(c => selectedCourseLines.includes(getCourseCategory(c)));
    }

    if (selectedSessions.length > 0 && selectedSessions.length !== sessionOptions.length) {
      const dStart = new Date(fromDate); dStart.setHours(0, 0, 0, 0);
      const dEnd = new Date(toDate); dEnd.setHours(23, 59, 59, 999);
      list = list.filter(c => {
        const slots = c.slots || [];
        const hasSession4 = Boolean(slots[3] && new Date(slots[3].date) >= dStart && new Date(slots[3].date) <= dEnd);
        const hasSession8 = Boolean(slots[7] && new Date(slots[7].date) >= dStart && new Date(slots[7].date) <= dEnd);
        return (
          (selectedSessions.includes('4') && hasSession4) ||
          (selectedSessions.includes('8') && hasSession8)
        );
      });
    }

    return list;
  }, [pendingClasses, search, tableSelectedCentres, selectedCourseLines, courseLineOptions.length, selectedSessions, fromDate, toDate]);

  const groupedByClass = useMemo(() => {
    // We use a Map to merge tickets and class data. 
    // Key is either classId (best) or className (fallback).
    const groups = new Map<string, { 
      className: string; 
      tickets: Ticket[]; 
      classData?: Class;
      sessionsInRange: number[];
    }>();

    // 1. Process tickets
    filteredTickets.forEach(t => {
      const classId = t.ticketSource?.classId;
      const className = t.ticketSource?.className || 'Không xác định';
      const key = classId || className;
      
      if (!groups.has(key)) {
        groups.set(key, { className, tickets: [], sessionsInRange: [] });
      }
      groups.get(key)!.tickets.push(t);
    });


    // 2. Process pending classes (to get total students and session context)
    let filteredPending = pendingClasses;
    if (search.trim()) {
      const q = search.toLowerCase();
      filteredPending = filteredPending.filter(c => 
        c.name.toLowerCase().includes(q) || 
        c.course?.name?.toLowerCase().includes(q) ||
        c.centre?.shortName?.toLowerCase().includes(q)
      );
    }
    if (tableSelectedCentres.length > 0 && tableSelectedCentres.length !== tableCentreIds.length) {
      filteredPending = filteredPending.filter(c => tableSelectedCentres.includes(c.centre?.id));
    }
    if (selectedCourseLines.length > 0 && selectedCourseLines.length !== courseLineOptions.length) {
      filteredPending = filteredPending.filter(c => selectedCourseLines.includes(getCourseCategory(c)));
    }

    filteredPending.forEach(c => {
      const key = c.id;
      const category = getCourseCategory(c);
      
      // Exclude 'Others' (Trial/Experience) classes from being added as "Pending" 
      // unless they already have tickets associated with them.
      if (category === 'Others' && !groups.has(key)) return;

      if (!groups.has(key)) {
        // Find if we already have a group by name (if classId wasn't in ticketSource)
        const nameKey = Array.from(groups.keys()).find(k => groups.get(k)!.className === c.name);
        if (nameKey) {
          const existing = groups.get(nameKey)!;
          groups.delete(nameKey);
          groups.set(key, existing);
        } else {
          groups.set(key, { className: c.name, tickets: [], sessionsInRange: [] });
        }
      }
      
      const g = groups.get(key)!;
      g.classData = c;
      
      // Determine sessions in range
      const dStart = new Date(fromDate); dStart.setHours(0,0,0,0);
      const dEnd = new Date(toDate); dEnd.setHours(23,59,59,999);
      
      const slots = c.slots || [];
      // Session 4 is index 3, Session 8 is index 7
      [3, 7].forEach(idx => {
        const slot = slots[idx];
        if (slot) {
          const sDate = new Date(slot.date);
          if (sDate >= dStart && sDate <= dEnd) {
            g.sessionsInRange.push(idx + 1);
          }
        }
      });
    });

    // 1.5 Process Google Sheets data AFTER class data has built official rosters
    sheetProcessedRows.forEach(row => {
       const classId = row.matchedClass?.id;
       const className = row.matchedClass?.className || row.matchedClass?.name || row.normalizedClassCode;
       const key = classId || className;
       
       if (!groups.has(key)) {
         groups.set(key, { className, tickets: [], sessionsInRange: [] });
       }
       const g = groups.get(key)!;
       
       // Master Identity Linkage: Search group's official roster to discover legitimate LMS ID!
       // Allows Google Sheet rows to automatically fuse with existing LMS student profiles instantly.
       let resolvedStudentId = `st-sheet-${row.studentName}`;
       const targetNameKey = normalizeString(row.studentName).replace(/\s+/g, '');
       
       if (targetNameKey && g.classData?.students) {
          const matchedRosterStudent = g.classData.students.find((st: any) => {
             const lmsNameKey = normalizeString(st.student?.fullName || '').replace(/\s+/g, '');
             return lmsNameKey === targetNameKey; // Semantic absolute overlap match
          });
          
          if (matchedRosterStudent?.student?.id) {
             resolvedStudentId = matchedRosterStudent.student.id; // BINGO! Official connection forged.
          }
       }

       const syntheticTicket = {
          id: `sheet-${row.timestamp}-${row.studentName}`,
          _isGoogleSheet: true,
          _sheetAvgScore: row.avgScore,
          _safeDate: row.timestamp,
          _originalRow: row.row, // Raw key-value pairs
          _fullRecord: row, // Includes normalization metadata
          status: 'CLOSED',
          ticketSource: {
             classId,
             className,
             studentName: row.studentName,
             studentId: resolvedStudentId,
          }
       } as any;
       
       g.tickets.push(syntheticTicket);
    });

    const result = Array.from(groups.entries())
      .map(([id, g]) => {
        const tickets = g.tickets;
        const avgScores = tickets.map(t => {
          // If synthetic sheet item, pull injected direct score
          if ((t as any)._isGoogleSheet) return (t as any)._sheetAvgScore;

          const teacherScore = (t as any)._groupScores?.find((gs: any) => {
            const gName = gs.group.toUpperCase();
            return gName.includes('TEACHER') || gName.includes('GIÁO VIÊN') || gName === 'GV';
          });
          return teacherScore ? parseFloat(teacherScore.avg) : null;
        }).filter(s => s !== null) as number[];
        
        const avgScore = avgScores.length > 0 ? avgScores.reduce((a, b) => a + b, 0) / avgScores.length : 0;
        
        const validStudents = (g.classData?.students || []).filter((st: any) => !isExemptStudent(st, g.classData?.slots));
        const totalStudents = validStudents.length;
        const uniqueStudentsDone = new Set(tickets.map(t => t.ticketSource?.studentId)).size;
        const firstTicket = tickets[0] as (Ticket & { courseCategory?: string }) | undefined;
        const ticketCentreId = firstTicket?.ticketSource?.centreId;
        const ticketCentreName = firstTicket?.ticketSource?.centre?.shortName
          || centres.find(c => c.id === ticketCentreId)?.shortName;
        const courseCategory = g.classData ? getCourseCategory(g.classData) : firstTicket?.courseCategory;

        return { 
          id,
          className: g.className, 
          tickets, 
          avgScore, 
          count: tickets.length,
          totalStudents,
          uniqueStudentsDone,
          sessionsInRange: g.sessionsInRange,
          surveySessions: g.classData?.surveySessions || [],
          courseCategory,
          classStatus: g.classData?.status,
          courseLine: g.classData?.course?.courseLine?.name || courseCategory,
          centreName: g.classData?.centre?.shortName || ticketCentreName,
          classData: g.classData
        };
      })
      .sort((a, b) => {
        if (a.sessionsInRange.length !== b.sessionsInRange.length) {
          return b.sessionsInRange.length - a.sessionsInRange.length;
        }
        return b.count - a.count;
      });

    if (selectedSessions.length > 0 && selectedSessions.length !== sessionOptions.length) {
      return result.filter(g => {
        const hasSession4 = g.sessionsInRange.includes(4);
        const hasSession8 = g.sessionsInRange.includes(8);
        const isOther = g.sessionsInRange.length === 0 && g.count > 0;
        
        return (
          (selectedSessions.includes('4') && hasSession4) ||
          (selectedSessions.includes('8') && hasSession8) ||
          (selectedSessions.includes('other') && isOther)
        );
      });
    }

    return result;
  }, [filteredTickets, pendingClasses, search, tableSelectedCentres, tableCentreIds, fromDate, toDate, selectedSessions, centres, sheetProcessedRows]);

  const activeGroups = useMemo(() =>
    groupedByClass.filter(g => !CLASS_INACTIVE_STATUSES.has(g.classStatus?.toUpperCase?.() || '')),
  [groupedByClass]);

  const inactiveGroups = useMemo(() =>
    groupedByClass.filter(g => CLASS_INACTIVE_STATUSES.has(g.classStatus?.toUpperCase?.() || '')),
  [groupedByClass]);

  const standardGroups = useMemo(() => 
    activeGroups.filter(g => g.sessionsInRange.length > 0), 
  [activeGroups]);

  const earlyLateGroups = useMemo(() => 
    activeGroups.filter(g => g.sessionsInRange.length === 0 && g.count > 0), 
  [activeGroups]);

  const sortClassGroups = useCallback((groups: typeof groupedByClass) => {
    return [...groups].sort((a, b) => {
      let comparison = 0;
      if (classSortBy === 'className') {
        comparison = a.className.localeCompare(b.className);
      } else if (classSortBy === 'sessions') {
        const aSession = a.sessionsInRange.length > 0 ? Math.min(...a.sessionsInRange) : 999;
        const bSession = b.sessionsInRange.length > 0 ? Math.min(...b.sessionsInRange) : 999;
        comparison = aSession - bSession;
      } else if (classSortBy === 'students') {
        comparison = a.uniqueStudentsDone - b.uniqueStudentsDone;
      } else if (classSortBy === 'count') {
        comparison = a.count - b.count;
      } else if (classSortBy === 'avgScore') {
        comparison = a.avgScore - b.avgScore;
      } else if (classSortBy === 'surveyStatus') {
        comparison = getSurveyBadgeMeta(a).label.localeCompare(getSurveyBadgeMeta(b).label);
      } else if (classSortBy === 'ticketStatus') {
        const aNew = a.tickets.filter(t => t.status === 'NEW').length;
        const bNew = b.tickets.filter(t => t.status === 'NEW').length;
        const aClosed = a.tickets.filter(t => t.status === 'CLOSED').length;
        const bClosed = b.tickets.filter(t => t.status === 'CLOSED').length;
        comparison = (aNew - bNew) || (aClosed - bClosed) || (a.count - b.count);
      }
      return classSortOrder === 'asc' ? comparison : -comparison;
    });
  }, [classSortBy, classSortOrder]);

  // Allowed pages (for navigation filtering)
  const { allowedPages } = useAllowedPages();

  const navItems = getNavItemsWithRouter('tickets', router, allowedPages);

  const _displayName = session?.displayName?.trim() || '';
  const _email = session?.email || '';
  const userAvatar = _displayName ? initials(_displayName) : _email.charAt(0).toUpperCase();
  const userName = _displayName || _email.split('@')[0];

  const selectedEntry = useMemo(() => mappedTickets.find(t => t.id === selectedTicketId), [mappedTickets, selectedTicketId]);

  // Prepare sortable survey data for modal
  const modalSurveyData = useMemo(() => {
    if (!selectedEntry) return [];
    
    const questions = selectedEntry.ticketSource?.questions || [];
    return questions.map((q: TicketQuestion) => {
      const ans = selectedEntry.ticketSource.answers?.find((a: any) => a.questionId === q.id);
      return {
        id: q.id,
        group: q.group || 'Khác',
        title: q.title,
        description: q.description,
        answer: ans ? ans.value : ''
      };
    });
  }, [selectedEntry]);

  type ModalSurveySortKey = 'group' | 'title' | 'answer';
  
  const { 
    sortedData: sortedModalSurvey, 
    sortBy: modalSurveySortBy, 
    sortOrder: modalSurveySortOrder, 
    handleSort: handleModalSurveySort 
  } = useTableSort<typeof modalSurveyData[0], ModalSurveySortKey>({
    data: modalSurveyData,
    defaultSortKey: 'group' as ModalSurveySortKey,
    defaultSortOrder: 'asc'
  });

  return (
    <ProtectedPage pageKey="tickets">
      <>
        <ToastContainer toasts={toasts} onRemove={removeToast} />
      <PageLayout
        title={TICKET_LABELS.PAGE_TITLE}
        activePage="tickets"
        sidebarOpen={sidebarOpen}
        onSidebarToggle={setSidebarOpen}
      >
        {/* TOOLBAR */}
        <Toolbar
          centres={centres} selectedCentres={selectedCentres}
          onCentresChange={setSelectedCentres} centresLoading={loading && centres.length === 0}
          dateFrom={fromDate} dateTo={toDate}
          onDateFromChange={setFromDate}
          onDateToChange={setToDate}
          onFetch={() => loadData(fromDate, toDate)}
          onCancel={handleCancelFetch}
          loading={loading} progress={progress}
          hasData={tickets.length > 0 || pendingClasses.length > 0 || googleSheetsRawData.length > 0}
          onClearCache={() => { 
            setTickets([]); 
            setPendingClasses([]); 
            setGoogleSheetsRawData([]); 
            clearCache(CACHE_KEYS.TICKETS); 
            addToast(MESSAGES.CACHE.CLEARED, 'success');
          }}
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

          {/* ── KPI Stats ── */}
          {(stats.total > 0 || loading) && (
            <motion.div className={styles.statsGrid} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <KPIStatCard
                label={KPI_LABELS.SURVEY_SCORE}
                value={stats.avgScore > 0 ? `★ ${stats.avgScore}` : '—'}
                desc={`Trên ${stats.scoredTickets} phiếu đánh giá giáo viên`}
                valueColor={stats.avgScore > 0 ? surveyColor(stats.avgScore) : undefined}
                score={stats.avgScore > 0 ? surveyScore(stats.avgScore) : undefined}
                icon={<Icon.User size={18} />}
                delay={0.0}
              />
              <KPIStatCard label={KPI_LABELS.NEW_TICKETS} value={String(stats.newTickets)} desc={`${stats.total} phiếu phản hồi trong kỳ`} valueColor={stats.newTickets > 0 ? 'var(--status-warning)' : 'var(--status-success)'} delay={0.07} />
              <KPIStatCard label={KPI_LABELS.RESOLVE_RATE} value={`${stats.resolveRate.toFixed(1)}%`} desc={`${stats.closedTickets} đã xử lý`} valueColor={stats.resolveRate >= 90 ? 'var(--status-success)' : 'var(--status-warning)'} delay={0.14} />
            </motion.div>
          )}

          {stats.total > 0 && (
            <KPIThresholdSuggestions
              label="Điểm GV:"
              items={surveySuggestions}
            />
          )}

          {/* CHARTS */}
          {mappedTickets.length > 1 && (centreChartData.length > 0 || courseLineChartData.length > 0) && (() => {
            const { chartHeight: centreHeight, cardHeight: centreCardHeight } = getSharedChartLayout([centreChartData.length], 180);
            const { chartHeight: courseHeight, cardHeight: courseCardHeight } = getSharedChartLayout([courseLineChartData.length], 180);

            return (
              <div className={styles.chartsSection}>
                <ChartSectionHeader title="Biểu Đồ Phân Tích" />
                <div className={styles.chartsGrid}>
                  {centreChartData.length > 0 && (
                    <KPIChartCard
                      title="Điểm Trung Bình Giáo Viên Theo Cơ Sở"
                      height={centreCardHeight}
                      legendItems={SURVEY_CHART_LEGEND}
                    >
                      <KPIBarChart
                        data={centreChartData}
                        dataKey="Điểm TB (GV)"
                        xLabel="Điểm (1-5)"
                        yLabel="Cơ sở"
                        domain={[0, 5]}
                        ticks={[0, 1, 2, 3, 4, 5]}
                        height={centreHeight}
                        valueFormatter={value => `★ ${value.toFixed(1)}`}
                        tickFormatter={value => String(value)}
                        getColor={datum => surveyColor(Number(datum['Điểm TB (GV)']))}
                        showValueLabel
                      />
                    </KPIChartCard>
                  )}

                  {courseLineChartData.length > 0 && (
                    <KPIChartCard
                      title="Điểm Trung Bình Giáo Viên Theo Khối"
                      height={courseCardHeight}
                      legendItems={SURVEY_CHART_LEGEND}
                    >
                      <KPIBarChart
                        data={courseLineChartData}
                        dataKey="Điểm TB (GV)"
                        xLabel="Điểm (1-5)"
                        yLabel="Khối học"
                        domain={[0, 5]}
                        ticks={[0, 1, 2, 3, 4, 5]}
                        height={courseHeight}
                        valueFormatter={value => `★ ${value.toFixed(1)}`}
                        tickFormatter={value => String(value)}
                        getColor={datum => surveyColor(Number(datum['Điểm TB (GV)']))}
                        showValueLabel
                      />
                    </KPIChartCard>
                  )}

                  {centreChartData.length > 0 && (
                    <KPIChartCard title={TICKET_LABELS.TICKETS_BY_CENTRE} height={centreCardHeight}>
                      <KPIBarChart
                        data={centreChartData}
                        dataKey="Số phiếu"
                        xLabel="Số phiếu"
                        yLabel="Cơ sở"
                        domain={[0, Math.max(...centreChartData.map(d => d['Số phiếu']), 0)]}
                        height={centreHeight}
                        valueFormatter={value => `${value.toFixed(0)} phiếu`}
                        tickFormatter={value => String(value)}
                        getColor={() => CHART_COLORS.SECONDARY[0]}
                        showValueLabel
                      />
                    </KPIChartCard>
                  )}

                  {courseLineChartData.length > 0 && (
                    <KPIChartCard title={TICKET_LABELS.TICKETS_BY_COURSE_LINE} height={courseCardHeight}>
                      <KPIBarChart
                        data={courseLineChartData}
                        dataKey="Số phiếu"
                        xLabel="Số phiếu"
                        yLabel="Khối học"
                        domain={[0, Math.max(...courseLineChartData.map(d => d['Số phiếu']), 0)]}
                        height={courseHeight}
                        valueFormatter={value => `${value.toFixed(0)} phiếu`}
                        tickFormatter={value => String(value)}
                        getColor={() => CHART_COLORS.SECONDARY[0]}
                        showValueLabel
                      />
                    </KPIChartCard>
                  )}
                </div>
              </div>
            );
          })()}

        {/* View Mode Toggle — Outside and above the panel for consistency */}
        {(mappedTickets.length > 0 || pendingClasses.length > 0 || loading || pendingLoading) && (
          <div style={{ marginTop: 'var(--space-6)' }}>
            <ViewModeToggle
              value={viewMode}
              onChange={setViewMode}
              options={[
                { value: 'by-class', label: TICKET_LABELS.CLASS_ANALYSIS_VIEW, icon: <Icon.PieChart /> },
                { value: 'list', label: TICKET_LABELS.LIST_VIEW, icon: <Icon.Table /> },
              ]}
            />          </div>
        )}

        <div id="section-entries">
            {/* ── Table Section ── */}
            {(stats.total > 0 || loading || pendingLoading || tickets.length > 0 || pendingClasses.length > 0) && (
              <AdminTableSection
                title={viewMode === 'list' ? TICKET_LABELS.TICKET_LIST : TICKET_LABELS.CLASS_ANALYSIS}
                count={viewMode === 'list' ? baseFilteredTickets.length : (standardGroups.length + earlyLateGroups.length)}
                loading={loading || pendingLoading}
                progress={progress}
                isExpanded={showActiveTable}
                onToggle={() => setShowActiveTable(p => !p)}
                actionSlot={undefined}
                toolbarSlot={(mappedTickets.length > 0 || pendingClasses.length > 0 || loading || pendingLoading) ? (
                  <>
                    <TableToolbar
                      search={search} onSearchChange={setSearch} searchPlaceholder="Mã phiếu, Lớp, Học viên, Nội dung..."
                      quickFilterSlots={
                        <>
                          {hasPreferences && (
                            <QuickFilterChips
                              centres={centres}
                              selectedCentres={tableSelectedCentres}
                              onCentresChange={setTableSelectedCentres}
                              selectedCourses={selectedCourseLines}
                              onCoursesChange={setSelectedCourseLines}
                              showCentres={true}
                              showCourses={true}
                            />
                          )}
                          <FilterChip
                            active={quickFilter === 'low_score'}
                            count={lowScoreCount}
                            countDisplay="always"
                            onClick={() => setQuickFilter(q => q === 'low_score' ? null : 'low_score')}
                          >
                            Điểm thấp (≤ 3.0)
                          </FilterChip>
                        </>
                      }
                      filterSlots={
                        <>
                          {tableCentreIds.length > 1 && <CentreSelect menuPosition="fixed" centres={centres} selected={tableSelectedCentres} onChange={setTableSelectedCentres} filterToIds={tableCentreIds} placeholder="Tất cả cơ sở" maxDisplay={1} searchable />}
                          {courseLineOptions.length > 1 && <MultiSelect menuPosition="fixed" options={courseLineOptions} selected={selectedCourseLines} onChange={setSelectedCourseLines} placeholder="Tất cả khối" maxDisplay={2} />}
                          {statusOptions.length > 1 && <MultiSelect menuPosition="fixed" options={statusOptions} selected={selectedStatuses} onChange={setSelectedStatuses} placeholder="Tất cả trạng thái" />}
                          {feedbackTopicEnumOptions.length > 1 && <MultiSelect menuPosition="fixed" options={feedbackTopicEnumOptions} selected={selectedFeedbackTopics} onChange={setSelectedFeedbackTopics} placeholder="Tất cả chủ đề" />}
                          <MultiSelect menuPosition="fixed" options={sessionOptions} selected={selectedSessions} onChange={setSelectedSessions} placeholder="Tất cả buổi" maxDisplay={1} />
                        </>
                      }
                      hasFilter={hasTableFilter} onClearFilter={clearTableFilters}
                    />
                  </>
                ) : undefined}
              >              <AnimatePresence>
                {selectedTicketIds.size > 0 && viewMode === 'list' && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    style={{
                      background: 'var(--brand-indigo)',
                      color: 'white',
                      padding: '12px 16px',
                      borderRadius: "var(--radius-card)",
                      marginBottom: 'var(--space-4)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-3)',
                      boxShadow: '0 4px 12px rgba(0, 113, 227, 0.3)'
                    }}>
                    <div style={{ fontWeight: 590, fontSize: 14 }}>
                      Đã chọn {selectedTicketIds.size} phiếu
                    </div>
                    <div style={{ flex: 1 }} />
                    <button onClick={handleOpenBulkModal} className={styles.primaryBtn}>
                      Cập nhật hàng loạt
                    </button>
                    <button onClick={() => setSelectedTicketIds(new Set())} className={styles.clearCacheBtn}>
                      <Icon.X size={10} />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
                    
                    {/* LIST VIEW */}
                    {viewMode === 'list' && (
                      <>
                        {/* Subheader Divider: Identical aesthetic alignment */}
                        <SubTableGroupHeader
                          title="DANH SÁCH PHIẾU TỪ HỆ THỐNG LMS"
                          count={filteredTickets.length}
                          icon={<Icon.ClipboardCheck size={13} />}
                          isExpanded={showLmsList}
                          onToggle={() => setShowLmsList(!showLmsList)}
                        />
                        <AnimatePresence initial={false}>
                          {showLmsList && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              style={{ overflow: 'hidden' }}
                            >
                      <div className={styles.tableScrollWrapper}>
                        {/* Headers */}
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: '40px minmax(0,1fr) minmax(0,2.5fr) minmax(0,0.8fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1.2fr)',
                          padding: '7px 16px', minWidth: 840,
                          borderBottom: '1px solid var(--border-primary)',
                          fontSize: 11, fontWeight: 590, color: 'var(--text-quaternary)',
                          letterSpacing: '0.04em', textTransform: 'uppercase',
                          background: 'var(--bg-elevated)',
                        }}>
                          {/* Checkbox column */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <input
                              type="checkbox"
                              checked={selectedTicketIds.size === filteredTickets.length && filteredTickets.length > 0}
                              onChange={handleToggleAll}
                              style={{ cursor: 'pointer', width: 16, height: 16 }}
                            />
                          </div>
                          {(['createdAt', 'title', '_avgScore', 'centre', 'status'] as const).map((col, i) => (
                             <div key={col}
                               className={`${styles.sortableCol} ${sortKey === col ? styles.activeSort : ''}`}
                               style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', userSelect: 'none' }}
                               onClick={() => handleSort(col as any)}>
                               {['Ngày tạo', 'Học viên & Lớp', 'Điểm', 'Cơ sở', 'Trạng thái'][i]}
                               <SortIcon col={col} sortKey={sortKey} sortDir={sortDir} />
                             </div>
                          ))}
                          <div style={{ display: 'flex', alignItems: 'center', userSelect: 'none' }}>Nguồn / ID</div>
                        </div>

                        {/* Skeleton */}
                        {loading && tickets.length === 0 && Array.from({ length: 8 }).map((_, i) => (
                          <div key={i} className={styles.skeletonRow} style={{ gridTemplateColumns: '40px minmax(0,1fr) minmax(0,2.5fr) minmax(0,0.8fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1.2fr)', minWidth: 840 }}>
                            <div />
                            <div className={styles.skeletonBlock} style={{ width: '60%' }} />
                            <div className={styles.skeletonBlock} style={{ width: '80%' }} />
                            <div className={styles.skeletonBlock} style={{ width: '40%' }} />
                            <div className={styles.skeletonBlock} style={{ width: '50%' }} />
                            <div className={styles.skeletonBlock} style={{ width: '50%' }} />
                            <div className={styles.skeletonBlock} style={{ width: '70%' }} />
                          </div>
                        ))}

                      {/* Rows */}
                      <AnimatePresence initial={false}>
                        {filteredTickets.map((t, idx) => (
                            <motion.div key={t.id}
                              style={{
                                display: 'grid',
                                gridTemplateColumns: '40px minmax(0,1fr) minmax(0,2.5fr) minmax(0,0.8fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1.2fr)',
                                padding: '10px 16px', minWidth: 840,
                                borderBottom: '1px solid var(--border-primary)',
                                alignItems: 'start',
                                background: selectedTicketIds.has(t.id) ? 'var(--bg-panel)' : 'var(--bg-surface)',
                                transition: 'background 0.1s ease',
                              }}
                              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.18, delay: Math.min(idx * 0.012, 0.3) }}
                              onMouseEnter={e => !selectedTicketIds.has(t.id) && ((e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)')}
                              onMouseLeave={e => !selectedTicketIds.has(t.id) && ((e.currentTarget as HTMLElement).style.background = 'var(--bg-surface)')}>
                              
                              {/* Checkbox */}
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 2 }}>
                                <input
                                  type="checkbox"
                                  checked={selectedTicketIds.has(t.id)}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    handleToggleTicket(t.id);
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  style={{ cursor: 'pointer', width: 16, height: 16 }}
                                />
                              </div>

                              {/* Rest of row - make clickable */}
                              <div
                                style={{ display: 'contents', cursor: 'pointer' }}
                                onClick={() => { setSelectedTicketId(t.id); openEditForTicket(t as any); }}
                              >
                              
                              {/* Created At */}
                              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                                {(t as any)._safeDate}
                              </div>
  
                              {/* Info */}
                              <div className={styles.className} style={{ minWidth: 0 }}>
                                <div style={{ paddingBottom: 4, fontWeight: 590, color: 'var(--text-primary)' }}>
                                  {t.ticketSource?.studentName || t.ticketSource?.studentId || 'Chưa định danh'}
                                </div>
                                <div className={styles.centreName} style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                                  <CourseCategoryBadge category={t.courseCategory} size="sm" style={{ fontSize: 10, padding: '0 var(--space-1)' }} />
                                  <span style={{ textOverflow: 'ellipsis', overflow: 'hidden' }}>{t.ticketSource?.className || '—'}</span>
                                </div>
                                <div style={{ paddingTop: 4, fontSize: 11, color: 'var(--text-quaternary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {t.title || 'Không có tiêu đề'}
                                </div>
                              </div>
                              
                              {/* Score */}
                              <div style={{ display: 'flex', alignItems: 'flex-start', paddingTop: 2, flexWrap: 'wrap', gap: 4 }}>
                                {(t as any)._groupScores?.length > 0 ? (
                                  (t as any)._groupScores.map((gs: any) => {
                                    const val = parseFloat(gs.avg);
                                    const color = surveyColor(val);
                                    // Use semi-transparent background based on color
                                    const bg = color.startsWith('var(') ? 'rgba(0,0,0,0.05)' : `${color}15`;

                                    return (
                                      <Badge
                                        key={gs.group}
                                        title={gs.group}
                                        variant="custom"
                                        size="sm"
                                        shape="rounded"
                                        customColors={{ background: bg, color, border: bg }}
                                      >
                                        {gs.group}: ★ {gs.avg}
                                      </Badge>
                                    );
                                  })
                                ) : <span style={{ fontSize: 13, color: 'var(--text-quaternary)' }}>—</span>}
                              </div>
  
                              {/* Centre */}
                              <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 510, paddingTop: 2 }}>
                                {t.ticketSource?.centre?.shortName || '—'}
                              </div>
  
                              {/* Status */}
                              <div style={{ paddingTop: 2 }}>
                                <TicketStatusBadge status={t.status} />
                              </div>
  
                              {/* Meta */}
                              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', paddingTop: 2 }}>
                                {t.ticketCode || t.id.slice(-6).toUpperCase()}
                              </div>
                              
                              </div>
                            </motion.div>
                        ))}
                      </AnimatePresence>

                      {!loading && filteredTickets.length === 0 && tickets.length > 0 && (
                        <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--text-quaternary)', fontSize: 13 }}>
                           Không có phiếu nào khớp với bộ lọc hiện tại.
                        </div>
                      )}
                    </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                    
                    {/* ── Tách Bảng Google Sheets Vào View Chung ── */}
                    <GoogleSheetsSection 
                      classes={pendingClasses} 
                      fromDate={fromDate} 
                      toDate={toDate} 
                      centres={centres} 
                      selectedCentres={selectedCentres}
                      externalRawData={googleSheetsRawData}
                      parentLoading={loading}
                      onDataProcessed={setSheetProcessedRows}
                      onViewDetails={(item) => setViewingSheetRow(item)}
                    />
                    </>
                    )}

                    {/* BY CLASS VIEW */}
                    {viewMode === 'by-class' && (
                      <div className={styles.tableScrollWrapper}>
                        {/* Table Header */}
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'minmax(0, 1.7fr) minmax(0, 0.6fr) minmax(0, 0.95fr) minmax(0, 0.7fr) minmax(0, 0.7fr) minmax(0, 1.15fr) minmax(0, 1fr)',
                          padding: '7px 16px',
                          borderBottom: '1px solid var(--border-primary)',
                          fontSize: 11,
                          fontWeight: 590,
                          color: 'var(--text-quaternary)',
                          letterSpacing: '0.04em',
                          textTransform: 'uppercase',
                          background: 'var(--bg-elevated)',
                          minWidth: 900
                        }}>
                          <SortableColumnWithCopy
                            label="Lớp học"
                            sortKey="className"
                            currentSortKey={classSortBy}
                            sortDir={classSortOrder}
                            onSort={() => handleClassSort('className')}
                            classCodes={[...standardGroups, ...earlyLateGroups].map(group => group.className)}
                            disabled={(standardGroups.length + earlyLateGroups.length) === 0}
                          />
                          <SortableColumn label="Buổi" sortKey="sessions" currentSortKey={classSortBy} sortOrder={classSortOrder} onSort={(key) => handleClassSort(key as typeof classSortBy)} className={styles.sortableCol} />
                          <SortableColumn label="Hoàn thành" sortKey="students" currentSortKey={classSortBy} sortOrder={classSortOrder} onSort={(key) => handleClassSort(key as typeof classSortBy)} className={styles.sortableCol} />
                          <SortableColumn label="Số phiếu" sortKey="count" currentSortKey={classSortBy} sortOrder={classSortOrder} onSort={(key) => handleClassSort(key as typeof classSortBy)} className={styles.sortableCol} />
                          <SortableColumn label="Điểm trung bình" sortKey="avgScore" currentSortKey={classSortBy} sortOrder={classSortOrder} onSort={(key) => handleClassSort(key as typeof classSortBy)} className={styles.sortableCol} />
                          <SortableColumn label="Trạng thái khảo sát" sortKey="surveyStatus" currentSortKey={classSortBy} sortOrder={classSortOrder} onSort={(key) => handleClassSort(key as typeof classSortBy)} className={styles.sortableCol} />
                          <SortableColumn label="Trạng thái" sortKey="ticketStatus" currentSortKey={classSortBy} sortOrder={classSortOrder} onSort={(key) => handleClassSort(key as typeof classSortBy)} className={styles.sortableCol} />
                        </div>

                        {/* Standard Surveys Section */}
                        {standardGroups.length > 0 && (
                          <>
                            <SubTableGroupHeader
                              title="ĐÚNG ĐỢT (BUỔI 4 & 8)"
                              count={standardGroups.length}
                              icon={<Icon.Calendar size={13} />}
                              isExpanded={standardExpanded}
                              onToggle={() => setStandardExpanded(!standardExpanded)}
                            />
                            <AnimatePresence initial={false}>
                              {standardExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                                  style={{ overflow: 'hidden' }}
                                >
                                  {sortClassGroups(standardGroups)
                                    .map((group) => {
                                      const newCount = group.tickets.filter(t => t.status === 'NEW').length;
                                      const closedCount = group.tickets.filter(t => t.status === 'CLOSED').length;
                                      const surveyMeta = getSurveyBadgeMeta(group);
                                      return (
                                        <div
                                          key={group.id}
                                          style={{
                                            display: 'grid',
                                            gridTemplateColumns: 'minmax(0, 1.7fr) minmax(0, 0.6fr) minmax(0, 0.95fr) minmax(0, 0.7fr) minmax(0, 0.7fr) minmax(0, 1.15fr) minmax(0, 1fr)',
                                            padding: '12px 16px',
                                            borderBottom: '1px solid var(--border-primary)',
                                            alignItems: 'center',
                                            transition: 'background 0.1s ease',
                                            cursor: 'pointer',
                                            background: 'var(--bg-surface)',
                                            minWidth: 900
                                          }}
                                          onClick={() => setSelectedClassForModal({ className: group.className, tickets: group.tickets as typeof filteredTickets, classData: group.classData })}
                                          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)'}
                                          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-surface)'}
                                        >
                                          <div style={{ fontSize: 13, fontWeight: 510, color: 'var(--text-primary)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                                              <span style={{ fontWeight: 600 }}>{group.className}</span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', marginTop: 4 }}>
                                              <CourseCategoryBadge category={group.courseCategory} size="sm" />
                                              <CentreBadge name={group.centreName} />
                                            </div>
                                          </div>

                                          {/* Buổi */}
                                          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--brand-indigo)' }}>
                                            {group.sessionsInRange.join(', ')}
                                          </div>

                                          <div>
                                            <div style={{ fontSize: 13, fontWeight: 590, color: 'var(--text-primary)' }}>
                                              {group.uniqueStudentsDone} / {group.totalStudents || '?'} HV
                                            </div>
                                            {group.totalStudents > 0 && (
                                              <div style={{ height: 4, width: '100%', maxWidth: 80, background: 'rgba(0,0,0,0.05)', borderRadius: 2, marginTop: 4, overflow: 'hidden' }}>
                                                <div style={{ 
                                                  height: '100%', 
                                                  width: `${Math.min(100, (group.uniqueStudentsDone / group.totalStudents) * 100)}%`,
                                                  background: (group.uniqueStudentsDone / group.totalStudents) >= 0.8 ? 'var(--status-success)' : 'var(--brand-indigo)'
                                                }} />
                                              </div>
                                            )}
                                          </div>

                                          <div style={{ fontSize: 15, fontWeight: 590, color: 'var(--text-secondary)' }}>
                                            {group.count}
                                          </div>

                                          <div style={{ 
                                            fontSize: 16, 
                                            fontWeight: 600, 
                                            color: group.avgScore > 0 ? surveyColor(group.avgScore) : 'var(--text-quaternary)',
                                            display: 'flex', alignItems: 'center', gap: 4
                                          }}>
                                            <span>★</span>
                                            <span>{group.avgScore > 0 ? group.avgScore.toFixed(1) : '—'}</span>
                                          </div>

                                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                                            <Badge
                                              variant="custom"
                                              size="sm"
                                              shape="rounded"
                                              customColors={{ background: surveyMeta.bg, color: surveyMeta.color, border: surveyMeta.bg }}
                                            >
                                              {surveyMeta.label}
                                            </Badge>
                                          </div>

                                          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                                            {newCount > 0 && <Badge variant="passed" size="sm" shape="rounded">{newCount} mới</Badge>}
                                            {closedCount > 0 && <Badge variant="exempt" size="sm" shape="rounded">{closedCount} đã xử lý</Badge>}
                                          </div>
                                        </div>
                                      );
                                    })}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </>
                        )}

                        {/* Early/Late Surveys Section */}
                        {earlyLateGroups.length > 0 && (
                          <>
                            <div style={{ marginTop: 12 }}>
                              <SubTableGroupHeader
                                title="KHẢO SÁT SỚM / MUỘN (NGOÀI ĐỢT)"
                                count={earlyLateGroups.length}
                                icon={<Icon.Clock size={13} />}
                                color="var(--status-warning)"
                                isExpanded={earlyLateExpanded}
                                onToggle={() => setEarlyLateExpanded(!earlyLateExpanded)}
                              />
                            </div>
                            <AnimatePresence initial={false}>
                              {earlyLateExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                                  style={{ overflow: 'hidden' }}
                                >
                                  {sortClassGroups(earlyLateGroups)
                                    .map((group) => {
                                      const newCount = group.tickets.filter(t => t.status === 'NEW').length;
                                      const closedCount = group.tickets.filter(t => t.status === 'CLOSED').length;
                                      const surveyMeta = getSurveyBadgeMeta(group);
                                      return (
                                        <div
                                          key={group.id}
                                          style={{
                                            display: 'grid',
                                            gridTemplateColumns: 'minmax(0, 1.7fr) minmax(0, 0.6fr) minmax(0, 0.95fr) minmax(0, 0.7fr) minmax(0, 0.7fr) minmax(0, 1.15fr) minmax(0, 1fr)',
                                            padding: '12px 16px',
                                            borderBottom: '1px solid var(--border-primary)',
                                            alignItems: 'center',
                                            transition: 'background 0.1s ease',
                                            cursor: 'pointer',
                                            background: 'var(--bg-surface)',
                                            minWidth: 900,
                                            opacity: 0.85
                                          }}
                                          onClick={() => setSelectedClassForModal({ className: group.className, tickets: group.tickets as typeof filteredTickets, classData: group.classData })}
                                          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)'}
                                          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-surface)'}
                                        >
                                          <div style={{ fontSize: 13, fontWeight: 510, color: 'var(--text-primary)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                                              <span style={{ fontWeight: 600 }}>{group.className}</span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', marginTop: 4 }}>
                                              <CourseCategoryBadge category={group.courseCategory} size="sm" />
                                              <CentreBadge name={group.centreName} />
                                            </div>
                                          </div>

                                          {/* Buổi */}
                                          <div style={{ fontSize: 13, color: 'var(--text-quaternary)', fontStyle: 'italic' }}>
                                            Sớm/Muộn
                                          </div>

                                          <div>
                                            <div style={{ fontSize: 13, fontWeight: 590, color: 'var(--text-primary)' }}>
                                              {group.uniqueStudentsDone} HV
                                            </div>
                                          </div>

                                          <div style={{ fontSize: 15, fontWeight: 590, color: 'var(--text-secondary)' }}>
                                            {group.count}
                                          </div>

                                          <div style={{ 
                                            fontSize: 16, 
                                            fontWeight: 600, 
                                            color: group.avgScore > 0 ? surveyColor(group.avgScore) : 'var(--text-quaternary)',
                                            display: 'flex', alignItems: 'center', gap: 4
                                          }}>
                                            <span>★</span>
                                            <span>{group.avgScore > 0 ? group.avgScore.toFixed(1) : '—'}</span>
                                          </div>

                                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                                            <Badge
                                              variant="custom"
                                              size="sm"
                                              shape="rounded"
                                              customColors={{ background: surveyMeta.bg, color: surveyMeta.color, border: surveyMeta.bg }}
                                            >
                                              {surveyMeta.label}
                                            </Badge>
                                          </div>

                                          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                                            {newCount > 0 && <Badge variant="passed" size="sm" shape="rounded">{newCount} mới</Badge>}
                                            {closedCount > 0 && <Badge variant="exempt" size="sm" shape="rounded">{closedCount} đã xử lý</Badge>}
                                          </div>
                                        </div>
                                      );
                                    })}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </>
                        )}

                        {(standardGroups.length === 0 && earlyLateGroups.length === 0) && (
                          <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--text-quaternary)', fontSize: 13 }}>
                            Không có dữ liệu để hiển thị.
                          </div>
                        )}

                      </div>
                    )}

                    {/* PENDING SURVEYS VIEW */}
                    {viewMode === 'pending' && (
                      <div className={styles.tableScrollWrapper}>
                        {/* Headers */}
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'minmax(0,2fr) minmax(0,1.5fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)',
                          padding: '7px 16px', minWidth: 700,
                          borderBottom: '1px solid var(--border-primary)',
                          fontSize: 11, fontWeight: 590, color: 'var(--text-quaternary)',
                          letterSpacing: '0.04em', textTransform: 'uppercase',
                          background: 'var(--bg-elevated)',
                        }}>
                          <div>Lớp học</div>
                          <div>Khoá học / Khối</div>
                          <div>Cơ sở</div>
                          <div>Sĩ số</div>
                          <div>Ghi chú</div>
                        </div>

                        {/* Skeleton */}
                        {pendingLoading && pendingClasses.length === 0 && Array.from({ length: 5 }).map((_, i) => (
                           <div key={i} className={styles.skeletonRow} style={{ gridTemplateColumns: 'minmax(0,2fr) minmax(0,1.5fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)', minWidth: 700 }}>
                             <div className={styles.skeletonBlock} style={{ width: '80%' }} />
                             <div className={styles.skeletonBlock} style={{ width: '60%' }} />
                             <div className={styles.skeletonBlock} style={{ width: '40%' }} />
                             <div className={styles.skeletonBlock} style={{ width: '30%' }} />
                             <div className={styles.skeletonBlock} style={{ width: '50%' }} />
                           </div>
                        ))}

                        {/* Rows */}
                        <AnimatePresence initial={false}>
                          {filteredPendingClasses.map((c, idx) => (
                              <motion.div key={c.id}
                                style={{
                                  display: 'grid',
                                  gridTemplateColumns: 'minmax(0,2fr) minmax(0,1.5fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)',
                                  padding: '12px 16px', minWidth: 700,
                                  borderBottom: '1px solid var(--border-primary)',
                                  alignItems: 'center',
                                  background: 'var(--bg-surface)',
                                }}
                                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.18, delay: Math.min(idx * 0.012, 0.3) }}
                                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)'}
                                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-surface)'}>
                                
                                <div style={{ fontSize: 14, fontWeight: 590, color: 'var(--text-primary)' }}>
                                  {c.name}
                                </div>
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {c.course?.name || '—'}
                                  </div>
                                  <div style={{ fontSize: 11, color: 'var(--text-quaternary)' }}>
                                    {getCourseCategory(c)}
                                  </div>
                                </div>
                                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                                  {c.centre?.shortName || '—'}
                                </div>
                                <div style={{ fontSize: 14, fontWeight: 510 }}>
                                  {c.students?.length || 0}
                                </div>
                                <div>
                                  <Badge variant="custom" size="sm" customColors={{ background: 'var(--brand-indigo-muted)', color: 'var(--brand-indigo)', border: 'transparent' }}>
                                    Buổi 4/8
                                  </Badge>
                                </div>
                              </motion.div>
                          ))}
                        </AnimatePresence>

                        {!pendingLoading && filteredPendingClasses.length === 0 && (
                          <div style={{ padding: '40px 16px', textAlign: 'center' }}>
                            <EmptyState
                               title="Không có lớp nào cần khảo sát"
                               subtitle="Trong khoảng thời gian này không tìm thấy lớp nào tới buổi 4 hoặc buổi 8."
                            />
                          </div>
                        )}
                      </div>
                    )}
            </AdminTableSection>
            )}

            {viewMode === 'by-class' && inactiveGroups.length > 0 && (
              <div className={styles.tableSection} style={{ opacity: 0.55, marginTop: 'var(--space-4)' }}>
                <TableGroupHeader
                  title="Lớp đã huỷ / tạm dừng"
                  count={inactiveGroups.length}
                  note="Không tính vào bảng phân tích lớp"
                  isExpanded={inactiveExpanded}
                  onToggle={() => setInactiveExpanded(p => !p)}
                />
                <AnimatePresence initial={false}>
                  {inactiveExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      style={{ overflow: 'hidden' }}
                    >
                      <div className={styles.tableScrollWrapper} style={{ minWidth: 0 }}>
                        {inactiveGroups
                          .sort((a, b) => a.className.localeCompare(b.className))
                          .map((group) => (
                            <div
                              key={group.id}
                              className={styles.classItem}
                              style={{
                                gridTemplateColumns: 'minmax(0, 1.8fr) minmax(0, 0.8fr) minmax(0, 1fr) minmax(0, 0.8fr)',
                                cursor: 'pointer',
                              }}
                              onClick={() => {
                                setSelectedClassForModal({ className: group.className, tickets: group.tickets as typeof filteredTickets, classData: group.classData });
                              }}
                            >
                              <div className={styles.className}>
                                {group.className}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', marginTop: 2 }}>
                                  <CourseCategoryBadge category={group.courseCategory} size="sm" />
                                  <CentreBadge name={group.centreName} />
                                </div>
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--text-quaternary)' }}>
                                {group.classStatus || '—'}
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--text-quaternary)' }}>
                                {group.sessionsInRange.length > 0 ? `Buổi ${group.sessionsInRange.join(', ')}` : 'Ngoài đợt'}
                              </div>
                              <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                                {group.count > 0 && <Badge variant="default" size="sm" shape="rounded">{group.count} phiếu</Badge>}
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
          {!loading && tickets.length === 0 && (
            <EmptyState
              icon={<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
              </svg>}
              title="Chưa có dữ liệu khảo sát"
              subtitle={'Chọn khoảng thời gian và nhấn "Tải dữ liệu"'}
            />
          )}

      </PageLayout>

      {/* ── CLASS STUDENTS MODAL (By Class View) ── */}
      <Modal open={!!selectedClassForModal} onClose={() => setSelectedClassForModal(null)}>
        {selectedClassForModal && (() => {
          // Construct unified list combining classData valid students and actual tickets
          const classStudents = selectedClassForModal.classData?.students || [];
          const validStudents = classStudents.filter((st: any) => !isExemptStudent(st, selectedClassForModal.classData?.slots));
          
          // 1. Build dual lookups for maximum fault tolerance (Exact ID + Fuzzy Semantic Name)
          // This perfectly repairs native LMS data inconsistencies AND unifies Google Sheets in one fell swoop!
          const idToTickets = new Map<string, typeof selectedClassForModal.tickets>();
          const nameToTickets = new Map<string, typeof selectedClassForModal.tickets>();
          
          selectedClassForModal.tickets.forEach(t => {
            const studentId = t.ticketSource?.studentId;
            const studentName = t.ticketSource?.studentName || '';
            const normalizedKey = normalizeString(studentName).replace(/\s+/g, '');
            
            if (studentId && studentId !== 'unknown') {
               if (!idToTickets.has(studentId)) idToTickets.set(studentId, []);
               idToTickets.get(studentId)!.push(t);
            }
            if (normalizedKey) {
               if (!nameToTickets.has(normalizedKey)) nameToTickets.set(normalizedKey, []);
               nameToTickets.get(normalizedKey)!.push(t);
            }
          });

          const rowList: Array<{ name: string; tickets: any[]; studentId?: string; }> = [];
          const processedTicketIds = new Set<string>();

          // 2. Assemble unified students by scanning both Primary ID AND Secondary Fuzzy Key on roster!
          validStudents.forEach((st: any) => {
            const id = st.student?.id;
            const fullName = st.student?.fullName || 'Học viên';
            const normalizedRosterKey = normalizeString(fullName).replace(/\s+/g, '');
            
            let studentTickets: any[] = [];
            // Path A: Traditional system lookup
            if (id && idToTickets.has(id)) {
               studentTickets.push(...idToTickets.get(id)!);
            }
            // Path B: Smart secondary recovery for inconsistent identifiers (LMS native bug-fix)
            if (normalizedRosterKey && nameToTickets.has(normalizedRosterKey)) {
               const nameMatched = nameToTickets.get(normalizedRosterKey)!;
               nameMatched.forEach(candidate => {
                  // Ensure zero overlap counting
                  if (!studentTickets.some(exists => exists.id === candidate.id)) {
                     studentTickets.push(candidate);
                  }
               });
            }
            
            const finalTickets = Array.from(new Map(studentTickets.map(x => [x.id, x])).values());
            finalTickets.forEach(x => processedTicketIds.add(x.id));
            
            rowList.push({ name: fullName, tickets: finalTickets, studentId: id });
          });

          // 3. Residual Sweep: Safely scoop remaining orphan tickets into self-consistent buckets
          selectedClassForModal.tickets.forEach(t => {
             if (!processedTicketIds.has(t.id)) {
                const ticketGivenName = t.ticketSource?.studentName || 'Học viên không rõ';
                const normalizedKey = normalizeString(ticketGivenName).replace(/\s+/g, '');
                
                const existingResidual = rowList.find(r => 
                   !r.studentId && normalizeString(r.name).replace(/\s+/g, '') === normalizedKey
                );
                
                if (existingResidual) {
                   existingResidual.tickets.push(t);
                } else {
                   rowList.push({ name: ticketGivenName, tickets: [t], studentId: t.ticketSource?.studentId });
                }
                processedTicketIds.add(t.id);
             }
          });

          rowList.sort((a, b) => a.name.localeCompare(b.name));

          return (
            <>
              <ModalHeader
                title={`${selectedClassForModal.className}`}
                subtitle={`${rowList.length} học viên • ${selectedClassForModal.tickets.length} phiếu đánh giá`}
                onClose={() => setSelectedClassForModal(null)}
              />
              <div className={styles.modalBody} style={{ padding: '16px 20px 20px' }}>
                <div className={styles.tableScrollWrapper}>
                  <table className={styles.studentTable}>
                  <thead>
                    <tr>
                      <th>Học viên</th>
                      <th>Đợt khảo sát</th>
                      <th>Ngày</th>
                      <th>Trạng thái</th>
                      <th>Mã phiếu</th>
                      <th>Điểm GV</th>
                      <th>Chi tiết điểm</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rowList.map(({ name, tickets, studentId }) => {
                      if (tickets.length === 0) {
                        return (
                          <tr key={`empty-${studentId || name}`}>
                            <td style={{ fontWeight: 510 }}>{name}</td>
                            <td style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-quaternary)' }}>—</td>
                            <td style={{ fontSize: 12, whiteSpace: 'nowrap', color: 'var(--text-quaternary)' }}>—</td>
                            <td><Badge variant="failed" size="sm">Chưa làm</Badge></td>
                            <td style={{ fontSize: 12, color: 'var(--text-quaternary)' }}>—</td>
                            <td style={{ textAlign: 'center', color: 'var(--text-quaternary)' }}>—</td>
                            <td style={{ color: 'var(--text-quaternary)', fontSize: 12 }}>Chưa khảo sát</td>
                          </tr>
                        );
                      }

                      return tickets.map((t, idx) => {
                        const isSheet = (t as any)._isGoogleSheet;
                        const teacherScore = (t as any)._groupScores?.find((gs: any) => {
                          const gName = gs.group.toUpperCase();
                          return gName.includes('TEACHER') || gName.includes('GIÁO VIÊN') || gName === 'GV';
                        });
                        const score = isSheet ? (t as any)._sheetAvgScore : (teacherScore ? parseFloat(teacherScore.avg) : null);
                        
                        return (
                          <tr key={t.id} 
                            onClick={() => { 
                               if (isSheet) {
                                  setViewingSheetRow((t as any)._fullRecord);
                                  return;
                               }
                               setSelectedTicketId(t.id); 
                               openEditForTicket(t as any); 
                               setSelectedClassForModal(null); 
                            }}
                            style={{ cursor: 'pointer' }}>
                            {idx === 0 && (
                              <td rowSpan={tickets.length} style={{ fontWeight: 510 }}>
                                <div style={{ marginBottom: 2 }}>{name}</div>
                                {(() => {
                                   const sheetNames = Array.from(new Set(
                                      tickets.filter((t: any) => t._isGoogleSheet)
                                             .map((t: any) => t.ticketSource?.studentName)
                                             .filter(Boolean)
                                   ));
                                   if (sheetNames.length === 0) return null;
                                   return sheetNames.map((sn: any) => (
                                      <div key={sn} style={{ fontSize: 9, color: '#c5221f', fontWeight: 500, marginTop: 2, display: 'flex', alignItems: 'center', gap: 3, opacity: 0.9 }}>
                                         <span style={{ background: '#fce8e6', padding: '1px 3px', borderRadius: 2, fontSize: 8, letterSpacing: 0.2 }}>GỐC</span> {sn}
                                      </div>
                                   ));
                                })()}
                                {tickets.length > 1 && (
                                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4, background: 'var(--bg-panel)', display: 'inline-block', padding: '1px 4px', borderRadius: 3, border: '1px solid var(--border-primary)' }}>
                                    {tickets.length} đợt
                                  </div>
                                )}
                              </td>
                            )}
                            <td style={{ textAlign: 'center', fontSize: 12 }}>
                              {tickets.length > 1 ? `Đợt ${idx + 1}` : '—'}
                            </td>
                            <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                              {(t as any)._safeDate}
                            </td>
                            <td>
                               {isSheet ? (
                                  <Badge variant="info" size="sm" style={{ background: '#e8f0fe', color: '#1967d2' }}>Đã nộp</Badge>
                               ) : (
                                  <TicketStatusBadge status={t.status} />
                               )}
                            </td>
                            <td style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                              {isSheet ? (
                                 <Badge variant="custom" size="sm" style={{ background: '#fce8e6', color: '#c5221f', fontWeight: 600, fontSize: 9 }}>GOOGLE SHEETS</Badge>
                              ) : (
                                 t.ticketCode || '—'
                              )}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              {score !== null ? (
                                <span style={{ 
                                  fontSize: 16, 
                                  fontWeight: 600, 
                                color: score !== null ? surveyColor(score) : undefined
                                }}>
                                  ★ {score.toFixed(1)}
                                </span>
                              ) : (
                                <span style={{ color: 'var(--text-quaternary)' }}>—</span>
                              )}
                            </td>
                            <td>
                              {(t as any)._groupScores && (t as any)._groupScores.length > 0 ? (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                  {(t as any)._groupScores.map((gs: any) => {
                                    const val = parseFloat(gs.avg);
                                    const color = surveyColor(val);
                                    // Use semi-transparent background based on color
                                    const bg = color.startsWith('var(') ? 'rgba(0,0,0,0.05)' : `${color}15`;
                                    
                                    return (
                                      <Badge
                                        key={gs.group}
                                        variant="custom"
                                        size="sm"
                                        shape="rounded"
                                        customColors={{ background: bg, color, border: bg }}
                                      >
                                        {gs.group}: ★{gs.avg}
                                      </Badge>
                                    );
                                  })}
                                </div>
                              ) : (
                                <span style={{ color: 'var(--text-quaternary)' }}>—</span>
                              )}
                            </td>
                          </tr>
                        );
                      });
                    })}
                  </tbody>
                </table>
                </div>
              </div>
            </>
          );
        })()}
      </Modal>


      {/* ── GOOGLE SHEETS DETAIL MODAL ── */}
      <Modal open={!!viewingSheetRow} onClose={() => setViewingSheetRow(null)}>
        {viewingSheetRow && (() => {
           const rowData = viewingSheetRow.row || {};
           const studentName = viewingSheetRow.studentName;
           const timestamp = viewingSheetRow.timestamp;
           
           // 1. Dynamic Attribute Harvesting: Extract implicit fields to promote to Header Grid!
           let extractedCentre = '';
           let extractedCourse = '';
           
           Object.entries(rowData).forEach(([k, v]) => {
              const keyUpper = k.toUpperCase().trim();
              const valStr = String(v || '').trim();
              // Skip empty or explicit default empty markers
              if (!valStr || valStr === 'Chưa trả lời' || valStr === '-' || valStr === 'FALSE') return;
              
              if (keyUpper.includes('MÃ CƠ SỞ CỦA EM LÀ') || keyUpper === 'MÃ CS') {
                 // Capture the more descriptive choice if duplicates exist
                 if (!extractedCentre || extractedCentre.length < valStr.length) {
                    extractedCentre = valStr;
                 }
              }
              if (keyUpper.includes('EM ĐANG HỌC BỘ MÔN NÀO')) {
                 extractedCourse = valStr;
              }
           });

           // 2. Strict Inclusions Matrix: Lock down display to exactly 8 user-targeted columns!
           const isExplicitlyTargetedQuestion = (k: string): boolean => {
              const u = k.toUpperCase();
              return (
                 u.includes('ĐÁNH GIÁ THẾ NÀO VỀ BUỔI HỌC TRƯỚC') || // Col E
                 u.includes('NỘI DUNG THỰC HÀNH CÓ DỄ KHÔNG') ||    // Col F
                 u.includes('HÌNH ẢNH VÀ VIDEO HỖ TRỢ') ||          // Col G
                 u.includes('XEM THẦY TRỰC TIẾP HƯỚNG DẪN HƠN') ||  // Col H
                 u.includes('THÊM HOẠT ĐỘNG GÌ TRONG LỚP HỌC') ||    // Col I
                 u.includes('GIẢNG BÀI DỄ HIỂU CHỨ') ||             // Col K
                 u.includes('YÊU THÍCH GIÁO VIÊN LỚP MÌNH CHỨ') ||   // Col L
                 u.includes('CẢI THIỆN ĐIỀU GÌ HƠN TRONG TƯƠNG LAI') // Col O
              );
           };

           // 3. Hardened Taxonomy Mapping tuned strictly to surviving whitelist payload
           const getLmsGroup = (key: string): string => {
              const u = key.toUpperCase();
              // Map E-H to DOCUMENT based on content tags
              if (u.includes('BUỔI HỌC') || u.includes('THỰC HÀNH') || u.includes('VIDEO')) {
                 return 'DOCUMENT';
              }
              // Map I,K,L,O to TEACHER
              return 'TEACHER';
           };

           return (
             <>
               <ModalHeader 
                 title="Phiếu khảo sát Google Sheets"
                 subtitle={`${studentName} • ${timestamp}`}
                 onClose={() => setViewingSheetRow(null)}
               />
               <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
                  {/* Top Summary Grid with dynamic metadata injection using shared UI Components */}
                  <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
                     <div>
                        <div style={{ fontSize: 11, fontWeight: 590, color: 'var(--text-quaternary)', textTransform: 'uppercase', marginBottom: 6 }}>Học viên (Form)</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', padding: '7px 0' }}>{studentName}</div>
                     </div>
                     <div>
                        <div style={{ fontSize: 11, fontWeight: 590, color: 'var(--text-quaternary)', textTransform: 'uppercase', marginBottom: 6 }}>Mã lớp</div>
                        <div style={{ padding: '5px 0' }}>
                          <Badge variant="default" size="sm" shape="rounded">{viewingSheetRow.normalizedClassCode}</Badge>
                        </div>
                     </div>
                     {extractedCentre && (
                        <div>
                           <div style={{ fontSize: 11, fontWeight: 590, color: 'var(--text-quaternary)', textTransform: 'uppercase', marginBottom: 6 }}>Cơ sở Khai báo</div>
                           <div style={{ padding: '5px 0' }}>
                             <CentreBadge name={extractedCentre} />
                           </div>
                        </div>
                     )}
                     {extractedCourse && (
                        <div>
                           <div style={{ fontSize: 11, fontWeight: 590, color: 'var(--text-quaternary)', textTransform: 'uppercase', marginBottom: 6 }}>Bộ môn</div>
                           <div style={{ padding: '5px 0' }}>
                             <CourseCategoryBadge category={extractedCourse} />
                           </div>
                        </div>
                     )}
                     <div>
                        <div style={{ fontSize: 11, fontWeight: 590, color: 'var(--text-quaternary)', textTransform: 'uppercase', marginBottom: 6 }}>Điểm trung bình</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: surveyColor(viewingSheetRow.avgScore), padding: '2px 0' }}>
                          ★ {viewingSheetRow.avgScore?.toFixed(1)}
                        </div>
                     </div>
                  </div>

                  {/* Standard QA Matrix utilizing purified data subset */}
                  <div style={{ padding: '0 20px 20px' }}>
                     <div style={{ marginBottom: 12, fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', borderBottom: '1px solid var(--border-primary)', paddingBottom: 8 }}>
                        Nội dung khảo sát
                     </div>
                     <div className={styles.tableScrollWrapper}>
                        <table className={styles.studentTable}>
                           <thead>
                              <tr>
                                 <th style={{ width: '15%', paddingLeft: 12 }}>Chủ đề</th>
                                 <th style={{ width: '35%' }}>Câu hỏi</th>
                                 <th style={{ width: '50%' }}>Câu trả lời</th>
                              </tr>
                           </thead>
                           <tbody>
                              {Object.entries(rowData).map(([k, v]) => {
                                 // Strictly quarantine content: enforce 100% exclusion for non-whitelisted keys
                                 if (!isExplicitlyTargetedQuestion(k)) return null;
                                 
                                 const valStr = String(v || '');
                                 const numericVal = parseFloat(valStr);
                                 const isStarRating = !isNaN(numericVal) && numericVal > 0 && numericVal <= 6 && valStr.length <= 3;

                                 return (
                                    <tr key={k} style={{ cursor: 'default' }}>
                                       <td style={{ paddingLeft: 12 }}>
                                          <TopicBadge topic={getLmsGroup(k)} size="sm" />
                                       </td>
                                       <td>
                                          <div style={{ fontSize: 13, fontWeight: 510, color: 'var(--text-primary)', lineHeight: 1.4, wordBreak: 'break-word' }}>
                                             {k}
                                          </div>
                                       </td>
                                       <td>
                                          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                                             {isStarRating ? (
                                                <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 14 }}>★ {numericVal.toFixed(1)}</span>
                                             ) : (
                                                valStr || <span style={{ color: 'var(--text-quaternary)', fontStyle: 'italic' }}>Chưa trả lời</span>
                                             )}
                                          </div>
                                       </td>
                                    </tr>
                                 )
                              })}
                           </tbody>
                        </table>
                     </div>
                  </div>
               </div>
             </>
           )
        })()}
      </Modal>

      {/* ── TICKET MODAL ── */}
      {selectedEntry && editDraft && (
        <Modal open={true} onClose={() => { setSelectedTicketId(null); setEditDraft(null); }}>
          {(() => {
            const selectStyle: React.CSSProperties = {
              fontSize: 13, fontWeight: 510, color: 'var(--text-primary)',
              background: 'var(--bg-surface)', border: '1px solid var(--border-primary)',
              borderRadius: "var(--radius-comfortable)", padding: '6px 10px', width: '100%', cursor: 'pointer',
              outline: 'none',
            };
            return (
              <>
                <ModalHeader
                  title={selectedEntry.title || selectedEntry.ticketCode || 'Phiếu đánh giá'}
                  subtitle={`${selectedEntry.courseCategory} — ${selectedEntry.ticketSource?.className || ''} · ${selectedEntry.ticketSource?.centre?.shortName || ''}`}
                onClose={() => { setSelectedTicketId(null); setEditDraft(null); }}
              />

              {/* Body */}
              <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>

                {/* Edit Form */}
                <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
                  {/* Status */}
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 590, color: 'var(--text-quaternary)', textTransform: 'uppercase', marginBottom: 6 }}>Trạng thái</div>
                    <CompactSelect
                      value={editDraft.status}
                      options={statusOptions.map(o => ({ value: o.value, label: o.value }))}
                      onChange={v => setEditDraft(d => d ? { ...d, status: v } : d)}
                    />
                  </div>
                  {/* Priority */}
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 590, color: 'var(--text-quaternary)', textTransform: 'uppercase', marginBottom: 6 }}>Mức độ</div>
                    <CompactSelect
                      value={editDraft.priority}
                      options={priorityEnumOptions.map(o => ({ value: o.value, label: o.value }))}
                      onChange={v => setEditDraft(d => d ? { ...d, priority: v } : d)}
                    />
                  </div>
                  {/* Feedback Topic */}
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 590, color: 'var(--text-quaternary)', textTransform: 'uppercase', marginBottom: 6 }}>Chủ đề</div>
                    <CompactSelect
                      value={editDraft.feedbackTopic}
                      options={feedbackTopicEnumOptions.map(o => ({ value: o.value, label: o.value }))}
                      onChange={v => setEditDraft(d => d ? { ...d, feedbackTopic: v } : d)}
                    />
                  </div>
                  {/* Student Info (read-only) */}
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 590, color: 'var(--text-quaternary)', textTransform: 'uppercase', marginBottom: 6 }}>Học viên</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', padding: '7px 0' }}>
                      {selectedEntry.ticketSource?.studentName || selectedEntry.ticketSource?.studentId || 'Ẩn danh'}
                    </div>
                  </div>
                </div>

                {/* Assignee Search - Using UserSearchInput component */}
                <div style={{ padding: '0 20px 16px' }}>
                  <div style={{ fontSize: 11, fontWeight: 590, color: 'var(--text-quaternary)', textTransform: 'uppercase', marginBottom: 6 }}>Phân công xử lý (Assignee)</div>
                  <UserSearchInput
                    value={userSearch}
                    onChange={handleAssigneeInputChange}
                    onSelect={(user) => {
                      setEditDraft(d => d ? { ...d, assigneeId: user.id, assigneeName: user.displayName || user.username || '' } : d);
                      setUserSearch('');
                    }}
                    onClear={() => {
                      setEditDraft(d => d ? { ...d, assigneeId: '', assigneeName: '' } : d);
                      setUserResults([]);
                      setUserSearch('');
                    }}
                    results={userResults}
                    loading={userSearchLoading}
                    placeholder="Tìm kiếm theo tên hoặc email..."
                    selectedUserName={editDraft.assigneeName && !userSearch ? editDraft.assigneeName : undefined}
                  />
                </div>

                {/* QA List - Simple pattern */}
                <div style={{ padding: '0 20px 20px' }}>
                  <div style={{ marginBottom: 12, fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', borderBottom: '1px solid var(--border-primary)', paddingBottom: 8 }}>Nội dung khảo sát</div>
                  {(() => {
                    if (modalSurveyData.length === 0) {
                      return <div style={{ fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center', padding: '16px' }}>Không có câu hỏi nào trong phiếu này.</div>;
                    }
                    return (
                      <div className={styles.tableScrollWrapper}>
                        <table className={styles.studentTable}>
                          <thead>
                            <tr>
                              <SortableHeader label="Chủ đề" sortKey="group" currentSortKey={modalSurveySortBy} sortOrder={modalSurveySortOrder} onSort={(key) => handleModalSurveySort(key as ModalSurveySortKey)} style={{ width: '15%' }} />
                              <SortableHeader label="Câu hỏi" sortKey="title" currentSortKey={modalSurveySortBy} sortOrder={modalSurveySortOrder} onSort={(key) => handleModalSurveySort(key as ModalSurveySortKey)} style={{ width: '35%' }} />
                              <SortableHeader label="Câu trả lời" sortKey="answer" currentSortKey={modalSurveySortBy} sortOrder={modalSurveySortOrder} onSort={(key) => handleModalSurveySort(key as ModalSurveySortKey)} style={{ width: '50%' }} />
                            </tr>
                          </thead>
                          <tbody>
                            {sortedModalSurvey.map(q => (
                              <tr key={q.id}>
                                <td>
                                  <TopicBadge topic={q.group} />
                                </td>
                                <td>
                                  <div style={{ fontSize: 13, fontWeight: 510, color: 'var(--text-primary)' }}>{q.title}</div>
                                  {q.description && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 'var(--space-1)' }}>{q.description}</div>}
                                </td>
                                <td>
                                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                                    {q.answer || <span style={{ color: 'var(--text-quaternary)', fontStyle: 'italic' }}>Chưa có câu trả lời</span>}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Footer — Save / Cancel */}
              <ModalFooter
                secondaryButton={{
                  label: 'Huỷ',
                  onClick: () => openEditForTicket(selectedEntry as any),
                  variant: 'secondary',
                  disabled: savingTicket,
                }}
                primaryButton={{
                  label: 'Lưu thay đổi',
                  onClick: () => handleSaveTicket(selectedEntry.id),
                  variant: 'primary',
                  loading: savingTicket,
                  loadingText: 'Đang lưu...',
                }}
              />
            </>
          );
        })()}
        </Modal>
      )}

      {/* ── BULK UPDATE MODAL ── */}
      <Modal open={showBulkModal} onClose={() => { setShowBulkModal(false); }}>
        <ModalHeader
          title={`Cập nhật hàng loạt - ${selectedTicketIds.size} phiếu`}
          subtitle="Chọn các trường cần cập nhật (có thể chọn nhiều trường cùng lúc)"
          onClose={() => { setShowBulkModal(false); }}
        />
        <div style={{ padding: '20px', minHeight: 300 }}>
          <div style={{ display: 'grid', gap: 20 }}>
            
            {/* Status */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 590, color: 'var(--text-primary)', marginBottom: 8 }}>
                Trạng thái
              </label>
              <CompactSelect
                value={bulkUpdates.status}
                options={[
                  { value: '', label: '-- Không thay đổi --' },
                  { value: 'NEW', label: 'NEW' },
                  { value: 'ASSIGNED', label: 'ASSIGNED' },
                  { value: 'IN_PROGRESS', label: 'IN_PROGRESS' },
                  { value: 'RESOLVED', label: 'RESOLVED' },
                  { value: 'CLOSED', label: 'CLOSED' }
                ]}
                onChange={v => setBulkUpdates(prev => ({ ...prev, status: v }))}
              />
            </div>

            {/* Priority */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 590, color: 'var(--text-primary)', marginBottom: 8 }}>
                Mức độ ưu tiên
              </label>
              <CompactSelect
                value={bulkUpdates.priority}
                options={[
                  { value: '', label: '-- Không thay đổi --' },
                  { value: 'LOW', label: 'LOW' },
                  { value: 'MEDIUM', label: 'MEDIUM' },
                  { value: 'HIGH', label: 'HIGH' },
                  { value: 'URGENT', label: 'URGENT' }
                ]}
                onChange={v => setBulkUpdates(prev => ({ ...prev, priority: v }))}
              />
            </div>

            {/* Feedback Topic */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 590, color: 'var(--text-primary)', marginBottom: 8 }}>
                Chủ đề phản hồi
              </label>
              <CompactSelect
                value={bulkUpdates.feedbackTopic}
                options={[
                  { value: '', label: '-- Không thay đổi --' },
                  { value: 'TEACHER', label: 'TEACHER' },
                  { value: 'DOCUMENT', label: 'DOCUMENT' },
                  { value: 'EQUIPMENT', label: 'EQUIPMENT' },
                  { value: 'OPERATION', label: 'OPERATION' },
                  { value: 'OTHER', label: 'OTHER' }
                ]}
                onChange={v => setBulkUpdates(prev => ({ ...prev, feedbackTopic: v }))}
              />
            </div>

            {/* Assignee */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 590, color: 'var(--text-primary)', marginBottom: 8 }}>
                Người xử lý
              </label>
              <UserSearchInput
                value={bulkAssigneeSearch}
                onChange={handleBulkAssigneeInputChange}
                onSelect={(user) => {
                  setBulkUpdates(prev => ({ 
                    ...prev, 
                    assigneeId: user.id, 
                    assigneeName: user.displayName || user.username || ''
                  }));
                  setBulkAssigneeSearch('');
                }}
                onClear={() => {
                  setBulkUpdates(prev => ({ ...prev, assigneeId: '', assigneeName: '' }));
                  setBulkAssigneeSearch('');
                }}
                results={bulkAssigneeResults}
                loading={false}
                placeholder="Tìm kiếm theo tên hoặc email..."
                selectedUserName={bulkUpdates.assigneeName && !bulkAssigneeSearch ? bulkUpdates.assigneeName : undefined}
              />
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6 }}>
                Để trống nếu không muốn thay đổi người xử lý
              </div>
            </div>

          </div>
        </div>

        {/* Footer */}
        <ModalFooter
          secondaryButton={{
            label: 'Huỷ',
            onClick: () => { setShowBulkModal(false); },
            variant: 'secondary',
            disabled: bulkSaving,
          }}
          primaryButton={{
            label: `Cập nhật ${selectedTicketIds.size} phiếu`,
            onClick: handleApplyBulkUpdates,
            variant: 'primary',
            loading: bulkSaving,
            loadingText: 'Đang cập nhật...',
          }}
        />
      </Modal>
      </>
    </ProtectedPage>
  );
}
