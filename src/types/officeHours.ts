// src/types/officeHours.ts

export interface OfficeHourTeacher {
  id: string;
  username: string;
  code: string;
  fullName: string;
  imageUrl?: string;
  email: string;
  phoneNumber?: string;
}

export interface OfficeHourCourse {
  id: string;
  name: string;
  shortName: string;
}

export interface OfficeHourCourseLine {
  id: string;
  name: string;
}

export interface OfficeHourCourseTopic {
  id: string;
  name: string;
}

export interface OfficeHourCentre {
  id: string;
  name: string;
  shortName: string;
}

export interface OfficeHourCreator {
  username: string;
}

export interface OfficeHourLink {
  _id: string;
  title: string;
  link: string;
}

export interface OfficeHourSession {
  id: string;
  startTime: string;
  endTime: string;
}

export interface OfficeHourClass {
  id: string;
  name: string;
  sessions?: OfficeHourSession[];
  students?: number;
}

export interface CandidateDob {
  year: number;
  month: number;
  date: number;
}

export interface Candidate {
  id: string;
  fullName: string;
  email?: string;
  phoneNumber?: string;
  dob?: CandidateDob;
}

export interface EntranceTest {
  submitUrl?: string;
  testFileUrl?: string;
  submittedAt?: number;
  originalFilename?: string;
}

export interface ResultAfterTrial {
  isTrialed?: boolean;
  isHasOrder?: boolean;
  isHasPayment?: boolean;
}

export interface Appointment {
  id: string;
  title: string;
  candidate: Candidate;
  courses?: OfficeHourCourse[];
  status: string;
  note?: string;
  entranceTest?: EntranceTest;
  resultAfterTrial?: ResultAfterTrial;
  createdAt: number;
}

export interface CustomerInfo {
  _id: string;
  fullName: string;
  phoneNumber?: string;
  email?: string;
  facebook?: string;
  zalo?: string;
}

export interface StudentInfo {
  id: string;
  studentId?: string;
  fullName: string;
  status?: string;
  waitingStatus?: string;
  phoneNumber?: string;
  email?: string;
  gender?: string;
  dob?: string;
  address?: string;
  imageUrl?: string;
  facebook?: string;
  zalo?: string;
  school?: string;
  customer?: CustomerInfo;
}

export interface CompletionInfo {
  status?: string;
  note?: string;
  reason?: string;
}

export interface ClassSite {
  _id: string;
  name: string;
}

export interface ClassStudent {
  _id: string;
  student: StudentInfo;
  note?: string;
  activeInClass?: boolean;
  completed?: boolean;
  completionInfo?: CompletionInfo;
  retentionDate?: string;
  classSite?: ClassSite;
  createdBy?: string;
  createdAt?: number;
  lastModifiedAt?: number;
  lastModifiedBy?: string;
}

export interface UplevelTestClass {
  id: string;
  name: string;
  students?: ClassStudent[];
}

export interface UplevelTestStudent {
  id: string;
  centre?: OfficeHourCentre;
  class?: UplevelTestClass;
  student?: {
    id: string;
    fullName: string;
  };
  status?: string;
  note?: string;
  fileUrl?: string;
}

export interface ConfirmAdditionalInfo {
  confirmAdditionalInfoStatus?: string;
  note?: string;
}

export interface OfficeHour {
  id: string;
  courses: OfficeHourCourse[];
  courseLines: OfficeHourCourseLine[];
  courseTopics: OfficeHourCourseTopic[];
  centre: OfficeHourCentre | null;
  teacher?: OfficeHourTeacher | null;
  class?: OfficeHourClass | null;
  classSiteId?: string;
  startTime: string; // ISO-8601 UTC
  endTime: string;   // ISO-8601 UTC
  status: string;    // "PENDING", "APPROVED", "REJECTED", "ABANDONED"
  type: string;      // "Office" (offline tại cơ sở) or "Trial" (online trực tuyến)
  studentCount: number;
  note?: string;
  managerNote?: string;
  links?: OfficeHourLink[];
  custom?: string; // JSON string containing additional data like teacherNote
  createdBy?: OfficeHourCreator;
  createdAt: number; // Timestamp
  lastModifiedBy?: OfficeHourCreator;
  lastModifiedAt?: number; // Timestamp
  appointments?: Appointment[];
  uplevelTestStudents?: UplevelTestStudent[];
  confirmAdditionalInfo?: ConfirmAdditionalInfo;
}

export interface OfficeHoursPagination {
  type: string;
  total: number;
}

export interface GetOfficeHoursResponse {
  data: {
    officeHours: {
      data: OfficeHour[];
      pagination: OfficeHoursPagination;
    };
  };
}

// Status constants
export const OFFICE_HOUR_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  ABANDONED: 'ABANDONED',
} as const;

// Type constants
// Office = Ca trực tại cơ sở (offline)
// Trial = Ca trực trực tuyến (online)
// Event = Sự kiện
// Makeup = Bù học
// Tutor = Dạy kèm
export const OFFICE_HOUR_TYPE = {
  OFFICE: 'Office',   // Ca trực tại cơ sở (offline)
  TRIAL: 'Trial',     // Ca trực trực tuyến (online)
  EVENT: 'Event',     // Sự kiện
  MAKEUP: 'Makeup',   // Bù học
  TUTOR: 'Tutor',     // Dạy kèm
} as const;
