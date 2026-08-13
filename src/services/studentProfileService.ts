import { lmsQuery } from './lmsClient';
import type { StudentProfile } from '@/types/studentProfile';

const GET_STUDENT_PROFILE_QUERY = /* graphql */ `
  query FindOneStudent($studentId: ID!) {
    findOneStudent(payload: { studentId: $studentId }) {
      id
      fullName
      imageUrl
      email
      phoneNumber
      studyClasses {
        id
        name
        startDate
        endDate
        status
        numberOfSessions
        course {
          id
          name
          courseLine {
            id
            name
          }
        }
      }
    }
  }
`;

interface StudentProfileResponse {
  data?: {
    findOneStudent?: Omit<StudentProfile, 'studyClasses'> & {
      studyClasses?: StudentProfile['studyClasses'] | null;
    };
  };
}

export async function fetchStudentProfile(
  studentId: string,
  signal?: AbortSignal,
): Promise<StudentProfile> {
  const response = await lmsQuery<StudentProfileResponse>({
    query: GET_STUDENT_PROFILE_QUERY,
    operationName: 'FindOneStudent',
    variables: { studentId },
    signal,
  });

  const student = response.data?.findOneStudent;
  if (!student) {
    throw new Error('Không tìm thấy thông tin học viên');
  }

  return {
    ...student,
    studyClasses: student.studyClasses ?? [],
  };
}
