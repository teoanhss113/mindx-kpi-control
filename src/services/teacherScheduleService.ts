/**
 * teacherScheduleService.ts
 * Service for fetching and analyzing teacher schedules
 * Combines data from classes and office hours
 */

import { fetchAllClasses, haveSlotInToUtcRange } from './classesService';
import { fetchOfficeHours } from './officeHoursService';
import { searchUsers } from './ticketService';
import { lmsQuery } from './lmsClient';
import { Class } from '@/types/classes';
import { OfficeHour } from '@/types/officeHours';
import { LmsUser } from '@/types/ticket';
import {
  Teacher,
  TeacherSchedule,
  TeacherScheduleSlot,
  CoordinationRequest,
  TeacherAvailability,
} from '@/types/teacherSchedule';

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * Convert Class slots to TeacherScheduleSlot format
 */
function classToScheduleSlots(cls: Class): TeacherScheduleSlot[] {
  const slots: TeacherScheduleSlot[] = [];
  const classSiteId = cls.classSites?.[0]?._id;

  // Sort sessions chronologically so sessionNumber reflects true order
  const sortedSessions = [...cls.slots].sort((a, b) =>
    new Date(a.startTime || a.date).getTime() - new Date(b.startTime || b.date).getTime()
  );
  const sessionIndexMap = new Map<string, number>(
    sortedSessions.map((s, i) => [s._id, i + 1])
  );

  cls.slots.forEach(slot => {
    const sessionTeachers = slot.teachers
      .filter(teacherSlot => teacherSlot.isActive)
      .map(teacherSlot => ({
        teacher: {
          id: teacherSlot.teacher.id,
          username: teacherSlot.teacher.username,
          code: teacherSlot.teacher.code,
          fullName: teacherSlot.teacher.fullName,
          email: teacherSlot.teacher.email,
          phoneNumber: teacherSlot.teacher.phoneNumber,
          imageUrl: teacherSlot.teacher.imageUrl,
        },
        roleId: teacherSlot.role?.id,
        roleName: teacherSlot.role?.name,
        roleShortName: teacherSlot.role?.shortName,
      }));

    slot.teachers.forEach(teacherSlot => {
      if (teacherSlot.isActive) {
        slots.push({
          id: `class-${cls.id}-${slot._id}-${teacherSlot.teacher.id}`,
          type: 'class',
          teacher: {
            id: teacherSlot.teacher.id,
            username: teacherSlot.teacher.username,
            code: teacherSlot.teacher.code,
            fullName: teacherSlot.teacher.fullName,
            email: teacherSlot.teacher.email,
            phoneNumber: teacherSlot.teacher.phoneNumber,
            imageUrl: teacherSlot.teacher.imageUrl,
          },
          sessionTeachers,
          startTime: slot.startTime,
          endTime: slot.endTime,
          className: cls.name,
          classId: cls.id,
          classSiteId,
          sessionId: slot._id,
          roleId: teacherSlot.role?.id,
          roleName: teacherSlot.role?.name,
          roleShortName: teacherSlot.role?.shortName,
          centreId: cls.centre.id,
          centreName: cls.centre.name,
          centreShortName: cls.centre.shortName,
          courseLine: cls.course.courseLine?.name,
          status: cls.status,
          studentCount: cls.students.filter(s => s.activeInClass).length,
          sessionHour: slot.sessionHour,
          sessionNumber: sessionIndexMap.get(slot._id),
        });
      }
    });
  });

  return slots;
}

function scheduleSlotsToTeacherSchedules(slots: TeacherScheduleSlot[]): TeacherSchedule[] {
  const teacherMap = new Map<string, TeacherSchedule>();

  slots.forEach(slot => {
    if (!slot.teacher) return;

    const teacherId = slot.teacher.id;
    if (!teacherMap.has(teacherId)) {
      teacherMap.set(teacherId, {
        teacher: slot.teacher,
        slots: [],
      });
    }

    teacherMap.get(teacherId)!.slots.push(slot);
  });

  return Array.from(teacherMap.values()).map(schedule => ({
    ...schedule,
    slots: schedule.slots.sort((a, b) =>
      new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    ),
  }));
}

/**
 * Convert OfficeHour to TeacherScheduleSlot format
 * Office Hours include both:
 * - Office type: Ca trực tại cơ sở (offline)
 * - Trial type: Ca trực trực tuyến (online)
 */
function officeHourToScheduleSlot(oh: OfficeHour): TeacherScheduleSlot | null {
  if (!oh.teacher || !oh.centre) return null;
  
  const rawType = oh.type || '';
  const typeUpper = rawType.toUpperCase();
  
  let displayName = 'Ca trực tại cơ sở';
  if (typeUpper.includes('TRIAL')) displayName = 'Ca trực trực tuyến';
  else if (typeUpper.includes('MAKEUP')) displayName = 'Dạy bù';
  
  return {
    id: `office-hour-${oh.id}`,
    type: 'office-hour',
    startTime: oh.startTime,
    endTime: oh.endTime,
    className: displayName,
    officeHourType: rawType, // expose raw type for debugging
    classId: oh.class?.id,
    centreId: oh.centre.id,
    centreName: oh.centre.name,
    centreShortName: oh.centre.shortName,
    courseLine: oh.courseLines.map(cl => cl.name).join(', '),
    status: oh.status,
    studentCount: oh.studentCount,
  };
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
 * Calculate optimization score for teacher availability
 * Higher score = better choice
 */
function calculateTeacherScore(
  teacher: Teacher,
  request: CoordinationRequest,
  slots: TeacherScheduleSlot[]
): { score: number; reason: string; hasClassBefore: boolean; hasClassAfter: boolean } {
  let score = 100;
  const reasons: string[] = [];
  let hasClassBefore = false;
  let hasClassAfter = false;
  
  const requestStart = new Date(`${request.date}T${request.startTime}:00+07:00`).getTime();
  const requestEnd = new Date(`${request.date}T${request.endTime}:00+07:00`).getTime();
  
  // Check for slots at the same centre on the same day
  const sameCentreSlots = slots.filter(slot => {
    const slotDate = new Date(slot.startTime).toISOString().split('T')[0];
    return slot.centreId === request.centreId && slotDate === request.date;
  });
  
  if (sameCentreSlots.length > 0) {
    score += 50;
    reasons.push('Có lớp tại cùng cơ sở');
    
    // Check if has class before or after
    sameCentreSlots.forEach(slot => {
      const slotStart = new Date(slot.startTime).getTime();
      const slotEnd = new Date(slot.endTime).getTime();
      
      if (slotEnd <= requestStart) {
        hasClassBefore = true;
        score += 20;
      }
      if (slotStart >= requestEnd) {
        hasClassAfter = true;
        score += 20;
      }
    });
  }
  
  // Check total hours on that day
  const daySlots = slots.filter(slot => {
    const slotDate = new Date(slot.startTime).toISOString().split('T')[0];
    return slotDate === request.date;
  });
  
  const totalHours = daySlots.reduce((sum, slot) => sum + (slot.sessionHour || 2), 0);
  
  if (totalHours === 0) {
    score += 30;
    reasons.push('Hoàn toàn rảnh trong ngày');
  } else if (totalHours < 4) {
    score += 10;
    reasons.push('Ít giờ dạy trong ngày');
  } else if (totalHours >= 6) {
    score -= 20;
    reasons.push('Đã dạy nhiều giờ trong ngày');
  }
  
  const reason = reasons.length > 0 ? reasons.join(' • ') : 'Giáo viên rảnh';
  
  return { score, reason, hasClassBefore, hasClassAfter };
}

// ─── Main Functions ──────────────────────────────────────────────────────────

/**
 * Fetch teacher schedules for a date range
 */
export async function fetchTeacherSchedules(
  dateFrom: Date,
  dateTo: Date,
  centreIds?: string[],
  teacherIds?: string[],
  onProgress?: (loaded: number, total: number) => void,
  signal?: AbortSignal,
  preFetchedClasses?: Class[],
  preFetchedOfficeHours?: OfficeHour[]
): Promise<{ schedules: TeacherSchedule[], rawClasses: Class[], rawOfficeHours: OfficeHour[] }> {
  // Fetch classes with slots in the date range
  const haveSlotIn = haveSlotInToUtcRange(dateFrom, dateTo);
  
  const classes = preFetchedClasses || await fetchAllClasses(
    {
      haveSlotIn: { from: haveSlotIn.from, to: haveSlotIn.to },
      ...(centreIds && centreIds.length > 0 ? { centres: centreIds } : {}),
    },
    onProgress,
    signal
  );
  
  // Fetch office hours in the date range OR use pre-fetched ones
  const officeHoursData = preFetchedOfficeHours || (await fetchOfficeHours(
    {
      timeFrom: haveSlotIn.from,
      timeTo: haveSlotIn.to,
      ...(centreIds && centreIds.length > 0 ? { centreIn: centreIds } : {}),
    },
    undefined,
    signal
  )).data;
  
  // Build teacher schedule map
  const teacherMap = new Map<string, TeacherSchedule>();
  
  // Process classes
  classes.forEach(cls => {
    const slots = classToScheduleSlots(cls);
    
    slots.forEach(slot => {
      // Filter slots to only include those within the requested date range
      const slotTime = new Date(slot.startTime).getTime();
      if (slotTime < dateFrom.getTime() || slotTime > dateTo.getTime()) return;
      
      if (!slot.teacher) return;
      
      const teacherId = slot.teacher.id;
      
      if (!teacherMap.has(teacherId)) {
        teacherMap.set(teacherId, {
          teacher: slot.teacher,
          slots: [],
        });
      }
      
      teacherMap.get(teacherId)!.slots.push(slot);
    });
  });
  
  // Process office hours
  officeHoursData.forEach(oh => {
    if (!oh.teacher) return;
    
    // Filter office hours to only include those within the requested date range
    const ohTime = new Date(oh.startTime).getTime();
    if (ohTime < dateFrom.getTime() || ohTime > dateTo.getTime()) return;
    
    const slot = officeHourToScheduleSlot(oh);
    if (!slot) return;
    
    const teacherId = oh.teacher.id;
    
    if (!teacherMap.has(teacherId)) {
      teacherMap.set(teacherId, {
        teacher: {
          id: oh.teacher.id,
          username: oh.teacher.username,
          code: oh.teacher.code,
          fullName: oh.teacher.fullName,
          email: oh.teacher.email,
          phoneNumber: oh.teacher.phoneNumber,
          imageUrl: oh.teacher.imageUrl,
        },
        slots: [],
      });
    }
    
    teacherMap.get(teacherId)!.slots.push(slot);
  });
  
  // Convert to array and filter out teachers with no slots
  let schedules = Array.from(teacherMap.values()).filter(s => s.slots.length > 0);
  
  if (teacherIds && teacherIds.length > 0) {
    schedules = schedules.filter(s => teacherIds.includes(s.teacher.id));
  }
  
  // Sort slots by start time
  schedules.forEach(schedule => {
    schedule.slots.sort((a, b) => 
      new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );
  });
  
  return { schedules, rawClasses: classes, rawOfficeHours: officeHoursData };
}

export async function fetchClassTeacherSchedules(classId: string): Promise<TeacherSchedule[]> {
  const query = `
    query GetClassById($id: ID!) {
      classesById(id: $id) {
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
        course {
          id
          name
          shortName
          courseLine { id name }
        }
        centre { id name shortName }
        classSites { _id name }
        students {
          _id
          activeInClass
          student {
            id
            fullName
            customer { fullName phoneNumber email facebook zalo }
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
            teacher {
              id
              username
              code
              fullName
              email
              phoneNumber
              imageUrl
            }
            role { id name shortName }
            isActive
          }
          teacherAttendance {
            _id
            status
            note
            createdAt
            lastModifiedAt
            teacher { id fullName email }
          }
          studentAttendance {
            _id
            status
            comment
            sendCommentStatus
            student {
              id
              fullName
              phoneNumber
              email
              gender
              imageUrl
            }
          }
        }
        teachers {
          _id
          teacher {
            id
            username
            code
            fullName
            email
            phoneNumber
            imageUrl
          }
          role { id name shortName }
          isActive
        }
      }
    }
  `;

  const response = await lmsQuery<{ data: { classesById: Class | null } }>({
    operationName: 'GetClassById',
    query,
    variables: { id: classId },
  });

  const cls = response.data.classesById;
  if (!cls) {
    throw new Error('Không tìm thấy dữ liệu lớp trên LMS');
  }

  return scheduleSlotsToTeacherSchedules(classToScheduleSlots(cls));
}

/**
 * Fetch full class data (including commentByAreas) for quality analysis
 */
export async function fetchClassByIdFull(classId: string): Promise<Class | null> {
  const query = `
    query GetClassByIdFull($id: ID!) {
      classesById(id: $id) {
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
        course {
          id
          name
          shortName
          courseLine { id name }
        }
        centre { id name shortName }
        classSites { _id name }
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
        teachers {
          _id
          isActive
          teacher { id username code fullName email phoneNumber imageUrl }
          role { id name shortName }
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
    }
  `;

  const response = await lmsQuery<{ data: { classesById: Class | null } }>({
    operationName: 'GetClassByIdFull',
    query,
    variables: { id: classId },
  });

  return response.data.classesById;
}

/**
 * Find available teachers for a coordination request
 */
export async function findAvailableTeachers(
  request: CoordinationRequest,
  signal?: AbortSignal
): Promise<{ available: TeacherAvailability[]; unavailable: TeacherAvailability[] }> {
  // Fetch all teachers with pagination (max 100 per page)
  const allTeachers: LmsUser[] = [];
  let page = 0;
  let hasMore = true;
  
  try {
    while (hasMore && page < 10) { // Safety limit: max 10 pages
      try {
        const teachersResponse = await searchUsers('', page, 100);
        if (teachersResponse.data && teachersResponse.data.length > 0) {
          allTeachers.push(...teachersResponse.data);
          
          // If we got less than 100, we've reached the end
          if (teachersResponse.data.length < 100) {
            hasMore = false;
          }
        } else {
          hasMore = false;
        }
        page++;
      } catch (err) {
        console.error(`Error fetching teachers page ${page}:`, err);
        hasMore = false;
      }
    }
  } catch (err) {
    console.error('Error loading teachers:', err);
    // Continue with whatever teachers we have
  }
  
  // If no teachers found, return empty results
  if (allTeachers.length === 0) {
    return { available: [], unavailable: [] };
  }
  
  // Fetch schedules for the request date
  const dateFrom = new Date(request.date);
  const dateTo = new Date(request.date);
  dateTo.setHours(23, 59, 59, 999);
  
  const { schedules } = await fetchTeacherSchedules(
    dateFrom,
    dateTo,
    undefined,
    undefined,
    undefined,
    signal
  );
  
  const scheduleMap = new Map(schedules.map(s => [s.teacher.id, s.slots]));
  
  const requestStart = `${request.date}T${request.startTime}:00+07:00`;
  const requestEnd = `${request.date}T${request.endTime}:00+07:00`;
  
  const available: TeacherAvailability[] = [];
  const unavailable: TeacherAvailability[] = [];
  
  allTeachers.forEach(teacher => {
    const slots = scheduleMap.get(teacher.id) || [];
    
    // Check for conflicts
    const conflictSlots = slots.filter(slot =>
      timeRangesOverlap(slot.startTime, slot.endTime, requestStart, requestEnd)
    );
    
    const isAvailable = conflictSlots.length === 0;
    
    // Map LmsUser to Teacher type
    const teacherData: Teacher = {
      id: teacher.id,
      username: teacher.username,
      code: '', // LmsUser doesn't have code
      fullName: teacher.displayName || teacher.username,
      email: teacher.email,
      phoneNumber: '', // LmsUser doesn't have phoneNumber
      imageUrl: '', // LmsUser doesn't have imageUrl
    };
    
    const { score, reason, hasClassBefore, hasClassAfter } = calculateTeacherScore(
      teacherData,
      request,
      slots
    );
    
    const totalHoursToday = slots.reduce((sum, slot) => sum + (slot.sessionHour || 2), 0);
    
    const availability: TeacherAvailability = {
      teacher: teacherData,
      isAvailable,
      conflictSlots,
      score,
      reason,
      hasClassBefore,
      hasClassAfter,
      totalHoursToday,
    };
    
    if (isAvailable) {
      available.push(availability);
    } else {
      unavailable.push(availability);
    }
  });
  
  // Sort available teachers by score (descending)
  available.sort((a, b) => b.score - a.score);
  
  return { available, unavailable };
}

const SUPPLY_ROLE_ID = '661f5728c74b9b0012de6857';
const DEFAULT_EXCEPTIONAL_REASON = 'TEACHER_FOLLOW_CLASS';

interface RequestTeacherListItem {
  id: string;
  status?: string;
  class?: { id: string; name: string };
  classSite?: { _id: string; name: string };
  sessions?: { id: string; startTime: string; endTime: string }[];
}

interface RequestTeacherDetailTeacher {
  teacher: {
    id: string;
    username?: string;
    fullName?: string;
    email?: string;
    phoneNumber?: string;
    imageUrl?: string;
    handleScore?: number;
  };
  role: { id: string; name?: string; shortName?: string };
}

interface RequestTeacherDetailSession {
  id: string;
  startTime: string;
  endTime: string;
  teachers?: RequestTeacherDetailTeacher[];
}

interface RequestTeacherDetail {
  id: string;
  exceptionalReason?: string;
  class: {
    id: string;
    name: string;
    course?: {
      oneSessionSettings?: {
        classRole?: { id: string; name?: string; shortName?: string };
      }[];
      sessionSettings?: {
        settings?: {
          classRole?: { id: string; name?: string; shortName?: string };
        }[];
      }[];
    };
    slots?: {
      _id: string;
      startTime: string;
      endTime: string;
      teachers?: RequestTeacherDetailTeacher[];
    }[];
  };
  classSite?: { _id: string; name: string };
  note?: string;
  sessions: RequestTeacherDetailSession[];
}

interface RequestTeacherPayloadTeacher {
  teacherId: string;
  classRoleId: string;
  teacherName: string;
  teacherHandleScore: number;
  primaryCenters: (string | null)[];
  secondaryCenters?: string[];
}

function toApproveTeacherInput(
  item: RequestTeacherDetailTeacher,
): RequestTeacherPayloadTeacher {
  return {
    teacherId: item.teacher.id,
    classRoleId: item.role.id,
    teacherName: item.teacher.fullName || item.teacher.username || item.teacher.email || item.teacher.id,
    teacherHandleScore: item.teacher.handleScore ?? 7,
    primaryCenters: [null],
  };
}

function resolveClassRoleId(
  detail: RequestTeacherDetail,
  roleShortName: string,
  fallbackRoleId?: string,
): string {
  const roleKey = roleShortName.toUpperCase();
  const roles: Array<{ id: string; name?: string; shortName?: string } | undefined> = [];

  detail.class.course?.oneSessionSettings?.forEach(setting => roles.push(setting.classRole));
  detail.class.course?.sessionSettings?.forEach(sessionSetting => {
    sessionSetting.settings?.forEach(setting => roles.push(setting.classRole));
  });
  detail.sessions?.forEach(session => {
    session.teachers?.forEach(teacher => roles.push(teacher.role));
  });
  detail.class.slots?.forEach(slot => {
    slot.teachers?.forEach(teacher => roles.push(teacher.role));
  });

  const role = roles.find(item =>
    item &&
    ((item.shortName || '').toUpperCase() === roleKey || (item.name || '').toUpperCase() === roleKey)
  );

  if (role?.id) return role.id;
  if (fallbackRoleId) return fallbackRoleId;
  throw new Error(`Không tìm thấy role ${roleShortName} trên LMS cho lớp này`);
}

async function findRequestTeacherForSession(params: {
  classId: string;
  className: string;
  classSiteId?: string;
  sessionId: string;
  centreId?: string;
}): Promise<RequestTeacherListItem> {
  const query = `
    query FindRequestTeacher($filter: FilterRequestTeacherInput, $pagination: PaginationInput, $orderBy: String) {
      findRequestTeacher(payload: {filter: $filter, pagination: $pagination, orderBy: $orderBy}) {
        data {
          id
          status
          class { id name }
          classSite { _id name }
          sessions { id startTime endTime }
        }
        total
      }
    }
  `;

  const response = await lmsQuery<{
    data: { findRequestTeacher: { data: RequestTeacherListItem[]; total: number } };
  }>({
    operationName: 'FindRequestTeacher',
    query,
    variables: {
      filter: {
        search_textSearch: params.className,
        center_in: params.centreId ? [params.centreId] : [],
      },
      pagination: { page: 0, limit: 20 },
      orderBy: 'createdAt_desc',
    },
  });

  const requests = response.data.findRequestTeacher.data || [];
  const request = requests.find(item =>
    item.class?.id === params.classId &&
    (!params.classSiteId || item.classSite?._id === params.classSiteId) &&
    (item.sessions || []).some(session => session.id === params.sessionId),
  ) || requests.find(item =>
    item.class?.id === params.classId &&
    (item.sessions || []).some(session => session.id === params.sessionId),
  );

  if (!request) {
    throw new Error('Không tìm thấy yêu cầu giáo viên trên LMS cho buổi học này');
  }

  return request;
}

async function findOneRequestTeacher(id: string): Promise<RequestTeacherDetail> {
  const query = `
    query FindOneRequestTeacher($payload: FindOneRequestTeacherPayload) {
      findOneRequestTeacher(payload: $payload) {
        id
        exceptionalReason
        class {
          id
          name
          course {
            oneSessionSettings {
              classRole { id name shortName }
            }
            sessionSettings {
              settings {
                classRole { id name shortName }
              }
            }
          }
          slots {
            _id
            startTime
            endTime
            teachers {
              teacher { id username fullName email phoneNumber imageUrl }
              role { id name shortName }
            }
          }
        }
        classSite { _id name }
        note
        sessions {
          id
          startTime
          endTime
          teachers {
            teacher { id username fullName email phoneNumber imageUrl handleScore }
            role { id name shortName }
          }
        }
      }
    }
  `;

  const response = await lmsQuery<{ data: { findOneRequestTeacher: RequestTeacherDetail } }>({
    operationName: 'FindOneRequestTeacher',
    query,
    variables: { payload: { id } },
  });

  if (!response.data.findOneRequestTeacher) {
    throw new Error('Không thể tải chi tiết yêu cầu giáo viên từ LMS');
  }

  return response.data.findOneRequestTeacher;
}

export async function addTeacherToSessionRole(params: {
  classId: string;
  className: string;
  classSiteId?: string;
  centreId?: string;
  sessionId: string;
  sessionStartTime: string;
  sessionEndTime: string;
  teacherId: string;
  teacherName: string;
  roleShortName: string;
  fallbackRoleId?: string;
  teacherHandleScore?: number;
  teacherPrimaryCenters?: (string | null)[];
  exceptionalReason?: string;
  note?: string;
  replaceSameRoleInTargetSession?: boolean;
}): Promise<unknown> {
  const {
    classId,
    className,
    classSiteId,
    centreId,
    sessionId,
    sessionStartTime,
    sessionEndTime,
    teacherId,
    teacherName,
    roleShortName,
    fallbackRoleId,
    teacherHandleScore = 7,
    teacherPrimaryCenters = [null],
    exceptionalReason = DEFAULT_EXCEPTIONAL_REASON,
    note = '',
    replaceSameRoleInTargetSession = false,
  } = params;

  const request = await findRequestTeacherForSession({
    classId,
    className,
    classSiteId,
    sessionId,
    centreId,
  });
  const detail = await findOneRequestTeacher(request.id);
  const classRoleId = resolveClassRoleId(detail, roleShortName, fallbackRoleId);

  const mutation = `
    mutation ApproveRequestTeacher($payload: ApprovePayload!) {
      requestTeacher {
        approve(payload: $payload) {
          id
          status
          class {
            id
            name
            slots {
              _id
              startTime
              endTime
              teachers {
                _id
                teacher {
                  id
                  fullName
                }
                role {
                  id
                  name
                  shortName
                }
                isActive
              }
            }
          }
        }
      }
    }
  `;

  const sourceSessions = detail.sessions?.length
    ? detail.sessions
    : (detail.class.slots || []).map(slot => ({
      id: slot._id,
      startTime: slot.startTime,
      endTime: slot.endTime,
      teachers: slot.teachers || [],
    }));

  const sessions = sourceSessions.map(session => {
    let teachers = (session.teachers || []).map(toApproveTeacherInput);
    const isTargetSession = session.id === sessionId;

    if (isTargetSession && replaceSameRoleInTargetSession) {
      teachers = teachers.filter(teacher => teacher.classRoleId !== classRoleId);
    }

    const alreadyAdded = teachers.some(teacher =>
      teacher.teacherId === teacherId && teacher.classRoleId === classRoleId,
    );

    if (isTargetSession && !alreadyAdded) {
      teachers.push({
        teacherId,
        classRoleId,
        teacherName,
        teacherHandleScore,
        primaryCenters: teacherPrimaryCenters,
      });
    }

    return {
      id: session.id,
      startTime: session.startTime,
      endTime: session.endTime,
      teachers,
    };
  });

  if (!sessions.some(session => session.id === sessionId)) {
    sessions.push({
      id: sessionId,
      startTime: sessionStartTime,
      endTime: sessionEndTime,
      teachers: [{
        teacherId,
        classRoleId,
        teacherName,
        teacherHandleScore,
        primaryCenters: teacherPrimaryCenters,
      }],
    });
  }

  const result = await lmsQuery<{ data: { requestTeacher: { approve: unknown } } }>({
    operationName: 'ApproveRequestTeacher',
    query: mutation,
    variables: {
      payload: {
        id: detail.id,
        classId,
        classSiteId: detail.classSite?._id || classSiteId,
        exceptionalReason: detail.exceptionalReason || exceptionalReason,
        note: detail.note || note,
        sessions,
      },
    },
  });

  return result.data.requestTeacher.approve;
}

export async function addSupplyTeacherToSession(params: Omit<Parameters<typeof addTeacherToSessionRole>[0], 'roleShortName' | 'fallbackRoleId'>): Promise<unknown> {
  return addTeacherToSessionRole({
    ...params,
    roleShortName: 'SUPPLY',
    fallbackRoleId: SUPPLY_ROLE_ID,
  });
}

export async function addJudgeTeacherToSession(params: Omit<Parameters<typeof addTeacherToSessionRole>[0], 'roleShortName' | 'fallbackRoleId'>): Promise<unknown> {
  return addTeacherToSessionRole({
    ...params,
    roleShortName: 'JUDGE',
    replaceSameRoleInTargetSession: true,
  });
}
