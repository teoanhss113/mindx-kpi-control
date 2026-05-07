'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { PageLayout } from '@/components/PageLayout';
import { useTableSort } from '@/hooks/useTableSort';
import { 
  SortableHeader, 
  Toolbar,
  Icon, 
  EmptyState, 
  MultiSelect,
  CentreSelect,
  Modal,
  ModalHeader,
  ModalFooter,
  useToast,
  ToastContainer,
  StatCard,
  TableToolbar,
  TableGroupHeader,
  QuickFilterChips,
} from '@/components/ui';
import { LABELS, MESSAGES, ENTITIES, FORMAT, ANIMATION, CACHE_KEYS } from '@/constants';
import { getTeachers } from '@/services/teacherService';
import { fetchAllCentres, type Centre } from '@/services/centresService';
import { getCache, setCache, clearCache } from '@/lib/idb';
import { useQuickFilterChips } from '@/hooks/useUserPreferences';
import { useSharedCentres } from '@/hooks/useSharedFilterState';
import { getCourseLineCategory } from '@/lib/courseCategories';
import type { Teacher } from '@/types/teacher';
import styles from '../../dashboard.module.css';

export default function TeachersPage() {
  const { session, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const { hasPreferences } = useQuickFilterChips();
  
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [centres, setCentres] = useState<Centre[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState<{ loaded: number; total: number } | undefined>();
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showTable, setShowTable] = useState(true);
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Shared filter state (synced across pages) - only centres, no date range
  const [selectedCentres, setSelectedCentres, centresLoaded] = useSharedCentres();

  // Debug: Log shared centres state
  useEffect(() => {
    console.log('[Teachers] Shared centres state:', {
      centresLoaded,
      selectedCentres,
      length: selectedCentres.length
    });
  }, [centresLoaded, selectedCentres]);

  // Toolbar filters (for API request) - dates default to empty (no filter)
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);

  // Table filters (for client-side filtering)
  const [tableSelectedCentres, setTableSelectedCentres] = useState<string[]>([]);
  const [selectedCourseLines, setSelectedCourseLines] = useState<string[]>([]);
  const [tableSelectedStatuses, setTableSelectedStatuses] = useState<string[]>([]);

  // Toast notifications
  const { toasts, addToast, removeToast } = useToast();

  // Load cached teachers data on mount
  useEffect(() => {
    (async () => {
      try {
        const cached = await getCache(CACHE_KEYS.TEACHERS);
        if (cached?.teachers && cached.teachers.length > 0) {
          setTeachers(cached.teachers);
          // Show toast if data was loaded from dashboard (has timestamp from recent fetch)
          const isRecent = cached.timestamp && (Date.now() - cached.timestamp < 60000); // Within 1 minute
          if (isRecent) {
            addToast(`Đã tải ${cached.teachers.length} giáo viên từ bộ nhớ tạm`, 'success');
          }
        }
      } catch (error) {
        console.error('Failed to load cached teachers:', error);
      }
    })();
  }, [addToast]);

  // Auth check
  useEffect(() => {
    if (authLoading) return;
    if (!session) {
      router.replace('/login');
    }
  }, [session, authLoading, router]);

  // ESC key handler for modal
  useEffect(() => {
    if (!showDetailModal) return;
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowDetailModal(false);
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [showDetailModal]);

  // Load centres on mount
  useEffect(() => {
    loadCentres();
  }, []);

  async function loadCentres() {
    try {
      const cached = await getCache(CACHE_KEYS.CENTRES);
      if (cached?.centres?.length) {
        setCentres(cached.centres);
        return;
      }
      const centresResult = await fetchAllCentres();
      setCentres(centresResult);
      await setCache(CACHE_KEYS.CENTRES, { centres: centresResult });
    } catch (error: any) {
      console.error('Failed to load centres:', error);
    }
  }

  async function loadData() {
    const controller = new AbortController();
    setAbortController(controller);
    setLoading(true);
    setLoadingProgress(undefined);
    const loadingToastId = addToast(MESSAGES.LOADING.CONNECTING, 'loading');
    
    try {
      // Build API variables
      const baseVariables: any = {
        pageIndex: 0,
        itemsPerPage: 100, // API limit per page
        orderBy: 'createdAt_desc',
      };

      // Add centres filter if selected
      if (selectedCentres.length > 0) {
        baseVariables.centers = selectedCentres;
      }

      // Add date range filter if both dates are provided
      if (dateFrom && dateTo) {
        // Convert to ISO format with timezone
        const fromDate = new Date(dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        
        baseVariables.joinedDate = [fromDate.toISOString(), toDate.toISOString()];
      }

      // Add status filter if selected
      if (selectedStatuses.length === 1) {
        baseVariables.isActive = selectedStatuses[0] === 'active';
      }

      // Fetch first page to get total count
      const firstPage = await getTeachers(baseVariables, controller.signal);
      const total = firstPage.total;
      let allTeachers = [...firstPage.data];

      // Update progress
      setLoadingProgress({ loaded: allTeachers.length, total });

      // If there are more pages, fetch them
      if (total > 100) {
        const totalPages = Math.ceil(total / 100);
        const remainingPages = [];
        
        for (let page = 1; page < totalPages; page++) {
          remainingPages.push(
            getTeachers({
              ...baseVariables,
              pageIndex: page,
            }, controller.signal)
          );
        }

        // Fetch all remaining pages in parallel
        const results = await Promise.all(remainingPages);
        results.forEach(result => {
          allTeachers = [...allTeachers, ...result.data];
          // Update progress after each batch
          setLoadingProgress({ loaded: allTeachers.length, total });
        });
      }

      setTeachers(allTeachers);
      setLoadingProgress(undefined);
      
      // Save to cache
      await setCache(CACHE_KEYS.TEACHERS, { 
        teachers: allTeachers, 
        timestamp: Date.now() 
      });
      
      removeToast(loadingToastId);
      addToast(MESSAGES.LOADING.SUCCESS(allTeachers.length, ENTITIES.TEACHERS), 'success');
    } catch (error: any) {
      if (error.message === 'Aborted' || error.name === 'AbortError') {
        removeToast(loadingToastId);
        addToast(MESSAGES.LOADING.STOPPED, 'info');
      } else {
        console.error('Failed to load data:', error);
        removeToast(loadingToastId);
        addToast('Lỗi: ' + error.message, 'error');
      }
      setLoadingProgress(undefined);
    } finally {
      setLoading(false);
      setAbortController(null);
    }
  }

  function handleCancelFetch() {
    if (abortController) {
      abortController.abort();
    }
  }

  async function handleClearCache() {
    await clearCache(CACHE_KEYS.TEACHERS);
    setTeachers([]);
    setSelectedCentres([]);
    setDateFrom('');
    setDateTo('');
    setSelectedStatuses([]);
    setTableSelectedCentres([]);
    setSelectedCourseLines([]);
    setTableSelectedStatuses([]);
    setSearchTerm('');
    addToast(MESSAGES.CACHE.CLEARED, 'success');
  }

  // Get unique course line categories from teachers (Coding, Robotics, Art, Others)
  const courseLineOptions = useMemo(() => {
    const categories = new Set<string>();
    teachers.forEach(teacher => {
      teacher.courseLines.forEach(cl => {
        const category = getCourseLineCategory(cl.name);
        categories.add(category);
      });
    });
    return Array.from(categories).sort().map(category => ({
      value: category,
      label: category,
    }));
  }, [teachers]);

  // Status options for Toolbar (API level)
  const statusOptions = [
    { value: 'active', label: 'Hoạt động' },
    { value: 'inactive', label: 'Không hoạt động' },
  ];

  // Get unique statuses from loaded teachers for Table Toolbar
  const tableStatusOptions = useMemo(() => {
    const statuses = new Set<string>();
    teachers.forEach(teacher => {
      statuses.add(teacher.isActive ? 'active' : 'inactive');
    });
    return Array.from(statuses).map(status => ({
      value: status,
      label: status === 'active' ? 'Hoạt động' : 'Không hoạt động',
    }));
  }, [teachers]);

  // Get centre IDs that have teachers
  const tableCentreIds = useMemo(() => {
    const centreIds = new Set<string>();
    teachers.forEach(teacher => {
      teacher.centres.forEach(centre => centreIds.add(centre.id));
    });
    return Array.from(centreIds);
  }, [teachers]);

  // Filter teachers (client-side filtering after API fetch)
  const filteredTeachers = useMemo(() => {
    return teachers.filter(teacher => {
      // Search filter
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm || 
        teacher.fullName.toLowerCase().includes(searchLower) ||
        teacher.email.toLowerCase().includes(searchLower) ||
        teacher.username.toLowerCase().includes(searchLower) ||
        teacher.code.toLowerCase().includes(searchLower);

      if (!matchesSearch) return false;

      // Centre filter (table-level)
      if (tableSelectedCentres.length > 0) {
        const teacherCentreIds = teacher.centres.map(c => c.id);
        if (!tableSelectedCentres.some(id => teacherCentreIds.includes(id))) {
          return false;
        }
      }

      // Course line filter (by category)
      if (selectedCourseLines.length > 0) {
        const teacherCategories = teacher.courseLines.map(cl => getCourseLineCategory(cl.name));
        if (!selectedCourseLines.some(category => teacherCategories.includes(category as any))) {
          return false;
        }
      }

      // Status filter (table-level)
      if (tableSelectedStatuses.length > 0) {
        const isActive = teacher.isActive;
        const matchesStatus = tableSelectedStatuses.some(status => 
          (status === 'active' && isActive) || (status === 'inactive' && !isActive)
        );
        if (!matchesStatus) return false;
      }

      return true;
    });
  }, [teachers, searchTerm, tableSelectedCentres, selectedCourseLines, tableSelectedStatuses]);

  type TeacherSortKey = keyof Teacher;

  const { sortedData, sortBy, sortOrder, handleSort } = useTableSort<Teacher, TeacherSortKey>({
    data: filteredTeachers,
    defaultSortKey: 'createdAt' as TeacherSortKey,
    defaultSortOrder: 'desc'
  });

  function openDetailModal(teacher: Teacher) {
    setSelectedTeacher(teacher);
    setShowDetailModal(true);
  }

  function formatDate(dateString: string) {
    if (!dateString) return '—';
    try {
      return FORMAT.date(new Date(dateString));
    } catch {
      return '—';
    }
  }

  function getTeacherPointColor(point: number) {
    if (point >= 8) return '#059669'; // Emerald
    if (point >= 6) return '#84cc16'; // Lime
    if (point >= 4) return '#eab308'; // Yellow
    if (point >= 2) return '#f97316'; // Orange
    return '#dc2626'; // Red
  }

  // Stats
  const stats = useMemo(() => {
    const total = teachers.length;
    const active = teachers.filter(t => t.isActive).length;
    const avgPoint = total > 0 
      ? teachers.reduce((sum, t) => sum + t.teacherPoint, 0) / total 
      : 0;
    
    return { total, active, avgPoint };
  }, [teachers]);

  if (authLoading) {
    return (
      <PageLayout title="Quản lý Giáo viên" activePage="teachers" sidebarOpen={sidebarOpen} onSidebarToggle={setSidebarOpen}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
          <div style={{ textAlign: 'center' }}>
            <div className={styles.spinner} style={{ margin: '0 auto var(--space-3)' }} />
            <p style={{ color: 'var(--text-tertiary)' }}>Đang tải...</p>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="Quản lý Giáo viên" activePage="teachers" sidebarOpen={sidebarOpen} onSidebarToggle={setSidebarOpen}>
      {/* Toolbar */}
      <Toolbar
        centres={centres}
        selectedCentres={selectedCentres}
        onCentresChange={setSelectedCentres}
        centresLoading={centres.length === 0}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        onFetch={loadData}
        onCancel={handleCancelFetch}
        loading={loading}
        progress={loadingProgress}
        hasData={teachers.length > 0}
        onClearCache={handleClearCache}
        showRegionQuickSelect={true}
        quickFilterSlots={
          <>
            {/* User preference chips */}
            {hasPreferences && (
              <QuickFilterChips
                centres={centres}
                selectedCentres={selectedCentres}
                onCentresChange={setSelectedCentres}
                showCentres={true}
                showCourses={false}
              />
            )}
            
            {/* Status filter */}
            <MultiSelect
              options={statusOptions}
              selected={selectedStatuses}
              onChange={setSelectedStatuses}
              placeholder="Tất cả trạng thái"
            />
          </>
        }
      />

      {/* Stats Section */}
      {teachers.length > 0 && (
        <section className={styles.statsGrid}>
          <StatCard
            label="Tổng giáo viên"
            value={FORMAT.number(stats.total)}
            desc=""
            delay={0}
          />
          <StatCard
            label="Đang hoạt động"
            value={FORMAT.number(stats.active)}
            desc=""
            delay={ANIMATION.STAT_CARD_DELAY}
          />
          <StatCard
            label="Điểm TB"
            value={stats.avgPoint.toFixed(1)}
            desc=""
            delay={ANIMATION.STAT_CARD_DELAY * 2}
          />
        </section>
      )}

      {/* Table Filters */}
      {!loading && teachers.length > 0 && (
        <TableToolbar
          search={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Tìm theo tên, email, username..."
          quickFilterSlots={
            <>
              {/* User preference chips */}
              {hasPreferences && (
                <QuickFilterChips
                  centres={centres}
                  selectedCentres={tableSelectedCentres}
                  onCentresChange={setTableSelectedCentres}
                  showCentres={true}
                  showCourses={false}
                />
              )}
            </>
          }
          filterSlots={
            <>
              {/* 1. Centre filter - Only show if 2+ centres */}
              {tableCentreIds.length > 1 && (
                <CentreSelect
                  centres={centres}
                  selected={tableSelectedCentres}
                  onChange={setTableSelectedCentres}
                  filterToIds={tableCentreIds}
                  placeholder="Tất cả cơ sở"
                  searchable
                  maxDisplay={1}
                />
              )}
              
              {/* 2. Course Category filter - Only show if 2+ categories */}
              {courseLineOptions.length > 1 && (
                <MultiSelect
                  options={courseLineOptions}
                  selected={selectedCourseLines}
                  onChange={setSelectedCourseLines}
                  placeholder="Tất cả khối"
                  maxDisplay={2}
                />
              )}
              
              {/* 3. Status filter - Only show if 2+ statuses */}
              {tableStatusOptions.length > 1 && (
                <MultiSelect
                  options={tableStatusOptions}
                  selected={tableSelectedStatuses}
                  onChange={setTableSelectedStatuses}
                  placeholder="Tất cả trạng thái"
                />
              )}
            </>
          }
          hasFilter={searchTerm.length > 0 || tableSelectedCentres.length > 0 || selectedCourseLines.length > 0 || tableSelectedStatuses.length > 0}
          onClearFilter={() => {
            setSearchTerm('');
            setTableSelectedCentres([]);
            setSelectedCourseLines([]);
            setTableSelectedStatuses([]);
          }}
        />
      )}

      {/* Teachers Table */}
      {!loading && filteredTeachers.length > 0 && (
        <section className={styles.tableSection}>
          <TableGroupHeader
            title="Danh sách giáo viên"
            count={filteredTeachers.length}
            isExpanded={showTable}
            onToggle={() => setShowTable(!showTable)}
          />
          
          {showTable && (
            <div className={styles.tableScrollWrapper}>
              <table className={styles.studentTable}>
                <thead>
                  <tr>
                    <SortableHeader label="Mã GV" sortKey="code" currentSortKey={sortBy} sortOrder={sortOrder} onSort={(key) => handleSort(key as TeacherSortKey)} />
                    <SortableHeader label="Họ tên" sortKey="fullName" currentSortKey={sortBy} sortOrder={sortOrder} onSort={(key) => handleSort(key as TeacherSortKey)} />
                    <SortableHeader label="Email" sortKey="email" currentSortKey={sortBy} sortOrder={sortOrder} onSort={(key) => handleSort(key as TeacherSortKey)} />
                    <th>Khối</th>
                    <th>Cơ sở</th>
                    <SortableHeader label="Điểm GV" sortKey="teacherPoint" currentSortKey={sortBy} sortOrder={sortOrder} onSort={(key) => handleSort(key as TeacherSortKey)} />
                    <SortableHeader label="Trạng thái" sortKey="isActive" currentSortKey={sortBy} sortOrder={sortOrder} onSort={(key) => handleSort(key as TeacherSortKey)} />
                    <SortableHeader label="Ngày tham gia" sortKey="joinedDate" currentSortKey={sortBy} sortOrder={sortOrder} onSort={(key) => handleSort(key as TeacherSortKey)} />
                    <th style={{ width: 80 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {sortedData.map((teacher, idx) => (
                    <tr 
                      key={teacher.id}
                      style={{
                        animation: `fadeInUp ${ANIMATION.FADE_DURATION}s ease-out ${Math.min(idx * ANIMATION.TABLE_ROW_DELAY, ANIMATION.TABLE_ROW_MAX_DELAY)}s both`
                      }}
                    >
                      <td style={{ fontWeight: 510, color: 'var(--text-primary)' }}>{teacher.code}</td>
                      <td style={{ fontWeight: 510 }}>{teacher.fullName}</td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{teacher.email}</td>
                      <td style={{ fontSize: 13 }}>
                        {teacher.courseLines.length > 0 
                          ? Array.from(new Set(teacher.courseLines.map(cl => getCourseLineCategory(cl.name)))).join(', ')
                          : '—'}
                      </td>
                      <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                        {teacher.centres.length > 0
                          ? teacher.centres.length > 2
                            ? `${teacher.centres.slice(0, 2).map(c => c.name).join(', ')} +${teacher.centres.length - 2}`
                            : teacher.centres.map(c => c.name).join(', ')
                          : '—'}
                      </td>
                      <td>
                        <span 
                          className={styles.statusPill}
                          style={{ 
                            backgroundColor: `${getTeacherPointColor(teacher.teacherPoint)}15`,
                            color: getTeacherPointColor(teacher.teacherPoint),
                            fontWeight: 590
                          }}
                        >
                          {teacher.teacherPoint}/10
                        </span>
                      </td>
                      <td>
                        <span className={`${styles.statusPill} ${teacher.isActive ? styles.passed : styles.failed}`}>
                          {teacher.isActive ? 'Hoạt động' : 'Không hoạt động'}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>
                        {formatDate(teacher.joinedDate)}
                      </td>
                      <td>
                        <button
                          className={styles.clearCacheBtn}
                          onClick={() => openDetailModal(teacher)}
                          title="Xem chi tiết"
                          style={{ padding: 'var(--space-2)', minWidth: 'auto' }}
                        >
                          <Icon.Eye size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Empty State */}
      {!loading && teachers.length === 0 && (
        <EmptyState
          icon={<Icon.Users size={32} />}
          title="Chưa có dữ liệu giáo viên"
          subtitle='Nhấn "Tải dữ liệu" để tải danh sách giáo viên'
        />
      )}

      {!loading && teachers.length > 0 && filteredTeachers.length === 0 && (
        <EmptyState
          icon={<Icon.Users size={32} />}
          title="Không tìm thấy giáo viên"
          subtitle="Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm"
        />
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedTeacher && (
        <Modal open={showDetailModal} onClose={() => setShowDetailModal(false)}>
          <ModalHeader
            title={`${ENTITIES.TEACHER_PROFILE}: ${selectedTeacher.fullName}`}
            subtitle={`Mã GV: ${selectedTeacher.code}`}
            onClose={() => setShowDetailModal(false)}
          />

          <div style={{ 
            flex: 1, 
            overflowY: 'auto', 
            padding: 'var(--space-5)', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: 'var(--space-5)' 
          }}>
            {/* Basic Info */}
            <div>
              <h4 style={{ 
                margin: 0, 
                marginBottom: 'var(--space-3)', 
                fontSize: 14, 
                fontWeight: 590,
                color: 'var(--text-primary)'
              }}>
                Thông tin cơ bản
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-tertiary)', display: 'block', marginBottom: 'var(--space-1)' }}>
                    Họ tên
                  </label>
                  <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 510, textTransform: 'capitalize' }}>
                    {selectedTeacher.fullName}
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-tertiary)', display: 'block', marginBottom: 'var(--space-1)' }}>
                    Username
                  </label>
                  <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                    {selectedTeacher.username}
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-tertiary)', display: 'block', marginBottom: 'var(--space-1)' }}>
                    Email
                  </label>
                  <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                    {selectedTeacher.email}
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-tertiary)', display: 'block', marginBottom: 'var(--space-1)' }}>
                    Số điện thoại
                  </label>
                  <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                    {selectedTeacher.phoneNumber || '—'}
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-tertiary)', display: 'block', marginBottom: 'var(--space-1)' }}>
                    Giới tính
                  </label>
                  <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                    {selectedTeacher.gender === 'MALE' ? 'Nam' : selectedTeacher.gender === 'FEMALE' ? 'Nữ' : '—'}
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-tertiary)', display: 'block', marginBottom: 'var(--space-1)' }}>
                    Ngày sinh
                  </label>
                  <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                    {formatDate(selectedTeacher.dob)}
                  </div>
                </div>
              </div>
            </div>

            {/* Teaching Info */}
            <div style={{ paddingTop: 'var(--space-4)', borderTop: '1px solid var(--border-primary)' }}>
              <h4 style={{ 
                margin: 0, 
                marginBottom: 'var(--space-3)', 
                fontSize: 14, 
                fontWeight: 590,
                color: 'var(--text-primary)'
              }}>
                Thông tin giảng dạy
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-tertiary)', display: 'block', marginBottom: 'var(--space-1)' }}>
                    Điểm giáo viên
                  </label>
                  <div>
                    <span 
                      className={styles.statusPill}
                      style={{ 
                        backgroundColor: `${getTeacherPointColor(selectedTeacher.teacherPoint)}15`,
                        color: getTeacherPointColor(selectedTeacher.teacherPoint),
                        fontWeight: 590
                      }}
                    >
                      {selectedTeacher.teacherPoint}/10
                    </span>
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-tertiary)', display: 'block', marginBottom: 'var(--space-1)' }}>
                    Trạng thái
                  </label>
                  <div>
                    <span className={`${styles.statusPill} ${selectedTeacher.isActive ? styles.passed : styles.failed}`}>
                      {selectedTeacher.isActive ? 'Hoạt động' : 'Không hoạt động'}
                    </span>
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-tertiary)', display: 'block', marginBottom: 'var(--space-1)' }}>
                    Ngày tham gia
                  </label>
                  <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                    {formatDate(selectedTeacher.joinedDate)}
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-tertiary)', display: 'block', marginBottom: 'var(--space-1)' }}>
                    Lương theo giờ
                  </label>
                  <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                    {selectedTeacher.hourlyRate ? FORMAT.number(selectedTeacher.hourlyRate) + ' VNĐ' : '—'}
                  </div>
                </div>
              </div>
            </div>

            {/* Course Lines & Courses */}
            <div style={{ paddingTop: 'var(--space-4)', borderTop: '1px solid var(--border-primary)' }}>
              <h4 style={{ 
                margin: 0, 
                marginBottom: 'var(--space-3)', 
                fontSize: 14, 
                fontWeight: 590,
                color: 'var(--text-primary)'
              }}>
                Khối & Khóa học
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-tertiary)', display: 'block', marginBottom: 'var(--space-2)' }}>
                    Khối giảng dạy
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                    {selectedTeacher.courseLines.length > 0 ? (
                      Array.from(new Set(selectedTeacher.courseLines.map(cl => getCourseLineCategory(cl.name)))).map(category => (
                        <span key={category} className={styles.statusPill} style={{ fontSize: 13 }}>
                          {category}
                        </span>
                      ))
                    ) : (
                      <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Chưa có khối</span>
                    )}
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-tertiary)', display: 'block', marginBottom: 'var(--space-2)' }}>
                    Khóa học
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                    {selectedTeacher.courses.length > 0 ? (
                      selectedTeacher.courses.map(course => (
                        <div key={course.id} style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                          <span style={{ fontWeight: 510, color: 'var(--text-primary)' }}>{course.shortName}</span>
                          {' — '}
                          <span style={{ textTransform: 'capitalize' }}>{course.name}</span>
                        </div>
                      ))
                    ) : (
                      <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Chưa có khóa học</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Centres */}
            <div style={{ paddingTop: 'var(--space-4)', borderTop: '1px solid var(--border-primary)' }}>
              <h4 style={{ 
                margin: 0, 
                marginBottom: 'var(--space-3)', 
                fontSize: 14, 
                fontWeight: 590,
                color: 'var(--text-primary)'
              }}>
                Cơ sở giảng dạy
              </h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                {selectedTeacher.centres.length > 0 ? (
                  selectedTeacher.centres.map(centre => (
                    <span key={centre.id} className={styles.statusPill} style={{ fontSize: 13, textTransform: 'capitalize' }}>
                      {centre.name}
                    </span>
                  ))
                ) : (
                  <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Chưa có cơ sở</span>
                )}
              </div>
            </div>

            {/* Notes */}
            {selectedTeacher.notes && (
              <div style={{ paddingTop: 'var(--space-4)', borderTop: '1px solid var(--border-primary)' }}>
                <h4 style={{ 
                  margin: 0, 
                  marginBottom: 'var(--space-3)', 
                  fontSize: 14, 
                  fontWeight: 590,
                  color: 'var(--text-primary)'
                }}>
                  Ghi chú
                </h4>
                <div style={{ 
                  fontSize: 13, 
                  color: 'var(--text-secondary)', 
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                  textTransform: 'capitalize'
                }}>
                  {selectedTeacher.notes}
                </div>
              </div>
            )}
          </div>

          <ModalFooter
            primaryButton={{
              label: LABELS.CLOSE,
              onClick: () => setShowDetailModal(false),
              variant: 'secondary',
            }}
          />
        </Modal>
      )}

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} />
    </PageLayout>
  );
}
