import type { Appointment, Candidate, OfficeHour } from '@/types/officeHours';

export interface RepeatedTrialOccurrence {
  key: string;
  officeHourId: string;
  appointment: Appointment;
  startTime: string;
  sessionStatus: string;
  appointmentCourseNames: string[];
  sessionCourseNames: string[];
  sessionCourseLineNames: string[];
  sessionCourseTopicNames: string[];
  centreName: string;
  teacherName: string;
}

interface RepeatedTrialGroup {
  reason: string;
  occurrences: RepeatedTrialOccurrence[];
}

const EXCLUDED_SESSION_STATUSES = new Set(['CANCELED', 'REJECTED', 'ABANDONED']);
const EXCLUDED_APPOINTMENT_STATUSES = new Set(['CANCELED']);

export interface RepeatedTrialAnalysis {
  byOccurrenceKey: Map<string, RepeatedTrialGroup[]>;
  officeHourIds: Set<string>;
  repeatedAppointmentCount: number;
}

export interface RepeatedTrialOfficeHourSummary {
  appointmentCount: number;
  reasonLabels: string[];
  hasSameCourse: boolean;
  hasDifferentCourse: boolean;
  hasUnknownCourse: boolean;
}

export function getAppointmentOccurrenceKey(officeHourId: string, appointmentId: string) {
  return JSON.stringify([officeHourId, appointmentId]);
}

export function normalizeStudentName(value?: string) {
  return (value || '').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd').toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

export function normalizeStudentPhone(value?: string) {
  // Ignore free text/multiple phone values rather than accidentally joining numbers.
  if (!value || !/^[+\d\s().-]+$/.test(value.trim())) return '';
  let digits = value.replace(/\D/g, '');
  if (digits.startsWith('0084')) digits = digits.slice(2);
  if (/^84\d{9,10}$/.test(digits)) digits = `0${digits.slice(2)}`;
  return /^\d{9,15}$/.test(digits) && !/^(\d)\1+$/.test(digits) ? digits : '';
}

export function matchesTrialStudentSearch(candidate: Candidate | undefined, query: string) {
  if (!candidate) return false;
  const text = query.trim().toLowerCase();
  const name = normalizeStudentName(query);
  const phone = normalizeStudentPhone(query);
  return Boolean(
    (name && normalizeStudentName(candidate.fullName).includes(name)) ||
    (text && candidate.id?.toLowerCase().includes(text)) ||
    (text && candidate.email?.toLowerCase().includes(text)) ||
    (text && candidate.phoneNumber?.toLowerCase().includes(text)) ||
    (phone && normalizeStudentPhone(candidate.phoneNumber) === phone)
  );
}

function getIdentityTokens(candidate?: Candidate) {
  if (!candidate) return [];
  const tokens: Array<{ key: string; reason: string }> = [];
  const phone = normalizeStudentPhone(candidate.phoneNumber);
  const email = candidate.email?.trim().toLowerCase();
  const name = normalizeStudentName(candidate.fullName);
  if (candidate.id?.trim()) tokens.push({ key: `id:${candidate.id.trim()}`, reason: 'Cùng mã học viên' });
  if (phone) tokens.push({ key: `phone:${phone}`, reason: 'Trùng số điện thoại' });
  if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    tokens.push({ key: `email:${email}`, reason: 'Trùng email' });
  }
  if (name && !['n a', 'na', 'unknown', 'khong ro', 'chua co', 'null'].includes(name)) {
    tokens.push({ key: `name:${name}`, reason: 'Trùng họ tên (không phân biệt dấu)' });
  }
  return tokens;
}

function normalizedStatus(value?: string) {
  return value?.trim().toUpperCase() || '';
}

function uniqueLabels(values: Array<string | undefined>) {
  return Array.from(new Set(values.map(value => value?.trim()).filter(Boolean) as string[]));
}

function getEffectiveCourseNames(occurrence: RepeatedTrialOccurrence) {
  return occurrence.appointmentCourseNames.length > 0
    ? occurrence.appointmentCourseNames
    : occurrence.sessionCourseNames;
}

function hasSharedCourse(a: RepeatedTrialOccurrence, b: RepeatedTrialOccurrence) {
  const aCourses = getEffectiveCourseNames(a).map(course => course.trim().toLowerCase()).filter(Boolean);
  const bCourses = getEffectiveCourseNames(b).map(course => course.trim().toLowerCase()).filter(Boolean);
  if (!aCourses.length || !bCourses.length) return undefined;
  const bSet = new Set(bCourses);
  return aCourses.some(course => bSet.has(course));
}

function getReasonLabel(reason: string) {
  if (reason === 'Cùng mã học viên') return 'Mã HV';
  if (reason === 'Trùng số điện thoại') return 'SĐT';
  if (reason === 'Trùng email') return 'Email';
  if (reason === 'Trùng họ tên (không phân biệt dấu)') return 'Tên';
  return reason;
}

function getOfficeHourIdFromOccurrenceKey(key: string) {
  try {
    const [officeHourId] = JSON.parse(key) as [string, string];
    return officeHourId;
  } catch {
    return '';
  }
}

/** Index direct shared fields, never merge A–B and B–C into an assumed A–C identity. */
export function analyzeRepeatedTrialStudents(officeHours: OfficeHour[]): RepeatedTrialAnalysis {
  const buckets = new Map<string, RepeatedTrialGroup>();
  const seen = new Set<string>();
  officeHours.forEach(officeHour => {
    if (EXCLUDED_SESSION_STATUSES.has(normalizedStatus(officeHour.status))) return;
    officeHour.appointments?.forEach(appointment => {
      if (EXCLUDED_APPOINTMENT_STATUSES.has(normalizedStatus(appointment.status))) return;
      const key = getAppointmentOccurrenceKey(officeHour.id, appointment.id);
      if (seen.has(key)) return;
      seen.add(key);
      const occurrence: RepeatedTrialOccurrence = {
        key,
        officeHourId: officeHour.id,
        appointment,
        startTime: officeHour.startTime,
        sessionStatus: officeHour.status,
        appointmentCourseNames: uniqueLabels(appointment.courses?.map(course => course.shortName || course.name) || []),
        sessionCourseNames: uniqueLabels(officeHour.courses?.map(course => course.shortName || course.name) || []),
        sessionCourseLineNames: uniqueLabels(officeHour.courseLines?.map(line => line.name) || []),
        sessionCourseTopicNames: uniqueLabels(officeHour.courseTopics?.map(topic => topic.name) || []),
        centreName: officeHour.centre?.shortName || officeHour.centre?.name || 'Không rõ',
        teacherName: officeHour.teacher?.fullName || 'Chưa phân công',
      };
      getIdentityTokens(appointment.candidate).forEach(token => {
        let bucket = buckets.get(token.key);
        if (!bucket) {
          bucket = { reason: token.reason, occurrences: [] };
          buckets.set(token.key, bucket);
        }
        bucket.occurrences.push(occurrence);
      });
    });
  });

  const byOccurrenceKey: RepeatedTrialAnalysis['byOccurrenceKey'] = new Map();
  const officeHourIds = new Set<string>();
  buckets.forEach(bucket => {
    if (new Set(bucket.occurrences.map(item => item.officeHourId)).size < 2) return;
    bucket.occurrences.forEach(item => {
      const groups = byOccurrenceKey.get(item.key) || [];
      groups.push(bucket);
      byOccurrenceKey.set(item.key, groups);
      officeHourIds.add(item.officeHourId);
    });
  });
  return { byOccurrenceKey, officeHourIds, repeatedAppointmentCount: byOccurrenceKey.size };
}

/** Expand only the selected appointment's direct matches, with per-match evidence. */
export function getRepeatedTrialMatches(analysis: RepeatedTrialAnalysis, officeHourId: string, appointmentId: string) {
  const matches = new Map<string, RepeatedTrialOccurrence & { reasons: string[] }>();
  const groups = analysis.byOccurrenceKey.get(getAppointmentOccurrenceKey(officeHourId, appointmentId)) || [];
  groups.forEach(group => {
    group.occurrences.forEach(item => {
      if (item.officeHourId === officeHourId) return;
      const match = matches.get(item.key) || { ...item, reasons: [] };
      match.reasons.push(group.reason);
      matches.set(item.key, match);
    });
  });
  return Array.from(matches.values()).sort((a, b) =>
    a.startTime.localeCompare(b.startTime) || a.key.localeCompare(b.key)
  );
}

export function getRepeatedTrialOfficeHourSummary(
  analysis: RepeatedTrialAnalysis,
  officeHourId: string
): RepeatedTrialOfficeHourSummary {
  const reasonLabels = new Set<string>();
  const appointmentKeys = new Set<string>();
  let hasSameCourse = false;
  let hasDifferentCourse = false;
  let hasUnknownCourse = false;

  analysis.byOccurrenceKey.forEach((groups, key) => {
    if (getOfficeHourIdFromOccurrenceKey(key) !== officeHourId) return;
    appointmentKeys.add(key);
    groups.forEach(group => {
      reasonLabels.add(getReasonLabel(group.reason));
      const current = group.occurrences.find(item => item.key === key);
      if (!current) return;
      group.occurrences.forEach(item => {
        if (item.officeHourId === officeHourId) return;
        const sharedCourse = hasSharedCourse(current, item);
        if (sharedCourse === true) hasSameCourse = true;
        if (sharedCourse === false) hasDifferentCourse = true;
        if (sharedCourse === undefined) hasUnknownCourse = true;
      });
    });
  });

  return {
    appointmentCount: appointmentKeys.size,
    reasonLabels: Array.from(reasonLabels),
    hasSameCourse,
    hasDifferentCourse,
    hasUnknownCourse,
  };
}
