/**
 * Shared KPI calculation functions used by both the dashboard and individual KPI pages.
 * These are the source of truth for how each metric is computed, ensuring consistency.
 */

import { CLASS_INACTIVE_STATUSES } from '@/constants';

// ─── Completion Rate ────────────────────────────────────────────────────────

/**
 * Reasons exempted from completion rate by default.
 * These match the DEFAULT_EXEMPTED_REASONS in completion-rate/page.tsx.
 */
export const DEFAULT_EXEMPTED_REASONS = [
  'CHANGE_CLASS_SCHEDULE_CHANGE',
  'TRANSFER_COURSE_LINE',
  'WRONG_ENROLL',
];

/**
 * Check whether a student should be exempt from the completion rate formula.
 * Exempt if:
 * 1. status is WAITING and student has no attendance records
 * 2. student is deactivated (activeInClass = false) and has no attendance records
 */
export function isExemptStudent(
  st: { completionInfo?: { status?: string } | null; activeInClass?: boolean; student: { id: string } },
  classSlots?: Array<{ studentAttendance?: Array<{ student: { id: string } }> }>
): boolean {
  const hasAttendance = classSlots?.some(slot =>
    slot.studentAttendance?.some(a => a.student.id === st.student.id)
  ) ?? false;

  const status = (st.completionInfo as any)?.status;
  if (status === 'WAITING' && !hasAttendance) return true;
  if (!st.activeInClass && !hasAttendance) return true;

  return false;
}

/**
 * Calculate completion rate for a list of classes.
 * Applies the same exemption logic as the /admin/completion-rate page with default settings.
 *
 * @param classes    - Raw class objects from the API
 * @param exemptedReasons - Map of reason key → true means that reason is exempted.
 *                          Defaults to DEFAULT_EXEMPTED_REASONS.
 * @param exemptedCourses - Map of course key → true means that course is fully excluded.
 */
export function calcCompletionRate(
  classes: any[],
  exemptedReasons: Record<string, boolean> = Object.fromEntries(
    DEFAULT_EXEMPTED_REASONS.map(r => [r, true])
  ),
  exemptedCourses: Record<string, boolean> = {}
): { rate: number | null; totalPass: number; totalBase: number } {
  let totalPass = 0;
  let totalBase = 0;

  for (const cls of classes) {
    const status = cls.status?.toUpperCase?.();
    if (status === 'ABANDONED' || status === 'REJECTED') continue;

    // Optionally skip entire courses
    if (exemptedCourses && Object.keys(exemptedCourses).length > 0) {
      const courseKey = cls.courseKey ?? cls.course?.key ?? cls.courseLine?.key;
      if (courseKey && exemptedCourses[courseKey] === true) continue;
    }

    for (const st of cls.students ?? []) {
      if (isExemptStudent(st, cls.slots)) continue;

      const info = st.completionInfo;
      const completionStatus = (info as any)?.status as string | undefined;

      // Skip if student has an exempted reason
      const rawReason = info?.reason ?? info?.completionReason ?? '';
      const reason = rawReason?.trim?.() ?? '';
      const normalizedReason =
        reason.toUpperCase().replace(/\s+/g, '_') === 'ON_HOLD' ? 'ON_HOLD' : reason;

      if (normalizedReason && exemptedReasons[normalizedReason] === true) continue;

      totalBase++;
      if (
        completionStatus === 'PASSED' ||
        completionStatus === 'COMPLETED' ||
        completionStatus === 'FINISHED'
      ) {
        totalPass++;
      }
    }
  }

  return {
    rate: totalBase > 0 ? (totalPass / totalBase) * 100 : null,
    totalPass,
    totalBase,
  };
}

// ─── Teacher Change Rate ────────────────────────────────────────────────────

export function calcTeacherChangeRate(classes: any[]): {
  changeRate: number | null;
  multiTeacherRate: number | null;
  classesWithChange: number;
  classesWithMultiTeachers: number;
  totalClasses: number;
} {
  const activeClasses = classes.filter(
    cls => !CLASS_INACTIVE_STATUSES.has(cls.status?.toUpperCase?.())
  );

  const totalClasses = activeClasses.length;
  if (totalClasses === 0) {
    return { changeRate: null, multiTeacherRate: null, classesWithChange: 0, classesWithMultiTeachers: 0, totalClasses: 0 };
  }

  let classesWithChange = 0;
  let classesWithMultiTeachers = 0;

  for (const cls of activeClasses) {
    const slots = (cls.slots ?? [])
      .filter((s: any) => s.date)
      .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const getRoleUpper = (t: any) => {
      const role = typeof t.role === 'string' ? t.role : (t.role?.shortName ?? t.role?.name ?? '');
      return role.toUpperCase();
    };

    // Determine primary LEC
    let primaryLEC: any = null;
    for (const slot of slots) {
      const lec = (slot.teachers ?? []).find((t: any) => getRoleUpper(t) === 'LEC');
      if (lec) { primaryLEC = lec; break; }
    }
    if (!primaryLEC) {
      primaryLEC = (cls.teachers ?? []).find((t: any) => getRoleUpper(t) === 'LEC') ?? null;
    }

    // Check for LEC change
    let hasChange = false;
    for (const slot of slots) {
      const slotLEC = (slot.teachers ?? []).find((t: any) => getRoleUpper(t) === 'LEC') ?? null;
      if (primaryLEC && slotLEC && slotLEC.teacher.id !== primaryLEC.teacher.id) {
        hasChange = true;
        break;
      }
    }
    if (hasChange) classesWithChange++;

    // Count unique LEC + SUPPLY teachers across class + slots
    const teacherMap = new Map<string, any>();
    for (const t of cls.teachers ?? []) {
      const role = getRoleUpper(t);
      if (role === 'LEC' || role === 'SUPPLY') teacherMap.set(t.teacher.id, t);
    }
    for (const slot of slots) {
      for (const t of slot.teachers ?? []) {
        const role = getRoleUpper(t);
        if ((role === 'LEC' || role === 'SUPPLY') && !teacherMap.has(t.teacher.id)) {
          teacherMap.set(t.teacher.id, t);
        }
      }
    }
    if (teacherMap.size >= 3) classesWithMultiTeachers++;
  }

  return {
    changeRate: (classesWithChange / totalClasses) * 100,
    multiTeacherRate: (classesWithMultiTeachers / totalClasses) * 100,
    classesWithChange,
    classesWithMultiTeachers,
    totalClasses,
  };
}

// ─── Survey Score ───────────────────────────────────────────────────────────

/**
 * Extract average teacher survey score from a list of tickets.
 * Matches the logic in /admin/tickets page.
 */
export function calcSurveyScore(tickets: any[]): number | null {
  let totalScore = 0;
  let scoredCount = 0;

  for (const t of tickets) {
    const groupScores: Record<string, { total: number; count: number }> = {};

    if (t.ticketSource?.answers?.length) {
      for (const ans of t.ticketSource.answers) {
        const question = t.ticketSource.questions?.find((q: any) => q.id === ans.questionId);
        if (!question) continue;

        const val = parseFloat(ans.value);
        if (!isNaN(val) && val > 0 && val <= 5) {
          const g = question.group || 'Khác';
          if (!groupScores[g]) groupScores[g] = { total: 0, count: 0 };
          groupScores[g].total += val;
          groupScores[g].count++;
        }
      }
    }

    const teacherEntry = Object.entries(groupScores).find(([group]) => {
      const g = group.toUpperCase();
      return g.includes('TEACHER') || g.includes('GIÁO VIÊN') || g === 'GV';
    });

    if (teacherEntry) {
      const [, data] = teacherEntry;
      // Round each ticket's group avg to 1dp to match tickets page behavior
      // (tickets page stores avg as toFixed(1) string before summing)
      totalScore += parseFloat((data.total / data.count).toFixed(1));
      scoredCount++;
    }
  }

  return scoredCount > 0 ? parseFloat((totalScore / scoredCount).toFixed(1)) : null;
}

// ─── Conversion Rate ────────────────────────────────────────────────────────

export const DEFAULT_EXEMPT_OH_TYPES = ['Event', 'Makeup', 'Tutor'];
export const DEFAULT_EXEMPT_OH_STATUSES = ['ABANDONED', 'DENIED', 'REJECTED'];
export const DEFAULT_EXEMPT_APPOINTMENT_STATUSES = ['CANCELED'];

/**
 * Calculate conversion rate from office hours data.
 * Matches the default-exemption logic of /admin/office-hours page.
 */
export function calcConversionRate(
  officeHours: any[],
  exemptOhTypes: string[] = DEFAULT_EXEMPT_OH_TYPES,
  exemptOhStatuses: string[] = DEFAULT_EXEMPT_OH_STATUSES,
  exemptAppointmentStatuses: string[] = DEFAULT_EXEMPT_APPOINTMENT_STATUSES
): { rate: number | null; totalAppointments: number; convertedAppointments: number } {
  let totalAppointments = 0;
  let convertedAppointments = 0;

  for (const oh of officeHours) {
    if (exemptOhTypes.includes(oh.type)) continue;
    if (exemptOhStatuses.includes(oh.status)) continue;

    for (const apt of oh.appointments ?? []) {
      if (exemptAppointmentStatuses.includes(apt.status)) continue;

      totalAppointments++;
      if (apt.resultAfterTrial?.isHasOrder || apt.resultAfterTrial?.isHasPayment) {
        convertedAppointments++;
      }
    }
  }

  return {
    rate: totalAppointments > 0 ? (convertedAppointments / totalAppointments) * 100 : null,
    totalAppointments,
    convertedAppointments,
  };
}
