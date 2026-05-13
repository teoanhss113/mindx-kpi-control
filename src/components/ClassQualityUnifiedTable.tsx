'use client';

import React, { useState, useMemo } from 'react';
import { AnalyzedClassForQuality } from '@/types/classQuality';
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
} from '@/components/ui';
import { CLASS_QUALITY_LABELS, LABELS } from '@/constants';
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

function getActiveStudentCount(cls: AnalyzedClassForQuality['cls']): number {
  return (cls.students || []).filter(student => student.activeInClass).length;
}

type SortKey = 'name' | 'teacher' | 'studentCount' | 'progress' | 'commentIssues' | 'attendanceAlerts' | 'rescheduled' | 'cp';
type QuickFilterKey = 'attendanceAlerts' | 'rescheduled';
type CommentDetailFilter = (typeof COMMENT_DETAIL_FILTER_OPTIONS)[number]['value'];

interface Props {
  classes: AnalyzedClassForQuality[];
  search: string;
  onSearchChange: (v: string) => void;
  onRowClick?: (a: AnalyzedClassForQuality) => void;
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

function getLatestPassedSessionIndex(a: AnalyzedClassForQuality): number | null {
  const latestIndex = a.commentAnalysis.passedSlots - 1;
  return latestIndex >= 0 ? latestIndex : null;
}

function hasLatestSessionCommentStatus(a: AnalyzedClassForQuality, status: CommentDetailFilter): boolean {
  const latestIndex = getLatestPassedSessionIndex(a);
  if (latestIndex === null) return false;

  return a.commentAnalysis.students.some(student =>
    student.comments.some(comment =>
      comment.sessionIndex === latestIndex && comment.status === status
    )
  );
}

function hasCommentStatus(a: AnalyzedClassForQuality, status: CommentDetailFilter): boolean {
  return a.commentAnalysis.students.some(student =>
    student.comments.some(comment => comment.status === status)
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

// ─── Main component ───────────────────────────────────────────────────────────
export function ClassQualityUnifiedTable({ classes, search, onSearchChange, onRowClick }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('commentIssues');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [quickFilter, setQuickFilter] = useState<QuickFilterKey | null>(null);
  const [commentDetailFilters, setCommentDetailFilters] = useState<CommentDetailFilter[]>([]);
  const [latestSessionCommentDetailFilters, setLatestSessionCommentDetailFilters] = useState<CommentDetailFilter[]>([]);
  
  // Basic table filters
  const [selectedCentres, setSelectedCentres] = useState<string[]>([]);
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [selectedTeachers, setSelectedTeachers] = useState<string[]>([]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  // Extract unique filter options
  const filterOptions = useMemo(() => {
    const centres = new Set<string>();
    const courses = new Set<string>();
    const teachers = new Set<string>();

    classes.forEach(a => {
      if (a.cls.centre?.shortName) centres.add(a.cls.centre.shortName);
      if (a.courseLineName) courses.add(a.courseLineName);
      const teacher = getPrimaryTeacher(a.cls);
      if (teacher && teacher !== 'Không rõ') teachers.add(teacher);
    });

    return {
      centres: Array.from(centres).sort().map(c => ({ value: c, label: c })),
      courses: Array.from(courses).sort().map(c => ({ value: c, label: c })),
      teachers: Array.from(teachers).sort().map(t => ({ value: t, label: t })),
    };
  }, [classes]);

  const baseList = useMemo(() => {
    let list = classes;
    
    // Apply basic filters first
    if (selectedCentres.length > 0) {
      list = list.filter(a => a.cls.centre?.shortName && selectedCentres.includes(a.cls.centre.shortName));
    }
    if (selectedCourses.length > 0) {
      list = list.filter(a => a.courseLineName && selectedCourses.includes(a.courseLineName));
    }
    if (selectedTeachers.length > 0) {
      list = list.filter(a => selectedTeachers.includes(getPrimaryTeacher(a.cls)));
    }
    
    // Then apply search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(a => a.cls.name.toLowerCase().includes(q) || a.cls.centre?.shortName?.toLowerCase().includes(q));
    }
    return list;
  }, [classes, search, selectedCentres, selectedCourses, selectedTeachers]);

  const issueCounts = useMemo(() => {
    let attendanceAlerts = 0;
    let rescheduled = 0;
    const commentDetails: Record<CommentDetailFilter, number> = {
      overdue: 0,
      duplicate_other: 0,
      template_exact: 0,
      brief: 0,
      empty: 0,
      duplicate_self: 0,
      template_modified: 0,
    };
    const latestSessionCommentDetails: Record<CommentDetailFilter, number> = {
      overdue: 0,
      duplicate_other: 0,
      template_exact: 0,
      brief: 0,
      empty: 0,
      duplicate_self: 0,
      template_modified: 0,
    };

    baseList.forEach(a => {
      if (a.attendanceAnalysis.totalAlerts > 0) attendanceAlerts += 1;
      if (a.reschedulingAnalysis.rescheduledSessions > 0) rescheduled += 1;
      
      COMMENT_DETAIL_FILTER_OPTIONS.forEach(option => {
        if (hasCommentStatus(a, option.value)) commentDetails[option.value] += 1;
        if (hasLatestSessionCommentStatus(a, option.value)) latestSessionCommentDetails[option.value] += 1;
      });
    });

    return { attendanceAlerts, rescheduled, commentDetails, latestSessionCommentDetails };
  }, [baseList]);

  const commentDetailOptions = useMemo(() => COMMENT_DETAIL_FILTER_OPTIONS.map(option => ({
    ...option,
    label: `${option.label} (${issueCounts.commentDetails[option.value]})`,
  })), [issueCounts.commentDetails]);

  const latestSessionCommentDetailOptions = useMemo(() => COMMENT_DETAIL_FILTER_OPTIONS.map(option => ({
    ...option,
    label: `${option.label} (${issueCounts.latestSessionCommentDetails[option.value]})`,
  })), [issueCounts.latestSessionCommentDetails]);

  const visibleClasses = useMemo(() => {
    let list = baseList;
    if (quickFilter === 'attendanceAlerts') {
      list = list.filter(a => a.attendanceAnalysis.totalAlerts > 0);
    }
    if (quickFilter === 'rescheduled') {
      list = list.filter(a => a.reschedulingAnalysis.rescheduledSessions > 0);
    }
    if (commentDetailFilters.length > 0) {
      list = list.filter(a => commentDetailFilters.some(status => hasCommentStatus(a, status)));
    }
    if (latestSessionCommentDetailFilters.length > 0) {
      list = list.filter(a => latestSessionCommentDetailFilters.some(status => hasLatestSessionCommentStatus(a, status)));
    }

    return list;
  }, [baseList, quickFilter, commentDetailFilters, latestSessionCommentDetailFilters]);

  const filtered = useMemo(() => {
    return [...visibleClasses].sort((a, b) => {
      const d = sortDir === 'asc' ? 1 : -1;
      const aCI = a.commentAnalysis.emptyCount + a.commentAnalysis.briefCount + a.commentAnalysis.duplicateCount + a.commentAnalysis.overdueCount;
      const bCI = b.commentAnalysis.emptyCount + b.commentAnalysis.briefCount + b.commentAnalysis.duplicateCount + b.commentAnalysis.overdueCount;
      if (sortKey === 'name') return d * a.cls.name.localeCompare(b.cls.name);
      if (sortKey === 'teacher') return d * getPrimaryTeacher(a.cls).localeCompare(getPrimaryTeacher(b.cls));
      if (sortKey === 'studentCount') return d * (getActiveStudentCount(a.cls) - getActiveStudentCount(b.cls));
      if (sortKey === 'progress') return d * (a.commentAnalysis.passedSlots - b.commentAnalysis.passedSlots);
      if (sortKey === 'commentIssues') return d * (aCI - bCI);
      if (sortKey === 'attendanceAlerts') return d * (a.attendanceAnalysis.totalAlerts - b.attendanceAnalysis.totalAlerts);
      if (sortKey === 'rescheduled') return d * (a.reschedulingAnalysis.rescheduledSessions - b.reschedulingAnalysis.rescheduledSessions);
      if (sortKey === 'cp') {
        const aCP = (a.cp1Analysis.averageScore ?? 0) + (a.cp2Analysis.averageScore ?? 0);
        const bCP = (b.cp1Analysis.averageScore ?? 0) + (b.cp2Analysis.averageScore ?? 0);
        return d * (aCP - bCP);
      }
      return 0;
    });
  }, [visibleClasses, sortKey, sortDir]);

  const visibleClassCodes = useMemo(() => visibleClasses.map(a => a.cls.name), [visibleClasses]);

  return (
    <AdminTableSection
        title={CLASS_QUALITY_LABELS.PANEL_TITLE}
        count={filtered.length}
        isExpanded={true}
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
              <span className={styles.metricText}>{filtered.length}/{classes.length} {CLASS_QUALITY_LABELS.VISIBLE_CLASS_COUNT_SUFFIX}</span>
            </div>
          }
          hasFilter={!!quickFilter || commentDetailFilters.length > 0 || latestSessionCommentDetailFilters.length > 0 || selectedCentres.length > 0 || selectedCourses.length > 0 || selectedTeachers.length > 0 || !!search.trim()}
          onClearFilter={() => {
            setQuickFilter(null);
            setCommentDetailFilters([]);
            setLatestSessionCommentDetailFilters([]);
            setSelectedCentres([]);
            setSelectedCourses([]);
            setSelectedTeachers([]);
            onSearchChange('');
          }}
        />
        }
      >

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
              <SortableHeader label={CLASS_QUALITY_LABELS.CHECKPOINT_DEMO_SCORES} sortKey="cp" currentSortKey={sortKey} sortOrder={sortDir} onSort={(key) => handleSort(key as SortKey)} />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8}>
                  <EmptyState title={LABELS.NO_DATA} subtitle={LABELS.NO_RESULTS} />
                </td>
              </tr>
            ) : filtered.map(a => {
              const teacher = getPrimaryTeacher(a.cls);
              const ca = a.commentAnalysis;
              const aa = a.attendanceAnalysis;
              const ra = a.reschedulingAnalysis;
              const studentCount = getActiveStudentCount(a.cls);
              const commentIssues = ca.emptyCount + ca.briefCount + ca.duplicateCount + ca.overdueCount;
              const rescheduledRate = ra.totalSessions > 0
                ? Math.round((ra.rescheduledSessions / ra.totalSessions) * 100) : 0;

              // Per-alert-type counts
              const freqCount = aa.studentsWithAlerts.filter(s => s.alerts.includes('frequent_absent')).length;
              const consCount = aa.studentsWithAlerts.filter(s => s.alerts.includes('consecutive_absent')).length;
              const lateCount = aa.studentsWithAlerts.filter(s => s.alerts.includes('late_stage_absent')).length;

              const hasCP1 = a.cp1Analysis.hasSession && a.cp1Analysis.studentsWithScores > 0;
              const hasCP2 = a.cp2Analysis.hasSession && a.cp2Analysis.studentsWithScores > 0;
              const hasDemo = a.demoAnalysis.hasSession && a.demoAnalysis.studentsWithScores > 0;

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
                    {commentIssues === 0 ? (
                      <Badge variant="passed" size="sm">{LABELS.GOOD}</Badge>
                    ) : (
                      <div className={styles.inlineCluster}>
                        <IssueChip label={COMMENT_STATUS_COUNT_LABELS.brief} count={ca.briefCount} tone="warning" />
                        <IssueChip label={COMMENT_STATUS_COUNT_LABELS.empty} count={ca.emptyCount} tone="error" />
                        <IssueChip label={COMMENT_STATUS_COUNT_LABELS.overdue} count={ca.overdueCount} tone="error" />
                        <IssueChip label={COMMENT_STATUS_COUNT_LABELS.duplicate} count={ca.duplicateCount} tone="warning" />
                      </div>
                    )}
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

                  {/* Điểm checkpoint / demo */}
                  <td>
                    <div className={styles.stackXs}>
                      <div className={styles.inlineCluster} style={{ gap: 'var(--space-4)', alignItems: 'flex-start' }}>
                        {hasCP1 && (
                          <div className={styles.stackXs} style={{ gap: '2px', minWidth: '36px', alignItems: 'center' }}>
                            <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-quaternary)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>CP1</span>
                            <span style={{ 
                              fontSize: '13px', 
                              fontWeight: 700, 
                              color: (a.cp1Analysis.averageScore ?? 0) >= 3.5 ? 'var(--status-success)' : 'var(--status-error)' 
                            }}>
                              {(a.cp1Analysis.averageScore ?? 0).toFixed(1)}
                            </span>
                            <span style={{ fontSize: '10px', color: 'var(--text-quaternary)', whiteSpace: 'nowrap' }}>
                              {a.cp1Analysis.passCount}/{a.cp1Analysis.studentsWithScores}
                            </span>
                          </div>
                        )}
                        {hasCP2 && (
                          <div className={styles.stackXs} style={{ gap: '2px', minWidth: '36px', alignItems: 'center' }}>
                            <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-quaternary)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>CP2</span>
                            <span style={{ 
                              fontSize: '13px', 
                              fontWeight: 700, 
                              color: (a.cp2Analysis.averageScore ?? 0) >= 3.5 ? 'var(--status-success)' : 'var(--status-error)' 
                            }}>
                              {(a.cp2Analysis.averageScore ?? 0).toFixed(1)}
                            </span>
                            <span style={{ fontSize: '10px', color: 'var(--text-quaternary)', whiteSpace: 'nowrap' }}>
                              {a.cp2Analysis.passCount}/{a.cp2Analysis.studentsWithScores}
                            </span>
                          </div>
                        )}
                        {hasDemo && (
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
                              {a.demoAnalysis.passCount}/{a.demoAnalysis.studentsWithScores}
                            </span>
                          </div>
                        )}
                        {!hasCP1 && !hasCP2 && !hasDemo && (
                          <span className={styles.mutedText}>—</span>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          </table>
        </div>
    </AdminTableSection>
  );
}
