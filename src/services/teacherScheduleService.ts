/**
 * teacherScheduleService.ts
 * Service for fetching and analyzing teacher schedules
 * Combines data from classes and office hours
 */

import { fetchAllClasses, haveSlotInToUtcRange } from './classesService';
import { fetchOfficeHours } from './officeHoursService';
import { searchUsers } from './ticketService';
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
  
  cls.slots.forEach(slot => {
    slot.teachers.forEach(teacherSlot => {
      if (teacherSlot.isActive) {
        slots.push({
          id: `class-${cls.id}-${slot._id}-${teacherSlot.teacher.id}`,
          type: 'class',
          startTime: slot.startTime,
          endTime: slot.endTime,
          className: cls.name,
          classId: cls.id,
          centreId: cls.centre.id,
          centreName: cls.centre.name,
          centreShortName: cls.centre.shortName,
          courseLine: cls.course.courseLine?.name,
          status: cls.status,
          studentCount: cls.students.filter(s => s.activeInClass).length,
          sessionHour: slot.sessionHour,
        });
      }
    });
  });
  
  return slots;
}

/**
 * Convert OfficeHour to TeacherScheduleSlot format
 * Office Hours include both:
 * - Office type: Ca trực tại cơ sở (offline)
 * - Trial type: Ca trực trực tuyến (online)
 */
function officeHourToScheduleSlot(oh: OfficeHour): TeacherScheduleSlot | null {
  if (!oh.teacher || !oh.centre) return null;
  
  return {
    id: `office-hour-${oh.id}`,
    type: 'office-hour',
    startTime: oh.startTime,
    endTime: oh.endTime,
    className: oh.type === 'Trial' ? 'Ca trực trực tuyến' : 'Ca trực tại cơ sở',
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
  let reasons: string[] = [];
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
  signal?: AbortSignal
): Promise<TeacherSchedule[]> {
  // Fetch classes with slots in the date range
  const haveSlotIn = haveSlotInToUtcRange(dateFrom, dateTo);
  
  const classes = await fetchAllClasses(
    {
      haveSlotIn: { from: haveSlotIn.from, to: haveSlotIn.to },
      ...(centreIds && centreIds.length > 0 ? { centres: centreIds } : {}),
    },
    onProgress,
    signal
  );
  
  // Fetch office hours in the date range
  const officeHours = await fetchOfficeHours(
    {
      timeFrom: haveSlotIn.from,
      timeTo: haveSlotIn.to,
      ...(centreIds && centreIds.length > 0 ? { centreIn: centreIds } : {}),
    },
    undefined,
    signal
  );
  
  // Build teacher schedule map
  const teacherMap = new Map<string, TeacherSchedule>();
  
  // Process classes
  classes.forEach(cls => {
    const slots = classToScheduleSlots(cls);
    
    slots.forEach(slot => {
      // Filter slots to only include those within the requested date range
      const slotTime = new Date(slot.startTime).getTime();
      if (slotTime < dateFrom.getTime() || slotTime > dateTo.getTime()) return;

      // Find teacher from class.teachers
      const teacherSlot = cls.slots
        .flatMap(s => s.teachers)
        .find(t => {
          const slotStartTime = slot.startTime;
          const sessionSlot = cls.slots.find(ss => ss.startTime === slotStartTime);
          return sessionSlot?.teachers.some(st => st.teacher.id === t.teacher.id);
        });
      
      if (!teacherSlot) return;
      
      const teacherId = teacherSlot.teacher.id;
      
      if (!teacherMap.has(teacherId)) {
        teacherMap.set(teacherId, {
          teacher: {
            id: teacherSlot.teacher.id,
            username: teacherSlot.teacher.username,
            code: teacherSlot.teacher.code,
            fullName: teacherSlot.teacher.fullName,
            email: teacherSlot.teacher.email,
            phoneNumber: teacherSlot.teacher.phoneNumber,
            imageUrl: teacherSlot.teacher.imageUrl,
          },
          slots: [],
        });
      }
      
      teacherMap.get(teacherId)!.slots.push(slot);
    });
  });
  
  // Process office hours
  officeHours.data.forEach(oh => {
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
  
  return schedules;
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
  
  const schedules = await fetchTeacherSchedules(
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

/**
 * Add a supply teacher to a class session
 * Based on the ApproveRequestTeacher mutation
 */
export async function addSupplyTeacherToSession(params: {
  classId: string;
  classSiteId: string;
  sessionId: string;
  sessionStartTime: string;
  sessionEndTime: string;
  teacherId: string;
  teacherName: string;
  teacherHandleScore?: number;
  teacherPrimaryCenters?: (string | null)[];
  exceptionalReason?: string;
  note?: string;
}): Promise<any> {
  const {
    classId,
    classSiteId,
    sessionId,
    sessionStartTime,
    sessionEndTime,
    teacherId,
    teacherName,
    teacherHandleScore = 10,
    teacherPrimaryCenters = [null],
    exceptionalReason = 'TEACHER_FOLLOW_CLASS',
    note = '',
  } = params;

  // SUPPLY role ID from the example
  const SUPPLY_ROLE_ID = '661f5728c74b9b0012de6857';

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

  const variables = {
    payload: {
      id: `temp-${Date.now()}`, // Temporary ID, will be replaced by backend
      classId,
      classSiteId,
      exceptionalReason,
      note,
      sessions: [
        {
          id: sessionId,
          startTime: sessionStartTime,
          endTime: sessionEndTime,
          teachers: [
            {
              teacherId,
              classRoleId: SUPPLY_ROLE_ID,
              teacherName,
              teacherHandleScore,
              primaryCenters: teacherPrimaryCenters,
            },
          ],
        },
      ],
    },
  };

  const response = await fetch('https://lms-api.mindx.edu.vn/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': '*/*',
    },
    credentials: 'include',
    body: JSON.stringify({
      operationName: 'ApproveRequestTeacher',
      variables,
      query: mutation,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to add supply teacher: ${response.statusText}`);
  }

  const result = await response.json();

  if (result.errors) {
    throw new Error(result.errors[0]?.message || 'Failed to add supply teacher');
  }

  return result.data.requestTeacher.approve;
}
