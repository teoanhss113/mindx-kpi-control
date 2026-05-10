/**
 * classesService.ts
 * All operations related to classes/sessions data.
 * Handles automatic pagination for GetClasses.
 */

import { lmsQuery } from './lmsClient';
import { ClassesResponse, GetClassesVariables, Class } from '@/types/classes';

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
            commentByAreas { content }
            student { id fullName phoneNumber email gender imageUrl }
          }
        }
      }
      pagination { type total }
    }
  }
`;

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

const ITEMS_PER_PAGE = 100; // Increased from 20 for better performance

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Convert a local month (year, month 1-indexed) to UTC ISO range.
 * API works in UTC; Vietnam is GMT+7 so month boundary shifts accordingly.
 */
export function monthToUtcRange(year: number, month: number): { endDateFrom: string; endDateTo: string } {
  // Month start: 01-01 00:00 GMT+7 = previous day 17:00 UTC
  const startLocal = new Date(year, month - 1, 1, 0, 0, 0);
  const endDateFrom = new Date(startLocal.getTime() - 7 * 60 * 60 * 1000).toISOString();

  // Month end: last day 23:59:59.999 GMT+7 = same day 16:59:59.999 UTC
  const endLocal = new Date(year, month, 0, 23, 59, 59, 999);
  const endDateTo = new Date(endLocal.getTime() - 7 * 60 * 60 * 1000).toISOString();

  return { endDateFrom, endDateTo };
}

/**
 * Convert a generic local Date range to UTC ISO range for the API.
 */
export function dateRangeToUtcRange(fromDate: Date, toDate: Date): { endDateFrom: string; endDateTo: string } {
  // fromDate start of day 00:00 GMT+7 -> previous day 17:00 UTC
  const startLocal = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate(), 0, 0, 0);
  const endDateFrom = new Date(startLocal.getTime() - 7 * 60 * 60 * 1000).toISOString();

  // toDate end of day 23:59:59.999 GMT+7 -> current day 16:59:59.999 UTC
  const endLocal = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate(), 23, 59, 59, 999);
  const endDateTo = new Date(endLocal.getTime() - 7 * 60 * 60 * 1000).toISOString();

  return { endDateFrom, endDateTo };
}

/**
 * Convert a local date range to UTC ISO format for the haveSlotIn filter.
 * Used by "Tỷ lệ thay đổi giáo viên": classes that have ANY slot in the period,
 * regardless of class start/end date or status.
 */
export function haveSlotInToUtcRange(fromDate: Date, toDate: Date): { from: string; to: string } {
  const startLocal = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate(), 0, 0, 0);
  const from = new Date(startLocal.getTime() - 7 * 60 * 60 * 1000).toISOString();

  const endLocal = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate(), 23, 59, 59, 999);
  const to = new Date(endLocal.getTime() - 7 * 60 * 60 * 1000).toISOString();

  return { from, to };
}

// ─── Fetch All Classes (with auto-pagination) ────────────────────────────────

export async function fetchAllClasses(
  overrides: Partial<GetClassesVariables> = {},
  onProgress?: (loaded: number, total: number, chunk: Class[]) => void,
  signal?: AbortSignal,
  queryOverride?: string
): Promise<Class[]> {
  const allClasses: Class[] = [];
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
    statusIn: [],
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
  allClasses.push(...firstPage.data);
  
  // Report initial progress
  onProgress?.(allClasses.length, total, firstPage.data);

  // Step 2: Parallel fetch remaining pages if necessary
  if (total > ITEMS_PER_PAGE) {
    const totalPages = Math.ceil(total / ITEMS_PER_PAGE);
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
          const incomingCount = response.data.classes.data.length;
          accumulatedLoaded += incomingCount;
          onProgress?.(accumulatedLoaded, total, response.data.classes.data);
          return response;
        })
      );
    }

    // Fire all remaining requests simultaneously!
    const responses = await Promise.all(remainingPromises);
    
    // Combine results in memory for return
    for (const res of responses) {
      allClasses.push(...res.data.classes.data);
    }
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
