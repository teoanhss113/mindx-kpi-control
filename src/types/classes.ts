// ─── GetClasses API Types ────────────────────────────────────────────────────

export interface ClassesResponse {
  data: {
    classes: {
      data: Class[];
      pagination: {
        type: string;
        total: number;
      };
    };
  };
}

export interface Class {
  id: string;
  name: string;
  level: string;
  status: string;
  startDate: string;        // ISO-8601 UTC
  endDate: string;          // ISO-8601 UTC
  numberOfSessions: number;
  numberOfSessionsStatus: number;
  sessionHour: number;
  totalHour: number;
  openingRoomNo?: string;
  hasSchedule?: boolean;
  createdAt?: string;
  lastModifiedAt?: string;
  course: { id: string; name: string; shortName: string; courseLine?: { id: string; name: string } };
  centre: { id: string; name: string; shortName: string };
  classSites?: { _id: string; name: string }[];
  operationMethod?: { id: string; name: string };
  operator?: { id: string; username: string; firstName: string; middleName: string; lastName: string };
  teachers: TeacherSlot[];
  students: StudentSlot[];
  slots: Session[];
}

export interface TeacherSlot {
  _id: string;
  isActive: boolean;
  teacher: {
    id: string;
    username: string;
    code: string;
    fullName: string;
    email: string;
    phoneNumber: string;
    imageUrl: string;
  };
  role: { id: string; name: string; shortName: string };
}

export interface StudentSlot {
  _id: string;
  activeInClass: boolean;
  createdAt: string;
  note: string;
  student: {
    id: string;
    fullName: string;
    customer: {
      fullName: string;
      phoneNumber: string;
      email: string;
      facebook: string;
      zalo: string;
    };
  };
  completionInfo?: {
    status: string;
    note: string;
    reason: string;
  };
}

export interface StudentAttendance {
  _id: string;
  status: string;
  comment: string;
  commentByAreas?: {
    content: string;
  }[];
  sendCommentStatus: string;
  student: {
    id: string;
    fullName: string;
    phoneNumber: string;
    email: string;
    gender: string;
    imageUrl: string;
  };
}

export interface TeacherAttendance {
  _id: string;
  status: string;
  note: string;
  createdAt: string;
  lastModifiedAt: string;
  teacher: { id: string; fullName: string; email: string };
}

export interface Session {
  _id: string;
  date: string;
  startTime: string;
  endTime: string;
  sessionHour: number;
  summary: string;    // HTML string
  homework: string;
  teachers: TeacherSlot[];
  teacherAttendance: TeacherAttendance[];
  studentAttendance: StudentAttendance[];
}

// ─── GetClasses Query Variables ─────────────────────────────────────────────

export interface GetClassesVariables {
  search?: string;
  centres?: string[];
  courses?: string[];
  courseLines?: string[];
  startDate?: [string | null, string | null];
  endDateFrom?: string;
  endDateTo?: string;
  pageIndex: number;
  itemsPerPage: number;
  orderBy?: string;
  type?: string;
  teacherSlot?: string[];
  passedSessionIndex?: number | null;
  unpassedSessionIndex?: number | null;
  haveSlotIn?: Record<string, unknown>;
  comments?: { criteria: unknown[] };
  statusIn?: string[];
}
