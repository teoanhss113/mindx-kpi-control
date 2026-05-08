'use client';

import { useState, useEffect, useMemo } from 'react';
import { AuthenticatedPage } from '@/components/AuthenticatedPage';
import { UserLayout } from '@/components/UserLayout';
import { useAuth } from '@/lib/AuthContext';
import { useToast, ToastContainer, Toolbar, TableGroupHeader, EmptyState, Modal, ModalHeader } from '@/components/ui';
import { getTeacherConfirmations, confirmOfficeHour, rejectOfficeHour } from '@/lib/teacher-confirmation-actions';
import { createShiftRequest, hasRequestedShift } from '@/lib/shift-request-actions';
import { fetchOfficeHours, searchTeachers, type Teacher } from '@/services/officeHoursService';
import type { TeacherConfirmation } from '@/lib/teacher-confirmation-actions';
import type { OfficeHour } from '@/types/officeHours';
import { getOfficeHourCategory } from '@/lib/courseCategories';
import { OfficeHourDetailsView } from '@/components/OfficeHourDetailsView';
import { MESSAGES } from '@/constants';
import { motion, AnimatePresence } from 'framer-motion';
import styles from '@/app/dashboard.module.css';

const DOW_VI = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
const CATEGORY_ORDER: Record<string, number> = { Coding: 0, Robotics: 1, Art: 2, Others: 3 };
const SESSION_ORDER: Record<string, number> = { 'Sáng': 0, 'Chiều': 1, 'Tối': 2 };

// Category palette — matches the convention used in /admin/teacher-schedule:
// Coding → emerald, Robotics → indigo, Art → amber.
const CATEGORY_STYLES: Record<string, React.CSSProperties> = {
  Coding:   { background: 'rgba(5, 150, 105, 0.10)',  color: '#047857', borderLeft: '3px solid var(--status-emerald, #059669)' },
  Robotics: { background: 'rgba(94, 106, 210, 0.10)', color: '#1e40af', borderLeft: '3px solid var(--brand-indigo)' },
  Art:      { background: 'rgba(217, 119, 6, 0.10)',  color: '#b45309', borderLeft: '3px solid var(--status-warning, #d97706)' },
  Others:   { background: 'var(--bg-secondary)',      color: 'var(--text-secondary)', borderLeft: '3px solid var(--border)' },
};

function vnDateParts(iso: string) {
  const d = new Date(iso);
  const v = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
  return { year: v.getFullYear(), month: v.getMonth() + 1, day: v.getDate(), dow: v.getDay() };
}

function dateKey(iso: string) {
  const p = vnDateParts(iso);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

function dateLabelParts(iso: string): { dow: string; ymd: string } {
  const p = vnDateParts(iso);
  return {
    dow: DOW_VI[p.dow],
    ymd: `${String(p.day).padStart(2, '0')}/${String(p.month).padStart(2, '0')}/${p.year}`,
  };
}

function sessionLabel(endIso: string): 'Sáng' | 'Chiều' | 'Tối' {
  const h = parseInt(
    new Intl.DateTimeFormat('vi-VN', { hour: 'numeric', timeZone: 'Asia/Ho_Chi_Minh', hour12: false }).format(new Date(endIso)),
    10,
  );
  if (h <= 12) return 'Sáng';
  if (h <= 18) return 'Chiều';
  return 'Tối';
}

interface OfficeHourWithConfirmation {
  officeHour: OfficeHour;
  confirmation: TeacherConfirmation | null;
  isAssignedToMe: boolean;
  hasConfirmedTeacher?: boolean;
  hasMyRequest?: boolean;
}

export default function AvailableShiftsPage() {
  const { session } = useAuth();
  const { toasts, addToast, removeToast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ loaded: 0, total: 0 });
  const [officeHours, setOfficeHours] = useState<OfficeHourWithConfirmation[]>([]);
  const [teacherInfo, setTeacherInfo] = useState<Teacher | null>(null);
  const [regionCentres, setRegionCentres] = useState<string[]>([]);
  const [centres, setCentres] = useState<any[]>([]);
  
  // Toolbar filters
  const [timeFrom, setTimeFrom] = useState('');
  const [timeTo, setTimeTo] = useState('');
  const [selectedCentres, setSelectedCentres] = useState<string[]>([]);
  
  // Modal states
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedOfficeHour, setSelectedOfficeHour] = useState<OfficeHourWithConfirmation | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  // Table visibility
  const [showTable, setShowTable] = useState(true);

  // Detail modal state
  const [detailOfficeHour, setDetailOfficeHour] = useState<OfficeHour | null>(null);

  // Initialize date range based on current time
  useEffect(() => {
    const now = new Date();
    const vnTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
    const hour = vnTime.getHours();
    const minute = vnTime.getMinutes();
    
    // If before 17:30, use today; if after 17:30, use yesterday
    const targetDate = (hour < 17 || (hour === 17 && minute < 30)) 
      ? vnTime 
      : new Date(vnTime.setDate(vnTime.getDate() - 1));
    
    const dateStr = targetDate.toISOString().split('T')[0];
    setTimeFrom(dateStr);
    setTimeTo(dateStr);
  }, []);

  // Get teacher info and region centres on mount
  useEffect(() => {
    if (session?.email) {
      loadTeacherInfo();
      loadCentres();
    }
  }, [session?.email]);

  async function loadCentres() {
    try {
      // Try to get from cache first
      const { getCache } = await import('@/lib/idb');
      const { CACHE_KEYS } = await import('@/constants');
      const cached = await getCache(CACHE_KEYS.CENTRES);
      
      if (cached?.centres?.length) {
        setCentres(cached.centres);
        return;
      }

      // If no cache, fetch from API
      const { fetchAllCentres } = await import('@/services/centresService');
      const data = await fetchAllCentres();
      setCentres(data);
      
      // Save to cache
      const { setCache } = await import('@/lib/idb');
      await setCache(CACHE_KEYS.CENTRES, { centres: data });
    } catch (error) {
      // Silent error - centres will be empty
    }
  }

  async function loadTeacherInfo() {
    if (!session?.email) return;
    
    try {
      // Search for teacher by email
      const result = await searchTeachers(session.email, 0, 1);
      if (result.data.length > 0) {
        const teacher = result.data[0];
        setTeacherInfo(teacher);

        // Get region centres from teacher's centres
        if (teacher.centres && teacher.centres.length > 0) {
          const centreIds = teacher.centres.map(c => c.id);
          await loadRegionCentres(centreIds);
        }
      }
    } catch (error) {
      // Silent error - teacher info will be null
    }
  }

  async function loadRegionCentres(teacherCentreIds: string[]) {
    try {
      const { supabase } = await import('@/lib/supabase/client');
      
      // Get regions that contain any of teacher's centres
      const { data: regionData, error: regionError } = await supabase
        .from('region_centres')
        .select('region_id, centre_id')
        .in('centre_id', teacherCentreIds);

      if (regionError) {
        setRegionCentres(teacherCentreIds);
        return;
      }

      if (!regionData || regionData.length === 0) {
        setRegionCentres(teacherCentreIds);
        return;
      }

      // Get all region IDs
      const regionIds = [...new Set(regionData.map(r => r.region_id))];

      // Get all centres in these regions
      const { data: allRegionCentres, error: centresError } = await supabase
        .from('region_centres')
        .select('centre_id')
        .in('region_id', regionIds);

      if (centresError) {
        setRegionCentres(teacherCentreIds);
        return;
      }

      const allCentreIds = [...new Set(allRegionCentres.map(rc => rc.centre_id))];
      setRegionCentres(allCentreIds);
    } catch (error) {
      setRegionCentres(teacherCentreIds);
    }
  }

  // Auto-select region centres and fetch when ready
  useEffect(() => {
    if (regionCentres.length > 0) {
      // Pre-select all region centres in the filter
      setSelectedCentres(regionCentres);
      
      // Auto-fetch if dates are set
      if (timeFrom && timeTo) {
        handleFetch();
      }
    }
  }, [regionCentres]);

  async function handleFetch() {
    if (!teacherInfo || regionCentres.length === 0) {
      return;
    }

    // Use selected centres from filter, fallback to all region centres
    const centresToFetch = selectedCentres.length > 0 ? selectedCentres : regionCentres;

    setLoading(true);
    setProgress({ loaded: 0, total: 0 });
    setOfficeHours([]);
    const tid = addToast(MESSAGES.LOADING.CONNECTING, 'loading');

    let accumulated: OfficeHour[] = [];

    try {
      const params: any = {
        centreIn: centresToFetch, // Use selected centres from filter
        timeFrom: new Date(timeFrom + 'T00:00:00+07:00').toISOString(),
        timeTo: new Date(timeTo + 'T23:59:59+07:00').toISOString(),
      };

      const response = await fetchOfficeHours(
        params,
        async (loaded, total, chunk) => {
          setProgress({ loaded, total });
          accumulated = [...accumulated, ...chunk];
          
          try {
            // Get ALL confirmations for these office hours (not just mine)
            const officeHourIds = accumulated.map(oh => oh.id);
            const { supabase } = await import('@/lib/supabase/client');
            
            const { data: allConfirmations, error } = await supabase
              .from('teacher_office_hour_confirmations')
              .select('*')
              .in('office_hour_id', officeHourIds)
              .eq('status', 'confirmed');
            
            if (error && error.code !== '42P01') {
              // Silent error
            }
            
            const confirmedOfficeHourIds = new Set(
              (allConfirmations || []).map(c => c.office_hour_id)
            );
            
            // Also get my confirmations
            const myConfirmations = await getTeacherConfirmations(session!.email);
            
            // Check which office hours I've requested
            const { supabase: supabaseClient } = await import('@/lib/supabase/client');
            const { data: myRequests } = await supabaseClient
              .from('office_hours_shift_requests')
              .select('office_hour_id')
              .eq('teacher_email', session!.email)
              .eq('status', 'pending')
              .in('office_hour_id', officeHourIds);
            
            const requestedOfficeHourIds = new Set(
              (myRequests || []).map(r => r.office_hour_id)
            );
            
            const combined: OfficeHourWithConfirmation[] = accumulated.map(oh => {
              const isAssignedToMe = oh.teacher?.email === session!.email;
              const myConfirmation = myConfirmations.find(c => c.office_hour_id === oh.id) || null;
              const hasConfirmedTeacher = confirmedOfficeHourIds.has(oh.id);
              const hasMyRequest = requestedOfficeHourIds.has(oh.id);
              
              return {
                officeHour: oh,
                confirmation: myConfirmation,
                isAssignedToMe,
                hasConfirmedTeacher,
                hasMyRequest,
              };
            });
            
            // Sort by time
            combined.sort((a, b) => {
              const timeA = a.officeHour.startTime ? new Date(a.officeHour.startTime).getTime() : 0;
              const timeB = b.officeHour.startTime ? new Date(b.officeHour.startTime).getTime() : 0;
              return timeA - timeB;
            });
            
            setOfficeHours([...combined]);
          } catch (err) {
            // Fallback without confirmation data
            const combined: OfficeHourWithConfirmation[] = accumulated.map(oh => ({
              officeHour: oh,
              confirmation: null,
              isAssignedToMe: oh.teacher?.email === session!.email,
              hasConfirmedTeacher: false,
              hasMyRequest: false,
            }));
            setOfficeHours([...combined]);
          }
        }
      );
      
      removeToast(tid);
      addToast(MESSAGES.LOADING.SUCCESS(response.data.length, 'ca trực'), 'success');
    } catch (error: any) {
      if (error.message === 'Aborted' || error.name === 'AbortError') {
        removeToast(tid);
        addToast(MESSAGES.LOADING.STOPPED, 'info');
      } else {
        removeToast(tid);
        addToast('Không thể tải danh sách ca trực', 'error');
      }
    } finally {
      setLoading(false);
    }
  }

  // Helper functions
  function getStatusColor(status: string) {
    const OFFICE_HOUR_STATUS = {
      APPROVED: 'APPROVED',
      REJECTED: 'REJECTED',
      ABANDONED: 'ABANDONED',
    };
    
    switch (status) {
      case OFFICE_HOUR_STATUS.APPROVED: return styles.passed;
      case OFFICE_HOUR_STATUS.REJECTED: return styles.failed;
      case OFFICE_HOUR_STATUS.ABANDONED: return styles.failed;
      default: return styles.exempt;
    }
  }

  function formatDateTime(isoString: string) {
    if (!isoString) return 'N/A';
    
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return 'N/A';
      
      return new Intl.DateTimeFormat('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
    } catch (error) {
      return 'N/A';
    }
  }

  function formatTime(isoString: string) {
    if (!isoString) return 'N/A';
    
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return 'N/A';
      
      return new Intl.DateTimeFormat('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
    } catch (error) {
      return 'N/A';
    }
  }

  function openRejectModal(item: OfficeHourWithConfirmation) {
    setSelectedOfficeHour(item);
    setRejectionReason('');
    setShowRejectModal(true);
  }

  function toOHInfo(oh: OfficeHour) {
    return {
      id: oh.id,
      startTime: oh.startTime,
      endTime: oh.endTime,
      centreId: oh.centre?.id,
      centreName: oh.centre?.shortName || oh.centre?.name,
      courses: oh.courses?.map(c => c.shortName).filter(Boolean),
      type: oh.type,
    };
  }

  async function handleConfirm(item: OfficeHourWithConfirmation) {
    if (!session?.email) return;

    try {
      setSubmitting(true);
      await confirmOfficeHour(item.officeHour.id, session.email, undefined, toOHInfo(item.officeHour));
      addToast('Đã xác nhận ca trực', 'success');
      await handleFetch();
    } catch (error) {
      addToast('Không thể xác nhận ca trực', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReject() {
    if (!selectedOfficeHour || !session?.email) return;

    try {
      setSubmitting(true);
      await rejectOfficeHour(
        selectedOfficeHour.officeHour.id,
        session.email,
        rejectionReason,
        toOHInfo(selectedOfficeHour.officeHour),
      );
      
      addToast('Đã từ chối ca trực', 'success');
      setShowRejectModal(false);
      setSelectedOfficeHour(null);
      setRejectionReason('');
      
      // Reload data
      await handleFetch();
    } catch (error) {
      console.error('Error rejecting:', error);
      addToast('Không thể từ chối ca trực', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  // Sort items by Date → Centre → Khối → Buổi → start time, then compute
  // rowspan info so consecutive rows with the same value are merged.
  const tableRows = useMemo(() => {
    const enriched = officeHours.map(item => {
      const oh = item.officeHour;
      const dKey = oh.startTime ? dateKey(oh.startTime) : '';
      const dParts = oh.startTime ? dateLabelParts(oh.startTime) : { dow: 'N/A', ymd: '' };
      const centreId = oh.centre?.id || '';
      const centreLabel = oh.centre?.name || oh.centre?.shortName || '—';
      const category = getOfficeHourCategory(oh);
      const session = oh.endTime ? sessionLabel(oh.endTime) : 'Sáng';
      const startMs = oh.startTime ? new Date(oh.startTime).getTime() : 0;
      return { item, dKey, dParts, centreId, centreLabel, category, session, startMs };
    });

    enriched.sort((a, b) => {
      if (a.dKey !== b.dKey) return a.dKey.localeCompare(b.dKey);
      if (a.centreLabel !== b.centreLabel) return a.centreLabel.localeCompare(b.centreLabel, 'vi');
      const ca = CATEGORY_ORDER[a.category] ?? 99;
      const cb = CATEGORY_ORDER[b.category] ?? 99;
      if (ca !== cb) return ca - cb;
      const sa = SESSION_ORDER[a.session] ?? 99;
      const sb = SESSION_ORDER[b.session] ?? 99;
      if (sa !== sb) return sa - sb;
      return a.startMs - b.startMs;
    });

    // Compute rowspans for each group level. A row "owns" a merged cell only
    // when it is the first row of that group; later rows in the same group
    // skip rendering that cell.
    type Spans = { dateSpan: number; centreSpan: number; categorySpan: number; sessionSpan: number };
    const out: Array<typeof enriched[number] & Spans> = enriched.map(e => ({
      ...e, dateSpan: 0, centreSpan: 0, categorySpan: 0, sessionSpan: 0,
    }));

    for (let i = 0; i < out.length; i++) {
      const e = out[i];
      const k1 = e.dKey;
      const k2 = `${k1}|${e.centreId}`;
      const k3 = `${k2}|${e.category}`;
      const k4 = `${k3}|${e.session}`;

      const prev = i > 0 ? out[i - 1] : null;
      const pk1 = prev ? prev.dKey : null;
      const pk2 = prev ? `${prev.dKey}|${prev.centreId}` : null;
      const pk3 = prev ? `${prev.dKey}|${prev.centreId}|${prev.category}` : null;
      const pk4 = prev ? `${prev.dKey}|${prev.centreId}|${prev.category}|${prev.session}` : null;

      if (k1 !== pk1) {
        let n = 1;
        while (i + n < out.length && out[i + n].dKey === k1) n++;
        e.dateSpan = n;
      }
      if (k2 !== pk2) {
        let n = 1;
        while (i + n < out.length && `${out[i + n].dKey}|${out[i + n].centreId}` === k2) n++;
        e.centreSpan = n;
      }
      if (k3 !== pk3) {
        let n = 1;
        while (i + n < out.length && `${out[i + n].dKey}|${out[i + n].centreId}|${out[i + n].category}` === k3) n++;
        e.categorySpan = n;
      }
      if (k4 !== pk4) {
        let n = 1;
        while (i + n < out.length && `${out[i + n].dKey}|${out[i + n].centreId}|${out[i + n].category}|${out[i + n].session}` === k4) n++;
        e.sessionSpan = n;
      }
    }

    return out;
  }, [officeHours]);

  async function handleRequestShift(item: OfficeHourWithConfirmation) {
    if (!session?.email || !teacherInfo) return;

    try {
      // Check if already requested
      const alreadyRequested = await hasRequestedShift(item.officeHour.id, session.email);
      if (alreadyRequested) {
        addToast('Bạn đã yêu cầu ca trực này rồi', 'info');
        return;
      }

      // Create shift request
      await createShiftRequest(
        item.officeHour.id,
        session.email,
        teacherInfo.fullName,
        teacherInfo.id,
        undefined,
        toOHInfo(item.officeHour),
      );

      addToast('Đã gửi yêu cầu xin trực', 'success');
      
      // Reload data to update UI
      await handleFetch();
    } catch (error: any) {
      addToast(error.message || 'Không thể gửi yêu cầu xin trực', 'error');
    }
  }

  return (
    <AuthenticatedPage>
      <UserLayout title="Ca trực khả dụng" activePage="available-shifts">
        <ToastContainer toasts={toasts} onRemove={removeToast} />

        {/* Toolbar */}
        <Toolbar
          centres={centres}
          selectedCentres={selectedCentres}
          onCentresChange={setSelectedCentres}
          centresLoading={false}
          filterToIds={regionCentres}
          showRegionQuickSelect={true}
          dateFrom={timeFrom}
          dateTo={timeTo}
          onDateFromChange={setTimeFrom}
          onDateToChange={setTimeTo}
          onFetch={handleFetch}
          onClearCache={async () => {
            setOfficeHours([]);
            addToast('Đã xoá dữ liệu', 'success');
          }}
          loading={loading}
          progress={progress}
          hasData={officeHours.length > 0}
        />

        {/* Empty State */}
        {officeHours.length === 0 && !loading && (
          <EmptyState
            icon={<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>}
            title="Chưa có ca trực khả dụng"
            subtitle={'Chọn ngày và nhấn "Tải dữ liệu"'}
          />
        )}

        {/* Table */}
        {officeHours.length > 0 && (
          <div className={styles.tableSection}>
            <TableGroupHeader
              title="Danh sách ca trực"
              count={officeHours.length}
              loading={loading}
              progress={progress}
              isExpanded={showTable}
              onToggle={() => setShowTable(p => !p)}
            />

            <AnimatePresence initial={false}>
              {showTable && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  style={{ overflow: 'hidden' }}
                >
                  <div className={styles.tableScrollWrapper}>
                    <table className={styles.mergedTable} style={{ minWidth: '1300px' }}>
                      <thead>
                        <tr>
                          <th>Ngày</th>
                          <th>Cơ sở</th>
                          <th>Khối</th>
                          <th>Buổi</th>
                          <th>Giờ</th>
                          <th>Loại ca</th>
                          <th>Khóa học</th>
                          <th>Giáo viên</th>
                          <th>HS</th>
                          <th>Trạng thái xác nhận</th>
                          <th>Hành động</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tableRows.map((row) => {
                          const item = row.item;
                          const oh = item.officeHour;
                          const totalAppointments = oh.appointments?.length || 0;
                          const hasTeacherOnLMS = !!oh.teacher;
                          const hasConfirmedTeacher = item.hasConfirmedTeacher || false;

                          let confirmationStatusDisplay: React.ReactNode = null;
                          if (item.isAssignedToMe) {
                            if (item.confirmation?.status === 'confirmed') {
                              confirmationStatusDisplay = (
                                <span style={{ padding: '4px 10px', borderRadius: 'var(--radius-pill)', fontSize: 12, fontWeight: 510, background: '#d1fae5', color: '#065f46', border: '1px solid #6ee7b7' }}>Đã xác nhận</span>
                              );
                            } else if (item.confirmation?.status === 'rejected') {
                              confirmationStatusDisplay = (
                                <span style={{ padding: '4px 10px', borderRadius: 'var(--radius-pill)', fontSize: 12, fontWeight: 510, background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca' }}>Đã từ chối</span>
                              );
                            } else {
                              confirmationStatusDisplay = (
                                <span style={{ padding: '4px 10px', borderRadius: 'var(--radius-pill)', fontSize: 12, fontWeight: 510, background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}>Chờ xác nhận</span>
                              );
                            }
                          } else if (hasConfirmedTeacher) {
                            confirmationStatusDisplay = (
                              <span style={{ padding: '4px 10px', borderRadius: 'var(--radius-pill)', fontSize: 12, fontWeight: 510, background: '#d1fae5', color: '#065f46', border: '1px solid #6ee7b7' }}>Đã có GV xác nhận</span>
                            );
                          } else if (hasTeacherOnLMS) {
                            confirmationStatusDisplay = (
                              <span style={{ padding: '4px 10px', borderRadius: 'var(--radius-pill)', fontSize: 12, fontWeight: 510, background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}>Chờ xác nhận</span>
                            );
                          } else {
                            confirmationStatusDisplay = <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>—</span>;
                          }

                          const isNewDate = row.dateSpan > 0;

                          return (
                            <tr
                              key={oh.id}
                              onClick={() => setDetailOfficeHour(oh)}
                              style={{
                                borderTop: isNewDate ? '2px solid var(--border)' : '1px solid var(--border-subtle)',
                                cursor: 'pointer',
                              }}
                            >
                              {row.dateSpan > 0 && (
                                <td rowSpan={row.dateSpan} className={styles.mergedCell} style={{ fontWeight: 600, lineHeight: 1.3 }}>
                                  <div>{row.dParts.dow}</div>
                                  <div style={{ color: 'var(--text-secondary)', fontWeight: 500, fontSize: 12 }}>{row.dParts.ymd}</div>
                                </td>
                              )}
                              {row.centreSpan > 0 && (
                                <td
                                  rowSpan={row.centreSpan}
                                  className={styles.mergedCell}
                                  style={{
                                    whiteSpace: 'normal',
                                    wordBreak: 'break-word',
                                    maxWidth: 160,
                                    fontSize: 14,
                                    fontWeight: 600,
                                    color: 'var(--text-primary)',
                                    lineHeight: 1.35,
                                  }}
                                >
                                  {row.centreLabel}
                                </td>
                              )}
                              {row.categorySpan > 0 && (
                                <td
                                  rowSpan={row.categorySpan}
                                  className={styles.mergedCell}
                                  style={{ ...(CATEGORY_STYLES[row.category] || CATEGORY_STYLES.Others), fontWeight: 600 }}
                                >
                                  {row.category}
                                </td>
                              )}
                              {row.sessionSpan > 0 && (
                                <td rowSpan={row.sessionSpan} className={styles.mergedCell} style={{ fontStyle: 'italic' }}>
                                  {row.session}
                                </td>
                              )}
                              <td>{formatTime(oh.startTime)} - {formatTime(oh.endTime)}</td>
                              <td>
                                <span className={`${styles.reasonTag} ${oh.type === 'Trial' ? styles.demoTag : ''}`}>{oh.type || '—'}</span>
                              </td>
                              <td>
                                {oh.courses && oh.courses.length > 0 ? (
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                    {oh.courses.map(course => (
                                      <span key={course.id} className={styles.reasonTag}>{course.shortName}</span>
                                    ))}
                                  </div>
                                ) : (
                                  <span style={{ color: 'var(--text-tertiary)' }}>—</span>
                                )}
                              </td>
                              <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                                {oh.teacher?.fullName || <span style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>Chưa có GV</span>}
                              </td>
                              <td style={{ textAlign: 'center' }}>{totalAppointments}</td>
                              <td>{confirmationStatusDisplay}</td>
                              <td>
                                <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'center' }}>
                                  {item.isAssignedToMe ? (
                                    item.confirmation?.status === 'pending' || !item.confirmation ? (
                                      <>
                                        <button
                                          onClick={(e) => { e.stopPropagation(); handleConfirm(item); }}
                                          disabled={submitting}
                                          className={styles.primaryBtn}
                                          style={{ padding: '6px 12px', fontSize: 12, minWidth: 'auto' }}
                                        >
                                          {submitting ? 'Đang xử lý...' : 'Xác nhận'}
                                        </button>
                                        <button
                                          onClick={(e) => { e.stopPropagation(); openRejectModal(item); }}
                                          disabled={submitting}
                                          className={styles.clearCacheBtn}
                                          style={{ padding: '6px 12px', fontSize: 12, minWidth: 'auto' }}
                                        >
                                          Từ chối
                                        </button>
                                      </>
                                    ) : item.confirmation?.status === 'confirmed' ? (
                                      <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>Đã xử lý</span>
                                    ) : (
                                      <span
                                        style={{ color: 'var(--text-tertiary)', fontSize: 12, maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                        title={item.confirmation?.rejection_reason || undefined}
                                      >
                                        {item.confirmation?.rejection_reason || 'Đã từ chối'}
                                      </span>
                                    )
                                  ) : hasConfirmedTeacher ? (
                                    <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>Đã có GV</span>
                                  ) : item.hasMyRequest ? (
                                    <span style={{ color: 'var(--brand-indigo)', fontSize: 12, fontWeight: 510 }}>Đã gửi yêu cầu</span>
                                  ) : (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleRequestShift(item); }}
                                      className={styles.clearCacheBtn}
                                      style={{ padding: '6px 12px', fontSize: 12, minWidth: 'auto' }}
                                    >
                                      Yêu cầu xin trực
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Detail Modal — read-only office hour view */}
        <Modal open={!!detailOfficeHour} onClose={() => setDetailOfficeHour(null)}>
          {detailOfficeHour && (
            <>
              <ModalHeader
                title={`Ca ${detailOfficeHour.type} – ${formatTime(detailOfficeHour.startTime)} - ${formatTime(detailOfficeHour.endTime)}`}
                subtitle={`${detailOfficeHour.centre?.name || ''}${detailOfficeHour.courses?.length ? ' · ' + detailOfficeHour.courses.map(c => c.shortName).join(', ') : ''}`}
                onClose={() => setDetailOfficeHour(null)}
              />
              <OfficeHourDetailsView oh={detailOfficeHour} />
            </>
          )}
        </Modal>

        {/* Reject Modal */}
        {showRejectModal && selectedOfficeHour && (
          <Modal open={showRejectModal} onClose={() => setShowRejectModal(false)}>
            <ModalHeader
              title="Từ chối ca trực"
              onClose={() => setShowRejectModal(false)}
            />
            <div style={{ padding: 'var(--space-5)' }}>
              <p style={{ marginBottom: 'var(--space-4)', lineHeight: 1.6, color: 'var(--text-secondary)' }}>
                Vui lòng cho biết lý do từ chối ca trực tại <strong>{selectedOfficeHour.officeHour.centre?.name}</strong>:
              </p>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Nhập lý do từ chối..."
                rows={4}
                className={styles.textarea}
                style={{ marginBottom: 'var(--space-4)' }}
              />
              <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                <button
                  onClick={() => setShowRejectModal(false)}
                  disabled={submitting}
                  className={styles.clearCacheBtn}
                  style={{ flex: 1 }}
                >
                  Huỷ
                </button>
                <button
                  onClick={handleReject}
                  disabled={submitting || !rejectionReason.trim()}
                  className={styles.primaryBtn}
                  style={{ 
                    flex: 1,
                    opacity: !rejectionReason.trim() ? 0.5 : 1,
                  }}
                >
                  {submitting ? 'Đang xử lý...' : 'Xác nhận từ chối'}
                </button>
              </div>
            </div>
          </Modal>
        )}
      </UserLayout>
    </AuthenticatedPage>
  );
}
