/**
 * Teacher Types
 * Based on LMS API GetTeachers query response
 */

export interface CourseLine {
  id: string;
  name: string;
}

export interface Course {
  id: string;
  name: string;
  shortName: string;
  courseTopic: {
    id: string;
    name: string;
  };
}

export interface Centre {
  id: string;
  name: string;
}

export interface Teacher {
  id: string;
  handleScore: number | null;
  hourlyRate: number | null;
  username: string;
  user: string;
  firebaseId: string;
  fullName: string;
  code: string;
  phoneNumber: string;
  email: string;
  personalEmail: string | null;
  gender: 'MALE' | 'FEMALE' | null;
  dob: string;
  imageUrl: string | null;
  address: string;
  socialMediaLink: string | null;
  courseLines: CourseLine[];
  courses: Course[];
  notes: string;
  isActive: boolean;
  createdAt: string;
  createdBy: string;
  lastModifiedAt: string;
  lastModifiedBy: string | null;
  teacherPoint: number;
  joinedDate: string;
  centres: Centre[];
}

export interface TeacherPagination {
  type: string | null;
  total: number;
}

export interface GetTeachersResponse {
  data: {
    teachers: {
      data: Teacher[];
      pagination: TeacherPagination;
    };
  };
}

export interface GetTeachersVariables {
  type?: string;
  search?: string;
  pageIndex: number;
  itemsPerPage: number;
  orderBy?: string;
  centers?: string[];
  teacherPointRange?: [number | null, number | null];
  joinedDate?: [string | null, string | null];
  isActive?: boolean;
  courseLine?: string;
  course?: string;
}
