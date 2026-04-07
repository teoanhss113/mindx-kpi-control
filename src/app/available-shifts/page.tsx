'use client';

import { useState, useEffect } from 'react';
import { AuthenticatedPage } from '@/components/AuthenticatedPage';
import { UserLayout } from '@/components/UserLayout';
import { useAuth } from '@/lib/AuthContext';
import { useToast, ToastContainer, Toolbar, TableGroupHeader, EmptyState } from '@/components/ui';
import { getTeacherConfirmations, confirmOfficeHour, rejectOfficeHour } from '@/lib/teacher-confirmation-actions';
import { createShiftRequest, hasRequestedShift } from '@/lib/shift-request-actions';
import { fetchOfficeHours, searchTeachers, type Teacher } from '@/services/officeHoursService';
import type { TeacherConfirmation } from '@/lib/teacher-confirmation-actions';
import type { OfficeHour } from '@/types/officeHours';
import { MESSAGES } from '@/constants';
import { motion, AnimatePresence } from 'framer-motion';
import styles from '@/app/dashboard.module.css';

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
  
  // Table visibility
  const [showTable, setShowTable] = useState(true);

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

  async function handleConfirm(item: OfficeHourWithConfirmation) {
    if (!session?.email) return;

    try {
      await confirmOfficeHour(item.officeHour.id, session.email);
      addToast('Đã xác nhận ca trực', 'success');
      await handleFetch();
    } catch (error) {
      addToast('Không thể xác nhận ca trực', 'error');
    }
  }

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
        teacherInfo.id
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
        <ToastContainer toasts={toasts} />

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
                    <div style={{ minWidth: '1300px' }}>
                      {/* Table Header */}
                      <div className={styles.classItemHeader} style={{ gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 0.8fr) minmax(0, 1fr) minmax(0, 0.8fr) minmax(0, 0.7fr) minmax(0, 0.6fr) minmax(0, 0.8fr) minmax(0, 0.9fr) minmax(0, 1.2fr)' }}>
                        <div>Thời gian</div>
                        <div>Loại ca</div>
                        <div>Khóa học</div>
                        <div>Giáo viên</div>
                        <div>Cơ sở</div>
                        <div>HS</div>
                        <div>Trạng thái</div>
                        <div>Trạng thái xác nhận</div>
                        <div>Hành động</div>
                      </div>

                      {/* Skeleton loading */}
                      {loading && officeHours.length === 0 && Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className={styles.skeletonRow} style={{ gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 0.8fr) minmax(0, 1fr) minmax(0, 0.8fr) minmax(0, 0.7fr) minmax(0, 0.6fr) minmax(0, 0.8fr) minmax(0, 0.9fr) minmax(0, 1.2fr)' }}>
                          {Array.from({ length: 9 }).map((_, j) => (
                            <div key={j} className={styles.skeletonBlock} style={{ width: `${[70, 50, 60, 60, 40, 30, 50, 45, 60][j]}%` }} />
                          ))}
                        </div>
                      ))}

                      {/* Table Rows */}
                      {officeHours.map((item, index) => {
                        const oh = item.officeHour;
                        const totalAppointments = oh.appointments?.length || 0;
                        const hasTeacherOnLMS = !!oh.teacher;
                        const hasConfirmedTeacher = item.hasConfirmedTeacher || false;

                        // Determine confirmation status for display
                        let confirmationStatusDisplay = null;
                        if (item.isAssignedToMe) {
                          if (item.confirmation?.status === 'confirmed') {
                            confirmationStatusDisplay = (
                              <span style={{
                                padding: '4px 10px',
                                borderRadius: 'var(--radius-pill)',
                                fontSize: 12,
                                fontWeight: 510,
                                background: '#d1fae5',
                                color: '#065f46',
                                border: '1px solid #6ee7b7',
                              }}>
                                Đã xác nhận
                              </span>
                            );
                          } else if (item.confirmation?.status === 'rejected') {
                            confirmationStatusDisplay = (
                              <span style={{
                                padding: '4px 10px',
                                borderRadius: 'var(--radius-pill)',
                                fontSize: 12,
                                fontWeight: 510,
                                background: '#fee2e2',
                                color: '#991b1b',
                                border: '1px solid #fecaca',
                              }}>
                                Đã từ chối
                              </span>
                            );
                          } else {
                            confirmationStatusDisplay = (
                              <span style={{
                                padding: '4px 10px',
                                borderRadius: 'var(--radius-pill)',
                                fontSize: 12,
                                fontWeight: 510,
                                background: '#fef3c7',
                                color: '#92400e',
                                border: '1px solid #fde68a',
                              }}>
                                Chờ xác nhận
                              </span>
                            );
                          }
                        } else if (hasConfirmedTeacher) {
                          confirmationStatusDisplay = (
                            <span style={{
                              padding: '4px 10px',
                              borderRadius: 'var(--radius-pill)',
                              fontSize: 12,
                              fontWeight: 510,
                              background: '#d1fae5',
                              color: '#065f46',
                              border: '1px solid #6ee7b7',
                            }}>
                              Đã có GV xác nhận
                            </span>
                          );
                        } else if (hasTeacherOnLMS) {
                          confirmationStatusDisplay = (
                            <span style={{
                              padding: '4px 10px',
                              borderRadius: 'var(--radius-pill)',
                              fontSize: 12,
                              fontWeight: 510,
                              background: '#fef3c7',
                              color: '#92400e',
                              border: '1px solid #fde68a',
                            }}>
                              Chờ xác nhận
                            </span>
                          );
                        } else {
                          confirmationStatusDisplay = (
                            <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>
                              —
                            </span>
                          );
                        }

                        return (
                          <motion.div
                            key={oh.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.012 }}
                            className={styles.classItem}
                            style={{ gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 0.8fr) minmax(0, 1fr) minmax(0, 0.8fr) minmax(0, 0.7fr) minmax(0, 0.6fr) minmax(0, 0.8fr) minmax(0, 0.9fr) minmax(0, 1.2fr)' }}
                          >
                            {/* Time */}
                            <div className={styles.className}>
                              <span>{formatDateTime(oh.startTime)}</span>
                              <span className={styles.centreName}>
                                {formatTime(oh.startTime)} - {formatTime(oh.endTime)}
                              </span>
                            </div>

                            {/* Type */}
                            <div className={styles.sizeCol}>
                              <span className={`${styles.reasonTag} ${oh.type === 'Trial' ? styles.demoTag : ''}`}>
                                {oh.type || '—'}
                              </span>
                            </div>

                            {/* Courses */}
                            <div className={styles.reasonsPreview}>
                              {oh.courses && oh.courses.length > 0 ? (
                                oh.courses.map(course => (
                                  <span key={course.id} className={styles.reasonTag}>
                                    {course.shortName}
                                  </span>
                                ))
                              ) : (
                                <span style={{ color: 'var(--text-tertiary)' }}>—</span>
                              )}
                            </div>

                            {/* Teacher */}
                            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                              {oh.teacher?.fullName || (
                                <span style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>Chưa có GV</span>
                              )}
                            </div>

                            {/* Centre */}
                            <div className={styles.centreName}>
                              {oh.centre?.shortName || oh.centre?.name || '—'}
                            </div>

                            {/* Students */}
                            <div className={styles.sizeCol}>{totalAppointments}</div>

                            {/* Status */}
                            <div className={styles.sizeCol}>
                              <span className={`${styles.statusPill} ${getStatusColor(oh.status)}`}>
                                {oh.status}
                              </span>
                            </div>

                            {/* Confirmation Status */}
                            <div className={styles.sizeCol}>
                              {confirmationStatusDisplay}
                            </div>

                            {/* Actions */}
                            <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'center' }}>
                              {item.isAssignedToMe ? (
                                // Ca đã được gán cho mình
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleConfirm(item);
                                  }}
                                  className={styles.primaryBtn}
                                  style={{
                                    padding: '6px 12px',
                                    fontSize: 12,
                                    minWidth: 'auto',
                                  }}
                                >
                                  Xác nhận
                                </button>
                              ) : hasConfirmedTeacher ? (
                                // Ca đã có giáo viên khác và đã xác nhận
                                <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>
                                  Đã có GV
                                </span>
                              ) : item.hasMyRequest ? (
                                // Đã gửi yêu cầu
                                <span style={{ 
                                  color: 'var(--brand-indigo)', 
                                  fontSize: 12,
                                  fontWeight: 510,
                                }}>
                                  Đã gửi yêu cầu
                                </span>
                              ) : (
                                // Ca chưa có GV hoặc GV chưa xác nhận → Có thể xin trực
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRequestShift(item);
                                  }}
                                  className={styles.clearCacheBtn}
                                  style={{
                                    padding: '6px 12px',
                                    fontSize: 12,
                                    minWidth: 'auto',
                                  }}
                                >
                                  Yêu cầu xin trực
                                </button>
                              )}
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </UserLayout>
    </AuthenticatedPage>
  );
}

// Fixed filter logic
// Fixed filter logic
// Fixed filter logic
// Improved date handling

// Fixed filters
