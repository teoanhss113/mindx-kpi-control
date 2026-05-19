// ─── Teacher Schedule Types ──────────────────────────────────────────────────

export interface Teacher {
  id: string;
  username: string;
  code: string;
  fullName: string;
  email: string;
  phoneNumber?: string;
  imageUrl?: string;
  mainCentreId?: string | null;
  mainCentreName?: string | null;
  workCentres?: Array<{ id: string; name: string; shortName?: string }>;
  regionIds?: string[];
  regionNames?: string[];
  sameRegionAsRequest?: boolean;
}

export interface TeacherScheduleSlot {
  id: string;
  type: 'class' | 'office-hour';
  teacher?: Teacher;
  sessionTeachers?: Array<{
    teacher: Teacher;
    roleId?: string;
    roleName?: string;
    roleShortName?: string;
  }>;
  startTime: string; // ISO-8601
  endTime: string;   // ISO-8601
  className?: string;
  officeHourType?: string; // raw type from API: Office, Trial, Makeup, Fixed, etc.
  classId?: string;
  classSiteId?: string;
  sessionId?: string;
  roleId?: string;
  roleName?: string;
  roleShortName?: string;
  centreId: string;
  centreName: string;
  centreShortName: string;
  courseLine?: string;
  status: string;
  studentCount?: number;
  sessionHour?: number;
  sessionNumber?: number; // 1-based chronological order within the class
}

export interface TeacherSchedule {
  teacher: Teacher;
  slots: TeacherScheduleSlot[];
}

// ─── Filter & Coordination Types ─────────────────────────────────────────────

export interface ScheduleFilters {
  dateFrom: string;  // YYYY-MM-DD
  dateTo: string;    // YYYY-MM-DD
  centreIds: string[];
  courseLineIds: string[];
  teacherIds: string[];
  viewMode: 'calendar' | 'table-all' | 'table-individual';
}

export interface CoordinationRequest {
  date: string;           // YYYY-MM-DD
  startTime: string;      // HH:mm
  endTime: string;        // HH:mm
  centreId: string;
  courseLineId?: string;
  requiredSkills?: string[];
}

export interface TeacherAvailability {
  teacher: Teacher;
  isAvailable: boolean;
  conflictSlots: TeacherScheduleSlot[];
  score: number; // Optimization score
  reason: string; // Why this teacher is suggested
  distance?: 'same-centre' | 'nearby' | 'far'; // If has other classes
  hasClassBefore?: boolean;
  hasClassAfter?: boolean;
  totalHoursToday?: number;
  category?: string; // Priority category for grouping
  courseLineMatch?: boolean; // Whether teacher has experience with requested course line
  // Additional class information for detailed display
  relatedSlot?: TeacherScheduleSlot; // The closest class slot for detailed info
  isRelatedSlotBefore?: boolean; // Whether the related slot is before the requested time
}

// ─── Calendar View Types ─────────────────────────────────────────────────────

export interface CalendarSlot {
  time: string; // "HH:mm - HH:mm"
  label: string; // e.g., "Sáng", "Chiều", "Tối"
}

export interface CalendarDay {
  date: string; // YYYY-MM-DD
  dayOfWeek: string; // "T2", "T3", etc.
  slots: {
    [slotTime: string]: {
      [centreId: string]: TeacherScheduleSlot[];
    };
  };
}

// ─── API Response Types ──────────────────────────────────────────────────────

export interface GetTeacherSchedulesResponse {
  schedules: TeacherSchedule[];
  dateRange: {
    from: string;
    to: string;
  };
}

export interface GetAvailableTeachersResponse {
  available: TeacherAvailability[];
  unavailable: TeacherAvailability[];
}
