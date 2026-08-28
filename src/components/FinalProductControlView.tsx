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
  AdminTableSection,
  CSVExportSettings,
  EmptyState,
  ExportButton,
  Icon,
  MultiSelect,
  type SelectOption,
  Spinner,
  StatCard,
  TableToolbar,
  type CSVColumnConfig,
} from '@/components/ui';
import { StudentHoverCard } from '@/components/StudentHoverCard';
import { ExemptionRulesPanel } from '@/components/ExemptionRulesPanel';
import styles from '@/app/dashboard.module.css';
import controlStyles from './OperationsControlView.module.css';

type BreakdownDimension = 'centre' | 'courseLine' | 'centreCourseLine';

const FINAL_PRODUCT_EXEMPTED_COURSES_STORAGE_KEY = 'operations-final-product-exempted-courses';
const DEFAULT_FINAL_PRODUCT_EXEMPT_CLASS_KEYWORDS = ['WRO', 'CSB', 'PTB', 'RBS26', 'TC5O'] as const;

type FinalProductExemptedCourseState = Record<string, boolean>;

interface FinalProductCourseExemptionOption {
  key: string;
  label: string;
  count: number;
  defaultChecked: boolean;
  matchedKeywords: string[];
}

function getInitialFinalProductExemptedCourses(): FinalProductExemptedCourseState {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(FINAL_PRODUCT_EXEMPTED_COURSES_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as FinalProductExemptedCourseState;
  } catch {
    return {};
  }
}

function saveFinalProductExemptedCourses(state: FinalProductExemptedCourseState) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(FINAL_PRODUCT_EXEMPTED_COURSES_STORAGE_KEY, JSON.stringify(state));
}

function normalizeSearchText(value?: string | null) {
  return (value || '').toLocaleLowerCase('vi');
}

function getFinalProductCourseKey(cls: Class) {
  return cls.course?.id || cls.course?.name || cls.course?.shortName || 'unknown-course';
}

function getFinalProductCourseLabel(cls: Class) {
  return cls.course?.name || cls.course?.shortName || 'Chưa xác định khoá học';
}

function getDefaultMatchedClassKeywords(cls: Class) {
  const className = normalizeSearchText(cls.name);
  return DEFAULT_FINAL_PRODUCT_EXEMPT_CLASS_KEYWORDS.filter(keyword => className.includes(normalizeSearchText(keyword)));
}

function shouldExemptCourse(option: FinalProductCourseExemptionOption, state: FinalProductExemptedCourseState) {
  return typeof state[option.key] === 'boolean' ? state[option.key] : option.defaultChecked;
}

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
  return <span className={controlStyles.statusPill} style={{ color: meta.color, background: meta.bg }}>{meta.label}</span>;
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
  const [tableCentreFilter, setTableCentreFilter] = useState<string[]>([]);
  const [tableCourseLineFilter, setTableCourseLineFilter] = useState<string[]>([]);
  const [exemptedCourses, setExemptedCourses] = useState<FinalProductExemptedCourseState>(getInitialFinalProductExemptedCourses);
  const [showExemptionPanel, setShowExemptionPanel] = useState(true);
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

  const courseExemptionOptions = useMemo<FinalProductCourseExemptionOption[]>(() => {
    const courseMap = new Map<string, { key: string; label: string; count: number; matchedKeywords: Set<string> }>();

    classRows.forEach(({ cls }) => {
      const key = getFinalProductCourseKey(cls);
      const current = courseMap.get(key) || {
        key,
        label: getFinalProductCourseLabel(cls),
        count: 0,
        matchedKeywords: new Set<string>(),
      };
      current.count += 1;
      getDefaultMatchedClassKeywords(cls).forEach(keyword => current.matchedKeywords.add(keyword));
      courseMap.set(key, current);
    });

    return [...courseMap.values()]
      .map(course => ({
        key: course.key,
        label: course.label,
        count: course.count,
        matchedKeywords: [...course.matchedKeywords].sort(),
        defaultChecked: course.matchedKeywords.size > 0,
      }))
      .sort((left, right) => {
        if (left.defaultChecked !== right.defaultChecked) return left.defaultChecked ? -1 : 1;
        return left.label.localeCompare(right.label, 'vi');
      });
  }, [classRows]);
  const courseExemptionOptionByKey = useMemo(() => new Map(courseExemptionOptions.map(option => [option.key, option])), [courseExemptionOptions]);
  const isClassExcluded = useCallback((cls: Class) => {
    const option = courseExemptionOptionByKey.get(getFinalProductCourseKey(cls));
    return option ? shouldExemptCourse(option, exemptedCourses) : false;
  }, [courseExemptionOptionByKey, exemptedCourses]);
  const excludedRows = useMemo(() => classRows.filter(row => isClassExcluded(row.cls)), [classRows, isClassExcluded]);
  const includedRows = useMemo(() => classRows.filter(row => !isClassExcluded(row.cls)), [classRows, isClassExcluded]);
  const dueRows = useMemo(() => includedRows.filter(row => row.stats.isFinalSessionCompleted), [includedRows]);
  const classCentreOptions = useMemo<SelectOption[]>(() => {
    const options = new Map<string, SelectOption>();
    includedRows.forEach(row => {
      const value = row.cls.centre?.id || row.cls.centre?.name || 'unknown';
      const label = row.cls.centre?.shortName || row.cls.centre?.name || 'Chưa xác định cơ sở';
      if (!options.has(value)) options.set(value, { value, label });
    });
    return [...options.values()].sort((left, right) => left.label.localeCompare(right.label, 'vi'));
  }, [includedRows]);
  const classCourseLineOptions = useMemo<SelectOption[]>(() => {
    const options = new Map<string, SelectOption>();
    includedRows.forEach(row => {
      const value = getCourseCategory(row.cls);
      if (!options.has(value)) options.set(value, { value, label: value });
    });
    return [...options.values()].sort((left, right) => left.label.localeCompare(right.label, 'vi'));
  }, [includedRows]);
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
    return includedRows.filter(row => {
      const centreValue = row.cls.centre?.id || row.cls.centre?.name || 'unknown';
      const courseLineValue = getCourseCategory(row.cls);
      if (tableCentreFilter.length > 0 && !tableCentreFilter.includes(centreValue)) return false;
      if (tableCourseLineFilter.length > 0 && !tableCourseLineFilter.includes(courseLineValue)) return false;
      if (!normalized) return true;
      return [row.cls.name, row.cls.centre?.name, row.cls.centre?.shortName, row.cls.course?.name]
        .some(value => (value || '').toLocaleLowerCase('vi').includes(normalized));
    });
  }, [includedRows, search, tableCentreFilter, tableCourseLineFilter]);

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
  const hasTableFilter = tableCentreFilter.length > 0 || tableCourseLineFilter.length > 0;

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

  const handleToggleExemptedCourse = useCallback((courseKey: string, defaultChecked: boolean) => {
    setExemptedCourses(current => {
      const next = { ...current, [courseKey]: !(typeof current[courseKey] === 'boolean' ? current[courseKey] : defaultChecked) };
      saveFinalProductExemptedCourses(next);
      return next;
    });
  }, []);
  const handleResetExemptedCourses = useCallback(() => {
    setExemptedCourses({});
    saveFinalProductExemptedCourses({});
  }, []);
  const selectedRow = includedRows.find(row => row.cls.id === selectedClassId);
  const showBreakdown = new Set(includedRows.map(row => row.cls.centre?.id)).size > 1
    || new Set(includedRows.map(row => getCourseCategory(row.cls))).size > 1;
  const exemptionPanel = (
    <ExemptionRulesPanel
      title="Quy tắc Miễn trừ"
      count={excludedRows.length}
      isExpanded={showExemptionPanel}
      onToggle={() => setShowExemptionPanel(current => !current)}
      onReset={handleResetExemptedCourses}
    >
      <div style={{ padding: 'var(--space-4)' }}>
        <div className={`${controlStyles.notice} ${controlStyles.noticeWarning}`} style={{ marginBottom: 'var(--space-3)' }}>
          Tick khoá học để miễn trừ khỏi thống kê Sản phẩm cuối khoá. Hệ thống tự tick sẵn các khoá học được suy ra từ mã lớp có chứa {DEFAULT_FINAL_PRODUCT_EXEMPT_CLASS_KEYWORDS.join(', ')}. Hiện đang tính {includedRows.length}/{classRows.length} lớp, miễn trừ {excludedRows.length} lớp.
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 'var(--space-2)' }}>
          Miễn trừ theo Khoá học
        </div>
        <div className={styles.reasonList}>
          {courseExemptionOptions.map(course => {
            const checked = shouldExemptCourse(course, exemptedCourses);
            return (
              <label key={course.key} className={styles.reasonItem}>
                <input
                  type="checkbox"
                  className={styles.reasonCheckbox}
                  checked={checked}
                  onChange={() => handleToggleExemptedCourse(course.key, course.defaultChecked)}
                />
                <div className={styles.reasonLabel}>
                  <span style={{ fontSize: 12 }}>{course.label}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', flexShrink: 0 }}>
                    {course.matchedKeywords.length > 0 && (
                      <span className={styles.reasonTag} style={{ maxWidth: 220 }}>
                        Gợi ý: {course.matchedKeywords.join(', ')}
                      </span>
                    )}
                    <span className={styles.reasonCount}>{course.count}</span>
                    <div className={styles.tooltipWrap}>
                      <i className={styles.tooltipIcon}>i</i>
                      <div className={styles.tooltipBox}>
                        {course.matchedKeywords.length > 0
                          ? `Tự tick vì có lớp thuộc khoá học này có mã chứa: ${course.matchedKeywords.join(', ')}`
                          : 'Khoá học trong dữ liệu đã tải; không thuộc nhóm gợi ý mặc định.'}
                      </div>
                    </div>
                  </div>
                </div>
              </label>
            );
          })}
        </div>
      </div>
    </ExemptionRulesPanel>
  );

  if (classes.length === 0) {
    return <EmptyState icon={<Icon.Target size={42} />} title="Chưa có lớp để kiểm tra" subtitle="Tải dữ liệu lớp bằng bộ lọc phía trên trước khi xem sản phẩm cuối khoá." />;
  }

  return <div className={controlStyles.controlRoot}>
    {error && <div className={`${controlStyles.notice} ${controlStyles.noticeError}`}>Không thể tải dữ liệu sản phẩm cuối khoá. {error}</div>}

    {!error && <div className={controlStyles.splitLayout}>
      <div className={controlStyles.mainColumn}>
      <div className={styles.statsGrid}>
        <StatCard label="CẦN NỘP" value={aggregate.expected.toLocaleString('vi-VN')} desc={`${dueRows.length} lớp đã đến hạn · miễn trừ ${excludedRows.length} lớp`} />
        <StatCard label="CHƯA NỘP" value={aggregate.missing.toLocaleString('vi-VN')} desc={aggregate.expected ? `${(aggregate.missing / aggregate.expected * 100).toFixed(1)}% học viên` : 'Chưa có lớp đến hạn'} />
        <StatCard label="CHỜ DUYỆT" value={aggregate.pending.toLocaleString('vi-VN')} desc="Gồm bản nháp/chờ xử lý" />
        <StatCard label="BỊ TỪ CHỐI" value={aggregate.rejected.toLocaleString('vi-VN')} desc="Cần học viên cập nhật lại" />
        <StatCard label="ĐÃ DUYỆT" value={aggregate.approved.toLocaleString('vi-VN')} desc={aggregate.submitted ? `${approvalRate.toFixed(1)}% sản phẩm đã nộp` : 'Chưa có sản phẩm'} />
        <StatCard label="TỶ LỆ NỘP" value={aggregate.expected ? `${submissionRate.toFixed(1)}%` : '—'} desc={aggregate.expected ? `${aggregate.submitted}/${aggregate.expected} học viên` : 'Chưa có lớp đến hạn'} />
      </div>

      {showBreakdown && dueRows.length > 0 && <AdminTableSection
        title="Phân loại sản phẩm cuối khoá"
        count={breakdownRows.length}
        isExpanded={true}
        toolbarSlot={
          <div className={styles.tableToolbar}>
            <div className={styles.toolbarCluster}>
              <MultiSelect
                menuPosition="fixed"
                options={breakdownCentreOptions}
                selected={breakdownCentreFilter}
                onChange={setBreakdownCentreFilter}
                placeholder="Tất cả cơ sở"
                searchable
                maxDisplay={1}
              />
              <MultiSelect
                menuPosition="fixed"
                options={breakdownCourseLineOptions}
                selected={breakdownCourseLineFilter}
                onChange={setBreakdownCourseLineFilter}
                placeholder="Tất cả khối"
                searchable
                maxDisplay={1}
              />
              <div className={controlStyles.segmented}>{([['centre', 'Theo cơ sở'], ['courseLine', 'Theo khối'], ['centreCourseLine', 'Cơ sở × khối']] as [BreakdownDimension, string][]).map(([value, label]) => <button key={value} type="button" onClick={() => setBreakdownDimension(value)} className={`${controlStyles.segmentButton} ${breakdownDimension === value ? controlStyles.segmentButtonActive : ''}`}>{label}</button>)}</div>
              <span className={styles.metricText}>Chỉ tính lớp đã tới buổi cuối · tỷ lệ nộp thấp trước</span>
            </div>
            {hasBreakdownFilter && <button type="button" onClick={() => { setBreakdownCentreFilter([]); setBreakdownCourseLineFilter([]); }} className={controlStyles.clearButton}>Xoá lọc</button>}
          </div>
        }
      >
        <div className={controlStyles.tableScroll}><table className={controlStyles.table} style={{ minWidth: 800 }}><thead><tr>{['Nhóm', 'Lớp đến hạn', 'Cần nộp', 'Chưa nộp', 'Chờ duyệt', 'Từ chối', 'Đã duyệt', 'Tỷ lệ nộp', 'Tỷ lệ duyệt'].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{breakdownRows.length === 0 ? <tr><td colSpan={9} className={controlStyles.emptyCell}>Không có nhóm phù hợp với bộ lọc.</td></tr> : breakdownRows.map(row => <tr key={row.key}>
          <td className={controlStyles.primaryCell}>{row.label}{row.secondary && <div className={controlStyles.secondaryText}>{row.secondary}</div>}</td>
          {[row.classes, row.expected, row.missing, row.pending, row.rejected, row.approved].map((value, index) => <td key={index}>{value}</td>)}
          <td className={controlStyles.primaryCell}>{row.expected ? `${(row.submitted / row.expected * 100).toFixed(1)}%` : '—'}</td>
          <td className={controlStyles.primaryCell}>{row.submitted ? `${(row.approved / row.submitted * 100).toFixed(1)}%` : '—'}</td>
        </tr>)}</tbody></table></div>
      </AdminTableSection>}

      <AdminTableSection
        title="Kiểm soát nộp sản phẩm cuối khoá"
        count={visibleRows.length}
        loading={loading && works.length === 0}
        isExpanded={true}
        actionSlot={
          <div className={controlStyles.controlActions}>
            <ExportButton onClick={handleExport} onSettingsClick={() => setShowCSVSettings(true)} disabled={loading || exportRows.length === 0} label="Xuất CSV" count={exportRows.length} />
            <button type="button" className={styles.primaryBtn} onClick={onReload} disabled={loading}>{loading ? <Spinner size={14} /> : <Icon.Refresh />}{loading ? 'Đang đồng bộ...' : 'Làm mới dữ liệu'}</button>
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
                  options={classCentreOptions}
                  selected={tableCentreFilter}
                  onChange={setTableCentreFilter}
                  placeholder={tableCentreFilter.length > 0 ? `Cơ sở (${tableCentreFilter.length})` : 'Tất cả cơ sở'}
                  searchable
                  maxDisplay={1}
                />
                <MultiSelect
                  menuPosition="fixed"
                  options={classCourseLineOptions}
                  selected={tableCourseLineFilter}
                  onChange={setTableCourseLineFilter}
                  placeholder={tableCourseLineFilter.length > 0 ? `Khối học (${tableCourseLineFilter.length})` : 'Tất cả khối học'}
                  searchable
                  maxDisplay={1}
                />
                <span className={styles.metricText}>
                  {dueRows.length}/{includedRows.length} lớp đã đến buổi cuối · {visibleRows.length}/{includedRows.length} lớp hiển thị · miễn trừ {excludedRows.length}
                </span>
              </div>
            }
            hasFilter={hasTableFilter || search.trim().length > 0}
            onClearFilter={() => {
              setSearch('');
              setTableCentreFilter([]);
              setTableCourseLineFilter([]);
            }}
          />
        }
      >
        {loading && works.length === 0 ? <div className={controlStyles.loadingPanel}><Spinner /> Đang tải dữ liệu sản phẩm cuối khoá...</div> : <div className={controlStyles.tableScroll}><table className={controlStyles.table} style={{ minWidth: 1000 }}><thead><tr>{['Lớp', 'Cơ sở', 'Buổi cuối', 'Học viên', 'Đã nộp', 'Chưa nộp', 'Chờ duyệt', 'Từ chối', 'Đã duyệt', 'Tỷ lệ nộp', 'Tỷ lệ duyệt'].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{visibleRows.map(row => {
          const isDue = row.stats.isFinalSessionCompleted;
          return <tr key={row.cls.id} onClick={() => setSelectedClassId(row.cls.id)} className={`${controlStyles.clickableRow} ${selectedClassId === row.cls.id ? controlStyles.rowSelected : ''}`}>
            <td><strong>{row.cls.name}</strong><div className={controlStyles.secondaryText}>{row.cls.course?.name}</div></td>
            <td>{row.cls.centre?.shortName || row.cls.centre?.name || '—'}</td>
            <td style={{ whiteSpace: 'nowrap' }}>{formatDateTime(row.stats.finalSessionDate)}{!isDue && <div style={{ marginTop: 3 }}><StatusPill isDue={false} /></div>}</td>
            <td>{row.stats.totalStudents}</td>
            <td>{row.stats.submittedCount}</td>
            <td style={{ color: isDue && row.stats.missingCount ? 'var(--status-error)' : undefined }}>{isDue ? row.stats.missingCount : '—'}</td>
            <td>{row.stats.pendingCount}</td>
            <td>{row.stats.rejectedCount}</td>
            <td>{row.stats.approvedCount}</td>
            <td className={controlStyles.primaryCell}>{isDue && row.stats.totalStudents ? `${(row.stats.submittedCount / row.stats.totalStudents * 100).toFixed(1)}%` : '—'}</td>
            <td className={controlStyles.primaryCell}>{row.stats.submittedCount ? `${(row.stats.approvedCount / row.stats.submittedCount * 100).toFixed(1)}%` : '—'}</td>
          </tr>;
        })}</tbody></table></div>}
      </AdminTableSection>

      {selectedRow && <section className={controlStyles.panel}>
        <div className={controlStyles.panelHeader}><div><div className={controlStyles.panelTitle}>Chi tiết {selectedRow.cls.name}</div><div className={controlStyles.panelSubtitle}>{selectedRow.cls.centre?.name} · buổi cuối {formatDateTime(selectedRow.stats.finalSessionDate)}</div></div></div>
        <div className={controlStyles.tableScroll}><table className={controlStyles.table} style={{ minWidth: 850 }}><thead><tr>{['Học viên', 'Trạng thái', 'Tên sản phẩm', 'Tài nguyên', 'Cập nhật gần nhất', 'Người cập nhật', 'Ghi chú / Lý do'].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{getActiveClassStudents(selectedRow.cls).map(student => {
          const work = selectedRow.worksByStudent.get(student.id);
          return <tr key={student.id}>
            <td className={controlStyles.primaryCell}><StudentHoverCard studentId={student.id} studentName={student.name} /></td>
            <td><StatusPill work={work} isDue={selectedRow.stats.isFinalSessionCompleted} /></td>
            <td>{work?.latestData?.title || '—'}</td>
            <td>{work ? getStudentWorkAssetCount(work) : '—'}</td>
            <td style={{ whiteSpace: 'nowrap' }}>{formatDateTime(work?.lastModifiedAt || work?.createdAt)}</td>
            <td>{work?.lastModifiedBy?.displayName || work?.createdBy?.displayName || '—'}</td>
            <td>{work?.latestData?.rejectReason || work?.latestData?.comment || '—'}</td>
          </tr>;
        })}</tbody></table></div>
      </section>}
      </div>
      <aside className={controlStyles.sideColumn}>
        {exemptionPanel}
      </aside>
    </div>}

    <CSVExportSettings isOpen={showCSVSettings} onClose={() => setShowCSVSettings(false)} columns={csvColumns} onSave={saveColumns} title="Cài đặt xuất CSV - Sản phẩm cuối khoá" />
  </div>;
}
