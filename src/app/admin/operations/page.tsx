'use client';

import { useEffect, useState, useMemo, useCallback, useRef, memo, Fragment, useTransition, useDeferredValue, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, ComposedChart, Line, LineChart,
  Area, AreaChart, Legend
} from 'recharts';
import { useAuth } from '@/lib/AuthContext';
import { loadSession } from '@/services/authService';
import { fetchAllClasses, fetchClassStatusConfigs, fetchStudentCommentAreas, fetchStudentWorks, dateStringRangeToUtcRange, haveSlotInDateStringRangeToUtcRange } from '@/services/classesService';
import { fetchAllCentres, Centre } from '@/services/centresService';
import { fetchOfficeHours } from '@/services/officeHoursService';
import { getTeachers } from '@/services/teacherService';
import type { Teacher as TeacherProfile } from '@/types/teacher';
import { getCache, setCache, clearCache } from '@/lib/idb';
import { getCourseLineCategory } from '@/lib/courseCategories';
import { getNavItemsWithRouter } from '@/lib/navigation';
import { useAllowedPages } from '@/hooks/useAllowedPages';
import { addSupplyTeacherToSession, fetchClassTeacherSchedules, fetchTeacherSchedules, findAvailableTeachers, fetchClassByIdFull, UNASSIGNED_TEACHER_ID } from '@/services/teacherScheduleService';
import { searchUsers } from '@/services/ticketService';
import { TeacherSchedule, TeacherScheduleSlot, CoordinationRequest, TeacherAvailability, Teacher } from '@/types/teacherSchedule';
import { Class, Session, CommentAreaDef, FinalProductClassStats, StudentWork } from '@/types/classes';
import { AnalyzedClassForQuality } from '@/types/classQuality';
import { analyzeClassQuality, DEFAULT_EXEMPTED_SESSIONS } from '@/lib/classQualityAnalysis';
import type { ParsedArea } from '@/lib/commentContent';
import { computeTBCK, determineRank } from '@/lib/courseGrading';
import {
  buildFinalProductClassStats,
  buildStudentWorksByStudentId,
  getActiveClassStudents,
  getStudentWorkAssetCount,
  getStudentWorkFileName,
  getStudentWorkStatusMeta,
} from '@/lib/studentWorks';
import { PageLayout } from '@/components/PageLayout';
import { ClassQualityUnifiedTable } from '@/components/ClassQualityUnifiedTable';
import { ProtectedPage } from '@/components/ProtectedPage';
import { StudentHoverCard } from '@/components/StudentHoverCard';
import { ClassSubmissionDetail, SubmissionControlView } from '@/components/SubmissionControlView';
import { FinalProductControlView } from '@/components/FinalProductControlView';
import { useClassSubmissions } from '@/hooks/useClassSubmissions';

import {
  Icon,
  Toolbar,
  StatCard,
  ChartSectionHeader,
  TableToolbar,
  TableGroupHeader,
  SubTableGroupHeader,
  AdminTableSection,
  Modal,
  ModalHeader,
  EmptyState,
  CompactSelect,
  ViewModeToggle,
  initials,
  ToastContainer,
  useToast,
  MultiSelect,
  SelectOption,
  Spinner,
  StandardXAxis,
  StandardYAxisCategory,
  StandardYAxisNumber,
  CustomTooltip,
  VerticalBarChartConfig,
  ComposedChartConfig,
  CentreSelect,
  QuickFilterChips,
  FilterChip,
  Badge,
  ExportButton,
  CSVExportSettings,
  type CSVColumnConfig,
  CommentStatusBadge,
  COMMENT_STATUS_GROUP_LABELS,
  COMMENT_STATUS_COUNT_LABELS,
  AttendanceAlertBadge,
  AttendanceSessionCell,
  RescheduleStatusBadge,
  RESCHEDULE_STATUS_LABELS,
  DateRangeInput,
  type DataLimitValue,
} from '@/components/ui';
import { useQuickFilterChips } from '@/hooks/useUserPreferences';
import { useTeacherFilterOptions } from '@/hooks/useTeacherFilterOptions';
import {
  CACHE_KEYS,
  LABELS,
  MESSAGES,
  ENTITIES,
  CHART_COLORS,
  COURSES,
  FORMAT,
  CLASS_QUALITY_LABELS,
  TEACHER_AVAILABILITY_CATEGORY_ORDER,
  TEACHER_AVAILABILITY_CATEGORY_LABELS,
  TEACHER_AVAILABILITY_REFERENCE_CATEGORY_ORDER,
  TEACHER_SCHEDULE_LABELS,
  TEACHER_SCHEDULE_TYPE_OPTIONS,
  TEACHER_SCHEDULE_VIEW_OPTIONS,
  TEACHER_SCHEDULE_CACHE_VERSION,
  CLASS_STATUS_FILTER_OPTIONS,
  DEFAULT_CLASS_STATUS_FILTER_VALUES,
} from '@/constants';
import { useSharedDateRange, useSharedCentres } from '@/hooks/useSharedFilterState';
import { useCSVExportPreferences } from '@/hooks/useCSVExportPreferences';
import { supabase } from '@/lib/supabase/client';
import { exportToCSV, type CSVColumn } from '@/lib/csvExport';
import styles from '@/app/dashboard.module.css';

// ─── Custom Hook: useMediaQuery ───────────────────────────────────────────────

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    setMatches(media.matches);
    const listener = () => setMatches(media.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [query]); // removed `matches` from deps — it caused redundant re-subscriptions

  return matches;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TIME_SLOTS = [
  { time: '08:00 - 10:00', label: 'Sáng' },
  { time: '10:00 - 12:00', label: 'Sáng' },
  { time: '13:00 - 15:00', label: 'Chiều' },
  { time: '14:00 - 16:00', label: 'Chiều' },
  { time: '15:00 - 17:00', label: 'Chiều' },
  { time: '16:00 - 18:00', label: 'Chiều' },
  { time: '18:00 - 20:00', label: 'Tối' },
  { time: '19:00 - 21:00', label: 'Tối' },
];

const DAYS_OF_WEEK = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
type HolidayPeriod = { name: string; from: string; to: string };
type CentreRegionInfo = { id: string; name: string };
type CentreRegionMap = Record<string, CentreRegionInfo[]>;

interface OperationsScheduleExportRow {
  sortKey: string;
  date: string;
  dayLabel: string;
  startTime: string;
  endTime: string;
  type: string;
  centre: string;
  centreCode: string;
  name: string;
  classId: string;
  sessionNumber: string | number;
  courseLine: string;
  status: string;
  studentCount: string | number;
  primaryTeacher: string;
  teachers: string;
  roles: string;
  officeHourType: string;
}

function getDefaultOperationsScheduleCSVColumns(): CSVColumnConfig[] {
  return [
    { id: 'date', label: 'Ngày', enabled: true },
    { id: 'dayLabel', label: 'Thứ', enabled: true },
    { id: 'startTime', label: 'Giờ bắt đầu', enabled: true },
    { id: 'endTime', label: 'Giờ kết thúc', enabled: true },
    { id: 'type', label: 'Loại lịch', enabled: true },
    { id: 'centre', label: 'Cơ sở', enabled: true },
    { id: 'centreCode', label: 'Mã cơ sở', enabled: true },
    { id: 'name', label: 'Lớp/Ca', enabled: true },
    { id: 'classId', label: 'Class ID', enabled: false },
    { id: 'sessionNumber', label: 'Buổi', enabled: true },
    { id: 'courseLine', label: 'Khối học', enabled: true },
    { id: 'status', label: 'Trạng thái', enabled: true },
    { id: 'studentCount', label: 'Số học viên', enabled: true },
    { id: 'primaryTeacher', label: 'Giáo viên chính', enabled: true },
    { id: 'teachers', label: 'Giáo viên trong buổi', enabled: true },
    { id: 'roles', label: 'Vai trò', enabled: true },
    { id: 'officeHourType', label: 'Loại ca trực', enabled: false },
  ];
}

function getOperationsScheduleCSVColumnsFromConfig(config: CSVColumnConfig[]): CSVColumn<OperationsScheduleExportRow>[] {
  const columnMap: Record<string, CSVColumn<OperationsScheduleExportRow>> = {
    date: { header: 'Ngày', accessor: 'date' },
    dayLabel: { header: 'Thứ', accessor: 'dayLabel' },
    startTime: { header: 'Giờ bắt đầu', accessor: 'startTime' },
    endTime: { header: 'Giờ kết thúc', accessor: 'endTime' },
    type: { header: 'Loại lịch', accessor: 'type' },
    centre: { header: 'Cơ sở', accessor: 'centre' },
    centreCode: { header: 'Mã cơ sở', accessor: 'centreCode' },
    name: { header: 'Lớp/Ca', accessor: 'name' },
    classId: { header: 'Class ID', accessor: 'classId' },
    sessionNumber: { header: 'Buổi', accessor: 'sessionNumber' },
    courseLine: { header: 'Khối học', accessor: 'courseLine' },
    status: { header: 'Trạng thái', accessor: 'status' },
    studentCount: { header: 'Số học viên', accessor: 'studentCount' },
    primaryTeacher: { header: 'Giáo viên chính', accessor: 'primaryTeacher' },
    teachers: { header: 'Giáo viên trong buổi', accessor: 'teachers' },
    roles: { header: 'Vai trò', accessor: 'roles' },
    officeHourType: { header: 'Loại ca trực', accessor: 'officeHourType' },
  };

  return config
    .filter(column => column.enabled)
    .map(column => columnMap[column.id])
    .filter(Boolean);
}

const DEFAULT_HOLIDAY_PERIODS: HolidayPeriod[] = [
  { name: 'Tết Dương lịch', from: '2026-01-01', to: '2026-01-01' },
  { name: 'Tết Âm lịch', from: '2026-02-14', to: '2026-02-22' },
  { name: 'Giỗ Tổ Hùng Vương', from: '2026-04-25', to: '2026-04-26' },
  { name: 'Giải phóng miền Nam & Quốc tế Lao động', from: '2026-04-30', to: '2026-05-02' },
];

function getTeacherMainCentre(profile: TeacherProfile | undefined): { id: string | null; name: string | null } {
  const mainCentre = profile?.centres?.[0];
  return {
    id: mainCentre?.id || null,
    name: mainCentre?.name || null,
  };
}

function getCentreRegionIds(centreRegionMap: CentreRegionMap, centreId: string | null | undefined) {
  return new Set((centreId ? centreRegionMap[centreId] : undefined)?.map(region => region.id) || []);
}

function getCentreRegionNames(centreRegionMap: CentreRegionMap, centreId: string | null | undefined) {
  return (centreId ? centreRegionMap[centreId] : undefined)?.map(region => region.name) || [];
}

function shareAnyRegion(left: Set<string>, right: Set<string>) {
  if (left.size === 0 || right.size === 0) return false;
  for (const id of left) {
    if (right.has(id)) return true;
  }
  return false;
}

function getTeacherProfileWorkCentres(profile: TeacherProfile | undefined) {
  return (profile?.centres || []).map(centre => ({
    id: centre.id,
    name: centre.name,
  }));
}

function enrichTeacherAvailabilityByRegion(
  teachers: TeacherAvailability[],
  teacherProfilesById: Map<string, TeacherProfile>,
  centreRegionMap: CentreRegionMap,
  requestCentreId: string,
) {
  const requestRegionIds = getCentreRegionIds(centreRegionMap, requestCentreId);

  return teachers
    .map(availability => {
      const profile = teacherProfilesById.get(availability.teacher.id);
      const mainCentre = getTeacherMainCentre(profile);
      const teacherRegionIds = getCentreRegionIds(centreRegionMap, mainCentre.id);
      const sameRegionAsRequest = shareAnyRegion(requestRegionIds, teacherRegionIds);
      const regionNames = getCentreRegionNames(centreRegionMap, mainCentre.id);

      return {
        ...availability,
        score: availability.score + (sameRegionAsRequest ? 45 : 0),
        teacher: {
          ...availability.teacher,
          mainCentreId: mainCentre.id,
          mainCentreName: mainCentre.name,
          workCentres: getTeacherProfileWorkCentres(profile),
          regionIds: Array.from(teacherRegionIds),
          regionNames,
          sameRegionAsRequest,
        },
      };
    })
    .sort((a, b) => {
      const sameRegionDelta = Number(Boolean(b.teacher.sameRegionAsRequest)) - Number(Boolean(a.teacher.sameRegionAsRequest));
      if (sameRegionDelta !== 0) return sameRegionDelta;
      return b.score - a.score;
    });
}

function getSameCourseTeacherCount(teachers: TeacherAvailability[]) {
  return teachers.filter(teacher => teacher.courseLineMatch).length;
}

function getAvailableTeachersToastMessage(teachers: TeacherAvailability[]) {
  const sameCourseCount = getSameCourseTeacherCount(teachers);
  if (sameCourseCount > 0) {
    return `Tìm thấy ${sameCourseCount} ${TEACHER_SCHEDULE_LABELS.AVAILABLE_SAME_COURSE_TEACHERS_COUNT}`;
  }
  return `${TEACHER_SCHEDULE_LABELS.NO_SAME_COURSE_TEACHER}; có ${teachers.length} ${TEACHER_SCHEDULE_LABELS.OTHER_COURSE_REFERENCE_COUNT}`;
}



function TemplateBadge({ match }: { match: 'exact' | 'modified' | 'custom' }) {
  const map = {
    exact: { label: 'Mẫu', bg: 'rgba(245, 158, 11, 0.15)', fg: '#b45309', title: 'Copy nguyên gợi ý mẫu của hệ thống' },
    modified: { label: 'Sửa', bg: 'rgba(14, 165, 233, 0.15)', fg: '#0369a1', title: 'Có sửa lại so với gợi ý mẫu' },
    custom: { label: 'Tự viết', bg: 'rgba(34, 197, 94, 0.15)', fg: '#15803d', title: 'Tự viết, không trùng mẫu' },
  } as const;
  const m = map[match];
  return (
    <span
      title={m.title}
      style={{
        marginLeft: 6, fontSize: 9, fontWeight: 600, padding: '1px 5px',
        borderRadius: 4, background: m.bg, color: m.fg, lineHeight: 1.4,
        whiteSpace: 'nowrap',
      }}
    >
      {m.label}
    </span>
  );
}

function ScoreDots({ score, max = 5 }: { score: number; max?: number }) {
  return (
    <span style={{ display: 'inline-flex', gap: 2, verticalAlign: 'middle', marginLeft: 4 }}>
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: i < score ? 'var(--brand-indigo)' : 'var(--border-default)',
            display: 'inline-block',
          }}
        />
      ))}
    </span>
  );
}

function StructuredCommentView({ areas }: { areas: ParsedArea[] }) {
  return (
    <div style={{ fontSize: 11, color: 'var(--text-primary)', lineHeight: 1.55 }}>
      {areas.map((area, aIdx) => (
        <div key={aIdx} style={{ marginBottom: aIdx < areas.length - 1 ? 10 : 0 }}>
          {area.name && (
            <div style={{
              fontWeight: 700,
              fontSize: 10,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--text-tertiary)',
              borderBottom: '1px solid var(--border-default)',
              paddingBottom: 2,
              marginBottom: 6,
            }}>
              {area.name}
            </div>
          )}
          {area.sectionTitle && !area.name && (
            <div style={{ fontWeight: 600, fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
              {area.sectionTitle}
            </div>
          )}
          {area.generalText && (
            <div style={{ whiteSpace: 'pre-line', color: 'var(--text-primary)' }}>
              {area.generalText}
            </div>
          )}
          {area.criteria.map((criterion, cIdx) => (
            <div key={cIdx} style={{
              marginBottom: cIdx < area.criteria.length - 1 ? 6 : 0,
              paddingLeft: area.name ? 8 : 0,
            }}>
              {criterion.name && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: criterion.text ? 2 : 0, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-secondary)', fontSize: 10.5 }}>
                    {criterion.name}
                  </span>
                  {criterion.score !== undefined && (
                    <ScoreDots score={criterion.score} />
                  )}
                  {criterion.templateMatch && (
                    <TemplateBadge match={criterion.templateMatch} />
                  )}
                </div>
              )}
              {!criterion.name && criterion.score !== undefined && (
                <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                  <ScoreDots score={criterion.score} />
                  {criterion.templateMatch && <TemplateBadge match={criterion.templateMatch} />}
                </span>
              )}
              {criterion.text && (
                <div style={{ whiteSpace: 'pre-line', color: 'var(--text-primary)', paddingLeft: 8 }}>
                  {criterion.text}
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function TeacherCommentCell({ text, parsedAreas }: { text: string; parsedAreas?: ParsedArea[] }) {
  const [expanded, setExpanded] = useState(false);

  const hasStructured = parsedAreas && parsedAreas.length > 0 && (
    parsedAreas.some(a => a.name || a.criteria.length > 0 || a.generalText)
  );

  if (hasStructured) {
    const totalCriteria = parsedAreas!.reduce((n, a) => n + a.criteria.length, 0);
    const isLong = totalCriteria > 3 || parsedAreas!.length > 2;
    const visibleAreas = isLong && !expanded ? parsedAreas!.slice(0, 2) : parsedAreas!;

    return (
      <div>
        <StructuredCommentView areas={visibleAreas} />
        {isLong && (
          <button
            type="button"
            onClick={() => setExpanded(e => !e)}
            style={{ marginTop: 4, fontSize: 10, color: 'var(--brand-indigo)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontWeight: 600 }}
          >
            {expanded ? 'Thu gọn ▲' : `Xem thêm ▼`}
          </button>
        )}
      </div>
    );
  }

  // Fallback: plain text
  const PREVIEW_LINES = 4;
  const lines = text.split('\n').filter(l => l.trim());
  const isLong = lines.length > PREVIEW_LINES || text.length > 400;

  return (
    <div>
      <div style={{ whiteSpace: 'pre-line', lineHeight: 1.55, fontSize: 11, color: 'var(--text-primary)' }}>
        {isLong && !expanded
          ? lines.slice(0, PREVIEW_LINES).join('\n') + (lines.length > PREVIEW_LINES ? '…' : '')
          : text}
      </div>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded(e => !e)}
          style={{ marginTop: 4, fontSize: 10, color: 'var(--brand-indigo)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontWeight: 600 }}
        >
          {expanded ? 'Thu gọn ▲' : `Xem thêm (${lines.length} dòng) ▼`}
        </button>
      )}
    </div>
  );
}

function CopyButton({ content, label }: { content: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <button type="button" onClick={handleCopy} className={styles.copyBtn} title={`Copy ${label}`}>
      {copied ? '✓ Đã copy' : 'Copy'}
    </button>
  );
}

function renderSummaryContent(content: string) {
  return content.split('\n').map((line, index) => {
    if (!line) return <div key={index}>{'\u00A0'}</div>;

    const parts: ReactNode[] = [];
    let key = 0;

    line.split('**').forEach((part, boldIndex) => {
      if (boldIndex % 2 === 1) {
        parts.push(<strong key={`b${key++}`}>{part}</strong>);
        return;
      }

      part.split('*').forEach((italicPart, italicIndex) => {
        if (italicIndex % 2 === 1) {
          parts.push(<em key={`i${key++}`} style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>{italicPart}</em>);
        } else if (italicPart) {
          parts.push(italicPart);
        }
      });
    });

    return <div key={index}>{parts}</div>;
  });
}

function generateCheckpointContent(data: any): string {
  const lines: string[] = [];

  if (data.cp1TotalStudents > 0) {
    const cp1FailCount = data.cp1TotalStudents - data.cp1PassCount;
    lines.push('**CP1:**');
    lines.push(`- Tỷ lệ học viên đạt/không đạt: ${data.cp1PassCount}/${cp1FailCount} (${data.cp1PassRate.toFixed(1)}% đạt).`);
    lines.push(`- Điểm CP1 trung bình: ${data.cp1AverageScore.toFixed(3)}.`);
    lines.push('');
  }

  if (data.cp2TotalStudents > 0) {
    const cp2FailCount = data.cp2TotalStudents - data.cp2PassCount;
    lines.push('**CP2:**');
    lines.push(`- Tỷ lệ học viên đạt/không đạt: ${data.cp2PassCount}/${cp2FailCount} (${data.cp2PassRate.toFixed(1)}% đạt).`);
    lines.push(`- Điểm CP2 trung bình: ${data.cp2AverageScore.toFixed(3)}.`);
  }

  if (data.cp1TotalStudents === 0 && data.cp2TotalStudents === 0) {
    lines.push('*Chưa có dữ liệu Checkpoint cho cơ sở này (hoặc chỉ có khối Art).*');
    lines.push('');
  }

  lines.push('');
  lines.push('*Thang đo: Đạt khi điểm CP >= 3.5.*');
  lines.push('*Lưu ý: Khối Coding có CP ở buổi 5 & 9; Robotics có CP ở buổi 4 & 8; Art chỉ có điểm cuối khoá (Demo).*');

  return lines.join('\n');
}

function generateDemoContent(data: any): string {
  const lines: string[] = [];

  if (data.demoTotalStudents > 0) {
    lines.push('**Chất lượng sản phẩm học viên:**');
    lines.push(`- Phân hóa (Tốt/Trung bình/Kém): ${data.demoGoodCount}/${data.demoMediumCount}/${data.demoPoorCount}.`);
    lines.push(`- Điểm Demo trung bình: ${data.demoAverageScore.toFixed(3)}.`);
    lines.push('');
  }

  if (data.totalStudentsWithTBCK > 0) {
    const passedCount = data.rankACount + data.rankBCount + data.rankCCount;
    const passedRate = ((passedCount / data.totalStudentsWithTBCK) * 100).toFixed(1);
    lines.push('**Xếp loại TBCK (Tổng hợp CP & Demo):**');
    lines.push(`- Tổng đạt (A+B+C): ${passedCount}/${data.totalStudentsWithTBCK} (${passedRate}%).`);
    lines.push(`- Hạng A (Xuất sắc): ${data.rankACount} học viên.`);
    lines.push(`- Hạng B (Tốt): ${data.rankBCount} học viên.`);
    lines.push(`- Hạng C (Đạt): ${data.rankCCount} học viên.`);
    lines.push(`- Hạng D (Chưa đạt): ${data.rankDCount} học viên.`);
    lines.push('');
    lines.push('*Thang đo: Tốt (>=4), Trung bình (>=3), Kém (<3).*');
    lines.push('*Công thức TBCK: 0.4 x (CP1+CP2)/2 + 0.6 x Demo (nếu không có CP thì 100% Demo).*');
    lines.push('*Xếp hạng: A (TBCK>=4.5 & Demo>=3.5); B (TBCK>=4.0 & Demo>=2.5); C (TBCK>=2.5); D (TBCK<2.5).*');
  }

  if (data.demoTotalStudents === 0) {
    lines.push('*Chưa có dữ liệu Demo cho cơ sở này.*');
  }

  return lines.join('\n');
}

function generateOperationsContent(data: any): string {
  const lines: string[] = [];
  const totalClasses = data.totalClasses || 0;
  const commentRate = totalClasses > 0 ? ((data.classesWithCommentIssues / totalClasses) * 100).toFixed(1) : '0.0';
  const attendanceRate = totalClasses > 0 ? ((data.classesWithAttendanceAlerts / totalClasses) * 100).toFixed(1) : '0.0';

  lines.push('**Tỷ lệ dời buổi học:**');
  lines.push(`- ${data.reschedulingRate.toFixed(1)}% buổi học bị dời lịch.`);
  lines.push(`- ${data.classesWithRescheduling}/${totalClasses} lớp có buổi bị dời.`);
  lines.push('- *Tính dựa trên khoảng cách giữa các buổi học (chuẩn 7 ngày).*');
  lines.push('');
  lines.push('**Chất lượng phần tự viết:**');
  lines.push(`- ${data.classesWithCommentIssues}/${totalClasses} lớp (${commentRate}%) có phần tự viết sơ sài, trùng/lặp hoặc quá hạn.`);
  lines.push('- *Nhận xét trống nhưng còn trong thời hạn không tính là vi phạm.*');
  lines.push('');
  lines.push('**Cảnh báo chuyên cần:**');
  lines.push(`- ${data.classesWithAttendanceAlerts}/${totalClasses} lớp (${attendanceRate}%) có học viên vi phạm chuyên cần.`);
  lines.push('- *Cảnh báo: Nghỉ từ 3 buổi hoặc nghỉ liên tiếp từ 2 buổi.*');

  return lines.join('\n');
}

type ScheduleTypeFilter = typeof TEACHER_SCHEDULE_TYPE_OPTIONS[number]['value'];
type TeacherScheduleViewMode = typeof TEACHER_SCHEDULE_VIEW_OPTIONS[number]['value'];
type ClassStatusFilter = string;

const DEFAULT_CLASS_STATUS_FILTERS: ClassStatusFilter[] = [...DEFAULT_CLASS_STATUS_FILTER_VALUES];
const LMS_CLASS_STATUS_OPTIONS: SelectOption[] = CLASS_STATUS_FILTER_OPTIONS.map(option => ({ ...option }));

function buildClassStatusFilterOptionsFromConfig(statusConfigs: { status: string; description?: string | null }[]): SelectOption[] {
  const optionsByStatus = new Map<string, SelectOption>(
    LMS_CLASS_STATUS_OPTIONS.map(option => [option.value, option])
  );

  statusConfigs.forEach(config => {
    if (!config.status) return;
    optionsByStatus.set(config.status, {
      value: config.status,
      label: config.status,
    });
  });

  return Array.from(optionsByStatus.values());
}

function normalizeStatus(value?: string | null): string {
  return (value || '').trim().toUpperCase();
}

function getInactiveStudentStatusLabel(studentSlot?: Class['students'][number]): string {
  if (!studentSlot || studentSlot.activeInClass) return '';

  const reason = normalizeStatus(studentSlot.completionInfo?.reason).replace(/\s+/g, '_');
  const status = normalizeStatus(studentSlot.completionInfo?.status);

  if (reason === 'ON_HOLD') return 'Bảo lưu';
  if (reason === 'DROP_OUT' || status === 'DROPPED' || status === 'DROP_OUT') return 'Nghỉ học';
  if (reason === 'TRANSFER_COURSE_LINE' || reason.includes('TRANSFER')) return 'Chuyển lớp/khối';
  if (reason === 'CHANGE_CLASS_SCHEDULE_CHANGE') return 'Đổi lịch/lớp';
  if (status === 'WAITING') return 'Chờ xử lý';
  return 'Không còn trong lớp';
}

function isAllClassStatusesSelected(selected: ClassStatusFilter[], options: SelectOption[]): boolean {
  if (selected.length === 0) return false;
  const selectedValues = new Set(selected.map(normalizeStatus));
  const defaultOptionValues = new Set(LMS_CLASS_STATUS_OPTIONS.map(option => normalizeStatus(option.value)));
  const hasEveryDefaultStatus = defaultOptionValues.size > 0
    && Array.from(defaultOptionValues).every(value => selectedValues.has(value));
  if (hasEveryDefaultStatus) return true;

  const optionValues = new Set(options.map(option => normalizeStatus(option.value)));
  if (optionValues.size === 0) return false;
  return optionValues.size === selectedValues.size
    && Array.from(optionValues).every(value => selectedValues.has(value));
}

function ScheduleTypeSelect({
  value,
  onChange,
}: {
  value: ScheduleTypeFilter;
  onChange: (value: ScheduleTypeFilter) => void;
}) {
  return (
    <CompactSelect
      label={TEACHER_SCHEDULE_LABELS.SCHEDULE_TYPE}
      value={value}
      options={TEACHER_SCHEDULE_TYPE_OPTIONS}
      onChange={onChange}
    />
  );
}

function ClassStatusFilterSelect({
  selected,
  onChange,
  options,
}: {
  selected: ClassStatusFilter[];
  onChange: (value: ClassStatusFilter[]) => void;
  options: SelectOption[];
}) {
  const resolvedOptions = options.length > 0 ? options : LMS_CLASS_STATUS_OPTIONS;
  return (
    <div className={styles.dateControls}>
      <span className={styles.dateLabel}>{LABELS.STATUS}</span>
      <MultiSelect
        menuPosition="fixed"
        options={resolvedOptions}
        selected={selected}
        onChange={onChange}
        placeholder={selected.length > 0 ? `${selected.length} trạng thái` : LABELS.ALL_STATUSES}
        maxDisplay={1}
      />
    </div>
  );
}

function ScheduleViewToggle({
  value,
  onChange,
}: {
  value: TeacherScheduleViewMode;
  onChange: (value: TeacherScheduleViewMode) => void;
}) {
  return (
    <ViewModeToggle
      value={value}
      onChange={onChange}
      options={[
        { value: 'calendar', label: TEACHER_SCHEDULE_LABELS.CALENDAR_VIEW, icon: <Icon.Calendar /> },
        { value: 'quality-table', label: TEACHER_SCHEDULE_LABELS.QUALITY_VIEW, icon: <Icon.Table /> },
        { value: 'submissions', label: 'Bài tập', icon: <Icon.BookOpen /> },
        { value: 'final-products', label: 'Sản phẩm cuối khoá', icon: <Icon.Target /> },
      ]}
    />
  );
}

function QualityExemptionRulesPanel({
  exemptOneOnOneClasses,
  onExemptOneOnOneClassesChange,
  holidayPeriods,
  onAddHolidayPeriod,
  onRemoveHolidayPeriod,
  onResetDefaults,
}: {
  exemptOneOnOneClasses: boolean;
  onExemptOneOnOneClassesChange: (checked: boolean) => void;
  holidayPeriods: HolidayPeriod[];
  onAddHolidayPeriod: (period: HolidayPeriod) => void;
  onRemoveHolidayPeriod: (index: number) => void;
  onResetDefaults: () => void;
}) {
  const [showRules, setShowRules] = useState(true);
  const [showHolidayForm, setShowHolidayForm] = useState(false);
  const [newHolidayName, setNewHolidayName] = useState('');
  const [newHolidayFrom, setNewHolidayFrom] = useState('');
  const [newHolidayTo, setNewHolidayTo] = useState('');

  const handleSubmitHoliday = () => {
    if (!newHolidayName.trim() || !newHolidayFrom || !newHolidayTo) return;
    onAddHolidayPeriod({
      name: newHolidayName.trim(),
      from: newHolidayFrom,
      to: newHolidayTo,
    });
    setNewHolidayName('');
    setNewHolidayFrom('');
    setNewHolidayTo('');
    setShowHolidayForm(false);
  };

  return (
    <div className={styles.chartsSection}>
      <div className={styles.chartsSectionHeader} onClick={() => setShowRules(v => !v)} style={{ cursor: 'pointer' }}>
        <div className={styles.chartsSectionTitle}>
          <Icon.Settings />
          Quy tắc phân tích
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <button
            type="button"
            className={styles.chartToggle}
            aria-label="Khôi phục quy tắc mặc định"
            title="Khôi phục quy tắc mặc định"
            onClick={(event) => {
              event.stopPropagation();
              onResetDefaults();
            }}
          >
            <Icon.Refresh />
          </button>
          <span style={{ transform: showRules ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease', display: 'flex' }}>
            <Icon.ChevronDown />
          </span>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {showRules && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
            <div style={{ padding: 'var(--space-4)' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 'var(--space-1)' }}>
                  Miễn trừ lịch học
                </div>
                <div style={{ color: 'var(--text-quaternary)', fontSize: 12, lineHeight: 1.5, marginBottom: 'var(--space-2)' }}>
                  Lớp 1:1 và khoảng cách giữa hai buổi học đi qua kỳ nghỉ sẽ không bị tính là dời lịch bất thường.
                </div>

                  <label className={styles.reasonItem}>
                    <input
                      type="checkbox"
                      className={styles.reasonCheckbox}
                      checked={exemptOneOnOneClasses}
                      onChange={(event) => onExemptOneOnOneClassesChange(event.target.checked)}
                    />
                    <div className={styles.reasonLabel}>
                      <span>Lớp (1:1)</span>
                    </div>
                  </label>

                  <div style={{ marginTop: 'var(--space-4)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                      <span style={{ fontSize: 13, fontWeight: 590, color: 'var(--text-primary)' }}>Khoảng thời gian nghỉ</span>
                      <button type="button" className={styles.chartToggle} onClick={() => setShowHolidayForm(v => !v)}>
                        {showHolidayForm ? 'Đóng' : 'Thêm'}
                      </button>
                    </div>

                    <AnimatePresence initial={false}>
                      {showHolidayForm && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', padding: 'var(--space-3)', background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)', borderRadius: '6px', marginBottom: 'var(--space-3)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-quaternary)', textTransform: 'uppercase' }}>Tên dịp nghỉ</span>
                              <input className={styles.dateInput} type="text" value={newHolidayName} onChange={(event) => setNewHolidayName(event.target.value)} placeholder="Ví dụ: Tết Nguyên Đán" style={{ width: '100%' }} />
                            </div>
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                              <DateRangeInput
                                dateFrom={newHolidayFrom}
                                dateTo={newHolidayTo}
                                onDateFromChange={setNewHolidayFrom}
                                onDateToChange={setNewHolidayTo}
                                label="Chọn thời gian nghỉ"
                                layout="vertical"
                                menuPosition="fixed"
                              />
                            </div>

                            <button type="button" className={styles.primaryBtn} onClick={handleSubmitHoliday} style={{ marginTop: 'var(--space-2)', justifyContent: 'center' }}>
                              <Icon.Plus />
                              Thêm khoảng nghỉ
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div className={styles.reasonList}>
                      {holidayPeriods.map((period, index) => (
                        <div key={`${period.name}-${period.from}-${period.to}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-2) var(--space-3)', background: 'var(--bg-elevated)', borderRadius: '4px' }}>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 590, color: 'var(--text-primary)' }}>{period.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                              {new Date(period.from).toLocaleDateString('vi-VN')} - {new Date(period.to).toLocaleDateString('vi-VN')}
                            </div>
                          </div>
                          <button type="button" className={styles.chartToggle} onClick={() => onRemoveHolidayPeriod(index)}>
                            <Icon.Trash />
                          </button>
                        </div>
                      ))}
                      {holidayPeriods.length === 0 && (
                        <div style={{ padding: 'var(--space-3)', color: 'var(--text-quaternary)', fontSize: 12, textAlign: 'center' }}>
                          Chưa có khoảng nghỉ nào
                        </div>
                      )}
                    </div>
                  </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ScheduleFilterSummary({
  filteredSlotCount,
  selectedCentres,
  selectedCourseLines,
  selectedTeachers,
  selectedRoles,
  classCodeSearch,
}: {
  filteredSlotCount: number;
  selectedCentres: string[];
  selectedCourseLines: string[];
  selectedTeachers: string[];
  selectedRoles: string[];
  classCodeSearch: string;
}) {
  const chips = [
    classCodeSearch.trim() ? `Mã lớp: ${classCodeSearch.trim()}` : '',
    selectedCentres.length > 0 ? `${selectedCentres.length} cơ sở` : '',
    selectedCourseLines.length > 0 ? `${selectedCourseLines.length} khối` : '',
    selectedTeachers.length > 0 ? `${selectedTeachers.length} giáo viên` : '',
    selectedRoles.length > 0 ? `${selectedRoles.length} vai trò` : '',
  ].filter(Boolean);

  if (chips.length === 0) return null;

  return (
    <div className={styles.tableToolbar}>
      <span className={styles.metricText}>
        <Icon.Filter />
        {FORMAT.number(filteredSlotCount)} lịch đang hiển thị
      </span>
      <div className={styles.inlineCluster}>
        {chips.map(chip => (
          <Badge key={chip} variant="info" size="sm">
            {chip}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function WeekNavigator({
  weeks,
  currentWeekIndex,
  onWeekChange,
}: {
  weeks: Date[][];
  currentWeekIndex: number;
  onWeekChange: (index: number) => void;
}) {
  if (weeks.length <= 1) return null;

  const currentWeek = weeks[currentWeekIndex];
  const rangeLabel = currentWeek
    ? `${FORMAT.date(currentWeek[0])} - ${FORMAT.date(currentWeek[6])}`
    : '';

  const goToToday = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const index = weeks.findIndex(week => {
      const start = new Date(week[0]);
      const end = new Date(week[6]);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      return today >= start && today <= end;
    });
    if (index >= 0) onWeekChange(index);
  };

  return (
    <div className={styles.weekNavigator}>
      <button
        type="button"
        className={`${styles.clearCacheBtn} ${styles.viewModeButton}`}
        onClick={() => onWeekChange(Math.max(0, currentWeekIndex - 1))}
        disabled={currentWeekIndex === 0}
      >
        <Icon.ChevronLeft />
        {TEACHER_SCHEDULE_LABELS.PREVIOUS_WEEK}
      </button>

      <div className={styles.weekNavigatorCenter}>
        <div className={styles.inlineCluster}>
          {TEACHER_SCHEDULE_LABELS.WEEK_PREFIX} {currentWeekIndex + 1} / {weeks.length}
          <FilterChip onClick={goToToday}>
            {TEACHER_SCHEDULE_LABELS.TODAY}
          </FilterChip>
        </div>
        <span className={styles.metricText}>{rangeLabel}</span>
      </div>

      <button
        type="button"
        className={`${styles.clearCacheBtn} ${styles.viewModeButton}`}
        onClick={() => onWeekChange(Math.min(weeks.length - 1, currentWeekIndex + 1))}
        disabled={currentWeekIndex === weeks.length - 1}
      >
        {TEACHER_SCHEDULE_LABELS.NEXT_WEEK}
        <Icon.ChevronRight />
      </button>
    </div>
  );
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

/**
 * Calculate actual hours from startTime and endTime
 * Returns hours as a decimal (e.g., 2.5 for 2 hours 30 minutes)
 */
function calculateSlotHours(startTime: string, endTime: string): number {
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  const hours = (end - start) / (1000 * 60 * 60);
  return Math.max(0, hours); // Ensure non-negative
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '--:--';
  return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return 'Chưa có ngày';
  return date.toLocaleDateString('vi-VN');
}

function formatSessionDateLabel(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return 'Chưa có ngày';
  return date.toLocaleDateString('vi-VN', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  });
}

function parseLocalDateInput(value: string, endOfDay = false): Date {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return new Date(value);
  return new Date(
    year,
    month - 1,
    day,
    endOfDay ? 23 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 999 : 0,
  );
}

function getClassQualitySlotStartMs(slot: Session): number {
  const raw = slot.startTime || slot.date || slot.endTime;
  const time = raw ? new Date(raw).getTime() : NaN;
  return Number.isFinite(time) ? time : NaN;
}

interface ClassQualityDateRangeBounds {
  fromMs: number | null;
  toMs: number | null;
  active: boolean;
}

function getClassQualityDateRangeBounds(dateFrom: string, dateTo: string): ClassQualityDateRangeBounds {
  const fromMs = dateFrom ? parseLocalDateInput(dateFrom).getTime() : null;
  const toMs = dateTo ? parseLocalDateInput(dateTo, true).getTime() : null;
  return {
    fromMs: fromMs !== null && Number.isFinite(fromMs) ? fromMs : null,
    toMs: toMs !== null && Number.isFinite(toMs) ? toMs : null,
    active: Boolean(dateFrom || dateTo),
  };
}

function classHasSlotInDateRange(cls: Class, bounds: ClassQualityDateRangeBounds): boolean {
  if (!bounds.active) return true;

  return (cls.slots ?? []).some(slot => {
    const slotMs = getClassQualitySlotStartMs(slot);
    if (!Number.isFinite(slotMs)) return false;
    if (bounds.fromMs !== null && slotMs < bounds.fromMs) return false;
    if (bounds.toMs !== null && slotMs > bounds.toMs) return false;
    return true;
  });
}

function formatLocalDateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const getPart = (type: string) => parts.find(part => part.type === type)?.value || '';
  return `${getPart('year')}-${getPart('month')}-${getPart('day')}`;
}

function getSessionDateTime(slot: Session) {
  const dateSource = slot.date || slot.startTime;
  const datePart = dateSource ? dateSource.split('T')[0] : '';
  const startTime = slot.startTime?.includes('T')
    ? slot.startTime
    : `${datePart}T${slot.startTime || '00:00'}:00`;
  const endTime = slot.endTime?.includes('T')
    ? slot.endTime
    : `${datePart}T${slot.endTime || '00:00'}:00`;

  return { startTime, endTime };
}

function getDiagnosticSessionDateTime(slot: Session, classSessionHour?: number) {
  const dateSource = slot.date || slot.startTime || slot.endTime;
  const datePart = dateSource?.includes('T') ? dateSource.split('T')[0] : dateSource;
  const normalizeTimeValue = (value?: string | null) => {
    if (!value || !datePart) return null;
    if (value.includes('T')) return value;
    const normalizedTime = value.length === 5 ? `${value}:00` : value;
    return `${datePart}T${normalizedTime}`;
  };
  const startTime = normalizeTimeValue(slot.startTime) || (slot.date?.includes('T') ? slot.date : null);
  let endTime = normalizeTimeValue(slot.endTime);
  const sessionHour = slot.sessionHour || classSessionHour;
  if (!endTime && startTime && sessionHour) {
    const startMs = new Date(startTime).getTime();
    if (Number.isFinite(startMs)) {
      endTime = new Date(startMs + sessionHour * 60 * 60 * 1000).toISOString();
    }
  }
  return {
    startTime,
    endTime,
    startMs: startTime ? new Date(startTime).getTime() : NaN,
    endMs: endTime ? new Date(endTime).getTime() : NaN,
  };
}

function getSlotSessionIndex(cls: Class, slot?: Pick<TeacherScheduleSlot, 'sessionId' | 'startTime'> | null): number | null {
  if (!slot) return null;
  const sessions = [...(cls.slots || [])].sort((a, b) =>
    new Date(a.date || a.startTime).getTime() - new Date(b.date || b.startTime).getTime()
  );

  if (slot.sessionId) {
    const byId = sessions.findIndex(session => session._id === slot.sessionId);
    if (byId >= 0) return byId;
  }

  if (slot.startTime) {
    const slotTime = new Date(slot.startTime).getTime();
    const byTime = sessions.findIndex(session => {
      const { startTime } = getSessionDateTime(session);
      return Math.abs(new Date(startTime).getTime() - slotTime) < 60_000;
    });
    if (byTime >= 0) return byTime;
  }

  return null;
}

function pickDefaultClassSessionIndex(cls: Class): number {
  const sessions = [...(cls.slots || [])]
    .map((slot, index) => ({ slot, index, time: new Date(slot.date || slot.startTime).getTime() }))
    .filter(item => Number.isFinite(item.time))
    .sort((a, b) => a.time - b.time);

  if (sessions.length === 0) return 0;

  const now = Date.now();
  const latestPast = [...sessions].reverse().find(item => item.time <= now);
  return (latestPast || sessions[0]).index;
}

function getFinalClassSession(cls?: Class | null): { id: string; sessionNumber: number; date?: string } | null {
  const sessions = [...(cls?.slots || [])]
    .filter(slot => slot._id)
    .sort((a, b) => new Date(a.date || a.startTime).getTime() - new Date(b.date || b.startTime).getTime());
  const finalSession = sessions[sessions.length - 1];
  if (!finalSession) return null;
  return {
    id: finalSession._id,
    sessionNumber: sessions.length,
    date: finalSession.date || finalSession.startTime,
  };
}

function normalizeStudentWorkUrls(value?: string | string[] | null): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  return [value].filter(Boolean);
}

function createScheduleSlotFromClassSession(cls: Class, sessionIndex: number): TeacherScheduleSlot | null {
  const sessions = [...(cls.slots || [])].sort((a, b) =>
    new Date(a.date || a.startTime).getTime() - new Date(b.date || b.startTime).getTime()
  );
  const session = sessions[sessionIndex];
  if (!session) return null;

  const { startTime, endTime } = getSessionDateTime(session);
  const sessionTeachers = (session.teachers?.length ? session.teachers : cls.teachers || [])
    .filter(item => item.isActive !== false)
    .map(item => ({
      teacher: item.teacher,
      roleId: item.role?.id,
      roleName: item.role?.name,
      roleShortName: item.role?.shortName,
    }));

  return {
    id: session._id,
    type: 'class',
    teacher: sessionTeachers[0]?.teacher,
    sessionTeachers,
    startTime,
    endTime,
    className: cls.name,
    classId: cls.id,
    classSiteId: cls.classSites?.[0]?._id,
    sessionId: session._id,
    centreId: cls.centre?.id || '',
    centreName: cls.centre?.name || '',
    centreShortName: cls.centre?.shortName || '',
    courseLine: cls.course?.courseLine?.name || cls.course?.shortName,
    status: cls.status,
    studentCount: cls.students?.filter(student => student.activeInClass).length,
    sessionHour: session.sessionHour,
    sessionNumber: sessionIndex + 1,
  };
}

function normalizeDateOnly(value?: string | null): Date | null {
  if (!value) return null;
  const datePart = value.includes('T') ? value.split('T')[0] : value;
  const date = new Date(`${datePart}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function doDateRangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

function mergeHolidayPeriods(periods: HolidayPeriod[]): HolidayPeriod[] {
  const merged = new Map<string, HolidayPeriod>();
  [...DEFAULT_HOLIDAY_PERIODS, ...periods].forEach(period => {
    merged.set(`${period.name}-${period.from}-${period.to}`, period);
  });
  return Array.from(merged.values());
}

function sessionGapCrossesHoliday(
  sessions: AnalyzedClassForQuality['reschedulingAnalysis']['sessions'],
  sessionIndex: number,
  holidayPeriods: HolidayPeriod[],
): boolean {
  const session = sessions[sessionIndex];
  const previous = sessionIndex > 0 ? sessions[sessionIndex - 1] : null;
  const currentDate = normalizeDateOnly(session?.date);
  const previousDate = normalizeDateOnly(previous?.date);
  if (!currentDate || !previousDate) return false;

  const gapStart = previousDate <= currentDate ? previousDate : currentDate;
  const gapEnd = previousDate <= currentDate ? currentDate : previousDate;

  return holidayPeriods.some(period => {
    const holidayStart = normalizeDateOnly(period.from);
    const holidayEnd = normalizeDateOnly(period.to);
    return holidayStart && holidayEnd && doDateRangesOverlap(gapStart, gapEnd, holidayStart, holidayEnd);
  });
}

function isOneOnOneClassName(name?: string | null): boolean {
  return /\b1\s*:\s*1\b/.test(name || '');
}

function applyQualityExemptionRules(
  analysis: AnalyzedClassForQuality,
  options: {
    exemptOneOnOneClasses: boolean;
    holidayPeriods: HolidayPeriod[];
  },
): AnalyzedClassForQuality {
  const shouldExemptClass = options.exemptOneOnOneClasses && isOneOnOneClassName(analysis.cls.name);
  const sessions = analysis.reschedulingAnalysis.sessions.map((session, index) => {
    const isHolidayExempt = session.isRescheduled && sessionGapCrossesHoliday(
      analysis.reschedulingAnalysis.sessions,
      index,
      options.holidayPeriods,
    );

    if (!shouldExemptClass && !isHolidayExempt) return session;

    return {
      ...session,
      isRescheduled: false,
      reschedulingType: 'normal' as const,
    };
  });

  return {
    ...analysis,
    reschedulingAnalysis: {
      ...analysis.reschedulingAnalysis,
      rescheduledSessions: sessions.filter(session => session.isRescheduled).length,
      sessions,
    },
  };
}

function getWeekDates(startDate: Date): Date[] {
  const dates: Date[] = [];
  const current = new Date(startDate);
  
  // Start from Monday
  const day = current.getDay();
  const diff = current.getDate() - day + (day === 0 ? -6 : 1);
  current.setDate(diff);
  
  for (let i = 0; i < 7; i++) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  
  return dates;
}

/**
 * Check if two time ranges overlap
 */
function timeRangesOverlap(
  start1: string,
  end1: string,
  start2: string,
  end2: string
): boolean {
  const s1 = new Date(start1).getTime();
  const e1 = new Date(end1).getTime();
  const s2 = new Date(start2).getTime();
  const e2 = new Date(end2).getTime();
  
  return s1 < e2 && s2 < e1;
}

/**
 * Calculate available teachers from existing schedules data
 * No API call needed - uses data already loaded
 * Returns teachers grouped by priority categories
 */
function calculateAvailableTeachers(
  schedules: TeacherSchedule[],
  requestDate: string,
  requestStartTime: string,
  requestEndTime: string,
  requestCentreId: string,
  requestCourseLine?: string, // Add course line for matching
  conflictSchedules: TeacherSchedule[] = schedules
): TeacherAvailability[] {
  const requestStart = `${requestDate}T${requestStartTime}:00+07:00`;
  const requestEnd = `${requestDate}T${requestEndTime}:00+07:00`;
  
  const availabilities: TeacherAvailability[] = [];
  const conflictScheduleMap = new Map(
    conflictSchedules.map(schedule => [schedule.teacher.id, schedule.slots])
  );
  
  const requestStartMs = new Date(requestStart).getTime();
  const requestEndMs = new Date(requestEnd).getTime();
  
  schedules.forEach(schedule => {
    if (schedule.teacher.id === UNASSIGNED_TEACHER_ID) return;
    const conflictSourceSlots = conflictScheduleMap.get(schedule.teacher.id) || schedule.slots;

    // Get all slots for this teacher on the requested date
    const daySlots = conflictSourceSlots.filter(slot => {
      const slotDate = new Date(slot.startTime).toISOString().split('T')[0];
      return slotDate === requestDate;
    });
    
    // Check for conflicts in the requested time range
    const conflictSlots = daySlots.filter(slot =>
      timeRangesOverlap(slot.startTime, slot.endTime, requestStart, requestEnd)
    );
    
    // Adding a supply teacher is blocked by any overlapping booking, regardless of role or centre.
    const isAvailable = conflictSlots.length === 0;
    
    if (!isAvailable) return; // Skip truly unavailable teachers
    
    // Calculate score, category, and detailed reasons
    let score = 100;
    let category = '';
    const reasons: string[] = [];
    const hasClassBefore = false;
    const hasClassAfter = false;
    
    // Global variables to track the closest related slot for display
    let globalClosestSlot: TeacherScheduleSlot | null = null;
    let globalIsBefore = false;
    
    // Check for slots at the same centre on the same day
    const sameCentreSlots = daySlots.filter(slot => slot.centreId === requestCentreId);
    
    const nonConflictSameCentreSlots = sameCentreSlots.filter(slot =>
      !timeRangesOverlap(slot.startTime, slot.endTime, requestStart, requestEnd)
    );

    if (nonConflictSameCentreSlots.length > 0) {
      let closestGap: number | null = null;
      let closestSlot: TeacherScheduleSlot | null = null;
      let isBefore = false;

      nonConflictSameCentreSlots.forEach(slot => {
        const slotStartMs = new Date(slot.startTime).getTime();
        const slotEndMs = new Date(slot.endTime).getTime();

        if (slotEndMs <= requestStartMs) {
          const gap = Math.round((requestStartMs - slotEndMs) / (1000 * 60));
          if (closestGap === null || gap < closestGap) {
            closestGap = gap;
            closestSlot = slot;
            isBefore = true;
          }
        }

        if (slotStartMs >= requestEndMs) {
          const gap = Math.round((slotStartMs - requestEndMs) / (1000 * 60));
          if (closestGap === null || gap < closestGap) {
            closestGap = gap;
            closestSlot = slot;
            isBefore = false;
          }
        }
      });

      const isAdjacent = closestGap !== null && closestGap <= 0;

      if (isAdjacent) {
        category = 'has-class-same-centre-adjacent';
        score = 160;
      } else {
        category = 'has-class-same-centre';
        score = 150;
      }

      if (closestSlot) {
        globalClosestSlot = closestSlot;
        globalIsBefore = isBefore;

        if (closestGap !== null && closestGap <= 0) {
          reasons.push(TEACHER_SCHEDULE_LABELS.SAME_CENTRE_ADJACENT_CLASS_REASON);
          score += 30;
        } else if (closestGap! <= 30) {
          reasons.push(TEACHER_SCHEDULE_LABELS.SAME_CENTRE_CLASS_REASON);
          score += 20;
        } else {
          reasons.push(TEACHER_SCHEDULE_LABELS.SAME_CENTRE_CLASS_REASON);
          score += 10;
        }
      } else {
        reasons.push(TEACHER_SCHEDULE_LABELS.SAME_CENTRE_CLASS_REASON);
      }
    }
    
    // Check total hours on that day.
    const nonConflictDaySlots = daySlots.filter(slot => 
      !timeRangesOverlap(slot.startTime, slot.endTime, requestStart, requestEnd)
    );
    const totalHours = nonConflictDaySlots.reduce((sum, slot) => sum + calculateSlotHours(slot.startTime, slot.endTime), 0);
    
    // Check if teacher has experience with the requested course line
    const requestCourseCategory = getCourseLineCategory(requestCourseLine);
    const teacherCourseLines = new Set(
      schedule.slots.map(slot => getCourseLineCategory(slot.courseLine, slot.className))
    );
    
    let courseLineMatch = false;
    if (teacherCourseLines.has(requestCourseCategory)) {
      courseLineMatch = true;
      score += 30; // Bonus for teaching same course line
      // Don't add to reasons - already categorized by course line match
    }
    
    // Determine category if not set yet (no classes at same centre)
    if (!category) {
      if (totalHours === 0) {
        category = 'completely-free';
        score = 130;
        reasons.push(TEACHER_AVAILABILITY_CATEGORY_LABELS.COMPLETELY_FREE);
      } else {
        // Has classes at other centres
        // Check if any class is close to requested time
        const otherCentreSlots = daySlots.filter(slot => slot.centreId !== requestCentreId);
        let closestGap: number | null = null;
        let closestSlot: TeacherScheduleSlot | null = null;
        let isBefore = false;
        
        otherCentreSlots.forEach(slot => {
          const slotStartMs = new Date(slot.startTime).getTime();
          const slotEndMs = new Date(slot.endTime).getTime();
          
          if (slotEndMs <= requestStartMs) {
            const gap = Math.round((requestStartMs - slotEndMs) / (1000 * 60));
            if (closestGap === null || gap < closestGap) {
              closestGap = gap;
              closestSlot = slot;
              isBefore = true;
            }
          }
          
          if (slotStartMs >= requestEndMs) {
            const gap = Math.round((slotStartMs - requestEndMs) / (1000 * 60));
            if (closestGap === null || gap < closestGap) {
              closestGap = gap;
              closestSlot = slot;
              isBefore = false;
            }
          }
        });
        
        // Check if teacher has adjacent class (gap <= 0 means classes are back-to-back or overlapping)
        const hasAdjacentClass = closestGap !== null && closestGap <= 0;
        
        if (hasAdjacentClass) {
          // Lower priority - has adjacent class at other centre
          category = 'has-class-other-centre-adjacent';
          score = 105;
        } else {
          // Higher priority - has class at other centre but not adjacent
          category = 'has-class-other-centre';
          score = 115;
        }
        
        if (closestSlot) {
          // Update global variables if this is the closest slot overall
          if (globalClosestSlot === null) {
            globalClosestSlot = closestSlot;
            globalIsBefore = isBefore;
          }
          
          if (closestGap !== null && closestGap <= 0) {
            reasons.push(TEACHER_SCHEDULE_LABELS.OTHER_CENTRE_ADJACENT_CLASS_REASON);
          } else if (closestGap! <= 60) {
            reasons.push(TEACHER_SCHEDULE_LABELS.OTHER_CENTRE_CLASS_REASON);
          } else {
            reasons.push(TEACHER_SCHEDULE_LABELS.OTHER_CENTRE_CLASS_REASON);
          }
        } else {
          reasons.push(TEACHER_SCHEDULE_LABELS.OTHER_CENTRE_CLASS_REASON);
        }
      }
    }
    
    // Penalty for heavy workload
    if (totalHours >= 6) {
      score -= 20;
      reasons.push(TEACHER_SCHEDULE_LABELS.HEAVY_WORKLOAD_REASON);
    }
    
    const reason = reasons.length > 0 ? reasons.join(' • ') : TEACHER_SCHEDULE_LABELS.AVAILABLE_TEACHER_REASON;
    
    availabilities.push({
      teacher: schedule.teacher,
      isAvailable: true,
      conflictSlots: [],
      score,
      reason,
      hasClassBefore,
      hasClassAfter,
      totalHoursToday: totalHours,
      category, // Add category for grouping
      courseLineMatch, // Add course line match flag
      relatedSlot: globalClosestSlot || undefined, // Add related slot for detailed display
      isRelatedSlotBefore: globalIsBefore, // Add timing info
    });
  });
  
  // Sort by score descending
  availabilities.sort((a, b) => b.score - a.score);
  
  return availabilities;
}

function findTeacherBlockingSlot(
  schedules: TeacherSchedule[],
  teacherId: string,
  requestStart: string,
  requestEnd: string
): TeacherScheduleSlot | undefined {
  const schedule = schedules.find(item => item.teacher.id === teacherId);
  return schedule?.slots.find(slot =>
    timeRangesOverlap(slot.startTime, slot.endTime, requestStart, requestEnd)
  );
}

function getTeacherRoleLabel(roleShortName?: string, roleName?: string): string {
  const role = (roleShortName || roleName || '').trim();
  if (!role) return 'Giáo viên';

  const roleUpper = role.toUpperCase();
  if (roleUpper === 'SUPPLY') return 'SUPPLY';
  return role;
}

function getSlotTeachersByRole(slot: TeacherScheduleSlot, roleShortName: string) {
  const roleUpper = roleShortName.toUpperCase();
  return (slot.sessionTeachers || []).filter(item =>
    (item.roleShortName || item.roleName || '').toUpperCase() === roleUpper
  );
}

function getDisplaySessionTeachers(slot: TeacherScheduleSlot) {
  if (slot.sessionTeachers?.length) return slot.sessionTeachers;
  if (!slot.teacher) return [];

  return [{
    teacher: slot.teacher,
    roleId: slot.roleId,
    roleName: slot.roleName,
    roleShortName: slot.roleShortName,
  }];
}

function getSlotTeacherRoles(slot: TeacherScheduleSlot, teacherId?: string) {
  return getDisplaySessionTeachers(slot)
    .filter(item => !teacherId || item.teacher.id === teacherId)
    .map(item => getTeacherRoleLabel(item.roleShortName, item.roleName));
}

function getSessionTeacherRoleRows(slot: TeacherScheduleSlot) {
  const rows = new Map<string, { label: string; names: string[] }>();

  getDisplaySessionTeachers(slot).forEach(item => {
    const label = getTeacherRoleLabel(item.roleShortName, item.roleName);
    const key = label.toUpperCase();
    const name = item.teacher.fullName || item.teacher.username;
    if (!rows.has(key)) rows.set(key, { label, names: [] });
    rows.get(key)!.names.push(name);
  });

  return Array.from(rows.values());
}

function getSlotSessionTeacherItems(slot: TeacherScheduleSlot) {
  const items = [...(slot.sessionTeachers || [])];

  if (slot.teacher) {
    const exists = items.some(item =>
      item.teacher.id === slot.teacher?.id &&
      (item.roleId || item.roleShortName || item.roleName) === (slot.roleId || slot.roleShortName || slot.roleName)
    );

    if (!exists) {
      items.push({
        teacher: slot.teacher,
        roleId: slot.roleId,
        roleName: slot.roleName,
        roleShortName: slot.roleShortName,
      });
    }
  }

  return items;
}

function mergeSessionTeachers(
  current: TeacherScheduleSlot['sessionTeachers'] = [],
  incoming: TeacherScheduleSlot['sessionTeachers'] = [],
): NonNullable<TeacherScheduleSlot['sessionTeachers']> {
  const merged = new Map<string, NonNullable<TeacherScheduleSlot['sessionTeachers']>[number]>();

  [...current, ...incoming].forEach(item => {
    const key = `${item.teacher.id}-${item.roleId || item.roleShortName || item.roleName || 'role'}`;
    if (!merged.has(key)) merged.set(key, item);
  });

  return Array.from(merged.values());
}

function getSlotTeacherIds(slot: TeacherScheduleSlot): Set<string> {
  const ids = new Set<string>();
  getDisplaySessionTeachers(slot).forEach(item => ids.add(item.teacher.id));
  if (slot.teacher?.id) ids.add(slot.teacher.id);
  return ids;
}

function replaceClassSlotsInSchedules(
  schedules: TeacherSchedule[],
  classId: string,
  classSchedules: TeacherSchedule[],
): TeacherSchedule[] {
  const scheduleMap = new Map<string, TeacherSchedule>();

  schedules.forEach(schedule => {
    const remainingSlots = schedule.slots.filter(slot => slot.classId !== classId);
    if (remainingSlots.length > 0) {
      scheduleMap.set(schedule.teacher.id, {
        ...schedule,
        slots: remainingSlots,
      });
    }
  });

  classSchedules.forEach(classSchedule => {
    const existing = scheduleMap.get(classSchedule.teacher.id);
    scheduleMap.set(classSchedule.teacher.id, {
      teacher: existing?.teacher || classSchedule.teacher,
      slots: [...(existing?.slots || []), ...classSchedule.slots].sort((a, b) =>
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      ),
    });
  });

  return Array.from(scheduleMap.values());
}

// ─── Memoized Calendar Grid Component ────────────────────────────────────────

const CalendarGrid = memo(({ 
  calendarData, 
  slotMap,  // pre-computed: `${date}-${hour}` -> slots[]
  TIME_SLOTS,
  onCardClick,
  collapsedTimeSlots,
  onToggleCollapse
}: {
  calendarData: any[];
  slotMap: Map<string, Map<string, any[]>>;
  TIME_SLOTS: Array<{ time: string; label: string }>;
  onCardClick: (slot: any) => void;
  collapsedTimeSlots: Set<string>;
  onToggleCollapse: (timeSlotKey: string) => void;
}) => {
  return (
    <div style={{ overflowX: 'auto', background: 'var(--bg-surface)', borderRadius: "var(--radius-card)", border: '1px solid var(--border-primary)' }}>
      <div style={{ minWidth: 1400, padding: 'var(--space-4)' }}>
        {/* Calendar Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '120px repeat(7, 1fr)', gap: 'var(--space-1)', background: 'var(--border-primary)' }}>
          {/* Header Row - Days of Week */}
          <div style={{ background: 'var(--bg-elevated)', padding: '12px', fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', borderBottom: '2px solid var(--border-primary)' }}>
            Khung giờ
          </div>
          {calendarData.map((day) => (
            <div key={day.date} style={{ background: 'var(--bg-elevated)', padding: '12px', textAlign: 'center', fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', borderBottom: '2px solid var(--border-primary)' }}>
              <div>{day.dayLabel}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 400, marginTop: 2 }}>
                {new Date(day.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
              </div>
            </div>
          ))}

          {/* Time Slot Rows */}
          {TIME_SLOTS.map((timeSlot) => {
            const isCollapsed = collapsedTimeSlots.has(timeSlot.time);
            
            return (
            <Fragment key={`fragment-${timeSlot.time}`}>
              {/* Time Label with Collapse Button */}
              <div key={`time-${timeSlot.time}`} style={{ background: 'var(--bg-elevated)', padding: '24px 12px 12px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center', borderRight: '2px solid var(--border-primary)', position: 'relative' }}>
                <button
                  onClick={() => onToggleCollapse(timeSlot.time)}
                  style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 4,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-tertiary)',
                    transition: 'color 0.2s',
                    transform: isCollapsed ? 'none' : 'rotate(180deg)',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-tertiary)'}
                  title={isCollapsed ? 'Mở rộng' : 'Thu gọn'}
                >
                  <Icon.ChevronDown />
                </button>
                <div style={{ fontSize: 13, fontWeight: 590, color: 'var(--text-primary)' }}>{timeSlot.time}</div>
                <div style={{ fontSize: 10, color: 'var(--text-quaternary)', marginTop: 2 }}>{timeSlot.label}</div>
              </div>

              {/* Day Cells */}
              {isCollapsed ? (
                calendarData.map((day) => {
                  const key = `${day.date}-${timeSlot.time}`;
                  const centreMap = slotMap.get(key); // Map<string, any[]>
                  const hasSlots = centreMap && centreMap.size > 0;

                  return (
                    <div key={`${day.date}-${timeSlot.time}-collapsed`} style={{ 
                      background: 'var(--bg-surface)', 
                      padding: hasSlots ? 'var(--space-2)' : '24px 0 0 0', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      alignItems: 'flex-start',
                      justifyContent: hasSlots ? 'flex-start' : 'center',
                      gap: 8, 
                      minHeight: 44,
                    }}>
                      {centreMap && Array.from(centreMap.entries()).map(([centreName, centreSlots]: [string, any[]]) => {
                        return (
                          <div key={centreName} style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
                            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-quaternary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                              {centreName}
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                              {centreSlots.map((slot: any, i: number) => {
                                const isOfficeHour = slot.type === 'office-hour';
                                let accentColor = 'var(--text-tertiary)';
                                let borderColor = 'var(--border-primary)';
                                let bgColor = 'var(--bg-elevated)';
                                
                                if (slot.status === 'ABANDONED') {
                                  accentColor = 'var(--text-quaternary)';
                                  borderColor = 'var(--border-secondary)';
                                } else {
                                  const courseCategory = getCourseLineCategory(slot.courseLine, slot.className);
                                  if (courseCategory === 'Art') {
                                    accentColor = isOfficeHour ? '#fbbf24' : '#b45309';
                                    borderColor = isOfficeHour ? '#fde68a' : 'var(--status-warning)';
                                  } else if (courseCategory === 'Robotics') {
                                    accentColor = isOfficeHour ? '#60a5fa' : '#1e40af';
                                    borderColor = isOfficeHour ? 'rgba(94, 106, 210, 0.3)' : 'var(--brand-indigo)';
                                  } else if (courseCategory === 'Coding') {
                                    accentColor = isOfficeHour ? '#34d399' : '#047857';
                                    borderColor = isOfficeHour ? '#a7f3d0' : 'var(--status-emerald)';
                                  }
                                }
                                
                                const name = slot.className || (isOfficeHour ? 'Ca trực' : 'Lớp học');
                                
                                return (
                                  <div 
                                    key={i} 
                                    onClick={() => onCardClick(slot)}
                                    style={{ 
                                      fontSize: 9, 
                                      fontWeight: 600, 
                                      padding: '2px 5px', 
                                      borderRadius: 'var(--radius-micro)', 
                                      background: bgColor, 
                                      border: `1px solid ${borderColor}`,
                                      borderLeft: `3px solid ${accentColor}`,
                                      color: 'var(--text-primary)',
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      maxWidth: '100%',
                                      boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                                      cursor: 'pointer'
                                    }} 
                                    title={name}
                                  >
                                    {name}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                      
                      {!hasSlots && (
                        <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                          <span style={{ color: 'var(--text-quaternary)', fontSize: 11 }}>—</span>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                calendarData.map((day) => {
                  // O(1) lookup from pre-computed map instead of O(n) flatMap each cell
                  const key = `${day.date}-${timeSlot.time}`;
                  const centreMap = slotMap.get(key); // Map<string, any[]>
                  const hasSlots = centreMap && centreMap.size > 0;

                  return (
                    <div key={`${day.date}-${timeSlot.time}`} style={{ background: 'var(--bg-surface)', padding: 'var(--space-2)', minHeight: 120, display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                      {centreMap && Array.from(centreMap.entries()).map(([centreName, centreSlots]: [string, any[]]) => (
                        <div key={centreName} style={{ 
                          background: 'var(--bg-elevated)', 
                          border: '1px solid var(--border-primary)', 
                          borderRadius: "var(--radius-comfortable)", 
                          padding: '8px',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                        }}>
                          {/* Centre Label */}
                          <div style={{ 
                            fontSize: 10, 
                            fontWeight: 600, 
                            color: 'var(--text-secondary)', 
                            marginBottom: 'var(--space-2)', 
                            textTransform: 'uppercase', 
                            letterSpacing: '0.04em',
                            paddingBottom: 6,
                            borderBottom: '1px solid var(--border-secondary)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--space-1)'
                          }}>
                            <Icon.MapPin size={10} />
                            <span>{centreName}</span>
                            <span style={{ 
                              fontSize: 9, 
                              fontWeight: 510, 
                              color: 'var(--text-quaternary)',
                              background: 'var(--bg-surface)',
                              padding: '1px 5px',
                              borderRadius: 'var(--radius-standard)',
                              marginLeft: 'auto'
                            }}>
                              {centreSlots.length}
                            </span>
                          </div>
                          
                          {/* Class Cards */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                            {centreSlots.map((slot: any) => (
                              <ClassCard key={slot.id || `${slot.className}-${slot.teacher?.id}`} slot={slot} onClick={() => onCardClick(slot)} />
                            ))}
                          </div>
                        </div>
                      ))}
                      
                      {/* Empty State */}
                      {!hasSlots && (
                        <div style={{ display: 'flex', alignItems: 'flex-start', paddingTop: 24, justifyContent: 'center', height: '100%', color: 'var(--text-quaternary)', fontSize: 11 }}>
                          —
                        </div>
                      )}
                    </div>
                  );
                }))}
            </Fragment>
          );
          })}
        </div>

        {/* Legend */}
        <div style={{ marginTop: 'var(--space-4)', padding: 'var(--space-3) var(--space-4)', background: 'var(--bg-elevated)', borderRadius: "var(--radius-comfortable)", border: '1px solid var(--border-primary)' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 'var(--space-2)' }}>Chú thích</div>
          <div style={{ display: 'flex', gap: 'var(--space-6)', flexWrap: 'wrap', alignItems: 'flex-start' }}>
            {/* Course Lines */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-quaternary)', marginBottom: 'var(--space-2)', textTransform: 'uppercase' }}>Khối học</div>
              <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <div style={{ width: 3, height: 16, background: 'rgba(4, 120, 87, 1)', borderRadius: 'var(--radius-micro)' }}></div>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Coding (Lớp)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <div style={{ width: 3, height: 16, background: 'rgba(52, 211, 153, 1)', borderRadius: 'var(--radius-micro)' }}></div>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Coding (Ca trực)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <div style={{ width: 3, height: 16, background: 'rgba(30, 64, 175, 1)', borderRadius: 'var(--radius-micro)' }}></div>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Robotics (Lớp)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <div style={{ width: 3, height: 16, background: 'rgba(96, 165, 250, 1)', borderRadius: 'var(--radius-micro)' }}></div>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Robotics (Ca trực)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <div style={{ width: 3, height: 16, background: 'rgba(180, 83, 9, 1)', borderRadius: 'var(--radius-micro)' }}></div>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Art (Lớp)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <div style={{ width: 3, height: 16, background: 'rgba(251, 191, 36, 1)', borderRadius: 'var(--radius-micro)' }}></div>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Art (Ca trực)</span>
                </div>
              </div>
            </div>
            
            {/* Status */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-quaternary)', marginBottom: 'var(--space-2)', textTransform: 'uppercase' }}>Trạng thái</div>
              <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <div style={{ width: 16, height: 16, background: 'rgba(5, 150, 105, 0.08)', border: '1px solid rgba(16, 185, 129, 0.4)', borderRadius: 3 }}></div>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Running</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <div style={{ width: 16, height: 16, background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(94, 106, 210, 0.4)', borderRadius: 3 }}></div>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Completed</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <div style={{ width: 16, height: 16, background: 'rgba(0, 0, 0, 0.04)', border: '1px solid var(--border-secondary)', borderRadius: 3 }}></div>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Abandoned</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

CalendarGrid.displayName = 'CalendarGrid';

// ─── Memoized Table View Component ───────────────────────────────────────────

const TableView = memo(({ 
  schedules, 
  loading, 
  progress,
  searchTerm,
  onSearchChange,
  selectedCentres,
  onCentresChange,
  centres,
  selectedCourseLines,
  onCourseLinesChange,
  courseLineOptions
}: {
  schedules: TeacherSchedule[];
  loading: boolean;
  progress: { loaded: number; total: number };
  searchTerm: string;
  onSearchChange: (term: string) => void;
  selectedCentres: string[];
  onCentresChange: (centres: string[]) => void;
  centres: Centre[];
  selectedCourseLines: string[];
  onCourseLinesChange: (courseLines: string[]) => void;
  courseLineOptions: SelectOption[];
}) => {
  // Filter schedules based on search, centre, and course line selection
  const filteredSchedules = useMemo(() => {
    return schedules.filter(schedule => {
      const matchesSearch = !searchTerm || 
        schedule.teacher.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        schedule.teacher.email?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCentre = selectedCentres.length === 0 || 
        schedule.slots.some(slot => selectedCentres.includes(slot.centreId));
      
      const matchesCourseLine = selectedCourseLines.length === 0 ||
        schedule.slots.some(slot => {
          const category = getCourseLineCategory(slot.courseLine, slot.className);
          return selectedCourseLines.includes(category);
        });
      
      return matchesSearch && matchesCentre && matchesCourseLine;
    });
  }, [schedules, searchTerm, selectedCentres, selectedCourseLines]);

  return (
    <div className={styles.tableSection}>
      <TableGroupHeader
        title="Danh sách giáo viên"
        count={filteredSchedules.length}
        loading={loading}
        progress={progress}
        isExpanded={true}
        onToggle={() => {}}
      />
      
      <div className={styles.tableScrollWrapper}>
        {/* Table Header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 2fr)',
          padding: '7px 16px',
          borderBottom: '1px solid var(--border-primary)',
          fontSize: 11,
          fontWeight: 590,
          color: 'var(--text-quaternary)',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          background: 'var(--bg-elevated)',
          minWidth: 800
        }}>
          <div>Giáo viên</div>
          <div>Số ca dạy</div>
          <div>Tổng giờ</div>
          <div>Cơ sở</div>
        </div>

        {/* Table Rows */}
        {filteredSchedules.map((schedule, idx) => {
          const totalHours = schedule.slots.reduce((sum, slot) => sum + calculateSlotHours(slot.startTime, slot.endTime), 0);
          const centreSet = new Set(schedule.slots.map(s => s.centreShortName));
          const centreList = Array.from(centreSet).join(', ');

          return (
            <div
              key={schedule.teacher.id}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 2fr)',
                padding: '10px 16px',
                borderBottom: '1px solid var(--border-primary)',
                alignItems: 'center',
                background: 'var(--bg-surface)',
                transition: 'background 0.1s ease',
                minWidth: 800,
                cursor: 'pointer'
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-surface)')}>
              
              <div style={{ fontSize: 13, fontWeight: 510, color: 'var(--text-primary)' }}>
                {schedule.teacher.fullName}
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                  {schedule.teacher.email}
                </div>
              </div>
              
              <div style={{ fontSize: 15, fontWeight: 590, color: 'var(--text-primary)' }}>
                {schedule.slots.length}
              </div>
              
              <div style={{ fontSize: 15, fontWeight: 590, color: 'var(--text-primary)' }}>
                {totalHours.toFixed(1)}h
              </div>
              
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {centreList || '—'}
              </div>
            </div>
          );
        })}
        
        {/* Empty State */}
        {filteredSchedules.length === 0 && !loading && (
          <EmptyState
            icon={<Icon.Search size={32} />}
            title="Không tìm thấy giáo viên"
            subtitle="Thử thay đổi bộ lọc hoặc từ khoá tìm kiếm"
          />
        )}
      </div>
    </div>
  );
});

TableView.displayName = 'TableView';

// ─── Chart Component ─────────────────────────────────────────────────────────

const TeacherStatsChart = memo(({ schedules }: { schedules: TeacherSchedule[] }) => {
  
  // State for collapsible charts section
  const [isExpanded, setIsExpanded] = useState(true);

  // 1. Centre Analytics (Combo: Teachers + Hours + Class vs Office breakdown)
  const centreAnalytics = useMemo(() => {
    const centreStats = schedules.reduce((acc, schedule) => {
      schedule.slots.forEach(slot => {
        const centreName = slot.centreShortName;
        if (!acc[centreName]) {
          acc[centreName] = { 
            teachers: new Set(), 
            classHours: 0, 
            officeHours: 0,
            totalSlots: 0 
          };
        }
        acc[centreName].teachers.add(schedule.teacher.id);
        acc[centreName].totalSlots += 1;
        
        const hours = calculateSlotHours(slot.startTime, slot.endTime);
        if (slot.type === 'office-hour') {
          acc[centreName].officeHours += hours;
        } else {
          acc[centreName].classHours += hours;
        }
      });
      return acc;
    }, {} as Record<string, { teachers: Set<string>; classHours: number; officeHours: number; totalSlots: number }>);

    return Object.entries(centreStats).map(([centre, stats]) => ({
      centre,
      'Số GV': stats.teachers.size,
      'Lớp học': parseFloat(stats.classHours.toFixed(1)),
      'Ca trực': parseFloat(stats.officeHours.toFixed(1)),
      'Tổng giờ': parseFloat((stats.classHours + stats.officeHours).toFixed(1))
    })).sort((a, b) => b['Tổng giờ'] - a['Tổng giờ']);
  }, [schedules]);

  // 2. Course Line Analytics (Pie + Daily breakdown)
  const courseLineAnalytics = useMemo(() => {
    // Pie data
    const courseLineStats = schedules.reduce((acc, schedule) => {
      schedule.slots.forEach(slot => {
        const category = getCourseLineCategory(slot.courseLine, slot.className);
        if (!acc[category]) {
          acc[category] = { teachers: new Set(), slots: 0, hours: 0 };
        }
        acc[category].teachers.add(schedule.teacher.id);
        acc[category].slots += 1;
        acc[category].hours += calculateSlotHours(slot.startTime, slot.endTime);
      });
      return acc;
    }, {} as Record<string, { teachers: Set<string>; slots: number; hours: number }>);

    const pieData = Object.entries(courseLineStats).map(([courseLine, stats]) => ({
      name: courseLine,
      value: stats.teachers.size,
      hours: parseFloat(stats.hours.toFixed(1)),
      slots: stats.slots
    })).sort((a, b) => b.value - a.value);

    // Daily breakdown
    const dailyCourseStats = schedules.reduce((acc, schedule) => {
      schedule.slots.forEach(slot => {
        const date = new Date(slot.startTime);
        const dayName = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][date.getDay()];
        const courseLine = getCourseLineCategory(slot.courseLine, slot.className);
        
        if (!acc[dayName]) {
          acc[dayName] = { Coding: 0, Robotics: 0, Art: 0, Others: 0 };
        }
        acc[dayName][courseLine]++;
      });
      return acc;
    }, {} as Record<string, Record<string, number>>);

    const dailyData = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(day => ({
      day,
      Coding: dailyCourseStats[day]?.Coding || 0,
      Robotics: dailyCourseStats[day]?.Robotics || 0,
      Art: dailyCourseStats[day]?.Art || 0,
      Others: dailyCourseStats[day]?.Others || 0
    }));

    return { pieData, dailyData };
  }, [schedules]);

  // 3. Teacher Ranking (Top performers by hours and slots)
  const teacherRanking = useMemo(() => {
    const teacherStats = schedules.map(schedule => {
      const totalHours = schedule.slots.reduce((sum, slot) => sum + calculateSlotHours(slot.startTime, slot.endTime), 0);
      const totalSlots = schedule.slots.length;
      const centres = [...new Set(schedule.slots.map(s => s.centreShortName))];
      
      return {
        name: schedule.teacher.fullName || schedule.teacher.username,
        'Tổng giờ': parseFloat(totalHours.toFixed(1)),
        'Số ca': totalSlots,
        centres: centres.join(', ')
      };
    }).sort((a, b) => b['Tổng giờ'] - a['Tổng giờ']).slice(0, 10); // Top 10

    return teacherStats;
  }, [schedules]);

  // 4. Workload & Schedule Pattern (Combined analysis)
  const workloadAndPattern = useMemo(() => {
    // Workload distribution with realistic ranges
    const workloadBuckets = { '1-5h': 0, '6-10h': 0, '11-15h': 0, '16-20h': 0, '20h+': 0 };
    
    schedules.forEach(schedule => {
      const totalHours = schedule.slots.reduce((sum, slot) => sum + calculateSlotHours(slot.startTime, slot.endTime), 0);
      if (totalHours <= 5) workloadBuckets['1-5h']++;
      else if (totalHours <= 10) workloadBuckets['6-10h']++;
      else if (totalHours <= 15) workloadBuckets['11-15h']++;
      else if (totalHours <= 20) workloadBuckets['16-20h']++;
      else workloadBuckets['20h+']++;
    });

    const workloadData = Object.entries(workloadBuckets).map(([range, count]) => ({
      range,
      'Số GV': count,
      'Tỷ lệ %': schedules.length > 0 ? ((count / schedules.length) * 100).toFixed(1) : '0'
    }));

    // Daily pattern (Classes vs Office Hours)
    const dailyStats = schedules.reduce((acc, schedule) => {
      schedule.slots.forEach(slot => {
        const date = new Date(slot.startTime);
        const dayName = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][date.getDay()];
        if (!acc[dayName]) {
          acc[dayName] = { classes: 0, officeHours: 0, teachers: new Set() };
        }
        acc[dayName].teachers.add(schedule.teacher.id);
        if (slot.type === 'office-hour') {
          acc[dayName].officeHours++;
        } else {
          acc[dayName].classes++;
        }
      });
      return acc;
    }, {} as Record<string, { classes: number; officeHours: number; teachers: Set<string> }>);

    const dailyPattern = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(day => ({
      day,
      'Lớp học': dailyStats[day]?.classes || 0,
      'Ca trực': dailyStats[day]?.officeHours || 0,
      'Giáo viên': dailyStats[day]?.teachers.size || 0
    }));

    return { workloadData, dailyPattern };
  }, [schedules]);

  // Don't render if no data
  if (
    centreAnalytics.length === 0 && 
    courseLineAnalytics.dailyData.length === 0 && 
    teacherRanking.length === 0 &&
    workloadAndPattern.dailyPattern.length === 0 &&
    workloadAndPattern.workloadData.length === 0
  ) {
    return null;
  }

  return (
    <div className={styles.chartsSection}>
      <ChartSectionHeader 
        title="Biểu Đồ Phân Tích" 
        visible={isExpanded} 
        onToggle={() => setIsExpanded(!isExpanded)} 
      />
      
      {isExpanded && (
        <div className={styles.chartsGrid}>
        
        {/* 1. Centre Analytics - Combo Chart (Teachers + Hours + Class vs Office breakdown) */}
        {centreAnalytics.length > 0 && (
          <div className={styles.chartCard}>
            <div className={styles.chartTitle}>Hoạt Động Giảng Dạy Theo Cơ Sở</div>
            <div style={{ flex: 1, minHeight: 0 }}>
              <ResponsiveContainer width="100%" height={Math.max(280, centreAnalytics.length * 40)}>
                <ComposedChart data={centreAnalytics} {...ComposedChartConfig}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" horizontal={false} />
                <StandardXAxis label="Giờ dạy" />
                <StandardYAxisCategory dataKey="centre" label="Cơ sở" />
                <ReTooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
                <Bar dataKey="Lớp học" stackId="hours" fill={CHART_COLORS.PRIMARY} radius={[0, 2, 2, 0]} />
                <Bar dataKey="Ca trực" stackId="hours" fill={CHART_COLORS.SECONDARY[1]} radius={[0, 2, 2, 0]} />
                <Line dataKey="Số GV" stroke={CHART_COLORS.SECONDARY[2]} strokeWidth={3} dot={{ fill: CHART_COLORS.SECONDARY[2], strokeWidth: 2, r: 4 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className={styles.chartLegend}>
            <div className={styles.legendItem}>
              <span className={styles.legendSwatch} style={{ background: 'var(--brand-indigo)' }} />
              Lớp học
            </div>
            <div className={styles.legendItem}>
              <span className={styles.legendSwatch} style={{ background: 'var(--status-emerald)' }} />
              Ca trực
            </div>
            <div className={styles.legendItem}>
              <span className={styles.legendSwatch} style={{ background: CHART_COLORS.SECONDARY[2] }} />
              Giáo viên
            </div>
          </div>
        </div>
        )}

        {/* 2. Course Line Analytics - Combo Chart (Pie + Daily Stacked Bar) */}
        {courseLineAnalytics.dailyData.length > 0 && (
          <div className={styles.chartCard}>
          <div className={styles.chartTitle}>Phân Bổ Lịch Theo Khối Môn Học</div>
          <div style={{ flex: 1, minHeight: 0 }}>
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart 
                data={courseLineAnalytics.dailyData} 
                margin={{ top: 4, right: 60, left: 8, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                <XAxis 
                  dataKey="day" 
                  tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} 
                  axisLine={false} 
                  tickLine={false}
                  label={{ value: 'Ngày', angle: 0, position: 'insideBottom', offset: -5, style: { fontSize: 11, fill: 'var(--text-quaternary)', fontWeight: 590, textTransform: 'uppercase', letterSpacing: '0.04em' } }}
                />
                <StandardYAxisNumber 
                  yAxisId="left" 
                  label="Số ca" 
                />
                <StandardYAxisNumber 
                  yAxisId="right" 
                  orientation="right" 
                  label="Tổng" 
                />
                <ReTooltip content={<CustomTooltip />} />
                <Bar dataKey="Coding" stackId="courseLine" fill={CHART_COLORS.PRIMARY} radius={[0, 0, 0, 0]} yAxisId="left" />
                <Bar dataKey="Robotics" stackId="courseLine" fill={CHART_COLORS.SECONDARY[1]} radius={[0, 0, 0, 0]} yAxisId="left" />
                <Bar dataKey="Art" stackId="courseLine" fill={CHART_COLORS.SECONDARY[2]} radius={[0, 0, 0, 0]} yAxisId="left" />
                <Bar dataKey="Others" stackId="courseLine" fill={CHART_COLORS.SECONDARY[3]} radius={[2, 2, 0, 0]} yAxisId="left" />
                <Line 
                  dataKey={(data) => data.Coding + data.Robotics + data.Art + data.Others}
                  name="Tổng ca"
                  stroke={CHART_COLORS.SECONDARY[4]} 
                  strokeWidth={3} 
                  dot={{ fill: CHART_COLORS.SECONDARY[4], strokeWidth: 2, r: 4 }}
                  yAxisId="right"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className={styles.chartLegend}>
            {courseLineAnalytics.pieData.map((entry, index) => (
              <div key={entry.name} className={styles.legendItem}>
                <span 
                  className={styles.legendSwatch} 
                  style={{ background: CHART_COLORS.PALETTE[index % CHART_COLORS.PALETTE.length] }} 
                />
                {entry.name}
              </div>
            ))}
            <div className={styles.legendItem}>
              <span className={styles.legendSwatch} style={{ background: CHART_COLORS.SECONDARY[4] }} />
              Tổng ca
            </div>
          </div>
        </div>
        )}

        {/* 3. Teacher Ranking - Top performers by hours and slots */}
        {teacherRanking.length > 0 && (
          <div className={styles.chartCard}>
          <div className={styles.chartTitle}>Top 10 Giáo Viên Có Lượng Giờ Dạy Cao Nhất</div>
          <div style={{ flex: 1, minHeight: 0 }}>
            <ResponsiveContainer width="100%" height={Math.max(300, teacherRanking.length * 30)}>
              <ComposedChart 
                data={teacherRanking} 
                {...ComposedChartConfig}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" horizontal={false} />
                <StandardXAxis label="Giờ dạy" />
                <StandardYAxisCategory dataKey="name" width={120} label="Giáo viên" />
                <ReTooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
                <Bar dataKey="Tổng giờ" fill={CHART_COLORS.PRIMARY} radius={[0, 4, 4, 0]} />
                <Line dataKey="Số ca" stroke={CHART_COLORS.SECONDARY[2]} strokeWidth={3} dot={{ fill: CHART_COLORS.SECONDARY[2], strokeWidth: 2, r: 4 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className={styles.chartLegend}>
            <div className={styles.legendItem}>
              <span className={styles.legendSwatch} style={{ background: 'var(--brand-indigo)' }} />
              Tổng giờ dạy
            </div>
            <div className={styles.legendItem}>
              <span className={styles.legendSwatch} style={{ background: CHART_COLORS.SECONDARY[2] }} />
              Số ca dạy
            </div>
          </div>
        </div>
        )}

        {/* 4. Schedule Pattern - Area + Line Chart */}
        {workloadAndPattern.dailyPattern.length > 0 && (
          <div className={styles.chartCard}>
          <div className={styles.chartTitle}>Tần Suất Giảng Dạy Các Ngày Trong Tuần</div>
          <div style={{ flex: 1, minHeight: 0 }}>
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart 
                data={workloadAndPattern.dailyPattern} 
                margin={{ top: 4, right: 60, left: 8, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                <XAxis 
                  dataKey="day" 
                  tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} 
                  axisLine={false} 
                  tickLine={false}
                  label={{ value: 'Ngày trong tuần', angle: 0, position: 'insideBottom', offset: -5, style: { fontSize: 11, fill: 'var(--text-quaternary)', fontWeight: 590, textTransform: 'uppercase', letterSpacing: '0.04em' } }}
                />
                <StandardYAxisNumber 
                  yAxisId="left" 
                  label="Số ca" 
                />
                <StandardYAxisNumber 
                  yAxisId="right" 
                  orientation="right" 
                  label="Số GV" 
                />
                <ReTooltip content={<CustomTooltip />} />
                <Area 
                  type="monotone" 
                  dataKey="Lớp học" 
                  stroke={CHART_COLORS.PRIMARY} 
                  fill="rgba(94, 106, 210, 0.15)"
                  fillOpacity={0.6}
                  strokeWidth={2}
                  yAxisId="left"
                />
                <Area 
                  type="monotone" 
                  dataKey="Ca trực" 
                  stroke={CHART_COLORS.SECONDARY[1]} 
                  fill="rgba(16, 185, 129, 0.15)"
                  fillOpacity={0.6}
                  strokeWidth={2}
                  yAxisId="left"
                />
                <Line 
                  type="monotone" 
                  dataKey="Giáo viên" 
                  stroke={CHART_COLORS.SECONDARY[2]} 
                  strokeWidth={3}
                  dot={{ fill: CHART_COLORS.SECONDARY[2], strokeWidth: 2, r: 5 }}
                  yAxisId="right"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className={styles.chartLegend}>
            <div className={styles.legendItem}>
              <span className={styles.legendSwatch} style={{ background: 'var(--brand-indigo)' }} />
              Lớp học
            </div>
            <div className={styles.legendItem}>
              <span className={styles.legendSwatch} style={{ background: 'var(--status-emerald)' }} />
              Ca trực
            </div>
            <div className={styles.legendItem}>
              <span className={styles.legendSwatch} style={{ background: CHART_COLORS.SECONDARY[2] }} />
              Giáo viên
            </div>
          </div>
        </div>
        )}
          
        {/* 5. Workload Distribution - Bar Chart */}
        {workloadAndPattern.workloadData.length > 0 && (
          <div className={styles.chartCard}>
          <div className={styles.chartTitle}>Phân Bổ Mật Độ Giáo Viên Theo Số Giờ Dạy</div>
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={workloadAndPattern.workloadData} margin={{ top: 20, right: 20, left: 40, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                <XAxis 
                  dataKey="range" 
                  tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} 
                  axisLine={false} 
                  tickLine={false}
                  label={{ value: 'Khoảng giờ dạy', angle: 0, position: 'insideBottom', offset: -5, style: { fontSize: 11, fill: 'var(--text-quaternary)', fontWeight: 590, textTransform: 'uppercase', letterSpacing: '0.04em' } }}
                />
                <StandardYAxisNumber label="Số GV" />
                <ReTooltip content={<CustomTooltip />} />
                <Bar dataKey="Số GV" fill={CHART_COLORS.SECONDARY[2]} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className={styles.chartLegend}>
            <div className={styles.legendItem}>
              <span className={styles.legendSwatch} style={{ background: CHART_COLORS.SECONDARY[2] }} />
              Số lượng giáo viên
            </div>
          </div>
        </div>
        )}
      </div>
      )}
    </div>
  );
});

TeacherStatsChart.displayName = 'TeacherStatsChart';

// ─── Teacher Card Component ──────────────────────────────────────────────────

const TeacherCard = ({ ta, idx, total }: { ta: any; idx: number; total: number }) => {
  return (
    <div
      style={{
        padding: '12px',
        borderBottom: idx < total - 1 ? '1px solid var(--border-secondary)' : 'none',
        background: 'var(--bg-surface)',
        transition: 'background 0.1s ease'
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-surface)')}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 590, color: 'var(--text-primary)' }}>
            {ta.teacher.fullName || ta.teacher.username}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
            {ta.teacher.email}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 6 }}>
            {ta.reason}
          </div>
          {ta.totalHoursToday !== undefined && ta.totalHoursToday > 0 && (
            <div style={{ fontSize: 10, color: 'var(--text-quaternary)', marginTop: 4 }}>
              Đã dạy {ta.totalHoursToday}h trong ngày
            </div>
          )}
          {ta.conflictSlots && ta.conflictSlots.length > 0 && (
            <div style={{ fontSize: 10, color: 'var(--status-warning)', marginTop: 'var(--space-1)', fontWeight: 510, display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
              <Icon.Monitor size={10} />
              <span>Đang dạy: {ta.conflictSlots[0].className} ({formatTime(ta.conflictSlots[0].startTime)} - {formatTime(ta.conflictSlots[0].endTime)})</span>
            </div>
          )}
        </div>
        <div style={{
          fontSize: 18,
          fontWeight: 590,
          color: ta.score >= 180 ? 'var(--status-success)' : ta.score >= 150 ? 'var(--status-emerald)' : ta.score >= 100 ? 'var(--status-warning)' : 'var(--text-tertiary)',
          textAlign: 'right',
          marginLeft: 16
        }}>
          {ta.score}
          <div style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-quaternary)' }}>điểm</div>
        </div>
      </div>
    </div>
  );
};

// ─── Memoized ClassCard Component ────────────────────────────────────────────

interface ClassCardProps {
  slot: TeacherScheduleSlot & { teacher?: Teacher };
  onClick?: () => void;
}

const ClassCard = memo(({ slot, onClick }: ClassCardProps) => {
  // No useState for hover — use direct DOM style mutation to avoid re-renders
  const cardRef = useRef<HTMLDivElement>(null);
  
  // Determine accent color by course line with higher contrast
  let accentColor = 'var(--text-tertiary)';
  let lightBg = 'var(--bg-surface)';
  let borderColor = 'var(--border-primary)';
  
  // If ABANDONED, use gray for entire card
  if (slot.status === 'ABANDONED') {
    accentColor = 'var(--text-quaternary)';
    lightBg = 'var(--bg-elevated)';
    borderColor = 'var(--border-secondary)';
  } else {
    const isOfficeHour = slot.type === 'office-hour';
    
    const courseCategory = getCourseLineCategory(slot.courseLine, slot.className);

    // Increased contrast: class (darker/saturated), office-hour (much lighter/desaturated)
    if (courseCategory === 'Art') {
      accentColor = isOfficeHour ? '#fbbf24' : '#b45309'; // Art: light amber vs dark amber
      borderColor = isOfficeHour ? '#fde68a' : 'var(--status-warning)';
    } else if (courseCategory === 'Robotics') {
      accentColor = isOfficeHour ? '#60a5fa' : '#1e40af'; // Robotics: light blue vs dark blue
      borderColor = isOfficeHour ? 'rgba(94, 106, 210, 0.3)' : 'var(--brand-indigo)';
    } else if (courseCategory === 'Coding') {
      accentColor = isOfficeHour ? '#34d399' : '#047857'; // Coding: light green vs dark green
      borderColor = isOfficeHour ? '#a7f3d0' : 'var(--status-emerald)';
    }
  }
  
  // Determine status badge color
  let statusBg = 'rgba(5, 150, 105, 0.08)';
  let statusColor = 'var(--status-success)';
  
  if (slot.status === 'RUNNING') {
    statusBg = 'rgba(5, 150, 105, 0.08)';
    statusColor = 'var(--status-success)';
  } else if (slot.status === 'ABANDONED') {
    statusBg = 'var(--bg-panel)';
    statusColor = 'var(--text-tertiary)';
  } else if (slot.status === 'COMPLETED') {
    statusBg = 'rgba(94, 106, 210, 0.1)';
    statusColor = 'var(--brand-indigo)';
  } else {
    statusBg = 'rgba(220, 38, 38, 0.08)';
    statusColor = 'var(--status-error)';
  }

  const teacherName = slot.teacher?.fullName || slot.teacher?.username || 'Giáo viên';
  const teacherRoleRows = getSessionTeacherRoleRows(slot);

  return (
    <div
      ref={cardRef}
      style={{
        background: lightBg,
        border: `1px solid ${borderColor}`,
        borderLeft: `3px solid ${accentColor}`,
        borderRadius: "var(--radius-comfortable)",
        padding: '8px 10px',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
        e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.04)';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
      onClick={onClick}
    >
      {/* Class Name */}
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 3, lineHeight: 1.3 }}>
        {slot.className || 'Lớp học'}
      </div>
      
      {/* Session info for classes (not office hours) */}
      {slot.type === 'class' && slot.sessionNumber !== undefined && (
        <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginBottom: 4 }}>
          Buổi {slot.sessionNumber}
        </div>
      )}
      
      {slot.type === 'class' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 'var(--space-1)' }}>
          {teacherRoleRows.map(row => (
            <div
              key={row.label}
              style={{ fontSize: 10, color: 'var(--text-secondary)', display: 'flex', alignItems: 'flex-start', gap: 'var(--space-1)' }}
            >
              <Icon.User size={10} />
              <span>
                <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{row.label}:</strong>{' '}
                {row.names.join(', ')}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginBottom: 'var(--space-1)', display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
          <Icon.User size={10} />
          <span>{teacherName}</span>
        </div>
      )}
      
      {/* Type label for office hours */}
      {slot.type === 'office-hour' && (
        <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginBottom: 'var(--space-1)', display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
          {slot.className?.includes('Dạy bù') ? (
            <>
              <Icon.BookOpen size={10} />
              <span>Dạy bù</span>
            </>
          ) : slot.className?.includes('trực tuyến') ? (
            <>
              <Icon.Monitor size={10} />
              <span>Trực tuyến</span>
            </>
          ) : (
            <>
              <Icon.Building size={10} />
              <span>Tại cơ sở</span>
            </>
          )}
        </div>
      )}
      
      {/* Status Badge & Student Count */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginTop: 4 }}>
        <span style={{
          fontSize: 9,
          padding: '2px 6px',
          borderRadius: "var(--radius-standard)",
          background: statusBg,
          color: statusColor,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.02em'
        }}>
          {slot.status}
        </span>
        {slot.studentCount !== undefined && (
          <span style={{ fontSize: 9, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
            <Icon.Users size={10} />
            <span>{slot.studentCount}</span>
          </span>
        )}
      </div>
    </div>
  );
});

ClassCard.displayName = 'ClassCard';

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TeacherSchedulePage() {
  const router = useRouter();
  const { logout } = useAuth();
  const { toasts, addToast, removeToast } = useToast();
  const { hasPreferences } = useQuickFilterChips();
  
  // Media query for mobile detection
  const isMobile = useMediaQuery('(max-width: 640px)');

  const [session, setSession] = useState<{ displayName?: string; email?: string } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ── Data states ─────────────────────────────────────────────────────────────
  const [centres, setCentres] = useState<Centre[]>([]);
  const [schedules, setSchedules] = useState<TeacherSchedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ loaded: 0, total: 100 });

  // ── Date range ──────────────────────────────────────────────────────────────
  const getDefaultDates = () => {
    const today = new Date();
    const weekStart = new Date(today);
    const day = weekStart.getDay();
    const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1);
    weekStart.setDate(diff);
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    
    return [weekStart.toISOString().split('T')[0], weekEnd.toISOString().split('T')[0]];
  };
  
  // Shared filter state (synced across pages)
  const [fromDate, toDate, setFromDate, setToDate, datesLoaded] = useSharedDateRange();
  const [endDateFrom, setEndDateFrom] = useState('');
  const [endDateTo, setEndDateTo] = useState('');
  const [selectedCentres, setSelectedCentres, centresLoaded] = useSharedCentres();
  const [isPending, startTransition] = useTransition();

  // ── Filter states ──────────────────────────────────────────────────────────
  const [selectedTeachers, setSelectedTeachers] = useState<string[]>([]);
  const [selectedCourseLines, setSelectedCourseLines] = useState<string[]>([]);
  const [loadedCentreIds, setLoadedCentreIds] = useState<string[]>([]);
  const [calendarCentreFilter, setCalendarCentreFilter] = useState<string[]>([]);
  const [calendarSelectedTeachers, setCalendarSelectedTeachers] = useState<string[]>([]);
  const [calendarSelectedCourseLines, setCalendarSelectedCourseLines] = useState<string[]>([]);
  const [calendarSelectedRoles, setCalendarSelectedRoles] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<TeacherScheduleViewMode>('calendar');
  
  // ── Week navigation state ──────────────────────────────────────────────────
  const [currentWeekIndex, setCurrentWeekIndex] = useState(0);
  
  // ── Table filter states ────────────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState('');
  const [calendarClassCodeSearch, setCalendarClassCodeSearch] = useState('');
  const [appliedCalendarClassCodeSearch, setAppliedCalendarClassCodeSearch] = useState('');
  const [classCodeSearch, setClassCodeSearch] = useState('');
  const [dataLimit, setDataLimit] = useState<DataLimitValue>('all');
  const toolbarTeacherFilter = useTeacherFilterOptions();
  const [scheduleTypeFilter, setScheduleTypeFilter] = useState<ScheduleTypeFilter>('ALL');
  const [selectedClassStatuses, setSelectedClassStatuses] = useState<ClassStatusFilter[]>(DEFAULT_CLASS_STATUS_FILTERS);
  const [classStatusFilterOptions, setClassStatusFilterOptions] = useState<SelectOption[]>(LMS_CLASS_STATUS_OPTIONS);
  const [rawClasses, setRawClasses] = useState<Class[]>([]);
  const [studentCommentAreas, setStudentCommentAreas] = useState<CommentAreaDef[]>([]);
  const [loadSubmissionData, setLoadSubmissionData] = useState(false);
  const classSubmissions = useClassSubmissions(rawClasses, loadSubmissionData);
  
  // ── Calendar collapse states ───────────────────────────────────────────────
  const [collapsedTimeSlots, setCollapsedTimeSlots] = useState<Set<string>>(new Set());

  // ── Coordination states ────────────────────────────────────────────────────
  const [showCoordinationPanel, setShowCoordinationPanel] = useState(false);
  const [coordinationRequest, setCoordinationRequest] = useState<CoordinationRequest>({
    date: '',
    startTime: '08:00',
    endTime: '10:00',
    centreId: '',
  });
  const [availableTeachers, setAvailableTeachers] = useState<TeacherAvailability[]>([]);
  const [unavailableTeachers, setUnavailableTeachers] = useState<TeacherAvailability[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<any | null>(null);
  const [calculatingTeachers, setCalculatingTeachers] = useState(false);
  const [addingSupplyTeacherId, setAddingSupplyTeacherId] = useState<string | null>(null);
  const [reloadingClassId, setReloadingClassId] = useState<string | null>(null);
  const [teacherProfiles, setTeacherProfiles] = useState<TeacherProfile[]>([]);
  const [centreRegionMap, setCentreRegionMap] = useState<CentreRegionMap>({});

  // ── Class quality states ────────────────────────────────────────────────────
  const [classQualityData, setClassQualityData] = useState<AnalyzedClassForQuality | null>(null);
  const [classQualityLoading, setClassQualityLoading] = useState(false);
  const [qualityTab, setQualityTab] = useState<'comments' | 'attendance' | 'rescheduling' | 'finalProducts' | 'submissions'>('comments');
  const [studentWorks, setStudentWorks] = useState<StudentWork[]>([]);
  const [studentWorksLoading, setStudentWorksLoading] = useState(false);
  const [studentWorksError, setStudentWorksError] = useState<string | null>(null);
  const [classStudentWorks, setClassStudentWorks] = useState<StudentWork[]>([]);
  const [classStudentWorksLoading, setClassStudentWorksLoading] = useState(false);
  const [classStudentWorksError, setClassStudentWorksError] = useState<string | null>(null);
  const [classStudentWorksReloadKey, setClassStudentWorksReloadKey] = useState(0);
  const [commentModalSessionIndex, setCommentModalSessionIndex] = useState<number | null>(null);
  const [exemptedSessions, setExemptedSessions] = useState<number[]>(DEFAULT_EXEMPTED_SESSIONS);
  const [exemptOneOnOneClasses, setExemptOneOnOneClasses] = useState(true);
  const [classQualityDateFrom, setClassQualityDateFrom] = useState('');
  const [classQualityDateTo, setClassQualityDateTo] = useState('');
  const [holidayPeriods, setHolidayPeriods] = useState<HolidayPeriod[]>(DEFAULT_HOLIDAY_PERIODS);
  const [showSummarySection, setShowSummarySection] = useState(false);
  const [selectedSummaryCentre, setSelectedSummaryCentre] = useState<string>('all');
  const [summaryStatusFilter, setSummaryStatusFilter] = useState<string[]>([]);
  const [showScheduleCSVSettings, setShowScheduleCSVSettings] = useState(false);
  const { columns: scheduleCsvColumns, saveColumns: saveScheduleCsvColumns } = useCSVExportPreferences(
    'operations-schedule',
    getDefaultOperationsScheduleCSVColumns()
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setAppliedCalendarClassCodeSearch(calendarClassCodeSearch.trim());
    }, 400);

    return () => window.clearTimeout(timeoutId);
  }, [calendarClassCodeSearch]);
  
  // ── Group expansion states for teacher coordination shortlist ──────────────
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    'same-course-same-region': true,
    'same-course-other-region': true,
    'same-course-unknown-region': false,
    'other-course': false,
  });
  const [coordinationCourseLineFilter, setCoordinationCourseLineFilter] = useState<string[]>([]);

  const abortRef = useRef<AbortController | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [loadedRange, setLoadedRange] = useState<{ from: string; to: string } | null>(null);
  const analyzedClassesRef = useRef<AnalyzedClassForQuality[]>([]);

  const deferredCalendarCentreFilter = useDeferredValue(calendarCentreFilter);
  const deferredCalendarSelectedTeachers = useDeferredValue(calendarSelectedTeachers);
  const deferredCalendarSelectedCourseLines = useDeferredValue(calendarSelectedCourseLines);
  const deferredSelectedClassStatuses = useDeferredValue(selectedClassStatuses);
  const deferredScheduleTypeFilter = useDeferredValue(scheduleTypeFilter);
  const deferredAppliedCalendarClassCodeSearch = useDeferredValue(appliedCalendarClassCodeSearch);
  const deferredClassQualityDateFrom = useDeferredValue(classQualityDateFrom);
  const deferredClassQualityDateTo = useDeferredValue(classQualityDateTo);
  const isClassQualityDateRangePending =
    classQualityDateFrom !== deferredClassQualityDateFrom ||
    classQualityDateTo !== deferredClassQualityDateTo;
  const cacheFilterStateRef = useRef({
    calendarCentreFilter,
    calendarSelectedTeachers,
    calendarSelectedCourseLines,
    calendarSelectedRoles,
    classCodeSearch,
    dataLimit,
    endDateFrom,
    endDateTo,
    selectedToolbarTeacher: null as { id: string; fullName?: string; displayName?: string } | null,
    toolbarSelectedCentres: selectedCentres,
    selectedTeachers,
    selectedCourseLines,
    scheduleTypeFilter,
    selectedClassStatuses,
    exemptedSessions,
    exemptOneOnOneClasses,
    classQualityDateFrom,
    classQualityDateTo,
    holidayPeriods,
  });

  cacheFilterStateRef.current = {
    calendarCentreFilter,
    calendarSelectedTeachers,
    calendarSelectedCourseLines,
    calendarSelectedRoles,
    classCodeSearch,
    dataLimit,
    endDateFrom,
    endDateTo,
    selectedToolbarTeacher: toolbarTeacherFilter.selectedTeacherId
      ? {
          id: toolbarTeacherFilter.selectedTeacherId,
          fullName: toolbarTeacherFilter.selectedTeacherName,
          displayName: toolbarTeacherFilter.selectedTeacherName,
        }
      : null,
    toolbarSelectedCentres: selectedCentres,
    selectedTeachers,
    selectedCourseLines,
    scheduleTypeFilter,
    selectedClassStatuses,
    exemptedSessions,
    exemptOneOnOneClasses,
    classQualityDateFrom,
    classQualityDateTo,
    holidayPeriods,
  };

  // ── Sync with URL parameters ──────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view');
    const tab = params.get('tab');
    
    if (view === 'quality-table') setViewMode('quality-table');
    if (view === 'submissions') setViewMode('submissions');
    if (view === 'final-products') setViewMode('final-products');
    if (tab === 'violations') setQualityTab('comments');
    if (tab === 'attendance') setQualityTab('attendance');
    if (tab === 'rescheduling') setQualityTab('rescheduling');
    if (tab === 'final-products') setQualityTab('finalProducts');
  }, []);

  // ── Toggle collapse handler ────────────────────────────────────────────────
  const toggleTimeSlotCollapse = useCallback((timeSlotKey: string) => {
    setCollapsedTimeSlots(prev => {
      const newSet = new Set(prev);
      if (newSet.has(timeSlotKey)) {
        newSet.delete(timeSlotKey);
      } else {
        newSet.add(timeSlotKey);
      }
      return newSet;
    });
  }, []);

  const handleToggleExemptSession = useCallback((sessionNumber: number) => {
    setExemptedSessions(prev => (
      prev.includes(sessionNumber)
        ? prev.filter(session => session !== sessionNumber)
        : [...prev, sessionNumber].sort((a, b) => a - b)
    ));
  }, []);

  const handleAddHolidayPeriod = useCallback((period: HolidayPeriod) => {
    if (!period.name || !period.from || !period.to) {
      addToast('Vui lòng nhập đầy đủ tên và khoảng ngày nghỉ', 'info');
      return;
    }
    if (period.from > period.to) {
      addToast('Ngày bắt đầu phải trước ngày kết thúc', 'error');
      return;
    }

    setHolidayPeriods(prev => [...prev, period]);
    addToast('Đã thêm khoảng thời gian nghỉ', 'success');
  }, [addToast]);

  const handleRemoveHolidayPeriod = useCallback((index: number) => {
    setHolidayPeriods(prev => prev.filter((_, itemIndex) => itemIndex !== index));
    addToast('Đã xoá khoảng thời gian nghỉ', 'success');
  }, [addToast]);

  const handleResetQualityRules = useCallback(() => {
    setExemptedSessions(DEFAULT_EXEMPTED_SESSIONS);
    setExemptOneOnOneClasses(true);
    setHolidayPeriods(DEFAULT_HOLIDAY_PERIODS);
    addToast('Đã khôi phục quy tắc miễn trừ mặc định', 'success');
  }, [addToast]);

  const handleClearScheduleData = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
    setProgress({ loaded: 0, total: 100 });
    setSchedules([]);
    setRawClasses([]);
    setStudentCommentAreas([]);
    setLoadedCentreIds([]);
    setLoadedRange(null);
    setCalendarCentreFilter([]);
    setCalendarSelectedTeachers([]);
    setCalendarSelectedCourseLines([]);
    setCalendarSelectedRoles([]);
    setCalendarClassCodeSearch('');
    setAppliedCalendarClassCodeSearch('');
    setSearchTerm('');
    setDataLimit('all');
    setEndDateFrom('');
    setEndDateTo('');
    toolbarTeacherFilter.onTeacherClear();
    setClassStudentWorks([]);
    setClassStudentWorksLoading(false);
    setClassStudentWorksError(null);
    setStudentWorks([]);
    setStudentWorksLoading(false);
    setStudentWorksError(null);
    setClassQualityData(null);
    setClassQualityLoading(false);
    setSelectedSlot(null);
    setShowCoordinationPanel(false);
    setAvailableTeachers([]);
    setUnavailableTeachers([]);
    setCurrentWeekIndex(0);
    setCollapsedTimeSlots(new Set());
    clearCache(CACHE_KEYS.TEACHER_SCHEDULE).catch(console.error);
  }, [toolbarTeacherFilter]);

  const teacherProfilesById = useMemo(() => {
    return new Map(teacherProfiles.map(teacher => [teacher.id, teacher]));
  }, [teacherProfiles]);

  const loadCoordinationReferenceData = useCallback(async (requiredTeacherIds: string[] = []) => {
    let nextTeacherProfiles = teacherProfiles;
    let nextCentreRegionMap = centreRegionMap;

    const hasRequiredProfiles = (profiles: TeacherProfile[]) => {
      if (requiredTeacherIds.length === 0) return profiles.length > 0;
      const profileIds = new Set(profiles.map(teacher => teacher.id));
      return requiredTeacherIds.every(id => profileIds.has(id));
    };

    if (!hasRequiredProfiles(nextTeacherProfiles)) {
      const cachedTeachers = await getCache(CACHE_KEYS.TEACHERS);
      if (cachedTeachers?.teachers?.length && hasRequiredProfiles(cachedTeachers.teachers as TeacherProfile[])) {
        nextTeacherProfiles = cachedTeachers.teachers as TeacherProfile[];
      } else {
        const result = await getTeachers({ isActive: true });
        nextTeacherProfiles = result.data;
        await setCache(CACHE_KEYS.TEACHERS, {
          teachers: nextTeacherProfiles,
          timestamp: Date.now(),
        });
      }
      setTeacherProfiles(nextTeacherProfiles);
    }

    if (Object.keys(nextCentreRegionMap).length === 0) {
      const { data: regionsData, error: regionsError } = await supabase
        .from('regions')
        .select('id, name')
        .eq('is_active', true);

      if (regionsError) throw regionsError;

      const activeRegions = (regionsData || []) as Array<{ id: string; name: string }>;
      if (activeRegions.length > 0) {
        const { data: regionCentresData, error: regionCentresError } = await supabase
          .from('region_centres')
          .select('region_id, centre_id')
          .in('region_id', activeRegions.map(region => region.id));

        if (regionCentresError) throw regionCentresError;

        const regionsById = new Map(activeRegions.map(region => [region.id, region.name]));
        nextCentreRegionMap = {};
        (regionCentresData || []).forEach(item => {
          if (!item.centre_id || !item.region_id) return;
          const regionName = regionsById.get(item.region_id);
          if (!regionName) return;
          if (!nextCentreRegionMap[item.centre_id]) nextCentreRegionMap[item.centre_id] = [];
          nextCentreRegionMap[item.centre_id].push({ id: item.region_id, name: regionName });
        });
      } else {
        nextCentreRegionMap = {};
      }

      setCentreRegionMap(nextCentreRegionMap);
    }

    return {
      teacherProfilesById: new Map(nextTeacherProfiles.map(teacher => [teacher.id, teacher])),
      centreRegionMap: nextCentreRegionMap,
    };
  }, [centreRegionMap, teacherProfiles]);

  const enrichAvailableTeachersForRequest = useCallback((
    teachers: TeacherAvailability[],
    requestCentreId: string,
    referenceData?: { teacherProfilesById: Map<string, TeacherProfile>; centreRegionMap: CentreRegionMap },
  ) => {
    return enrichTeacherAvailabilityByRegion(
      teachers,
      referenceData?.teacherProfilesById || teacherProfilesById,
      referenceData?.centreRegionMap || centreRegionMap,
      requestCentreId,
    );
  }, [centreRegionMap, teacherProfilesById]);

  const sameCourseAvailableTeachersCount = useMemo(
    () => getSameCourseTeacherCount(availableTeachers),
    [availableTeachers],
  );

  // ── Data Fetching ───────────────────────────────────────────────────────────
  const loadData = useCallback(async (start: string, end: string) => {
    if ((start && !end) || (!start && end)) {
      addToast(MESSAGES.ERROR.DATE_RANGE_REQUIRED, 'error');
      return;
    }
    if (start && end && start > end) {
      addToast(MESSAGES.ERROR.DATE_RANGE_INVALID, 'error');
      return;
    }
    if ((endDateFrom && !endDateTo) || (!endDateFrom && endDateTo)) {
      addToast('Vui lòng chọn đủ khoảng Ngày kết thúc', 'error');
      return;
    }
    if (endDateFrom && endDateTo && endDateFrom > endDateTo) {
      addToast('Ngày bắt đầu phải trước ngày kết thúc', 'error');
      return;
    }
    if (abortRef.current) abortRef.current.abort();
    classSubmissions.cancelLoading();
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;

    setLoading(true);
    setProgress({ loaded: 0, total: 100 });
    const allStatusesSelected = isAllClassStatusesSelected(selectedClassStatuses, classStatusFilterOptions);
    const classStatuses = selectedClassStatuses.length > 0 && !allStatusesSelected
      ? [...selectedClassStatuses]
      : undefined;
    const shouldLoadClasses = scheduleTypeFilter !== 'TRIAL';
    const shouldLoadOfficeHours = scheduleTypeFilter !== 'CLASS';

    try {
      // Load centres if not loaded
      let _centres = centres;
      if (_centres.length === 0) {
        const cachedCentres = await getCache(CACHE_KEYS.CENTRES);
        if (cachedCentres?.centres) _centres = cachedCentres.centres;
        else _centres = await fetchAllCentres();
        setCentres(_centres);
        await setCache(CACHE_KEYS.CENTRES, { centres: _centres });
      }
      const centreIds = selectedCentres.length > 0
        ? [...selectedCentres]
        : _centres.map(centre => centre.id);
      const toolbarSelectedTeacher = toolbarTeacherFilter.selectedTeacherId
        ? {
            id: toolbarTeacherFilter.selectedTeacherId,
            fullName: toolbarTeacherFilter.selectedTeacherName,
            displayName: toolbarTeacherFilter.selectedTeacherName,
          }
        : null;
      setLoadedCentreIds(centreIds);
      setCalendarCentreFilter([]);

      // Note: Teachers are loaded on-demand in coordination panel, not here
      // to avoid API issues with empty search

      const hasDateRange = Boolean(start && end);
      const weekDateFrom = hasDateRange ? parseLocalDateInput(start) : new Date('1970-01-01T00:00:00.000Z');
      const weekDateTo = hasDateRange ? parseLocalDateInput(end, true) : new Date('2100-12-31T23:59:59.999Z');
      const visibleWeekStart = hasDateRange ? getWeekDates(weekDateFrom)[0] : weekDateFrom;
      const visibleWeekEnd = hasDateRange ? getWeekDates(weekDateTo)[6] : weekDateTo;
      visibleWeekStart.setHours(0, 0, 0, 0);
      visibleWeekEnd.setHours(23, 59, 59, 999);
      const toolbarHaveSlotIn = hasDateRange ? haveSlotInDateStringRangeToUtcRange(start, end) : undefined;
      const endDateRange = endDateFrom && endDateTo ? dateStringRangeToUtcRange(endDateFrom, endDateTo) : undefined;
      const qualityComparisonStart = hasDateRange ? new Date(weekDateFrom) : null;
      qualityComparisonStart?.setDate(qualityComparisonStart.getDate() - 7);
      const classHaveSlotIn = qualityComparisonStart
        ? haveSlotInDateStringRangeToUtcRange(formatLocalDateKey(qualityComparisonStart), end)
        : toolbarHaveSlotIn;

      let clsLoaded = 0, clsTotal = 0, ohLoaded = 0, ohTotal = 0;
      const refreshProgress = () => {
        const finalTotal = Math.max((clsTotal || 0) + (ohTotal || 0), 1);
        setProgress({ loaded: clsLoaded + ohLoaded, total: finalTotal });
      };

      // Start the enabled fetch streams simultaneously.
      const classesPromise = shouldLoadClasses
        ? fetchAllClasses(
            {
              ...(classHaveSlotIn ? { haveSlotIn: { from: classHaveSlotIn.from, to: classHaveSlotIn.to } } : {}),
              ...(endDateRange ? { endDateFrom: endDateRange.endDateFrom, endDateTo: endDateRange.endDateTo } : {}),
              ...(classStatuses ? { statusIn: classStatuses } : {}),
              ...(centreIds && centreIds.length > 0 ? { centres: centreIds } : {}),
              ...(toolbarTeacherFilter.selectedTeacherId ? { teacherSlot: [toolbarTeacherFilter.selectedTeacherId] } : {}),
              ...(classCodeSearch.trim() ? { search: classCodeSearch.trim() } : {}),
            },
            (loaded, total) => {
              clsLoaded = loaded;
              clsTotal = total || 0;
              refreshProgress();
            },
            signal,
            undefined,
            dataLimit !== 'all' ? Number(dataLimit) : undefined
          )
        : Promise.resolve([] as Class[]);

      const officeHoursPromise = shouldLoadOfficeHours
        ? fetchOfficeHours(
            {
              ...(toolbarHaveSlotIn ? { timeFrom: toolbarHaveSlotIn.from, timeTo: toolbarHaveSlotIn.to } : {}),
              ...(centreIds && centreIds.length > 0 ? { centreIn: centreIds } : {}),
              ...(toolbarTeacherFilter.selectedTeacherId ? { teacher: toolbarTeacherFilter.selectedTeacherId } : {}),
              ...(dataLimit !== 'all' ? { maxItems: Number(dataLimit) } : {}),
            },
            (loaded, total) => {
              ohLoaded = loaded;
              ohTotal = total || 0;
              refreshProgress();
            },
            signal
          )
        : Promise.resolve({ data: [], pagination: { type: 'OFFSET', total: 0 } });

      const commentAreasPromise = shouldLoadClasses
        ? fetchStudentCommentAreas(
            Array.from({ length: 30 }, (_, i) => String(i + 1)).concat('final'),
            signal
          ).catch(err => {
            console.warn('Unable to fetch student comment areas:', err);
            return [] as CommentAreaDef[];
          })
        : Promise.resolve([] as CommentAreaDef[]);

      // Fire them in parallel!
      const [scopedClasses, officeHoursResult, commentAreas] = await Promise.all([
        classesPromise,
        officeHoursPromise,
        commentAreasPromise
      ]);

      // Combine all pre-fetched data instantly to generate schedule models
      const { schedules: result, rawClasses: classes } = await fetchTeacherSchedules(
        weekDateFrom,
        weekDateTo,
        centreIds,
        toolbarTeacherFilter.selectedTeacherId ? [toolbarTeacherFilter.selectedTeacherId] : undefined,
        undefined, // CPU computation only, no network required
        signal,
        scopedClasses, // preFetchedClasses
        officeHoursResult.data // preFetchedOfficeHours
      );
      console.log(`[TeacherSchedule] Loaded ${scopedClasses.length} scoped classes and ${classes.length} filtered classes for week ${start} to ${end}`);
      if (classes.length > 0) {
        console.log(`[TeacherSchedule] Example class ${classes[0].name} has ${classes[0].slots?.length} slots`);
      }
      const renderedClassIds = new Set<string>();
      const renderedSlotsByClassId = new Map<string, number>();
      result.forEach(schedule => {
        schedule.slots.forEach(slot => {
          if (slot.type !== 'class' || !slot.classId) return;
          renderedClassIds.add(slot.classId);
          renderedSlotsByClassId.set(slot.classId, (renderedSlotsByClassId.get(slot.classId) || 0) + 1);
        });
      });
      const fetchedClassRows = classes.map(cls => ({
        id: cls.id,
        name: cls.name,
        status: cls.status,
        centre: cls.centre?.shortName,
        course: cls.course?.name,
        courseLine: cls.course?.courseLine?.name,
        operationMethod: cls.operationMethod?.name,
        slotsFromApi: cls.slots?.length || 0,
        teachersFromApi: cls.teachers?.filter(teacherSlot => teacherSlot.isActive).length || 0,
        renderedSlots: renderedSlotsByClassId.get(cls.id) || 0,
        rendered: renderedClassIds.has(cls.id),
      }));
      const dateFromMs = weekDateFrom.getTime();
      const dateToMs = weekDateTo.getTime();
      const missingRenderedClassSlotDetails = classes
        .filter(cls => !renderedClassIds.has(cls.id))
        .map(cls => ({
          id: cls.id,
          name: cls.name,
          status: cls.status,
          sessionHour: cls.sessionHour,
          slots: (cls.slots || []).map((slot, index) => {
            const normalized = getDiagnosticSessionDateTime(slot, cls.sessionHour);
            const inRequestedRange = Number.isFinite(normalized.startMs)
              && normalized.startMs >= dateFromMs
              && normalized.startMs <= dateToMs;
            return {
              index: index + 1,
              id: slot._id,
              rawDate: slot.date,
              rawStartTime: slot.startTime,
              rawEndTime: slot.endTime,
              rawSessionHour: slot.sessionHour,
              normalizedStartTime: normalized.startTime,
              normalizedEndTime: normalized.endTime,
              normalizedStartLocal: Number.isFinite(normalized.startMs) ? new Date(normalized.startMs).toLocaleString('vi-VN') : null,
              inRequestedRange,
              activeSlotTeachers: slot.teachers?.filter(teacherSlot => teacherSlot.isActive).length || 0,
            };
          }),
        }));
      const renderDiagnostics = {
        requestedRange: { start, end },
        requestedHaveSlotIn: toolbarHaveSlotIn,
        visibleWeekRange: {
          from: visibleWeekStart.toLocaleString('vi-VN'),
          to: visibleWeekEnd.toLocaleString('vi-VN'),
        },
        requestedRangeMs: { from: dateFromMs, to: dateToMs },
        requestedRangeLocal: {
          from: weekDateFrom.toLocaleString('vi-VN'),
          to: weekDateTo.toLocaleString('vi-VN'),
        },
        centres: centreIds,
        scheduleTypeFilter,
        selectedClassStatuses,
        loadedClassCount: scopedClasses.length,
        rawClassCount: classes.length,
        renderedClassCount: renderedClassIds.size,
        teacherScheduleCount: result.length,
        officeHourCount: officeHoursResult.data.length,
        missingRenderedClasses: fetchedClassRows.filter(row => !row.rendered),
        missingRenderedClassSlotDetails,
        fetchedClassRows,
        lmsFetch: typeof window !== 'undefined' ? (window as any).__lastLmsClassesFetch : undefined,
      };

      if (typeof window !== 'undefined') {
        (window as any).__teacherScheduleDiagnostics = renderDiagnostics;
      }
      if (process.env.NODE_ENV !== 'production') {
        console.log('[TeacherSchedule] Render diagnostic', renderDiagnostics);
        console.table(fetchedClassRows);
        console.log('[TeacherSchedule] Missing class slot details', missingRenderedClassSlotDetails);
      }

      if (!signal.aborted) {
        setLoadedRange({ from: start, to: end });
        setSchedules(result);
        setRawClasses(classes);
        setStudentCommentAreas(commentAreas);
        setClassQualityDateFrom(start);
        setClassQualityDateTo(end);
        await setCache(CACHE_KEYS.TEACHER_SCHEDULE, {
          version: TEACHER_SCHEDULE_CACHE_VERSION,
          schedules: result,
          rawClasses: classes,
          studentCommentAreas: commentAreas,
          dateFrom: start,
          dateTo: end,
          selectedCentres: selectedCentres || [],
          toolbarSelectedCentres: selectedCentres || [],
          selectedToolbarTeacher: toolbarSelectedTeacher,
          classCodeSearch,
          dataLimit,
          endDateFrom,
          endDateTo,
          loadedCentreIds: centreIds,
          calendarCentreFilter: [],
          calendarSelectedTeachers,
          calendarSelectedCourseLines,
          calendarSelectedRoles,
          selectedTeachers,
          selectedCourseLines,
          scheduleTypeFilter,
          selectedClassStatuses,
          exemptedSessions,
          exemptOneOnOneClasses,
          classQualityDateFrom: start,
          classQualityDateTo: end,
          holidayPeriods,
          timestamp: Date.now(),
        });
        await setCache(CACHE_KEYS.FILTER_STATE, {
          fromDate: start,
          toDate: end,
          selectedCentres: selectedCentres || [],
          timestamp: Date.now(),
        });
        addToast(`Tải thành công ${classes.length} lớp, render ${renderedClassIds.size} lớp (${result.length} giáo viên).`, 'success');
      }
    } catch (err: any) {
      if (!signal.aborted) {
        console.error(err);
        addToast(MESSAGES.ERROR.GENERIC, 'error');
      }
    } finally {
      if (!signal.aborted) {
        setLoading(false);
        setProgress({ loaded: 100, total: 100 });
      }
    }
  }, [centres, selectedCentres, calendarSelectedTeachers, calendarSelectedCourseLines, calendarSelectedRoles, selectedTeachers, selectedCourseLines, selectedClassStatuses, classStatusFilterOptions, scheduleTypeFilter, exemptedSessions, exemptOneOnOneClasses, holidayPeriods, addToast, classCodeSearch, dataLimit, endDateFrom, endDateTo, fromDate, toDate, toolbarTeacherFilter.selectedTeacherId, toolbarTeacherFilter.selectedTeacherName, classSubmissions.cancelLoading]);

  const handleCancelFetch = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      classSubmissions.cancelLoading();
      abortRef.current = null;
      setLoading(false);
      addToast(MESSAGES.LOADING.STOPPED, 'info');
    }
  };

  // ── Coordination handlers ───────────────────────────────────────────────────
  const handleCardClick = useCallback((slot: any) => {
    // Extract date and time from slot
    const slotDate = new Date(slot.startTime);
    const slotEndDate = new Date(slot.endTime);
    
    const dateStr = slotDate.toISOString().split('T')[0];
    const startTimeStr = slotDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
    const endTimeStr = slotEndDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
    
    // Store selected slot for display
    setSelectedSlot(slot);
    
    // Set coordination request for display/editing
    setCoordinationRequest({
      date: dateStr,
      startTime: startTimeStr,
      endTime: endTimeStr,
      centreId: slot.centreId,
    });
    
    // Clear previous results and show loading
    setAvailableTeachers([]);
    setCalculatingTeachers(true);
    setClassQualityData(null);
    setStudentWorks([]);
    setStudentWorksError(null);
    setCommentModalSessionIndex(null);
    setQualityTab('comments');
    setCoordinationCourseLineFilter([]);
    
    // Open modal immediately
    setShowCoordinationPanel(true);
    
    void (async () => {
      try {
        const available = calculateAvailableTeachers(
          schedules,
          dateStr,
          startTimeStr,
          endTimeStr,
          slot.centreId,
          slot.courseLine // Pass course line for matching
        );

        // Filter out the current teacher from suggestions
        const currentTeacherIds = getSlotTeacherIds(slot);
        const rawFilteredAvailable = available.filter(ta => !currentTeacherIds.has(ta.teacher.id));
        const referenceData = await loadCoordinationReferenceData(rawFilteredAvailable.map(ta => ta.teacher.id));
        const filteredAvailable = enrichAvailableTeachersForRequest(
          rawFilteredAvailable,
          slot.centreId,
          referenceData,
        );

        setAvailableTeachers(filteredAvailable);
        setUnavailableTeachers([]);

        // Show toast with result
        if (filteredAvailable.length > 0) {
          addToast(getAvailableTeachersToastMessage(filteredAvailable), 'success');
        } else {
          addToast(TEACHER_SCHEDULE_LABELS.NO_AVAILABLE_TEACHER_IN_RANGE, 'info');
        }
      } catch (error) {
        console.error('Error preparing teacher region data:', error);
        addToast('Không thể tải dữ liệu khu vực giáo viên', 'error');
      } finally {
        setCalculatingTeachers(false);
      }
    })();

    // Fetch full class quality data if this is a class slot
    if (slot.classId) {
      const existingAnalysis = analyzedClassesRef.current.find(a => a.cls.id === slot.classId);
      if (existingAnalysis) {
        setCommentModalSessionIndex(getSlotSessionIndex(existingAnalysis.cls, slot));
        setClassQualityData(applyQualityExemptionRules(
          analyzeClassQuality(existingAnalysis.cls, exemptedSessions, studentCommentAreas, {
            includeInactiveStudents: true,
          }),
          { exemptOneOnOneClasses, holidayPeriods },
        ));
        return;
      }

      const existingClass = rawClasses.find(c => c.id === slot.classId);
      if (existingClass) {
        setCommentModalSessionIndex(getSlotSessionIndex(existingClass, slot));
        setClassQualityData(applyQualityExemptionRules(
          analyzeClassQuality(existingClass, exemptedSessions, studentCommentAreas, {
            includeInactiveStudents: true,
          }),
          { exemptOneOnOneClasses, holidayPeriods },
        ));
      } else {
        setClassQualityLoading(true);
        fetchClassByIdFull(slot.classId)
          .then(cls => {
            if (cls) {
              setCommentModalSessionIndex(getSlotSessionIndex(cls, slot));
              setClassQualityData(applyQualityExemptionRules(
                analyzeClassQuality(cls, exemptedSessions, studentCommentAreas, {
                  includeInactiveStudents: true,
                }),
                { exemptOneOnOneClasses, holidayPeriods },
              ));
            }
          })
          .catch(err => console.error('Error fetching class quality:', err))
          .finally(() => setClassQualityLoading(false));
      }
    }
  }, [schedules, rawClasses, studentCommentAreas, exemptedSessions, exemptOneOnOneClasses, holidayPeriods, addToast, enrichAvailableTeachersForRequest, loadCoordinationReferenceData]);

  const handleSearchAvailableTeachers = useCallback(() => {
    if (!coordinationRequest.date || !coordinationRequest.centreId) {
      addToast('Vui lòng chọn ngày và cơ sở', 'info');
      return;
    }

    setCalculatingTeachers(true);
    
    void (async () => {
      try {
        const available = calculateAvailableTeachers(
          schedules,
          coordinationRequest.date,
          coordinationRequest.startTime,
          coordinationRequest.endTime,
          coordinationRequest.centreId,
          coordinationRequest.courseLineId // Pass course line for matching
        );

        // If there's a selected slot, filter out its teacher
        const selectedSlotTeacherIds = selectedSlot ? getSlotTeacherIds(selectedSlot) : new Set<string>();
        const filteredAvailable = selectedSlot
          ? available.filter(ta => !selectedSlotTeacherIds.has(ta.teacher.id))
          : available;
        const referenceData = await loadCoordinationReferenceData(filteredAvailable.map(ta => ta.teacher.id));
        const enrichedAvailable = enrichAvailableTeachersForRequest(
          filteredAvailable,
          coordinationRequest.centreId,
          referenceData,
        );

        setAvailableTeachers(enrichedAvailable);
        setUnavailableTeachers([]);

        if (enrichedAvailable.length > 0) {
          addToast(getAvailableTeachersToastMessage(enrichedAvailable), 'success');
        } else {
          addToast(TEACHER_SCHEDULE_LABELS.NO_AVAILABLE_TEACHER_IN_RANGE, 'info');
        }
      } catch (error) {
        console.error('Error preparing teacher region data:', error);
        addToast('Không thể tải dữ liệu khu vực giáo viên', 'error');
      } finally {
        setCalculatingTeachers(false);
      }
    })();
  }, [coordinationRequest, schedules, selectedSlot, addToast, enrichAvailableTeachersForRequest, loadCoordinationReferenceData]);

  const reloadClassSchedule = useCallback(async (
    classId: string,
    options: { showToast?: boolean; refreshAvailableTeachers?: boolean } = {},
  ): Promise<TeacherSchedule[]> => {
    const { showToast = true, refreshAvailableTeachers = true } = options;

    try {
      setReloadingClassId(classId);
      const classSchedules = await fetchClassTeacherSchedules(classId);
      const nextSchedules = replaceClassSlotsInSchedules(schedules, classId, classSchedules);

      setSchedules(nextSchedules);
      await setCache(CACHE_KEYS.TEACHER_SCHEDULE, {
        schedules: nextSchedules,
        rawClasses,
        studentCommentAreas,
        dateFrom: fromDate,
        dateTo: toDate,
        selectedCentres,
        selectedTeachers,
        selectedCourseLines,
        scheduleTypeFilter,
        selectedClassStatuses,
        exemptedSessions,
        exemptOneOnOneClasses,
        classQualityDateFrom,
        classQualityDateTo,
        holidayPeriods,
        timestamp: Date.now(),
      });

      if (refreshAvailableTeachers && selectedSlot) {
        const slotDate = new Date(selectedSlot.startTime).toISOString().split('T')[0];
        const startTimeStr = new Date(selectedSlot.startTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
        const endTimeStr = new Date(selectedSlot.endTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
        const available = calculateAvailableTeachers(
          nextSchedules,
          slotDate,
          startTimeStr,
          endTimeStr,
          selectedSlot.centreId,
          selectedSlot.courseLine,
        ).filter(ta => !getSlotTeacherIds(selectedSlot).has(ta.teacher.id));
        const referenceData = await loadCoordinationReferenceData(available.map(ta => ta.teacher.id));

        setAvailableTeachers(enrichAvailableTeachersForRequest(available, selectedSlot.centreId, referenceData));
        setUnavailableTeachers([]);
      }

      if (showToast) addToast('Đã cập nhật dữ liệu lớp', 'success');
      return nextSchedules;
    } catch (error) {
      console.error('Error reloading class schedule:', error);
      addToast(
        error instanceof Error ? error.message : 'Không thể cập nhật dữ liệu lớp',
        'error',
      );
      throw error;
    } finally {
      setReloadingClassId(null);
    }
  }, [addToast, schedules, rawClasses, studentCommentAreas, fromDate, toDate, selectedCentres, selectedSlot, selectedTeachers, selectedCourseLines, selectedClassStatuses, scheduleTypeFilter, exemptedSessions, exemptOneOnOneClasses, classQualityDateFrom, classQualityDateTo, holidayPeriods, enrichAvailableTeachersForRequest, loadCoordinationReferenceData]);

  const handleAddSupplyTeacher = useCallback(async (ta: TeacherAvailability) => {
    if (!selectedSlot) return;
    if (selectedSlot.type !== 'class') {
      addToast('Chỉ có thể thêm giáo viên vào buổi học của lớp', 'info');
      return;
    }
    if (!selectedSlot.classId || !selectedSlot.sessionId || !selectedSlot.className) {
      addToast('Thiếu thông tin lớp hoặc buổi học để thêm giáo viên', 'error');
      return;
    }

    try {
      setAddingSupplyTeacherId(ta.teacher.id);
      addToast(TEACHER_SCHEDULE_LABELS.ADDING_TEACHER_TO_CLASS, 'info');

      const blockingSlot = findTeacherBlockingSlot(
        schedules,
        ta.teacher.id,
        selectedSlot.startTime,
        selectedSlot.endTime,
      );

      if (blockingSlot) {
        const roleLabel = blockingSlot.roleShortName || blockingSlot.roleName || 'vai trò khác';
        addToast(
          `${ta.teacher.fullName || ta.teacher.username} đang bận ở ${blockingSlot.className || 'lớp khác'} (${roleLabel})`,
          'error',
        );
        return;
      }

      await addSupplyTeacherToSession({
        classId: selectedSlot.classId,
        className: selectedSlot.className,
        classSiteId: selectedSlot.classSiteId,
        centreId: selectedSlot.centreId,
        sessionId: selectedSlot.sessionId,
        sessionStartTime: selectedSlot.startTime,
        sessionEndTime: selectedSlot.endTime,
        teacherId: ta.teacher.id,
        teacherName: ta.teacher.fullName || ta.teacher.username,
        teacherHandleScore: 7,
        teacherPrimaryCenters: [selectedSlot.centreId],
      });

      addToast(`Đã thêm ${ta.teacher.fullName || ta.teacher.username} vào lớp với vai trò SUPPLY`, 'success');
      setAddingSupplyTeacherId(null);
      await reloadClassSchedule(selectedSlot.classId, { showToast: false, refreshAvailableTeachers: true });
    } catch (error) {
      console.error('Error adding supply teacher:', error);
      addToast(
        error instanceof Error ? error.message : 'Không thể thêm giáo viên',
        'error',
      );
    } finally {
      setAddingSupplyTeacherId(null);
    }
  }, [addToast, reloadClassSchedule, schedules, selectedSlot]);

  // ── Hydration + Auto-fetch ──────────────────────────────────────────────────
  useEffect(() => {
    const s = loadSession();
    if (!s) return;
    setSession(s);

    (async () => {
      try {
        const cachedCentres = await getCache(CACHE_KEYS.CENTRES);
        if (cachedCentres?.centres?.length) {
          setCentres(cachedCentres.centres);
        } else {
          const freshCentres = await fetchAllCentres();
          setCentres(freshCentres);
          await setCache(CACHE_KEYS.CENTRES, { centres: freshCentres });
        }

        const statusConfigs = await fetchClassStatusConfigs().catch(error => {
          console.error('Error fetching class status configs:', error);
          return [];
        });
        const statusOptions = buildClassStatusFilterOptionsFromConfig(statusConfigs);
        if (statusOptions.length > 0) setClassStatusFilterOptions(statusOptions);

        const cached = await getCache(CACHE_KEYS.TEACHER_SCHEDULE);
        const cachedClassQuality = await getCache(CACHE_KEYS.CLASS_QUALITY);
        let hydratedRawClasses = false;
        if (cached?.version === TEACHER_SCHEDULE_CACHE_VERSION) {
          if (cached.selectedTeachers) setSelectedTeachers(cached.selectedTeachers);
          if (cached.selectedCourseLines) setSelectedCourseLines(cached.selectedCourseLines);
          if (cached.loadedCentreIds) setLoadedCentreIds(cached.loadedCentreIds);
          if (typeof cached.dateFrom === 'string') setFromDate(cached.dateFrom);
          if (typeof cached.dateTo === 'string') setToDate(cached.dateTo);
          if (Array.isArray(cached.toolbarSelectedCentres)) setSelectedCentres(cached.toolbarSelectedCentres);
          if (typeof cached.classCodeSearch === 'string') setClassCodeSearch(cached.classCodeSearch);
          if (cached.dataLimit) setDataLimit(cached.dataLimit as DataLimitValue);
          if (typeof cached.endDateFrom === 'string') setEndDateFrom(cached.endDateFrom);
          if (typeof cached.endDateTo === 'string') setEndDateTo(cached.endDateTo);
          if (cached.selectedToolbarTeacher?.id) {
            toolbarTeacherFilter.hydrateSelectedTeacher(cached.selectedToolbarTeacher);
          }
          if (cached.calendarCentreFilter) setCalendarCentreFilter(cached.calendarCentreFilter);
          if (cached.calendarSelectedTeachers) setCalendarSelectedTeachers(cached.calendarSelectedTeachers);
          if (cached.calendarSelectedCourseLines) setCalendarSelectedCourseLines(cached.calendarSelectedCourseLines);
          if (cached.calendarSelectedRoles) setCalendarSelectedRoles(cached.calendarSelectedRoles);
          if (cached.scheduleTypeFilter) setScheduleTypeFilter(cached.scheduleTypeFilter);
          if (cached.selectedClassStatuses) setSelectedClassStatuses(cached.selectedClassStatuses as ClassStatusFilter[]);
          if (cached.exemptedSessions) setExemptedSessions(cached.exemptedSessions);
          if (cached.exemptOneOnOneClasses !== undefined) setExemptOneOnOneClasses(cached.exemptOneOnOneClasses);
          if (typeof cached.classQualityDateFrom === 'string') setClassQualityDateFrom(cached.classQualityDateFrom);
          else if (typeof cached.dateFrom === 'string') setClassQualityDateFrom(cached.dateFrom);
          if (typeof cached.classQualityDateTo === 'string') setClassQualityDateTo(cached.classQualityDateTo);
          else if (typeof cached.dateTo === 'string') setClassQualityDateTo(cached.dateTo);
          if (cached.holidayPeriods) setHolidayPeriods(mergeHolidayPeriods(cached.holidayPeriods));
          if (cached.loadedRange) setLoadedRange(cached.loadedRange);
          if (cached.schedules) setSchedules(cached.schedules);
          if (cached.rawClasses?.length) {
            setRawClasses(cached.rawClasses);
            hydratedRawClasses = true;
          }
          if (cached.studentCommentAreas) {
            setStudentCommentAreas(cached.studentCommentAreas);
          } else {
            const commentAreas = await fetchStudentCommentAreas(
              Array.from({ length: 30 }, (_, i) => String(i + 1)).concat('final')
            ).catch(() => [] as CommentAreaDef[]);
            setStudentCommentAreas(commentAreas);
          }
        }

        if (!hydratedRawClasses && cachedClassQuality?.classes?.length) {
          setRawClasses(cachedClassQuality.classes);
        }
      } catch (e) {
        console.error('State parse error', e);
      } finally {
        setIsHydrated(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    if (loading) return;
    
    // Only save if we have data or if it's a clear state
    // This prevents overwriting the cache with empty arrays during initial hydration
    if (schedules.length === 0 && rawClasses.length === 0 && loadedCentreIds.length === 0) return;

    setCache(CACHE_KEYS.TEACHER_SCHEDULE, {
      version: TEACHER_SCHEDULE_CACHE_VERSION,
      schedules,
      rawClasses,
      studentCommentAreas,
      dateFrom: loadedRange?.from || fromDate,
      dateTo: loadedRange?.to || toDate,
      loadedCentreIds,
      ...cacheFilterStateRef.current,
      loadedRange,
      timestamp: Date.now(),
    }).catch(console.error);
  }, [loading, schedules, rawClasses, studentCommentAreas, loadedCentreIds, isHydrated, loadedRange, fromDate, toDate]);

  // ── Derived Data ────────────────────────────────────────────────────────────
  // No longer need centreOptions - using CentreSelect component

  const tableCentreIds = useMemo(() => {
    const ids = new Set<string>();
    schedules.forEach(schedule => {
      schedule.slots.forEach(slot => {
        if (slot.centreId) ids.add(slot.centreId);
      });
    });
    return Array.from(ids);
  }, [schedules]);

  const calendarFilterCentreIds = useMemo(() => (
    loadedCentreIds.length > 0 ? loadedCentreIds : tableCentreIds
  ), [loadedCentreIds, tableCentreIds]);

  // Course line options for filtering
  const courseLineOptions: SelectOption[] = useMemo(() => {
    return COURSES.map(course => ({ value: course, label: course }));
  }, []);

  const calendarRoleTeacherIds = useMemo(() => (
    calendarSelectedTeachers.length > 0
      ? calendarSelectedTeachers
      : toolbarTeacherFilter.selectedTeacherId
        ? [toolbarTeacherFilter.selectedTeacherId]
        : undefined
  ), [calendarSelectedTeachers, toolbarTeacherFilter.selectedTeacherId]);

  const roleOptions: SelectOption[] = useMemo(() => {
    const roles = new Map<string, string>();

    schedules.forEach(schedule => {
      schedule.slots.forEach(slot => {
        const slotTeacherRoles = calendarRoleTeacherIds && calendarRoleTeacherIds.length > 0
          ? calendarRoleTeacherIds.flatMap(teacherId => getSlotTeacherRoles(slot, teacherId))
          : getSlotTeacherRoles(slot);

        slotTeacherRoles.forEach(label => {
          roles.set(label.toUpperCase(), label);
        });
      });
    });

    return Array.from(roles.values()).sort().map(role => ({ value: role, label: role }));
  }, [schedules, calendarRoleTeacherIds]);

  // Generate teacher options from schedules data
  const teacherOptions: SelectOption[] = useMemo(() => {
    const uniqueTeachers = new Map<string, Teacher>();
    schedules.forEach(schedule => {
      uniqueTeachers.set(schedule.teacher.id, schedule.teacher);
    });
    return Array.from(uniqueTeachers.values()).map(t => ({ 
      value: t.id, 
      label: t.fullName || t.username, 
      searchTerms: [t.fullName, t.username, t.email].filter(Boolean)
    })).sort((a, b) => a.label.localeCompare(b.label));
  }, [schedules]);

  // ── Filtered Schedules for Calendar ────────────────────────────────────────
  const filteredSchedulesForCalendar = useMemo(() => {
    const classCodeQuery = deferredAppliedCalendarClassCodeSearch.toLowerCase();
    const allStatusesSelected = isAllClassStatusesSelected(deferredSelectedClassStatuses, classStatusFilterOptions);
    const selectedStatusSet = new Set(deferredSelectedClassStatuses.map(normalizeStatus));

    return schedules.map(schedule => {
      const filteredSlots = schedule.slots.filter(slot => {
        if (classCodeQuery) {
          const classSearchText = [
            slot.className,
            slot.classId,
            slot.classSiteId,
          ].filter(Boolean).join(' ').toLowerCase();
          if (!classSearchText.includes(classCodeQuery)) return false;
        }
        if (deferredCalendarCentreFilter.length > 0 && !deferredCalendarCentreFilter.includes(slot.centreId)) return false;
        if (deferredCalendarSelectedCourseLines.length > 0) {
          const category = getCourseLineCategory(slot.courseLine, slot.className);
          if (!deferredCalendarSelectedCourseLines.includes(category)) return false;
        }
        if (calendarSelectedRoles.length > 0) {
          const slotRoles = calendarRoleTeacherIds && calendarRoleTeacherIds.length > 0
            ? calendarRoleTeacherIds.flatMap(teacherId => getSlotTeacherRoles(slot, teacherId))
            : getSlotTeacherRoles(slot);
          if (!slotRoles.some(role => calendarSelectedRoles.includes(role))) return false;
        }
        if (deferredScheduleTypeFilter === 'CLASS' && slot.type !== 'class') return false;
        if (deferredScheduleTypeFilter === 'TRIAL' && slot.type !== 'office-hour') return false;
        if (
          slot.type === 'class'
          && selectedStatusSet.size > 0
          && !allStatusesSelected
          && !selectedStatusSet.has(normalizeStatus(slot.status))
        ) return false;
        return true;
      });
      
      return { ...schedule, slots: filteredSlots };
    }).filter(schedule => {
      if (schedule.slots.length === 0) return false;
      if (deferredCalendarSelectedTeachers.length > 0 && !deferredCalendarSelectedTeachers.includes(schedule.teacher.id)) return false;
      return true;
    });
  }, [schedules, deferredCalendarCentreFilter, deferredCalendarSelectedTeachers, deferredCalendarSelectedCourseLines, calendarSelectedRoles, calendarRoleTeacherIds, deferredSelectedClassStatuses, classStatusFilterOptions, deferredScheduleTypeFilter, deferredAppliedCalendarClassCodeSearch]);

  // ── Analyzed Classes for Quality Table ───────────────────────────────────────
  const analyzedClasses = useMemo(() => {
    return rawClasses.map(cls => applyQualityExemptionRules(
      analyzeClassQuality(cls, exemptedSessions, studentCommentAreas),
      { exemptOneOnOneClasses, holidayPeriods },
    ));
  }, [rawClasses, studentCommentAreas, exemptedSessions, exemptOneOnOneClasses, holidayPeriods]);

  const classQualityDateRangeBounds = useMemo(() => (
    getClassQualityDateRangeBounds(deferredClassQualityDateFrom, deferredClassQualityDateTo)
  ), [deferredClassQualityDateFrom, deferredClassQualityDateTo]);

  const classQualityTableClasses = useMemo(() => {
    const classesInRange = rawClasses.filter(cls =>
      classHasSlotInDateRange(cls, classQualityDateRangeBounds)
    );

    return classesInRange.map(cls => applyQualityExemptionRules(
      analyzeClassQuality(cls, exemptedSessions, studentCommentAreas, {
        commentDateRange: {
          dateFrom: deferredClassQualityDateFrom,
          dateTo: deferredClassQualityDateTo,
        },
      }),
      { exemptOneOnOneClasses, holidayPeriods },
    ));
  }, [rawClasses, studentCommentAreas, exemptedSessions, exemptOneOnOneClasses, holidayPeriods, deferredClassQualityDateFrom, deferredClassQualityDateTo, classQualityDateRangeBounds]);

  useEffect(() => {
    analyzedClassesRef.current = analyzedClasses;
  }, [analyzedClasses]);

  const selectedSlotClassId = selectedSlot?.classId || null;
  const selectedSlotSessionId = selectedSlot?.sessionId || null;
  const selectedSlotSessionNumber = selectedSlot?.sessionNumber || 0;
  const selectedSlotStartTime = selectedSlot?.startTime || undefined;

  const selectedClassForModal = useMemo(() => {
    if (!selectedSlotClassId) return null;
    if (classQualityData && classQualityData.cls.id === selectedSlotClassId) return classQualityData.cls;
    return rawClasses.find(cls => cls.id === selectedSlotClassId) || null;
  }, [classQualityData, rawClasses, selectedSlotClassId]);

  const finalProductSession = useMemo(() => {
    return getFinalClassSession(selectedClassForModal) || (
      selectedSlotSessionId
        ? {
          id: selectedSlotSessionId,
          sessionNumber: selectedSlotSessionNumber,
          date: selectedSlotStartTime,
        }
        : null
    );
  }, [selectedClassForModal, selectedSlotSessionId, selectedSlotSessionNumber, selectedSlotStartTime]);

  useEffect(() => {
    if (!selectedSlotClassId || !showCoordinationPanel) return;

    const controller = new AbortController();
    const resetLoading = window.setTimeout(() => {
      setStudentWorksLoading(true);
      setStudentWorksError(null);
    }, 0);

    fetchStudentWorks({
      classConfigs: [{
        classId: selectedSlotClassId,
        classSessionId: finalProductSession?.id,
      }],
    }, controller.signal)
      .then(setStudentWorks)
      .catch(error => {
        if (controller.signal.aborted) return;
        console.error('Error fetching student works:', error);
        setStudentWorks([]);
        setStudentWorksError(error instanceof Error ? error.message : 'Không thể tải dữ liệu sản phẩm cuối khóa');
      })
      .finally(() => {
        if (!controller.signal.aborted) setStudentWorksLoading(false);
      });

    return () => {
      window.clearTimeout(resetLoading);
      controller.abort();
    };
  }, [finalProductSession?.id, selectedSlotClassId, showCoordinationPanel]);

  useEffect(() => {
    if (rawClasses.length === 0) {
      setClassStudentWorks([]);
      setClassStudentWorksError(null);
      return;
    }

    const controller = new AbortController();
    const classConfigs = rawClasses
      .map(cls => ({
        classId: cls.id,
        classSessionId: getFinalClassSession(cls)?.id,
      }))
      .filter(config => Boolean(config.classId));
    const loadingTimer = window.setTimeout(() => setClassStudentWorksLoading(true), 0);
    setClassStudentWorksError(null);

    fetchStudentWorks({ classConfigs }, controller.signal)
      .then(setClassStudentWorks)
      .catch(error => {
        if (controller.signal.aborted) return;
        console.error('Error fetching class student works:', error);
        setClassStudentWorks([]);
        setClassStudentWorksError(error instanceof Error ? error.message : 'Không thể tải dữ liệu sản phẩm cuối khoá');
      })
      .finally(() => {
        if (!controller.signal.aborted) setClassStudentWorksLoading(false);
      });

    return () => {
      window.clearTimeout(loadingTimer);
      controller.abort();
    };
  }, [classStudentWorksReloadKey, rawClasses]);

  const finalProductStatsByClassId = useMemo(() => {
    const worksByClass = new Map<string, StudentWork[]>();
    classStudentWorks.forEach(work => {
      if (!work.classId) return;
      const works = worksByClass.get(work.classId) || [];
      works.push(work);
      worksByClass.set(work.classId, works);
    });

    const stats = new Map<string, FinalProductClassStats>();
    rawClasses.forEach(cls => {
      stats.set(cls.id, buildFinalProductClassStats(cls, worksByClass.get(cls.id) || []));
    });
    return stats;
  }, [classStudentWorks, rawClasses]);

  const normalQualityClasses = useMemo(() => {
    return classQualityTableClasses.filter(a => {
      const status = a.cls.status?.toUpperCase() || '';
      return status !== 'ABANDONED' && status !== 'REJECTED';
    });
  }, [classQualityTableClasses]);

  const summaryCentreOptions = useMemo(() => {
    const centresByName = new Set<string>();
    normalQualityClasses.forEach(a => {
      const centreName = a.cls.centre?.shortName;
      if (centreName) centresByName.add(centreName);
    });

    return [
      { id: 'all', shortName: 'Tất cả', name: 'Tất cả cơ sở', isActive: true },
      ...Array.from(centresByName).sort().map(name => ({ id: name, shortName: name, name, isActive: true })),
    ] as Centre[];
  }, [normalQualityClasses]);

  const summaryCentreSelectOptions = useMemo<SelectOption[]>(() => {
    return summaryCentreOptions
      .filter(centre => centre.id !== 'all')
      .map(centre => ({
        value: centre.id,
        label: `${centre.shortName} – ${centre.name}`,
        searchTerms: [centre.shortName, centre.name],
      }));
  }, [summaryCentreOptions]);

  const summaryFilteredClasses = useMemo(() => {
    const statusFiltered = summaryStatusFilter.length === 0
      ? normalQualityClasses
      : normalQualityClasses.filter(a => summaryStatusFilter.includes(a.cls.status?.toUpperCase() || ''));

    if (!selectedSummaryCentre || selectedSummaryCentre === 'all') return statusFiltered;
    return statusFiltered.filter(a => a.cls.centre?.shortName === selectedSummaryCentre);
  }, [normalQualityClasses, selectedSummaryCentre, summaryStatusFilter]);

  const selectedCentreData = useMemo(() => {
    let cp1Total = 0, cp1Pass = 0, cp1Sum = 0;
    let cp2Total = 0, cp2Pass = 0, cp2Sum = 0;
    let demoTotal = 0, demoSum = 0, demoGood = 0, demoMedium = 0, demoPoor = 0;
    let rankA = 0, rankB = 0, rankC = 0, rankD = 0, totalWithTBCK = 0;
    let classesWithCommentIssues = 0, classesWithAttendanceAlerts = 0, classesWithRescheduling = 0;
    let totalRescheduledSessions = 0, totalSessions = 0;

    summaryFilteredClasses.forEach(a => {
      if (a.cp1Analysis.studentsWithScores > 0) {
        cp1Total += a.cp1Analysis.studentsWithScores;
        cp1Pass += a.cp1Analysis.passCount;
        if (a.cp1Analysis.averageScore !== null) cp1Sum += a.cp1Analysis.averageScore * a.cp1Analysis.studentsWithScores;
      }
      if (a.cp2Analysis.studentsWithScores > 0) {
        cp2Total += a.cp2Analysis.studentsWithScores;
        cp2Pass += a.cp2Analysis.passCount;
        if (a.cp2Analysis.averageScore !== null) cp2Sum += a.cp2Analysis.averageScore * a.cp2Analysis.studentsWithScores;
      }
      if (a.demoAnalysis.studentsWithScores > 0) {
        demoTotal += a.demoAnalysis.studentsWithScores;
        if (a.demoAnalysis.averageScore !== null) demoSum += a.demoAnalysis.averageScore * a.demoAnalysis.studentsWithScores;
        demoGood += a.demoAnalysis.goodCount;
        demoMedium += a.demoAnalysis.averageCount;
        demoPoor += a.demoAnalysis.poorCount;
      }

      const studentScores = new Map<string, { cp1?: number; cp2?: number; demo?: number }>();
      a.cp1Analysis.students.forEach((student: any) => {
        if (student.checkpointScore !== null) studentScores.set(student.studentId, { ...(studentScores.get(student.studentId) || {}), cp1: student.checkpointScore });
      });
      a.cp2Analysis.students.forEach((student: any) => {
        if (student.checkpointScore !== null) studentScores.set(student.studentId, { ...(studentScores.get(student.studentId) || {}), cp2: student.checkpointScore });
      });
      a.demoAnalysis.students.forEach((student: any) => {
        if (student.demoScore !== null) studentScores.set(student.studentId, { ...(studentScores.get(student.studentId) || {}), demo: student.demoScore });
      });
      studentScores.forEach(scores => {
        const tbck = computeTBCK(scores.cp1 ?? null, scores.cp2 ?? null, scores.demo ?? null);
        if (tbck === null) return;
        totalWithTBCK++;
        const { rank } = determineRank(tbck, scores.demo ?? null);
        if (rank === 'A') rankA++;
        else if (rank === 'B') rankB++;
        else if (rank === 'C') rankC++;
        else if (rank === 'D') rankD++;
      });

      const commentIssues = a.commentAnalysis.customBriefCount + a.commentAnalysis.customDuplicateCount + a.commentAnalysis.customOverdueCount;
      if (commentIssues > 0) classesWithCommentIssues++;
      if (a.attendanceAnalysis.totalAlerts > 0) classesWithAttendanceAlerts++;
      if (a.reschedulingAnalysis.rescheduledSessions > 0) classesWithRescheduling++;
      totalRescheduledSessions += a.reschedulingAnalysis.rescheduledSessions;
      totalSessions += a.reschedulingAnalysis.totalSessions;
    });

    return {
      name: selectedSummaryCentre === 'all' ? 'Tất cả cơ sở' : selectedSummaryCentre,
      cp1PassRate: cp1Total > 0 ? (cp1Pass / cp1Total) * 100 : 0,
      cp1AverageScore: cp1Total > 0 ? cp1Sum / cp1Total : 0,
      cp1TotalStudents: cp1Total,
      cp1PassCount: cp1Pass,
      cp2PassRate: cp2Total > 0 ? (cp2Pass / cp2Total) * 100 : 0,
      cp2AverageScore: cp2Total > 0 ? cp2Sum / cp2Total : 0,
      cp2TotalStudents: cp2Total,
      cp2PassCount: cp2Pass,
      demoPassRate: demoTotal > 0 ? ((demoGood + demoMedium) / demoTotal) * 100 : 0,
      demoAverageScore: demoTotal > 0 ? demoSum / demoTotal : 0,
      demoTotalStudents: demoTotal,
      demoGoodCount: demoGood,
      demoMediumCount: demoMedium,
      demoPoorCount: demoPoor,
      rankACount: rankA,
      rankBCount: rankB,
      rankCCount: rankC,
      rankDCount: rankD,
      totalStudentsWithTBCK: totalWithTBCK,
      reschedulingRate: totalSessions > 0 ? (totalRescheduledSessions / totalSessions) * 100 : 0,
      classesWithCommentIssues,
      classesWithAttendanceAlerts,
      classesWithRescheduling,
      totalClasses: summaryFilteredClasses.length,
    };
  }, [selectedSummaryCentre, summaryFilteredClasses]);

  const maxQualitySessions = useMemo(() => {
    if (rawClasses.length === 0) return 14;
    return Math.max(...rawClasses.map(cls => cls.numberOfSessions || cls.slots?.length || 14));
  }, [rawClasses]);

  // ── Calendar View Data ──────────────────────────────────────────────────────

  const loadedSlotDateRange = useMemo(() => {
    let minMs = Infinity;
    let maxMs = -Infinity;

    schedules.forEach(schedule => {
      schedule.slots.forEach(slot => {
        const startMs = new Date(slot.startTime).getTime();
        if (!Number.isFinite(startMs)) return;
        minMs = Math.min(minMs, startMs);
        maxMs = Math.max(maxMs, startMs);
      });
    });

    if (!Number.isFinite(minMs) || !Number.isFinite(maxMs)) return null;

    return {
      from: formatLocalDateKey(new Date(minMs)),
      to: formatLocalDateKey(new Date(maxMs)),
    };
  }, [schedules]);
  
  const allWeeks = useMemo(() => {
    const explicitRange = loadedRange?.from && loadedRange?.to
      ? loadedRange
      : fromDate && toDate
        ? { from: fromDate, to: toDate }
        : null;
    const derivedRange = explicitRange || loadedSlotDateRange;
    if (!derivedRange?.from || !derivedRange?.to) return [getWeekDates(new Date())];
    
    const weeks: Date[][] = [];
    const start = parseLocalDateInput(derivedRange.from);
    const end = parseLocalDateInput(derivedRange.to, true);
    const current = new Date(start);
    const day = current.getDay();
    const diff = current.getDate() - day + (day === 0 ? -6 : 1);
    current.setDate(diff);
    
    while (current <= end) {
      const weekDates = getWeekDates(current);
      weeks.push(weekDates);
      current.setDate(current.getDate() + 7);
    }
    return weeks;
  }, [loadedRange, fromDate, toDate, loadedSlotDateRange]);
  
  useEffect(() => {
    setCurrentWeekIndex(currentIndex => {
      if (allWeeks.length === 0) return 0;
      const today = new Date();
      const todayIndex = allWeeks.findIndex(week => {
        const start = new Date(week[0]);
        const end = new Date(week[6]);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        return today >= start && today <= end;
      });
      if (todayIndex >= 0) return todayIndex;
      return Math.min(currentIndex, allWeeks.length - 1);
    });
  }, [allWeeks]);

  const dynamicTimeSlots = useMemo(() => {
    const timeRangeSet = new Set<string>();
    if (allWeeks.length === 0 || !allWeeks[currentWeekIndex]) return TIME_SLOTS;
    
    const currentWeekDates = allWeeks[currentWeekIndex];
    const weekStart = new Date(currentWeekDates[0]);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(currentWeekDates[6]);
    weekEnd.setHours(23, 59, 59, 999);
    
    filteredSchedulesForCalendar.forEach(schedule => {
      schedule.slots.forEach((slot: any) => {
        const start = new Date(slot.startTime);
        if (start < weekStart || start > weekEnd) return;
        const startStr = FORMAT.time(new Date(slot.startTime));
        const endStr = FORMAT.time(new Date(slot.endTime));
        timeRangeSet.add(`${startStr} - ${endStr}`);
      });
    });
    
    const slots = Array.from(timeRangeSet)
      .sort((a, b) => {
        const [aStart] = a.split(' - ');
        const [bStart] = b.split(' - ');
        const [aH, aM] = aStart.split(':').map(Number);
        const [bH, bM] = bStart.split(':').map(Number);
        if (aH !== bH) return aH - bH;
        if (aM !== bM) return aM - bM;
        const [aEnd] = a.split(' - ').slice(1);
        const [bEnd] = b.split(' - ').slice(1);
        const [aeH, aeM] = aEnd.split(':').map(Number);
        const [beH, beM] = bEnd.split(':').map(Number);
        if (aeH !== beH) return aeH - beH;
        return aeM - beM;
      })
      .map(time => {
        const [startStr] = time.split(' - ');
        const [h] = startStr.split(':').map(Number);
        let label = 'Sáng';
        if (h >= 13 && h < 18) label = 'Chiều';
        else if (h >= 18) label = 'Tối';
        return { time, label };
      });
    
    return slots.length > 0 ? slots : TIME_SLOTS;
  }, [filteredSchedulesForCalendar, allWeeks, currentWeekIndex]);

  const stats = useMemo(() => {
    const totalTeachers = schedules.filter(schedule => schedule.teacher.id !== UNASSIGNED_TEACHER_ID).length;
    const totalSlots = schedules.reduce((sum, schedule) => sum + schedule.slots.length, 0);
    const avgSlotsPerTeacher = totalTeachers > 0 ? (totalSlots / totalTeachers).toFixed(1) : '0';
    return { totalTeachers, totalSlots, avgSlotsPerTeacher };
  }, [schedules]);
  
  const calendarData = useMemo(() => {
    if (allWeeks.length === 0) return [];
    const weekDates = allWeeks[currentWeekIndex] || allWeeks[0];
    return weekDates.map(date => {
      const dateStr = formatLocalDateKey(date);
      const dayOfWeek = DAYS_OF_WEEK[date.getDay()];
      return {
        date: dateStr,
        dayOfWeek,
        dayLabel: `${dayOfWeek} ${date.getDate()}/${date.getMonth() + 1}`,
      };
    });
  }, [allWeeks, currentWeekIndex]);

  // Phase 1: Build slot entry map for ALL weeks — expensive O(n×m), only recomputes when filtered schedules change
  type SlotEntry = { slot: any; teacher: any; slotDate: string; startStr: string; endStr: string; durationMs: number };
  const allSlotsEntryMap = useMemo(() => {
    const bestEntryMap = new Map<string, SlotEntry>();
    filteredSchedulesForCalendar.forEach(schedule => {
      const teacher = schedule.teacher;
      schedule.slots.forEach((slot: any) => {
        const slotEndMs = new Date(slot.endTime).getTime();
        const slotStartMs = new Date(slot.startTime).getTime();
        const slotDate = formatLocalDateKey(new Date(slot.startTime));
        const startStr = FORMAT.time(new Date(slot.startTime));
        const endStr = FORMAT.time(new Date(slot.endTime));
        const durationMs = slotEndMs - slotStartMs;

        const dedupeKey = slot.type === 'class'
          ? `class-${slot.classId || slot.className}-${slot.sessionId || startStr}-${slotDate}`
          : `${slot.className || slot.id}-${teacher.id}-${slotDate}`;

        const entrySessionTeachers = getSlotSessionTeacherItems({ ...slot, teacher });
        const existing = bestEntryMap.get(dedupeKey);

        if (!existing) {
          const lecTeacher = entrySessionTeachers.find((item: any) =>
            (item.roleShortName || item.roleName || '').toUpperCase() === 'LEC'
          )?.teacher;
          bestEntryMap.set(dedupeKey, {
            slot: { ...slot, teacher: lecTeacher || teacher, sessionTeachers: entrySessionTeachers },
            teacher,
            slotDate,
            startStr,
            endStr,
            durationMs,
          });
        } else {
          const mergedSessionTeachers = mergeSessionTeachers(existing.slot.sessionTeachers, entrySessionTeachers);
          const lecTeacher = mergedSessionTeachers.find(item =>
            (item.roleShortName || item.roleName || '').toUpperCase() === 'LEC'
          )?.teacher;
          const entryIsClass = slot.type === 'class';
          const existingIsClass = existing.slot.type === 'class';
          if ((entryIsClass && !existingIsClass) || (entryIsClass === existingIsClass && durationMs > existing.durationMs)) {
            bestEntryMap.set(dedupeKey, {
              slot: { ...slot, teacher: lecTeacher || teacher, sessionTeachers: mergedSessionTeachers },
              teacher,
              slotDate,
              startStr,
              endStr,
              durationMs,
            });
          } else {
            existing.slot.sessionTeachers = mergedSessionTeachers;
            if (lecTeacher) existing.slot.teacher = lecTeacher;
          }
        }
      });
    });
    return bestEntryMap;
  }, [filteredSchedulesForCalendar]);

  // Phase 2: Cheap week slice — only recomputes when week navigation changes
  const calendarSlotMap = useMemo(() => {
    const map = new Map<string, Map<string, any[]>>();
    if (allWeeks.length === 0 || !allWeeks[currentWeekIndex]) return map;

    const currentWeekDates = allWeeks[currentWeekIndex];
    const weekStartStr = formatLocalDateKey(currentWeekDates[0]);
    const weekEndStr = formatLocalDateKey(currentWeekDates[6]);

    allSlotsEntryMap.forEach(entry => {
      if (entry.slotDate < weekStartStr || entry.slotDate > weekEndStr) return;
      const timeKey = `${entry.startStr} - ${entry.endStr}`;
      const cellKey = `${entry.slotDate}-${timeKey}`;
      if (!map.has(cellKey)) map.set(cellKey, new Map<string, any[]>());
      const centreMap = map.get(cellKey)!;
      const centreName = entry.slot.centreShortName || 'Unknown';
      if (!centreMap.has(centreName)) centreMap.set(centreName, []);
      centreMap.get(centreName)!.push(entry.slot);
    });

    map.forEach(centreMap => {
      centreMap.forEach(slots => {
        slots.sort((a, b) => {
          if (a.type !== b.type) return a.type === 'class' ? -1 : 1;
          const getOrder = (s: any) => {
            const line = (s.courseLine || '').toUpperCase();
            if (line.match(/C4K|C4T|JSA|JSI|PYA|WEB|GAME|PRO|CODING|PYTHON|CSB|CSI/)) return 1;
            if (line.includes('ROB')) return 2;
            if (line.includes('ART') || line.includes('XART')) return 3;
            return 4;
          };
          const orderA = getOrder(a);
          const orderB = getOrder(b);
          if (orderA !== orderB) return orderA - orderB;
          return (a.className || '').localeCompare(b.className || '');
        });
      });
    });
    return map;
  }, [allSlotsEntryMap, allWeeks, currentWeekIndex]);

  const calendarRenderedSlotCount = useMemo(() => {
    let count = 0;
    calendarSlotMap.forEach(centreMap => {
      centreMap.forEach(slots => {
        count += slots.length;
      });
    });
    return count;
  }, [calendarSlotMap]);

  const scheduleExportRows = useMemo<OperationsScheduleExportRow[]>(() => {
    const dayLabelByDate = new Map(calendarData.map(day => [day.date, day.dayLabel]));
    const rows: OperationsScheduleExportRow[] = [];

    calendarSlotMap.forEach(centreMap => {
      centreMap.forEach(slots => {
        slots.forEach((slot: TeacherScheduleSlot) => {
          const start = new Date(slot.startTime);
          const end = new Date(slot.endTime);
          const dateKey = Number.isNaN(start.getTime()) ? '' : formatLocalDateKey(start);
          const sessionTeachers = getDisplaySessionTeachers(slot);
          const teacherRows = sessionTeachers.map(item => ({
            name: item.teacher.fullName || item.teacher.username || item.teacher.email || item.teacher.id,
            role: getTeacherRoleLabel(item.roleShortName, item.roleName),
          }));
          const primaryTeacher = slot.teacher?.fullName || slot.teacher?.username || teacherRows[0]?.name || '—';

          rows.push({
            sortKey: `${dateKey} ${Number.isNaN(start.getTime()) ? '' : FORMAT.time(start)} ${slot.centreShortName || ''} ${slot.className || ''}`,
            date: Number.isNaN(start.getTime()) ? '—' : start.toLocaleDateString('vi-VN'),
            dayLabel: dayLabelByDate.get(dateKey) || '—',
            startTime: Number.isNaN(start.getTime()) ? '—' : FORMAT.time(start),
            endTime: Number.isNaN(end.getTime()) ? '—' : FORMAT.time(end),
            type: slot.type === 'class' ? 'Lớp học' : 'Ca trực',
            centre: slot.centreName || slot.centreShortName || '—',
            centreCode: slot.centreShortName || '—',
            name: slot.className || slot.officeHourType || '—',
            classId: slot.classId || '',
            sessionNumber: slot.sessionNumber || '',
            courseLine: slot.courseLine || '',
            status: slot.status || '',
            studentCount: slot.studentCount ?? '',
            primaryTeacher,
            teachers: teacherRows.map(item => item.name).join('; '),
            roles: teacherRows.map(item => `${item.role}: ${item.name}`).join('; '),
            officeHourType: slot.officeHourType || '',
          });
        });
      });
    });

    return rows.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  }, [calendarData, calendarSlotMap]);

  const handleExportScheduleCSV = useCallback(() => {
    if (scheduleExportRows.length === 0) {
      addToast('Không có lịch để xuất', 'info');
      return;
    }

    const columns = getOperationsScheduleCSVColumnsFromConfig(scheduleCsvColumns);
    if (columns.length === 0) {
      addToast('Vui lòng chọn ít nhất một cột để xuất', 'info');
      return;
    }

    const currentWeek = allWeeks[currentWeekIndex] || [];
    const weekStart = currentWeek[0] ? formatLocalDateKey(currentWeek[0]) : fromDate;
    const weekEnd = currentWeek[6] ? formatLocalDateKey(currentWeek[6]) : toDate;
    exportToCSV(scheduleExportRows, columns, `lich-van-hanh-${weekStart}-${weekEnd}`);
    addToast(`Đã xuất ${scheduleExportRows.length} lịch vận hành với ${columns.length} cột`, 'success');
  }, [addToast, allWeeks, currentWeekIndex, fromDate, scheduleCsvColumns, scheduleExportRows, toDate]);

  const { allowedPages } = useAllowedPages();
  const navItems = getNavItemsWithRouter('teacher-schedule', router, allowedPages);

  const _displayName = session?.displayName?.trim() || '';
  const _email = session?.email || '';
  const userAvatar = _displayName ? initials(_displayName) : _email.charAt(0).toUpperCase();
  const userName = _displayName || _email.split('@')[0];

  return (
    <ProtectedPage pageKey="teacher-schedule">
      <>
        <ToastContainer toasts={toasts} onRemove={removeToast} />
      <PageLayout
        title={TEACHER_SCHEDULE_LABELS.PAGE_TITLE}
        activePage="operations"
        sidebarOpen={sidebarOpen}
        onSidebarToggle={setSidebarOpen}
      >
        <Toolbar
          centres={centres}
          selectedCentres={selectedCentres}
          onCentresChange={setSelectedCentres}
          centresLoading={loading && centres.length === 0}
          dateFrom={fromDate}
          dateTo={toDate}
          onDateFromChange={setFromDate}
          onDateToChange={setToDate}
          dateRangeLabel="Có buổi học"
          dateRangeExtraSlot={
            <DateRangeInput
              label="Ngày kết thúc"
              dateFrom={endDateFrom}
              dateTo={endDateTo}
              onDateFromChange={setEndDateFrom}
              onDateToChange={setEndDateTo}
              menuPosition="fixed"
            />
          }
          onFetch={() => loadData(fromDate, toDate)}
          onCancel={handleCancelFetch}
          loading={loading}
          progress={progress}
          hasData={schedules.length > 0 || rawClasses.length > 0}
          onClearCache={handleClearScheduleData}
          showRegionQuickSelect={true}
          teacherSearchValue={toolbarTeacherFilter.teacherSearch}
          onTeacherSearchChange={toolbarTeacherFilter.onTeacherSearchChange}
          teacherSearchResults={toolbarTeacherFilter.teacherSearchResults}
          onTeacherSelect={toolbarTeacherFilter.onTeacherSelect}
          selectedTeacherName={toolbarTeacherFilter.selectedTeacherName}
          onTeacherClear={toolbarTeacherFilter.onTeacherClear}
          teachersLoading={toolbarTeacherFilter.teachersLoading}
          classCodeSearch={classCodeSearch}
          onClassCodeSearchChange={setClassCodeSearch}
          dataLimit={dataLimit}
          onDataLimitChange={setDataLimit}
          quickFilterSlots={
            <div className={styles.toolbarCluster}>
              <ScheduleTypeSelect
                value={scheduleTypeFilter}
                onChange={setScheduleTypeFilter}
              />
              <ClassStatusFilterSelect
                selected={selectedClassStatuses}
                onChange={setSelectedClassStatuses}
                options={classStatusFilterOptions}
              />
              <label
                title="Tự động tải dữ liệu nộp và chấm bài sau khi tải danh sách lớp"
                style={{
                  display: 'inline-flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  justifyContent: 'flex-end',
                  height: 46,
                  boxSizing: 'border-box',
                  gap: 4,
                  padding: 0,
                  border: 0,
                  color: 'var(--text-tertiary)',
                  fontSize: 11,
                  fontWeight: 590,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  whiteSpace: 'nowrap',
                  background: 'transparent',
                }}
              >
                <span>Tùy chọn</span>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 7,
                    padding: '7px 9px',
                    border: '1px solid var(--border-primary)',
                    borderRadius: 8,
                    color: 'var(--text-secondary)',
                    fontSize: 12,
                    fontWeight: 590,
                    background: loadSubmissionData ? 'rgba(99, 102, 241, 0.08)' : 'var(--bg-surface)',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={loadSubmissionData}
                    disabled={loading}
                    onChange={event => {
                      const checked = event.target.checked;
                      if (!checked) classSubmissions.cancelLoading();
                      setLoadSubmissionData(checked);
                    }}
                    style={{ accentColor: 'var(--brand-indigo)' }}
                  />
                  Tải dữ liệu bài tập
                </span>
              </label>
              {hasPreferences && (
                <QuickFilterChips
                  centres={centres}
                  selectedCentres={selectedCentres}
                  onCentresChange={setSelectedCentres}
                  selectedCourses={selectedCourseLines}
                  onCoursesChange={setSelectedCourseLines}
                  showCentres={true}
                  showCourses={true}
                />
              )}
            </div>
          }
        />

        {(stats.totalTeachers > 0 || loading) && (
          <motion.div className={styles.statsGrid} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <StatCard label={LABELS.TEACHER.toUpperCase()} value={FORMAT.number(stats.totalTeachers)} desc={TEACHER_SCHEDULE_LABELS.TEACHERS_WITH_SCHEDULE} delay={0.0} />
            <StatCard label={LABELS.TOTAL_SESSIONS.toUpperCase()} value={FORMAT.number(stats.totalSlots)} desc={TEACHER_SCHEDULE_LABELS.TEACHING_SLOTS_IN_RANGE} delay={0.07} />
            <StatCard label="TRUNG BÌNH" value={stats.avgSlotsPerTeacher} desc={TEACHER_SCHEDULE_LABELS.AVG_SLOTS_PER_TEACHER} delay={0.14} />
          </motion.div>
        )}

        {(schedules.length > 0 || rawClasses.length > 0) && (
          <ScheduleViewToggle value={viewMode} onChange={(v) => startTransition(() => setViewMode(v))} />
        )}

        {viewMode === 'calendar' && schedules.length > 0 && (
          <AdminTableSection
            title={TEACHER_SCHEDULE_LABELS.WEEKLY_SCHEDULE}
            count={calendarRenderedSlotCount}
            loading={loading}
            progress={progress}
            isExpanded={true}
            actionSlot={
              <div className={styles.inlineCluster}>
                <ExportButton
                  onClick={handleExportScheduleCSV}
                  onSettingsClick={() => setShowScheduleCSVSettings(true)}
                  disabled={scheduleExportRows.length === 0}
                  count={scheduleExportRows.length}
                  label="Xuất lịch"
                />
                <button
                  type="button"
                  className={styles.primaryBtn}
                  onClick={() => {
                    setSelectedSlot(null);
                    setCoordinationRequest({
                      date: '',
                      startTime: '08:00',
                      endTime: '10:00',
                      centreId: '',
                    });
                    setAvailableTeachers([]);
                    setUnavailableTeachers([]);
                    setShowCoordinationPanel(true);
                  }}
                >
                  <Icon.Search />
                  {TEACHER_SCHEDULE_LABELS.AVAILABLE_TEACHER_SHORT}
                </button>
              </div>
            }
            toolbarSlot={
              <>
                <TableToolbar
                  search={calendarClassCodeSearch}
                  onSearchChange={setCalendarClassCodeSearch}
                  searchPlaceholder="Mã lớp..."
                  filterSlots={
                    <>
                      <CentreSelect menuPosition="fixed"
                        centres={centres}
                        selected={calendarCentreFilter}
                        onChange={(ids) => startTransition(() => setCalendarCentreFilter(ids))}
                        filterToIds={calendarFilterCentreIds}
                        placeholder={LABELS.ALL_CENTRES}
                        searchable
                        maxDisplay={1}
                      />
                      <MultiSelect menuPosition="fixed"
                        options={courseLineOptions}
                        selected={calendarSelectedCourseLines}
                        onChange={(ids) => startTransition(() => setCalendarSelectedCourseLines(ids))}
                        placeholder="Tất cả khối"
                        maxDisplay={1}
                      />
                      <MultiSelect menuPosition="fixed"
                        options={teacherOptions}
                        selected={calendarSelectedTeachers}
                        onChange={(ids) => startTransition(() => setCalendarSelectedTeachers(ids))}
                        placeholder="Tất cả giáo viên"
                        searchable
                        searchPlaceholder="Tìm giáo viên..."
                        maxDisplay={1}
                      />
                      <MultiSelect menuPosition="fixed"
                        options={roleOptions}
                        selected={calendarSelectedRoles}
                        onChange={(ids) => startTransition(() => setCalendarSelectedRoles(ids))}
                        placeholder={calendarSelectedRoles.length > 0 ? `Vai trò (${calendarSelectedRoles.length})` : 'Tất cả vai trò'}
                        maxDisplay={1}
                      />
                    </>
                  }
                  quickFilterSlots={hasPreferences && (
                    <QuickFilterChips
                      centres={centres}
                      selectedCentres={calendarCentreFilter}
                      onCentresChange={(ids) => startTransition(() => setCalendarCentreFilter(ids.filter(id => calendarFilterCentreIds.includes(id))))}
                      selectedCourses={calendarSelectedCourseLines}
                      onCoursesChange={(ids) => startTransition(() => setCalendarSelectedCourseLines(ids))}
                      showCentres={true}
                      showCourses={true}
                    />
                  )}
                  hasFilter={calendarCentreFilter.length > 0 || calendarSelectedTeachers.length > 0 || calendarSelectedCourseLines.length > 0 || calendarSelectedRoles.length > 0 || calendarClassCodeSearch.trim() !== '' || appliedCalendarClassCodeSearch !== ''}
                  onClearFilter={() => startTransition(() => {
                    setCalendarCentreFilter([]);
                    setCalendarSelectedTeachers([]);
                    setCalendarSelectedCourseLines([]);
                    setCalendarSelectedRoles([]);
                    setCalendarClassCodeSearch('');
                    setAppliedCalendarClassCodeSearch('');
                  })}
                />

                <ScheduleFilterSummary
                  filteredSlotCount={calendarRenderedSlotCount}
                  selectedCentres={calendarCentreFilter}
                  selectedCourseLines={calendarSelectedCourseLines}
                  selectedTeachers={calendarSelectedTeachers}
                  selectedRoles={calendarSelectedRoles}
                  classCodeSearch={appliedCalendarClassCodeSearch}
                />
              </>
            }
          >              <WeekNavigator
                weeks={allWeeks}
                currentWeekIndex={currentWeekIndex}
                onWeekChange={(i) => startTransition(() => setCurrentWeekIndex(i))}
              />
              
              <CalendarGrid
                calendarData={calendarData}
                slotMap={calendarSlotMap}
                TIME_SLOTS={dynamicTimeSlots}
                onCardClick={handleCardClick}
                collapsedTimeSlots={collapsedTimeSlots}
                onToggleCollapse={toggleTimeSlotCollapse}
              />
          </AdminTableSection>
        )}

        {/* Quality Table View */}
        {viewMode === 'quality-table' && (
          <div style={{ marginTop: 'var(--space-2)' }}>
            {!loading && rawClasses.length === 0 ? (
              <EmptyState
                icon={<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>}
                title={TEACHER_SCHEDULE_LABELS.EMPTY_QUALITY_TITLE}
                subtitle={TEACHER_SCHEDULE_LABELS.EMPTY_SUBTITLE}
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                {normalQualityClasses.length > 0 && (
                  <div>
                    <div className={styles.tableSection} id="section-quality-summary">
                      <TableGroupHeader
                        title="Tóm tắt Phân tích Chất lượng"
                        count={selectedCentreData.totalClasses}
                        isExpanded={showSummarySection}
                        onToggle={() => setShowSummarySection(!showSummarySection)}
                      />
                      <AnimatePresence initial={false}>
                        {showSummarySection && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            style={{ overflow: 'hidden' }}
                          >
                            <div style={{ padding: 'var(--space-4)', display: 'grid', gap: 'var(--space-4)' }}>
                              <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
                                <MultiSelect
                                  menuPosition="fixed"
                                  options={summaryCentreSelectOptions}
                                  selected={selectedSummaryCentre === 'all' ? [] : [selectedSummaryCentre]}
                                  onChange={(selected) => setSelectedSummaryCentre(selected[selected.length - 1] || 'all')}
                                  placeholder="Tất cả cơ sở"
                                  searchable
                                  maxDisplay={1}
                                />
                                <MultiSelect
                                  menuPosition="fixed"
                                  options={[
                                    { value: 'RUNNING', label: 'Đang học' },
                                    { value: 'FINISHED', label: 'Đã kết thúc' },
                                  ]}
                                  selected={summaryStatusFilter}
                                  onChange={setSummaryStatusFilter}
                                  placeholder="Tất cả trạng thái"
                                  maxDisplay={2}
                                />
                              </div>

                              <div className={styles.summaryBlock}>
                                <div className={styles.summaryBlockHeader}>
                                  <div className={styles.summaryBlockTitle}>
                                    <Icon.ClipboardCheck size={16} /> Điểm Checkpoint (CP1 & CP2)
                                  </div>
                                  <CopyButton content={generateCheckpointContent(selectedCentreData)} label="Checkpoint" />
                                </div>
                                <div className={styles.summaryBlockContent}>
                                  {renderSummaryContent(generateCheckpointContent(selectedCentreData))}
                                </div>
                              </div>

                              <div className={styles.summaryBlock}>
                                <div className={styles.summaryBlockHeader}>
                                  <div className={styles.summaryBlockTitle}>
                                    <Icon.Target size={16} /> Tiêu chí Cuối khoá (Demo & Xếp loại TBCK)
                                  </div>
                                  <CopyButton content={generateDemoContent(selectedCentreData)} label="Demo" />
                                </div>
                                <div className={styles.summaryBlockContent}>
                                  {renderSummaryContent(generateDemoContent(selectedCentreData))}
                                </div>
                              </div>

                              <div className={styles.summaryBlock}>
                                <div className={styles.summaryBlockHeader}>
                                  <div className={styles.summaryBlockTitle}>
                                    <Icon.Settings size={16} /> Tiêu chí Vận hành (Ổn định & Rủi ro)
                                  </div>
                                  <CopyButton content={generateOperationsContent(selectedCentreData)} label="Vận hành" />
                                </div>
                                <div className={styles.summaryBlockContent}>
                                  {renderSummaryContent(generateOperationsContent(selectedCentreData))}
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                )}

                <div className={styles.dashboardLayout}>
                  <ClassQualityUnifiedTable
                    classes={classQualityTableClasses}
                    comparisonClasses={analyzedClasses}
                    search={searchTerm}
                    onSearchChange={setSearchTerm}
                    selectedCourseCategories={selectedCourseLines}
                    selectedTeacherId={toolbarTeacherFilter.selectedTeacherId}
                    dateFrom={classQualityDateFrom}
                    dateTo={classQualityDateTo}
                    onDateFromChange={setClassQualityDateFrom}
                    onDateToChange={setClassQualityDateTo}
                    dateRangePending={isClassQualityDateRangePending}
                    finalProductStatsByClassId={finalProductStatsByClassId}
                    finalProductStatsLoading={classStudentWorksLoading}
                    classStatusOptions={classStatusFilterOptions}
                    onRowClick={(a) => {
                      const carriedSlot = selectedSlot?.classId === a.cls.id ? selectedSlot : null;
                      const sessionIndex = getSlotSessionIndex(a.cls, carriedSlot) ?? pickDefaultClassSessionIndex(a.cls);
                      const slot = createScheduleSlotFromClassSession(a.cls, sessionIndex);
                      setSelectedSlot(slot);
                      setCommentModalSessionIndex(sessionIndex);

                      const dateStr = slot?.startTime ? new Date(slot.startTime).toISOString().split('T')[0] : '';
                      const startTimeStr = slot?.startTime ? formatTime(slot.startTime) : '';
                      const endTimeStr = slot?.endTime ? formatTime(slot.endTime) : '';
                      const centreIdStr = slot?.centreId || a.cls.centre?.id || '';

                      setCoordinationRequest({
                        date: dateStr,
                        startTime: startTimeStr,
                        endTime: endTimeStr,
                        centreId: centreIdStr,
                      });
                      setQualityTab('comments');
                      setCoordinationCourseLineFilter([]);
                      setShowCoordinationPanel(true);
                      setClassQualityData(applyQualityExemptionRules(
                        analyzeClassQuality(a.cls, exemptedSessions, studentCommentAreas, {
                          commentDateRange: {
                            dateFrom: deferredClassQualityDateFrom,
                            dateTo: deferredClassQualityDateTo,
                          },
                          includeInactiveStudents: true,
                        }),
                        { exemptOneOnOneClasses, holidayPeriods },
                      ));
                      setClassQualityLoading(false);

                      setCalculatingTeachers(true);
                      setTimeout(() => {
                        const available = calculateAvailableTeachers(
                          schedules,
                          dateStr,
                          startTimeStr,
                          endTimeStr,
                          centreIdStr,
                          slot?.courseLine
                        );

                        const currentTeacherIds = slot ? getSlotTeacherIds(slot) : new Set<string>();
                        const filteredAvailable = available.filter(ta => !currentTeacherIds.has(ta.teacher.id));

                        setAvailableTeachers(filteredAvailable);
                        setUnavailableTeachers([]);
                        setCalculatingTeachers(false);
                      }, 0);
                    }}
                  />
                  <QualityExemptionRulesPanel
                    exemptOneOnOneClasses={exemptOneOnOneClasses}
                    onExemptOneOnOneClassesChange={setExemptOneOnOneClasses}
                    holidayPeriods={holidayPeriods}
                    onAddHolidayPeriod={handleAddHolidayPeriod}
                    onRemoveHolidayPeriod={handleRemoveHolidayPeriod}
                    onResetDefaults={handleResetQualityRules}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {viewMode === 'submissions' && (
          <SubmissionControlView
            classes={rawClasses}
            records={classSubmissions.records}
            loading={classSubmissions.loading}
            dateFrom={loadedRange?.from || fromDate}
            dateTo={loadedRange?.to || toDate}
            onReloadClass={(classId) => { void classSubmissions.reloadClass(classId); }}
            onReloadAll={() => { void classSubmissions.reloadAll(); }}
          />
        )}

        {viewMode === 'final-products' && (
          <FinalProductControlView
            classes={rawClasses}
            works={classStudentWorks}
            loading={classStudentWorksLoading}
            error={classStudentWorksError}
            onReload={() => setClassStudentWorksReloadKey(key => key + 1)}
          />
        )}

        {/* Empty State */}
        {viewMode === 'calendar' && !loading && schedules.length === 0 && (
          <EmptyState
            icon={<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>}
            title={TEACHER_SCHEDULE_LABELS.EMPTY_SCHEDULE_TITLE}
            subtitle={TEACHER_SCHEDULE_LABELS.EMPTY_SUBTITLE}
          />
        )}

        {/* Coordination Panel Modal */}
        <Modal open={showCoordinationPanel} onClose={() => {
          setShowCoordinationPanel(false);
          setSelectedSlot(null);
          setAvailableTeachers([]);
          setUnavailableTeachers([]);
          setCalculatingTeachers(false);
          setClassQualityData(null);
          setStudentWorks([]);
          setStudentWorksError(null);
          setStudentWorksLoading(false);
        }}>
          <ModalHeader
            title={selectedSlot ? TEACHER_SCHEDULE_LABELS.MANAGE_CLASS_SESSION : TEACHER_SCHEDULE_LABELS.AVAILABLE_TEACHER_SHORT}
            subtitle={selectedSlot ? `${selectedSlot.className} - Buổi ${selectedSlot.sessionNumber || 'N/A'}` : "Nhập thông tin ca cần điều phối"}
            onClose={() => {
              setShowCoordinationPanel(false);
              setSelectedSlot(null);
              setAvailableTeachers([]);
              setUnavailableTeachers([]);
              setCalculatingTeachers(false);
              setStudentWorks([]);
              setStudentWorksError(null);
              setStudentWorksLoading(false);
            }}
          />
          <div className={styles.modalBody}>
            {/* CRITICAL: Inner wrapper to constrain all content */}
            <div style={{ 
              maxWidth: '100%',
              width: '100%',
              boxSizing: 'border-box',
              overflow: 'visible',
              margin: '0 auto'
            }}>
            <div style={{ 
              padding: isMobile ? '12px' : '20px',
              width: '100%',
              maxWidth: '100%',
              boxSizing: 'border-box',
              minWidth: 0,
              overflow: 'visible' // CRITICAL: Prevent clipping dropdowns
            }}>
            {/* Selected Slot Info */}
            {selectedSlot && (
              <div style={{ 
                padding: isMobile ? '10px 12px' : '12px 16px', 
                background: 'var(--bg-elevated)', 
                border: '1px solid var(--border-primary)', 
                borderRadius: "var(--radius-comfortable)",
                marginBottom: 'var(--space-4)',
                width: '100%',
                boxSizing: 'border-box'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {TEACHER_SCHEDULE_LABELS.CURRENT_SLOT_INFO}
                  </div>
                  {selectedSlot.classId && (
                    <button
                      type="button"
                      onClick={() => reloadClassSchedule(selectedSlot.classId)}
                      disabled={reloadingClassId === selectedSlot.classId || addingSupplyTeacherId !== null}
                      title="Tải lại dữ liệu riêng lớp này"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 'var(--space-1)',
                        padding: '4px 8px',
                        borderRadius: 'var(--radius-comfortable)',
                        border: '1px solid var(--border-primary)',
                        background: 'var(--bg-surface)',
                        color: 'var(--text-secondary)',
                        fontSize: 11,
                        fontWeight: 510,
                        cursor: reloadingClassId === selectedSlot.classId || addingSupplyTeacherId !== null ? 'not-allowed' : 'pointer',
                        opacity: reloadingClassId === selectedSlot.classId || addingSupplyTeacherId !== null ? 0.6 : 1,
                      }}
                    >
                      {reloadingClassId === selectedSlot.classId ? (
                        <Spinner size={11} />
                      ) : (
                        <Icon.Refresh size={11} />
                      )}
                      {TEACHER_SCHEDULE_LABELS.RELOAD_DATA}
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', fontSize: 12 }}>
                  <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 2 : 8 }}>
                    <span style={{ color: 'var(--text-tertiary)', minWidth: isMobile ? 'auto' : 100, fontSize: isMobile ? 10 : 12 }}>{LABELS.CLASS_NAME}/Ca:</span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 510, wordBreak: 'break-word' }}>{selectedSlot.className}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 2 : 8 }}>
                    <span style={{ color: 'var(--text-tertiary)', minWidth: isMobile ? 'auto' : 100, fontSize: isMobile ? 10 : 12 }}>{LABELS.TEACHER}:</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', minWidth: 0 }}>
                      {getSessionTeacherRoleRows(selectedSlot).map(row => (
                        <span
                          key={row.label}
                          style={{ color: 'var(--text-primary)', wordBreak: 'break-word' }}
                        >
                          <span style={{ fontWeight: 600 }}>{row.label}:</span> {row.names.join(', ')}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 2 : 8 }}>
                    <span style={{ color: 'var(--text-tertiary)', minWidth: isMobile ? 'auto' : 100, fontSize: isMobile ? 10 : 12 }}>{LABELS.CENTRE}:</span>
                    <span style={{ color: 'var(--text-primary)' }}>{selectedSlot.centreShortName}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 2 : 8 }}>
                    <span style={{ color: 'var(--text-tertiary)', minWidth: isMobile ? 'auto' : 100, fontSize: isMobile ? 10 : 12 }}>{LABELS.TIME}:</span>
                    <span style={{ color: 'var(--text-primary)', wordBreak: 'break-word' }}>
                      {formatDate(selectedSlot.startTime)} • {formatTime(selectedSlot.startTime)} - {formatTime(selectedSlot.endTime)}
                    </span>
                  </div>
                  {selectedSlot.courseLine && (
                    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 2 : 8 }}>
                      <span style={{ color: 'var(--text-tertiary)', minWidth: isMobile ? 'auto' : 100, fontSize: isMobile ? 10 : 12 }}>{LABELS.COURSE_LINE}:</span>
                      <span style={{ color: 'var(--text-primary)' }}>
                        {getCourseLineCategory(selectedSlot.courseLine, selectedSlot.className)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Class Quality Section ──────────────────────────────── */}
            {selectedSlot?.classId && (
              <div className={styles.tableSection} style={{ marginBottom: 'var(--space-4)' }}>
                <TableGroupHeader
                  title={CLASS_QUALITY_LABELS.PANEL_TITLE}
                  loading={classQualityLoading}
                  isExpanded={true}
                  actionSlot={classQualityData && !classQualityLoading ? (
                    <div className={styles.toolbarCluster} style={{ color: 'var(--text-quaternary)', fontSize: 11, fontWeight: 500, display: 'flex', gap: 12 }}>
                      <span>
                        {CLASS_QUALITY_LABELS.TEACHER_COMMENTS}:{' '}
                        <span className={classQualityData.commentAnalysis.customBriefCount + classQualityData.commentAnalysis.customDuplicateCount + classQualityData.commentAnalysis.customOverdueCount > 0 ? styles.warningText : styles.successText} style={{ fontWeight: 600 }}>
                          {classQualityData.commentAnalysis.customBriefCount + classQualityData.commentAnalysis.customDuplicateCount + classQualityData.commentAnalysis.customOverdueCount} lỗi tự viết
                        </span>
                      </span>
                      <span>
                        {CLASS_QUALITY_LABELS.ATTENDANCE}:{' '}
                        <span className={classQualityData.attendanceAnalysis.totalAlerts > 0 ? styles.errorText : styles.successText} style={{ fontWeight: 600 }}>
                          {classQualityData.attendanceAnalysis.studentsWithAlerts.length} {LABELS.STUDENTS.toLowerCase()}
                        </span>
                      </span>
                      <span>
                        {CLASS_QUALITY_LABELS.SCHEDULE_CHANGES}:{' '}
                        <span className={classQualityData.reschedulingAnalysis.rescheduledSessions > 0 ? styles.warningText : styles.successText} style={{ fontWeight: 600 }}>
                          {classQualityData.reschedulingAnalysis.rescheduledSessions} buổi
                        </span>
                      </span>
                    </div>
                  ) : undefined}
                />

                {/* Tabs */}
                <div style={{ display: 'flex', borderBottom: '1px solid var(--border-primary)', background: 'var(--bg-surface)' }}>
                  {(['comments', 'attendance', 'rescheduling', 'finalProducts', 'submissions'] as const).map(tab => {
                    const labels = {
                      comments: CLASS_QUALITY_LABELS.TEACHER_COMMENTS,
                      attendance: CLASS_QUALITY_LABELS.ATTENDANCE,
                      rescheduling: CLASS_QUALITY_LABELS.SCHEDULE_CHANGES,
                      finalProducts: CLASS_QUALITY_LABELS.FINAL_PRODUCTS,
                      submissions: 'Bài tập',
                    };
                    const isActive = qualityTab === tab;
                    return (
                      <button
                        key={tab}
                        onClick={() => {
                          setQualityTab(tab);
                          if (tab === 'submissions' && classSubmissions.records[selectedSlot.classId]?.state === 'error') {
                            void classSubmissions.reloadClass(selectedSlot.classId);
                          }
                        }}
                        style={{
                          padding: '8px 12px',
                          fontSize: 12,
                          fontWeight: isActive ? 600 : 400,
                          color: isActive ? 'var(--brand-indigo)' : 'var(--text-secondary)',
                          background: 'transparent',
                          border: 'none',
                          borderBottom: isActive ? '2px solid var(--brand-indigo)' : '2px solid transparent',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          marginBottom: -1,
                        }}
                      >
                        {labels[tab]}
                      </button>
                    );
                  })}
                </div>

                {/* Tab body */}
                <div style={{ padding: '12px 14px', maxHeight: 320, overflowY: 'auto' }}>
                  {classQualityLoading && (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}>
                      <Spinner size={20} />
                    </div>
                  )}
                  {!classQualityLoading && !classQualityData && qualityTab !== 'submissions' && (
                    <div style={{ textAlign: 'center', color: 'var(--text-quaternary)', fontSize: 12, padding: 16 }}>
                      Không có dữ liệu chất lượng lớp
                    </div>
                  )}

                  {!classQualityLoading && qualityTab === 'submissions' && (
                    <ClassSubmissionDetail
                      record={classSubmissions.records[selectedSlot.classId]}
                      cls={classQualityData?.cls || selectedClassForModal || undefined}
                      dateFrom={loadedRange?.from || fromDate}
                      dateTo={loadedRange?.to || toDate}
                      onRetry={() => { void classSubmissions.reloadClass(selectedSlot.classId); }}
                    />
                  )}

                  {/* ── Comments Tab ── */}
                  {!classQualityLoading && classQualityData && qualityTab === 'comments' && (() => {
                    const ca = classQualityData.commentAnalysis;
                    const slots = (classQualityData.cls.slots ?? [])
                      .filter(s => s.date)
                      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

                    const sessionStats = slots.map((slot, sessionIndex) => {
                      const comments = ca.students.map(st => st.comments.find(c => c.sessionIndex === sessionIndex)).filter(Boolean);
                      const ok = comments.filter(c => c?.customStatus === 'ok').length;
                      const brief = comments.filter(c => c?.customStatus === 'brief').length;
                      const empty = comments.filter(c => c?.customStatus === 'empty').length;
                      const overdue = comments.filter(c => c?.customStatus === 'overdue').length;
                      const duplicate = comments.filter(c =>
                        c?.customStatus === 'duplicate_self' || c?.customStatus === 'duplicate_other'
                      ).length;
                      const hasIssues = brief > 0 || overdue > 0 || duplicate > 0;
                      const hasAttention = hasIssues || empty > 0;
                      return { slot, sessionIndex, ok, brief, empty, overdue, duplicate, hasIssues, hasAttention };
                    });

                    const issueIndex = sessionStats.findIndex(s => s.hasIssues);
                    const fallbackIndex = issueIndex >= 0 ? issueIndex : Math.max(ca.passedSlots - 1, 0);
                    const activeIndex = Math.min(
                      Math.max(commentModalSessionIndex ?? fallbackIndex, 0),
                      Math.max(sessionStats.length - 1, 0),
                    );
                    const scoreAnalysis =
                      classQualityData.cp1Analysis.hasSession && classQualityData.cp1Analysis.sessionIndex === activeIndex
                        ? { label: 'CP1', scoreKey: 'checkpointScore' as const, analysis: classQualityData.cp1Analysis }
                        : classQualityData.cp2Analysis.hasSession && classQualityData.cp2Analysis.sessionIndex === activeIndex
                          ? { label: 'CP2', scoreKey: 'checkpointScore' as const, analysis: classQualityData.cp2Analysis }
                          : classQualityData.demoAnalysis.hasSession && classQualityData.demoAnalysis.sessionIndex === activeIndex
                            ? { label: 'Demo', scoreKey: 'demoScore' as const, analysis: classQualityData.demoAnalysis }
                            : null;
                    const scoreByStudentId = new Map(
                      scoreAnalysis?.analysis.students.map(student => [student.studentId, student]) || [],
                    );
                    const studentSlotById = new Map(
                      (classQualityData.cls.students || []).map(studentSlot => [studentSlot.student.id, studentSlot]),
                    );
                    const formatQualityScore = (score: number | null | undefined) => (
                      typeof score === 'number' && Number.isFinite(score) ? score.toFixed(2).replace(/\.?0+$/, '') : '—'
                    );
                    const parseDisplayScore = (value: string | null | undefined): number | null => {
                      const match = String(value || '').match(/([0-9]+(?:[.,][0-9]+)?)/);
                      if (!match) return null;
                      const score = Number.parseFloat(match[1].replace(',', '.'));
                      return Number.isFinite(score) && score >= 0 && score <= 10 ? score : null;
                    };
                    const parseScoreByDisplayLabels = (
                      text: string | null | undefined,
                      labels: string[],
                    ): number | null => {
                      const cleaned = String(text || '').replace(/\s+/g, ' ').trim();
                      for (const label of labels) {
                        const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        const match = cleaned.match(new RegExp(`${escapedLabel}\\s*(?::|-)\\s*([0-9]+(?:[.,][0-9]+)?)(?:\\s*/\\s*10|\\s*/\\s*5)?(?:\\s*điểm)?`, 'i'));
                        const score = parseDisplayScore(match?.[1]);
                        if (score !== null) return score;
                      }
                      return null;
                    };
                    const getCommentDisplayScore = (
                      comment: NonNullable<(typeof ca.students)[number]['comments'][number]> | undefined,
                      scoreKey: 'checkpointScore' | 'demoScore',
                    ): number | null => {
                      if (!comment) return null;
                      const textLabels = scoreKey === 'demoScore'
                        ? ['Điểm Demo', 'Điểm demo', 'Demo']
                        : ['Total checkpoint score', 'Tổng điểm Checkpoint', 'Tổng điểm checkpoint', 'Điểm tổng Checkpoint', 'Điểm tổng checkpoint'];
                      const directTextScore = parseScoreByDisplayLabels(comment.text, textLabels);
                      if (directTextScore !== null) return directTextScore;

                      const labelMatchers = scoreKey === 'demoScore'
                        ? ['demo', 'san pham', 'sản phẩm', 'cuoi khoa', 'cuối khoá', 'cuối khóa']
                        : ['total checkpoint', 'tong diem checkpoint', 'điểm tổng checkpoint'];
                      const parsedAreaScores = (comment.parsedAreas || []).flatMap(area => (
                        area.criteria.map(criterion => {
                          const label = `${area.name || ''} ${area.sectionTitle || ''} ${criterion.name || ''}`;
                          const normalizedLabel = label
                            .normalize('NFD')
                            .replace(/[\u0300-\u036f]/g, '')
                            .toLowerCase();
                          const isMatchingScore = labelMatchers.some(matcher => normalizedLabel.includes(matcher));
                          return isMatchingScore && typeof criterion.score === 'number' ? criterion.score : null;
                        })
                      )).filter((score): score is number => typeof score === 'number' && Number.isFinite(score));
                      if (parsedAreaScores.length > 0) {
                        return parsedAreaScores.reduce((sum, score) => sum + score, 0) / parsedAreaScores.length;
                      }

                      const genericPointScore = String(comment.text || '').match(/([0-9]+(?:[.,][0-9]+)?)\s*điểm/i);
                      return parseDisplayScore(genericPointScore?.[1]);
                    };

                    return (
                      <div>
                        {/* Summary row */}
                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 10, padding: '8px 10px', background: 'var(--bg-elevated)', borderRadius: 6 }}>
                          {([
                            [COMMENT_STATUS_GROUP_LABELS.ok, ca.customOkCount, 'var(--status-success)'],
                            [COMMENT_STATUS_GROUP_LABELS.brief, ca.customBriefCount, 'var(--status-warning)'],
                            [COMMENT_STATUS_GROUP_LABELS.empty, ca.customPendingCount, 'var(--brand-indigo)'],
                            [COMMENT_STATUS_GROUP_LABELS.overdue, ca.customOverdueCount, 'var(--status-error)'],
                            [COMMENT_STATUS_GROUP_LABELS.duplicate, ca.customDuplicateCount, 'var(--status-dark-orange)'],
                          ] as [string, number, string][]).map(([label, value, color]) => (
                            <div key={label} style={{ minWidth: 80 }}>
                              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2 }}>{label}</div>
                              <div style={{ fontSize: 13, fontWeight: 590, color }}>{value}</div>
                            </div>
                          ))}
                        </div>
                        {/* Session mini-tabs */}
                        <div className={styles.sessionTimeline}>
                          {sessionStats.map(stat => {
                            const sessionDate = new Date(stat.slot.date || stat.slot.startTime);
                            const isUpcoming = sessionDate.getTime() > Date.now();
                            const isActive = stat.sessionIndex === activeIndex;
                            const totalAttention = stat.empty + stat.overdue + stat.duplicate + stat.brief;
                            const primaryIssueType = stat.overdue > 0 ? 'overdue' : stat.duplicate > 0 ? 'duplicate' : stat.brief > 0 ? 'brief' : 'empty';
                            const issueTitle = [
                              stat.empty > 0 ? `${COMMENT_STATUS_GROUP_LABELS.empty}: ${stat.empty}` : '',
                              stat.overdue > 0 ? `${COMMENT_STATUS_GROUP_LABELS.overdue}: ${stat.overdue}` : '',
                              stat.duplicate > 0 ? `${COMMENT_STATUS_GROUP_LABELS.duplicate}: ${stat.duplicate}` : '',
                              stat.brief > 0 ? `${COMMENT_STATUS_GROUP_LABELS.brief}: ${stat.brief}` : '',
                            ].filter(Boolean).join(' • ');
                            return (
                              <button
                                key={stat.sessionIndex}
                                onClick={() => setCommentModalSessionIndex(stat.sessionIndex)}
                                className={[
                                  styles.sessionButton,
                                  isActive ? styles.sessionButtonActive : '',
                                  stat.hasAttention ? styles.sessionButtonIssue : '',
                                  isUpcoming ? styles.sessionButtonUpcoming : styles.sessionButtonPast,
                                ].filter(Boolean).join(' ')}
                              >
                                {stat.hasAttention && (
                                  <span
                                    className={[
                                      styles.sessionIssueDot,
                                      primaryIssueType === 'empty' ? styles.sessionIssueDotEmpty : '',
                                      primaryIssueType === 'overdue' ? styles.sessionIssueDotOverdue : '',
                                      primaryIssueType === 'duplicate' ? styles.sessionIssueDotDuplicate : '',
                                      primaryIssueType === 'brief' ? styles.sessionIssueDotBrief : '',
                                    ].filter(Boolean).join(' ')}
                                    aria-label={`${stat.hasIssues ? 'Cảnh báo' : 'Theo dõi'} nhận xét: ${issueTitle}`}
                                    title={issueTitle}
                                  >
                                    {totalAttention}
                                  </span>
                                )}
                                <span className={styles.sessionButtonTitle}>B{stat.sessionIndex + 1}</span>
                                <span className={styles.sessionButtonMeta}>{formatSessionDateLabel(stat.slot.date || stat.slot.startTime)}</span>
                              </button>
                            );
                          })}
                        </div>
                        {/* Student comment table for active session */}
                        {sessionStats[activeIndex] && (
                          <div style={{ overflowX: 'auto' }}>
                            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 6 }}>
                              Buổi {activeIndex + 1} - {formatSessionDateLabel(sessionStats[activeIndex].slot.date || sessionStats[activeIndex].slot.startTime)}
                            </div>
                            <table className={styles.studentTable} style={{ width: '100%', fontSize: 12 }}>
                              <thead>
                                <tr>
                                  <th>Học viên</th>
                                  <th>Trạng thái</th>
                                  {scoreAnalysis && <th style={{ minWidth: 72, textAlign: 'center' }}>Điểm {scoreAnalysis.label}</th>}
                                  <th style={{ minWidth: 200 }}>Nội dung</th>
                                </tr>
                              </thead>
                              <tbody>
                                {ca.students.map(st => {
                                  const c = st.comments.find(x => x.sessionIndex === activeIndex);
                                  const studentSlot = studentSlotById.get(st.studentId);
                                  const inactiveStatusLabel = getInactiveStudentStatusLabel(studentSlot);
                                  const attendance = sessionStats[activeIndex].slot.studentAttendance?.find(sa => sa.student.id === st.studentId);
                                  const attendanceStatus = normalizeStatus(attendance?.status);
                                  const isAbsentAttendance = attendanceStatus === 'ABSENT'
                                    || attendanceStatus === 'ABSENT_UNEXCUSED'
                                    || attendanceStatus === 'ABSENT_WITH_NOTICE'
                                    || attendanceStatus === 'EXCUSED';
                                  const status = c?.customStatus && c.customStatus !== 'not_applicable'
                                    ? c.customStatus
                                    : c?.status ?? (inactiveStatusLabel && !attendance ? 'inactive' : 'not_required');
                                  const statusLabel = status === 'inactive'
                                    ? inactiveStatusLabel
                                    : !c && isAbsentAttendance
                                      ? 'Vắng buổi này'
                                      : undefined;
                                  const scoreStudent = scoreByStudentId.get(st.studentId) as any;
                                  const score = scoreAnalysis
                                    ? scoreAnalysis.scoreKey === 'demoScore'
                                      ? scoreStudent?.demoScore ?? getCommentDisplayScore(c, scoreAnalysis.scoreKey)
                                      : scoreStudent?.checkpointScore ?? getCommentDisplayScore(c, scoreAnalysis.scoreKey)
                                    : null;
                                  return (
                                    <tr key={st.studentId}>
                                      <td style={{ fontWeight: 510, fontSize: 12 }}>
                                        <StudentHoverCard studentId={st.studentId} studentName={st.studentName} />
                                      </td>
                                      <td>
                                        <CommentStatusBadge status={status}>
                                          {statusLabel}
                                        </CommentStatusBadge>
                                        {c?.customStatus === 'duplicate_self' && (
                                          <div
                                            style={{ marginTop: 4, fontSize: 10, color: 'var(--text-tertiary)', lineHeight: 1.35, whiteSpace: 'nowrap' }}
                                          >
                                            {c.duplicateWithSessionIndex !== undefined
                                              ? `Trùng buổi ${c.duplicateWithSessionIndex + 1}`
                                              : 'Trùng với buổi trước'}
                                          </div>
                                        )}
                                      </td>
                                      {scoreAnalysis && (
                                        <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                                          <span style={{ fontSize: 12, fontWeight: 600, color: typeof score === 'number' ? 'var(--text-primary)' : 'var(--text-quaternary)' }}>
                                            {formatQualityScore(score)}
                                          </span>
                                          {scoreAnalysis.scoreKey === 'demoScore' && typeof scoreStudent?.tbck === 'number' && (
                                            <div style={{ marginTop: 2, fontSize: 10, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                                              TBCK {formatQualityScore(scoreStudent.tbck)}
                                              {scoreStudent.rank ? ` • ${scoreStudent.rank}` : ''}
                                            </div>
                                          )}
                                        </td>
                                      )}
                                      <td style={{ fontSize: 11, color: c?.text ? 'var(--text-primary)' : 'var(--text-quaternary)', lineHeight: 1.4, verticalAlign: 'top', paddingTop: 6 }}>
                                        {c?.text ? (
                                          <TeacherCommentCell text={c.text} parsedAreas={c.parsedAreas} />
                                        ) : (
                                          c?.status === 'empty' ? (
                                            <em style={{ color: 'var(--brand-indigo)' }}>
                                              Đang chờ nhận xét trong thời hạn
                                              {c.commentDeadlineAt && Number.isFinite(new Date(c.commentDeadlineAt).getTime())
                                                ? ` · còn ${Math.max(1, Math.ceil((new Date(c.commentDeadlineAt).getTime() - Date.now()) / (60 * 60 * 1000)))} giờ`
                                                : ''}
                                            </em>
                                          ) : (
                                            <em>
                                              {c
                                                ? 'Không có nội dung'
                                                : inactiveStatusLabel && !attendance
                                                  ? `${inactiveStatusLabel} - không áp dụng buổi này`
                                                  : isAbsentAttendance
                                                    ? 'Học viên vắng buổi này - không yêu cầu nhận xét'
                                                    : 'Không yêu cầu'}
                                            </em>
                                          )
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* ── Attendance Tab ── */}
                  {!classQualityLoading && classQualityData && qualityTab === 'attendance' && (() => {
                    const cls = classQualityData.cls;
                    const aa = classQualityData.attendanceAnalysis;

                    // Build sorted slot list (all sessions with dates)
                    const sortedSlots = (cls.slots ?? [])
                      .filter(s => s.date)
                      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

                    // Keep inactive students visible here so staff can audit historical
                    // attendance/comment data after deactivate, on-hold, or dropout.
                    const studentMap = new Map<string, {
                      id: string;
                      name: string;
                      activeInClass: boolean;
                      inactiveStatusLabel: string;
                      sessions: Map<string, { date: string; status: string }>;
                    }>();
                    (cls.students ?? []).forEach(s => {
                      studentMap.set(s.student.id, {
                        id: s.student.id,
                        name: s.student.fullName || s.student.customer?.fullName || '',
                        activeInClass: s.activeInClass,
                        inactiveStatusLabel: getInactiveStudentStatusLabel(s),
                        sessions: new Map(),
                      });
                    });

                    sortedSlots.forEach(slot => {
                      (slot.studentAttendance ?? []).forEach(sa => {
                        const st = studentMap.get(sa.student.id);
                        if (!st) return;
                        st.sessions.set(slot._id, { date: slot.date, status: sa.status || 'UNKNOWN' });
                      });
                    });

                    const allStudents = Array.from(studentMap.values());
                    // Sort: students with alerts first
                    const alertStudentIds = new Set(aa.studentsWithAlerts.map(s => s.studentId));
                    allStudents.sort((a, b) => {
                      const aHasAlert = alertStudentIds.has(a.id) ? 0 : 1;
                      const bHasAlert = alertStudentIds.has(b.id) ? 0 : 1;
                      return aHasAlert - bHasAlert;
                    });

                    // Summary stats
                    const totalStudents = allStudents.length;
                    const studentsWithAlerts = aa.studentsWithAlerts.length;
                    const totalAbsents = aa.studentsWithAlerts.reduce((sum, s) => sum + s.absentCount, 0);

                    return (
                      <div>
                        {/* Summary bar */}
                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 10, padding: '8px 10px', background: 'var(--bg-elevated)', borderRadius: 6 }}>
                          <div style={{ minWidth: 80 }}>
                            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2 }}>Học viên</div>
                            <div style={{ fontSize: 13, fontWeight: 590, color: 'var(--text-primary)' }}>{totalStudents}</div>
                          </div>
                          <div style={{ minWidth: 80 }}>
                            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2 }}>Có cảnh báo</div>
                            <div style={{ fontSize: 13, fontWeight: 590, color: studentsWithAlerts > 0 ? 'var(--status-error)' : 'var(--status-success)' }}>{studentsWithAlerts}</div>
                          </div>
                          <div style={{ minWidth: 80 }}>
                            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2 }}>Tổng buổi nghỉ</div>
                            <div style={{ fontSize: 13, fontWeight: 590, color: totalAbsents > 0 ? 'var(--status-warning)' : 'var(--status-success)' }}>{totalAbsents}</div>
                          </div>
                          <div style={{ minWidth: 80 }}>
                            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2 }}>Tổng buổi</div>
                            <div style={{ fontSize: 13, fontWeight: 590, color: 'var(--text-primary)' }}>{sortedSlots.length}</div>
                          </div>
                        </div>

                        {allStudents.length === 0 ? (
                          <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text-quaternary)', fontSize: 12 }}>
                            Chưa có dữ liệu điểm danh
                          </div>
                        ) : (
                          <div style={{ overflowX: 'auto' }}>
                            <table className={styles.studentTable} style={{ width: '100%', fontSize: 12 }}>
                              <thead>
                                <tr>
                                  <th style={{ minWidth: 120, textAlign: 'left' }}>Học viên</th>
                                  <th style={{ minWidth: 80 }}>Cảnh báo</th>
                                  {sortedSlots.map((slot, idx) => {
                                    const isUpcoming = new Date(slot.date || slot.startTime).getTime() > Date.now();
                                    const isActive = idx === commentModalSessionIndex;
                                    return (
                                    <th key={slot._id} style={{ textAlign: 'center', minWidth: 36, padding: '4px 2px' }}>
                                      <div style={{ fontSize: 10, fontWeight: 600, color: isActive ? 'var(--brand-indigo)' : undefined, opacity: isUpcoming ? 0.5 : 1 }}>B{idx + 1}</div>
                                      <div style={{ fontSize: 9, color: 'var(--text-tertiary)', fontWeight: 400 }}>
                                        {formatSessionDateLabel(slot.date || slot.startTime)}
                                      </div>
                                    </th>
                                    );
                                  })}
                                </tr>
                              </thead>
                              <tbody>
                                {allStudents.map(st => {
                                  const alertData = aa.studentsWithAlerts.find(a => a.studentId === st.id);
                                  const hasAlert = !!alertData;
                                  return (
                                    <tr key={st.id} style={{ background: hasAlert ? 'rgba(220,38,38,0.02)' : 'transparent' }}>
                                      <td style={{ fontWeight: hasAlert ? 590 : 510, fontSize: 12, color: hasAlert ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                                        <StudentHoverCard studentId={st.id} studentName={st.name} />
                                      </td>
                                      <td>
                                        {alertData ? (
                                          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                                            {alertData.alerts.includes('frequent_absent') && <AttendanceAlertBadge type="frequent_absent" />}
                                            {alertData.alerts.includes('consecutive_absent') && <AttendanceAlertBadge type="consecutive_absent" />}
                                            {alertData.alerts.includes('late_stage_absent') && <AttendanceAlertBadge type="late_stage_absent" />}
                                          </div>
                                        ) : !st.activeInClass ? (
                                          <Badge variant="exempt" size="sm" shape="rounded">
                                            {st.inactiveStatusLabel || 'Không còn lớp'}
                                          </Badge>
                                        ) : (
                                          <span style={{ fontSize: 10, color: 'var(--status-success)', fontWeight: 600 }}>✓</span>
                                        )}
                                      </td>
                                      {sortedSlots.map((slot, idx) => {
                                        const sess = st.sessions.get(slot._id);
                                        const isUpcoming = new Date(slot.date || slot.startTime).getTime() > Date.now();
                                        return (
                                        <td key={slot._id} style={{ textAlign: 'center', padding: '2px', opacity: isUpcoming ? 0.45 : 1 }}>
                                          <AttendanceSessionCell
                                            status={sess?.status || (!st.activeInClass ? 'INACTIVE_IN_CLASS' : 'UNKNOWN')}
                                            index={idx}
                                            date={slot.date}
                                            size={26}
                                          />
                                        </td>
                                        );
                                      })}
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })()}


                  {/* ── Rescheduling Tab ── */}
                  {!classQualityLoading && classQualityData && qualityTab === 'rescheduling' && (() => {
                    const ra = classQualityData.reschedulingAnalysis;
                    return (
                      <div>
                        {/* Summary */}
                        <div style={{ display: 'flex', gap: 16, marginBottom: 10, padding: '8px 10px', background: 'var(--bg-elevated)', borderRadius: 6, fontSize: 12 }}>
                          <div>
                            <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Tổng buổi</div>
                            <div style={{ fontWeight: 590 }}>{ra.totalSessions}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Buổi bị dời</div>
                            <div style={{ fontWeight: 590, color: ra.rescheduledSessions > 0 ? 'var(--status-warning)' : 'var(--status-success)' }}>{ra.rescheduledSessions}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>TB khoảng cách</div>
                            <div style={{ fontWeight: 590 }}>{ra.averageDaysBetweenSessions.toFixed(1)} ngày</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Loại lớp</div>
                            <div style={{ fontWeight: 590 }}>{ra.classType === 'regular' ? 'Thường' : 'Tăng cường'}</div>
                          </div>
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                          <table className={styles.studentTable} style={{ width: '100%', fontSize: 12 }}>
                            <thead>
                              <tr>
                                <th>Buổi</th>
                                <th>Ngày học</th>
                                <th>Khoảng cách</th>
                                <th>Trạng thái</th>
                              </tr>
                            </thead>
                            <tbody>
                              {ra.sessions.map(sess => {
                                const isSameDay = sess.daysSincePrevious === 0;
                                const isActive = sess.sessionIndex === commentModalSessionIndex;
                                const isUpcoming = new Date(sess.date).getTime() > Date.now();
                                return (
                                  <tr
                                    key={sess.sessionIndex}
                                    style={{
                                      background: isActive ? 'rgba(99,102,241,0.08)' : sess.isRescheduled ? 'rgba(245,158,11,0.04)' : 'transparent',
                                      opacity: isUpcoming && !isActive ? 0.5 : 1,
                                    }}
                                  >
                                    <td style={{ textAlign: 'center', fontWeight: 510 }}>B{sess.sessionIndex + 1}</td>
                                    <td style={{ whiteSpace: 'nowrap' }}>{formatSessionDateLabel(sess.date)}</td>
                                    <td style={{ textAlign: 'center', color: sess.isRescheduled ? 'var(--status-warning)' : 'var(--text-tertiary)' }}>
                                      {sess.daysSincePrevious !== null ? (isSameDay ? RESCHEDULE_STATUS_LABELS.same_day : `${sess.daysSincePrevious}d`) : '—'}
                                    </td>
                                    <td>
                                      {isSameDay ? (
                                        <RescheduleStatusBadge status="same_day" />
                                      ) : sess.isRescheduled ? (
                                        <RescheduleStatusBadge status={sess.reschedulingType === 'early' ? 'early' : 'late'} />
                                      ) : (
                                        <RescheduleStatusBadge status="on_schedule" />
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })()}

                  {/* ── Final Products Tab ── */}
                  {qualityTab === 'finalProducts' && (() => {
                    const activeStudents = selectedClassForModal ? getActiveClassStudents(selectedClassForModal) : [];
                    const activeStudentIds = new Set(activeStudents.map(student => student.id));
                    const worksByStudent = buildStudentWorksByStudentId(
                      studentWorks,
                      activeStudentIds.size > 0 ? activeStudentIds : undefined
                    );
                    const representativeStudentWorks = Array.from(worksByStudent.values());
                    const stats = selectedClassForModal
                      ? buildFinalProductClassStats(selectedClassForModal, studentWorks)
                      : {
                        classId: selectedSlotClassId || '',
                        submittedCount: representativeStudentWorks.length,
                        approvedCount: 0,
                        pendingCount: representativeStudentWorks.length,
                        rejectedCount: 0,
                        missingCount: 0,
                        totalStudents: representativeStudentWorks.length,
                        isFinalSessionCompleted: true,
                        finalSessionDate: finalProductSession?.date || null,
                      };

                    return (
                      <div>
                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 10, padding: '8px 10px', background: 'var(--bg-elevated)', borderRadius: 6 }}>
                          {([
                            ['Buổi cuối', finalProductSession?.sessionNumber ? `B${finalProductSession.sessionNumber}` : 'N/A', 'var(--text-primary)'],
                            ['Đã đăng', `${stats.submittedCount}/${stats.totalStudents || studentWorks.length}`, stats.missingCount > 0 ? 'var(--status-warning)' : 'var(--status-success)'],
                            ['Đã duyệt', stats.approvedCount, 'var(--status-success)'],
                            ['Chờ xử lý', stats.pendingCount, stats.pendingCount > 0 ? 'var(--status-warning)' : 'var(--text-tertiary)'],
                            ['Từ chối', stats.rejectedCount, stats.rejectedCount > 0 ? 'var(--status-error)' : 'var(--text-tertiary)'],
                          ] as [string, string | number, string][]).map(([label, value, color]) => (
                            <div key={label} style={{ minWidth: 80 }}>
                              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2 }}>{label}</div>
                              <div style={{ fontSize: 13, fontWeight: 590, color }}>{value}</div>
                            </div>
                          ))}
                        </div>

                        {studentWorksLoading && (
                          <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}>
                            <Spinner size={20} />
                          </div>
                        )}

                        {!studentWorksLoading && studentWorksError && (
                          <div style={{ textAlign: 'center', color: 'var(--status-error)', fontSize: 12, padding: 16 }}>
                            Không thể tải dữ liệu sản phẩm cuối khóa
                          </div>
                        )}

                        {!studentWorksLoading && !studentWorksError && activeStudents.length === 0 && studentWorks.length === 0 && (
                          <div style={{ textAlign: 'center', color: 'var(--text-quaternary)', fontSize: 12, padding: 16 }}>
                            Chưa có dữ liệu học viên hoặc sản phẩm
                          </div>
                        )}

                        {!studentWorksLoading && !studentWorksError && (activeStudents.length > 0 || studentWorks.length > 0) && (
                          <div style={{ overflowX: 'auto' }}>
                            <table className={styles.studentTable} style={{ width: '100%', fontSize: 12 }}>
                              <thead>
                                <tr>
                                  <th style={{ minWidth: 140, textAlign: 'left' }}>Học viên</th>
                                  <th style={{ minWidth: 96 }}>Đăng tải</th>
                                  <th style={{ minWidth: 110 }}>Trạng thái</th>
                                  <th style={{ minWidth: 220 }}>Sản phẩm</th>
                                  <th style={{ minWidth: 180 }}>Nhận xét / chất lượng</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(activeStudents.length > 0 ? activeStudents : representativeStudentWorks.map(work => ({
                                  id: work.studentId || work.id,
                                  name: work.studentId || 'Không rõ học viên',
                                }))).map(student => {
                                  const work = worksByStudent.get(student.id);
                                  const statusMeta = getStudentWorkStatusMeta(work?.status);
                                  const latest = work?.latestData;
                                  const thumbnailPreviews = normalizeStudentWorkUrls(latest?.thumbnail).map((url, index) => ({
                                    label: index === 0 ? CLASS_QUALITY_LABELS.FINAL_PRODUCT_THUMBNAIL : `${CLASS_QUALITY_LABELS.FINAL_PRODUCT_THUMBNAIL} ${index + 1}`,
                                    url,
                                  }));
                                  const imagePreviews = normalizeStudentWorkUrls(latest?.imageUrl).map((url, index) => ({
                                    label: index === 0 ? CLASS_QUALITY_LABELS.FINAL_PRODUCT_IMAGE : `${CLASS_QUALITY_LABELS.FINAL_PRODUCT_IMAGE} ${index + 1}`,
                                    url,
                                  }));
                                  const relatedUrls = (latest?.relatedUrls || []).filter(item => item?.url).map((item, index) => ({
                                    label: item?.name || `Link ${index + 1}`,
                                    url: item?.url || '',
                                  }));
                                  const videoUrls = (latest?.videoUrls || []).map((url, index) => ({ label: `Video ${index + 1}`, url }));
                                  const attachments = (latest?.attachmentUrls || []).map((url, index) => ({
                                    label: getStudentWorkFileName(url, `${CLASS_QUALITY_LABELS.FINAL_PRODUCT_ATTACHMENT} ${index + 1}`),
                                    url,
                                  }));

                                  return (
                                    <tr key={student.id} style={{ background: work ? 'transparent' : 'rgba(245,158,11,0.03)' }}>
                                      <td style={{ fontWeight: 510, fontSize: 12 }}>
                                        <StudentHoverCard studentId={student.id} studentName={student.name} />
                                      </td>
                                      <td>
                                        {work ? (
                                          <span style={{ color: 'var(--status-success)', fontWeight: 600 }}>Đã có</span>
                                        ) : (
                                          <span style={{ color: 'var(--status-warning)', fontWeight: 600 }}>Chưa có</span>
                                        )}
                                      </td>
                                      <td>
                                        {work ? (
                                          <span style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            padding: '2px 7px',
                                            borderRadius: 999,
                                            fontSize: 10,
                                            fontWeight: 650,
                                            color: statusMeta.color,
                                            background: statusMeta.bg,
                                          }}>
                                            {statusMeta.label}
                                          </span>
                                        ) : (
                                          <span style={{ color: 'var(--text-quaternary)', fontSize: 11 }}>-</span>
                                        )}
                                      </td>
                                      <td style={{ lineHeight: 1.45 }}>
                                        {work ? (
                                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                            <div style={{ color: latest?.title ? 'var(--text-primary)' : 'var(--text-quaternary)', fontWeight: 510 }}>
                                              {latest?.title || 'Chưa có tiêu đề'}
                                            </div>
                                            {thumbnailPreviews.length > 0 && (
                                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--text-tertiary)', fontSize: 11, fontWeight: 600 }}>
                                                  <Icon.Image size={12} /> {CLASS_QUALITY_LABELS.FINAL_PRODUCT_THUMBNAIL}
                                                </span>
                                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                                  {thumbnailPreviews.map(item => (
                                                    <a
                                                      key={`${student.id}-thumbnail-${item.url}`}
                                                      href={item.url}
                                                      target="_blank"
                                                      rel="noreferrer"
                                                      title={item.label}
                                                      style={{ display: 'inline-flex', flexDirection: 'column', gap: 3, color: 'var(--text-secondary)', fontSize: 10, fontWeight: 600, textDecoration: 'none' }}
                                                    >
                                                      <img
                                                        src={item.url}
                                                        alt={item.label}
                                                        loading="lazy"
                                                        style={{
                                                          width: 72,
                                                          height: 48,
                                                          objectFit: 'cover',
                                                          borderRadius: 6,
                                                          border: '1px solid var(--border-primary)',
                                                          background: 'var(--bg-elevated)',
                                                        }}
                                                      />
                                                    </a>
                                                  ))}
                                                </div>
                                              </div>
                                            )}
                                            {imagePreviews.length > 0 && (
                                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--text-tertiary)', fontSize: 11, fontWeight: 600 }}>
                                                  <Icon.Image size={12} /> {CLASS_QUALITY_LABELS.FINAL_PRODUCT_IMAGE}
                                                </span>
                                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                                  {imagePreviews.map(item => (
                                                    <a
                                                      key={`${student.id}-image-${item.url}`}
                                                      href={item.url}
                                                      target="_blank"
                                                      rel="noreferrer"
                                                      title={item.label}
                                                      style={{ display: 'inline-flex', flexDirection: 'column', gap: 3, color: 'var(--text-secondary)', fontSize: 10, fontWeight: 600, textDecoration: 'none' }}
                                                    >
                                                      <img
                                                        src={item.url}
                                                        alt={item.label}
                                                        loading="lazy"
                                                        style={{
                                                          width: 88,
                                                          height: 58,
                                                          objectFit: 'cover',
                                                          borderRadius: 6,
                                                          border: '1px solid var(--border-primary)',
                                                          background: 'var(--bg-elevated)',
                                                        }}
                                                      />
                                                      <span>{item.label}</span>
                                                    </a>
                                                  ))}
                                                </div>
                                              </div>
                                            )}
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                              {videoUrls.length > 0 && (
                                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--text-tertiary)', fontSize: 11, fontWeight: 600 }}>
                                                    <Icon.Video size={12} />
                                                    {CLASS_QUALITY_LABELS.FINAL_PRODUCT_VIDEOS}:
                                                  </span>
                                                  {videoUrls.map(item => (
                                                    <a
                                                      key={`${student.id}-video-${item.url}`}
                                                      href={item.url}
                                                      target="_blank"
                                                      rel="noreferrer"
                                                      style={{ color: 'var(--brand-indigo)', fontSize: 11, fontWeight: 600 }}
                                                    >
                                                      {item.label}
                                                    </a>
                                                  ))}
                                                </div>
                                              )}
                                              {relatedUrls.length > 0 && (
                                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--text-tertiary)', fontSize: 11, fontWeight: 600 }}>
                                                    <Icon.Link size={12} />
                                                    {CLASS_QUALITY_LABELS.FINAL_PRODUCT_RELATED_URLS}:
                                                  </span>
                                                  {relatedUrls.map(item => (
                                                    <a
                                                      key={`${student.id}-related-${item.url}`}
                                                      href={item.url}
                                                      target="_blank"
                                                      rel="noreferrer"
                                                      style={{ color: 'var(--brand-indigo)', fontSize: 11, fontWeight: 600 }}
                                                    >
                                                      {item.label}
                                                    </a>
                                                  ))}
                                                </div>
                                              )}
                                              {attachments.length > 0 && (
                                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--text-tertiary)', fontSize: 11, fontWeight: 600 }}>
                                                    <Icon.Paperclip size={12} />
                                                    {CLASS_QUALITY_LABELS.FINAL_PRODUCT_ATTACHMENT}:
                                                  </span>
                                                  {attachments.map(item => (
                                                    <a
                                                      key={`${student.id}-attachment-${item.url}`}
                                                      href={item.url}
                                                      target="_blank"
                                                      rel="noreferrer"
                                                      style={{ color: 'var(--brand-indigo)', fontSize: 11, fontWeight: 600 }}
                                                    >
                                                      {item.label}
                                                    </a>
                                                  ))}
                                                </div>
                                              )}
                                              {videoUrls.length === 0 && relatedUrls.length === 0 && attachments.length === 0 && imagePreviews.length === 0 && thumbnailPreviews.length === 0 && (
                                                <span style={{ color: 'var(--text-quaternary)', fontSize: 11 }}>
                                                  {getStudentWorkAssetCount(work)} tài nguyên
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        ) : (
                                          <span style={{ color: 'var(--text-quaternary)', fontSize: 11 }}>Chưa đăng sản phẩm</span>
                                        )}
                                      </td>
                                      <td style={{ fontSize: 11, color: latest?.rejectReason ? 'var(--status-error)' : 'var(--text-secondary)', lineHeight: 1.45 }}>
                                        {latest?.rejectReason || latest?.comment || (work ? 'Chưa có nhận xét' : '-')}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            <div style={{ 
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-5)', 
              width: '100%', 
              maxWidth: '100%',
              boxSizing: 'border-box', 
              minWidth: 0
            }}>
              {/* --- FORM SECTION --- */}
              {!selectedSlot && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr)',
                gap: 'var(--space-4)', 
                width: '100%', 
                maxWidth: '100%',
                boxSizing: 'border-box', 
                minWidth: 0
              }}>
                {/* Date */}
                <div style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 590, color: 'var(--text-primary)', marginBottom: 'var(--space-2)' }}>
                    Ngày
                  </label>
                  <input
                    type="date"
                    value={coordinationRequest.date}
                    onChange={(e) => setCoordinationRequest(prev => ({ ...prev, date: e.target.value }))}
                    style={{
                      width: '100%',
                      maxWidth: '100%',
                      minWidth: 0,
                      padding: isMobile ? '8px 10px' : '8px 12px',
                      fontSize: 13,
                      border: '1px solid var(--border-primary)',
                      borderRadius: "var(--radius-comfortable)",
                      background: 'var(--bg-surface)',
                      color: 'var(--text-primary)',
                      boxSizing: 'border-box',
                      display: 'block'
                    }}
                  />
                </div>

                {/* Time Range */}
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) minmax(0, 1fr)', 
                  gap: isMobile ? 16 : 12,
                  rowGap: 16,
                  width: '100%',
                  maxWidth: '100%',
                  minWidth: 0,
                  boxSizing: 'border-box'
                }}>
                  <div style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 590, color: 'var(--text-primary)', marginBottom: 'var(--space-2)' }}>
                      Giờ bắt đầu
                    </label>
                    <input
                      type="time"
                      value={coordinationRequest.startTime}
                      onChange={(e) => setCoordinationRequest(prev => ({ ...prev, startTime: e.target.value }))}
                      style={{
                        width: '100%',
                        maxWidth: '100%',
                        minWidth: 0,
                        padding: isMobile ? '8px 10px' : '8px 12px',
                        fontSize: 13,
                        border: '1px solid var(--border-primary)',
                        borderRadius: "var(--radius-comfortable)",
                        background: 'var(--bg-surface)',
                        color: 'var(--text-primary)',
                        boxSizing: 'border-box',
                        display: 'block'
                      }}
                    />
                  </div>
                  <div style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 590, color: 'var(--text-primary)', marginBottom: 'var(--space-2)' }}>
                      Giờ kết thúc
                    </label>
                    <input
                      type="time"
                      value={coordinationRequest.endTime}
                      onChange={(e) => setCoordinationRequest(prev => ({ ...prev, endTime: e.target.value }))}
                      style={{
                        width: '100%',
                        maxWidth: '100%',
                        minWidth: 0,
                        padding: isMobile ? '8px 10px' : '8px 12px',
                        fontSize: 13,
                        border: '1px solid var(--border-primary)',
                        borderRadius: "var(--radius-comfortable)",
                        background: 'var(--bg-surface)',
                        color: 'var(--text-primary)',
                        boxSizing: 'border-box',
                        display: 'block'
                      }}
                    />
                  </div>
                </div>

                {/* Centre & Course Line */}
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) minmax(0, 1fr)', 
                  gap: isMobile ? 16 : 12,
                  rowGap: 16,
                  width: '100%',
                  maxWidth: '100%',
                  minWidth: 0,
                  boxSizing: 'border-box'
                }}>
                  {/* Centre */}
                  <div style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 590, color: 'var(--text-primary)', marginBottom: 'var(--space-2)' }}>
                      Cơ sở cần điều phối
                    </label>
                    <div style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }}>
                    <CentreSelect menuPosition="fixed"
                      centres={centres}
                      selected={coordinationRequest.centreId ? [coordinationRequest.centreId] : []}
                      onChange={(selected) => {
                        // Only allow single selection
                        const newCentreId = selected.length > 0 ? selected[selected.length - 1] : '';
                        setCoordinationRequest(prev => ({ ...prev, centreId: newCentreId }));
                      }}
                      placeholder="-- Chọn cơ sở --"
                      searchable={true}
                      maxDisplay={1}
                    />
                    </div>
                  </div>
                  {/* Course Line */}
                  <div style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 590, color: 'var(--text-primary)', marginBottom: 'var(--space-2)' }}>
                      Khối
                    </label>
                    <div style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }}>
                    <MultiSelect menuPosition="fixed"
                      options={[
                        { value: 'Coding', label: 'Coding' },
                        { value: 'Robotics', label: 'Robotics' },
                        { value: 'Art', label: 'Art' },
                        { value: 'Others', label: 'Khác' }
                      ]}
                      selected={coordinationRequest.courseLineId ? [coordinationRequest.courseLineId] : []}
                      onChange={(selected) => {
                        // Only allow single selection
                        const newCourseLineId = selected.length > 0 ? selected[selected.length - 1] : '';
                        setCoordinationRequest(prev => ({ ...prev, courseLineId: newCourseLineId }));
                      }}
                      placeholder="-- Tất cả khối --"
                      maxDisplay={1}
                    />
                    </div>
                  </div>
                </div>

                {/* Search Button - Only show if user modified the form */}
                <div style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }}>
                <button
                  onClick={handleSearchAvailableTeachers}
                  disabled={calculatingTeachers}
                  className={styles.primaryBtn}
                  style={{
                    padding: isMobile ? '10px 14px' : '10px 16px',
                    fontSize: 14,
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '100%',
                    maxWidth: '100%',
                    minWidth: 0,
                    boxSizing: 'border-box',
                    gap: 'var(--space-2)',
                    opacity: calculatingTeachers ? 0.6 : 1,
                    cursor: calculatingTeachers ? 'not-allowed' : 'pointer'
                  }}>
                  {calculatingTeachers ? (
                    <>
                      <Spinner size={14} />
                      Đang tính toán...
                    </>
                  ) : (
                    <>
                      <Icon.Search />
                      Tìm lại với thông tin mới
                    </>
                  )}
                </button>
                </div>
              </div>
              )}

              {/* --- RESULTS SECTION --- */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {/* Loading State */}
              {calculatingTeachers && (

                <div style={{ 
                  padding: '24px', 
                  textAlign: 'center',
                  color: 'var(--text-tertiary)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 12
                }}>
                  <Spinner size={24} />
                  <div style={{ fontSize: 13 }}>{TEACHER_SCHEDULE_LABELS.CALCULATING_AVAILABLE_TEACHERS}</div>
                </div>
              )}

              {/* Results - Grouped by Category */}
              {!calculatingTeachers && availableTeachers.length > 0 && (
                <div style={{ marginTop: 8, width: '100%', boxSizing: 'border-box', minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)', flexWrap: 'wrap', marginBottom: 16 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <Badge variant="passed" size="lg">
                        {sameCourseAvailableTeachersCount} {TEACHER_SCHEDULE_LABELS.AVAILABLE_SAME_COURSE_TEACHERS_COUNT}
                      </Badge>
                      <Badge variant="default" size="sm">
                        {availableTeachers.length} {TEACHER_SCHEDULE_LABELS.AVAILABLE_TOTAL_REFERENCE}
                      </Badge>
                      <Badge variant="exempt" size="sm">
                        {TEACHER_SCHEDULE_LABELS.EXCLUDED_CURRENT_TEACHERS}
                      </Badge>
                    </div>
                    {!selectedSlot && (() => {
                      const courseLineOptions = [
                        { value: 'Coding', label: 'Coding' },
                        { value: 'Robotics', label: 'Robotics' },
                        { value: 'Art', label: 'Art' },
                        { value: 'Others', label: 'Khác' }
                      ];
                      
                      return (
                        <div style={{ minWidth: 200, flex: '1 1 200px', maxWidth: 300 }}>
                          <MultiSelect menuPosition="fixed"
                            options={courseLineOptions}
                            selected={coordinationCourseLineFilter}
                            onChange={setCoordinationCourseLineFilter}
                            placeholder="Lọc theo Khối"
                          />
                        </div>
                      );
                    })()}
                  </div>
                  
                  {/* Group by course line match FIRST, then by category */}
                  {(() => {
                    // Apply course line filter if any
                    const filteredTeachers = coordinationCourseLineFilter.length > 0
                      ? availableTeachers.filter(t => {
                          const teacherSchedule = schedules.find(s => s.teacher.id === t.teacher.id);
                          if (!teacherSchedule) return false;
                          const categories = new Set<string>(teacherSchedule.slots.map(s => getCourseLineCategory(s.courseLine, s.className)));
                          return coordinationCourseLineFilter.some(cl => categories.has(cl));
                        })
                      : availableTeachers;

                    if (filteredTeachers.length === 0) {
                      return (
                        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
                          {TEACHER_SCHEDULE_LABELS.NO_AVAILABLE_TEACHER_BY_COURSE}
                        </div>
                      );
                    }

                    const requestCentreId = selectedSlot?.centreId || coordinationRequest.centreId;
                    const requestRegionNames = getCentreRegionNames(centreRegionMap, requestCentreId);
                    
                    const categoryLabels: Record<string, { label: string; icon: React.ReactNode }> = {
                      'has-class-same-centre-adjacent': {
                        label: TEACHER_AVAILABILITY_CATEGORY_LABELS.HAS_CLASS_SAME_CENTRE_ADJACENT,
                        icon: <Icon.Building size={12} />
                      },
                      'has-class-same-centre': {
                        label: TEACHER_AVAILABILITY_CATEGORY_LABELS.HAS_CLASS_SAME_CENTRE,
                        icon: <Icon.Building size={12} />
                      },
                      'completely-free': {
                        label: TEACHER_AVAILABILITY_CATEGORY_LABELS.COMPLETELY_FREE,
                        icon: <Icon.User size={12} />
                      },
                      'has-class-other-centre': {
                        label: TEACHER_AVAILABILITY_CATEGORY_LABELS.HAS_CLASS_OTHER_CENTRE,
                        icon: <Icon.Building size={12} />
                      },
                      'has-class-other-centre-adjacent': {
                        label: TEACHER_AVAILABILITY_CATEGORY_LABELS.HAS_CLASS_OTHER_CENTRE_ADJACENT,
                        icon: <Icon.MapPin size={12} />
                      },
                      'currently-at-centre': {
                        label: TEACHER_AVAILABILITY_CATEGORY_LABELS.CURRENTLY_AT_CENTRE,
                        icon: <Icon.Monitor size={12} />
                      },
                      'currently-at-other-centre': {
                        label: TEACHER_AVAILABILITY_CATEGORY_LABELS.CURRENTLY_AT_OTHER_CENTRE,
                        icon: <Icon.Monitor size={12} />
                      },
                    };

                    const sortedTeachers = [...filteredTeachers].sort((a, b) => {
                      const courseLineDelta = Number(Boolean(b.courseLineMatch)) - Number(Boolean(a.courseLineMatch));
                      if (courseLineDelta !== 0) return courseLineDelta;
                      const sameRegionDelta = Number(Boolean(b.teacher.sameRegionAsRequest)) - Number(Boolean(a.teacher.sameRegionAsRequest));
                      if (sameRegionDelta !== 0) return sameRegionDelta;
                      return b.score - a.score;
                    });

                    const teacherGroups = [
                      {
                        key: 'same-course-same-region',
                        title: requestRegionNames.length > 0
                          ? `${TEACHER_SCHEDULE_LABELS.PRIORITY_SAME_COURSE_SAME_REGION_GROUP} (${requestRegionNames.join(', ')})`
                          : TEACHER_SCHEDULE_LABELS.PRIORITY_SAME_COURSE_SAME_REGION_GROUP,
                        icon: <Icon.CheckCircle size={14} />,
                        color: 'var(--status-success)',
                        teachers: sortedTeachers.filter(ta => ta.courseLineMatch && ta.teacher.sameRegionAsRequest),
                      },
                      {
                        key: 'same-course-other-region',
                        title: TEACHER_SCHEDULE_LABELS.SAME_COURSE_OTHER_REGION_GROUP,
                        icon: <Icon.MapPin size={14} />,
                        color: 'var(--brand-indigo)',
                        teachers: sortedTeachers.filter(ta => ta.courseLineMatch && !ta.teacher.sameRegionAsRequest && ta.teacher.mainCentreId),
                      },
                      {
                        key: 'same-course-unknown-region',
                        title: TEACHER_SCHEDULE_LABELS.SAME_COURSE_UNKNOWN_REGION_GROUP,
                        icon: <Icon.AlertCircle size={14} />,
                        color: 'var(--text-tertiary)',
                        teachers: sortedTeachers.filter(ta => ta.courseLineMatch && !ta.teacher.sameRegionAsRequest && !ta.teacher.mainCentreId),
                      },
                      {
                        key: 'other-course',
                        title: TEACHER_SCHEDULE_LABELS.OTHER_COURSE_GROUP,
                        icon: <Icon.XCircle size={14} />,
                        color: 'var(--text-tertiary)',
                        teachers: sortedTeachers.filter(ta => !ta.courseLineMatch),
                      },
                    ].filter(group => group.teachers.length > 0);

                    const renderTeacherRow = (ta: TeacherAvailability, index: number, total: number) => {
                      const teacherName = ta.teacher.fullName || ta.teacher.username;
                      const workCentres = ta.teacher.workCentres?.filter(centre => centre.id !== ta.teacher.mainCentreId) || [];
                      const regionText = ta.teacher.regionNames?.length ? ta.teacher.regionNames.join(', ') : TEACHER_SCHEDULE_LABELS.UNKNOWN_REGION;
                      const relatedSlotText = ta.relatedSlot
                        ? `${ta.isRelatedSlotBefore ? TEACHER_SCHEDULE_LABELS.TAUGHT_PREFIX : TEACHER_SCHEDULE_LABELS.WILL_TEACH_PREFIX}: ${ta.relatedSlot.className} (${formatTime(ta.relatedSlot.startTime)} - ${formatTime(ta.relatedSlot.endTime)})${ta.relatedSlot.centreId !== requestCentreId ? ` tại ${ta.relatedSlot.centreShortName}` : ''}`
                        : null;

                      return (
                        <div
                          key={ta.teacher.id}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: isMobile ? '1fr' : 'minmax(210px, 1fr) minmax(150px, 0.75fr) minmax(280px, 1.45fr) auto',
                            gap: isMobile ? 'var(--space-2)' : 'var(--space-3)',
                            padding: 'var(--space-3) var(--space-4)',
                            borderBottom: index < total - 1 ? '1px solid var(--border-secondary)' : 'none',
                            background: 'var(--bg-surface)',
                            alignItems: 'center',
                          }}
                        >
                          <div style={{ minWidth: 0 }}>
                            <div style={{
                              fontSize: 13,
                              fontWeight: 600,
                              color: 'var(--text-primary)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}>
                              {teacherName}
                            </div>
                            <div style={{
                              fontSize: 11,
                              color: 'var(--text-tertiary)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}>
                              {ta.teacher.email}
                            </div>
                          </div>

                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 590, color: ta.teacher.sameRegionAsRequest ? 'var(--status-success)' : 'var(--text-secondary)' }}>
                              {ta.teacher.mainCentreName || TEACHER_SCHEDULE_LABELS.NO_MAIN_CENTRE}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2, lineHeight: 1.35, whiteSpace: 'normal', overflowWrap: 'anywhere' }}>
                              {TEACHER_SCHEDULE_LABELS.REGION}: {regionText}
                            </div>
                            {workCentres.length > 0 && (
                              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2, lineHeight: 1.35, whiteSpace: 'normal', overflowWrap: 'anywhere' }}>
                                {TEACHER_SCHEDULE_LABELS.WORK_CENTRES}: {workCentres.map(centre => centre.name).join(', ')}
                              </div>
                            )}
                          </div>

                          <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', fontSize: 11, color: 'var(--text-tertiary)' }}>
                              {(relatedSlotText || (ta.conflictSlots && ta.conflictSlots.length > 0) || (ta.totalHoursToday !== undefined && ta.totalHoursToday > 0)) && (
                                <>
                                {ta.totalHoursToday !== undefined && ta.totalHoursToday > 0 && (
                                  <span style={{ display: 'inline-flex', alignItems: 'flex-start', gap: 4 }}>
                                    <Icon.Clock size={10} />
                                    <span>{TEACHER_SCHEDULE_LABELS.HOURS_TAUGHT_TODAY} {ta.totalHoursToday}{TEACHER_SCHEDULE_LABELS.HOURS_IN_DAY}</span>
                                  </span>
                                )}
                                {relatedSlotText && (
                                  <span style={{ display: 'inline-flex', alignItems: 'flex-start', gap: 4 }}>
                                    <Icon.Building size={10} />
                                    <span>{relatedSlotText}</span>
                                  </span>
                                )}
                                {ta.conflictSlots && ta.conflictSlots.length > 0 && (
                                  <span style={{ display: 'inline-flex', alignItems: 'flex-start', gap: 4, color: 'var(--status-warning)' }}>
                                    <Icon.Monitor size={10} />
                                    <span>{TEACHER_SCHEDULE_LABELS.TEACHING_PREFIX}: {ta.conflictSlots[0].className} ({formatTime(ta.conflictSlots[0].startTime)} - {formatTime(ta.conflictSlots[0].endTime)})</span>
                                  </span>
                                )}
                                </>
                              )}
                            </div>
                          </div>

                          {selectedSlot && (
                            <button
                              type="button"
                              className={styles.primaryBtn}
                              onClick={() => handleAddSupplyTeacher(ta)}
                              disabled={addingSupplyTeacherId !== null}
                              style={{
                                justifyContent: 'center',
                                width: isMobile ? '100%' : 'auto',
                                opacity: addingSupplyTeacherId !== null && addingSupplyTeacherId !== ta.teacher.id ? 0.5 : 1,
                              }}
                            >
                              {addingSupplyTeacherId === ta.teacher.id ? (
                                <>
                                  <Spinner size={12} /> {TEACHER_SCHEDULE_LABELS.ADDING_TEACHER}
                                </>
                              ) : (
                                <>
                                  <Icon.Plus size={12} /> {TEACHER_SCHEDULE_LABELS.ADD_TO_CLASS}
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      );
                    };

                    const renderShortlistGroup = (group: (typeof teacherGroups)[number]) => {
                      const isExpanded = expandedGroups[group.key] !== false;
                      const toggleGroup = () => {
                        setExpandedGroups(prev => ({ ...prev, [group.key]: !prev[group.key] }));
                      };
                      const groupedByCategory = group.teachers.reduce((acc, ta) => {
                        const category = ta.category || 'has-class-other-centre';
                        if (!acc[category]) acc[category] = [];
                        acc[category].push(ta);
                        return acc;
                      }, {} as Record<string, typeof group.teachers>);
                      const primaryCategories = TEACHER_AVAILABILITY_CATEGORY_ORDER
                        .map(categoryKey => ({
                          key: categoryKey,
                          teachers: groupedByCategory[categoryKey],
                          label: categoryLabels[categoryKey],
                          color: group.color,
                        }))
                        .filter(category => category.teachers?.length);
                      const referenceCategories = TEACHER_AVAILABILITY_REFERENCE_CATEGORY_ORDER
                        .map(categoryKey => ({
                          key: categoryKey,
                          teachers: groupedByCategory[categoryKey],
                          label: categoryLabels[categoryKey],
                          color: 'var(--text-tertiary)',
                        }))
                        .filter(category => category.teachers?.length);
                      const orderedCategories = [...primaryCategories, ...referenceCategories];

                      return (
                        <div key={group.key} className={styles.tableSection} style={{ marginBottom: 'var(--space-3)' }}>
                          <TableGroupHeader
                            title={group.title}
                            count={group.teachers.length}
                            icon={group.icon}
                            isExpanded={isExpanded}
                            onToggle={toggleGroup}
                          />
                          <AnimatePresence initial={false}>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                style={{ overflow: 'hidden' }}
                              >
                                <div className={styles.tableScrollWrapper}>
                                  <div style={{ minWidth: isMobile ? 0 : 860 }}>
                                    <div style={{
                                      display: isMobile ? 'none' : 'grid',
                                      gridTemplateColumns: 'minmax(210px, 1fr) minmax(150px, 0.75fr) minmax(280px, 1.45fr) auto',
                                      gap: 'var(--space-3)',
                                      padding: '8px 16px',
                                      background: 'var(--bg-panel)',
                                      borderBottom: '1px solid var(--border-primary)',
                                      fontSize: 10,
                                      fontWeight: 700,
                                      color: 'var(--text-quaternary)',
                                      textTransform: 'uppercase',
                                      letterSpacing: '0.02em',
                                    }}>
                                      <div>{TEACHER_SCHEDULE_LABELS.TEACHER_COLUMN}</div>
                                      <div>{TEACHER_SCHEDULE_LABELS.MAIN_CENTRE}</div>
                                      <div>{TEACHER_SCHEDULE_LABELS.REASON_INFO_COLUMN}</div>
                                      <div>{TEACHER_SCHEDULE_LABELS.ADD_TO_CLASS}</div>
                                    </div>

                                    {orderedCategories.map(category => {
                                      const categoryTeachers = category.teachers;
                                      if (!categoryTeachers || categoryTeachers.length === 0) return null;

                                      const subGroupKey = `${group.key}-${category.key}`;
                                      const subExpanded = expandedGroups[subGroupKey] !== false;
                                      return (
                                        <Fragment key={subGroupKey}>
                                          <SubTableGroupHeader
                                            title={category.label?.label || category.key}
                                            count={categoryTeachers.length}
                                            icon={category.label?.icon}
                                            color={category.color}
                                            isExpanded={subExpanded}
                                            onToggle={() => setExpandedGroups(prev => ({ ...prev, [subGroupKey]: !prev[subGroupKey] }))}
                                          />
                                          <AnimatePresence initial={false}>
                                            {subExpanded && (
                                              <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                style={{ overflow: 'hidden' }}
                                              >
                                                {categoryTeachers.map((ta, index) => renderTeacherRow(ta, index, categoryTeachers.length))}
                                              </motion.div>
                                            )}
                                          </AnimatePresence>
                                        </Fragment>
                                      );
                                    })}
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    };

                    return (
                      <>
                        {teacherGroups.map(group => renderShortlistGroup(group))}
                      </>
                    );
                  })()}
                </div>
              )}

              {/* No results message */}
              {!calculatingTeachers && availableTeachers.length === 0 && selectedSlot && (
                <div style={{
                  border: '1px solid var(--border-primary)',
                  borderRadius: 'var(--radius-comfortable)',
                  background: 'var(--bg-surface)',
                }}>
                  <EmptyState
                    icon={<Icon.AlertCircle size={32} />}
                    title={TEACHER_SCHEDULE_LABELS.NO_AVAILABLE_TEACHER}
                    subtitle={TEACHER_SCHEDULE_LABELS.NO_AVAILABLE_TEACHER_DESC}
                  />
                </div>
              )}
            </div>
            </div>
            </div>
            </div> {/* Close inner wrapper */}
          </div>
        </Modal>
        <CSVExportSettings
          isOpen={showScheduleCSVSettings}
          onClose={() => setShowScheduleCSVSettings(false)}
          columns={scheduleCsvColumns}
          onSave={saveScheduleCsvColumns}
          title="Cài đặt xuất CSV - Lịch vận hành"
        />
      </PageLayout>
    </>
    </ProtectedPage>
  );
}

// Improved table styling
/* Improved table styling */
/* Improved table layouts */
/* Enhanced responsive design */

/* Enhanced table styling */
