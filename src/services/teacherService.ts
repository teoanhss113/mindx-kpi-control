/**
 * teacherService.ts
 * Service for fetching teacher data from LMS API
 */

import { lmsQuery } from './lmsClient';
import { GetTeachersResponse, GetTeachersVariables, Teacher } from '@/types/teacher';

const GET_TEACHERS_QUERY = /* graphql */ `
  query GetTeachers(
    $search: String
    $isActive: Boolean
    $courseLine: String
    $course: String
    $pageIndex: Int!
    $itemsPerPage: Int!
    $orderBy: String
    $idNotIn: [String]
    $centers: [String]
    $teacherPointFrom: Float
    $teacherPointTo: Float
    $joinedDate: [String]
  ) {
    teachers(
      payload: {
        searchString_wordSearch: $search
        isActive_eq: $isActive
        courseLines_eq: $courseLine
        courses_eq: $course
        id_nin: $idNotIn
        pageIndex: $pageIndex
        itemsPerPage: $itemsPerPage
        orderBy: $orderBy
        centres_in: $centers
        teacherPoint_gte: $teacherPointFrom
        teacherPoint_lte: $teacherPointTo
        joinedDate: $joinedDate
      }
    ) {
      data {
        id
        handleScore
        hourlyRate
        username
        user
        firebaseId
        fullName
        code
        phoneNumber
        email
        personalEmail
        gender
        dob
        imageUrl
        address
        socialMediaLink
        courseLines {
          id
          name
        }
        courses {
          id
          name
          shortName
          courseTopic {
            id
            name
          }
        }
        notes
        imageUrl
        isActive
        createdAt
        createdBy
        lastModifiedAt
        lastModifiedBy
        teacherPoint
        joinedDate
        centres {
          id
          name
        }
      }
      pagination {
        type
        total
      }
    }
  }
`;

/**
 * Fetch teachers from LMS API
 */
export async function getTeachers(
  variables: Partial<GetTeachersVariables> = {},
  signal?: AbortSignal
): Promise<{ data: Teacher[]; total: number }> {
  const defaultVariables: GetTeachersVariables = {
    type: 'OFFSET',
    search: '',
    pageIndex: 0,
    itemsPerPage: 1000, // Load all teachers
    orderBy: 'createdAt_desc',
    centers: [],
    teacherPointRange: [null, null],
    joinedDate: [null, null],
    ...variables,
  };

  const response = await lmsQuery<GetTeachersResponse>({
    query: GET_TEACHERS_QUERY,
    variables: defaultVariables as unknown as Record<string, unknown>,
    operationName: 'GetTeachers',
    signal,
  });

  return {
    data: response.data.teachers.data,
    total: response.data.teachers.pagination.total,
  };
}
