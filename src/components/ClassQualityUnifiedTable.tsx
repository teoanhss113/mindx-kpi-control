'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import type { AnalyzedClassForQuality, AttendanceAlert } from '@/types/classQuality';
import type { FinalProductClassStats } from '@/types/classes';
import type {
  ClassQualityFollowUp,
  ClassQualityFollowUpInput,
  ClassQualityFollowUpStatus,
} from '@/types/classQualityFollowUp';
import {
  Badge,
  RescheduleStatusBadge,
  COMMENT_STATUS_COUNT_LABELS,
  ATTENDANCE_ALERT_LABELS,
  SortableHeader,
  TableToolbar,
  AdminTableSection,
  EmptyState,
  FilterChip,
  MultiSelect,
  COMMENT_DETAIL_FILTER_OPTIONS,
  CopyClassCodesButton,
  DateRangeInput,
  ExportButton,
  CSVExportSettings,
  type CSVColumnConfig,
} from '@/components/ui';
import { exportToCSV, type CSVColumn } from '@/lib/csvExport';
import { useCSVExportPreferences } from '@/hooks/useCSVExportPreferences';
import {
  CLASS_QUALITY_FOLLOW_UP_STATUS_OPTIONS,
  CLASS_QUALITY_LABELS,
  LABELS,
} from '@/constants';
import {
  fetchClassQualityFollowUps,
  saveClassQualityFollowUp,
} from '@/services/classQualityFollowUpService';
import { usePermissionsContext } from '@/lib/PermissionsContext';
import styles from '@/app/dashboard.module.css';

// ─── helpers ──────────────────────────────────────────────────────────────────

function getPrimaryTeacher(cls: AnalyzedClassForQuality['cls']): string {
  if (cls.slots && cls.slots.length > 0) {
    for (const slot of cls.slots) {
      if (slot.teacherAttendance?.length) return slot.teacherAttendance[0].teacher.fullName;
      if (slot.teachers?.length) return slot.teachers[0].teacher.fullName;
    }
  }
  if (cls.teachers?.length) return cls.teachers[0].teacher.fullName;
  return 'Không rõ';
}

function getTeacherRoleLabel(roleShortName?: string | null, roleName?: string | null): string {
  const role = (roleShortName || roleName || '').trim();
  if (!role) return 'Giáo viên';
  return role.toUpperCase() === 'SUPPLY' ? 'SUPPLY' : role;
}

type ClassTeacherSlot = NonNullable<AnalyzedClassForQuality['cls']['teachers']>[number];

function getTeacherSlotLabel(teacherSlot: ClassTeacherSlot): string {
  return teacherSlot.teacher.fullName || teacherSlot.teacher.username || teacherSlot.teacher.email || teacherSlot.teacher.id;
}

function getClassTeacherOptions(cls: AnalyzedClassForQuality['cls']) {
  const teachers = new Map<string, { value: string; label: string; searchTerms: string[] }>();

  const addTeacher = (teacherSlot: ClassTeacherSlot) => {
    const id = teacherSlot.teacher.id;
    if (!id || teachers.has(id)) return;

    teachers.set(id, {
      value: id,
      label: getTeacherSlotLabel(teacherSlot),
      searchTerms: [
        teacherSlot.teacher.fullName,
        teacherSlot.teacher.username,
        teacherSlot.teacher.email,
        teacherSlot.teacher.code,
      ].filter(Boolean) as string[],
    });
  };

  cls.teachers?.filter(teacherSlot => teacherSlot.isActive).forEach(addTeacher);
  cls.slots?.forEach(slot => {
    slot.teachers?.filter(teacherSlot => teacherSlot.isActive).forEach(addTeacher);
  });

  return Array.from(teachers.values());
}

function getClassTeacherRoles(cls: AnalyzedClassForQuality['cls'], teacherIds?: string[]): string[] {
  const roles = new Map<string, string>();
  const teacherIdSet = teacherIds && teacherIds.length > 0 ? new Set(teacherIds) : null;

  const addRole = (roleShortName?: string | null, roleName?: string | null) => {
    const label = getTeacherRoleLabel(roleShortName, roleName);
    roles.set(label.toUpperCase(), label);
  };

  const addTeacherRoles = (teachers: NonNullable<AnalyzedClassForQuality['cls']['teachers']>) => {
    teachers
      .filter(teacherSlot => teacherSlot.isActive)
      .filter(teacherSlot => !teacherIdSet || teacherIdSet.has(teacherSlot.teacher.id))
      .forEach(teacherSlot => addRole(teacherSlot.role?.shortName, teacherSlot.role?.name));
  };

  cls.slots?.forEach(slot => {
    const slotTeachers = (slot.teachers || []).filter(teacherSlot => teacherSlot.isActive);
    const classTeachers = (cls.teachers || []).filter(teacherSlot => teacherSlot.isActive);
    const teachers = slotTeachers.length > 0 ? slotTeachers : classTeachers;
    addTeacherRoles(teachers);
  });

  if (!cls.slots?.length) {
    addTeacherRoles(cls.teachers || []);
  }

  return Array.from(roles.values());
}

function classHasTeachers(cls: AnalyzedClassForQuality['cls'], teacherIds: string[]): boolean {
  if (teacherIds.length === 0) return true;
  const teacherIdSet = new Set(teacherIds);
  return getClassTeacherOptions(cls).some(teacher => teacherIdSet.has(teacher.value));
}

function getActiveStudentCount(cls: AnalyzedClassForQuality['cls']): number {
  return (cls.students || []).filter(student => student.activeInClass).length;
}

type SortKey = 'name' | 'teacher' | 'studentCount' | 'progress' | 'commentIssues' | 'attendanceAlerts' | 'rescheduled' | 'finalProducts' | 'cp';
type QuickFilterKey = 'attendanceAlerts' | 'rescheduled';
type CommentDetailFilter = (typeof COMMENT_DETAIL_FILTER_OPTIONS)[number]['value'];
type FinalProductFilter = 'submitted' | 'missing' | 'pending' | 'rejected';

interface Props {
  classes: AnalyzedClassForQuality[];
  comparisonClasses?: AnalyzedClassForQuality[];
  search: string;
  onSearchChange: (v: string) => void;
  selectedCourseCategories?: string[];
  onRowClick?: (a: AnalyzedClassForQuality) => void;
  finalProductStatsByClassId?: Map<string, FinalProductClassStats>;
  finalProductStatsLoading?: boolean;
  classStatusOptions?: { value: string; label: string }[];
  selectedTeacherId?: string;
  dateFrom?: string;
  dateTo?: string;
  onDateFromChange?: (value: string) => void;
  onDateToChange?: (value: string) => void;
  dateRangePending?: boolean;
}

type IssueTone = 'success' | 'warning' | 'error' | 'info' | 'default';

const ISSUE_VARIANT: Record<IssueTone, React.ComponentProps<typeof Badge>['variant']> = {
  success: 'passed',
  warning: 'warning',
  error: 'failed',
  info: 'info',
  default: 'default',
};

const QUICK_FILTERS: { key: QuickFilterKey; label: string }[] = [
  { key: 'attendanceAlerts', label: CLASS_QUALITY_LABELS.ATTENDANCE_ALERTS },
  { key: 'rescheduled', label: CLASS_QUALITY_LABELS.RESCHEDULED },
];

const FINAL_PRODUCT_FILTER_OPTIONS: { value: FinalProductFilter; label: string }[] = [
  { value: 'submitted', label: CLASS_QUALITY_LABELS.FINAL_PRODUCT_SUBMITTED },
  { value: 'missing', label: CLASS_QUALITY_LABELS.FINAL_PRODUCT_MISSING },
  { value: 'pending', label: CLASS_QUALITY_LABELS.FINAL_PRODUCT_PENDING },
  { value: 'rejected', label: CLASS_QUALITY_LABELS.FINAL_PRODUCT_REJECTED },
];

function getDefaultClassQualityCSVColumns(): CSVColumnConfig[] {
  return [
    { id: 'className', label: 'Mã lớp', enabled: true },
    { id: 'centre', label: 'Cơ sở', enabled: true },
    { id: 'centreCode', label: 'Mã cơ sở', enabled: true },
    { id: 'courseLine', label: 'Khối học', enabled: true },
    { id: 'course', label: 'Khoá học', enabled: true },
    { id: 'teacher', label: 'Giáo viên chính', enabled: true },
    { id: 'classStatus', label: 'Trạng thái lớp', enabled: true },
    { id: 'studentCount', label: 'Số học viên', enabled: true },
    { id: 'passedSlots', label: 'Buổi đã học trong phạm vi', enabled: true },
    { id: 'totalSlots', label: 'Tổng buổi trong phạm vi', enabled: true },
    { id: 'commentIssues', label: 'Lỗi tự viết', enabled: true },
    { id: 'customPassRate', label: 'Tỷ lệ tự viết đạt (%)', enabled: true },
    { id: 'emptyComments', label: COMMENT_STATUS_COUNT_LABELS.empty, enabled: true },
    { id: 'briefComments', label: COMMENT_STATUS_COUNT_LABELS.brief, enabled: true },
    { id: 'overdueComments', label: COMMENT_STATUS_COUNT_LABELS.overdue, enabled: true },
    { id: 'duplicateComments', label: COMMENT_STATUS_COUNT_LABELS.duplicate, enabled: true },
    { id: 'okComments', label: 'Tự viết đạt', enabled: true },
    { id: 'attendanceAlerts', label: 'Lỗi chuyên cần', enabled: true },
    { id: 'frequentAbsent', label: ATTENDANCE_ALERT_LABELS.frequent_absent, enabled: true },
    { id: 'consecutiveAbsent', label: ATTENDANCE_ALERT_LABELS.consecutive_absent, enabled: true },
    { id: 'lateStageAbsent', label: ATTENDANCE_ALERT_LABELS.late_stage_absent, enabled: true },
    { id: 'rescheduledSessions', label: 'Buổi đổi lịch', enabled: true },
    { id: 'totalScheduleSessions', label: 'Tổng buổi lịch', enabled: false },
    { id: 'rescheduledRate', label: 'Tỷ lệ đổi lịch (%)', enabled: true },
    { id: 'finalProductStatus', label: CLASS_QUALITY_LABELS.FINAL_PRODUCTS, enabled: true },
    { id: 'finalProductSubmitted', label: 'Sản phẩm đã đăng', enabled: true },
    { id: 'finalProductMissing', label: 'Sản phẩm thiếu', enabled: true },
    { id: 'finalProductPending', label: 'Sản phẩm chờ xử lý', enabled: true },
    { id: 'finalProductRejected', label: 'Sản phẩm bị từ chối', enabled: true },
    { id: 'finalSessionDate', label: 'Ngày buổi cuối', enabled: true },
    { id: 'cp1Average', label: 'Điểm TB CP1', enabled: true },
    { id: 'cp1Passed', label: 'CP1 đạt', enabled: true },
    { id: 'cp1Missing', label: 'CP1 thiếu điểm', enabled: true },
    { id: 'cp2Average', label: 'Điểm TB CP2', enabled: true },
    { id: 'cp2Passed', label: 'CP2 đạt', enabled: true },
    { id: 'cp2Missing', label: 'CP2 thiếu điểm', enabled: true },
    { id: 'demoAverage', label: 'Điểm TB Demo', enabled: true },
    { id: 'demoPassed', label: 'Demo đạt', enabled: true },
    { id: 'demoMissing', label: 'Demo thiếu điểm', enabled: true },
    { id: 'followUpStatus', label: CLASS_QUALITY_LABELS.FOLLOW_UP_STATUS, enabled: true },
    { id: 'followUpNote', label: CLASS_QUALITY_LABELS.FOLLOW_UP_NOTE, enabled: true },
    { id: 'followUpUpdatedAt', label: 'Cập nhật xử lý lúc', enabled: false },
    { id: 'followUpUpdatedBy', label: 'Người cập nhật xử lý', enabled: false },
  ];
}

function getLatestPassedSessionIndex(a: AnalyzedClassForQuality): number | null {
  const indexes = a.commentAnalysis.students.flatMap(student =>
    student.comments.map(comment => comment.sessionIndex)
  );
  if (indexes.length > 0) return Math.max(...indexes);

  const latestIndex = a.commentAnalysis.passedSlots - 1;
  return latestIndex >= 0 ? latestIndex : null;
}

function hasLatestSessionCommentStatus(a: AnalyzedClassForQuality, status: CommentDetailFilter): boolean {
  const latestIndex = getLatestPassedSessionIndex(a);
  if (latestIndex === null) return false;

  if (status === 'custom_content_issue') {
    return a.commentAnalysis.students.some(student =>
      student.comments.some(comment =>
        comment.sessionIndex === latestIndex && comment.hasCustomContentIssue
      )
    );
  }

  const isTemplateStatus = status === 'template_exact' || status === 'template_modified';
  return a.commentAnalysis.students.some(student =>
    student.comments.some(comment =>
      comment.sessionIndex === latestIndex
      && (isTemplateStatus ? comment.status === status : comment.customStatus === status)
    )
  );
}

function hasCommentStatus(a: AnalyzedClassForQuality, status: CommentDetailFilter): boolean {
  if (status === 'custom_content_issue') {
    return a.commentAnalysis.students.some(student =>
      student.comments.some(comment => comment.hasCustomContentIssue)
    );
  }

  const isTemplateStatus = status === 'template_exact' || status === 'template_modified';
  return a.commentAnalysis.students.some(student =>
    student.comments.some(comment => isTemplateStatus ? comment.status === status : comment.customStatus === status)
  );
}

function IssueChip({ label, count, tone }: { label: string; count: number; tone: IssueTone }) {
  if (count === 0) return null;
  return (
    <Badge variant={ISSUE_VARIANT[tone]} size="sm" shape="rounded">
      {label}: {count}
    </Badge>
  );
}

interface CustomQualityMetrics {
  ok: number;
  brief: number;
  duplicate: number;
  overdue: number;
  pending: number;
  finalized: number;
  passRate: number | null;
}

function getCustomQualityMetrics(
  items: AnalyzedClassForQuality[],
  bounds?: { fromMs: number; toMs: number },
  sessionIndex?: number,
): CustomQualityMetrics {
  let ok = 0;
  let brief = 0;
  let duplicate = 0;
  let overdue = 0;
  let pending = 0;

  items.forEach(item => {
    item.commentAnalysis.students.forEach(student => {
      student.comments.forEach(comment => {
        if (sessionIndex !== undefined && comment.sessionIndex !== sessionIndex) return;
        if (bounds) {
          const commentMs = new Date(comment.date).getTime();
          if (!Number.isFinite(commentMs) || commentMs < bounds.fromMs || commentMs > bounds.toMs) return;
        }

        if (comment.customStatus === 'ok') ok++;
        else if (comment.customStatus === 'brief') brief++;
        else if (comment.customStatus === 'duplicate_self' || comment.customStatus === 'duplicate_other') duplicate++;
        else if (comment.customStatus === 'overdue') overdue++;
        else if (comment.customStatus === 'empty') pending++;
      });
    });
  });

  const finalized = ok + brief + duplicate + overdue;
  return {
    ok,
    brief,
    duplicate,
    overdue,
    pending,
    finalized,
    passRate: finalized > 0 ? (ok / finalized) * 100 : null,
  };
}

function parseDateInput(value: string): Date | null {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  return Number.isFinite(date.getTime()) ? date : null;
}

function getWeekBounds(anchor: Date, offsetWeeks = 0) {
  const start = new Date(anchor);
  const weekday = start.getDay();
  start.setDate(start.getDate() - (weekday === 0 ? 6 : weekday - 1) + offsetWeeks * 7);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { fromMs: start.getTime(), toMs: end.getTime(), start, end };
}

function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatPassRate(value: number | null): string {
  return value === null ? '—' : `${value.toFixed(1)}%`;
}

function getDateRangeBounds(dateFrom: string, dateTo: string) {
  const from = parseDateInput(dateFrom) || new Date();
  const to = parseDateInput(dateTo) || from;
  from.setHours(0, 0, 0, 0);
  to.setHours(23, 59, 59, 999);
  return { fromMs: from.getTime(), toMs: to.getTime(), start: from, end: to };
}

function TrendBadge({ delta }: { delta: number | null }) {
  if (delta === null) return <Badge variant="default" size="sm">Chưa đủ dữ liệu so sánh</Badge>;
  const rounded = Math.abs(delta) < 0.05 ? 0 : delta;
  return (
    <Badge variant={rounded > 0 ? 'passed' : rounded < 0 ? 'failed' : 'default'} size="sm">
      {rounded > 0 ? '↑' : rounded < 0 ? '↓' : '→'} {Math.abs(rounded).toFixed(1)} điểm % so với kỳ đối chiếu
    </Badge>
  );
}

function getEmptyFinalProductStats(classId: string, totalStudents: number): FinalProductClassStats {
  return {
    classId,
    totalStudents,
    isFinalSessionCompleted: false,
    finalSessionDate: null,
    submittedCount: 0,
    approvedCount: 0,
    pendingCount: 0,
    rejectedCount: 0,
    missingCount: totalStudents,
  };
}

function getClassStatusLabel(a: AnalyzedClassForQuality) {
  const config = (a.cls.classStatusConfig?.statusConfigs || []).find(item => item.status === a.cls.status);
  return config?.description || a.cls.status;
}

function formatExportDate(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('vi-VN');
}

function formatExportNumber(value: number | null | undefined, digits = 1) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : '';
}

function getAttendanceAlertStudentCount(a: AnalyzedClassForQuality, alert: AttendanceAlert) {
  return a.attendanceAnalysis.studentsWithAlerts.filter(student =>
    student.alerts.includes(alert)
  ).length;
}

function getMissingScoreCount(a: AnalyzedClassForQuality, key: 'cp1Analysis' | 'cp2Analysis' | 'demoAnalysis') {
  const studentCount = getActiveStudentCount(a.cls);
  const analysis = a[key];
  return Math.max(analysis.missingScoreCount, studentCount - analysis.studentsWithScores);
}

function getFinalProductExportStatus(stats: FinalProductClassStats) {
  if (!stats.isFinalSessionCompleted) return CLASS_QUALITY_LABELS.FINAL_PRODUCT_NOT_DUE;
  if (stats.missingCount === 0 && stats.pendingCount === 0 && stats.rejectedCount === 0) {
    return CLASS_QUALITY_LABELS.FINAL_PRODUCT_SUBMITTED;
  }

  const issues: string[] = [];
  if (stats.missingCount > 0) issues.push(`${CLASS_QUALITY_LABELS.FINAL_PRODUCT_MISSING}: ${stats.missingCount}`);
  if (stats.pendingCount > 0) issues.push(`${CLASS_QUALITY_LABELS.FINAL_PRODUCT_PENDING}: ${stats.pendingCount}`);
  if (stats.rejectedCount > 0) issues.push(`${CLASS_QUALITY_LABELS.FINAL_PRODUCT_REJECTED}: ${stats.rejectedCount}`);
  return issues.join('; ');
}

const DEFAULT_FOLLOW_UP_STATUS: ClassQualityFollowUpStatus = 'unprocessed';

const FOLLOW_UP_BADGE_VARIANTS: Record<
  ClassQualityFollowUpStatus,
  React.ComponentProps<typeof Badge>['variant']
> = {
  unprocessed: 'default',
  in_progress: 'warning',
  resolved: 'passed',
};

function getFollowUpStatusLabel(status: ClassQualityFollowUpStatus) {
  return CLASS_QUALITY_FOLLOW_UP_STATUS_OPTIONS.find(option => option.value === status)?.label
    || CLASS_QUALITY_FOLLOW_UP_STATUS_OPTIONS[0].label;
}

function formatFollowUpUpdatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function ClassQualityFollowUpCell({
  classId,
  className,
  followUp,
  loading,
  canEdit,
  onSave,
}: {
  classId: string;
  className: string;
  followUp?: ClassQualityFollowUp;
  loading: boolean;
  canEdit: boolean;
  onSave: (input: ClassQualityFollowUpInput) => Promise<ClassQualityFollowUp>;
}) {
  const [status, setStatus] = useState<ClassQualityFollowUpStatus>(
    followUp?.status || DEFAULT_FOLLOW_UP_STATUS,
  );
  const [note, setNote] = useState(followUp?.note || '');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const currentStatus = followUp?.status || DEFAULT_FOLLOW_UP_STATUS;
  const currentNote = followUp?.note || '';

  const persistChanges = async (
    nextStatus: ClassQualityFollowUpStatus,
    nextNote: string,
    previousStatus = currentStatus,
  ) => {
    if (saving) return;
    setSaving(true);
    setSaveError('');
    try {
      await onSave({
        classId,
        className,
        status: nextStatus,
        note: nextNote.trim(),
      });
    } catch (error) {
      setStatus(previousStatus);
      setSaveError(error instanceof Error ? error.message : 'Không lưu được cập nhật');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = (nextStatus: ClassQualityFollowUpStatus) => {
    const previousStatus = status;
    setStatus(nextStatus);
    void persistChanges(nextStatus, note, previousStatus);
  };

  const handleEditorBlur = (event: React.FocusEvent<HTMLDivElement>) => {
    const nextFocusedElement = event.relatedTarget as Node | null;
    if (nextFocusedElement && event.currentTarget.contains(nextFocusedElement)) return;
    if (note.trim() === currentNote || saving) return;
    void persistChanges(status, note);
  };

  if (canEdit) {
    return (
      <div
        className={styles.qualityFollowUpEditor}
        onClick={event => event.stopPropagation()}
        onBlur={handleEditorBlur}
      >
        <select
          aria-label={CLASS_QUALITY_LABELS.FOLLOW_UP_STATUS}
          data-status={status}
          className={`${styles.compactSelect} ${styles.qualityFollowUpSelect}`}
          value={status}
          onChange={event => handleStatusChange(event.target.value as ClassQualityFollowUpStatus)}
          disabled={loading || saving}
        >
          {CLASS_QUALITY_FOLLOW_UP_STATUS_OPTIONS.map(option => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <input
          aria-label={CLASS_QUALITY_LABELS.FOLLOW_UP_NOTE}
          className={`${styles.dateInput} ${styles.qualityFollowUpInput}`}
          value={note}
          onChange={event => setNote(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter') event.currentTarget.blur();
          }}
          placeholder="Ghi chú xử lý..."
          maxLength={2000}
          disabled={loading || saving}
        />
        <div
          className={saveError ? styles.qualityFollowUpError : styles.qualityFollowUpSaveState}
          title={followUp ? `Cập nhật bởi ${followUp.updatedByEmail}` : undefined}
        >
          {loading
            ? 'Đang tải...'
            : saving
              ? 'Đang lưu...'
              : saveError
                || (followUp
                  ? `Đã lưu · ${formatFollowUpUpdatedAt(followUp.updatedAt)}`
                  : 'Tự động lưu khi thay đổi')}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.qualityFollowUpSummary} onClick={event => event.stopPropagation()}>
      <Badge variant={FOLLOW_UP_BADGE_VARIANTS[currentStatus]} size="sm">
        {getFollowUpStatusLabel(currentStatus)}
      </Badge>
      <div
        className={currentNote ? styles.qualityFollowUpNote : styles.qualityFollowUpEmptyNote}
        title={currentNote || undefined}
      >
        {loading && !followUp ? 'Đang tải...' : currentNote || 'Chưa có ghi chú'}
      </div>
      {followUp && (
        <div className={styles.qualityFollowUpMeta}>
          {formatFollowUpUpdatedAt(followUp.updatedAt)} · {followUp.updatedByEmail}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function ClassQualityUnifiedTable({
  classes,
  comparisonClasses = classes,
  search,
  onSearchChange,
  selectedCourseCategories = [],
  onRowClick,
  finalProductStatsByClassId,
  finalProductStatsLoading = false,
  classStatusOptions = [],
  selectedTeacherId,
  dateFrom = '',
  dateTo = '',
  onDateFromChange,
  onDateToChange,
  dateRangePending = false,
}: Props) {
  const { canEdit } = usePermissionsContext();
  const [sortKey, setSortKey] = useState<SortKey>('commentIssues');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [quickFilter, setQuickFilter] = useState<QuickFilterKey | null>(null);
  const [commentDetailFilters, setCommentDetailFilters] = useState<CommentDetailFilter[]>([]);
  const [latestSessionCommentDetailFilters, setLatestSessionCommentDetailFilters] = useState<CommentDetailFilter[]>([]);
  const [finalProductFilters, setFinalProductFilters] = useState<FinalProductFilter[]>([]);
  const [showCSVSettings, setShowCSVSettings] = useState(false);
  const [analysisDateFrom, setAnalysisDateFrom] = useState('');
  const [analysisDateTo, setAnalysisDateTo] = useState('');
  const [comparisonDateFrom, setComparisonDateFrom] = useState('');
  const [comparisonDateTo, setComparisonDateTo] = useState('');
  const { columns: csvColumns, saveColumns: saveCsvColumns } = useCSVExportPreferences(
    'operations-class-quality',
    getDefaultClassQualityCSVColumns()
  );
  
  // Basic table filters
  const [selectedCentres, setSelectedCentres] = useState<string[]>([]);
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [selectedTeachers, setSelectedTeachers] = useState<string[]>([]);
  const roleFilterScope = JSON.stringify([selectedTeacherId || '', ...selectedTeachers]);
  const [roleFilterState, setRoleFilterState] = useState<{ scope: string; values: string[] }>({
    scope: '',
    values: [],
  });
  const selectedRoles = useMemo(
    () => roleFilterState.scope === roleFilterScope ? roleFilterState.values : [],
    [roleFilterScope, roleFilterState.scope, roleFilterState.values],
  );
  const setSelectedRoles = (values: string[]) => {
    setRoleFilterState({ scope: roleFilterScope, values });
  };
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedFollowUpStatuses, setSelectedFollowUpStatuses] = useState<ClassQualityFollowUpStatus[]>([]);
  const [followUpsByClassId, setFollowUpsByClassId] = useState<Map<string, ClassQualityFollowUp>>(new Map());
  const [followUpsLoading, setFollowUpsLoading] = useState(true);
  const [followUpsError, setFollowUpsError] = useState('');

  useEffect(() => {
    let cancelled = false;

    fetchClassQualityFollowUps()
      .then(followUps => {
        if (cancelled) return;
        setFollowUpsByClassId(new Map(followUps.map(item => [item.classId, item])));
      })
      .catch(error => {
        if (cancelled) return;
        setFollowUpsError(error instanceof Error ? error.message : 'Không tải được trạng thái xử lý');
      })
      .finally(() => {
        if (!cancelled) setFollowUpsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSaveFollowUp = async (input: ClassQualityFollowUpInput) => {
    const saved = await saveClassQualityFollowUp(input);
    setFollowUpsByClassId(current => {
      const next = new Map(current);
      next.set(saved.classId, saved);
      return next;
    });
    setFollowUpsError('');
    return saved;
  };

  const roleTeacherIds = useMemo(() => (
    selectedTeachers.length > 0
      ? selectedTeachers
      : selectedTeacherId
        ? [selectedTeacherId]
        : undefined
  ), [selectedTeachers, selectedTeacherId]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  // Extract unique filter options
  const filterOptions = useMemo(() => {
    const centres = new Set<string>();
    const courses = new Set<string>();
    const teachers = new Map<string, { value: string; label: string; searchTerms: string[] }>();
    const roles = new Map<string, string>();
    const statuses = new Set<string>();

    classes.forEach(a => {
      if (a.cls.centre?.shortName) centres.add(a.cls.centre.shortName);
      if (a.courseLineName) courses.add(a.courseLineName);
      getClassTeacherOptions(a.cls).forEach(teacher => teachers.set(teacher.value, teacher));
      getClassTeacherRoles(a.cls, roleTeacherIds).forEach(role => roles.set(role.toUpperCase(), role));
      if (a.cls.status) statuses.add(a.cls.status);
    });

    return {
      centres: Array.from(centres).sort().map(c => ({ value: c, label: c })),
      courses: Array.from(courses).sort().map(c => ({ value: c, label: c })),
      teachers: Array.from(teachers.values()).sort((a, b) => a.label.localeCompare(b.label)),
      roles: Array.from(roles.values()).sort().map(role => ({ value: role, label: role })),
      statuses: classStatusOptions.length > 0 ? classStatusOptions : Array.from(statuses).sort().map(status => {
        const match = classes.find(a => a.cls.status === status);
        return { value: status, label: match ? getClassStatusLabel(match) : status };
      }),
    };
  }, [classes, classStatusOptions, roleTeacherIds]);

  const baseList = useMemo(() => {
    let list = classes;
    
    // Apply basic filters first
    if (selectedCentres.length > 0) {
      list = list.filter(a => a.cls.centre?.shortName && selectedCentres.includes(a.cls.centre.shortName));
    }
    if (selectedCourses.length > 0) {
      list = list.filter(a => a.courseLineName && selectedCourses.includes(a.courseLineName));
    }
    if (selectedCourseCategories.length > 0) {
      list = list.filter(a => a.courseLineName && selectedCourseCategories.includes(a.courseLineName));
    }
    if (selectedTeachers.length > 0) {
      list = list.filter(a => classHasTeachers(a.cls, selectedTeachers));
    }
    if (selectedRoles.length > 0) {
      list = list.filter(a => getClassTeacherRoles(a.cls, roleTeacherIds).some(role => selectedRoles.includes(role)));
    }
    if (selectedStatuses.length > 0) {
      list = list.filter(a => a.cls.status && selectedStatuses.includes(a.cls.status));
    }
    
    // Then apply search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(a => a.cls.name.toLowerCase().includes(q) || a.cls.centre?.shortName?.toLowerCase().includes(q));
    }
    return list;
  }, [classes, search, selectedCentres, selectedCourses, selectedCourseCategories, selectedTeachers, selectedRoles, selectedStatuses, roleTeacherIds]);

  const comparisonBaseList = useMemo(() => {
    let list = comparisonClasses;
    if (selectedCentres.length > 0) {
      list = list.filter(a => a.cls.centre?.shortName && selectedCentres.includes(a.cls.centre.shortName));
    }
    if (selectedCourses.length > 0) {
      list = list.filter(a => a.courseLineName && selectedCourses.includes(a.courseLineName));
    }
    if (selectedCourseCategories.length > 0) {
      list = list.filter(a => a.courseLineName && selectedCourseCategories.includes(a.courseLineName));
    }
    if (selectedTeachers.length > 0) {
      list = list.filter(a => classHasTeachers(a.cls, selectedTeachers));
    }
    if (selectedRoles.length > 0) {
      list = list.filter(a => getClassTeacherRoles(a.cls, roleTeacherIds).some(role => selectedRoles.includes(role)));
    }
    if (selectedStatuses.length > 0) {
      list = list.filter(a => a.cls.status && selectedStatuses.includes(a.cls.status));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(a => a.cls.name.toLowerCase().includes(q) || a.cls.centre?.shortName?.toLowerCase().includes(q));
    }
    return list;
  }, [comparisonClasses, search, selectedCentres, selectedCourses, selectedCourseCategories, selectedTeachers, selectedRoles, selectedStatuses, roleTeacherIds]);

  const defaultComparisonPeriods = useMemo(() => {
    const anchor = parseDateInput(dateTo) || new Date();
    const analysis = getWeekBounds(anchor);
    const comparison = getWeekBounds(anchor, -1);
    return {
      analysisFrom: formatDateKey(analysis.start),
      analysisTo: formatDateKey(analysis.end),
      comparisonFrom: formatDateKey(comparison.start),
      comparisonTo: formatDateKey(comparison.end),
    };
  }, [dateTo]);

  const resolvedAnalysisDateFrom = analysisDateFrom || defaultComparisonPeriods.analysisFrom;
  const resolvedAnalysisDateTo = analysisDateTo || defaultComparisonPeriods.analysisTo;
  const resolvedComparisonDateFrom = comparisonDateFrom || defaultComparisonPeriods.comparisonFrom;
  const resolvedComparisonDateTo = comparisonDateTo || defaultComparisonPeriods.comparisonTo;

  const customQualityComparison = useMemo(() => {
    const analysisPeriod = getDateRangeBounds(resolvedAnalysisDateFrom, resolvedAnalysisDateTo);
    const comparisonPeriod = getDateRangeBounds(resolvedComparisonDateFrom, resolvedComparisonDateTo);
    const current = getCustomQualityMetrics(comparisonBaseList, analysisPeriod);
    const previous = getCustomQualityMetrics(comparisonBaseList, comparisonPeriod);
    const delta = current.passRate !== null && previous.passRate !== null
      ? current.passRate - previous.passRate
      : null;

    return { current, previous, delta };
  }, [comparisonBaseList, resolvedAnalysisDateFrom, resolvedAnalysisDateTo, resolvedComparisonDateFrom, resolvedComparisonDateTo]);

  const customQualityBySession = useMemo(() => {
    const indexes = new Set<number>();
    comparisonBaseList.forEach(item => {
      item.commentAnalysis.students.forEach(student => {
        student.comments.forEach(comment => {
          if (comment.customStatus !== 'not_applicable') indexes.add(comment.sessionIndex);
        });
      });
    });

    return Array.from(indexes)
      .sort((a, b) => a - b)
      .map(sessionIndex => ({
        sessionIndex,
        metrics: getCustomQualityMetrics(comparisonBaseList, undefined, sessionIndex),
      }))
      .filter(item => item.metrics.finalized > 0 || item.metrics.pending > 0);
  }, [comparisonBaseList]);

  const issueCounts = useMemo(() => {
    let attendanceAlerts = 0;
    let rescheduled = 0;
    let finalProductSubmitted = 0;
    let finalProductMissing = 0;
    let finalProductPending = 0;
    let finalProductRejected = 0;
    const commentDetails: Record<CommentDetailFilter, number> = {
      overdue: 0,
      duplicate_other: 0,
      template_exact: 0,
      brief: 0,
      empty: 0,
      duplicate_self: 0,
      template_modified: 0,
      custom_content_issue: 0,
    };
    const latestSessionCommentDetails: Record<CommentDetailFilter, number> = {
      overdue: 0,
      duplicate_other: 0,
      template_exact: 0,
      brief: 0,
      empty: 0,
      duplicate_self: 0,
      template_modified: 0,
      custom_content_issue: 0,
    };

    baseList.forEach(a => {
      if (a.attendanceAnalysis.totalAlerts > 0) attendanceAlerts += 1;
      if (a.reschedulingAnalysis.rescheduledSessions > 0) rescheduled += 1;
      const finalStats = finalProductStatsByClassId?.get(a.cls.id) || getEmptyFinalProductStats(a.cls.id, getActiveStudentCount(a.cls));
      if (finalStats.isFinalSessionCompleted) {
        if (finalStats.missingCount === 0 && finalStats.pendingCount === 0 && finalStats.rejectedCount === 0) finalProductSubmitted += 1;
        if (finalStats.missingCount > 0) finalProductMissing += 1;
        if (finalStats.pendingCount > 0) finalProductPending += 1;
        if (finalStats.rejectedCount > 0) finalProductRejected += 1;
      }
      
      COMMENT_DETAIL_FILTER_OPTIONS.forEach(option => {
        if (hasCommentStatus(a, option.value)) commentDetails[option.value] += 1;
        if (hasLatestSessionCommentStatus(a, option.value)) latestSessionCommentDetails[option.value] += 1;
      });
    });

    return { attendanceAlerts, rescheduled, finalProductSubmitted, finalProductMissing, finalProductPending, finalProductRejected, commentDetails, latestSessionCommentDetails };
  }, [baseList, finalProductStatsByClassId]);

  const commentDetailOptions = useMemo(() => COMMENT_DETAIL_FILTER_OPTIONS.map(option => ({
    ...option,
    label: `${option.label} (${issueCounts.commentDetails[option.value]})`,
  })), [issueCounts.commentDetails]);

  const latestSessionCommentDetailOptions = useMemo(() => COMMENT_DETAIL_FILTER_OPTIONS.map(option => ({
    ...option,
    label: `${option.label} (${issueCounts.latestSessionCommentDetails[option.value]})`,
  })), [issueCounts.latestSessionCommentDetails]);

  const finalProductFilterOptions = useMemo(() => FINAL_PRODUCT_FILTER_OPTIONS.map(option => ({
    ...option,
    label: `${option.label} (${
      option.value === 'submitted' ? issueCounts.finalProductSubmitted :
      option.value === 'missing' ? issueCounts.finalProductMissing :
      option.value === 'pending' ? issueCounts.finalProductPending :
      issueCounts.finalProductRejected
    })`,
  })), [issueCounts.finalProductSubmitted, issueCounts.finalProductMissing, issueCounts.finalProductPending, issueCounts.finalProductRejected]);

  const followUpFilterOptions = useMemo(() => {
    const counts: Record<ClassQualityFollowUpStatus, number> = {
      unprocessed: 0,
      in_progress: 0,
      resolved: 0,
    };

    baseList.forEach(item => {
      const status = followUpsByClassId.get(item.cls.id)?.status || DEFAULT_FOLLOW_UP_STATUS;
      counts[status] += 1;
    });

    return CLASS_QUALITY_FOLLOW_UP_STATUS_OPTIONS.map(option => ({
      ...option,
      label: `${option.label} (${counts[option.value]})`,
    }));
  }, [baseList, followUpsByClassId]);

  const visibleClasses = useMemo(() => {
    let list = baseList;
    if (quickFilter === 'attendanceAlerts') {
      list = list.filter(a => a.attendanceAnalysis.totalAlerts > 0);
    }
    if (quickFilter === 'rescheduled') {
      list = list.filter(a => a.reschedulingAnalysis.rescheduledSessions > 0);
    }
    if (finalProductFilters.length > 0) {
      list = list.filter(a => {
        const stats = finalProductStatsByClassId?.get(a.cls.id) || getEmptyFinalProductStats(a.cls.id, getActiveStudentCount(a.cls));
        if (!stats.isFinalSessionCompleted) return false;
        return finalProductFilters.some(status => {
          if (status === 'submitted') return stats.missingCount === 0 && stats.pendingCount === 0 && stats.rejectedCount === 0;
          if (status === 'missing') return stats.missingCount > 0;
          if (status === 'pending') return stats.pendingCount > 0;
          return stats.rejectedCount > 0;
        });
      });
    }
    if (commentDetailFilters.length > 0) {
      list = list.filter(a => commentDetailFilters.some(status => hasCommentStatus(a, status)));
    }
    if (latestSessionCommentDetailFilters.length > 0) {
      list = list.filter(a => latestSessionCommentDetailFilters.some(status => hasLatestSessionCommentStatus(a, status)));
    }
    if (!followUpsLoading && selectedFollowUpStatuses.length > 0) {
      list = list.filter(a => {
        const status = followUpsByClassId.get(a.cls.id)?.status || DEFAULT_FOLLOW_UP_STATUS;
        return selectedFollowUpStatuses.includes(status);
      });
    }

    return list;
  }, [
    baseList,
    quickFilter,
    finalProductFilters,
    commentDetailFilters,
    latestSessionCommentDetailFilters,
    finalProductStatsByClassId,
    followUpsLoading,
    followUpsByClassId,
    selectedFollowUpStatuses,
  ]);

  const filtered = useMemo(() => {
    return [...visibleClasses].sort((a, b) => {
      const d = sortDir === 'asc' ? 1 : -1;
      const aCI = a.commentAnalysis.customBriefCount + a.commentAnalysis.customDuplicateCount + a.commentAnalysis.customOverdueCount;
      const bCI = b.commentAnalysis.customBriefCount + b.commentAnalysis.customDuplicateCount + b.commentAnalysis.customOverdueCount;
      if (sortKey === 'name') return d * a.cls.name.localeCompare(b.cls.name);
      if (sortKey === 'teacher') return d * getPrimaryTeacher(a.cls).localeCompare(getPrimaryTeacher(b.cls));
      if (sortKey === 'studentCount') return d * (getActiveStudentCount(a.cls) - getActiveStudentCount(b.cls));
      if (sortKey === 'progress') return d * (a.commentAnalysis.passedSlots - b.commentAnalysis.passedSlots);
      if (sortKey === 'commentIssues') return d * (aCI - bCI);
      if (sortKey === 'attendanceAlerts') return d * (a.attendanceAnalysis.totalAlerts - b.attendanceAnalysis.totalAlerts);
      if (sortKey === 'rescheduled') return d * (a.reschedulingAnalysis.rescheduledSessions - b.reschedulingAnalysis.rescheduledSessions);
      if (sortKey === 'finalProducts') {
        const aStats = finalProductStatsByClassId?.get(a.cls.id) || getEmptyFinalProductStats(a.cls.id, getActiveStudentCount(a.cls));
        const bStats = finalProductStatsByClassId?.get(b.cls.id) || getEmptyFinalProductStats(b.cls.id, getActiveStudentCount(b.cls));
        const aIssues = aStats.isFinalSessionCompleted ? aStats.missingCount + aStats.pendingCount + aStats.rejectedCount : 0;
        const bIssues = bStats.isFinalSessionCompleted ? bStats.missingCount + bStats.pendingCount + bStats.rejectedCount : 0;
        return d * (aIssues - bIssues);
      }
      if (sortKey === 'cp') {
        const aCP = (a.cp1Analysis.averageScore ?? 0) + (a.cp2Analysis.averageScore ?? 0);
        const bCP = (b.cp1Analysis.averageScore ?? 0) + (b.cp2Analysis.averageScore ?? 0);
        return d * (aCP - bCP);
      }
      return 0;
    });
  }, [visibleClasses, sortKey, sortDir, finalProductStatsByClassId]);

  const visibleClassCodes = useMemo(() => visibleClasses.map(a => a.cls.name), [visibleClasses]);

  const classQualityColumnMap = useMemo<Record<string, CSVColumn<AnalyzedClassForQuality>>>(() => ({
    className: { header: 'Mã lớp', accessor: row => row.cls.name },
    centre: { header: 'Cơ sở', accessor: row => row.cls.centre?.name || '' },
    centreCode: { header: 'Mã cơ sở', accessor: row => row.cls.centre?.shortName || '' },
    courseLine: { header: 'Khối học', accessor: row => row.courseLineName || row.cls.course?.courseLine?.name || '' },
    course: { header: 'Khoá học', accessor: row => row.cls.course?.name || '' },
    teacher: { header: 'Giáo viên chính', accessor: row => getPrimaryTeacher(row.cls) },
    classStatus: { header: 'Trạng thái lớp', accessor: row => getClassStatusLabel(row) || '' },
    studentCount: { header: 'Số học viên', accessor: row => getActiveStudentCount(row.cls) },
    passedSlots: { header: 'Buổi đã học trong phạm vi', accessor: row => row.commentAnalysis.passedSlots },
    totalSlots: { header: 'Tổng buổi trong phạm vi', accessor: row => row.commentAnalysis.totalSlots },
    commentIssues: { header: 'Lỗi tự viết', accessor: row => row.commentAnalysis.customBriefCount + row.commentAnalysis.customDuplicateCount + row.commentAnalysis.customOverdueCount },
    customPassRate: {
      header: 'Tỷ lệ tự viết đạt (%)',
      accessor: row => {
        const finalized = row.commentAnalysis.customOkCount
          + row.commentAnalysis.customBriefCount
          + row.commentAnalysis.customDuplicateCount
          + row.commentAnalysis.customOverdueCount;
        return finalized > 0 ? ((row.commentAnalysis.customOkCount / finalized) * 100).toFixed(1) : '';
      },
    },
    emptyComments: { header: COMMENT_STATUS_COUNT_LABELS.empty, accessor: row => row.commentAnalysis.customPendingCount },
    briefComments: { header: COMMENT_STATUS_COUNT_LABELS.brief, accessor: row => row.commentAnalysis.customBriefCount },
    overdueComments: { header: COMMENT_STATUS_COUNT_LABELS.overdue, accessor: row => row.commentAnalysis.customOverdueCount },
    duplicateComments: { header: COMMENT_STATUS_COUNT_LABELS.duplicate, accessor: row => row.commentAnalysis.customDuplicateCount },
    okComments: { header: 'Tự viết đạt', accessor: row => row.commentAnalysis.customOkCount },
    attendanceAlerts: { header: 'Lỗi chuyên cần', accessor: row => row.attendanceAnalysis.totalAlerts },
    frequentAbsent: { header: ATTENDANCE_ALERT_LABELS.frequent_absent, accessor: row => getAttendanceAlertStudentCount(row, 'frequent_absent') },
    consecutiveAbsent: { header: ATTENDANCE_ALERT_LABELS.consecutive_absent, accessor: row => getAttendanceAlertStudentCount(row, 'consecutive_absent') },
    lateStageAbsent: { header: ATTENDANCE_ALERT_LABELS.late_stage_absent, accessor: row => getAttendanceAlertStudentCount(row, 'late_stage_absent') },
    rescheduledSessions: { header: 'Buổi đổi lịch', accessor: row => row.reschedulingAnalysis.rescheduledSessions },
    totalScheduleSessions: { header: 'Tổng buổi lịch', accessor: row => row.reschedulingAnalysis.totalSessions },
    rescheduledRate: {
      header: 'Tỷ lệ đổi lịch (%)',
      accessor: row => row.reschedulingAnalysis.totalSessions > 0
        ? Math.round((row.reschedulingAnalysis.rescheduledSessions / row.reschedulingAnalysis.totalSessions) * 100)
        : 0,
    },
    finalProductStatus: {
      header: CLASS_QUALITY_LABELS.FINAL_PRODUCTS,
      accessor: row => {
        const stats = finalProductStatsByClassId?.get(row.cls.id) || getEmptyFinalProductStats(row.cls.id, getActiveStudentCount(row.cls));
        return getFinalProductExportStatus(stats);
      },
    },
    finalProductSubmitted: {
      header: 'Sản phẩm đã đăng',
      accessor: row => {
        const stats = finalProductStatsByClassId?.get(row.cls.id) || getEmptyFinalProductStats(row.cls.id, getActiveStudentCount(row.cls));
        return stats.submittedCount;
      },
    },
    finalProductMissing: {
      header: 'Sản phẩm thiếu',
      accessor: row => {
        const stats = finalProductStatsByClassId?.get(row.cls.id) || getEmptyFinalProductStats(row.cls.id, getActiveStudentCount(row.cls));
        return stats.missingCount;
      },
    },
    finalProductPending: {
      header: 'Sản phẩm chờ xử lý',
      accessor: row => {
        const stats = finalProductStatsByClassId?.get(row.cls.id) || getEmptyFinalProductStats(row.cls.id, getActiveStudentCount(row.cls));
        return stats.pendingCount;
      },
    },
    finalProductRejected: {
      header: 'Sản phẩm bị từ chối',
      accessor: row => {
        const stats = finalProductStatsByClassId?.get(row.cls.id) || getEmptyFinalProductStats(row.cls.id, getActiveStudentCount(row.cls));
        return stats.rejectedCount;
      },
    },
    finalSessionDate: {
      header: 'Ngày buổi cuối',
      accessor: row => {
        const stats = finalProductStatsByClassId?.get(row.cls.id) || getEmptyFinalProductStats(row.cls.id, getActiveStudentCount(row.cls));
        return formatExportDate(stats.finalSessionDate);
      },
    },
    cp1Average: { header: 'Điểm TB CP1', accessor: row => formatExportNumber(row.cp1Analysis.averageScore) },
    cp1Passed: { header: 'CP1 đạt', accessor: row => row.cp1Analysis.passCount },
    cp1Missing: { header: 'CP1 thiếu điểm', accessor: row => getMissingScoreCount(row, 'cp1Analysis') },
    cp2Average: { header: 'Điểm TB CP2', accessor: row => formatExportNumber(row.cp2Analysis.averageScore) },
    cp2Passed: { header: 'CP2 đạt', accessor: row => row.cp2Analysis.passCount },
    cp2Missing: { header: 'CP2 thiếu điểm', accessor: row => getMissingScoreCount(row, 'cp2Analysis') },
    demoAverage: { header: 'Điểm TB Demo', accessor: row => formatExportNumber(row.demoAnalysis.averageScore) },
    demoPassed: { header: 'Demo đạt', accessor: row => row.demoAnalysis.passCount },
    demoMissing: { header: 'Demo thiếu điểm', accessor: row => getMissingScoreCount(row, 'demoAnalysis') },
    followUpStatus: {
      header: CLASS_QUALITY_LABELS.FOLLOW_UP_STATUS,
      accessor: row => getFollowUpStatusLabel(followUpsByClassId.get(row.cls.id)?.status || DEFAULT_FOLLOW_UP_STATUS),
    },
    followUpNote: {
      header: CLASS_QUALITY_LABELS.FOLLOW_UP_NOTE,
      accessor: row => followUpsByClassId.get(row.cls.id)?.note || '',
    },
    followUpUpdatedAt: {
      header: 'Cập nhật xử lý lúc',
      accessor: row => formatFollowUpUpdatedAt(followUpsByClassId.get(row.cls.id)?.updatedAt || ''),
    },
    followUpUpdatedBy: {
      header: 'Người cập nhật xử lý',
      accessor: row => followUpsByClassId.get(row.cls.id)?.updatedByEmail || '',
    },
  }), [finalProductStatsByClassId, followUpsByClassId]);

  const classQualityCSVColumns = useMemo(() => (
    csvColumns
      .filter(column => column.enabled)
      .map(column => classQualityColumnMap[column.id])
      .filter(Boolean)
  ), [classQualityColumnMap, csvColumns]);

  const handleExportCSV = useCallback(() => {
    if (filtered.length === 0) return;
    if (classQualityCSVColumns.length === 0) return;
    exportToCSV(filtered, classQualityCSVColumns, 'tinh-hinh-lop-hoc');
  }, [classQualityCSVColumns, filtered]);

  return (
    <div className={styles.customQualityStack}>
    <section className={styles.customQualityOverview} aria-label="Xu hướng chất lượng phần tự viết">
      <div className={styles.customQualityHeader}>
        <div>
          <h3 className={styles.customQualityTitle}>Chất lượng phần tự viết</h3>
          <p className={styles.customQualitySubtitle}>
            Không tính Trùng mẫu/Dựa mẫu
          </p>
        </div>
        <div className={styles.customQualityWeekControls}>
          <DateRangeInput
            dateFrom={resolvedAnalysisDateFrom}
            dateTo={resolvedAnalysisDateTo}
            onDateFromChange={setAnalysisDateFrom}
            onDateToChange={setAnalysisDateTo}
            label="Kỳ phân tích"
            menuPosition="fixed"
          />
          <DateRangeInput
            dateFrom={resolvedComparisonDateFrom}
            dateTo={resolvedComparisonDateTo}
            onDateFromChange={setComparisonDateFrom}
            onDateToChange={setComparisonDateTo}
            label="Kỳ đối chiếu"
            menuPosition="fixed"
          />
          <TrendBadge delta={customQualityComparison.delta} />
        </div>
      </div>

      <div className={styles.customQualityMetricGrid}>
        <div className={styles.customQualityMetricCard}>
          <span className={styles.customQualityMetricLabel}>Tự viết đạt</span>
          <strong className={styles.customQualityMetricValue} style={{ color: 'var(--status-success)' }}>
            {formatPassRate(customQualityComparison.current.passRate)}
          </strong>
          <span className={styles.customQualityMetricMeta}>{customQualityComparison.current.ok}/{customQualityComparison.current.finalized} đã chốt</span>
        </div>
        <div className={styles.customQualityMetricCard}>
          <span className={styles.customQualityMetricLabel}>{COMMENT_STATUS_COUNT_LABELS.empty}</span>
          <strong className={styles.customQualityMetricValue} style={{ color: 'var(--brand-indigo)' }}>{customQualityComparison.current.pending}</strong>
          <span className={styles.customQualityMetricMeta}>Chưa tính là lỗi</span>
        </div>
        <div className={styles.customQualityMetricCard}>
          <span className={styles.customQualityMetricLabel}>{COMMENT_STATUS_COUNT_LABELS.brief}</span>
          <strong className={styles.customQualityMetricValue} style={{ color: 'var(--status-warning)' }}>{customQualityComparison.current.brief}</strong>
          <span className={styles.customQualityMetricMeta}>Phần tự viết</span>
        </div>
        <div className={styles.customQualityMetricCard}>
          <span className={styles.customQualityMetricLabel}>{COMMENT_STATUS_COUNT_LABELS.duplicate}</span>
          <strong className={styles.customQualityMetricValue} style={{ color: 'var(--status-dark-orange)' }}>{customQualityComparison.current.duplicate}</strong>
          <span className={styles.customQualityMetricMeta}>Tự lặp / lặp giữa HV</span>
        </div>
        <div className={styles.customQualityMetricCard}>
          <span className={styles.customQualityMetricLabel}>{COMMENT_STATUS_COUNT_LABELS.overdue}</span>
          <strong className={styles.customQualityMetricValue} style={{ color: 'var(--status-error)' }}>{customQualityComparison.current.overdue}</strong>
          <span className={styles.customQualityMetricMeta}>Chưa có sau SLA</span>
        </div>
      </div>

      <div className={styles.customQualitySessionBlock}>
        <div className={styles.customQualitySessionHeader}>
          <span>So sánh theo buổi</span>
          <span>Tỷ lệ tự viết đạt</span>
        </div>
        {customQualityBySession.length > 0 ? (
          <div className={styles.customQualitySessionList}>
            {customQualityBySession.map((item, index) => {
              const previous = customQualityBySession[index - 1]?.metrics.passRate ?? null;
              const delta = item.metrics.passRate !== null && previous !== null
                ? item.metrics.passRate - previous
                : null;
              return (
                <div
                  key={item.sessionIndex}
                  className={styles.customQualitySessionItem}
                  title={`Đạt ${item.metrics.ok}/${item.metrics.finalized} · Sơ sài ${item.metrics.brief} · Trùng/lặp ${item.metrics.duplicate} · Quá hạn ${item.metrics.overdue}`}
                >
                  <span className={styles.customQualitySessionName}>B{item.sessionIndex + 1}</span>
                  <strong>{formatPassRate(item.metrics.passRate)}</strong>
                  <span className={delta === null ? styles.customQualityDeltaNeutral : delta >= 0 ? styles.customQualityDeltaUp : styles.customQualityDeltaDown}>
                    {delta === null ? '—' : `${delta >= 0 ? '↑' : '↓'} ${Math.abs(delta).toFixed(1)} điểm %`}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className={styles.customQualityEmpty}>Chưa có dữ liệu tự viết để so sánh theo buổi.</div>
        )}
      </div>
      <p className={styles.customQualityFootnote}>
        Tỷ lệ đạt = Tự viết đạt / (Tự viết đạt + Sơ sài + Trùng/lặp + Quá hạn). Trống trong hạn được theo dõi riêng.
      </p>
    </section>
    <AdminTableSection
        title={CLASS_QUALITY_LABELS.PANEL_TITLE}
        count={filtered.length}
        isExpanded={true}
        actionSlot={
          <ExportButton
            onClick={handleExportCSV}
            onSettingsClick={() => setShowCSVSettings(true)}
            disabled={filtered.length === 0}
            count={filtered.length}
            label="Xuất CSV"
          />
        }
        toolbarSlot={
          <TableToolbar
          search={search}
          onSearchChange={onSearchChange}
          searchPlaceholder={`${LABELS.SEARCH_CLASS.replace('...', '')}, ${LABELS.CENTRE.toLowerCase()}...`}
          quickFilterSlots={
            <div className={styles.toolbarCluster}>
              {QUICK_FILTERS.map(f => (
                <FilterChip
                  key={f.key}
                  active={quickFilter === f.key}
                  count={
                    f.key === 'attendanceAlerts' ? issueCounts.attendanceAlerts :
                    issueCounts.rescheduled
                  }
                  countDisplay="always"
                  onClick={() => setQuickFilter(quickFilter === f.key ? null : f.key)}
                >
                  {f.label}
                </FilterChip>
              ))}
              <MultiSelect
                menuPosition="fixed"
                options={finalProductFilterOptions}
                selected={finalProductFilters}
                onChange={(values) => setFinalProductFilters(values as FinalProductFilter[])}
                placeholder={finalProductFilters.length > 0 ? CLASS_QUALITY_LABELS.FINAL_PRODUCTS : 'Tất cả sản phẩm cuối khóa'}
                maxDisplay={1}
              />
              <MultiSelect
                menuPosition="fixed"
                options={commentDetailOptions}
                selected={commentDetailFilters}
                onChange={(values) => setCommentDetailFilters(values as CommentDetailFilter[])}
                placeholder={commentDetailFilters.length > 0 ? CLASS_QUALITY_LABELS.COMMENT_DETAIL_FILTER : CLASS_QUALITY_LABELS.ALL_COMMENT_DETAILS}
                maxDisplay={1}
              />
              <MultiSelect
                menuPosition="fixed"
                options={latestSessionCommentDetailOptions}
                selected={latestSessionCommentDetailFilters}
                onChange={(values) => setLatestSessionCommentDetailFilters(values as CommentDetailFilter[])}
                placeholder={latestSessionCommentDetailFilters.length > 0 ? 'Lỗi buổi gần nhất' : 'Tất cả lỗi buổi gần nhất'}
                maxDisplay={1}
              />
            </div>
          }
          filterSlots={
            <div className={styles.toolbarCluster}>
              <MultiSelect
                menuPosition="fixed"
                options={filterOptions.centres}
                selected={selectedCentres}
                onChange={setSelectedCentres}
                placeholder={selectedCentres.length > 0 ? `${LABELS.CENTRE} (${selectedCentres.length})` : LABELS.ALL_CENTRES}
                maxDisplay={1}
              />
              <MultiSelect
                menuPosition="fixed"
                options={filterOptions.courses}
                selected={selectedCourses}
                onChange={setSelectedCourses}
                placeholder={selectedCourses.length > 0 ? `Khoá học (${selectedCourses.length})` : 'Tất cả khoá học'}
                maxDisplay={1}
              />
              <MultiSelect
                menuPosition="fixed"
                options={filterOptions.teachers}
                selected={selectedTeachers}
                onChange={setSelectedTeachers}
                placeholder={selectedTeachers.length > 0 ? `${LABELS.TEACHER} (${selectedTeachers.length})` : 'Tất cả giáo viên'}
                maxDisplay={1}
              />
              <MultiSelect
                menuPosition="fixed"
                options={filterOptions.roles}
                selected={selectedRoles}
                onChange={setSelectedRoles}
                placeholder={selectedRoles.length > 0 ? `Vai trò (${selectedRoles.length})` : 'Tất cả vai trò'}
                maxDisplay={1}
              />
              <MultiSelect
                menuPosition="fixed"
                options={filterOptions.statuses}
                selected={selectedStatuses}
                onChange={setSelectedStatuses}
                placeholder={selectedStatuses.length > 0 ? `${LABELS.STATUS} (${selectedStatuses.length})` : LABELS.ALL_STATUSES}
                maxDisplay={1}
              />
              <MultiSelect
                menuPosition="fixed"
                options={followUpFilterOptions}
                selected={selectedFollowUpStatuses}
                onChange={(values) => setSelectedFollowUpStatuses(values as ClassQualityFollowUpStatus[])}
                placeholder={
                  followUpsLoading
                    ? 'Đang tải trạng thái xử lý...'
                    : selectedFollowUpStatuses.length > 0
                      ? `Xử lý (${selectedFollowUpStatuses.length})`
                      : 'Tất cả trạng thái xử lý'
                }
                searchable={false}
                maxDisplay={1}
              />
              {onDateFromChange && onDateToChange && (
                <DateRangeInput
                  dateFrom={dateFrom}
                  dateTo={dateTo}
                  onDateFromChange={onDateFromChange}
                  onDateToChange={onDateToChange}
                  label="Thời gian"
                  menuPosition="fixed"
                />
              )}
              <span className={styles.metricText}>
                {dateRangePending ? 'Đang cập nhật... ' : ''}
                {filtered.length}/{classes.length} {CLASS_QUALITY_LABELS.VISIBLE_CLASS_COUNT_SUFFIX}
              </span>
            </div>
          }
          hasFilter={!!quickFilter || finalProductFilters.length > 0 || commentDetailFilters.length > 0 || latestSessionCommentDetailFilters.length > 0 || selectedCentres.length > 0 || selectedCourses.length > 0 || selectedTeachers.length > 0 || selectedRoles.length > 0 || selectedStatuses.length > 0 || selectedFollowUpStatuses.length > 0 || !!dateFrom || !!dateTo || !!search.trim()}
          onClearFilter={() => {
            setQuickFilter(null);
            setFinalProductFilters([]);
            setCommentDetailFilters([]);
            setLatestSessionCommentDetailFilters([]);
            setSelectedCentres([]);
            setSelectedCourses([]);
            setSelectedTeachers([]);
            setSelectedRoles([]);
            setSelectedStatuses([]);
            setSelectedFollowUpStatuses([]);
            onDateFromChange?.('');
            onDateToChange?.('');
            onSearchChange('');
          }}
        />
        }
      >

        {followUpsError && (
          <div className={styles.qualityFollowUpLoadError}>{followUpsError}</div>
        )}
        <div className={styles.tableScrollWrapper}>
          <table className={`${styles.studentTable} ${styles.tableSm}`}>
          <thead>
            <tr>
              <th>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                  <button
                    type="button"
                    onClick={() => handleSort('name')}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      font: 'inherit',
                      color: 'inherit',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-1)',
                    }}
                  >
                    <span>{LABELS.CLASS_NAME}</span>
                    {sortKey === 'name' ? (
                      sortDir === 'asc' ? (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="18 15 12 9 6 15" />
                        </svg>
                      ) : (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      )
                    ) : (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.3 }}>
                        <polyline points="18 15 12 9 6 15" />
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    )}
                  </button>
                  <CopyClassCodesButton classCodes={visibleClassCodes} disabled={filtered.length === 0} />
                </div>
              </th>
              <SortableHeader label={LABELS.TEACHER} sortKey="teacher" currentSortKey={sortKey} sortOrder={sortDir} onSort={(key) => handleSort(key as SortKey)} />
              <SortableHeader label={CLASS_QUALITY_LABELS.STUDENT_COUNT} sortKey="studentCount" currentSortKey={sortKey} sortOrder={sortDir} onSort={(key) => handleSort(key as SortKey)} className={styles.centerCell} />
              <SortableHeader label={LABELS.PROGRESS} sortKey="progress" currentSortKey={sortKey} sortOrder={sortDir} onSort={(key) => handleSort(key as SortKey)} className={styles.centerCell} />
              <SortableHeader label={CLASS_QUALITY_LABELS.TEACHER_COMMENTS} sortKey="commentIssues" currentSortKey={sortKey} sortOrder={sortDir} onSort={(key) => handleSort(key as SortKey)} />
              <SortableHeader label={CLASS_QUALITY_LABELS.ATTENDANCE} sortKey="attendanceAlerts" currentSortKey={sortKey} sortOrder={sortDir} onSort={(key) => handleSort(key as SortKey)} />
              <SortableHeader label={CLASS_QUALITY_LABELS.SCHEDULE_CHANGES} sortKey="rescheduled" currentSortKey={sortKey} sortOrder={sortDir} onSort={(key) => handleSort(key as SortKey)} />
              <SortableHeader label={CLASS_QUALITY_LABELS.FINAL_PRODUCTS} sortKey="finalProducts" currentSortKey={sortKey} sortOrder={sortDir} onSort={(key) => handleSort(key as SortKey)} />
              <SortableHeader label={CLASS_QUALITY_LABELS.CHECKPOINT_DEMO_SCORES} sortKey="cp" currentSortKey={sortKey} sortOrder={sortDir} onSort={(key) => handleSort(key as SortKey)} />
              <th className={styles.qualityFollowUpHeader}>{CLASS_QUALITY_LABELS.FOLLOW_UP_MANAGEMENT}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={10}>
                  <EmptyState title={LABELS.NO_DATA} subtitle={LABELS.NO_RESULTS} />
                </td>
              </tr>
            ) : filtered.map(a => {
              const teacher = getPrimaryTeacher(a.cls);
              const ca = a.commentAnalysis;
              const aa = a.attendanceAnalysis;
              const ra = a.reschedulingAnalysis;
              const studentCount = getActiveStudentCount(a.cls);
              const commentIssues = ca.customBriefCount + ca.customDuplicateCount + ca.customOverdueCount;
              const customFinalized = ca.customOkCount + commentIssues;
              const customPassRate = customFinalized > 0 ? (ca.customOkCount / customFinalized) * 100 : null;
              const rescheduledRate = ra.totalSessions > 0
                ? Math.round((ra.rescheduledSessions / ra.totalSessions) * 100) : 0;

              // Per-alert-type counts
              const freqCount = aa.studentsWithAlerts.filter(s => s.alerts.includes('frequent_absent')).length;
              const consCount = aa.studentsWithAlerts.filter(s => s.alerts.includes('consecutive_absent')).length;
              const lateCount = aa.studentsWithAlerts.filter(s => s.alerts.includes('late_stage_absent')).length;

              const isAnalysisDue = (sessionDate: string | null | undefined) => {
                if (!sessionDate) return false;
                const time = new Date(sessionDate).getTime();
                return Number.isFinite(time) && time <= Date.now();
              };
              const shouldShowCP1 = a.cp1Analysis.hasSession && isAnalysisDue(a.cp1Analysis.sessionDate);
              const shouldShowCP2 = a.cp2Analysis.hasSession && isAnalysisDue(a.cp2Analysis.sessionDate);
              const shouldShowDemo = a.demoAnalysis.hasSession && a.demoAnalysis.studentsWithScores > 0;
              const cp1MissingScoreCount = Math.max(a.cp1Analysis.missingScoreCount, studentCount - a.cp1Analysis.studentsWithScores);
              const cp2MissingScoreCount = Math.max(a.cp2Analysis.missingScoreCount, studentCount - a.cp2Analysis.studentsWithScores);
              const demoMissingScoreCount = Math.max(a.demoAnalysis.missingScoreCount, studentCount - a.demoAnalysis.studentsWithScores);
              const finalStats = finalProductStatsByClassId?.get(a.cls.id) || getEmptyFinalProductStats(a.cls.id, studentCount);

              return (
                <tr
                  key={a.cls.id}
                  onClick={() => onRowClick?.(a)}
                  className={onRowClick ? styles.clickableRow : undefined}
                >
                  {/* Lớp */}
                  <td>
                    <div className={styles.classTitle}>{a.cls.name}</div>
                    {a.cls.centre?.shortName && (
                      <div className={styles.captionText}>
                        {a.cls.centre.shortName}
                      </div>
                    )}
                  </td>

                  {/* Giáo viên */}
                  <td>{teacher}</td>

                  <td className={styles.centerCell}>
                    <span className={styles.classTitle}>{studentCount}</span>
                  </td>

                  {/* Tiến độ */}
                  <td className={styles.centerCell}>
                    <span className={styles.classTitle}>
                      {ca.passedSlots}
                    </span>
                    <span className={styles.mutedText}>/{ca.totalSlots}</span>
                  </td>

                  {/* Nhận xét giáo viên */}
                  <td>
                    <div className={styles.inlineCluster}>
                      {customPassRate !== null ? (
                        <Badge variant={commentIssues === 0 ? 'passed' : 'default'} size="sm">
                          Tự viết đạt: {customPassRate.toFixed(1)}%
                        </Badge>
                      ) : ca.customPendingCount === 0 ? (
                        <Badge variant="exempt" size="sm">Chưa có tự viết</Badge>
                      ) : null}
                        <IssueChip label={COMMENT_STATUS_COUNT_LABELS.brief} count={ca.customBriefCount} tone="warning" />
                        <IssueChip label={COMMENT_STATUS_COUNT_LABELS.empty} count={ca.customPendingCount} tone="info" />
                        <IssueChip label={COMMENT_STATUS_COUNT_LABELS.overdue} count={ca.customOverdueCount} tone="error" />
                        <IssueChip label={COMMENT_STATUS_COUNT_LABELS.duplicate} count={ca.customDuplicateCount} tone="warning" />
                    </div>
                  </td>

                  {/* Chuyên cần */}
                  <td>
                    {aa.totalAlerts === 0 ? (
                      <Badge variant="passed" size="sm">{LABELS.GOOD}</Badge>
                    ) : (
                      <div className={styles.inlineCluster}>
                        <IssueChip label={ATTENDANCE_ALERT_LABELS.frequent_absent} count={freqCount} tone="error" />
                        <IssueChip label={ATTENDANCE_ALERT_LABELS.consecutive_absent} count={consCount} tone="warning" />
                        <IssueChip label={ATTENDANCE_ALERT_LABELS.late_stage_absent} count={lateCount} tone="warning" />
                      </div>
                    )}
                  </td>

                  {/* Thay đổi lịch */}
                  <td>
                    {ra.rescheduledSessions === 0 ? (
                      <RescheduleStatusBadge status="on_schedule" />
                    ) : (
                      <div className={styles.inlineCluster}>
                        <IssueChip label={CLASS_QUALITY_LABELS.RESCHEDULED_SESSIONS} count={ra.rescheduledSessions} tone="warning" />
                        <span className={styles.metricText}>{rescheduledRate}%</span>
                      </div>
                    )}
                  </td>

                  {/* Sản phẩm cuối khóa */}
                  <td>
                    {finalProductStatsLoading ? (
                      <span className={styles.mutedText}>Đang tải...</span>
                    ) : !finalStats.isFinalSessionCompleted ? (
                      <Badge variant="default" size="sm">{CLASS_QUALITY_LABELS.FINAL_PRODUCT_NOT_DUE}</Badge>
                    ) : finalStats.missingCount === 0 && finalStats.pendingCount === 0 && finalStats.rejectedCount === 0 ? (
                      <div className={styles.inlineCluster}>
                        <Badge variant="passed" size="sm">{CLASS_QUALITY_LABELS.FINAL_PRODUCT_SUBMITTED}</Badge>
                      </div>
                    ) : (
                      <div className={styles.inlineCluster}>
                        <IssueChip label={CLASS_QUALITY_LABELS.FINAL_PRODUCT_MISSING} count={finalStats.missingCount} tone="error" />
                        <IssueChip label={CLASS_QUALITY_LABELS.FINAL_PRODUCT_PENDING} count={finalStats.pendingCount} tone="warning" />
                        <IssueChip label={CLASS_QUALITY_LABELS.FINAL_PRODUCT_REJECTED} count={finalStats.rejectedCount} tone="error" />
                      </div>
                    )}
                  </td>

                  {/* Điểm checkpoint / demo */}
                  <td>
                    <div className={styles.stackXs}>
                      <div className={styles.inlineCluster} style={{ gap: 'var(--space-4)', alignItems: 'flex-start' }}>
                        {shouldShowCP1 && (
                          <div className={styles.stackXs} style={{ gap: '2px', minWidth: '36px', alignItems: 'center' }}>
                            <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-quaternary)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>CP1</span>
                            {a.cp1Analysis.studentsWithScores > 0 ? (
                              <>
                                <span style={{ 
                                  fontSize: '13px', 
                                  fontWeight: 700, 
                                  color: (a.cp1Analysis.averageScore ?? 0) >= 3.5 ? 'var(--status-success)' : 'var(--status-error)' 
                                }}>
                                  {(a.cp1Analysis.averageScore ?? 0).toFixed(1)}
                                </span>
                                <span style={{ fontSize: '10px', color: 'var(--text-quaternary)', whiteSpace: 'nowrap' }}>
                                  Đạt {a.cp1Analysis.passCount}/{studentCount} HV
                                </span>
                                {cp1MissingScoreCount > 0 && (
                                  <span style={{ fontSize: '10px', color: 'var(--status-warning)', whiteSpace: 'nowrap' }}>
                                    Thiếu {cp1MissingScoreCount}
                                  </span>
                                )}
                              </>
                            ) : (
                              <span style={{ fontSize: '10px', fontWeight: 650, color: 'var(--status-warning)', whiteSpace: 'nowrap' }}>
                                Thiếu {cp1MissingScoreCount || studentCount}
                              </span>
                            )}
                          </div>
                        )}
                        {shouldShowCP2 && (
                          <div className={styles.stackXs} style={{ gap: '2px', minWidth: '36px', alignItems: 'center' }}>
                            <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-quaternary)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>CP2</span>
                            {a.cp2Analysis.studentsWithScores > 0 ? (
                              <>
                                <span style={{ 
                                  fontSize: '13px', 
                                  fontWeight: 700, 
                                  color: (a.cp2Analysis.averageScore ?? 0) >= 3.5 ? 'var(--status-success)' : 'var(--status-error)' 
                                }}>
                                  {(a.cp2Analysis.averageScore ?? 0).toFixed(1)}
                                </span>
                                <span style={{ fontSize: '10px', color: 'var(--text-quaternary)', whiteSpace: 'nowrap' }}>
                                  Đạt {a.cp2Analysis.passCount}/{studentCount} HV
                                </span>
                                {cp2MissingScoreCount > 0 && (
                                  <span style={{ fontSize: '10px', color: 'var(--status-warning)', whiteSpace: 'nowrap' }}>
                                    Thiếu {cp2MissingScoreCount}
                                  </span>
                                )}
                              </>
                            ) : (
                              <span style={{ fontSize: '10px', fontWeight: 650, color: 'var(--status-warning)', whiteSpace: 'nowrap' }}>
                                Thiếu {cp2MissingScoreCount || studentCount}
                              </span>
                            )}
                          </div>
                        )}
                        {shouldShowDemo && (
                          <div className={styles.stackXs} style={{ gap: '2px', minWidth: '36px', alignItems: 'center' }}>
                            <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-quaternary)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>Demo</span>
                            <span style={{ 
                              fontSize: '13px', 
                              fontWeight: 700, 
                              color: (a.demoAnalysis.averageScore ?? 0) >= 3.5 ? 'var(--status-success)' : 'var(--status-error)' 
                            }}>
                              {(a.demoAnalysis.averageScore ?? 0).toFixed(1)}
                            </span>
                            <span style={{ fontSize: '10px', color: 'var(--text-quaternary)', whiteSpace: 'nowrap' }}>
                              Đạt {a.demoAnalysis.passCount}/{studentCount} HV
                            </span>
                            {demoMissingScoreCount > 0 && (
                              <span style={{ fontSize: '10px', color: 'var(--status-warning)', whiteSpace: 'nowrap' }}>
                                Thiếu {demoMissingScoreCount}
                              </span>
                            )}
                          </div>
                        )}
                        {!shouldShowCP1 && !shouldShowCP2 && !shouldShowDemo && (
                          <span className={styles.mutedText}>—</span>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Quản lý xử lý */}
                  <td
                    className={styles.qualityFollowUpCell}
                    onClick={event => event.stopPropagation()}
                  >
                    <ClassQualityFollowUpCell
                      key={`${a.cls.id}:${followUpsLoading ? 'loading' : followUpsByClassId.get(a.cls.id)?.updatedAt || 'empty'}`}
                      classId={a.cls.id}
                      className={a.cls.name}
                      followUp={followUpsByClassId.get(a.cls.id)}
                      loading={followUpsLoading}
                      canEdit={canEdit('teacher-schedule')}
                      onSave={handleSaveFollowUp}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
          </table>
        </div>
    </AdminTableSection>
    <CSVExportSettings
      isOpen={showCSVSettings}
      onClose={() => setShowCSVSettings(false)}
      columns={csvColumns}
      onSave={saveCsvColumns}
      title="Cài đặt xuất CSV - Tình hình lớp học"
    />
    </div>
  );
}
