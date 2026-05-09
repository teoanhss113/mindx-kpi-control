'use client';

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import { useAuth } from '@/lib/AuthContext';
import { loadSession } from '@/services/authService';
import { fetchAllCentres, Centre } from '@/services/centresService';
import { getCache, setCache, clearCache } from '@/lib/idb';
import { getCourseCategory } from '@/lib/courseCategories';
import { getNavItemsWithRouter } from '@/lib/navigation';
import { useAllowedPages } from '@/hooks/useAllowedPages';
import { surveyColor, KPI_COLORS, SURVEY_LEGEND } from '@/lib/kpiScoring';
import { fetchTickets, updateTicket, searchUsers } from '@/services/ticketService';
import { Ticket, LmsUser } from '@/types/ticket';
import {
  Icon, SortIcon, MultiSelect, SelectOption, CompactSelect,
  Toolbar, StatCard, ChartSectionHeader,
  TableToolbar, TableGroupHeader, AdminTableSection, Modal, ModalHeader, EmptyState,
  ViewModeToggle,
  initials,
  ToastContainer,
  useToast,
  StandardXAxis, StandardYAxisCategory, ChartLegend, VerticalBarChartConfig, CustomTooltip,
  SortableHeader, TopicBadge, UserSearchInput, type UserSearchResult, ModalFooter,
  CentreSelect, CourseCategoryBadge, QuickFilterChips, TicketStatusBadge, FilterChip, KPIThresholdSuggestions, getPriorityMeta, getTicketStatusMeta,
} from '@/components/ui';
import { useTableSort } from '@/hooks/useTableSort';
import { useFilterOptions } from '@/hooks/useFilterOptions';
import { useQuickFilterChips } from '@/hooks/useUserPreferences';
import { PageLayout } from '@/components/PageLayout';
import { CACHE_KEYS, LABELS, MESSAGES, ENTITIES, FORMAT, CHART_COLORS, TICKET_LABELS } from '@/constants';
import { useSharedDateRange, useSharedCentres } from '@/hooks/useSharedFilterState';
import styles from '@/app/dashboard.module.css';

// ─── Constants ────────────────────────────────────────────────────────────────
const SURVEY_TARGETS = [
  { value: 4.0, label: '4.0' },
  { value: 4.5, label: '4.5' },
  { value: 4.8, label: '> 4.7' },
];

function getPriorityColor(priority: string) {
  return getPriorityMeta(priority).color;
}

function getStatusColor(status: string) {
  return getTicketStatusMeta(status).color;
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
  const [loading, setLoading] = useState(false);
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
  const [search, setSearch] = useState('');

  // ── Layout states ──────────────────────────────────────────────────────────
  const [showActiveTable, setShowActiveTable] = useState(true);
  const [quickFilter, setQuickFilter] = useState<string | null>(null);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  const [sortKey, setSortKey] = useState<'title' | 'centre' | 'status' | 'createdAt'>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // ── View Mode: 'list' | 'by-class' | 'by-teacher' ──
  const [viewMode, setViewMode] = useState<'list' | 'by-class' | 'by-teacher'>('list');
  
  // Sort state for by-class view
  const [classSortBy, setClassSortBy] = useState<'className' | 'count' | 'students' | 'avgScore'>('avgScore');
  const [classSortOrder, setClassSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // ── Modal states for grouped views ──
  const [selectedClassForModal, setSelectedClassForModal] = useState<{ className: string; tickets: typeof filteredTickets } | null>(null);

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
    if (!start || !end) return;
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;

    setLoading(true);
    setProgress({ loaded: 0, total: 100 });
    setTickets([]);
    
    let curTickets: Ticket[] = [];
    let _centres = centres;

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

      const res = await fetchTickets({
        createdAt_gte: dStart.toISOString(),
        createdAt_lte: dEnd.toISOString(),
        centreId_in: selectedCentres.length > 0 ? selectedCentres : [],
      }, (loaded, total, chunk) => {
        setProgress({ loaded, total: total || Math.max(loaded, 1) });
        curTickets = [...curTickets, ...chunk];
        setTickets([...curTickets]);
      }, signal);

      if (!signal.aborted) {
        await setCache(CACHE_KEYS.TICKETS, { tickets: res.data, timestamp: Date.now() });
        addToast(MESSAGES.LOADING.SUCCESS(res.data.length, ENTITIES.TICKETS), 'success');
      }
    } catch (err: any) {
      if (!signal.aborted) {
        console.error(err);
        addToast(MESSAGES.ERROR.GENERIC, 'error');
      }
    } finally {
      if (!signal.aborted) {
        setLoading(false);
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

      addToast(`Đã cập nhật ${selectedTicketIds.size} phiếu`, 'success');
      setSelectedTicketIds(new Set());
      setShowBulkModal(false);
    } catch (err) {
      addToast('Có lỗi xảy ra khi cập nhật hàng loạt', 'error');
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
      const courseCategory = getCourseCategory({ name: t.ticketSource?.className || '' });
      
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

    return tickets.map(processTicket);
  }, [tickets]);

  const courseLineOptions = useFilterOptions(mappedTickets, (t) => t.courseCategory);

  // tableCentreIds: only centre IDs that appear in the loaded tickets (for table-level filtering)
  const tableCentreIds = useMemo(() => {
    const ids = new Set<string>();
    mappedTickets.forEach(t => {
      if (t.ticketSource?.centreId) ids.add(t.ticketSource.centreId);
    });
    return Array.from(ids);
  }, [mappedTickets]);

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
    let list = baseFilteredTickets;
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
  const groupedByClass = useMemo(() => {
    const groups = new Map<string, typeof filteredTickets>();
    filteredTickets.forEach(t => {
      const key = t.ticketSource?.className || 'Không xác định';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(t);
    });
    return Array.from(groups.entries())
      .map(([className, tickets]) => {
        const avgScores = tickets.map(t => {
          const teacherScore = (t as any)._groupScores?.find((gs: any) => {
            const gName = gs.group.toUpperCase();
            return gName.includes('TEACHER') || gName.includes('GIÁO VIÊN') || gName === 'GV';
          });
          return teacherScore ? parseFloat(teacherScore.avg) : null;
        }).filter(s => s !== null) as number[];
        const avgScore = avgScores.length > 0 ? avgScores.reduce((a, b) => a + b, 0) / avgScores.length : 0;
        return { className, tickets, avgScore, count: tickets.length };
      })
      .sort((a, b) => b.count - a.count);
  }, [filteredTickets]);

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
    return questions.map(q => {
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
          hasData={tickets.length > 0}
          onClearCache={() => { setTickets([]); clearCache(CACHE_KEYS.TICKETS); }}
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

          {/* ── KPI Stats ── */}
          {(stats.total > 0 || loading) && (
            <motion.div className={styles.statsGrid} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <StatCard label={TICKET_LABELS.AVG_SCORE_GV} value={stats.avgScore > 0 ? `★ ${stats.avgScore}` : '—'} desc={`Trên ${stats.scoredTickets} phiếu đánh giá giáo viên`} valueColor={stats.avgScore > 0 ? surveyColor(stats.avgScore) : undefined} delay={0.0} />
              <StatCard label={TICKET_LABELS.TOTAL_TICKETS_STAT} value={String(stats.total)} desc="Phiếu phản hồi trong kỳ" delay={0.07} />
              <StatCard label={TICKET_LABELS.NEW_TICKETS_STAT} value={String(stats.newTickets)} desc="Chưa xử lý" valueColor={stats.newTickets > 0 ? 'var(--status-emerald)' : undefined} delay={0.14} />
              <StatCard label={TICKET_LABELS.RESOLVE_RATE_STAT} value={`${stats.resolveRate.toFixed(1)}%`} desc={`${stats.closedTickets} đã xử lý`} valueColor={stats.resolveRate >= 90 ? 'var(--status-success)' : 'var(--status-warning)'} delay={0.21} />
            </motion.div>
          )}

          {stats.total > 0 && (
            <KPIThresholdSuggestions
              label="Điểm GV:"
              items={surveySuggestions}
            />
          )}

          {/* CHARTS */}
          {mappedTickets.length > 1 && (centreChartData.length > 0 || courseLineChartData.length > 0) && (
            <div className={styles.chartsSection}>
              <ChartSectionHeader
                title="Biểu Đồ Phân Tích"
              />
              <div className={styles.chartsGrid}>
                
                {/* Chart 1: Số phiếu theo Cơ sở */}
                {centreChartData.length > 0 && (
                  <div className={styles.chartCard}>
                    <div className={styles.chartTitle}>{TICKET_LABELS.TICKETS_BY_CENTRE}</div>
                    <div style={{ flex: 1, minHeight: 0 }}>
                      <ResponsiveContainer width="100%" height={Math.max(200, centreChartData.length * 32)}>
                        <BarChart data={centreChartData} {...VerticalBarChartConfig}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" horizontal={false} />
                          <StandardXAxis label="Số phiếu" />
                          <StandardYAxisCategory dataKey="name" label="Cơ sở" />
                          <ReTooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
                          <Bar dataKey="Số phiếu" fill={CHART_COLORS.SECONDARY[0]} radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* Chart 2: Điểm TB (GV) theo Cơ sở - Line Chart */}
                {centreChartData.length > 0 && (
                  <div className={styles.chartCard}>
                    <div className={styles.chartTitle}>Điểm Trung Bình Giáo Viên Theo Cơ Sở</div>
                    <div style={{ flex: 1, minHeight: 0 }}>
                      <ResponsiveContainer width="100%" height={Math.max(200, centreChartData.length * 32)}>
                        <BarChart data={centreChartData} {...VerticalBarChartConfig}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" horizontal={false} />
                          <StandardXAxis label="Điểm (1-5)" domain={[0, 5]} ticks={[0, 1, 2, 3, 4, 5]} />
                          <StandardYAxisCategory dataKey="name" label="Cơ sở" />
                          <ReTooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
                          <Bar dataKey="Điểm TB (GV)" radius={[0, 4, 4, 0]}>
                            {centreChartData.map((entry, index) => {
                              const score = entry['Điểm TB (GV)'];
                              return <Cell key={`cell-${index}`} fill={surveyColor(score)} />;
                            })}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <ChartLegend items={SURVEY_LEGEND.map(l => ({
                      color: KPI_COLORS[l.score],
                      label: l.label,
                    }))} />
                  </div>
                )}

                {/* Chart 3: Số phiếu theo Khối */}
                {courseLineChartData.length > 0 && (
                  <div className={styles.chartCard}>
                    <div className={styles.chartTitle}>{TICKET_LABELS.TICKETS_BY_COURSE_LINE}</div>
                    <div style={{ flex: 1, minHeight: 0 }}>
                      <ResponsiveContainer width="100%" height={Math.max(200, courseLineChartData.length * 40)}>
                        <BarChart data={courseLineChartData} {...VerticalBarChartConfig}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" horizontal={false} />
                          <StandardXAxis label="Số phiếu" />
                          <StandardYAxisCategory dataKey="name" label="Khối học" />
                          <ReTooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
                          <Bar dataKey="Số phiếu" fill={CHART_COLORS.SECONDARY[0]} radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* Chart 4: Điểm TB (GV) theo Khối - Line Chart */}
                {courseLineChartData.length > 0 && (
                  <div className={styles.chartCard}>
                    <div className={styles.chartTitle}>Điểm Trung Bình Giáo Viên Theo Khối</div>
                    <div style={{ flex: 1, minHeight: 0 }}>
                      <ResponsiveContainer width="100%" height={Math.max(200, courseLineChartData.length * 40)}>
                        <BarChart data={courseLineChartData} {...VerticalBarChartConfig}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" horizontal={false} />
                          <StandardXAxis label="Điểm (1-5)" domain={[0, 5]} ticks={[0, 1, 2, 3, 4, 5]} />
                          <StandardYAxisCategory dataKey="name" label="Khối học" />
                          <ReTooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
                          <Bar dataKey="Điểm TB (GV)" radius={[0, 4, 4, 0]}>
                            {courseLineChartData.map((entry, index) => {
                              const score = entry['Điểm TB (GV)'];
                              return <Cell key={`cell-${index}`} fill={surveyColor(score)} />;
                            })}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <ChartLegend items={SURVEY_LEGEND.map(l => ({
                      color: KPI_COLORS[l.score],
                      label: l.label,
                    }))} />
                  </div>
                )}
              </div>
            </div>
          )}

        {/* View Mode Toggle — Outside and above the panel for consistency */}
        {(mappedTickets.length > 0 || loading) && (
          <div style={{ marginTop: 'var(--space-6)' }}>
            <ViewModeToggle
              value={viewMode}
              onChange={setViewMode}
              options={[
                { value: 'list', label: TICKET_LABELS.LIST_VIEW, icon: <Icon.Table /> },
                { value: 'by-class', label: TICKET_LABELS.CLASS_ANALYSIS_VIEW, icon: <Icon.PieChart /> },
              ]}
            />          </div>
        )}

        <div id="section-entries">
            {/* ── Table Section ── */}
            {(stats.total > 0 || loading || tickets.length > 0) && (
              <AdminTableSection
                title={viewMode === 'list' ? TICKET_LABELS.TICKET_LIST : TICKET_LABELS.CLASS_ANALYSIS}
                count={viewMode === 'list' ? filteredTickets.length : groupedByClass.length}
                loading={loading}
                progress={progress}
                isExpanded={showActiveTable}
                onToggle={() => setShowActiveTable(p => !p)}
                toolbarSlot={(mappedTickets.length > 0 || loading) ? (
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
                                      <span key={gs.group} title={gs.group} style={{ color, background: bg, padding: '2px 6px', borderRadius: "var(--radius-comfortable)", fontSize: 11, fontWeight: 600 }}>
                                        {gs.group}: ★ {gs.avg}
                                      </span>
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
                    )}

                    {/* BY CLASS VIEW */}
                    {viewMode === 'by-class' && (
                      <div className={styles.tableScrollWrapper}>
                        {/* Table Header */}
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'minmax(0, 2.5fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.2fr)',
                          padding: '7px 16px',
                          borderBottom: '1px solid var(--border-primary)',
                          fontSize: 11,
                          fontWeight: 590,
                          color: 'var(--text-quaternary)',
                          letterSpacing: '0.04em',
                          textTransform: 'uppercase',
                          background: 'var(--bg-elevated)',
                          minWidth: 700
                        }}>
                          <div
                            className={`${styles.sortableCol} ${classSortBy === 'className' ? styles.activeSort : ''}`}
                            onClick={() => handleClassSort('className')}
                            style={{ display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer', userSelect: 'none' }}
                          >
                            Lớp học
                            {classSortBy === 'className' ? (
                              classSortOrder === 'asc' ? (
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="18 15 12 9 6 15" /></svg>
                              ) : (
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
                              )
                            ) : (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="17 11 12 6 7 11" /><polyline points="17 18 12 13 7 18" /></svg>
                            )}
                          </div>
                          <div
                            className={`${styles.sortableCol} ${classSortBy === 'count' ? styles.activeSort : ''}`}
                            onClick={() => handleClassSort('count')}
                            style={{ display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer', userSelect: 'none' }}
                          >
                            Số phiếu
                            {classSortBy === 'count' ? (
                              classSortOrder === 'asc' ? (
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="18 15 12 9 6 15" /></svg>
                              ) : (
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
                              )
                            ) : (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="17 11 12 6 7 11" /><polyline points="17 18 12 13 7 18" /></svg>
                            )}
                          </div>
                          <div
                            className={`${styles.sortableCol} ${classSortBy === 'students' ? styles.activeSort : ''}`}
                            onClick={() => handleClassSort('students')}
                            style={{ display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer', userSelect: 'none' }}
                          >
                            Học viên
                            {classSortBy === 'students' ? (
                              classSortOrder === 'asc' ? (
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="18 15 12 9 6 15" /></svg>
                              ) : (
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
                              )
                            ) : (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="17 11 12 6 7 11" /><polyline points="17 18 12 13 7 18" /></svg>
                            )}
                          </div>
                          <div
                            className={`${styles.sortableCol} ${classSortBy === 'avgScore' ? styles.activeSort : ''}`}
                            onClick={() => handleClassSort('avgScore')}
                            style={{ display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer', userSelect: 'none' }}
                          >
                            Điểm TB (GV)
                            {classSortBy === 'avgScore' ? (
                              classSortOrder === 'asc' ? (
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="18 15 12 9 6 15" /></svg>
                              ) : (
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
                              )
                            ) : (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="17 11 12 6 7 11" /><polyline points="17 18 12 13 7 18" /></svg>
                            )}
                          </div>
                          <div>Trạng thái</div>
                        </div>

                        {/* Table Rows */}
                        {groupedByClass
                          .map(group => {
                            const uniqueStudents = new Set(group.tickets.map(t => t.ticketSource?.studentId || t.ticketSource?.studentName)).size;
                            return { ...group, uniqueStudents };
                          })
                          .sort((a, b) => {
                            let comparison = 0;
                            
                            if (classSortBy === 'className') {
                              comparison = a.className.localeCompare(b.className);
                            } else if (classSortBy === 'count') {
                              comparison = a.count - b.count;
                            } else if (classSortBy === 'students') {
                              comparison = a.uniqueStudents - b.uniqueStudents;
                            } else if (classSortBy === 'avgScore') {
                              comparison = a.avgScore - b.avgScore;
                            }
                            
                            return classSortOrder === 'asc' ? comparison : -comparison;
                          })
                          .map((group) => {
                          // Count status
                          const newCount = group.tickets.filter(t => t.status === 'NEW').length;
                          const closedCount = group.tickets.filter(t => t.status === 'CLOSED').length;
                          
                          return (
                            <div
                              key={group.className}
                              style={{
                                display: 'grid',
                                gridTemplateColumns: 'minmax(0, 2.5fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.2fr)',
                                padding: '10px 16px',
                                borderBottom: '1px solid var(--border-primary)',
                                alignItems: 'center',
                                transition: 'background 0.1s ease',
                                cursor: 'pointer',
                                background: 'var(--bg-surface)',
                                minWidth: 700
                              }}
                              onClick={() => setSelectedClassForModal({ className: group.className, tickets: group.tickets })}
                              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)'}
                              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-surface)'}
                            >
                              {/* Class Name */}
                              <div style={{ fontSize: 13, fontWeight: 510, color: 'var(--text-primary)' }}>
                                {group.className}
                              </div>

                              {/* Số phiếu */}
                              <div style={{ fontSize: 15, fontWeight: 590, color: 'var(--text-primary)' }}>
                                {group.count}
                              </div>

                              {/* Học viên */}
                              <div style={{ fontSize: 15, fontWeight: 590, color: 'var(--text-primary)' }}>
                                {group.uniqueStudents}
                              </div>

                              {/* Điểm TB (GV) */}
                              <div style={{ 
                                fontSize: 18, 
                                fontWeight: 590, 
                                color: group.avgScore > 0 ? surveyColor(group.avgScore) : 'var(--text-quaternary)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4
                              }}>
                                <span>★</span>
                                <span>{group.avgScore > 0 ? group.avgScore.toFixed(1) : '—'}</span>
                              </div>

                              {/* Trạng thái */}
                              <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                                {newCount > 0 && (
                                  <span style={{
                                    fontSize: 11,
                                    fontWeight: 600,
                                    color: 'var(--status-emerald)',
                                    background: 'rgba(16, 185, 129, 0.15)',
                                    padding: '2px 8px',
                                    borderRadius: "var(--radius-standard)",
                                    border: '1px solid rgba(16, 185, 129, 0.4)'
                                  }}>
                                    {newCount} mới
                                  </span>
                                )}
                                {closedCount > 0 && (
                                  <span style={{
                                    fontSize: 11,
                                    fontWeight: 600,
                                    color: 'var(--text-tertiary)',
                                    background: 'rgba(0, 0, 0, 0.04)',
                                    padding: '2px 8px',
                                    borderRadius: "var(--radius-standard)",
                                    border: '1px solid var(--border-secondary)'
                                  }}>
                                    {closedCount} đã xử lý
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}

                        {groupedByClass.length === 0 && (
                          <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--text-quaternary)', fontSize: 13 }}>
                            Không có dữ liệu để hiển thị.
                          </div>
                        )}
                      </div>
                    )}
            </AdminTableSection>
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

      {/* ── CLASS STUDENTS MODAL (By Class View) ── */}
      <Modal open={!!selectedClassForModal} onClose={() => setSelectedClassForModal(null)}>
        {selectedClassForModal && (() => {
          // Group tickets by student
          const studentGroups = new Map<string, typeof selectedClassForModal.tickets>();
          selectedClassForModal.tickets.forEach(t => {
            const studentKey = t.ticketSource?.studentId || t.ticketSource?.studentName || 'unknown';
            if (!studentGroups.has(studentKey)) {
              studentGroups.set(studentKey, []);
            }
            studentGroups.get(studentKey)!.push(t);
          });
          
          return (
            <>
              <ModalHeader
                title={`${selectedClassForModal.className}`}
                subtitle={`${studentGroups.size} học viên • ${selectedClassForModal.tickets.length} phiếu đánh giá`}
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
                    {Array.from(studentGroups.entries()).map(([studentKey, tickets]) => {
                      const studentName = tickets[0].ticketSource?.studentName || 'Học viên';
                      
                      return tickets.map((t, idx) => {
                        const teacherScore = (t as any)._groupScores?.find((gs: any) => {
                          const gName = gs.group.toUpperCase();
                          return gName.includes('TEACHER') || gName.includes('GIÁO VIÊN') || gName === 'GV';
                        });
                        const score = teacherScore ? parseFloat(teacherScore.avg) : null;
                        
                        return (
                          <tr key={t.id} 
                            onClick={() => { setSelectedTicketId(t.id); openEditForTicket(t as any); setSelectedClassForModal(null); }}
                            style={{ cursor: 'pointer' }}>
                            {idx === 0 && (
                              <td rowSpan={tickets.length} style={{ fontWeight: 510 }}>
                                {studentName}
                                {tickets.length > 1 && (
                                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
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
                              <TicketStatusBadge status={t.status} />
                            </td>
                            <td style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                              {t.ticketCode || '—'}
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
                                      <span key={gs.group} style={{ 
                                        color, 
                                        background: bg, 
                                        padding: '2px 6px', 
                                        borderRadius: "var(--radius-standard)", 
                                        fontSize: 10, 
                                        fontWeight: 600,
                                        whiteSpace: 'nowrap'
                                      }}>
                                        {gs.group}: ★{gs.avg}
                                      </span>
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

      </PageLayout>
    </>
  );
}
