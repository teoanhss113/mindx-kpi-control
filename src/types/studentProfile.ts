export interface StudentStudyClass {
  id: string;
  name: string;
  startDate?: string | null;
  endDate?: string | null;
  status?: string | null;
  numberOfSessions?: number | null;
  mainTeacherName?: string | null;
  finalScore?: number | null;
  course?: {
    id: string;
    name: string;
    courseLine?: {
      id: string;
      name: string;
    } | null;
  } | null;
}

export interface StudentProfile {
  id: string;
  fullName: string;
  imageUrl?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  studyClasses: StudentStudyClass[];
}
