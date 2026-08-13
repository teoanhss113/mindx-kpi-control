import { lmsQuery } from './lmsClient';

export interface SubmissionStudent {
  id: string;
  displayName: string;
  studentUid: string;
}

export interface SubmissionLesson {
  id: string;
  name: string;
  type?: string | null;
  isActive?: boolean | null;
  displayOrder?: number | null;
  learningCourseId?: string | null;
  courseVersionId?: string | null;
}

export interface StudentSubmission {
  id: string;
  type?: string | null;
  note?: string | null;
  score?: number | null;
  status?: string | null;
  category?: string | null;
  classId?: string | null;
  lessonId: string;
  learningCourseId?: string | null;
  studentUid: string;
  markedAt?: string | null;
  markedBy?: string | null;
  createdAt?: string | null;
  submittedAt?: string | null;
  submittedCount?: number | null;
  content?: {
    scratchState?: unknown;
    type?: string | null;
    attachments?: unknown;
    totalQuiz?: number | null;
    submitQuiz?: number | null;
    correctAnswer?: number | null;
  } | null;
}

export interface ClassSubmissionData {
  students: SubmissionStudent[];
  lessons: SubmissionLesson[];
  submissions: StudentSubmission[];
  usedVersion?: CourseVersion | null;
  lessonSchedule?: SubmissionLessonSchedule[];
}

export interface SubmissionLessonSchedule {
  lessonId: string;
  date?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  slotIndex?: number | null;
}

export interface CourseVersion {
  id: string;
  name: string;
  isEnabled?: boolean | null;
  learningCourseId?: string | null;
  description?: string | null;
}

interface FindStudentSubmissionBundleByClassResponse {
  data: {
    findStudentSubmissionByClass: ClassSubmissionData | null;
    findCourseVersionByClass: {
      usedVersion: CourseVersion | null;
      lessons: SubmissionLesson[];
      versions: CourseVersion[];
    } | null;
    classesById: {
      slots: Array<{
        date?: string | null;
        startTime?: string | null;
        endTime?: string | null;
        index?: number | null;
        learningLessonId?: string | null;
      }>;
    } | null;
  };
}

const FIND_STUDENT_SUBMISSION_BUNDLE_BY_CLASS_QUERY = `
  query FindStudentSubmissionBundleByClass($payload: FindStudentSubmissionByClassQuery, $classId: String!, $entityId: ID!) {
    findStudentSubmissionByClass(payload: $payload) {
      students { id displayName studentUid }
      lessons { id name type isActive displayOrder }
      submissions {
        id type note score status category classId lessonId learningCourseId
        studentUid markedAt markedBy createdAt submittedAt submittedCount
        content { scratchState type attachments totalQuiz submitQuiz correctAnswer }
      }
    }
    findCourseVersionByClass(payload: { classId: $classId }) {
      usedVersion { id name isEnabled learningCourseId description }
      lessons { id name type isActive learningCourseId displayOrder courseVersionId }
      versions { id name isEnabled learningCourseId description }
    }
    classesById(id: $entityId) {
      slots { date startTime endTime index learningLessonId }
    }
  }
`;

export async function fetchStudentSubmissionsByClass(
  classId: string,
  signal?: AbortSignal,
): Promise<ClassSubmissionData> {
  const response = await lmsQuery<FindStudentSubmissionBundleByClassResponse>({
    query: FIND_STUDENT_SUBMISSION_BUNDLE_BY_CLASS_QUERY,
    operationName: 'FindStudentSubmissionBundleByClass',
    variables: { payload: { classId }, classId, entityId: classId },
    signal,
  });

  const submissionData = response.data.findStudentSubmissionByClass;
  const courseVersionData = response.data.findCourseVersionByClass;
  const versionLessons = courseVersionData?.usedVersion
    ? courseVersionData.lessons.filter(lesson => lesson.courseVersionId === courseVersionData.usedVersion?.id)
    : [];
  const lessonSchedule = (response.data.classesById?.slots || [])
    .filter(slot => Boolean(slot.learningLessonId))
    .map(slot => ({
      lessonId: slot.learningLessonId as string,
      date: slot.date,
      startTime: slot.startTime,
      endTime: slot.endTime,
      slotIndex: slot.index,
    }));

  return submissionData ? {
    ...submissionData,
    lessons: versionLessons.length > 0 ? versionLessons : submissionData.lessons,
    usedVersion: courseVersionData?.usedVersion || null,
    lessonSchedule,
  } : {
    students: [],
    lessons: versionLessons,
    submissions: [],
    usedVersion: courseVersionData?.usedVersion || null,
    lessonSchedule,
  };
}
