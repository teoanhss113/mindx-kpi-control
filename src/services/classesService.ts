/**
 * classesService.ts
 * All operations related to classes/sessions data.
 * Handles automatic pagination for GetClasses.
 */

import { lmsQuery } from './lmsClient';
import { ClassesResponse, GetClassesVariables, Class, CommentAreaDef, StudentWork, ClassStatusConfigItem } from '@/types/classes';

// ─── GraphQL Query ───────────────────────────────────────────────────────────

const GET_CLASSES_QUERY = /* graphql */ `
  query GetClasses(
    $search: String, $centre: String, $operationMethodId: [String],
    $openStatus: [String], $centres: [String], $courses: [String],
    $courseLines: [String], $startDateFrom: Date, $startDateTo: Date,
    $endDateFrom: Date, $endDateTo: Date, $haveSlotFrom: Date, $haveSlotTo: Date,
    $statusNotEquals: String, $attendanceCheckedExists: Boolean, $status: String,
    $statusIn: [String], $attendanceStatus: [String], $studentAttendanceStatus: [String],
    $teacherAttendanceStatus: [String], $pageIndex: Int!, $itemsPerPage: Int!,
    $orderBy: String, $teacherId: String, $teacherSlot: [String],
    $passedSessionIndex: Int, $unpassedSessionIndex: Int,
    $haveSlotIn: HaveSlotIn, $comments: ClassCommentQuery
  ) {
    classes(payload: {
      filter_textSearch: $search, centre_equals: $centre, centre_in: $centres,
      operationMethodId_in: $operationMethodId, teacher_equals: $teacherId,
      teacherSlots: $teacherSlot, course_in: $courses, courseLine_in: $courseLines,
      startDate_gt: $startDateFrom, startDate_lt: $startDateTo,
      endDate_gt: $endDateFrom, endDate_lt: $endDateTo,
      haveSlot_from: $haveSlotFrom, haveSlot_to: $haveSlotTo,
      status_ne: $statusNotEquals, status_in: $statusIn, status_equals: $status,
      attendanceStatus_in: $attendanceStatus,
      studentAttendanceStatus_in: $studentAttendanceStatus,
      teacherAttendanceStatus_in: $teacherAttendanceStatus,
      attendanceChecked_exists: $attendanceCheckedExists,
      haveSlot_in: $haveSlotIn, passedSessionIndex: $passedSessionIndex,
      unpassedSessionIndex: $unpassedSessionIndex,
      pageIndex: $pageIndex, itemsPerPage: $itemsPerPage,
      orderBy: $orderBy, comments: $comments, openStatus: $openStatus
    }) {
      data {
        id
        name
        level
        status
        startDate
        endDate
        numberOfSessions
        numberOfSessionsStatus
        sessionHour
        totalHour
        openingRoomNo
        hasSchedule
        createdAt
        lastModifiedAt
        course { id name shortName courseLine { id name } }
        centre { id name shortName }
        classSites { _id name }
        operationMethod { id name }
        operator { id username firstName middleName lastName }
        classStatusConfig {
          id
          code
          statusConfigs {
            id
            status
            nextStatuses
            description
            allowActions
          }
        }
        teachers {
          _id
          isActive
          teacher { id username code fullName email phoneNumber imageUrl }
          role { id name shortName }
        }
        students {
          _id
          activeInClass
          createdAt
          note
          student {
            id
            fullName
            customer { fullName phoneNumber email facebook zalo }
          }
          completionInfo {
            status
            note
            reason
          }
        }
        slots {
          _id
          date
          startTime
          endTime
          sessionHour
          summary
          homework
          teachers {
            _id
            isActive
            teacher { id username code fullName email phoneNumber imageUrl }
            role { id name shortName }
          }
          teacherAttendance {
            _id status note createdAt lastModifiedAt
            teacher { id fullName email }
          }
          studentAttendance {
            _id status comment sendCommentStatus
            commentByAreas {
              content
              grade
              commentAreaId
              type
              courseProcessFinalEvaluationTitle
            }
            student { id fullName phoneNumber email gender imageUrl }
          }
        }
        courseProcess {
          id
          defaultCommentAreas {
            id name type isRequired guideline
            rates { value commentSamples }
          }
          specificSessions {
            session
            commentAreas {
              id name type isRequired guideline
              rates { value commentSamples }
            }
          }
          finalSession {
            finalEvaluations {
              id title
              commentAreas {
                id name type isRequired guideline
                rates { value commentSamples }
              }
            }
            demoScore {
              commentAreas {
                id name type
                demo { id title maxScore }
              }
            }
          }
          checkpointSessions {
            session
            checkpointCommentArea {
              id name type
            }
            otherComments {
              id name type isRequired guideline
              rates { value commentSamples }
            }
            evaluations {
              id title
              commentAreas {
                id name type isRequired guideline
                rates { value commentSamples }
              }
            }
          }
        }
      }
      pagination { type total }
    }
  }
`;

const STUDENT_COMMENT_AREAS_QUERY = /* graphql */ `
  query studentCommentAreas($payload: FindCommentAreasInput!) {
    studentCommentAreas(payload: $payload) {
      data {
        id
        name
        translations { key value locale }
        fieldName
        type
        rates { value commentSamples }
        isActive
        sortOrder
        slots
        isPublic
        isRequired
        guideline
      }
      pagination { total }
    }
  }
`;

const GET_CLASS_STATUS_CONFIGS_QUERY = /* graphql */ `
  query GetClassStatusConfigs($pageIndex: Int!, $itemsPerPage: Int!, $orderBy: String, $statusIn: [String]) {
    classes(payload: { pageIndex: $pageIndex, itemsPerPage: $itemsPerPage, orderBy: $orderBy, status_in: $statusIn }) {
      data {
        status
        classStatusConfig {
          statusConfigs {
            id
            status
            nextStatuses
            description
            allowActions
          }
        }
      }
    }
  }
`;

interface ClassStatusConfigsResponse {
  data: {
    classes: {
      data: {
        status?: string;
        classStatusConfig?: {
          statusConfigs?: ClassStatusConfigItem[];
        } | null;
      }[];
    };
  };
}

export async function fetchClassStatusConfigs(signal?: AbortSignal): Promise<ClassStatusConfigItem[]> {
  const statusSamples = [
    undefined,
    ['RUNNING'],
    ['FINISHED'],
    ['PREPARING'],
    ['ABANDONED'],
    ['REJECTED'],
    ['SUSPENDED'],
  ];
  const configsByStatus = new Map<string, ClassStatusConfigItem>();

  for (const statusIn of statusSamples) {
    const response = await lmsQuery<ClassStatusConfigsResponse>({
      query: GET_CLASS_STATUS_CONFIGS_QUERY,
      operationName: 'GetClassStatusConfigs',
      variables: {
        pageIndex: 0,
        itemsPerPage: 20,
        orderBy: 'createdAt_desc',
        ...(statusIn ? { statusIn } : {}),
      },
      signal,
      allowPartialErrors: true,
    });

    response.data.classes.data.forEach(cls => {
      (cls.classStatusConfig?.statusConfigs || []).forEach(config => {
        if (config.status) configsByStatus.set(config.status, config);
      });
    });

    if (configsByStatus.size > 2) break;
  }

  return Array.from(configsByStatus.values());
}

const FIND_ALL_STUDENT_WORKS_QUERY = /* graphql */ `
  query findAllStudentWorks($studentId: String, $classSessionId: String, $classId: String, $classIds: [String]) {
    findAllStudentWorks(payload: {
      studentId_equals: $studentId,
      classSessionId_equals: $classSessionId,
      classId_equals: $classId,
      classId_in: $classIds
    }) {
      data {
        id
        status
        studentId
        classSessionId
        classId
        version
        displayOrder
        latestData {
          title
          thumbnail
          videoUrls
          imageUrl
          attachmentUrls
          comment
          rejectReason
          relatedUrls {
            name
            url
          }
        }
        createdBy { displayName }
        createdAt
        lastModifiedBy { displayName }
        lastModifiedAt
      }
    }
  }
`;

interface StudentWorksResponse {
  data: {
    findAllStudentWorks: {
      data: StudentWork[];
    };
  };
}

export async function fetchStudentWorks(
  variables: {
    studentId?: string;
    classSessionId?: string;
    classId?: string;
    classIds?: string[];
  },
  signal?: AbortSignal
): Promise<StudentWork[]> {
  if (variables.classIds && variables.classIds.length > 50) {
    const chunks: string[][] = [];
    for (let index = 0; index < variables.classIds.length; index += 50) {
      chunks.push(variables.classIds.slice(index, index + 50));
    }
    const results = await Promise.all(chunks.map(classIds => fetchStudentWorks({ ...variables, classIds }, signal)));
    return results.flat();
  }

  const response = await lmsQuery<StudentWorksResponse>({
    query: FIND_ALL_STUDENT_WORKS_QUERY,
    operationName: 'findAllStudentWorks',
    variables,
    signal,
  });

  return response.data.findAllStudentWorks.data || [];
}

interface StudentCommentAreasResponse {
  data: {
    studentCommentAreas: {
      data: CommentAreaDef[];
      pagination: { total: number };
    };
  };
}

export async function fetchStudentCommentAreas(
  slots: string[] = [],
  signal?: AbortSignal
): Promise<CommentAreaDef[]> {
  const uniqueSlots = Array.from(new Set(slots.filter(Boolean)));
  const payload = {
    filter: {
      isActive_equals: true,
      type_in: ['CONTENT', 'RATE'],
      ...(uniqueSlots.length > 0 ? { slots_in: uniqueSlots } : {}),
    },
    pagination: { paginationType: 'NONE' },
    orderBy: 'sortOrder_DESC',
  };

  const response = await lmsQuery<StudentCommentAreasResponse>({
    query: STUDENT_COMMENT_AREAS_QUERY,
    operationName: 'studentCommentAreas',
    variables: { payload },
    signal,
  });

  return response.data.studentCommentAreas.data || [];
}

export const GET_CLASSES_LIGHT_QUERY = /* graphql */ `
  query GetClassesLight(
    $search: String, $centre: String, $operationMethodId: [String],
    $openStatus: [String], $centres: [String], $courses: [String],
    $courseLines: [String], $startDateFrom: Date, $startDateTo: Date,
    $endDateFrom: Date, $endDateTo: Date, $haveSlotFrom: Date, $haveSlotTo: Date,
    $statusNotEquals: String, $attendanceCheckedExists: Boolean, $status: String,
    $statusIn: [String], $attendanceStatus: [String], $studentAttendanceStatus: [String],
    $teacherAttendanceStatus: [String], $pageIndex: Int!, $itemsPerPage: Int!,
    $orderBy: String, $teacherId: String, $teacherSlot: [String],
    $passedSessionIndex: Int, $unpassedSessionIndex: Int,
    $haveSlotIn: HaveSlotIn, $comments: ClassCommentQuery
  ) {
    classes(payload: {
      filter_textSearch: $search, centre_equals: $centre, centre_in: $centres,
      operationMethodId_in: $operationMethodId, teacher_equals: $teacherId,
      teacherSlots: $teacherSlot, course_in: $courses, courseLine_in: $courseLines,
      startDate_gt: $startDateFrom, startDate_lt: $startDateTo,
      endDate_gt: $endDateFrom, endDate_lt: $endDateTo,
      haveSlot_from: $haveSlotFrom, haveSlot_to: $haveSlotTo,
      status_ne: $statusNotEquals, status_in: $statusIn, status_equals: $status,
      attendanceStatus_in: $attendanceStatus,
      studentAttendanceStatus_in: $studentAttendanceStatus,
      teacherAttendanceStatus_in: $teacherAttendanceStatus,
      attendanceChecked_exists: $attendanceCheckedExists,
      haveSlot_in: $haveSlotIn, passedSessionIndex: $passedSessionIndex,
      unpassedSessionIndex: $unpassedSessionIndex,
      pageIndex: $pageIndex, itemsPerPage: $itemsPerPage,
      orderBy: $orderBy, comments: $comments, openStatus: $openStatus
    }) {
      data {
        id
        name
        status
        startDate
        endDate
        course { id name shortName courseLine { id name } }
        centre { id name shortName }
        classStatusConfig {
          id
          code
          statusConfigs {
            id
            status
            nextStatuses
            description
            allowActions
          }
        }
        teachers {
          isActive
          teacher { id fullName }
          role { shortName }
        }
        students {
          _id
          activeInClass
          student { id fullName }
          completionInfo {
            status
            reason
          }
        }
        slots {
          _id
          date
          teachers {
            isActive
            teacher { id fullName }
            role { shortName }
          }
          studentAttendance {
            student { id }
          }
        }
      }
      pagination { total }
    }
  }
`;

// ─── Default Centre IDs ──────────────────────────────────────────────────────
// TODO: Replace with API call if a dynamic endpoint is found (see REQUIREMENT.md §7.3)
export const DEFAULT_CENTRE_IDS = [
  '62918d02af37d11e2da237e5',
  '63034f4a7d1d1e1cb14e4e57',
  '62cc07753c1309654f472e60',
  '62d6dcc16e356729147d73a6',
  '62b0234675379306da49f051',
  '609bf4149535070ca5e3edc0',
  '62d6dc936e356729147d7399',
];

const ITEMS_PER_PAGE = 100; // Larger page size for faster admin data loading

// ─── Helpers ─────────────────────────────────────────────────────────────────

const LMS_TIMEZONE_OFFSET_MS = 7 * 60 * 60 * 1000;

function parseDateInputParts(value: string): [number, number, number] | null {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  return [year, month, day];
}

function lmsLocalDateToUtcIso(value: string, endOfDay = false): string {
  const parts = parseDateInputParts(value);
  if (!parts) {
    const fallback = new Date(value);
    if (endOfDay) fallback.setHours(23, 59, 59, 999);
    else fallback.setHours(0, 0, 0, 0);
    return new Date(fallback.getTime() - LMS_TIMEZONE_OFFSET_MS).toISOString();
  }

  const [year, month, day] = parts;
  const utcMs = endOfDay
    ? Date.UTC(year, month - 1, day, 23, 59, 59, 999)
    : Date.UTC(year, month - 1, day, 0, 0, 0, 0);
  return new Date(utcMs - LMS_TIMEZONE_OFFSET_MS).toISOString();
}

export function lmsLocalDateStringToDate(value: string, endOfDay = false): Date {
  return new Date(lmsLocalDateToUtcIso(value, endOfDay));
}

export function dateStringRangeToUtcRange(fromValue: string, toValue: string): { endDateFrom: string; endDateTo: string } {
  return {
    endDateFrom: lmsLocalDateToUtcIso(fromValue),
    endDateTo: lmsLocalDateToUtcIso(toValue, true),
  };
}

export function haveSlotInDateStringRangeToUtcRange(fromValue: string, toValue: string): { from: string; to: string } {
  return {
    from: lmsLocalDateToUtcIso(fromValue),
    to: lmsLocalDateToUtcIso(toValue, true),
  };
}

/**
 * Convert a local month (year, month 1-indexed) to UTC ISO range.
 * API works in UTC; Vietnam is GMT+7 so month boundary shifts accordingly.
 */
export function monthToUtcRange(year: number, month: number): { endDateFrom: string; endDateTo: string } {
  // Month start: 01-01 00:00 GMT+7 = previous day 17:00 UTC
  const startLocal = new Date(year, month - 1, 1, 0, 0, 0);
  const endDateFrom = new Date(startLocal.getTime() - LMS_TIMEZONE_OFFSET_MS).toISOString();

  // Month end: last day 23:59:59.999 GMT+7 = same day 16:59:59.999 UTC
  const endLocal = new Date(year, month, 0, 23, 59, 59, 999);
  const endDateTo = new Date(endLocal.getTime() - LMS_TIMEZONE_OFFSET_MS).toISOString();

  return { endDateFrom, endDateTo };
}

/**
 * Convert a generic local Date range to UTC ISO range for the API.
 */
export function dateRangeToUtcRange(fromDate: Date, toDate: Date): { endDateFrom: string; endDateTo: string } {
  // fromDate start of day 00:00 GMT+7 -> previous day 17:00 UTC
  const startLocal = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate(), 0, 0, 0);
  const endDateFrom = new Date(startLocal.getTime() - LMS_TIMEZONE_OFFSET_MS).toISOString();

  // toDate end of day 23:59:59.999 GMT+7 -> current day 16:59:59.999 UTC
  const endLocal = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate(), 23, 59, 59, 999);
  const endDateTo = new Date(endLocal.getTime() - LMS_TIMEZONE_OFFSET_MS).toISOString();

  return { endDateFrom, endDateTo };
}

/**
 * Convert a local date range to UTC ISO format for the haveSlotIn filter.
 * Used by "Tỷ lệ thay đổi giáo viên": classes that have ANY slot in the period,
 * regardless of class start/end date or status.
 */
export function haveSlotInToUtcRange(fromDate: Date, toDate: Date): { from: string; to: string } {
  const startLocal = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate(), 0, 0, 0);
  const from = new Date(startLocal.getTime() - LMS_TIMEZONE_OFFSET_MS).toISOString();

  const endLocal = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate(), 23, 59, 59, 999);
  const to = new Date(endLocal.getTime() - LMS_TIMEZONE_OFFSET_MS).toISOString();

  return { from, to };
}

// ─── Fetch All Classes (with auto-pagination) ────────────────────────────────

export async function fetchAllClasses(
  overrides: Partial<GetClassesVariables> = {},
  onProgress?: (loaded: number, total: number, chunk: Class[]) => void,
  signal?: AbortSignal,
  queryOverride?: string,
  maxItems?: number
): Promise<Class[]> {
  const allClasses: Class[] = [];
  const debugPages: Array<{ pageIndex: number; count: number; total: number; names: string[] }> = [];
  let total = Infinity;

  const base: Omit<GetClassesVariables, 'pageIndex'> = {
    search: '',
    centres: DEFAULT_CENTRE_IDS,
    courses: [],
    courseLines: [],
    startDate: [null, null],
    itemsPerPage: ITEMS_PER_PAGE,
    orderBy: 'createdAt_desc',
    type: 'OFFSET',
    teacherSlot: [],
    passedSessionIndex: null,
    unpassedSessionIndex: null,
    haveSlotIn: {},
    comments: { criteria: [] },
    ...overrides,
  };

  // Step 1: Fetch Page 1 to discover the total count
  const initialVariables: GetClassesVariables = { ...base, pageIndex: 0 };
  const firstResponse = await lmsQuery<ClassesResponse>({
    query: queryOverride || GET_CLASSES_QUERY,
    variables: initialVariables as unknown as Record<string, unknown>,
    operationName: queryOverride ? 'GetClassesLight' : 'GetClasses',
    signal,
  });

  const firstPage = firstResponse.data.classes;
  total = firstPage.pagination.total;
  const targetTotal = maxItems ? Math.min(total, maxItems) : total;
  const firstPageData = firstPage.data.slice(0, targetTotal);
  allClasses.push(...firstPageData);
  debugPages.push({
    pageIndex: 0,
    count: firstPageData.length,
    total,
    names: firstPageData.map(cls => cls.name),
  });
  const effectivePageSize = firstPage.data.length > 0 && firstPage.data.length < ITEMS_PER_PAGE
    ? firstPage.data.length
    : ITEMS_PER_PAGE;
  
  // Report initial progress
  onProgress?.(allClasses.length, targetTotal, firstPageData);

  // Step 2: Parallel fetch remaining pages if necessary
  if (targetTotal > allClasses.length && effectivePageSize > 0) {
    const totalPages = Math.ceil(targetTotal / effectivePageSize);
    const remainingPromises: Array<Promise<ClassesResponse>> = [];
    let accumulatedLoaded = allClasses.length;

    for (let i = 1; i < totalPages; i++) {
      const pageVariables = { ...base, pageIndex: i };
      remainingPromises.push(
        lmsQuery<ClassesResponse>({
          query: queryOverride || GET_CLASSES_QUERY,
          variables: pageVariables as unknown as Record<string, unknown>,
          operationName: queryOverride ? 'GetClassesLight' : 'GetClasses',
          signal,
        }).then(response => {
          // Update live progress AS EACH PROMISE RESOLVES individually!
          const remainingSlots = Math.max(targetTotal - accumulatedLoaded, 0);
          const chunkData = response.data.classes.data.slice(0, remainingSlots);
          const incomingCount = chunkData.length;
          accumulatedLoaded += incomingCount;
          debugPages.push({
            pageIndex: i,
            count: incomingCount,
            total: response.data.classes.pagination.total,
            names: chunkData.map(cls => cls.name),
          });
          onProgress?.(accumulatedLoaded, targetTotal, chunkData);
          return response;
        })
      );
    }

    // Fire all remaining requests simultaneously!
    const responses = await Promise.all(remainingPromises);
    
    // Combine results in memory for return
    for (const res of responses) {
      const remainingSlots = Math.max(targetTotal - allClasses.length, 0);
      if (remainingSlots <= 0) break;
      allClasses.push(...res.data.classes.data.slice(0, remainingSlots));
    }
  }

  if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
    const diagnostics = {
      operationName: queryOverride ? 'GetClassesLight' : 'GetClasses',
      requestedVariables: base,
      requestedItemsPerPage: ITEMS_PER_PAGE,
      apiTotal: total,
      fetchedCount: allClasses.length,
      pages: debugPages.sort((a, b) => a.pageIndex - b.pageIndex),
      classNames: allClasses.map(cls => cls.name),
    };
    (window as any).__lastLmsClassesFetch = diagnostics;
    console.log('[LMS Classes Fetch]', diagnostics);
    console.table(diagnostics.pages.map(page => ({
      pageIndex: page.pageIndex,
      count: page.count,
      total: page.total,
      names: page.names.join(', '),
    })));
  }

  return allClasses;
}

// ─── Fetch Classes for a specific month ─────────────────────────────────────

export async function fetchClassesForMonth(
  year: number,
  month: number,
  centres?: string[],
  onProgress?: (loaded: number, total: number) => void,
  signal?: AbortSignal
): Promise<Class[]> {
  const { endDateFrom, endDateTo } = monthToUtcRange(year, month);

  return fetchAllClasses(
    {
      endDateFrom,
      endDateTo,
      ...(centres ? { centres } : {}),
    },
    onProgress ? (loaded, total) => onProgress(loaded, total) : undefined,
    signal
  );
}
// Improved retry logic

/**
 * Fetch classes that have slots in the selected range.
 * This replaces the previous unpassedSessionIndex approach which was 
 * only accurate for the current moment. By fetching all classes in the range,
 * the client can accurately identify classes that had session 4 or 8 in that period.
 */
export async function fetchPendingSurveyClasses(
  fromDate: Date,
  toDate: Date,
  centres?: string[],
  onProgress?: (loaded: number, total: number, chunk: Class[]) => void,
  signal?: AbortSignal
): Promise<Class[]> {
  const haveSlotIn = haveSlotInToUtcRange(fromDate, toDate);
  
  // We fetch all classes that have any activity in this period.
  // We exclude TRIAL/Experience classes by filtering for specific statuses if needed,
  // but generally, fetchAllClasses with haveSlotIn is the standard administrative query.
  return fetchAllClasses(
    {
      haveSlotIn,
      ...(centres && centres.length > 0 ? { centres } : {}),
    },
    onProgress,
    signal,
    GET_CLASSES_LIGHT_QUERY
  );
}
