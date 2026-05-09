'use client';

import { useEffect, useState, useMemo, useCallback, useRef, memo, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, ComposedChart, Line, LineChart,
  Area, AreaChart, Legend
} from 'recharts';
import { useAuth } from '@/lib/AuthContext';
import { loadSession } from '@/services/authService';
import { fetchAllCentres, Centre } from '@/services/centresService';
import { getCache, setCache, clearCache } from '@/lib/idb';
import { getCourseLineCategory } from '@/lib/courseCategories';
import { getNavItemsWithRouter } from '@/lib/navigation';
import { useAllowedPages } from '@/hooks/useAllowedPages';
import { addSupplyTeacherToSession, fetchClassTeacherSchedules, fetchTeacherSchedules, findAvailableTeachers } from '@/services/teacherScheduleService';
import { searchUsers } from '@/services/ticketService';
import { TeacherSchedule, TeacherScheduleSlot, CoordinationRequest, TeacherAvailability, Teacher } from '@/types/teacherSchedule';
import { LmsUser } from '@/types/ticket';
import { PageLayout } from '@/components/PageLayout';
import {
  Icon,
  Toolbar,
  StatCard,
  ChartSectionHeader,
  TableToolbar,
  TableGroupHeader,
  Modal,
  ModalHeader,
  EmptyState,
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
} from '@/components/ui';
import { useQuickFilterChips } from '@/hooks/useUserPreferences';
import { CACHE_KEYS, LABELS, MESSAGES, ENTITIES, CHART_COLORS } from '@/constants';
import { useSharedDateRange, useSharedCentres } from '@/hooks/useSharedFilterState';
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
  return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('vi-VN');
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
          reasons.push('Có lớp liền kề tại cùng cơ sở');
          score += 30;
        } else if (closestGap! <= 30) {
          reasons.push('Có lớp tại cùng cơ sở');
          score += 20;
        } else {
          reasons.push('Có lớp tại cùng cơ sở');
          score += 10;
        }
      } else {
        reasons.push('Có lớp tại cùng cơ sở');
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
        reasons.push('Hoàn toàn rảnh trong ngày');
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
            reasons.push('Có lớp liền kề tại cơ sở khác');
          } else if (closestGap! <= 60) {
            reasons.push('Có lớp tại cơ sở khác');
          } else {
            reasons.push('Có lớp tại cơ sở khác');
          }
        } else {
          reasons.push('Có lớp tại cơ sở khác');
        }
      }
    }
    
    // Penalty for heavy workload
    if (totalHours >= 6) {
      score -= 20;
      reasons.push('Đã dạy nhiều giờ');
    }
    
    const reason = reasons.length > 0 ? reasons.join(' • ') : 'Giáo viên rảnh';
    
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
  slotMap: Map<string, any[]>;
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
                  const daySlots = slotMap.get(key) || [];
                  
                  const slotsByCentre = daySlots.reduce((acc, slot) => {
                    const k = slot.centreShortName;
                    if (!acc[k]) acc[k] = [];
                    acc[k].push(slot);
                    return acc;
                  }, {} as Record<string, any[]>);
                  
                  Object.keys(slotsByCentre).forEach(centreName => {
                    slotsByCentre[centreName].sort((a: any, b: any) => {
                      if (a.type !== b.type) return a.type === 'class' ? -1 : 1;
                      
                      const getCourseOrder = (slot: any) => {
                        if (!slot.courseLine) return 4;
                        const line = slot.courseLine.toUpperCase();
                        if (line.match(/C4K|C4T|JSA|JSI|PYA|WEB|GAME|PRO|CODING|PYTHON|CSB|CSI|1:1/)) return 1;
                        if (line.includes('ROB')) return 2;
                        if (line.includes('ART') || line.includes('XART')) return 3;
                        return 4;
                      };
                      const orderA = getCourseOrder(a);
                      const orderB = getCourseOrder(b);
                      if (orderA !== orderB) return orderA - orderB;
                      return (a.className || '').localeCompare(b.className || '');
                    });
                  });

                  return (
                    <div key={`${day.date}-${timeSlot.time}-collapsed`} style={{ 
                      background: 'var(--bg-surface)', 
                      padding: daySlots.length > 0 ? 'var(--space-2)' : '24px 0 0 0', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      alignItems: 'flex-start',
                      justifyContent: daySlots.length > 0 ? 'flex-start' : 'center',
                      gap: 8, 
                      minHeight: 44,
                    }}>
                      {daySlots.length > 0 ? (
                        Object.entries(slotsByCentre).map(([centreName, centreSlots]: [string, any]) => {
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
                                  } else if (slot.courseLine) {
                                    const courseLineUpper = slot.courseLine.toUpperCase();
                                    if (courseLineUpper.includes('ART') || courseLineUpper.includes('XART')) {
                                      accentColor = isOfficeHour ? '#fbbf24' : '#b45309';
                                      borderColor = isOfficeHour ? '#fde68a' : 'var(--status-warning)';
                                    } else if (courseLineUpper.includes('ROB')) {
                                      accentColor = isOfficeHour ? '#60a5fa' : '#1e40af';
                                      borderColor = isOfficeHour ? 'rgba(94, 106, 210, 0.3)' : 'var(--brand-indigo)';
                                    } else if (courseLineUpper.match(/C4K|C4T|JSA|JSI|PYA|WEB|GAME|PRO|CODING|PYTHON|CSB|CSI|1:1/)) {
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
                        })
                      ) : (
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
                  const daySlots = slotMap.get(key) || [];

                // Group by centre, then sort by course line within each centre
                const slotsByCentre = daySlots.reduce((acc, slot) => {
                  const k = slot.centreShortName;
                  if (!acc[k]) acc[k] = [];
                  acc[k].push(slot);
                  return acc;
                }, {} as Record<string, any[]>);
                
                Object.keys(slotsByCentre).forEach(centreName => {
                  slotsByCentre[centreName].sort((a: any, b: any) => {
                    if (a.type !== b.type) return a.type === 'class' ? -1 : 1;
                    
                    const getCourseOrder = (slot: typeof daySlots[0]) => {
                      if (!slot.courseLine) return 4;
                      const line = slot.courseLine.toUpperCase();
                      if (line.match(/C4K|C4T|JSA|JSI|PYA|WEB|GAME|PRO|CODING|PYTHON|CSB|CSI|1:1/)) return 1;
                      if (line.includes('ROB')) return 2;
                      if (line.includes('ART') || line.includes('XART')) return 3;
                      return 4;
                    };
                    const orderA = getCourseOrder(a);
                    const orderB = getCourseOrder(b);
                    if (orderA !== orderB) return orderA - orderB;
                    return (a.className || '').localeCompare(b.className || '');
                  });
                });

                return (
                  <div key={`${day.date}-${timeSlot.time}`} style={{ background: 'var(--bg-surface)', padding: 'var(--space-2)', minHeight: 120, display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                    {Object.entries(slotsByCentre).map(([centreName, centreSlots]: [string, any]) => (
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
                            <ClassCard key={slot.id} slot={slot} onClick={() => onCardClick(slot)} />
                          ))}
                        </div>
                      </div>
                    ))}
                    
                    {/* Empty State */}
                    {daySlots.length === 0 && (
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
    
    if (slot.courseLine) {
      const courseLineUpper = slot.courseLine.toUpperCase();
      
      // Increased contrast: class (darker/saturated), office-hour (much lighter/desaturated)
      if (courseLineUpper.includes('ART') || courseLineUpper.includes('XART')) {
        accentColor = isOfficeHour ? '#fbbf24' : '#b45309'; // Art: light amber vs dark amber
        borderColor = isOfficeHour ? '#fde68a' : 'var(--status-warning)';
      } else if (courseLineUpper.includes('ROB')) {
        accentColor = isOfficeHour ? '#60a5fa' : '#1e40af'; // Robotics: light blue vs dark blue
        borderColor = isOfficeHour ? 'rgba(94, 106, 210, 0.3)' : 'var(--brand-indigo)';
      } else if (courseLineUpper.match(/C4K|C4T|JSA|JSI|PYA|WEB|GAME|PRO|CODING|PYTHON|CSB|CSI|1:1/)) {
        accentColor = isOfficeHour ? '#34d399' : '#047857'; // Coding: light green vs dark green
        borderColor = isOfficeHour ? '#a7f3d0' : 'var(--status-emerald)';
      }
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
      {slot.type === 'class' && slot.sessionHour !== undefined && (
        <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginBottom: 4 }}>
          Buổi {slot.sessionHour || '—'}
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
  const [teachers, setTeachers] = useState<LmsUser[]>([]);
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
  const [selectedCentres, setSelectedCentres, centresLoaded] = useSharedCentres();

  // ── Filter states ──────────────────────────────────────────────────────────
  const [selectedTeachers, setSelectedTeachers] = useState<string[]>([]);
  const [selectedCourseLines, setSelectedCourseLines] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'calendar' | 'table-all' | 'table-individual'>('calendar');
  
  // ── Week navigation state ──────────────────────────────────────────────────
  const [currentWeekIndex, setCurrentWeekIndex] = useState(0);
  
  // ── Table filter states ────────────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState('');
  const [tableSelectedCentres, setTableSelectedCentres] = useState<string[]>([]);
  const [tableSelectedCourseLines, setTableSelectedCourseLines] = useState<string[]>([]);
  const [tableSelectedTypes, setTableSelectedTypes] = useState<string[]>([]); // Lớp học / Ca trải nghiệm
  const [tableSelectedStatuses, setTableSelectedStatuses] = useState<string[]>([]); // Trạng thái lớp
  const [tableProgressFrom, setTableProgressFrom] = useState<string>(''); // Tiến độ từ buổi
  const [tableProgressTo, setTableProgressTo] = useState<string>(''); // Tiến độ đến buổi
  
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
  
  // ── Group expansion states for teacher categorization ──────────────────────
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    'match': true,      // Default expand "Đúng khối"
    'no-match': false   // Default collapse "Khối khác"
  });
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  const abortRef = useRef<AbortController | null>(null);

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

  // ── Data Fetching ───────────────────────────────────────────────────────────
  const loadData = useCallback(async (start: string, end: string) => {
    if (!start || !end) return;
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;

    setLoading(true);
    setProgress({ loaded: 0, total: 100 });
    setSchedules([]);

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

      // Note: Teachers are loaded on-demand in coordination panel, not here
      // to avoid API issues with empty search

      // Fetch schedules
      const dateFrom = new Date(start);
      const dateTo = new Date(end);
      dateTo.setHours(23, 59, 59, 999);

      const result = await fetchTeacherSchedules(
        dateFrom,
        dateTo,
        selectedCentres.length > 0 ? selectedCentres : undefined,
        selectedTeachers.length > 0 ? selectedTeachers : undefined,
        (loaded, total) => setProgress({ loaded, total: total || Math.max(loaded, 1) }),
        signal
      );

      if (!signal.aborted) {
        setSchedules(result);
        await setCache(CACHE_KEYS.TEACHER_SCHEDULE, {
          schedules: result,
          selectedTeachers,
          timestamp: Date.now(),
        });
        addToast(`Đã tải ${result.length} lịch giáo viên`, 'success');
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
  }, [centres, teachers, selectedCentres, selectedTeachers, addToast]);

  const handleCancelFetch = () => {
    if (abortRef.current) {
      abortRef.current.abort();
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
    
    // Open modal immediately
    setShowCoordinationPanel(true);
    
    setTimeout(() => {
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
      const filteredAvailable = available.filter(ta => !currentTeacherIds.has(ta.teacher.id));
      
      setAvailableTeachers(filteredAvailable);
      setUnavailableTeachers([]);
      setCalculatingTeachers(false);
      
      // Show toast with result
      if (filteredAvailable.length > 0) {
        addToast(`Tìm thấy ${filteredAvailable.length} giáo viên rảnh`, 'success');
      } else {
        addToast('Không có giáo viên rảnh trong khung giờ này', 'info');
      }
    }, 0);
  }, [schedules, addToast]);

  const handleSearchAvailableTeachers = useCallback(() => {
    if (!coordinationRequest.date || !coordinationRequest.centreId) {
      addToast('Vui lòng chọn ngày và cơ sở', 'info');
      return;
    }

    setCalculatingTeachers(true);
    
    setTimeout(() => {
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
      
      setAvailableTeachers(filteredAvailable);
      setUnavailableTeachers([]);
      setCalculatingTeachers(false);
      
      if (filteredAvailable.length > 0) {
        addToast(`Tìm thấy ${filteredAvailable.length} giáo viên rảnh`, 'success');
      } else {
        addToast('Không có giáo viên rảnh trong khung giờ này', 'info');
      }
    }, 0);
  }, [coordinationRequest, schedules, selectedSlot, addToast]);

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
        selectedTeachers,
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

        setAvailableTeachers(available);
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
  }, [addToast, schedules, selectedSlot, selectedTeachers]);

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
      addToast('Đang thêm giáo viên vào lớp...', 'info');

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

        const cached = await getCache(CACHE_KEYS.TEACHER_SCHEDULE);
        if (cached) {
          if (cached.selectedTeachers) setSelectedTeachers(cached.selectedTeachers);
          if (cached.schedules) setSchedules(cached.schedules);
        }
      } catch (e) {
        console.error('State parse error', e);
      }
    })();
  }, []);

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

  // Course line options for filtering
  const courseLineOptions: SelectOption[] = useMemo(() => {
    return [
      { value: 'Coding', label: 'Coding' },
      { value: 'Robotics', label: 'Robotics' },
      { value: 'Art', label: 'Art' },
      { value: 'Others', label: 'Others' },
    ];
  }, []);

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
    return schedules.filter(schedule => {
      const matchesCentre = selectedCentres.length === 0 || 
        schedule.slots.some(slot => selectedCentres.includes(slot.centreId));
      
      const matchesTeacher = selectedTeachers.length === 0 || 
        selectedTeachers.includes(schedule.teacher.id);
      
      const matchesCourseLine = selectedCourseLines.length === 0 ||
        schedule.slots.some(slot => {
          const category = getCourseLineCategory(slot.courseLine, slot.className);
          return selectedCourseLines.includes(category);
        });
      
      return matchesCentre && matchesTeacher && matchesCourseLine;
    });
  }, [schedules, selectedCentres, selectedTeachers, selectedCourseLines]);

  // ── Calendar View Data ──────────────────────────────────────────────────────
  
  // Calculate all weeks in the date range
  const allWeeks = useMemo(() => {
    if (!fromDate || !toDate) return [];
    
    const weeks: Date[][] = [];
    const start = new Date(fromDate);
    const end = new Date(toDate);
    
    // Start from Monday of the first week
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
  }, [fromDate, toDate]);
  
  // Reset currentWeekIndex when date range changes
  useEffect(() => {
    setCurrentWeekIndex(0);
  }, [fromDate, toDate]);

  /**
   * Dynamically generate TIME_SLOTS from actual schedule data.
   * Uses exact startTime-endTime pairs. Each unique time range gets its own row.
   * Only scans slots that fall within the CURRENT WEEK to avoid empty rows.
   */
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
        
        // Skip slots not in this week
        if (start < weekStart || start > weekEnd) return;
        
        const end = new Date(slot.endTime);
        const startStr = start.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
        const endStr = end.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
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
        // Same start time: sort by end time
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
    if (viewMode === 'calendar') {
      // For calendar view, calculate stats based on current week only
      if (allWeeks.length === 0 || !allWeeks[currentWeekIndex]) {
        return { totalTeachers: 0, totalSlots: 0, avgSlotsPerTeacher: '0' };
      }
      
      const currentWeekDates = allWeeks[currentWeekIndex];
      const weekStart = new Date(currentWeekDates[0]);
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(currentWeekDates[6]);
      weekEnd.setHours(23, 59, 59, 999);
      
      // Count unique teachers and slots for current week only
      const teachersInWeek = new Set<string>();
      let slotsInWeek = 0;
      
      filteredSchedulesForCalendar.forEach(schedule => {
        let hasSlotInWeek = false;
        schedule.slots.forEach(slot => {
          const slotStartTime = new Date(slot.startTime);
          if (slotStartTime >= weekStart && slotStartTime <= weekEnd) {
            slotsInWeek++;
            hasSlotInWeek = true;
          }
        });
        if (hasSlotInWeek) {
          teachersInWeek.add(schedule.teacher.id);
        }
      });
      
      const totalTeachers = teachersInWeek.size;
      const avgSlotsPerTeacher = totalTeachers > 0 ? (slotsInWeek / totalTeachers).toFixed(1) : '0';
      
      return {
        totalTeachers,
        totalSlots: slotsInWeek,
        avgSlotsPerTeacher,
      };
    } else {
      // For table view, use all schedules
      const totalTeachers = schedules.length;
      const totalSlots = schedules.reduce((sum, s) => sum + s.slots.length, 0);
      const avgSlotsPerTeacher = totalTeachers > 0 ? (totalSlots / totalTeachers).toFixed(1) : '0';
      
      return {
        totalTeachers,
        totalSlots,
        avgSlotsPerTeacher,
      };
    }
  }, [schedules, filteredSchedulesForCalendar, viewMode, allWeeks, currentWeekIndex]);
  
  // Get calendar data for current week
  const calendarData = useMemo(() => {
    if (allWeeks.length === 0) return [];
    
    const weekDates = allWeeks[currentWeekIndex] || allWeeks[0];
    
    return weekDates.map(date => {
      const dateStr = date.toISOString().split('T')[0];
      const dayOfWeek = DAYS_OF_WEEK[date.getDay()];
      
      return {
        date: dateStr,
        dayOfWeek,
        dayLabel: `${dayOfWeek} ${date.getDate()}/${date.getMonth() + 1}`,
      };
    });
  }, [allWeeks, currentWeekIndex]);

  /**
   * Pre-compute slot lookup map for CalendarGrid.
   * Key: `${date}-${startTimeStr}` where startTimeStr matches the start of the TIME_SLOT
   * Value: array of slots (with teacher injected) that belong to that time row
   * 
   * DEDUPLICATION: Each class (className+teacherId+date) only appears in ONE row.
   * Priority: type 'class' over 'office-hour', then longest duration.
   * This prevents a class from showing up in both '18:30 - 19:30' and '18:30 - 20:30'.
   */
  const calendarSlotMap = useMemo(() => {
    const map = new Map<string, any[]>();
    
    if (allWeeks.length === 0 || !allWeeks[currentWeekIndex]) return map;
    
    const currentWeekDates = allWeeks[currentWeekIndex];
    const weekStart = currentWeekDates[0];
    const weekEnd = currentWeekDates[6];
    
    const weekStartTime = new Date(weekStart);
    weekStartTime.setHours(0, 0, 0, 0);
    const weekEndTime = new Date(weekEnd);
    weekEndTime.setHours(23, 59, 59, 999);
    
    // Step 1: Collect all slot entries for this week, compute their time range key
    type SlotEntry = { slot: any; teacher: any; slotDate: string; startStr: string; endStr: string; durationMs: number };
    const allEntries: SlotEntry[] = [];
    
    filteredSchedulesForCalendar.forEach(schedule => {
      schedule.slots.forEach((slot: any) => {
        const slotStart = new Date(slot.startTime);
        const slotEnd = new Date(slot.endTime);
        
        if (slotStart < weekStartTime || slotStart > weekEndTime) return;
        
        const slotDate = slotStart.toISOString().split('T')[0];
        const startStr = slotStart.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
        const endStr = slotEnd.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
        const durationMs = slotEnd.getTime() - slotStart.getTime();
        
        allEntries.push({
          slot: { ...slot, teacher: schedule.teacher },
          teacher: schedule.teacher,
          slotDate,
          startStr,
          endStr,
          durationMs,
        });
      });
    });
    
    // Step 2: Deduplicate — each class session appears once, even when it has LEC/TA/SUPPLY.
    // (prefer type 'class' over 'office-hour', then longest duration)
    const bestEntryMap = new Map<string, SlotEntry>();
    
    allEntries.forEach(entry => {
      const dedupeKey = entry.slot.type === 'class'
        ? `class-${entry.slot.classId || entry.slot.className}-${entry.slot.sessionId || entry.startStr}-${entry.slotDate}`
        : `${entry.slot.className || entry.slot.id}-${entry.teacher.id}-${entry.slotDate}`;
      const existing = bestEntryMap.get(dedupeKey);
      const entrySessionTeachers = getSlotSessionTeacherItems(entry.slot);
      
      if (!existing) {
        const lecTeacher = entrySessionTeachers.find((item: NonNullable<TeacherScheduleSlot['sessionTeachers']>[number]) =>
          (item.roleShortName || item.roleName || '').toUpperCase() === 'LEC'
        )?.teacher;
        bestEntryMap.set(dedupeKey, {
          ...entry,
          slot: {
            ...entry.slot,
            sessionTeachers: entrySessionTeachers,
            teacher: lecTeacher || entry.slot.teacher || entry.teacher,
          },
        });
      } else {
        const mergedSessionTeachers = mergeSessionTeachers(
          existing.slot.sessionTeachers,
          entrySessionTeachers,
        );
        const lecTeacher = mergedSessionTeachers.find(item =>
          (item.roleShortName || item.roleName || '').toUpperCase() === 'LEC'
        )?.teacher;
        const mergedEntry: SlotEntry = {
          ...existing,
          durationMs: Math.max(existing.durationMs, entry.durationMs),
          slot: {
            ...existing.slot,
            sessionTeachers: mergedSessionTeachers,
            teacher: lecTeacher || existing.slot.teacher || entry.slot.teacher || existing.teacher,
          },
        };

        // Prefer 'class' type over 'office-hour'
        const entryIsClass = entry.slot.type === 'class';
        const existingIsClass = existing.slot.type === 'class';
        if (entryIsClass && !existingIsClass) {
          bestEntryMap.set(dedupeKey, {
            ...entry,
            slot: {
              ...entry.slot,
              sessionTeachers: mergedSessionTeachers,
              teacher: lecTeacher || entry.slot.teacher || existing.slot.teacher || entry.teacher,
            },
          });
        } else if (entryIsClass === existingIsClass && entry.durationMs > existing.durationMs) {
          // Same type: prefer longer duration
          bestEntryMap.set(dedupeKey, {
            ...entry,
            slot: {
              ...entry.slot,
              sessionTeachers: mergedSessionTeachers,
              teacher: lecTeacher || entry.slot.teacher || existing.slot.teacher || entry.teacher,
            },
          });
        } else {
          bestEntryMap.set(dedupeKey, mergedEntry);
        }
      }
    });
    
    // Step 3: Build the map from deduplicated entries
    bestEntryMap.forEach(entry => {
      const key = `${entry.slotDate}-${entry.startStr} - ${entry.endStr}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(entry.slot);
    });
    
    return map;
  }, [filteredSchedulesForCalendar, allWeeks, currentWeekIndex, dynamicTimeSlots]);

  // Allowed pages (for navigation filtering)
  const { allowedPages } = useAllowedPages();

  const navItems = getNavItemsWithRouter('teacher-schedule', router, allowedPages);

  const _displayName = session?.displayName?.trim() || '';
  const _email = session?.email || '';
  const userAvatar = _displayName ? initials(_displayName) : _email.charAt(0).toUpperCase();
  const userName = _displayName || _email.split('@')[0];

  return (
    <>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <PageLayout
        title="Lịch Giảng dạy"
        activePage="teacher-schedule"
        sidebarOpen={sidebarOpen}
        onSidebarToggle={setSidebarOpen}
      >
        {/* TOOLBAR */}
        <Toolbar
          centres={centres}
          selectedCentres={selectedCentres}
          onCentresChange={setSelectedCentres}
          centresLoading={loading && centres.length === 0}
          dateFrom={fromDate}
          dateTo={toDate}
          onDateFromChange={setFromDate}
          onDateToChange={setToDate}
          onFetch={() => loadData(fromDate, toDate)}
          onCancel={handleCancelFetch}
          loading={loading}
          progress={progress}
          hasData={schedules.length > 0}
          onClearCache={() => {
            setSchedules([]);
            clearCache(CACHE_KEYS.TEACHER_SCHEDULE);
          }}
          showRegionQuickSelect={true}
          quickFilterSlots={
            hasPreferences && (
              <QuickFilterChips
                centres={centres}
                selectedCentres={selectedCentres}
                onCentresChange={setSelectedCentres}
                selectedCourses={selectedCourseLines}
                onCoursesChange={setSelectedCourseLines}
                showCentres={true}
                showCourses={true}
              />
            )
          }
        />

        {/* KPI Stats */}
        {(stats.totalTeachers > 0 || loading) && (
          <motion.div className={styles.statsGrid} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <StatCard label="TỔNG GIÁO VIÊN" value={String(stats.totalTeachers)} desc="Giáo viên có lịch" delay={0.0} />
            <StatCard label="TỔNG CA DẠY" value={String(stats.totalSlots)} desc="Ca dạy trong kỳ" delay={0.07} />
            <StatCard label="TRUNG BÌNH" value={stats.avgSlotsPerTeacher} desc="Ca/giáo viên" delay={0.14} />
          </motion.div>
        )}

        {/* Coordination Panel Button */}
        {schedules.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <button
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
              className={styles.primaryBtn}
              style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <Icon.Search />
              Tìm giáo viên rảnh để điều phối
            </button>
          </div>
        )}

        {/* Charts */}
        {schedules.length > 0 && filteredSchedulesForCalendar.length > 0 && (
          <TeacherStatsChart schedules={filteredSchedulesForCalendar} />
        )}

        {/* View Mode Toggle */}
        {schedules.length > 0 && (
          <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)', padding: '0 var(--space-1)' }}>
            <button
              className={viewMode === 'calendar' ? styles.primaryBtn : styles.clearCacheBtn}
              onClick={() => setViewMode('calendar')}
              style={{ flex: 1, justifyContent: 'center', fontSize: 13, padding: '7px 12px' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              Lịch tuần
            </button>
            <button
              className={viewMode === 'table-all' ? styles.primaryBtn : styles.clearCacheBtn}
              onClick={() => setViewMode('table-all')}
              style={{ flex: 1, justifyContent: 'center', fontSize: 13, padding: '7px 12px' }}>
              <Icon.Table /> Bảng tổng hợp
            </button>
          </div>
        )}

        {/* Calendar View */}
        {viewMode === 'calendar' && schedules.length > 0 && (
          <>
            {/* Calendar Toolbar */}
            <TableToolbar
              search=""
              onSearchChange={() => {}}
              searchPlaceholder=""
              quickFilterSlots={
                <>
                  {/* User preference chips */}
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
                </>
              }
              filterSlots={
                <>
                  {/* 1. Centre */}
                  <CentreSelect
                    centres={centres}
                    selected={selectedCentres}
                    onChange={setSelectedCentres}
                    placeholder="Tất cả cơ sở"
                    searchable
                    maxDisplay={2}
                  />
                  {/* 2. Course Line */}
                  <MultiSelect
                    options={courseLineOptions}
                    selected={selectedCourseLines}
                    onChange={setSelectedCourseLines}
                    placeholder="Tất cả khối"
                    maxDisplay={2}
                  />
                  <MultiSelect
                    options={teacherOptions}
                    selected={selectedTeachers}
                    onChange={setSelectedTeachers}
                    placeholder="Tất cả giáo viên"
                    searchable
                    maxDisplay={2}
                  />
                </>
              }
              hasFilter={selectedCentres.length > 0 || selectedTeachers.length > 0 || selectedCourseLines.length > 0}
              onClearFilter={() => {
                setSelectedCentres([]);
                setSelectedTeachers([]);
                setSelectedCourseLines([]);
              }}
            />
            
            {/* Filter Status Indicator */}
            {(selectedCentres.length > 0 || selectedTeachers.length > 0 || selectedCourseLines.length > 0) && (
              <div style={{ 
                padding: '8px 12px', 
                background: 'rgba(94, 106, 210, 0.1)', 
                border: '1px solid rgba(94, 106, 210, 0.3)', 
                borderRadius: "var(--radius-comfortable)", 
                marginBottom: 'var(--space-4)',
                fontSize: 12,
                color: 'var(--brand-indigo)'
              }}>
                <Icon.Filter />
                Đang hiển thị {filteredSchedulesForCalendar.length} giáo viên
                {selectedCentres.length > 0 && ` tại ${selectedCentres.length} cơ sở`}
                {selectedCourseLines.length > 0 && ` (${selectedCourseLines.length} khối)`}
                {selectedTeachers.length > 0 && ` (${selectedTeachers.length} giáo viên được chọn)`}
              </div>
            )}
            
            <div className={styles.tableSection}>
              <TableGroupHeader
                title="Lịch giảng dạy theo tuần"
                count={filteredSchedulesForCalendar.length}
                loading={loading}
                progress={progress}
                isExpanded={true}
                onToggle={() => {}}
              />
              
              {/* Week Navigation */}
              {allWeeks.length > 1 && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 'var(--space-4)',
                  background: 'var(--bg-elevated)',
                  borderBottom: '1px solid var(--border-primary)',
                  gap: 'var(--space-3)'
                }}>
                  <button
                    onClick={() => setCurrentWeekIndex(prev => Math.max(0, prev - 1))}
                    disabled={currentWeekIndex === 0}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-2)',
                      padding: '8px 12px',
                      background: currentWeekIndex === 0 ? 'var(--bg-surface)' : 'var(--brand-indigo)',
                      color: currentWeekIndex === 0 ? 'var(--text-quaternary)' : '#ffffff',
                      border: '1px solid var(--border-primary)',
                      borderRadius: "var(--radius-comfortable)",
                      fontSize: 13,
                      fontWeight: 510,
                      cursor: currentWeekIndex === 0 ? 'not-allowed' : 'pointer',
                      transition: 'all 0.15s ease',
                      opacity: currentWeekIndex === 0 ? 0.5 : 1
                    }}
                  >
                    <Icon.ChevronLeft size={16} />
                    Tuần trước
                  </button>
                  
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 'var(--space-1)'
                  }}>
                    <div style={{
                      fontSize: 14,
                      fontWeight: 590,
                      color: 'var(--text-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-2)'
                    }}>
                      Tuần {currentWeekIndex + 1} / {allWeeks.length}
                      <button
                        onClick={() => {
                          const today = new Date();
                          today.setHours(0,0,0,0);
                          const idx = allWeeks.findIndex(w => {
                            if (!w || !w[0] || !w[6]) return false;
                            const start = new Date(w[0]); start.setHours(0,0,0,0);
                            const end = new Date(w[6]); end.setHours(23,59,59,999);
                            return today >= start && today <= end;
                          });
                          if (idx !== -1) setCurrentWeekIndex(idx);
                        }}
                        style={{
                          fontSize: 11,
                          padding: '2px 8px',
                          background: 'var(--bg-surface)',
                          border: '1px solid var(--border-primary)',
                          borderRadius: 'var(--radius-standard)',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                          fontWeight: 500,
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = 'var(--bg-elevated)';
                          e.currentTarget.style.borderColor = 'var(--text-tertiary)';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = 'var(--bg-surface)';
                          e.currentTarget.style.borderColor = 'var(--border-primary)';
                        }}
                        title="Chuyển đến tuần hiện tại"
                      >
                        Hôm nay
                      </button>
                    </div>
                    {allWeeks[currentWeekIndex] && (
                      <div style={{
                        fontSize: 12,
                        color: 'var(--text-tertiary)'
                      }}>
                        {allWeeks[currentWeekIndex][0].toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        {' - '}
                        {allWeeks[currentWeekIndex][6].toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </div>
                    )}
                  </div>
                  
                  <button
                    onClick={() => setCurrentWeekIndex(prev => Math.min(allWeeks.length - 1, prev + 1))}
                    disabled={currentWeekIndex === allWeeks.length - 1}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-2)',
                      padding: '8px 12px',
                      background: currentWeekIndex === allWeeks.length - 1 ? 'var(--bg-surface)' : 'var(--brand-indigo)',
                      color: currentWeekIndex === allWeeks.length - 1 ? 'var(--text-quaternary)' : '#ffffff',
                      border: '1px solid var(--border-primary)',
                      borderRadius: "var(--radius-comfortable)",
                      fontSize: 13,
                      fontWeight: 510,
                      cursor: currentWeekIndex === allWeeks.length - 1 ? 'not-allowed' : 'pointer',
                      transition: 'all 0.15s ease',
                      opacity: currentWeekIndex === allWeeks.length - 1 ? 0.5 : 1
                    }}
                  >
                    Tuần sau
                    <Icon.ChevronRight size={16} />
                  </button>
                </div>
              )}
              
              <CalendarGrid
                calendarData={calendarData}
                slotMap={calendarSlotMap}
                TIME_SLOTS={dynamicTimeSlots}
                onCardClick={handleCardClick}
                collapsedTimeSlots={collapsedTimeSlots}
                onToggleCollapse={toggleTimeSlotCollapse}
              />
            </div>
          </>
        )}

        {/* Table View - All Teachers */}
        {viewMode === 'table-all' && schedules.length > 0 && (
          <>
            {/* Table Toolbar */}
            <TableToolbar
              search={searchTerm}
              onSearchChange={setSearchTerm}
              searchPlaceholder="Tìm giáo viên..."
              quickFilterSlots={
                <>
                  {/* User preference chips */}
                  {hasPreferences && (
                    <QuickFilterChips
                      centres={centres}
                      selectedCentres={tableSelectedCentres}
                      onCentresChange={setTableSelectedCentres}
                      selectedCourses={tableSelectedCourseLines}
                      onCoursesChange={setTableSelectedCourseLines}
                      showCentres={true}
                      showCourses={true}
                    />
                  )}
                </>
              }
              filterSlots={
                  <>
                    {/* 1. Centre */}
                    {tableCentreIds.length > 1 && <CentreSelect
                    centres={centres}
                    selected={tableSelectedCentres}
                    onChange={setTableSelectedCentres}
                    filterToIds={tableCentreIds}
                    placeholder="Tất cả cơ sở"
                    searchable
                    maxDisplay={2}
                  />}
                  {/* 2. Course Line */}
                  {courseLineOptions.length > 1 && (
                    <MultiSelect
                      options={courseLineOptions}
                      selected={tableSelectedCourseLines}
                      onChange={setTableSelectedCourseLines}
                      placeholder="Tất cả khối"
                      maxDisplay={2}
                    />
                  )}
                </>
              }
              hasFilter={searchTerm.length > 0 || tableSelectedCentres.length > 0 || tableSelectedCourseLines.length > 0}
              onClearFilter={() => {
                setSearchTerm('');
                setTableSelectedCentres([]);
                setTableSelectedCourseLines([]);
              }}
            />
            
            <TableView
              schedules={schedules}
              loading={loading}
              progress={progress}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              selectedCentres={tableSelectedCentres}
              onCentresChange={setTableSelectedCentres}
              centres={centres}
              selectedCourseLines={tableSelectedCourseLines}
              onCourseLinesChange={setTableSelectedCourseLines}
              courseLineOptions={courseLineOptions}
            />
          </>
        )}

        {/* Empty State */}
        {!loading && schedules.length === 0 && (
          <EmptyState
            icon={<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>}
            title="Chưa có dữ liệu lịch giảng dạy"
            subtitle={'Chọn khoảng thời gian và nhấn "Tải dữ liệu"'}
          />
        )}

        {/* Coordination Panel Modal */}
        <Modal open={showCoordinationPanel} onClose={() => {
          setShowCoordinationPanel(false);
          setSelectedSlot(null);
          setAvailableTeachers([]);
          setUnavailableTeachers([]);
          setCalculatingTeachers(false);
        }}>
          <ModalHeader
            title={selectedSlot ? "Tìm giáo viên thay thế" : "Tìm giáo viên rảnh"}
            subtitle={selectedSlot ? `Đề xuất giáo viên cho: ${selectedSlot.className}` : "Nhập thông tin ca cần điều phối"}
            onClose={() => {
              setShowCoordinationPanel(false);
              setSelectedSlot(null);
              setAvailableTeachers([]);
              setUnavailableTeachers([]);
              setCalculatingTeachers(false);
            }}
          />
          <div className={styles.modalBody}>
            {/* CRITICAL: Inner wrapper to constrain all content */}
            <div style={{ 
              maxWidth: '100%',
              width: '100%',
              boxSizing: 'border-box',
              overflow: 'hidden',
              margin: '0 auto'
            }}>
            <div style={{ 
              padding: isMobile ? '12px' : '20px',
              width: '100%',
              maxWidth: '100%',
              boxSizing: 'border-box',
              minWidth: 0,
              overflow: 'hidden' // CRITICAL: Prevent children from expanding
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
                    Thông tin ca hiện tại
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
                      Reload
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', fontSize: 12 }}>
                  <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 2 : 8 }}>
                    <span style={{ color: 'var(--text-tertiary)', minWidth: isMobile ? 'auto' : 100, fontSize: isMobile ? 10 : 12 }}>Lớp/Ca:</span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 510, wordBreak: 'break-word' }}>{selectedSlot.className}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 2 : 8 }}>
                    <span style={{ color: 'var(--text-tertiary)', minWidth: isMobile ? 'auto' : 100, fontSize: isMobile ? 10 : 12 }}>Giáo viên:</span>
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
                    <span style={{ color: 'var(--text-tertiary)', minWidth: isMobile ? 'auto' : 100, fontSize: isMobile ? 10 : 12 }}>Cơ sở:</span>
                    <span style={{ color: 'var(--text-primary)' }}>{selectedSlot.centreShortName}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 2 : 8 }}>
                    <span style={{ color: 'var(--text-tertiary)', minWidth: isMobile ? 'auto' : 100, fontSize: isMobile ? 10 : 12 }}>Thời gian:</span>
                    <span style={{ color: 'var(--text-primary)', wordBreak: 'break-word' }}>
                      {formatDate(selectedSlot.startTime)} • {formatTime(selectedSlot.startTime)} - {formatTime(selectedSlot.endTime)}
                    </span>
                  </div>
                  {selectedSlot.courseLine && (
                    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 2 : 8 }}>
                      <span style={{ color: 'var(--text-tertiary)', minWidth: isMobile ? 'auto' : 100, fontSize: isMobile ? 10 : 12 }}>Khối:</span>
                      <span style={{ color: 'var(--text-primary)' }}>
                        {getCourseLineCategory(selectedSlot.courseLine, selectedSlot.className)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div style={{ 
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr)',
              gap: 'var(--space-4)', 
              width: '100%', 
              maxWidth: '100%',
              boxSizing: 'border-box', 
              minWidth: 0,
              overflow: 'hidden'
            }}>
              {/* Date */}
              <div style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box', overflow: 'hidden' }}>
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
                boxSizing: 'border-box',
                overflow: 'hidden'
              }}>
                <div style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box', overflow: 'hidden' }}>
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
                <div style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box', overflow: 'hidden' }}>
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

              {/* Centre */}
              <div style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box', overflow: 'hidden' }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 590, color: 'var(--text-primary)', marginBottom: 'var(--space-2)' }}>
                  Cơ sở cần điều phối
                </label>
                <div style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }}>
                <CentreSelect
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
                  <div style={{ fontSize: 13 }}>Đang tính toán giáo viên rảnh...</div>
                </div>
              )}

              {/* Results - Grouped by Category */}
              {!calculatingTeachers && availableTeachers.length > 0 && (
                <div style={{ marginTop: 8, width: '100%', boxSizing: 'border-box', minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <span style={{ 
                      background: 'rgba(5, 150, 105, 0.08)', 
                      color: 'var(--status-success)', 
                      padding: '4px 10px', 
                      borderRadius: "var(--radius-comfortable)", 
                      fontSize: 13,
                      fontWeight: 600
                    }}>
                      {availableTeachers.length} giáo viên rảnh
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 400 }}>
                      (đã loại trừ giáo viên hiện tại)
                    </span>
                  </div>
                  
                  {/* Group by course line match FIRST, then by category */}
                  {(() => {
                    // Separate by course line match
                    const withMatch = availableTeachers.filter(t => t.courseLineMatch);
                    const withoutMatch = availableTeachers.filter(t => !t.courseLineMatch);
                    
                    // Define category order for display
                    const categoryOrder = [
                      'has-class-same-centre-adjacent',   // Có lớp liền kề tại cùng cơ sở (ưu tiên cao nhất)
                      'has-class-same-centre',            // Có lớp sau/trước tại cùng cơ sở (không liền kề)
                      'completely-free',                  // Hoàn toàn rảnh
                      'has-class-other-centre',           // Có lớp sau/trước tại cơ sở khác (không liền kề)
                      'has-class-other-centre-adjacent',  // Có lớp liền kề tại cơ sở khác
                      'currently-at-centre',              // Đang dạy cùng cơ sở
                      'currently-at-other-centre',        // Đang dạy khác cơ sở
                    ];
                    
                    const categoryLabels: Record<string, { label: string; icon: React.ReactNode }> = {
                      'has-class-same-centre-adjacent': { 
                        label: 'Có lớp sau/trước tại cùng cơ sở (liền kề)', 
                        icon: <Icon.Building size={12} /> 
                      },
                      'has-class-same-centre': { 
                        label: 'Có lớp sau/trước tại cùng cơ sở (không liền kề)', 
                        icon: <Icon.Building size={12} /> 
                      },
                      'completely-free': { 
                        label: 'Hoàn toàn rảnh trong ngày', 
                        icon: <Icon.User size={12} /> 
                      },
                      'has-class-other-centre': { 
                        label: 'Có lớp sau/trước tại cơ sở khác (không liền kề)', 
                        icon: <Icon.Building size={12} /> 
                      },
                      'has-class-other-centre-adjacent': { 
                        label: 'Có lớp sau/trước tại cơ sở khác (liền kề)', 
                        icon: <Icon.MapPin size={12} /> 
                      },
                      'currently-at-centre': { 
                        label: 'Đang dạy tại cùng cơ sở', 
                        icon: <Icon.Monitor size={12} /> 
                      },
                      'currently-at-other-centre': { 
                        label: 'Đang dạy tại cơ sở khác', 
                        icon: <Icon.Monitor size={12} /> 
                      },
                    };
                    
                    const renderGroup = (teachers: typeof availableTeachers, groupKey: string, groupTitle: string, groupIcon: React.ReactNode) => {
                      if (teachers.length === 0) return null;
                      
                      const isExpanded = expandedGroups[groupKey] !== false; // Default expanded unless explicitly set to false
                      
                      const toggleGroup = () => {
                        setExpandedGroups(prev => ({ ...prev, [groupKey]: !prev[groupKey] }));
                      };
                      
                      const toggleCategory = (categoryKey: string) => {
                        setExpandedCategories(prev => ({ ...prev, [categoryKey]: !prev[categoryKey] }));
                      };
                      
                      // Group by category
                      const grouped = teachers.reduce((acc, ta) => {
                        const cat = ta.category || 'has-class-other-centre';
                        if (!acc[cat]) acc[cat] = [];
                        acc[cat].push(ta);
                        return acc;
                      }, {} as Record<string, typeof teachers>);
                      
                      return (
                        <div style={{ 
                          marginBottom: 'var(--space-4)',
                          border: '1px solid var(--border-primary)',
                          borderRadius: "var(--radius-card)",
                          overflow: 'hidden',
                          background: 'var(--bg-surface)',
                          width: '100%',
                          boxSizing: 'border-box',
                          minWidth: 0
                        }}>
                          {/* Panel Title Bar */}
                          <div 
                            style={{ 
                              padding: 'var(--space-3) var(--space-4)',
                              background: 'var(--bg-elevated)',
                              borderBottom: isExpanded ? '1px solid var(--border-primary)' : 'none',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 'var(--space-3)',
                              transition: 'background 0.15s ease',
                              userSelect: 'none'
                            }}
                            onClick={toggleGroup}
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-panel)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                          >
                            {/* Icon */}
                            <span style={{ display: 'flex', alignItems: 'center', color: 'var(--text-secondary)' }}>
                              {groupIcon}
                            </span>
                            
                            {/* Title */}
                            <span style={{ 
                              fontSize: 14, 
                              fontWeight: 600, 
                              color: 'var(--text-primary)',
                              flex: 1
                            }}>
                              {groupTitle}
                            </span>
                            
                            {/* Count Badge */}
                            <span style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: 'var(--text-tertiary)',
                              background: 'var(--bg-surface)',
                              padding: '3px 10px',
                              borderRadius: 12,
                              border: '1px solid var(--border-secondary)'
                            }}>
                              {teachers.length}
                            </span>
                            
                            {/* Chevron */}
                            <span style={{ 
                              transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', 
                              transition: 'transform 0.2s ease',
                              display: 'flex',
                              alignItems: 'center',
                              color: 'var(--text-tertiary)'
                            }}>
                              <Icon.ChevronDown />
                            </span>
                          </div>
                          
                          {/* Panel Content */}
                          {isExpanded && (
                            <div style={{ padding: '16px', width: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
                              {categoryOrder.map(category => {
                                const categoryTeachers = grouped[category];
                                if (!categoryTeachers || categoryTeachers.length === 0) return null;
                                
                                const categoryKey = `${groupKey}-${category}`;
                                const isCategoryExpanded = expandedCategories[categoryKey] !== false; // Default expanded
                            
                            return (
                              <div key={category} style={{ marginBottom: 12 }}>
                                {/* Category Header with Chevron */}
                                <div 
                                  style={{ 
                                    fontSize: 11, 
                                    fontWeight: 600, 
                                    color: 'var(--text-secondary)', 
                                    marginBottom: isCategoryExpanded ? 6 : 0,
                                    padding: '6px 8px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 'var(--space-2)',
                                    cursor: 'pointer',
                                    borderRadius: "var(--radius-standard)",
                                    transition: 'background 0.15s ease'
                                  }}
                                  onClick={() => toggleCategory(categoryKey)}
                                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                >
                                  <span style={{ 
                                    transform: isCategoryExpanded ? 'rotate(180deg)' : 'rotate(0deg)', 
                                    transition: 'transform 0.2s ease',
                                    display: 'flex',
                                    alignItems: 'center',
                                    fontSize: 10
                                  }}>
                                    <Icon.ChevronDown />
                                  </span>
                                  {categoryLabels[category]?.icon}
                                  <span>{categoryLabels[category]?.label || category}</span>
                                  <span style={{ 
                                    fontSize: 9, 
                                    fontWeight: 510, 
                                    color: 'var(--text-quaternary)',
                                    background: 'var(--bg-elevated)',
                                    padding: '1px 5px',
                                    borderRadius: 'var(--radius-standard)',
                                    marginLeft: 4
                                  }}>
                                    {categoryTeachers.length}
                                  </span>
                                </div>
                                
                                {/* Teachers Table - Horizontal Scroll on Mobile */}
                                {isCategoryExpanded && (
                                  <div style={{ 
                                    width: '100%',
                                    overflowX: 'auto',
                                    WebkitOverflowScrolling: 'touch',
                                    border: '1px solid var(--border-primary)', 
                                    borderRadius: "var(--radius-comfortable)", 
                                    background: 'var(--bg-surface)'
                                  }}>
                                    <div style={{ minWidth: 600, width: '100%' }}>
                                      {/* Table Header */}
                                      <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: '200px 1fr',
                                        padding: '8px 12px',
                                        background: 'var(--bg-elevated)',
                                        borderBottom: '1px solid var(--border-primary)',
                                        fontSize: 10,
                                        fontWeight: 600,
                                        color: 'var(--text-quaternary)',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.04em',
                                        position: 'sticky',
                                        top: 0,
                                        zIndex: 1
                                      }}>
                                        <div>Giáo viên</div>
                                        <div>Lý do & Thông tin</div>
                                      </div>
                                      
                                      {/* Table Rows */}
                                      {categoryTeachers.map((ta, idx) => (
                                        <div
                                          key={ta.teacher.id}
                                          style={{
                                            display: 'grid',
                                            gridTemplateColumns: '200px 1fr',
                                            padding: '10px 12px',
                                            borderBottom: idx < categoryTeachers.length - 1 ? '1px solid var(--border-secondary)' : 'none',
                                            background: 'var(--bg-surface)',
                                            transition: 'background 0.1s ease',
                                            alignItems: 'start'
                                          }}
                                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                                          onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-surface)')}
                                        >
                                          {/* Teacher Info */}
                                          <div>
                                            <div style={{ fontSize: 12, fontWeight: 590, color: 'var(--text-primary)', marginBottom: 2 }}>
                                              {ta.teacher.fullName || ta.teacher.username}
                                            </div>
                                            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', wordBreak: 'break-word' }}>
                                              {ta.teacher.email}
                                            </div>
                                            
                                            {/* Add to Class Button - Only show if we have a selected slot */}
                                            {selectedSlot && (
                                              <button
                                                onClick={() => handleAddSupplyTeacher(ta)}
                                                disabled={addingSupplyTeacherId !== null}
                                                style={{
                                                  marginTop: 6,
                                                  padding: '4px 10px',
                                                  fontSize: 10,
                                                  fontWeight: 510,
                                                  color: 'white',
                                                  background: addingSupplyTeacherId === ta.teacher.id ? 'var(--text-quaternary)' : 'var(--brand-indigo)',
                                                  border: 'none',
                                                  borderRadius: 'var(--radius-comfortable)',
                                                  cursor: addingSupplyTeacherId !== null ? 'not-allowed' : 'pointer',
                                                  transition: 'all 0.15s ease',
                                                  opacity: addingSupplyTeacherId !== null && addingSupplyTeacherId !== ta.teacher.id ? 0.5 : 1,
                                                }}
                                                onMouseEnter={e => {
                                                  if (addingSupplyTeacherId === null) {
                                                    e.currentTarget.style.background = 'var(--accent-hover)';
                                                    e.currentTarget.style.transform = 'translateY(-1px)';
                                                  }
                                                }}
                                                onMouseLeave={e => {
                                                  e.currentTarget.style.background = addingSupplyTeacherId === ta.teacher.id ? 'var(--text-quaternary)' : 'var(--brand-indigo)';
                                                  if (addingSupplyTeacherId === null) e.currentTarget.style.transform = 'translateY(0)';
                                                }}
                                              >
                                                {addingSupplyTeacherId === ta.teacher.id ? (
                                                  <>
                                                    <Spinner size={10} /> Đang thêm...
                                                  </>
                                                ) : (
                                                  <>
                                                    <Icon.Plus size={10} /> Thêm vào lớp
                                                  </>
                                                )}
                                              </button>
                                            )}
                                          </div>
                                          
                                          {/* Reason & Details */}
                                          <div>
                                            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 'var(--space-1)', lineHeight: 1.4 }}>
                                              {ta.reason}
                                            </div>
                                            
                                            {/* Additional Info */}
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                                              {ta.totalHoursToday !== undefined && ta.totalHoursToday > 0 && (
                                                <div style={{ fontSize: 9, color: 'var(--text-quaternary)' }}>
                                                  <Icon.Clock size={9} /> Đã dạy {ta.totalHoursToday}h trong ngày
                                                </div>
                                              )}
                                              {ta.conflictSlots && ta.conflictSlots.length > 0 && (
                                                <div style={{ 
                                                  fontSize: 9, 
                                                  color: 'var(--status-warning)', 
                                                  fontWeight: 510,
                                                  display: 'flex',
                                                  alignItems: 'flex-start',
                                                  gap: 3
                                                }}>
                                                  <span style={{ marginTop: 1, flexShrink: 0 }}>
                                                    <Icon.Monitor size={9} />
                                                  </span>
                                                  <span>Đang dạy: {ta.conflictSlots[0].className} ({formatTime(ta.conflictSlots[0].startTime)} - {formatTime(ta.conflictSlots[0].endTime)})</span>
                                                </div>
                                              )}
                                              {ta.relatedSlot && (
                                                <div style={{ 
                                                  fontSize: 9, 
                                                  color: ta.relatedSlot.centreId === selectedSlot?.centreId ? 'var(--status-emerald)' : '#3b82f6', 
                                                  fontWeight: 510,
                                                  display: 'flex',
                                                  alignItems: 'flex-start',
                                                  gap: 3
                                                }}>
                                                  <span style={{ marginTop: 1, flexShrink: 0 }}>
                                                    <Icon.Building size={9} />
                                                  </span>
                                                  <span>
                                                    {ta.isRelatedSlotBefore ? 'Đã dạy' : 'Sẽ dạy'}: {ta.relatedSlot.className} ({formatTime(ta.relatedSlot.startTime)} - {formatTime(ta.relatedSlot.endTime)})
                                                    {ta.relatedSlot.centreId !== selectedSlot?.centreId && ` tại ${ta.relatedSlot.centreShortName}`}
                                                  </span>
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                            </div>
                          )}
                        </div>
                      );
                    };
                    
                    return (
                      <>
                        {renderGroup(withMatch, 'match', 'Đúng khối', <span style={{ color: 'var(--status-success)' }}><Icon.CheckCircle size={14} /></span>)}
                        {renderGroup(withoutMatch, 'no-match', 'Khối khác', <span style={{ color: 'var(--text-tertiary)' }}><Icon.XCircle size={14} /></span>)}
                      </>
                    );
                  })()}
                </div>
              )}

              {/* No results message */}
              {!calculatingTeachers && availableTeachers.length === 0 && selectedSlot && (
                <div style={{ 
                  padding: '16px', 
                  background: 'rgba(220, 38, 38, 0.08)', 
                  border: '1px solid rgba(220, 38, 38, 0.3)', 
                  borderRadius: "var(--radius-comfortable)",
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--status-error)', marginBottom: 4 }}>
                    Không tìm thấy giáo viên rảnh
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(153, 27, 27, 1)' }}>
                    Tất cả giáo viên đều đã có lịch trong khung giờ này
                  </div>
                </div>
              )}
            </div>
            </div>
            </div> {/* Close inner wrapper */}
          </div>
        </Modal>
      </PageLayout>
    </>
  );
}

// Improved table styling
/* Improved table styling */
/* Improved table layouts */
/* Enhanced responsive design */

/* Enhanced table styling */
