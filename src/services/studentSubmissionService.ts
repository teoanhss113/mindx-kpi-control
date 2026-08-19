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

interface BatchSubmissionResult {
  data: Record<string, ClassSubmissionData>;
  errors: Record<string, string>;
}

interface SubmissionBundleParts {
  submissionData: ClassSubmissionData | null | undefined;
  courseVersionData: FindStudentSubmissionBundleByClassResponse['data']['findCourseVersionByClass'];
  classData: FindStudentSubmissionBundleByClassResponse['data']['classesById'];
}

const STUDENT_SUBMISSION_SELECTION = `
  students { id displayName studentUid }
  lessons { id name type isActive displayOrder }
  submissions {
    id type note score status category classId lessonId learningCourseId
    studentUid markedAt markedBy createdAt submittedAt submittedCount
    content { scratchState type attachments totalQuiz submitQuiz correctAnswer }
  }
`;

const COURSE_VERSION_SELECTION = `
  usedVersion { id name isEnabled learningCourseId description }
  lessons { id name type isActive learningCourseId displayOrder courseVersionId }
  versions { id name isEnabled learningCourseId description }
`;

const CLASS_SCHEDULE_SELECTION = `
  slots { date startTime endTime index learningLessonId }
`;

const FIND_STUDENT_SUBMISSION_BUNDLE_BY_CLASS_QUERY = `
  query FindStudentSubmissionBundleByClass($payload: FindStudentSubmissionByClassQuery, $classId: String!, $entityId: ID!) {
    findStudentSubmissionByClass(payload: $payload) {
      ${STUDENT_SUBMISSION_SELECTION}
    }
    findCourseVersionByClass(payload: { classId: $classId }) {
      ${COURSE_VERSION_SELECTION}
    }
    classesById(id: $entityId) {
      ${CLASS_SCHEDULE_SELECTION}
    }
  }
`;

function normalizeSubmissionBundle({
  submissionData,
  courseVersionData,
  classData,
}: SubmissionBundleParts): ClassSubmissionData {
  const versionLessons = courseVersionData?.usedVersion
    ? courseVersionData.lessons.filter(lesson => lesson.courseVersionId === courseVersionData.usedVersion?.id)
    : [];
  const lessonSchedule = (classData?.slots || [])
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

  return normalizeSubmissionBundle({
    submissionData: response.data.findStudentSubmissionByClass,
    courseVersionData: response.data.findCourseVersionByClass,
    classData: response.data.classesById,
  });
}

/**
 * Loads several classes in one HTTP/GraphQL request. GraphQL cannot pass the
 * result of the class-list field into another field in the same operation, so
 * aliases are used once the class IDs are known to avoid one request per class.
 */
export async function fetchStudentSubmissionsByClasses(
  classIds: string[],
  signal?: AbortSignal,
): Promise<BatchSubmissionResult> {
  const uniqueClassIds = Array.from(new Set(classIds.filter(Boolean)));
  if (uniqueClassIds.length === 0) return { data: {}, errors: {} };

  const variableDefinitions = uniqueClassIds.flatMap((_, index) => [
    `$payload${index}: FindStudentSubmissionByClassQuery`,
    `$classId${index}: String!`,
    `$entityId${index}: ID!`,
  ]).join(', ');
  const fields = uniqueClassIds.map((_, index) => `
    submission${index}: findStudentSubmissionByClass(payload: $payload${index}) {
      ${STUDENT_SUBMISSION_SELECTION}
    }
    course${index}: findCourseVersionByClass(payload: { classId: $classId${index} }) {
      ${COURSE_VERSION_SELECTION}
    }
    class${index}: classesById(id: $entityId${index}) {
      ${CLASS_SCHEDULE_SELECTION}
    }
  `).join('\n');
  const variables = uniqueClassIds.reduce<Record<string, unknown>>((result, classId, index) => {
    result[`payload${index}`] = { classId };
    result[`classId${index}`] = classId;
    result[`entityId${index}`] = classId;
    return result;
  }, {});

  const response = await lmsQuery<{
    data?: Record<string, unknown>;
    errors?: Array<{ message?: string; path?: Array<string | number> }>;
  }>({
    query: `query FindStudentSubmissionBundlesByClass(${variableDefinitions}) { ${fields} }`,
    operationName: 'FindStudentSubmissionBundlesByClass',
    variables,
    signal,
    allowPartialErrors: true,
  });

  const result: BatchSubmissionResult = { data: {}, errors: {} };
  const responseData = response.data || {};
  uniqueClassIds.forEach((classId, index) => {
    const submissionData = responseData[`submission${index}`] as ClassSubmissionData | null | undefined;
    const matchingError = response.errors?.find(error => error.path?.[0] === `submission${index}`);
    if (submissionData === undefined || matchingError) {
      result.errors[classId] = matchingError?.message || 'Không thể tải dữ liệu bài tập';
      return;
    }
    result.data[classId] = normalizeSubmissionBundle({
      submissionData,
      courseVersionData: responseData[`course${index}`] as SubmissionBundleParts['courseVersionData'],
      classData: responseData[`class${index}`] as SubmissionBundleParts['classData'],
    });
  });
  return result;
}
