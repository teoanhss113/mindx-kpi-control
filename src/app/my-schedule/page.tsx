'use client';

import { useState, useEffect } from 'react';
import { AuthenticatedPage } from '@/components/AuthenticatedPage';
import { UserLayout } from '@/components/UserLayout';
import { useAuth } from '@/lib/AuthContext';
import { useToast, ToastContainer, Toolbar, TableGroupHeader, Modal, ModalHeader, EmptyState } from '@/components/ui';
import { getTeacherConfirmations, confirmOfficeHour, rejectOfficeHour } from '@/lib/teacher-confirmation-actions';
import { fetchOfficeHours, searchTeachers } from '@/services/officeHoursService';
import type { TeacherConfirmation } from '@/lib/teacher-confirmation-actions';
import type { OfficeHour } from '@/types/officeHours';
import { MESSAGES } from '@/constants';
import { motion, AnimatePresence } from 'framer-motion';
import styles from '@/app/dashboard.module.css';

interface OfficeHourWithConfirmation {
  officeHour: OfficeHour;
  confirmation: TeacherConfirmation | null;
}

export default function MySchedulePage() {
  const { session } = useAuth();
  const { toasts, addToast, removeToast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ loaded: 0, total: 0 });
  const [officeHours, setOfficeHours] = useState<OfficeHourWithConfirmation[]>([]);
  const [teacherId, setTeacherId] = useState<string>('');
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

  // Get teacher ID and load centres on mount
  useEffect(() => {
    if (session?.email) {
      getTeacherId();
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
        console.log('📍 Loaded centres from cache:', cached.centres.length);
        setCentres(cached.centres);
        return;
      }

      // If no cache, fetch from API
      const { fetchAllCentres } = await import('@/services/centresService');
      const data = await fetchAllCentres();
      console.log('📍 Loaded centres from API:', data.length);
      setCentres(data);
      
      // Save to cache
      const { setCache } = await import('@/lib/idb');
      await setCache(CACHE_KEYS.CENTRES, { centres: data });
    } catch (error) {
      console.error('Error loading centres:', error);
      // If API fails, centres will be extracted from office hours data
    }
  }

  // Auto-fetch when teacher ID is ready
  useEffect(() => {
    console.log('🔍 Check ready:', { teacherId });
    if (teacherId) {
      console.log('✅ Ready to fetch!');
      handleFetch();
    }
  }, [teacherId]);

  async function getTeacherId() {
    if (!session?.email) return;
    
    try {
      const result = await searchTeachers(session.email, 0, 1);
      if (result.data.length > 0) {
        setTeacherId(result.data[0].id);
      }
    } catch (error) {
      console.error('Error getting teacher ID:', error);
    }
  }

  async function handleFetch() {
    if (!teacherId) {
      console.warn('⚠️ No teacher ID yet');
      return;
    }

    setLoading(true);
    setProgress({ loaded: 0, total: 0 });
    setOfficeHours([]); // Clear existing data
    const tid = addToast(MESSAGES.LOADING.CONNECTING, 'loading');

    let accumulated: OfficeHour[] = [];

    try {
      const params: any = {
        teacher: teacherId,
      };

      // Only add date range if provided
      if (timeFrom && timeTo) {
        params.timeFrom = new Date(timeFrom + 'T00:00:00+07:00').toISOString();
        params.timeTo = new Date(timeTo + 'T23:59:59+07:00').toISOString();
      }

      // Only add centre filter if selected
      if (selectedCentres.length > 0) {
        params.centreIn = selectedCentres;
      }

      console.log('🔍 Fetching with params:', params);

      const response = await fetchOfficeHours(
        params,
        (loaded, total, chunk) => {
          // Update progress
          setProgress({ loaded, total });
          // Accumulate and display data as it loads
          accumulated = [...accumulated, ...chunk];
          
          // Get confirmations and combine
          getTeacherConfirmations(session!.email)
            .then(confirmations => {
              const combined: OfficeHourWithConfirmation[] = accumulated.map(oh => ({
                officeHour: oh,
                confirmation: confirmations.find(c => c.office_hour_id === oh.id) || null,
              }));
              
              // Sort by time
              combined.sort((a, b) => {
                const timeA = a.officeHour.startTime ? new Date(a.officeHour.startTime).getTime() : 0;
                const timeB = b.officeHour.startTime ? new Date(b.officeHour.startTime).getTime() : 0;
                return timeB - timeA;
              });
              
              setOfficeHours([...combined]);
            })
            .catch(() => {
              // If confirmations fail, just show office hours
              const combined: OfficeHourWithConfirmation[] = accumulated.map(oh => ({
                officeHour: oh,
                confirmation: null,
              }));
              setOfficeHours([...combined]);
            });
        }
      );

      console.log('📦 Response:', response);

      // Extract unique centres from office hours data (if not already loaded)
      if (centres.length === 0) {
        const uniqueCentres = Array.from(
          new Map(
            response.data
              .filter(oh => oh.centre)
              .map(oh => [oh.centre!.id, oh.centre])
          ).values()
        );
        setCentres(uniqueCentres);
        console.log('📍 Extracted centres from data:', uniqueCentres);
      }
      
      removeToast(tid);
      addToast(MESSAGES.LOADING.SUCCESS(response.data.length, 'ca trực'), 'success');
    } catch (error: any) {
      if (error.message === 'Aborted' || error.name === 'AbortError') {
        removeToast(tid);
        addToast(MESSAGES.LOADING.STOPPED, 'info');
      } else {
        console.error('Error loading schedule:', error);
        removeToast(tid);
        addToast('Không thể tải lịch trực', 'error');
      }
    } finally {
      setLoading(false);
    }
  }

  function openRejectModal(item: OfficeHourWithConfirmation) {
    setSelectedOfficeHour(item);
    setRejectionReason('');
    setShowRejectModal(true);
  }

  async function handleConfirm(item: OfficeHourWithConfirmation) {
    if (!session?.email) return;

    try {
      setSubmitting(true);
      await confirmOfficeHour(
        item.officeHour.id,
        session.email
      );
      
      addToast('Đã xác nhận ca trực', 'success');
      
      // Reload data
      await handleFetch();
    } catch (error) {
      console.error('Error confirming:', error);
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
        rejectionReason
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

  // Helper functions (matching office-hours page)
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

  function formatDateTimeLong(dateString: string) {
    if (!dateString) return 'N/A';
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'N/A';
      
      return new Intl.DateTimeFormat('vi-VN', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Ho_Chi_Minh',
      }).format(date);
    } catch (error) {
      return 'N/A';
    }
  }

  return (
    <AuthenticatedPage>
      <UserLayout title="Lịch trực trải nghiệm" activePage="my-schedule">
        <ToastContainer toasts={toasts} />

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
          onClearCache={async () => {
            // No cache for this page yet
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
            title="Chưa có dữ liệu ca trải nghiệm"
            subtitle={'Chọn khoảng thời gian và nhấn "Tải dữ liệu"'}
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
                    <div style={{ minWidth: '1400px' }}>
                      {/* Table Header */}
                      <div className={styles.classItemHeader} style={{ gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 0.8fr) minmax(0, 1fr) minmax(0, 0.7fr) minmax(0, 0.6fr) minmax(0, 0.8fr) minmax(0, 0.9fr) minmax(0, 0.9fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.2fr)' }}>
                        <div>Thời gian</div>
                        <div>Loại ca</div>
                        <div>Khóa học</div>
                        <div>Cơ sở</div>
                        <div>HS</div>
                        <div>Trạng thái</div>
                        <div>Trạng thái xác nhận</div>
                        <div>Đã xác nhận</div>
                        <div>Đã thanh toán</div>
                        <div>Nhận xét GV</div>
                        <div>Xác nhận/Từ chối</div>
                      </div>

                      {/* Skeleton loading */}
                      {loading && officeHours.length === 0 && Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className={styles.skeletonRow} style={{ gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 0.8fr) minmax(0, 1fr) minmax(0, 0.7fr) minmax(0, 0.6fr) minmax(0, 0.8fr) minmax(0, 0.9fr) minmax(0, 0.9fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.2fr)' }}>
                          {Array.from({ length: 11 }).map((_, j) => (
                            <div key={j} className={styles.skeletonBlock} style={{ width: `${[70, 50, 60, 40, 30, 50, 45, 45, 40, 40, 60][j]}%` }} />
                          ))}
                        </div>
                      ))}

                      {/* Table Rows */}
                      {officeHours.map((item, index) => {
                        const oh = item.officeHour;
                        const confirmation = item.confirmation;
                        const totalAppointments = oh.appointments?.length || 0;
                        const paidCount = oh.appointments?.filter(apt => apt.resultAfterTrial?.isHasPayment).length || 0;
                        const commentedCount = oh.appointments?.filter(apt => apt.note).length || 0;
                        const confirmedCount = oh.appointments?.filter(apt => 
                          apt.status && !['WAITING', 'PENDING'].includes(apt.status.toUpperCase())
                        ).length || 0;

                        // Determine confirmation status
                        const confirmationStatus = confirmation?.status || 'pending';
                        const isConfirmed = confirmationStatus === 'confirmed';
                        const isRejected = confirmationStatus === 'rejected';
                        const isPending = confirmationStatus === 'pending';

                        return (
                          <motion.div
                            key={oh.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.012 }}
                            className={styles.classItem}
                            style={{ gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 0.8fr) minmax(0, 1fr) minmax(0, 0.7fr) minmax(0, 0.6fr) minmax(0, 0.8fr) minmax(0, 0.9fr) minmax(0, 0.9fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.2fr)' }}
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
                              {isConfirmed && (
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
                              )}
                              {isRejected && (
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
                              )}
                              {isPending && (
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
                              )}
                            </div>

                            {/* Confirmed */}
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

                            {/* Paid */}
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

                            {/* Comments */}
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

                            {/* Actions */}
                            <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'center' }}>
                              {isPending && (
                                <>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleConfirm(item);
                                    }}
                                    disabled={submitting}
                                    className={styles.primaryBtn}
                                    style={{
                                      padding: '6px 12px',
                                      fontSize: 12,
                                      minWidth: 'auto',
                                    }}
                                  >
                                    {submitting ? 'Đang xử lý...' : 'Xác nhận'}
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openRejectModal(item);
                                    }}
                                    disabled={submitting}
                                    className={styles.clearCacheBtn}
                                    style={{
                                      padding: '6px 12px',
                                      fontSize: 12,
                                      minWidth: 'auto',
                                    }}
                                  >
                                    Từ chối
                                  </button>
                                </>
                              )}
                              {isConfirmed && (
                                <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>
                                  Đã xử lý
                                </span>
                              )}
                              {isRejected && confirmation?.rejection_reason && (
                                <span 
                                  style={{ 
                                    color: 'var(--text-tertiary)', 
                                    fontSize: 12,
                                    maxWidth: '150px',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                  title={confirmation.rejection_reason}
                                >
                                  {confirmation.rejection_reason}
                                </span>
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
                  style={{ flex: 1 }}
                >
                  {submitting ? 'Đang xử lý...' : 'Từ chối'}
                </button>
              </div>
            </div>
          </Modal>
        )}
      </UserLayout>
    </AuthenticatedPage>
  );
}
