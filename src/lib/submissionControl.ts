import type {
  ClassSubmissionData,
  StudentSubmission,
  SubmissionLesson,
  SubmissionLessonSchedule,
  SubmissionStudent,
} from '@/services/studentSubmissionService';
import type { Class } from '@/types/classes';

export type SubmissionCellStatus = 'not_due' | 'missing' | 'pending' | 'graded';

export interface SubmissionCell {
  student: SubmissionStudent;
  lesson: SubmissionLesson;
  status: SubmissionCellStatus;
  submission?: StudentSubmission;
  dueAt?: string | null;
}

export interface SubmissionSummaryOptions {
  dateFrom?: string;
  dateTo?: string;
  now?: Date;
}

export interface SubmissionSummary {
  totalExpected: number;
  missing: number;
  notDue: number;
  pending: number;
  graded: number;
  submitted: number;
  submissionRate: number;
  gradingRate: number;
}

export type SubmissionSessionCompletion = 'complete' | 'partial' | 'none';

export interface SubmissionSessionSummary extends SubmissionSummary {
  lesson: SubmissionLesson;
  dueAt?: string | null;
  completion: SubmissionSessionCompletion;
}

const GRADED_STATUS_MARKERS = ['GRADED', 'MARKED', 'COMPLETED', 'APPROVED', 'PASSED'];
const SUBMITTED_STATUS_MARKERS = ['SUBMITTED', 'TURNED_IN', 'PENDING', 'REVIEW', ...GRADED_STATUS_MARKERS];
const MISSING_STATUS_MARKERS = ['NOT_SUBMITTED', 'UNSUBMITTED', 'MISSING', 'DRAFT'];

export function getSubmissionStudents(data: ClassSubmissionData, cls?: Class): SubmissionStudent[] {
  if (!cls) return data.students;
  const activeStudentIds = new Set(
    (cls.students || [])
      .filter(student => student.activeInClass)
      .map(student => student.student.id)
      .filter(Boolean),
  );
  if (activeStudentIds.size === 0) return [];
  return data.students.filter(student => activeStudentIds.has(student.id));
}

function getLessonSessionAt(data: ClassSubmissionData, cls: Class | undefined, lessonId: string): string | null {
  const authoritativeSlot = (data.lessonSchedule || []).find(slot => slot.lessonId === lessonId);
  if (authoritativeSlot) return authoritativeSlot.startTime || authoritativeSlot.date || authoritativeSlot.endTime || null;
  const fallbackSlot = (cls?.slots || []).find(slot => slot.learningLessonId === lessonId);
  return fallbackSlot?.startTime || fallbackSlot?.date || fallbackSlot?.endTime || null;
}

function parseDateRangeBound(value: string | undefined, endOfDay = false): number | null {
  if (!value) return null;
  const date = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}`);
  const time = date.getTime();
  return Number.isFinite(time) ? time : null;
}

function isLessonInDateRange(
  data: ClassSubmissionData,
  cls: Class | undefined,
  lessonId: string,
  options?: SubmissionSummaryOptions,
): boolean {
  const fromTime = parseDateRangeBound(options?.dateFrom);
  const toTime = parseDateRangeBound(options?.dateTo, true);
  if (fromTime === null && toTime === null) return true;
  const sessionAt = getLessonSessionAt(data, cls, lessonId);
  const sessionTime = sessionAt ? new Date(sessionAt).getTime() : Number.NaN;
  if (!Number.isFinite(sessionTime)) return false;
  return (fromTime === null || sessionTime >= fromTime) && (toTime === null || sessionTime <= toTime);
}

export function getActiveSubmissionLessons(
  data: ClassSubmissionData,
  cls?: Class,
  options?: SubmissionSummaryOptions,
): SubmissionLesson[] {
  const authoritativeSchedule = [...(data.lessonSchedule || [])]
    .sort((left, right) => (
      (left.slotIndex ?? Number.MAX_SAFE_INTEGER) - (right.slotIndex ?? Number.MAX_SAFE_INTEGER)
      || new Date(left.startTime || left.date || 0).getTime() - new Date(right.startTime || right.date || 0).getTime()
    ));
  const fallbackSchedule = [...(cls?.slots || [])]
    .filter(slot => Boolean(slot.learningLessonId))
    .sort((left, right) => (
      new Date(left.startTime || left.date).getTime() - new Date(right.startTime || right.date).getTime()
    ))
    .map(slot => ({ lessonId: slot.learningLessonId as string }));
  const schedule = authoritativeSchedule.length > 0 ? authoritativeSchedule : fallbackSchedule;
  const slotPositionByLessonId = new Map(schedule.map((slot, index) => [slot.lessonId, index]));

  return data.lessons
    .filter(lesson => lesson.isActive !== false && isLessonInDateRange(data, cls, lesson.id, options))
    .sort((left, right) => {
      const leftSlotPosition = slotPositionByLessonId.get(left.id);
      const rightSlotPosition = slotPositionByLessonId.get(right.id);
      if (leftSlotPosition !== undefined && rightSlotPosition !== undefined) return leftSlotPosition - rightSlotPosition;
      if (leftSlotPosition !== undefined) return -1;
      if (rightSlotPosition !== undefined) return 1;
      return (left.displayOrder ?? Number.MAX_SAFE_INTEGER) - (right.displayOrder ?? Number.MAX_SAFE_INTEGER);
    });
}

export function isGradedSubmission(submission: StudentSubmission): boolean {
  const status = (submission.status || '').trim().toUpperCase();
  return GRADED_STATUS_MARKERS.some(marker => status.includes(marker))
    || Boolean(submission.markedAt || submission.markedBy);
}

export function isSubmittedSubmission(submission: StudentSubmission): boolean {
  const status = (submission.status || '').trim().toUpperCase();
  return isGradedSubmission(submission)
    || Boolean(submission.submittedAt)
    || (submission.submittedCount ?? 0) > 0
    || (!MISSING_STATUS_MARKERS.some(marker => status.includes(marker))
      && SUBMITTED_STATUS_MARKERS.some(marker => status.includes(marker)));
}

function submissionTimestamp(submission: StudentSubmission): number {
  const timestamp = submission.submittedAt || submission.markedAt || submission.createdAt;
  if (timestamp && /^\d+$/.test(timestamp)) return Number(timestamp);
  const parsed = timestamp ? new Date(timestamp).getTime() : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

function isTeacherMarkedTask(submission: StudentSubmission): boolean {
  return (submission.category || '').toUpperCase() !== 'QUIZ'
    && (submission.type || '').toUpperCase() !== 'QUIZ'
    && (submission.content?.type || '').toUpperCase() !== 'QUIZ';
}

function getLessonDueAt(data: ClassSubmissionData, cls: Class | undefined, lesson: SubmissionLesson): string | null {
  const authoritativeSchedule = [...(data.lessonSchedule || [])]
    .sort((left, right) => (
      (left.slotIndex ?? Number.MAX_SAFE_INTEGER) - (right.slotIndex ?? Number.MAX_SAFE_INTEGER)
      || new Date(left.startTime || left.date || 0).getTime() - new Date(right.startTime || right.date || 0).getTime()
    ));
  const fallbackSchedule = [...(cls?.slots || [])]
    .filter(item => Boolean(item.learningLessonId))
    .sort((left, right) => new Date(left.startTime || left.date).getTime() - new Date(right.startTime || right.date).getTime())
    .map(item => ({ lessonId: item.learningLessonId as string, date: item.date, startTime: item.startTime, endTime: item.endTime }));
  const slots: SubmissionLessonSchedule[] = authoritativeSchedule.length > 0 ? authoritativeSchedule : fallbackSchedule;
  const slot = slots.find(item => item.lessonId === lesson.id);
  if (!slot) return null;
  const slotIndex = slots.indexOf(slot);
  const nextSlot = slots[slotIndex + 1];
  return nextSlot?.startTime || nextSlot?.date || slot.endTime || slot.startTime || slot.date || null;
}

export function buildSubmissionCells(
  data: ClassSubmissionData,
  cls?: Class,
  options: SubmissionSummaryOptions = {},
): SubmissionCell[] {
  const lessons = getActiveSubmissionLessons(data, cls, options);
  const now = options.now ?? new Date();
  const submissionsByStudentLesson = new Map<string, StudentSubmission[]>();

  data.submissions.forEach(submission => {
    const key = `${submission.studentUid}:${submission.lessonId}`;
    const current = submissionsByStudentLesson.get(key) || [];
    current.push(submission);
    submissionsByStudentLesson.set(key, current);
  });

  return getSubmissionStudents(data, cls).flatMap(student => lessons.map(lesson => {
    const candidates = submissionsByStudentLesson.get(`${student.studentUid}:${lesson.id}`) || [];
    const teacherTasks = candidates.filter(isTeacherMarkedTask);
    const relevantTasks = teacherTasks.length > 0 ? teacherTasks : candidates;
    const submission = [...relevantTasks].sort((left, right) => submissionTimestamp(right) - submissionTimestamp(left))[0];
    const dueAt = getLessonDueAt(data, cls, lesson);
    const dueTime = dueAt ? new Date(dueAt).getTime() : Number.NaN;
    const isNotDue = Number.isFinite(dueTime) && dueTime > now.getTime();
    const status: SubmissionCellStatus = submission && isGradedSubmission(submission)
      ? 'graded'
      : submission && isSubmittedSubmission(submission)
        ? 'pending'
        : isNotDue
          ? 'not_due'
          : 'missing';

    return { student, lesson, submission, status, dueAt };
  }));
}

export function summarizeSubmissionData(
  data: ClassSubmissionData,
  cls?: Class,
  options: SubmissionSummaryOptions = {},
): SubmissionSummary {
  const now = options.now ?? new Date();
  const cells = buildSubmissionCells(data, cls, { ...options, now });
  const dueCells = cells.filter(cell => {
    if (!cell.dueAt) return true;
    const dueTime = new Date(cell.dueAt).getTime();
    return !Number.isFinite(dueTime) || dueTime <= now.getTime();
  });
  const missing = dueCells.filter(cell => cell.status === 'missing').length;
  const notDue = cells.length - dueCells.length;
  const pending = dueCells.filter(cell => cell.status === 'pending').length;
  const graded = dueCells.filter(cell => cell.status === 'graded').length;
  const submitted = pending + graded;

  return {
    totalExpected: dueCells.length,
    missing,
    notDue,
    pending,
    graded,
    submitted,
    submissionRate: dueCells.length > 0 ? (submitted / dueCells.length) * 100 : 0,
    gradingRate: submitted > 0 ? (graded / submitted) * 100 : 0,
  };
}

export function summarizeSubmissionSessions(
  data: ClassSubmissionData,
  cls?: Class,
  options: SubmissionSummaryOptions = {},
): SubmissionSessionSummary[] {
  const now = options.now ?? new Date();
  const cells = buildSubmissionCells(data, cls, { ...options, now });
  return getActiveSubmissionLessons(data, cls, options).flatMap(lesson => {
    const lessonCells = cells.filter(cell => cell.lesson.id === lesson.id);
    const dueAt = lessonCells[0]?.dueAt;
    const dueTime = dueAt ? new Date(dueAt).getTime() : Number.NaN;
    if (!Number.isFinite(dueTime) || dueTime > now.getTime()) return [];

    const missing = lessonCells.filter(cell => cell.status === 'missing').length;
    const pending = lessonCells.filter(cell => cell.status === 'pending').length;
    const graded = lessonCells.filter(cell => cell.status === 'graded').length;
    const submitted = pending + graded;
    const totalExpected = lessonCells.length;
    const submissionRate = totalExpected > 0 ? (submitted / totalExpected) * 100 : 0;
    const gradingRate = submitted > 0 ? (graded / submitted) * 100 : 0;

    return [{
      lesson,
      dueAt,
      totalExpected,
      missing,
      notDue: 0,
      pending,
      graded,
      submitted,
      submissionRate,
      gradingRate,
      completion: submitted === 0 ? 'none' : submitted === totalExpected ? 'complete' : 'partial',
    }];
  });
}
