'use client';

import { useCallback, useMemo, useState } from 'react';
import type { Class } from '@/types/classes';
import type { ClassSubmissionData } from '@/services/studentSubmissionService';
import type { ClassSubmissionRecord } from '@/hooks/useClassSubmissions';
import {
  buildSubmissionCells,
  getActiveSubmissionLessons,
  getSubmissionStudents,
  summarizeSubmissionData,
  summarizeSubmissionSessions,
  type SubmissionCellStatus,
} from '@/lib/submissionControl';
import { getCourseCategory } from '@/lib/courseCategories';
import { exportToCSV, type CSVColumn } from '@/lib/csvExport';
import { useCSVExportPreferences } from '@/hooks/useCSVExportPreferences';
import {
  AdminTableSection,
  CSVExportSettings,
  EmptyState,
  ExportButton,
  Icon,
  MultiSelect,
  Spinner,
  StatCard,
  TableToolbar,
  type CSVColumnConfig,
  type SelectOption,
} from '@/components/ui';
import { StudentHoverCard } from '@/components/StudentHoverCard';
import styles from '@/app/dashboard.module.css';
import controlStyles from './OperationsControlView.module.css';

const statusMeta: Record<SubmissionCellStatus, { label: string; color: string; background: string }> = {
  not_due: { label: 'Chưa tới hạn', color: 'var(--text-tertiary)', background: 'var(--bg-elevated)' },
  missing: { label: 'Chưa nộp · quá hạn', color: 'var(--status-error)', background: 'rgba(220, 38, 38, 0.08)' },
  pending: { label: 'Đã nộp · chờ chấm', color: 'var(--status-warning)', background: 'rgba(245, 158, 11, 0.10)' },
  graded: { label: 'Đã chấm', color: 'var(--status-success)', background: 'rgba(5, 150, 105, 0.09)' },
};

type SubmissionBreakdownDimension = 'centre' | 'courseLine' | 'centreCourseLine';

interface SubmissionBreakdownRow {
  key: string;
  label: string;
  secondaryLabel?: string;
  totalClasses: number;
  loadedClasses: number;
  expected: number;
  missing: number;
  pending: number;
  graded: number;
  sessions: ReturnType<typeof summarizeSubmissionSessions>;
}

interface SubmissionExportRow {
  centre: string;
  courseLine: string;
  className: string;
  classId: string;
  courseName: string;
  teachers: string;
  studentName: string;
  studentUid: string;
  lessonOrder: number;
  lessonName: string;
  lessonId: string;
  sessionAt: string;
  dueAt: string;
  status: string;
  lmsStatus: string;
  score: number | string;
  submittedCount: number | string;
  submittedAt: string;
  markedAt: string;
  markedBy: string;
  submissionType: string;
  category: string;
  note: string;
}

const defaultSubmissionExportColumns: CSVColumnConfig[] = [
  { id: 'centre', label: 'Cơ sở', enabled: true },
  { id: 'courseLine', label: 'Khối học', enabled: true },
  { id: 'className', label: 'Lớp', enabled: true },
  { id: 'classId', label: 'Class ID', enabled: false },
  { id: 'courseName', label: 'Khóa học', enabled: true },
  { id: 'teachers', label: 'Giáo viên', enabled: true },
  { id: 'studentName', label: 'Học viên', enabled: true },
  { id: 'studentUid', label: 'Student UID', enabled: false },
  { id: 'lessonOrder', label: 'Vị trí bài', enabled: true },
  { id: 'lessonName', label: 'Tên bài', enabled: true },
  { id: 'lessonId', label: 'Lesson ID', enabled: false },
  { id: 'sessionAt', label: 'Thời gian buổi học', enabled: true },
  { id: 'dueAt', label: 'Hạn bài', enabled: true },
  { id: 'status', label: 'Trạng thái', enabled: true },
  { id: 'lmsStatus', label: 'Trạng thái LMS', enabled: true },
  { id: 'score', label: 'Điểm', enabled: true },
  { id: 'submittedCount', label: 'Số lần nộp', enabled: true },
  { id: 'submittedAt', label: 'Thời gian nộp', enabled: true },
  { id: 'markedAt', label: 'Thời gian chấm', enabled: true },
  { id: 'markedBy', label: 'Người chấm', enabled: true },
  { id: 'submissionType', label: 'Loại bài', enabled: false },
  { id: 'category', label: 'Danh mục', enabled: false },
  { id: 'note', label: 'Ghi chú chấm', enabled: true },
];

const submissionExportColumnMap: Record<string, CSVColumn<SubmissionExportRow>> = {
  centre: { header: 'Cơ sở', accessor: 'centre' },
  courseLine: { header: 'Khối học', accessor: 'courseLine' },
  className: { header: 'Lớp', accessor: 'className' },
  classId: { header: 'Class ID', accessor: 'classId' },
  courseName: { header: 'Khóa học', accessor: 'courseName' },
  teachers: { header: 'Giáo viên', accessor: 'teachers' },
  studentName: { header: 'Học viên', accessor: 'studentName' },
  studentUid: { header: 'Student UID', accessor: 'studentUid' },
  lessonOrder: { header: 'Vị trí bài', accessor: 'lessonOrder' },
  lessonName: { header: 'Tên bài', accessor: 'lessonName' },
  lessonId: { header: 'Lesson ID', accessor: 'lessonId' },
  sessionAt: { header: 'Thời gian buổi học', accessor: 'sessionAt' },
  dueAt: { header: 'Hạn bài', accessor: 'dueAt' },
  status: { header: 'Trạng thái', accessor: 'status' },
  lmsStatus: { header: 'Trạng thái LMS', accessor: 'lmsStatus' },
  score: { header: 'Điểm', accessor: 'score' },
  submittedCount: { header: 'Số lần nộp', accessor: 'submittedCount' },
  submittedAt: { header: 'Thời gian nộp', accessor: 'submittedAt' },
  markedAt: { header: 'Thời gian chấm', accessor: 'markedAt' },
  markedBy: { header: 'Người chấm', accessor: 'markedBy' },
  submissionType: { header: 'Loại bài', accessor: 'submissionType' },
  category: { header: 'Danh mục', accessor: 'category' },
  note: { header: 'Ghi chú chấm', accessor: 'note' },
};

function getSubmissionExportColumns(config: CSVColumnConfig[]) {
  return config
    .filter(column => column.enabled)
    .map(column => submissionExportColumnMap[column.id])
    .filter((column): column is CSVColumn<SubmissionExportRow> => Boolean(column));
}

function StatusPill({ status, count }: { status: SubmissionCellStatus; count?: number }) {
  const meta = statusMeta[status];
  return (
    <span className={controlStyles.statusPill} style={{ color: meta.color, background: meta.background }}>
      {meta.label}{count !== undefined ? `: ${count}` : ''}
    </span>
  );
}

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('vi-VN');
}

function getLessonSessionAt(data: ClassSubmissionData, cls: Class, lessonId: string) {
  const authoritativeSlot = data.lessonSchedule?.find(slot => slot.lessonId === lessonId);
  if (authoritativeSlot) return authoritativeSlot.startTime || authoritativeSlot.date || authoritativeSlot.endTime || '';
  const classSlot = cls.slots?.find(slot => slot.learningLessonId === lessonId);
  return classSlot?.startTime || classSlot?.date || classSlot?.endTime || '';
}

export function ClassSubmissionDetail({
  record,
  cls,
  dateFrom,
  dateTo,
  onRetry,
}: {
  record?: ClassSubmissionRecord;
  cls?: Class;
  dateFrom?: string;
  dateTo?: string;
  onRetry?: () => void;
}) {
  if (!record || record.state === 'idle' || record.state === 'loading') {
    return <div className={controlStyles.loadingPanel}><Spinner size={18} /> Đang đồng bộ tình trạng bài tập...</div>;
  }
  if (record.state === 'error' || !record.data) {
    return (
      <div className={controlStyles.emptyPanel}>
        <div style={{ color: 'var(--status-error)', fontWeight: 600 }}>Không thể tải dữ liệu bài tập của lớp.</div>
        {record.error && <div style={{ marginTop: 6, color: 'var(--text-tertiary)', fontSize: 11, wordBreak: 'break-word' }}>{record.error}</div>}
        {onRetry && <button type="button" onClick={onRetry} className={controlStyles.secondaryButton} style={{ marginTop: 10 }}><Icon.Refresh /> Thử lại</button>}
      </div>
    );
  }

  const data = record.data;
  const summaryOptions = { dateFrom, dateTo };
  const lessons = getActiveSubmissionLessons(data, cls);
  const students = getSubmissionStudents(data, cls);
  const cells = buildSubmissionCells(data, cls);
  const summary = summarizeSubmissionData(data, cls, summaryOptions);
  const sessionSummaries = summarizeSubmissionSessions(data, cls, summaryOptions);
  const completeSessions = sessionSummaries.filter(session => session.completion === 'complete').length;
  const partialSessions = sessionSummaries.filter(session => session.completion === 'partial').length;
  const emptySessions = sessionSummaries.filter(session => session.completion === 'none').length;
  const averageSessionSubmissionRate = sessionSummaries.length > 0
    ? sessionSummaries.reduce((sum, session) => sum + session.submissionRate, 0) / sessionSummaries.length
    : 0;
  const sessionsWithSubmissions = sessionSummaries.filter(session => session.submitted > 0);
  const averageSessionGradingRate = sessionsWithSubmissions.length > 0
    ? sessionsWithSubmissions.reduce((sum, session) => sum + session.gradingRate, 0) / sessionsWithSubmissions.length
    : 0;
  const cellsByKey = new Map(cells.map(cell => [`${cell.student.studentUid}:${cell.lesson.id}`, cell]));

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <StatusPill status="missing" count={summary.missing} />
        <StatusPill status="pending" count={summary.pending} />
        <StatusPill status="graded" count={summary.graded} />
        <span style={{ fontSize: 11, fontWeight: 650, color: 'var(--text-secondary)', padding: '3px 8px' }}>Tỷ lệ nộp: {summary.totalExpected ? `${summary.submissionRate.toFixed(1)}%` : '—'}</span>
        <span style={{ fontSize: 11, fontWeight: 650, color: 'var(--text-secondary)', padding: '3px 8px' }}>Tỷ lệ chấm: {summary.submitted ? `${summary.gradingRate.toFixed(1)}%` : '—'}</span>
      </div>
      <div className={controlStyles.metaStrip}>
        <strong>Theo buổi đã đến hạn:</strong>
        <span>Đủ bài: {completeSessions}</span>
        <span>Một phần: {partialSessions}</span>
        <span>Chưa có bài: {emptySessions}</span>
        <span>TB nộp/buổi: {sessionSummaries.length ? `${averageSessionSubmissionRate.toFixed(1)}%` : '—'}</span>
        <span>TB chấm/buổi: {sessionsWithSubmissions.length ? `${averageSessionGradingRate.toFixed(1)}%` : '—'}</span>
      </div>
      <div className={controlStyles.hintText}>
        Thống kê tính theo phạm vi {dateFrom || 'đầu kỳ'} – {dateTo || 'hiện tại'}; bảng bên dưới hiển thị toàn bộ buổi của lớp.
      </div>
      {lessons.length === 0 ? (
        <div className={controlStyles.emptyCell}>Lớp chưa có bài học đang hoạt động.</div>
      ) : (
        <div className={controlStyles.tableScroll}>
          <table className={controlStyles.table} style={{ minWidth: Math.max(620, 200 + lessons.length * 130) }}>
            <thead><tr>
              <th className={controlStyles.stickyHeaderCell} style={{ minWidth: 190 }}>Học viên</th>
              {lessons.map((lesson, index) => <th key={lesson.id} title={lesson.name} style={{ minWidth: 120 }}>{index + 1}. {lesson.name}</th>)}
            </tr></thead>
            <tbody>{students.map(student => <tr key={student.studentUid}>
              <td className={controlStyles.stickyBodyCell}>
                <StudentHoverCard studentId={student.id} studentName={student.displayName} />
              </td>
              {lessons.map(lesson => {
                const cell = cellsByKey.get(`${student.studentUid}:${lesson.id}`)!;
                return <td key={lesson.id} style={{ verticalAlign: 'top' }}><StatusPill status={cell.status} />{cell.dueAt && <div className={controlStyles.secondaryText}>Hạn: {formatDateTime(cell.dueAt)}</div>}{cell.submission?.score !== null && cell.submission?.score !== undefined && cell.status === 'graded' ? <div className={controlStyles.secondaryText}>Điểm: {cell.submission.score}</div> : null}</td>;
              })}
            </tr>)}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function SubmissionControlView({
  classes,
  records,
  loading,
  dateFrom,
  dateTo,
  onReloadClass,
  onReloadAll,
}: {
  classes: Class[];
  records: Record<string, ClassSubmissionRecord>;
  loading: boolean;
  dateFrom?: string;
  dateTo?: string;
  onReloadClass: (classId: string) => void;
  onReloadAll: () => void;
}) {
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | SubmissionCellStatus>('all');
  const [breakdownDimension, setBreakdownDimension] = useState<SubmissionBreakdownDimension>('centre');
  const [tableCentreFilter, setTableCentreFilter] = useState<string[]>([]);
  const [tableCourseLineFilter, setTableCourseLineFilter] = useState<string[]>([]);
  const [showCSVSettings, setShowCSVSettings] = useState(false);
  const { columns: csvColumns, saveColumns: saveCSVColumns } = useCSVExportPreferences(
    'operations-submission-control',
    defaultSubmissionExportColumns,
  );
  const summaryOptions = useMemo(() => ({ dateFrom, dateTo }), [dateFrom, dateTo]);
  const tableCentreOptions = useMemo<SelectOption[]>(() => {
    const options = new Map<string, SelectOption>();
    classes.forEach(cls => {
      const value = cls.centre?.id || cls.centre?.name || 'unknown-centre';
      const label = cls.centre?.shortName || cls.centre?.name || 'Chưa xác định cơ sở';
      if (!options.has(value)) options.set(value, { value, label });
    });
    return [...options.values()].sort((left, right) => left.label.localeCompare(right.label, 'vi'));
  }, [classes]);
  const tableCourseLineOptions = useMemo<SelectOption[]>(() => {
    const options = new Map<string, SelectOption>();
    classes.forEach(cls => {
      const value = getCourseCategory(cls);
      if (!options.has(value)) options.set(value, { value, label: value });
    });
    return [...options.values()].sort((left, right) => left.label.localeCompare(right.label, 'vi'));
  }, [classes]);
  const visibleClasses = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase('vi');
    return classes.filter(cls => {
      const centreValue = cls.centre?.id || cls.centre?.name || 'unknown-centre';
      const courseLineValue = getCourseCategory(cls);
      if (tableCentreFilter.length > 0 && !tableCentreFilter.includes(centreValue)) return false;
      if (tableCourseLineFilter.length > 0 && !tableCourseLineFilter.includes(courseLineValue)) return false;
      if (!normalized) return true;
      return [cls.name, cls.centre?.name, cls.centre?.shortName, cls.course?.name]
        .some(value => (value || '').toLocaleLowerCase('vi').includes(normalized));
    });
  }, [classes, search, tableCentreFilter, tableCourseLineFilter]);

  const handleSelectClass = useCallback((classId: string) => {
    setSelectedClassId(classId);
    setStudentSearch('');
    setStatusFilter('all');
  }, []);

  const loadedEntries = useMemo(() => classes
    .map(cls => ({ cls, record: records[cls.id] }))
    .filter((entry): entry is { cls: Class; record: ClassSubmissionRecord & { data: ClassSubmissionData } } => entry.record?.state === 'loaded' && Boolean(entry.record.data)), [classes, records]);
  const exportRows = useMemo<SubmissionExportRow[]>(() => loadedEntries.flatMap(({ cls, record }) => {
    const lessons = getActiveSubmissionLessons(record.data, cls, summaryOptions);
    const lessonOrderById = new Map(lessons.map((lesson, index) => [lesson.id, index + 1]));
    const teachers = cls.teachers
      .filter(teacherSlot => teacherSlot.isActive)
      .map(teacherSlot => `${teacherSlot.teacher.fullName}${teacherSlot.role?.shortName ? ` (${teacherSlot.role.shortName})` : ''}`)
      .join('; ');

    return buildSubmissionCells(record.data, cls, summaryOptions)
      .filter(cell => cell.status !== 'not_due')
      .map(cell => ({
        centre: cls.centre?.shortName || cls.centre?.name || '',
        courseLine: getCourseCategory(cls),
        className: cls.name,
        classId: cls.id,
        courseName: cls.course?.name || '',
        teachers,
        studentName: cell.student.displayName,
        studentUid: cell.student.studentUid,
        lessonOrder: lessonOrderById.get(cell.lesson.id) || 0,
        lessonName: cell.lesson.name,
        lessonId: cell.lesson.id,
        sessionAt: formatDateTime(getLessonSessionAt(record.data, cls, cell.lesson.id)),
        dueAt: formatDateTime(cell.dueAt),
        status: statusMeta[cell.status].label,
        lmsStatus: cell.submission?.status || '',
        score: cell.submission?.score ?? '',
        submittedCount: cell.submission?.submittedCount ?? '',
        submittedAt: formatDateTime(cell.submission?.submittedAt),
        markedAt: formatDateTime(cell.submission?.markedAt),
        markedBy: cell.submission?.markedBy || '',
        submissionType: cell.submission?.type || cell.submission?.content?.type || '',
        category: cell.submission?.category || '',
        note: cell.submission?.note || '',
      }));
  }), [loadedEntries, summaryOptions]);
  const handleExport = useCallback(() => {
    const rangeSuffix = dateFrom || dateTo ? `_${dateFrom || 'dau-ky'}_${dateTo || 'hien-tai'}` : '';
    exportToCSV(exportRows, getSubmissionExportColumns(csvColumns), `du-lieu-cham-bai-tap${rangeSuffix}`);
  }, [csvColumns, dateFrom, dateTo, exportRows]);
  const aggregate = useMemo(() => loadedEntries.reduce((total, { cls, record }) => {
    const summary = summarizeSubmissionData(record.data, cls, summaryOptions);
    total.expected += summary.totalExpected;
    total.missing += summary.missing;
    total.pending += summary.pending;
    total.graded += summary.graded;
    return total;
  }, { expected: 0, missing: 0, pending: 0, graded: 0 }), [loadedEntries, summaryOptions]);
  const aggregateSubmitted = aggregate.pending + aggregate.graded;
  const aggregateGradingRate = aggregateSubmitted > 0 ? (aggregate.graded / aggregateSubmitted) * 100 : 0;
  const failedClassCount = classes.filter(cls => records[cls.id]?.state === 'error').length;
  const pendingClassCount = classes.length - loadedEntries.length - failedClassCount;
  const hasIncompleteCoverage = loadedEntries.length < classes.length;
  const coverageRate = classes.length > 0 ? (loadedEntries.length / classes.length) * 100 : 0;
  const hasTableFilter = tableCentreFilter.length > 0 || tableCourseLineFilter.length > 0 || search.trim().length > 0;
  const aggregateSessions = useMemo(() => loadedEntries.flatMap(({ cls, record }) => (
    summarizeSubmissionSessions(record.data, cls, summaryOptions)
  )), [loadedEntries, summaryOptions]);
  const completeSessionCount = aggregateSessions.filter(session => session.completion === 'complete').length;
  const partialSessionCount = aggregateSessions.filter(session => session.completion === 'partial').length;
  const emptySessionCount = aggregateSessions.filter(session => session.completion === 'none').length;
  const averageSubmissionRatePerSession = aggregateSessions.length > 0
    ? aggregateSessions.reduce((sum, session) => sum + session.submissionRate, 0) / aggregateSessions.length
    : 0;
  const aggregateSessionsWithSubmissions = aggregateSessions.filter(session => session.submitted > 0);
  const averageGradingRatePerSession = aggregateSessionsWithSubmissions.length > 0
    ? aggregateSessionsWithSubmissions.reduce((sum, session) => sum + session.gradingRate, 0) / aggregateSessionsWithSubmissions.length
    : 0;
  const distinctCentreCount = useMemo(() => new Set(classes.map(cls => cls.centre?.id || cls.centre?.name || 'unknown')).size, [classes]);
  const distinctCourseLineCount = useMemo(() => new Set(classes.map(cls => getCourseCategory(cls))).size, [classes]);
  const showBreakdown = distinctCentreCount > 1 || distinctCourseLineCount > 1;
  const breakdownRows = useMemo(() => {
    const groups = new Map<string, SubmissionBreakdownRow>();
    classes.forEach(cls => {
      const centreKey = cls.centre?.id || cls.centre?.name || 'unknown-centre';
      const centreLabel = cls.centre?.shortName || cls.centre?.name || 'Chưa xác định cơ sở';
      const courseLineLabel = getCourseCategory(cls);
      const courseLineKey = courseLineLabel;
      const key = breakdownDimension === 'centre'
        ? centreKey
        : breakdownDimension === 'courseLine'
          ? courseLineKey
          : `${centreKey}:${courseLineKey}`;
      const label = breakdownDimension === 'courseLine' ? courseLineLabel : centreLabel;
      const secondaryLabel = breakdownDimension === 'centreCourseLine' ? courseLineLabel : undefined;
      const row = groups.get(key) || {
        key,
        label,
        secondaryLabel,
        totalClasses: 0,
        loadedClasses: 0,
        expected: 0,
        missing: 0,
        pending: 0,
        graded: 0,
        sessions: [],
      };
      row.totalClasses += 1;
      const record = records[cls.id];
      if (record?.state === 'loaded' && record.data) {
        const summary = summarizeSubmissionData(record.data, cls, summaryOptions);
        row.loadedClasses += 1;
        row.expected += summary.totalExpected;
        row.missing += summary.missing;
        row.pending += summary.pending;
        row.graded += summary.graded;
        row.sessions.push(...summarizeSubmissionSessions(record.data, cls, summaryOptions));
      }
      groups.set(key, row);
    });
    return [...groups.values()].sort((left, right) => {
      const leftSubmitted = left.pending + left.graded;
      const rightSubmitted = right.pending + right.graded;
      const leftRate = left.expected > 0 ? leftSubmitted / left.expected : Number.POSITIVE_INFINITY;
      const rightRate = right.expected > 0 ? rightSubmitted / right.expected : Number.POSITIVE_INFINITY;
      return leftRate - rightRate || left.label.localeCompare(right.label, 'vi');
    });
  }, [breakdownDimension, classes, records, summaryOptions]);

  const selectedClass = classes.find(cls => cls.id === selectedClassId);
  const selectedRecord = selectedClassId ? records[selectedClassId] : undefined;
  const selectedData = selectedRecord?.data;
  const selectedCells = selectedData ? buildSubmissionCells(selectedData, selectedClass, summaryOptions) : [];
  const selectedDueLessonIds = new Set(selectedData
    ? summarizeSubmissionSessions(selectedData, selectedClass, summaryOptions).map(session => session.lesson.id)
    : []);
  const selectedLessons = selectedData
    ? getActiveSubmissionLessons(selectedData, selectedClass, summaryOptions).filter(lesson => selectedDueLessonIds.has(lesson.id))
    : [];
  const cellsByStudentLesson = new Map(selectedCells.map(cell => [`${cell.student.studentUid}:${cell.lesson.id}`, cell]));
  const selectedStudents = (selectedData ? getSubmissionStudents(selectedData, selectedClass) : []).filter(student => {
    const matchesSearch = student.displayName.toLocaleLowerCase('vi').includes(studentSearch.trim().toLocaleLowerCase('vi'));
    if (!matchesSearch) return false;
    if (statusFilter === 'all') return true;
    return selectedLessons.some(lesson => cellsByStudentLesson.get(`${student.studentUid}:${lesson.id}`)?.status === statusFilter);
  });

  if (classes.length === 0) {
    return <EmptyState icon={<Icon.BookOpen size={42} />} title="Chưa có lớp để kiểm tra" subtitle="Tải dữ liệu lớp bằng bộ lọc phía trên trước khi xem tình trạng bài tập." />;
  }

  return (
    <div className={controlStyles.controlRoot}>
      {loadedEntries.length > 0 && (
        <div className={styles.statsGrid}>
          <StatCard label="ĐỘ PHỦ DỮ LIỆU" value={`${coverageRate.toFixed(1)}%`} desc={`${loadedEntries.length}/${classes.length} lớp đã tải`} />
          <StatCard label="CẦN NỘP" value={aggregate.expected.toLocaleString('vi-VN')} desc={`${loadedEntries.length} lớp đã tải`} />
          <StatCard label="CHƯA NỘP" value={aggregate.missing.toLocaleString('vi-VN')} desc={aggregate.expected ? `${(aggregate.missing / aggregate.expected * 100).toFixed(1)}% lượt bài` : '0% lượt bài'} />
          <StatCard label="CHỜ CHẤM" value={aggregate.pending.toLocaleString('vi-VN')} desc="Đã nộp nhưng chưa có kết quả chấm" />
          <StatCard label="ĐÃ CHẤM" value={aggregate.graded.toLocaleString('vi-VN')} desc={aggregate.expected ? `${(aggregate.graded / aggregate.expected * 100).toFixed(1)}% lượt bài` : '0% lượt bài'} />
          <StatCard label="TỶ LỆ CHẤM BÀI" value={aggregateSubmitted ? `${aggregateGradingRate.toFixed(1)}%` : '—'} desc={aggregateSubmitted ? `${aggregate.graded}/${aggregateSubmitted} bài đã nộp${hasIncompleteCoverage ? ' · tạm tính' : ''}` : 'Chưa có bài đã nộp'} />
        </div>
      )}

      {hasIncompleteCoverage && (
        <div className={`${controlStyles.notice} ${controlStyles.noticeWarning}`}>
          <strong>Thống kê đang tạm tính trên {loadedEntries.length}/{classes.length} lớp.</strong>{' '}
          {failedClassCount > 0 ? `${failedClassCount} lớp tải lỗi. ` : ''}
          {pendingClassCount > 0 ? `${pendingClassCount} lớp đang chờ tải. ` : ''}
          Các lớp chưa tải thành công không nằm trong tử số hoặc mẫu số. Bấm “Làm mới dữ liệu bài tập” để thử lại.
        </div>
      )}

      {aggregateSessions.length > 0 && (
        <div>
          <div className={controlStyles.sectionEyebrow}>QUY ĐỔI THEO BUỔI ĐÃ ĐẾN HẠN{hasIncompleteCoverage ? ' · TẠM TÍNH' : ''}</div>
          <div className={styles.statsGrid}>
            <StatCard label="BUỔI ĐỦ BÀI" value={completeSessionCount.toLocaleString('vi-VN')} desc={`${(completeSessionCount / aggregateSessions.length * 100).toFixed(1)}% số buổi`} />
            <StatCard label="BUỔI LÀM MỘT PHẦN" value={partialSessionCount.toLocaleString('vi-VN')} desc={`${(partialSessionCount / aggregateSessions.length * 100).toFixed(1)}% số buổi`} />
            <StatCard label="BUỔI CHƯA CÓ BÀI" value={emptySessionCount.toLocaleString('vi-VN')} desc={`${(emptySessionCount / aggregateSessions.length * 100).toFixed(1)}% số buổi`} />
            <StatCard label="TB NỘP / BUỔI" value={`${averageSubmissionRatePerSession.toFixed(1)}%`} desc={`${aggregateSessions.length} buổi đã đến hạn`} />
            <StatCard label="TB CHẤM / BUỔI" value={aggregateSessionsWithSubmissions.length ? `${averageGradingRatePerSession.toFixed(1)}%` : '—'} desc={`${aggregateSessionsWithSubmissions.length} buổi có bài nộp`} />
          </div>
        </div>
      )}

      {showBreakdown && (
        <AdminTableSection
          title="Phân loại thống kê bài tập"
          count={breakdownRows.length}
          isExpanded={true}
          toolbarSlot={
            <div className={controlStyles.segmented}>
              {([
                ['centre', 'Theo cơ sở'],
                ['courseLine', 'Theo khối học'],
                ['centreCourseLine', 'Cơ sở × khối'],
              ] as [SubmissionBreakdownDimension, string][]).map(([dimension, label]) => (
                <button
                  key={dimension}
                  type="button"
                  onClick={() => setBreakdownDimension(dimension)}
                  className={`${controlStyles.segmentButton} ${breakdownDimension === dimension ? controlStyles.segmentButtonActive : ''}`}
                >
                  {label}
                </button>
              ))}
              <span className={styles.metricText}>Chỉ tính bài và buổi đã đến hạn · xếp tỷ lệ nộp thấp trước</span>
            </div>
          }
        >
          <div className={controlStyles.tableScroll}>
            <table className={controlStyles.table} style={{ minWidth: 900 }}>
              <thead><tr>
                {['Nhóm', 'Độ phủ lớp', 'Bài đến hạn', 'Chưa nộp', 'Chờ chấm', 'Tỷ lệ nộp', 'Tỷ lệ chấm', 'TB nộp / buổi', 'TB chấm / buổi'].map(label => <th key={label}>{label}</th>)}
              </tr></thead>
              <tbody>{breakdownRows.map(row => {
                const submitted = row.pending + row.graded;
                const submissionRate = row.expected > 0 ? submitted / row.expected * 100 : null;
                const gradingRate = submitted > 0 ? row.graded / submitted * 100 : null;
                const sessionsWithSubmissions = row.sessions.filter(session => session.submitted > 0);
                const averageSubmission = row.sessions.length > 0 ? row.sessions.reduce((sum, session) => sum + session.submissionRate, 0) / row.sessions.length : null;
                const averageGrading = sessionsWithSubmissions.length > 0 ? sessionsWithSubmissions.reduce((sum, session) => sum + session.gradingRate, 0) / sessionsWithSubmissions.length : null;
                const incomplete = row.loadedClasses < row.totalClasses;
                return <tr key={row.key}>
                  <td className={controlStyles.primaryCell}>{row.label}{row.secondaryLabel && <div className={controlStyles.secondaryText}>{row.secondaryLabel}</div>}</td>
                  <td style={{ color: incomplete ? 'var(--status-warning)' : 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{row.loadedClasses}/{row.totalClasses}{incomplete ? ' · tạm tính' : ''}</td>
                  <td>{row.expected.toLocaleString('vi-VN')}</td>
                  <td style={{ color: row.missing > 0 ? 'var(--status-error)' : undefined, fontWeight: 650 }}>{row.missing.toLocaleString('vi-VN')}</td>
                  <td style={{ color: row.pending > 0 ? 'var(--status-warning)' : undefined, fontWeight: 650 }}>{row.pending.toLocaleString('vi-VN')}</td>
                  <td className={controlStyles.primaryCell}>{submissionRate === null ? '—' : `${submissionRate.toFixed(1)}%`}</td>
                  <td className={controlStyles.primaryCell}>{gradingRate === null ? '—' : `${gradingRate.toFixed(1)}%`}</td>
                  <td className={controlStyles.primaryCell}>{averageSubmission === null ? '—' : `${averageSubmission.toFixed(1)}%`}</td>
                  <td className={controlStyles.primaryCell}>{averageGrading === null ? '—' : `${averageGrading.toFixed(1)}%`}</td>
                </tr>;
              })}</tbody>
            </table>
          </div>
        </AdminTableSection>
      )}

      <AdminTableSection
        title="Kiểm soát nộp và chấm bài"
        count={visibleClasses.length}
        isExpanded={true}
        actionSlot={
          <div className={controlStyles.controlActions}>
            <ExportButton
              onClick={handleExport}
              onSettingsClick={() => setShowCSVSettings(true)}
              disabled={loading || exportRows.length === 0}
              label={loading ? 'Chờ tải đủ dữ liệu...' : 'Xuất CSV'}
              count={exportRows.length}
            />
            <button type="button" className={styles.primaryBtn} onClick={onReloadAll} disabled={loading}>
              {loading ? <Spinner size={14} /> : <Icon.Refresh />}
              {loading ? 'Đang đồng bộ tự động...' : 'Làm mới dữ liệu bài tập'}
            </button>
          </div>
        }
        toolbarSlot={
          <TableToolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Tìm mã lớp, cơ sở, khoá học..."
            filterSlots={
              <div className={styles.toolbarCluster}>
                <MultiSelect
                  menuPosition="fixed"
                  options={tableCentreOptions}
                  selected={tableCentreFilter}
                  onChange={setTableCentreFilter}
                  placeholder={tableCentreFilter.length > 0 ? `Cơ sở (${tableCentreFilter.length})` : 'Tất cả cơ sở'}
                  searchable
                  maxDisplay={1}
                />
                <MultiSelect
                  menuPosition="fixed"
                  options={tableCourseLineOptions}
                  selected={tableCourseLineFilter}
                  onChange={setTableCourseLineFilter}
                  placeholder={tableCourseLineFilter.length > 0 ? `Khối học (${tableCourseLineFilter.length})` : 'Tất cả khối học'}
                  searchable
                  maxDisplay={1}
                />
                <span className={styles.metricText}>
                  Đã tải {loadedEntries.length}/{classes.length} lớp · {visibleClasses.length}/{classes.length} lớp hiển thị
                </span>
              </div>
            }
            hasFilter={hasTableFilter}
            onClearFilter={() => {
              setSearch('');
              setTableCentreFilter([]);
              setTableCourseLineFilter([]);
            }}
          />
        }
      >
        <div className={controlStyles.tableScroll}>
          <table className={controlStyles.table} style={{ minWidth: 900 }}>
            <thead><tr>
              {['Lớp', 'Cơ sở', 'Học viên', 'Bài đến hạn', 'Chưa nộp', 'Chờ chấm', 'Đã chấm', 'Tỷ lệ nộp', 'Tỷ lệ chấm', 'Buổi đủ / phần / trống', 'TB nộp / buổi', 'TB chấm / buổi'].map(label => <th key={label}>{label}</th>)}
            </tr></thead>
            <tbody>
              {visibleClasses.map(cls => {
                const record = records[cls.id];
                const summary = record?.data ? summarizeSubmissionData(record.data, cls, summaryOptions) : null;
                const sessionSummaries = record?.data ? summarizeSubmissionSessions(record.data, cls, summaryOptions) : [];
                const sessionsWithSubmissions = sessionSummaries.filter(session => session.submitted > 0);
                const averageSessionSubmission = sessionSummaries.length > 0 ? sessionSummaries.reduce((sum, session) => sum + session.submissionRate, 0) / sessionSummaries.length : 0;
                const averageSessionGrading = sessionsWithSubmissions.length > 0 ? sessionsWithSubmissions.reduce((sum, session) => sum + session.gradingRate, 0) / sessionsWithSubmissions.length : 0;
                return (
                  <tr key={cls.id} onClick={() => handleSelectClass(cls.id)} className={`${controlStyles.clickableRow} ${selectedClassId === cls.id ? controlStyles.rowSelected : ''}`}>
                    <td><strong>{cls.name}</strong><div className={controlStyles.secondaryText}>{cls.course?.name || '—'}</div></td>
                    <td>{cls.centre?.shortName || cls.centre?.name || '—'}</td>
                    {record?.state === 'loading' ? <td colSpan={10} style={{ color: 'var(--text-tertiary)' }}><Spinner size={14} /> Đang tải...</td>
                      : record?.state === 'error' ? <td colSpan={10} style={{ color: 'var(--status-error)' }}>Không tải được — bấm để thử lại</td>
                      : summary ? <>
                        <td>{getSubmissionStudents(record.data!, cls).length}</td>
                        <td>{sessionSummaries.length}</td>
                        <td><StatusPill status="missing" count={summary.missing} /></td>
                        <td><StatusPill status="pending" count={summary.pending} /></td>
                        <td><StatusPill status="graded" count={summary.graded} /></td>
                        <td className={controlStyles.primaryCell}>{summary.totalExpected ? `${summary.submissionRate.toFixed(1)}%` : '—'}</td>
                        <td className={controlStyles.primaryCell}>{summary.submitted ? `${summary.gradingRate.toFixed(1)}%` : '—'}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>{sessionSummaries.filter(session => session.completion === 'complete').length} / {sessionSummaries.filter(session => session.completion === 'partial').length} / {sessionSummaries.filter(session => session.completion === 'none').length}</td>
                        <td className={controlStyles.primaryCell}>{sessionSummaries.length ? `${averageSessionSubmission.toFixed(1)}%` : '—'}</td>
                        <td className={controlStyles.primaryCell}>{sessionsWithSubmissions.length ? `${averageSessionGrading.toFixed(1)}%` : '—'}</td>
                      </> : <td colSpan={10} style={{ color: 'var(--text-tertiary)' }}><Spinner size={14} /> Đang chờ đồng bộ tự động...</td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </AdminTableSection>

      {selectedClass && (
        <section className={controlStyles.panel}>
          <div className={controlStyles.panelHeader}>
            <div>
              <div className={controlStyles.panelTitle}>Chi tiết {selectedClass.name}</div>
              <div className={controlStyles.panelSubtitle}>{selectedClass.centre?.name} · {selectedClass.course?.name}</div>
            </div>
            <button type="button" onClick={() => onReloadClass(selectedClass.id)} disabled={selectedRecord?.state === 'loading'} className={controlStyles.secondaryButton}><Icon.Refresh /> Làm mới</button>
          </div>
          {selectedRecord?.state === 'loading' ? <div className={controlStyles.loadingPanel}><Spinner /> Đang tải chi tiết...</div>
            : selectedRecord?.state === 'error' ? <div className={`${controlStyles.emptyPanel} ${controlStyles.noticeError}`}>Không thể tải chi tiết lớp. Bấm “Làm mới” để thử lại.</div>
            : selectedData && <>
              <div className={controlStyles.searchBar}>
                <Icon.Search />
                <input className={controlStyles.textInput} value={studentSearch} onChange={event => setStudentSearch(event.target.value)} placeholder="Tìm học viên..." />
                <div className={controlStyles.segmented}>
                  {(['all', 'missing', 'pending', 'graded'] as const).map(status => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setStatusFilter(status)}
                      className={`${controlStyles.segmentButton} ${statusFilter === status ? controlStyles.segmentButtonActive : ''}`}
                    >
                      {status === 'all' ? 'Tất cả' : statusMeta[status].label}
                    </button>
                  ))}
                </div>
              </div>
              {selectedLessons.length === 0 ? <div className={controlStyles.emptyPanel}>Lớp chưa có bài học đang hoạt động.</div> : <div className={controlStyles.tableScroll}>
                <table className={controlStyles.table} style={{ minWidth: Math.max(700, 240 + selectedLessons.length * 150) }}>
                  <thead><tr><th className={controlStyles.stickyHeaderCell} style={{ minWidth: 220 }}>Học viên</th>{selectedLessons.map((lesson, index) => <th key={lesson.id} title={lesson.name} style={{ minWidth: 140, maxWidth: 180 }}>{index + 1}. {lesson.name}</th>)}</tr></thead>
                  <tbody>{selectedStudents.map(student => <tr key={student.studentUid}><td className={controlStyles.stickyBodyCell}><StudentHoverCard studentId={student.id} studentName={student.displayName} /></td>{selectedLessons.map(lesson => {
                    const cell = cellsByStudentLesson.get(`${student.studentUid}:${lesson.id}`)!;
                    return <td key={lesson.id} style={{ verticalAlign: 'top' }}><StatusPill status={cell.status} /><div className={controlStyles.secondaryText} style={{ lineHeight: 1.45 }}>{cell.dueAt ? <div>Hạn: {formatDateTime(cell.dueAt)}</div> : null}{cell.submission && cell.status === 'graded' && cell.submission.score !== null && cell.submission.score !== undefined ? <div>Điểm: {cell.submission.score}</div> : null}{cell.submission?.submittedAt ? <div>Nộp: {formatDateTime(cell.submission.submittedAt)}</div> : null}{cell.submission?.markedAt ? <div>Chấm: {formatDateTime(cell.submission.markedAt)}</div> : null}</div></td>;
                  })}</tr>)}</tbody>
                </table>
              </div>}
            </>}
        </section>
      )}
      <CSVExportSettings
        isOpen={showCSVSettings}
        onClose={() => setShowCSVSettings(false)}
        columns={csvColumns}
        onSave={saveCSVColumns}
        title="Cài đặt xuất CSV - Chấm bài tập"
      />
    </div>
  );
}
