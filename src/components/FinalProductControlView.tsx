'use client';

import { useCallback, useMemo, useState } from 'react';
import type { Class, FinalProductClassStats, StudentWork } from '@/types/classes';
import {
  buildFinalProductClassStats,
  buildStudentWorksByStudentId,
  getActiveClassStudents,
  getStudentWorkAssetCount,
  getStudentWorkStatusMeta,
} from '@/lib/studentWorks';
import { getCourseCategory } from '@/lib/courseCategories';
import { exportToCSV, type CSVColumn } from '@/lib/csvExport';
import { useCSVExportPreferences } from '@/hooks/useCSVExportPreferences';
import {
  CSVExportSettings,
  EmptyState,
  ExportButton,
  Icon,
  MultiSelect,
  type SelectOption,
  Spinner,
  StatCard,
  type CSVColumnConfig,
} from '@/components/ui';
import { StudentHoverCard } from '@/components/StudentHoverCard';
import styles from '@/app/dashboard.module.css';

type BreakdownDimension = 'centre' | 'courseLine' | 'centreCourseLine';

interface ClassFinalProductRow {
  cls: Class;
  stats: FinalProductClassStats;
  worksByStudent: Map<string, StudentWork>;
}

interface FinalProductExportRow {
  centre: string;
  courseLine: string;
  className: string;
  classId: string;
  courseName: string;
  teachers: string;
  finalSessionAt: string;
  studentName: string;
  studentId: string;
  status: string;
  lmsStatus: string;
  title: string;
  assetCount: number | string;
  version: number | string;
  createdBy: string;
  createdAt: string;
  lastModifiedBy: string;
  lastModifiedAt: string;
  comment: string;
  rejectReason: string;
}

const defaultExportColumns: CSVColumnConfig[] = [
  { id: 'centre', label: 'Cơ sở', enabled: true },
  { id: 'courseLine', label: 'Khối học', enabled: true },
  { id: 'className', label: 'Lớp', enabled: true },
  { id: 'classId', label: 'Class ID', enabled: false },
  { id: 'courseName', label: 'Khóa học', enabled: true },
  { id: 'teachers', label: 'Giáo viên', enabled: true },
  { id: 'finalSessionAt', label: 'Thời gian buổi cuối', enabled: true },
  { id: 'studentName', label: 'Học viên', enabled: true },
  { id: 'studentId', label: 'Student ID', enabled: false },
  { id: 'status', label: 'Trạng thái', enabled: true },
  { id: 'lmsStatus', label: 'Trạng thái LMS', enabled: true },
  { id: 'title', label: 'Tên sản phẩm', enabled: true },
  { id: 'assetCount', label: 'Số tài nguyên', enabled: true },
  { id: 'version', label: 'Phiên bản', enabled: false },
  { id: 'createdBy', label: 'Người tạo', enabled: false },
  { id: 'createdAt', label: 'Thời gian tạo', enabled: true },
  { id: 'lastModifiedBy', label: 'Người cập nhật', enabled: true },
  { id: 'lastModifiedAt', label: 'Cập nhật gần nhất', enabled: true },
  { id: 'comment', label: 'Nhận xét', enabled: true },
  { id: 'rejectReason', label: 'Lý do từ chối', enabled: true },
];

const exportColumnMap: Record<string, CSVColumn<FinalProductExportRow>> = Object.fromEntries(
  defaultExportColumns.map(column => [column.id, {
    header: column.label,
    accessor: column.id as keyof FinalProductExportRow,
  }]),
);

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('vi-VN');
}

function getTeachers(cls: Class) {
  return (cls.teachers || [])
    .filter(slot => slot.isActive)
    .map(slot => `${slot.teacher.fullName}${slot.role?.shortName ? ` (${slot.role.shortName})` : ''}`)
    .join('; ');
}

function getStudentStatus(work: StudentWork | undefined, isDue: boolean) {
  if (work) return getStudentWorkStatusMeta(work.status);
  return isDue
    ? { label: 'Chưa nộp · quá hạn', color: 'var(--status-error)', bg: 'rgba(220, 38, 38, 0.08)' }
    : { label: 'Chưa tới hạn', color: 'var(--text-tertiary)', bg: 'var(--bg-elevated)' };
}

function StatusPill({ work, isDue }: { work?: StudentWork; isDue: boolean }) {
  const meta = getStudentStatus(work, isDue);
  return <span style={{ display: 'inline-flex', padding: '3px 8px', borderRadius: 999, fontSize: 11, fontWeight: 650, color: meta.color, background: meta.bg, whiteSpace: 'nowrap' }}>{meta.label}</span>;
}

export function FinalProductControlView({
  classes,
  works,
  loading,
  error,
  onReload,
}: {
  classes: Class[];
  works: StudentWork[];
  loading: boolean;
  error?: string | null;
  onReload: () => void;
}) {
  const [search, setSearch] = useState('');
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [breakdownDimension, setBreakdownDimension] = useState<BreakdownDimension>('centre');
  const [breakdownCentreFilter, setBreakdownCentreFilter] = useState<string[]>([]);
  const [breakdownCourseLineFilter, setBreakdownCourseLineFilter] = useState<string[]>([]);
  const [showCSVSettings, setShowCSVSettings] = useState(false);
  const { columns: csvColumns, saveColumns } = useCSVExportPreferences('operations-final-products', defaultExportColumns);

  const worksByClass = useMemo(() => {
    const result = new Map<string, StudentWork[]>();
    works.forEach(work => {
      if (!work.classId) return;
      const current = result.get(work.classId) || [];
      current.push(work);
      result.set(work.classId, current);
    });
    return result;
  }, [works]);

  const classRows = useMemo<ClassFinalProductRow[]>(() => classes.map(cls => {
    const classWorks = worksByClass.get(cls.id) || [];
    const activeStudentIds = new Set(getActiveClassStudents(cls).map(student => student.id));
    return {
      cls,
      stats: buildFinalProductClassStats(cls, classWorks),
      worksByStudent: buildStudentWorksByStudentId(classWorks, activeStudentIds),
    };
  }), [classes, worksByClass]);

  const dueRows = useMemo(() => classRows.filter(row => row.stats.isFinalSessionCompleted), [classRows]);
  const breakdownCentreOptions = useMemo<SelectOption[]>(() => {
    const options = new Map<string, SelectOption>();
    dueRows.forEach(row => {
      const value = row.cls.centre?.id || row.cls.centre?.name || 'unknown';
      const label = row.cls.centre?.shortName || row.cls.centre?.name || 'Chưa xác định cơ sở';
      if (!options.has(value)) options.set(value, { value, label });
    });
    return [...options.values()].sort((left, right) => left.label.localeCompare(right.label, 'vi'));
  }, [dueRows]);
  const breakdownCourseLineOptions = useMemo<SelectOption[]>(() => {
    const options = new Map<string, SelectOption>();
    dueRows.forEach(row => {
      const value = getCourseCategory(row.cls);
      if (!options.has(value)) options.set(value, { value, label: value });
    });
    return [...options.values()].sort((left, right) => left.label.localeCompare(right.label, 'vi'));
  }, [dueRows]);
  const filteredBreakdownSourceRows = useMemo(() => dueRows.filter(row => {
    const centreValue = row.cls.centre?.id || row.cls.centre?.name || 'unknown';
    const courseLineValue = getCourseCategory(row.cls);
    if (breakdownCentreFilter.length > 0 && !breakdownCentreFilter.includes(centreValue)) return false;
    if (breakdownCourseLineFilter.length > 0 && !breakdownCourseLineFilter.includes(courseLineValue)) return false;
    return true;
  }), [breakdownCentreFilter, breakdownCourseLineFilter, dueRows]);
  const aggregate = dueRows.reduce((total, row) => ({
    expected: total.expected + row.stats.totalStudents,
    submitted: total.submitted + row.stats.submittedCount,
    missing: total.missing + row.stats.missingCount,
    pending: total.pending + row.stats.pendingCount,
    approved: total.approved + row.stats.approvedCount,
    rejected: total.rejected + row.stats.rejectedCount,
  }), { expected: 0, submitted: 0, missing: 0, pending: 0, approved: 0, rejected: 0 });
  const submissionRate = aggregate.expected > 0 ? aggregate.submitted / aggregate.expected * 100 : 0;
  const approvalRate = aggregate.submitted > 0 ? aggregate.approved / aggregate.submitted * 100 : 0;

  const visibleRows = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase('vi');
    if (!normalized) return classRows;
    return classRows.filter(row => [row.cls.name, row.cls.centre?.name, row.cls.centre?.shortName, row.cls.course?.name]
      .some(value => (value || '').toLocaleLowerCase('vi').includes(normalized)));
  }, [classRows, search]);

  const breakdownRows = (() => {
    const groups = new Map<string, { key: string; label: string; secondary?: string; classes: number; expected: number; submitted: number; missing: number; pending: number; approved: number; rejected: number }>();
    filteredBreakdownSourceRows.forEach(row => {
      const centreKey = row.cls.centre?.id || row.cls.centre?.name || 'unknown';
      const centreLabel = row.cls.centre?.shortName || row.cls.centre?.name || 'Chưa xác định cơ sở';
      const courseLine = getCourseCategory(row.cls);
      const key = breakdownDimension === 'centre' ? centreKey : breakdownDimension === 'courseLine' ? courseLine : `${centreKey}:${courseLine}`;
      const current = groups.get(key) || {
        key,
        label: breakdownDimension === 'courseLine' ? courseLine : centreLabel,
        secondary: breakdownDimension === 'centreCourseLine' ? courseLine : undefined,
        classes: 0, expected: 0, submitted: 0, missing: 0, pending: 0, approved: 0, rejected: 0,
      };
      current.classes += 1;
      current.expected += row.stats.totalStudents;
      current.submitted += row.stats.submittedCount;
      current.missing += row.stats.missingCount;
      current.pending += row.stats.pendingCount;
      current.approved += row.stats.approvedCount;
      current.rejected += row.stats.rejectedCount;
      groups.set(key, current);
    });
    return [...groups.values()].sort((a, b) => {
      const aRate = a.expected > 0 ? a.submitted / a.expected : Number.POSITIVE_INFINITY;
      const bRate = b.expected > 0 ? b.submitted / b.expected : Number.POSITIVE_INFINITY;
      return aRate - bRate || a.label.localeCompare(b.label, 'vi');
    });
  })();
  const hasBreakdownFilter = breakdownCentreFilter.length > 0 || breakdownCourseLineFilter.length > 0;

  const exportRows: FinalProductExportRow[] = dueRows.flatMap(row => {
    const teachers = getTeachers(row.cls);
    return getActiveClassStudents(row.cls).map(student => {
      const work = row.worksByStudent.get(student.id);
      return {
        centre: row.cls.centre?.shortName || row.cls.centre?.name || '',
        courseLine: getCourseCategory(row.cls),
        className: row.cls.name,
        classId: row.cls.id,
        courseName: row.cls.course?.name || '',
        teachers,
        finalSessionAt: formatDateTime(row.stats.finalSessionDate),
        studentName: student.name,
        studentId: student.id,
        status: getStudentStatus(work, true).label,
        lmsStatus: work?.status || '',
        title: work?.latestData?.title || '',
        assetCount: work ? getStudentWorkAssetCount(work) : '',
        version: work?.version ?? '',
        createdBy: work?.createdBy?.displayName || '',
        createdAt: formatDateTime(work?.createdAt),
        lastModifiedBy: work?.lastModifiedBy?.displayName || '',
        lastModifiedAt: formatDateTime(work?.lastModifiedAt),
        comment: work?.latestData?.comment || '',
        rejectReason: work?.latestData?.rejectReason || '',
      };
    });
  });

  const handleExport = useCallback(() => {
    const selectedColumns = csvColumns
      .filter(column => column.enabled)
      .map(column => exportColumnMap[column.id])
      .filter((column): column is CSVColumn<FinalProductExportRow> => Boolean(column));
    exportToCSV(exportRows, selectedColumns, 'kiem-soat-san-pham-cuoi-khoa');
  }, [csvColumns, exportRows]);

  const selectedRow = classRows.find(row => row.cls.id === selectedClassId);
  const showBreakdown = new Set(classes.map(cls => cls.centre?.id)).size > 1
    || new Set(classes.map(cls => getCourseCategory(cls))).size > 1;

  if (classes.length === 0) {
    return <EmptyState icon={<Icon.Target size={42} />} title="Chưa có lớp để kiểm tra" subtitle="Tải dữ liệu lớp bằng bộ lọc phía trên trước khi xem sản phẩm cuối khoá." />;
  }

  return <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', marginTop: 'var(--space-2)' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 18 }}>Kiểm soát nộp sản phẩm cuối khoá</h2>
        <div style={{ color: 'var(--text-tertiary)', fontSize: 12, marginTop: 4 }}>{dueRows.length}/{classes.length} lớp đã đến buổi cuối · dữ liệu tải theo batch.</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <ExportButton onClick={handleExport} onSettingsClick={() => setShowCSVSettings(true)} disabled={loading || exportRows.length === 0} label="Xuất CSV" count={exportRows.length} />
        <button type="button" className={styles.primaryBtn} onClick={onReload} disabled={loading}>{loading ? <Spinner size={14} /> : <Icon.Refresh />}{loading ? 'Đang đồng bộ...' : 'Làm mới dữ liệu'}</button>
      </div>
    </div>

    {error && <div style={{ padding: '10px 12px', borderRadius: 8, color: 'var(--status-error)', background: 'rgba(220,38,38,.08)' }}>Không thể tải dữ liệu sản phẩm cuối khoá. {error}</div>}

    {!error && <>
      <div className={styles.statsGrid}>
        <StatCard label="CẦN NỘP" value={aggregate.expected.toLocaleString('vi-VN')} desc={`${dueRows.length} lớp đã đến hạn`} />
        <StatCard label="CHƯA NỘP" value={aggregate.missing.toLocaleString('vi-VN')} desc={aggregate.expected ? `${(aggregate.missing / aggregate.expected * 100).toFixed(1)}% học viên` : 'Chưa có lớp đến hạn'} />
        <StatCard label="CHỜ DUYỆT" value={aggregate.pending.toLocaleString('vi-VN')} desc="Gồm bản nháp/chờ xử lý" />
        <StatCard label="BỊ TỪ CHỐI" value={aggregate.rejected.toLocaleString('vi-VN')} desc="Cần học viên cập nhật lại" />
        <StatCard label="ĐÃ DUYỆT" value={aggregate.approved.toLocaleString('vi-VN')} desc={aggregate.submitted ? `${approvalRate.toFixed(1)}% sản phẩm đã nộp` : 'Chưa có sản phẩm'} />
        <StatCard label="TỶ LỆ NỘP" value={aggregate.expected ? `${submissionRate.toFixed(1)}%` : '—'} desc={aggregate.expected ? `${aggregate.submitted}/${aggregate.expected} học viên` : 'Chưa có lớp đến hạn'} />
      </div>

      {showBreakdown && dueRows.length > 0 && <section style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-card)', overflow: 'hidden' }}>
        <div style={{ padding: 12, borderBottom: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div><strong style={{ fontSize: 13 }}>Phân loại sản phẩm cuối khoá</strong><div style={{ color: 'var(--text-tertiary)', fontSize: 11, marginTop: 3 }}>Chỉ tính lớp đã tới buổi cuối · tỷ lệ nộp thấp trước</div></div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'flex-end' }}>
            <div className={styles.dateControls}>
              <span className={styles.dateLabel}>Cơ sở</span>
              <MultiSelect
                menuPosition="fixed"
                options={breakdownCentreOptions}
                selected={breakdownCentreFilter}
                onChange={setBreakdownCentreFilter}
                placeholder="Tất cả cơ sở"
                searchable
                maxDisplay={1}
              />
            </div>
            <div className={styles.dateControls}>
              <span className={styles.dateLabel}>Khối học</span>
              <MultiSelect
                menuPosition="fixed"
                options={breakdownCourseLineOptions}
                selected={breakdownCourseLineFilter}
                onChange={setBreakdownCourseLineFilter}
                placeholder="Tất cả khối"
                searchable
                maxDisplay={1}
              />
            </div>
            {hasBreakdownFilter && (
              <button
                type="button"
                onClick={() => {
                  setBreakdownCentreFilter([]);
                  setBreakdownCourseLineFilter([]);
                }}
                style={{ height: 30, padding: '6px 9px', borderRadius: 8, border: '1px solid var(--border-primary)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 11 }}
              >
                Xoá lọc
              </button>
            )}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{([['centre', 'Theo cơ sở'], ['courseLine', 'Theo khối'], ['centreCourseLine', 'Cơ sở × khối']] as [BreakdownDimension, string][]).map(([value, label]) => <button key={value} type="button" onClick={() => setBreakdownDimension(value)} style={{ padding: '6px 9px', borderRadius: 999, border: breakdownDimension === value ? '1px solid var(--brand-indigo)' : '1px solid var(--border-primary)', background: breakdownDimension === value ? 'rgba(99,102,241,.09)' : 'transparent', color: breakdownDimension === value ? 'var(--brand-indigo)' : 'var(--text-secondary)', cursor: 'pointer', fontSize: 11 }}>{label}</button>)}</div>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', minWidth: 800, borderCollapse: 'collapse', fontSize: 12 }}><thead><tr style={{ background: 'var(--bg-elevated)', textAlign: 'left' }}>{['Nhóm', 'Lớp đến hạn', 'Cần nộp', 'Chưa nộp', 'Chờ duyệt', 'Từ chối', 'Đã duyệt', 'Tỷ lệ nộp', 'Tỷ lệ duyệt'].map(label => <th key={label} style={{ padding: '9px 12px', borderBottom: '1px solid var(--border-primary)', whiteSpace: 'nowrap' }}>{label}</th>)}</tr></thead><tbody>{breakdownRows.length === 0 ? <tr><td colSpan={9} style={{ padding: 18, textAlign: 'center', borderBottom: '1px solid var(--border-primary)', color: 'var(--text-tertiary)' }}>Không có nhóm phù hợp với bộ lọc.</td></tr> : breakdownRows.map(row => <tr key={row.key}>
          <td style={{ padding: 12, borderBottom: '1px solid var(--border-primary)', fontWeight: 700 }}>{row.label}{row.secondary && <div style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>{row.secondary}</div>}</td>
          {[row.classes, row.expected, row.missing, row.pending, row.rejected, row.approved].map((value, index) => <td key={index} style={{ padding: 12, borderBottom: '1px solid var(--border-primary)' }}>{value}</td>)}
          <td style={{ padding: 12, borderBottom: '1px solid var(--border-primary)', fontWeight: 700 }}>{row.expected ? `${(row.submitted / row.expected * 100).toFixed(1)}%` : '—'}</td>
          <td style={{ padding: 12, borderBottom: '1px solid var(--border-primary)', fontWeight: 700 }}>{row.submitted ? `${(row.approved / row.submitted * 100).toFixed(1)}%` : '—'}</td>
        </tr>)}</tbody></table></div>
      </section>}

      <section style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-card)', overflow: 'hidden' }}>
        <div style={{ padding: 12, borderBottom: '1px solid var(--border-primary)', display: 'flex', gap: 8, alignItems: 'center' }}><Icon.Search /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Tìm mã lớp, cơ sở, khoá học..." style={{ flex: 1, border: 0, outline: 0, background: 'transparent', color: 'var(--text-primary)' }} /><span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>{visibleRows.length} lớp</span></div>
        {loading && works.length === 0 ? <div style={{ padding: 32, textAlign: 'center' }}><Spinner /> Đang tải dữ liệu sản phẩm cuối khoá...</div> : <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', minWidth: 1000, borderCollapse: 'collapse', fontSize: 12 }}><thead><tr style={{ background: 'var(--bg-elevated)', textAlign: 'left' }}>{['Lớp', 'Cơ sở', 'Buổi cuối', 'Học viên', 'Đã nộp', 'Chưa nộp', 'Chờ duyệt', 'Từ chối', 'Đã duyệt', 'Tỷ lệ nộp', 'Tỷ lệ duyệt'].map(label => <th key={label} style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-primary)', whiteSpace: 'nowrap' }}>{label}</th>)}</tr></thead><tbody>{visibleRows.map(row => {
          const isDue = row.stats.isFinalSessionCompleted;
          return <tr key={row.cls.id} onClick={() => setSelectedClassId(row.cls.id)} style={{ cursor: 'pointer', background: selectedClassId === row.cls.id ? 'rgba(99,102,241,.06)' : undefined }}>
            <td style={{ padding: 12, borderBottom: '1px solid var(--border-primary)' }}><strong>{row.cls.name}</strong><div style={{ color: 'var(--text-tertiary)' }}>{row.cls.course?.name}</div></td>
            <td style={{ padding: 12, borderBottom: '1px solid var(--border-primary)' }}>{row.cls.centre?.shortName || row.cls.centre?.name || '—'}</td>
            <td style={{ padding: 12, borderBottom: '1px solid var(--border-primary)', whiteSpace: 'nowrap' }}>{formatDateTime(row.stats.finalSessionDate)}{!isDue && <div style={{ marginTop: 3 }}><StatusPill isDue={false} /></div>}</td>
            <td style={{ padding: 12, borderBottom: '1px solid var(--border-primary)' }}>{row.stats.totalStudents}</td>
            <td style={{ padding: 12, borderBottom: '1px solid var(--border-primary)' }}>{row.stats.submittedCount}</td>
            <td style={{ padding: 12, borderBottom: '1px solid var(--border-primary)', color: isDue && row.stats.missingCount ? 'var(--status-error)' : undefined }}>{isDue ? row.stats.missingCount : '—'}</td>
            <td style={{ padding: 12, borderBottom: '1px solid var(--border-primary)' }}>{row.stats.pendingCount}</td>
            <td style={{ padding: 12, borderBottom: '1px solid var(--border-primary)' }}>{row.stats.rejectedCount}</td>
            <td style={{ padding: 12, borderBottom: '1px solid var(--border-primary)' }}>{row.stats.approvedCount}</td>
            <td style={{ padding: 12, borderBottom: '1px solid var(--border-primary)', fontWeight: 700 }}>{isDue && row.stats.totalStudents ? `${(row.stats.submittedCount / row.stats.totalStudents * 100).toFixed(1)}%` : '—'}</td>
            <td style={{ padding: 12, borderBottom: '1px solid var(--border-primary)', fontWeight: 700 }}>{row.stats.submittedCount ? `${(row.stats.approvedCount / row.stats.submittedCount * 100).toFixed(1)}%` : '—'}</td>
          </tr>;
        })}</tbody></table></div>}
      </section>

      {selectedRow && <section style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-card)', overflow: 'hidden' }}>
        <div style={{ padding: 14, borderBottom: '1px solid var(--border-primary)' }}><strong>Chi tiết {selectedRow.cls.name}</strong><div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 3 }}>{selectedRow.cls.centre?.name} · buổi cuối {formatDateTime(selectedRow.stats.finalSessionDate)}</div></div>
        <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', minWidth: 850, borderCollapse: 'collapse', fontSize: 12 }}><thead><tr style={{ background: 'var(--bg-elevated)', textAlign: 'left' }}>{['Học viên', 'Trạng thái', 'Tên sản phẩm', 'Tài nguyên', 'Cập nhật gần nhất', 'Người cập nhật', 'Ghi chú / Lý do'].map(label => <th key={label} style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-primary)' }}>{label}</th>)}</tr></thead><tbody>{getActiveClassStudents(selectedRow.cls).map(student => {
          const work = selectedRow.worksByStudent.get(student.id);
          return <tr key={student.id}>
            <td style={{ padding: 12, borderBottom: '1px solid var(--border-primary)', fontWeight: 650 }}><StudentHoverCard studentId={student.id} studentName={student.name} /></td>
            <td style={{ padding: 12, borderBottom: '1px solid var(--border-primary)' }}><StatusPill work={work} isDue={selectedRow.stats.isFinalSessionCompleted} /></td>
            <td style={{ padding: 12, borderBottom: '1px solid var(--border-primary)' }}>{work?.latestData?.title || '—'}</td>
            <td style={{ padding: 12, borderBottom: '1px solid var(--border-primary)' }}>{work ? getStudentWorkAssetCount(work) : '—'}</td>
            <td style={{ padding: 12, borderBottom: '1px solid var(--border-primary)', whiteSpace: 'nowrap' }}>{formatDateTime(work?.lastModifiedAt || work?.createdAt)}</td>
            <td style={{ padding: 12, borderBottom: '1px solid var(--border-primary)' }}>{work?.lastModifiedBy?.displayName || work?.createdBy?.displayName || '—'}</td>
            <td style={{ padding: 12, borderBottom: '1px solid var(--border-primary)' }}>{work?.latestData?.rejectReason || work?.latestData?.comment || '—'}</td>
          </tr>;
        })}</tbody></table></div>
      </section>}
    </>}

    <CSVExportSettings isOpen={showCSVSettings} onClose={() => setShowCSVSettings(false)} columns={csvColumns} onSave={saveColumns} title="Cài đặt xuất CSV - Sản phẩm cuối khoá" />
  </div>;
}
