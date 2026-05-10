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

export async function getTeachers(
  variables: Partial<GetTeachersVariables> = {},
  signal?: AbortSignal,
  onProgress?: (loaded: number, total: number, chunk: Teacher[]) => void
): Promise<{ data: Teacher[]; total: number }> {
  const ITEMS_PER_PAGE = variables.itemsPerPage || 100;
  
  const baseVariables: GetTeachersVariables = {
    type: 'OFFSET',
    search: '',
    pageIndex: variables.pageIndex || 0,
    itemsPerPage: ITEMS_PER_PAGE,
    orderBy: 'createdAt_desc',
    centers: [],
    teacherPointRange: [null, null],
    joinedDate: [null, null],
    ...variables,
  };

  // Step 1: Fetch initial page to get count
  const response = await lmsQuery<GetTeachersResponse>({
    query: GET_TEACHERS_QUERY,
    variables: baseVariables as unknown as Record<string, unknown>,
    operationName: 'GetTeachers',
    signal,
  });

  const firstPageData = response.data.teachers.data;
  const total = response.data.teachers.pagination.total;
  
  let allTeachers = [...firstPageData];
  
  // Report initial progress
  onProgress?.(allTeachers.length, total, firstPageData);

  // If caller asked for ONE specific page only, return now.
  if (variables.pageIndex !== undefined) {
    return { data: firstPageData, total };
  }

  // Step 2: Parallel fetch remaining pages
  if (total > ITEMS_PER_PAGE) {
    const totalPages = Math.ceil(total / ITEMS_PER_PAGE);
    const remainingPromises: Array<Promise<GetTeachersResponse>> = [];
    let accumulatedLoaded = allTeachers.length;

    for (let i = 1; i < totalPages; i++) {
      const pageVariables = { ...baseVariables, pageIndex: i };
      remainingPromises.push(
        lmsQuery<GetTeachersResponse>({
          query: GET_TEACHERS_QUERY,
          variables: pageVariables as unknown as Record<string, unknown>,
          operationName: 'GetTeachers',
          signal,
        }).then(res => {
          const chunkData = res.data.teachers.data;
          accumulatedLoaded += chunkData.length;
          onProgress?.(accumulatedLoaded, total, chunkData);
          return res;
        })
      );
    }

    // Await all remaining parallel promises concurrently
    const responses = await Promise.all(remainingPromises);
    
    // Combine final set
    for (const res of responses) {
      allTeachers.push(...res.data.teachers.data);
    }
  }

  return {
    data: allTeachers,
    total,
  };
}
