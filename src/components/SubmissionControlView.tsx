'use client';

import { useCallback, useMemo, useState } from 'react';
import type { Class } from '@/types/classes';
import type { ClassSubmissionData } from '@/services/studentSubmissionService';
import type { ClassSubmissionRecord } from '@/hooks/useClassSubmissions';
import {
  buildSubmissionCells,
  getActiveSubmissionLessons,
  summarizeSubmissionData,
  summarizeSubmissionSessions,
  type SubmissionCellStatus,
} from '@/lib/submissionControl';
import { getCourseCategory } from '@/lib/courseCategories';
import { EmptyState, Icon, Spinner, StatCard } from '@/components/ui';
import { StudentHoverCard } from '@/components/StudentHoverCard';
import styles from '@/app/dashboard.module.css';

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

function StatusPill({ status, count }: { status: SubmissionCellStatus; count?: number }) {
  const meta = statusMeta[status];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 999, fontSize: 11, fontWeight: 650, color: meta.color, background: meta.background, whiteSpace: 'nowrap' }}>
      {meta.label}{count !== undefined ? `: ${count}` : ''}
    </span>
  );
}

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('vi-VN');
}

export function ClassSubmissionDetail({ record, cls, onRetry }: { record?: ClassSubmissionRecord; cls?: Class; onRetry?: () => void }) {
  if (!record || record.state === 'idle' || record.state === 'loading') {
    return <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-tertiary)' }}><Spinner size={18} /> Đang đồng bộ tình trạng bài tập...</div>;
  }
  if (record.state === 'error' || !record.data) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <div style={{ color: 'var(--status-error)', fontWeight: 600 }}>Không thể tải dữ liệu bài tập của lớp.</div>
        {record.error && <div style={{ marginTop: 6, color: 'var(--text-tertiary)', fontSize: 11, wordBreak: 'break-word' }}>{record.error}</div>}
        {onRetry && <button type="button" onClick={onRetry} style={{ marginTop: 10, border: '1px solid var(--border-primary)', borderRadius: 8, background: 'var(--bg-elevated)', color: 'var(--text-primary)', padding: '7px 10px', cursor: 'pointer' }}><Icon.Refresh /> Thử lại</button>}
      </div>
    );
  }

  const data = record.data;
  const lessons = getActiveSubmissionLessons(data, cls);
  const cells = buildSubmissionCells(data, cls);
  const summary = summarizeSubmissionData(data, cls);
  const sessionSummaries = summarizeSubmissionSessions(data, cls);
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
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10, padding: '8px 10px', borderRadius: 8, background: 'var(--bg-elevated)', color: 'var(--text-secondary)', fontSize: 11 }}>
        <strong>Theo buổi đã đến hạn:</strong>
        <span>Đủ bài: {completeSessions}</span>
        <span>Một phần: {partialSessions}</span>
        <span>Chưa có bài: {emptySessions}</span>
        <span>TB nộp/buổi: {sessionSummaries.length ? `${averageSessionSubmissionRate.toFixed(1)}%` : '—'}</span>
        <span>TB chấm/buổi: {sessionsWithSubmissions.length ? `${averageSessionGradingRate.toFixed(1)}%` : '—'}</span>
      </div>
      {lessons.length === 0 ? (
        <div style={{ padding: 18, textAlign: 'center', color: 'var(--text-tertiary)' }}>Lớp chưa có bài học đang hoạt động.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', fontSize: 11, minWidth: Math.max(620, 200 + lessons.length * 130) }}>
            <thead><tr style={{ background: 'var(--bg-elevated)' }}>
              <th style={{ position: 'sticky', left: 0, zIndex: 2, background: 'var(--bg-elevated)', padding: 8, minWidth: 190, textAlign: 'left', borderBottom: '1px solid var(--border-primary)' }}>Học viên</th>
              {lessons.map((lesson, index) => <th key={lesson.id} title={lesson.name} style={{ padding: 8, minWidth: 120, textAlign: 'left', borderBottom: '1px solid var(--border-primary)' }}>{index + 1}. {lesson.name}</th>)}
            </tr></thead>
            <tbody>{data.students.map(student => <tr key={student.studentUid}>
              <td style={{ position: 'sticky', left: 0, background: 'var(--bg-surface)', padding: 8, fontWeight: 650, borderBottom: '1px solid var(--border-primary)' }}>
                <StudentHoverCard studentId={student.id} studentName={student.displayName} />
              </td>
              {lessons.map(lesson => {
                const cell = cellsByKey.get(`${student.studentUid}:${lesson.id}`)!;
                return <td key={lesson.id} style={{ padding: 7, borderBottom: '1px solid var(--border-primary)', verticalAlign: 'top' }}><StatusPill status={cell.status} />{cell.dueAt && <div style={{ marginTop: 4, color: 'var(--text-tertiary)' }}>Hạn: {formatDateTime(cell.dueAt)}</div>}{cell.submission?.score !== null && cell.submission?.score !== undefined && cell.status === 'graded' ? <div style={{ marginTop: 3, color: 'var(--text-tertiary)' }}>Điểm: {cell.submission.score}</div> : null}</td>;
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
  onReloadClass,
  onReloadAll,
}: {
  classes: Class[];
  records: Record<string, ClassSubmissionRecord>;
  loading: boolean;
  onReloadClass: (classId: string) => void;
  onReloadAll: () => void;
}) {
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | SubmissionCellStatus>('all');
  const [breakdownDimension, setBreakdownDimension] = useState<SubmissionBreakdownDimension>('centre');
  const visibleClasses = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase('vi');
    if (!normalized) return classes;
    return classes.filter(cls => [cls.name, cls.centre?.name, cls.centre?.shortName, cls.course?.name]
      .some(value => (value || '').toLocaleLowerCase('vi').includes(normalized)));
  }, [classes, search]);

  const handleSelectClass = useCallback((classId: string) => {
    setSelectedClassId(classId);
    setStudentSearch('');
    setStatusFilter('all');
  }, []);

  const loadedEntries = useMemo(() => classes
    .map(cls => ({ cls, record: records[cls.id] }))
    .filter((entry): entry is { cls: Class; record: ClassSubmissionRecord & { data: ClassSubmissionData } } => entry.record?.state === 'loaded' && Boolean(entry.record.data)), [classes, records]);
  const aggregate = useMemo(() => loadedEntries.reduce((total, { cls, record }) => {
    const summary = summarizeSubmissionData(record.data, cls);
    total.expected += summary.totalExpected;
    total.missing += summary.missing;
    total.pending += summary.pending;
    total.graded += summary.graded;
    return total;
  }, { expected: 0, missing: 0, pending: 0, graded: 0 }), [loadedEntries]);
  const aggregateSubmitted = aggregate.pending + aggregate.graded;
  const aggregateGradingRate = aggregateSubmitted > 0 ? (aggregate.graded / aggregateSubmitted) * 100 : 0;
  const failedClassCount = classes.filter(cls => records[cls.id]?.state === 'error').length;
  const pendingClassCount = classes.length - loadedEntries.length - failedClassCount;
  const hasIncompleteCoverage = loadedEntries.length < classes.length;
  const coverageRate = classes.length > 0 ? (loadedEntries.length / classes.length) * 100 : 0;
  const aggregateSessions = useMemo(() => loadedEntries.flatMap(({ cls, record }) => (
    summarizeSubmissionSessions(record.data, cls)
  )), [loadedEntries]);
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
        const summary = summarizeSubmissionData(record.data, cls);
        row.loadedClasses += 1;
        row.expected += summary.totalExpected;
        row.missing += summary.missing;
        row.pending += summary.pending;
        row.graded += summary.graded;
        row.sessions.push(...summarizeSubmissionSessions(record.data, cls));
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
  }, [breakdownDimension, classes, records]);

  const selectedClass = classes.find(cls => cls.id === selectedClassId);
  const selectedRecord = selectedClassId ? records[selectedClassId] : undefined;
  const selectedData = selectedRecord?.data;
  const selectedCells = selectedData ? buildSubmissionCells(selectedData, selectedClass) : [];
  const selectedDueLessonIds = new Set(selectedData
    ? summarizeSubmissionSessions(selectedData, selectedClass).map(session => session.lesson.id)
    : []);
  const selectedLessons = selectedData
    ? getActiveSubmissionLessons(selectedData, selectedClass).filter(lesson => selectedDueLessonIds.has(lesson.id))
    : [];
  const cellsByStudentLesson = new Map(selectedCells.map(cell => [`${cell.student.studentUid}:${cell.lesson.id}`, cell]));
  const selectedStudents = (selectedData?.students || []).filter(student => {
    const matchesSearch = student.displayName.toLocaleLowerCase('vi').includes(studentSearch.trim().toLocaleLowerCase('vi'));
    if (!matchesSearch) return false;
    if (statusFilter === 'all') return true;
    return selectedLessons.some(lesson => cellsByStudentLesson.get(`${student.studentUid}:${lesson.id}`)?.status === statusFilter);
  });

  if (classes.length === 0) {
    return <EmptyState icon={<Icon.BookOpen size={42} />} title="Chưa có lớp để kiểm tra" subtitle="Tải dữ liệu lớp bằng bộ lọc phía trên trước khi xem tình trạng bài tập." />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', marginTop: 'var(--space-2)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18 }}>Kiểm soát nộp và chấm bài</h2>
          <div style={{ color: 'var(--text-tertiary)', fontSize: 12, marginTop: 4 }}>
            Đã tải {loadedEntries.length}/{classes.length} lớp trong phạm vi hiện tại.
          </div>
        </div>
        <button type="button" className={styles.primaryBtn} onClick={onReloadAll} disabled={loading}>
          {loading ? <Spinner size={14} /> : <Icon.Refresh />}
          {loading ? 'Đang đồng bộ tự động...' : 'Làm mới dữ liệu bài tập'}
        </button>
      </div>

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
        <div style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(245, 158, 11, 0.3)', background: 'rgba(245, 158, 11, 0.08)', color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.5 }}>
          <strong>Thống kê đang tạm tính trên {loadedEntries.length}/{classes.length} lớp.</strong>{' '}
          {failedClassCount > 0 ? `${failedClassCount} lớp tải lỗi. ` : ''}
          {pendingClassCount > 0 ? `${pendingClassCount} lớp đang chờ tải. ` : ''}
          Các lớp chưa tải thành công không nằm trong tử số hoặc mẫu số. Bấm “Làm mới dữ liệu bài tập” để thử lại.
        </div>
      )}

      {aggregateSessions.length > 0 && (
        <div>
          <div style={{ marginBottom: 8, fontSize: 12, fontWeight: 650, color: 'var(--text-secondary)' }}>QUY ĐỔI THEO BUỔI ĐÃ ĐẾN HẠN{hasIncompleteCoverage ? ' · TẠM TÍNH' : ''}</div>
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
        <section style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-card)', overflow: 'hidden' }}>
          <div style={{ padding: 12, borderBottom: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div>
              <strong style={{ fontSize: 13 }}>Phân loại thống kê bài tập</strong>
              <div style={{ color: 'var(--text-tertiary)', fontSize: 11, marginTop: 3 }}>Chỉ tính bài và buổi đã đến hạn · xếp tỷ lệ nộp thấp trước</div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {([
                ['centre', 'Theo cơ sở'],
                ['courseLine', 'Theo khối học'],
                ['centreCourseLine', 'Cơ sở × khối'],
              ] as [SubmissionBreakdownDimension, string][]).map(([dimension, label]) => (
                <button key={dimension} type="button" onClick={() => setBreakdownDimension(dimension)} style={{ padding: '6px 9px', borderRadius: 999, border: breakdownDimension === dimension ? '1px solid var(--brand-indigo)' : '1px solid var(--border-primary)', background: breakdownDimension === dimension ? 'rgba(99,102,241,0.09)' : 'transparent', color: breakdownDimension === dimension ? 'var(--brand-indigo)' : 'var(--text-secondary)', cursor: 'pointer', fontSize: 11, fontWeight: 650 }}>{label}</button>
              ))}
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 900, borderCollapse: 'collapse', fontSize: 12 }}>
              <thead><tr style={{ background: 'var(--bg-elevated)', textAlign: 'left' }}>
                {['Nhóm', 'Độ phủ lớp', 'Bài đến hạn', 'Chưa nộp', 'Chờ chấm', 'Tỷ lệ nộp', 'Tỷ lệ chấm', 'TB nộp / buổi', 'TB chấm / buổi'].map(label => <th key={label} style={{ padding: '9px 12px', borderBottom: '1px solid var(--border-primary)', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{label}</th>)}
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
                  <td style={{ padding: 12, borderBottom: '1px solid var(--border-primary)', fontWeight: 700 }}>{row.label}{row.secondaryLabel && <div style={{ marginTop: 2, color: 'var(--text-tertiary)', fontSize: 11, fontWeight: 500 }}>{row.secondaryLabel}</div>}</td>
                  <td style={{ padding: 12, borderBottom: '1px solid var(--border-primary)', color: incomplete ? 'var(--status-warning)' : 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{row.loadedClasses}/{row.totalClasses}{incomplete ? ' · tạm tính' : ''}</td>
                  <td style={{ padding: 12, borderBottom: '1px solid var(--border-primary)' }}>{row.expected.toLocaleString('vi-VN')}</td>
                  <td style={{ padding: 12, borderBottom: '1px solid var(--border-primary)', color: row.missing > 0 ? 'var(--status-error)' : undefined, fontWeight: 650 }}>{row.missing.toLocaleString('vi-VN')}</td>
                  <td style={{ padding: 12, borderBottom: '1px solid var(--border-primary)', color: row.pending > 0 ? 'var(--status-warning)' : undefined, fontWeight: 650 }}>{row.pending.toLocaleString('vi-VN')}</td>
                  <td style={{ padding: 12, borderBottom: '1px solid var(--border-primary)', fontWeight: 700 }}>{submissionRate === null ? '—' : `${submissionRate.toFixed(1)}%`}</td>
                  <td style={{ padding: 12, borderBottom: '1px solid var(--border-primary)', fontWeight: 700 }}>{gradingRate === null ? '—' : `${gradingRate.toFixed(1)}%`}</td>
                  <td style={{ padding: 12, borderBottom: '1px solid var(--border-primary)', fontWeight: 700 }}>{averageSubmission === null ? '—' : `${averageSubmission.toFixed(1)}%`}</td>
                  <td style={{ padding: 12, borderBottom: '1px solid var(--border-primary)', fontWeight: 700 }}>{averageGrading === null ? '—' : `${averageGrading.toFixed(1)}%`}</td>
                </tr>;
              })}</tbody>
            </table>
          </div>
        </section>
      )}

      <section style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-card)', overflow: 'hidden' }}>
        <div style={{ padding: 12, borderBottom: '1px solid var(--border-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon.Search />
          <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Tìm mã lớp, cơ sở, khoá học..." style={{ flex: 1, minWidth: 180, border: 0, outline: 0, background: 'transparent', color: 'var(--text-primary)', fontSize: 13 }} />
          <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>{visibleClasses.length} lớp</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 900, borderCollapse: 'collapse', fontSize: 12 }}>
            <thead><tr style={{ background: 'var(--bg-elevated)', textAlign: 'left' }}>
              {['Lớp', 'Cơ sở', 'Học viên', 'Bài đến hạn', 'Chưa nộp', 'Chờ chấm', 'Đã chấm', 'Tỷ lệ nộp', 'Tỷ lệ chấm', 'Buổi đủ / phần / trống', 'TB nộp / buổi', 'TB chấm / buổi'].map(label => <th key={label} style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-primary)', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{label}</th>)}
            </tr></thead>
            <tbody>
              {visibleClasses.map(cls => {
                const record = records[cls.id];
                const summary = record?.data ? summarizeSubmissionData(record.data, cls) : null;
                const sessionSummaries = record?.data ? summarizeSubmissionSessions(record.data, cls) : [];
                const sessionsWithSubmissions = sessionSummaries.filter(session => session.submitted > 0);
                const averageSessionSubmission = sessionSummaries.length > 0 ? sessionSummaries.reduce((sum, session) => sum + session.submissionRate, 0) / sessionSummaries.length : 0;
                const averageSessionGrading = sessionsWithSubmissions.length > 0 ? sessionsWithSubmissions.reduce((sum, session) => sum + session.gradingRate, 0) / sessionsWithSubmissions.length : 0;
                return (
                  <tr key={cls.id} onClick={() => handleSelectClass(cls.id)} style={{ cursor: 'pointer', background: selectedClassId === cls.id ? 'rgba(99, 102, 241, 0.06)' : undefined }}>
                    <td style={{ padding: 12, borderBottom: '1px solid var(--border-primary)' }}><strong>{cls.name}</strong><div style={{ color: 'var(--text-tertiary)', marginTop: 2 }}>{cls.course?.name || '—'}</div></td>
                    <td style={{ padding: 12, borderBottom: '1px solid var(--border-primary)' }}>{cls.centre?.shortName || cls.centre?.name || '—'}</td>
                    {record?.state === 'loading' ? <td colSpan={10} style={{ padding: 12, borderBottom: '1px solid var(--border-primary)', color: 'var(--text-tertiary)' }}><Spinner size={14} /> Đang tải...</td>
                      : record?.state === 'error' ? <td colSpan={10} style={{ padding: 12, borderBottom: '1px solid var(--border-primary)', color: 'var(--status-error)' }}>Không tải được — bấm để thử lại</td>
                      : summary ? <>
                        <td style={{ padding: 12, borderBottom: '1px solid var(--border-primary)' }}>{record.data?.students.length || 0}</td>
                        <td style={{ padding: 12, borderBottom: '1px solid var(--border-primary)' }}>{sessionSummaries.length}</td>
                        <td style={{ padding: 12, borderBottom: '1px solid var(--border-primary)' }}><StatusPill status="missing" count={summary.missing} /></td>
                        <td style={{ padding: 12, borderBottom: '1px solid var(--border-primary)' }}><StatusPill status="pending" count={summary.pending} /></td>
                        <td style={{ padding: 12, borderBottom: '1px solid var(--border-primary)' }}><StatusPill status="graded" count={summary.graded} /></td>
                        <td style={{ padding: 12, borderBottom: '1px solid var(--border-primary)', fontWeight: 700 }}>{summary.totalExpected ? `${summary.submissionRate.toFixed(1)}%` : '—'}</td>
                        <td style={{ padding: 12, borderBottom: '1px solid var(--border-primary)', fontWeight: 700 }}>{summary.submitted ? `${summary.gradingRate.toFixed(1)}%` : '—'}</td>
                        <td style={{ padding: 12, borderBottom: '1px solid var(--border-primary)', whiteSpace: 'nowrap' }}>{sessionSummaries.filter(session => session.completion === 'complete').length} / {sessionSummaries.filter(session => session.completion === 'partial').length} / {sessionSummaries.filter(session => session.completion === 'none').length}</td>
                        <td style={{ padding: 12, borderBottom: '1px solid var(--border-primary)', fontWeight: 700 }}>{sessionSummaries.length ? `${averageSessionSubmission.toFixed(1)}%` : '—'}</td>
                        <td style={{ padding: 12, borderBottom: '1px solid var(--border-primary)', fontWeight: 700 }}>{sessionsWithSubmissions.length ? `${averageSessionGrading.toFixed(1)}%` : '—'}</td>
                      </> : <td colSpan={10} style={{ padding: 12, borderBottom: '1px solid var(--border-primary)', color: 'var(--text-tertiary)' }}><Spinner size={14} /> Đang chờ đồng bộ tự động...</td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {selectedClass && (
        <section style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-card)', overflow: 'hidden' }}>
          <div style={{ padding: 14, borderBottom: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div><strong>Chi tiết {selectedClass.name}</strong><div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 3 }}>{selectedClass.centre?.name} · {selectedClass.course?.name}</div></div>
            <button type="button" onClick={() => onReloadClass(selectedClass.id)} disabled={selectedRecord?.state === 'loading'} style={{ border: '1px solid var(--border-primary)', borderRadius: 8, background: 'var(--bg-elevated)', color: 'var(--text-primary)', padding: '7px 10px', cursor: 'pointer' }}><Icon.Refresh /> Làm mới</button>
          </div>
          {selectedRecord?.state === 'loading' ? <div style={{ padding: 32, textAlign: 'center' }}><Spinner /> Đang tải chi tiết...</div>
            : selectedRecord?.state === 'error' ? <div style={{ padding: 30, textAlign: 'center', color: 'var(--status-error)' }}>Không thể tải chi tiết lớp. Bấm “Làm mới” để thử lại.</div>
            : selectedData && <>
              <div style={{ padding: 12, display: 'flex', gap: 8, flexWrap: 'wrap', borderBottom: '1px solid var(--border-primary)' }}>
                <input value={studentSearch} onChange={event => setStudentSearch(event.target.value)} placeholder="Tìm học viên..." style={{ minWidth: 220, padding: '8px 10px', border: '1px solid var(--border-primary)', borderRadius: 8, background: 'var(--bg-elevated)', color: 'var(--text-primary)' }} />
                {(['all', 'missing', 'pending', 'graded'] as const).map(status => <button key={status} type="button" onClick={() => setStatusFilter(status)} style={{ padding: '7px 10px', borderRadius: 999, border: statusFilter === status ? '1px solid var(--brand-indigo)' : '1px solid var(--border-primary)', background: statusFilter === status ? 'rgba(99,102,241,0.09)' : 'transparent', color: statusFilter === status ? 'var(--brand-indigo)' : 'var(--text-secondary)', cursor: 'pointer', fontSize: 12 }}>{status === 'all' ? 'Tất cả' : statusMeta[status].label}</button>)}
              </div>
              {selectedLessons.length === 0 ? <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-tertiary)' }}>Lớp chưa có bài học đang hoạt động.</div> : <div style={{ overflowX: 'auto' }}>
                <table style={{ borderCollapse: 'collapse', fontSize: 11, minWidth: Math.max(700, 240 + selectedLessons.length * 150) }}>
                  <thead><tr style={{ background: 'var(--bg-elevated)' }}><th style={{ position: 'sticky', left: 0, zIndex: 2, background: 'var(--bg-elevated)', padding: 10, minWidth: 220, textAlign: 'left', borderBottom: '1px solid var(--border-primary)' }}>Học viên</th>{selectedLessons.map((lesson, index) => <th key={lesson.id} title={lesson.name} style={{ padding: 10, minWidth: 140, maxWidth: 180, textAlign: 'left', borderBottom: '1px solid var(--border-primary)' }}>{index + 1}. {lesson.name}</th>)}</tr></thead>
                  <tbody>{selectedStudents.map(student => <tr key={student.studentUid}><td style={{ position: 'sticky', left: 0, background: 'var(--bg-surface)', padding: 10, fontWeight: 650, borderBottom: '1px solid var(--border-primary)' }}><StudentHoverCard studentId={student.id} studentName={student.displayName} /></td>{selectedLessons.map(lesson => {
                    const cell = cellsByStudentLesson.get(`${student.studentUid}:${lesson.id}`)!;
                    return <td key={lesson.id} style={{ padding: 8, borderBottom: '1px solid var(--border-primary)', verticalAlign: 'top' }}><StatusPill status={cell.status} /><div style={{ color: 'var(--text-tertiary)', marginTop: 5, lineHeight: 1.45 }}>{cell.dueAt ? <div>Hạn: {formatDateTime(cell.dueAt)}</div> : null}{cell.submission && cell.status === 'graded' && cell.submission.score !== null && cell.submission.score !== undefined ? <div>Điểm: {cell.submission.score}</div> : null}{cell.submission?.submittedAt ? <div>Nộp: {formatDateTime(cell.submission.submittedAt)}</div> : null}{cell.submission?.markedAt ? <div>Chấm: {formatDateTime(cell.submission.markedAt)}</div> : null}</div></td>;
                  })}</tr>)}</tbody>
                </table>
              </div>}
            </>}
        </section>
      )}
    </div>
  );
}
