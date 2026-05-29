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
  variables: Partial<GetTeachersVariables> & { maxItems?: number } = {},
  signal?: AbortSignal,
  onProgress?: (loaded: number, total: number, chunk: Teacher[]) => void
): Promise<{ data: Teacher[]; total: number }> {
  const { maxItems, ...requestVariables } = variables;
  const ITEMS_PER_PAGE = requestVariables.itemsPerPage || 100;
  
  const baseVariables: GetTeachersVariables = {
    type: 'OFFSET',
    search: '',
    pageIndex: requestVariables.pageIndex || 0,
    itemsPerPage: ITEMS_PER_PAGE,
    orderBy: 'createdAt_desc',
    centers: [],
    teacherPointRange: [null, null],
    joinedDate: [null, null],
    ...requestVariables,
  };

  // Step 1: Fetch initial page to get count
  const response = await lmsQuery<GetTeachersResponse>({
    query: GET_TEACHERS_QUERY,
    variables: baseVariables as unknown as Record<string, unknown>,
    operationName: 'GetTeachers',
    signal,
  });

  const total = response.data.teachers.pagination.total;
  const targetTotal = maxItems ? Math.min(total, maxItems) : total;
  const firstPageData = response.data.teachers.data.slice(0, targetTotal);
  
  const allTeachers = [...firstPageData];
  
  // Report initial progress
  onProgress?.(allTeachers.length, targetTotal, firstPageData);

  // If caller asked for ONE specific page only, return now.
  if (requestVariables.pageIndex !== undefined) {
    return { data: firstPageData, total };
  }

  // Step 2: Parallel fetch remaining pages
  if (targetTotal > ITEMS_PER_PAGE) {
    const totalPages = Math.ceil(targetTotal / ITEMS_PER_PAGE);
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
          const remainingSlots = Math.max(targetTotal - accumulatedLoaded, 0);
          const chunkData = res.data.teachers.data.slice(0, remainingSlots);
          accumulatedLoaded += chunkData.length;
          onProgress?.(accumulatedLoaded, targetTotal, chunkData);
          return res;
        })
      );
    }

    // Await all remaining parallel promises concurrently
    const responses = await Promise.all(remainingPromises);
    
    // Combine final set
    for (const res of responses) {
      const remainingSlots = Math.max(targetTotal - allTeachers.length, 0);
      if (remainingSlots <= 0) break;
      allTeachers.push(...res.data.teachers.data.slice(0, remainingSlots));
    }
  }

  return {
    data: allTeachers,
    total,
  };
}
