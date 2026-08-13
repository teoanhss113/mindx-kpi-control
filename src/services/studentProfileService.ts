import { lmsQuery } from './lmsClient';
import type { StudentProfile, StudentStudyClass } from '@/types/studentProfile';

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
        teachers {
          isActive
          teacher { id fullName }
          role { name shortName }
        }
        slots {
          date
          startTime
          endTime
          studentAttendance {
            student { id }
            comment
            commentByAreas {
              content
              grade
              type
              courseProcessFinalEvaluationTitle
            }
          }
        }
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

interface RawStudyClass extends Omit<StudentStudyClass, 'mainTeacherName' | 'finalScore'> {
  teachers?: Array<{
    isActive?: boolean | null;
    teacher?: { id?: string; fullName?: string | null } | null;
    role?: { name?: string | null; shortName?: string | null } | null;
  }> | null;
  slots?: Array<{
    date?: string | null;
    startTime?: string | null;
    endTime?: string | null;
    studentAttendance?: Array<{
      student?: { id?: string | null } | null;
      comment?: string | null;
      commentByAreas?: Array<{
        content?: string | null;
        grade?: number | null;
        type?: string | null;
        courseProcessFinalEvaluationTitle?: string | null;
      }> | null;
    }> | null;
  }> | null;
}

interface StudentProfileResponse {
  data?: {
    findOneStudent?: Omit<StudentProfile, 'studyClasses'> & {
      studyClasses?: RawStudyClass[] | null;
    };
  };
}

function getMainTeacherName(studyClass: RawStudyClass): string | null {
  const teachers = (studyClass.teachers || []).filter(item => item.teacher?.fullName);
  const activeTeachers = teachers.filter(item => item.isActive !== false);
  const candidates = activeTeachers.length > 0 ? activeTeachers : teachers;
  const mainTeacher = candidates.find(item => {
    const role = `${item.role?.shortName || ''} ${item.role?.name || ''}`.toUpperCase();
    return /\b(LEC|GVC)\b/.test(role) || role.includes('CHÍNH') || role.includes('CHINH');
  }) || candidates[0];
  return mainTeacher?.teacher?.fullName?.trim() || null;
}

function parseDemoScore(text: string): number | null {
  const cleaned = String(text || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ');
  const match = cleaned.match(/Điểm\s+Demo\s*(?::|-)\s*([0-9]+(?:[.,][0-9]+)?)(?:\s*\/\s*5)?/i);
  if (!match) return null;
  const value = Number.parseFloat(match[1].replace(',', '.'));
  return Number.isFinite(value) ? value : null;
}

function getFinalScore(studyClass: RawStudyClass, studentId: string): number | null {
  const finalSlot = [...(studyClass.slots || [])]
    .filter(slot => slot.date || slot.startTime || slot.endTime)
    .sort((left, right) => {
      const leftTime = new Date(left.startTime || left.date || left.endTime || 0).getTime();
      const rightTime = new Date(right.startTime || right.date || right.endTime || 0).getTime();
      return leftTime - rightTime;
    })
    .at(-1);
  const attendance = finalSlot?.studentAttendance?.find(item => item.student?.id === studentId);
  if (!attendance) return null;

  const contentScore = parseDemoScore([
    attendance.comment,
    ...(attendance.commentByAreas || []).map(item => item.content),
  ].filter(Boolean).join(' '));
  if (contentScore !== null) return contentScore;

  const directDemo = (attendance.commentByAreas || []).find(item => (
    item.type?.toUpperCase() === 'DEMO'
    && typeof item.grade === 'number'
    && Number.isFinite(item.grade)
  ));
  return directDemo?.grade ?? null;
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
    studyClasses: (student.studyClasses ?? []).map(studyClass => ({
      id: studyClass.id,
      name: studyClass.name,
      startDate: studyClass.startDate,
      endDate: studyClass.endDate,
      status: studyClass.status,
      numberOfSessions: studyClass.numberOfSessions,
      course: studyClass.course,
      mainTeacherName: getMainTeacherName(studyClass),
      finalScore: getFinalScore(studyClass, student.id),
    })),
  };
}
