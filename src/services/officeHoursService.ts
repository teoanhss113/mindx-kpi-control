import { lmsQuery } from './lmsClient';
import { OfficeHour, GetOfficeHoursResponse, OfficeHoursPagination } from '../types/officeHours';

export interface Teacher {
  id: string;
  username: string;
  fullName: string;
  code: string;
  email: string;
  phoneNumber?: string;
  isActive: boolean;
  centres?: { id: string; name: string }[];
}

export interface FetchOfficeHoursParams {
  pageIndex?: number;
  itemsPerPage?: number;
  centreIn?: string[];
  courseIn?: string[];
  courseLineIn?: string[];
  courseTopicIn?: string[];
  timeFrom?: string; // ISO-8601 UTC
  timeTo?: string;   // ISO-8601 UTC
  statusIn?: string[];
  typeIn?: string[];
  searchString?: string;
  teacher?: string; // Filter by teacher ID
  id_in?: string[]; // Filter by office hour IDs
}

export interface UpdateOfficeHourParams {
  id: string;
  teacher?: string; // Teacher ID
  teacherNote?: string; // Note from teacher
  // Required fields that need to be preserved
  studentCount?: number;
  centre?: string; // Centre ID
  startTime?: string; // ISO string
  endTime?: string; // ISO string
  type?: string; // Office hour type
  // Note: status is not accepted by UpdateOfficeHourCommand
}

export async function approveOfficeHour(id: string): Promise<OfficeHour> {
  const query = `
    mutation ApproveOfficeHour($payload: ChangeOfficeHourStatusCommand!) {
      officeHours {
        approve(payload: $payload) {
          id
          courses {
            id
            name
            shortName
          }
          courseLines {
            id
            name
          }
          courseTopics {
            id
            name
          }
          startTime
          endTime
          status
          centre {
            id
            name
            shortName
          }
          teacher {
            id
            username
            code
            fullName
            imageUrl
            email
            phoneNumber
          }
          class {
            id
            name
            sessions {
              id
              startTime
              endTime
            }
            students
          }
          classSiteId
          note
          managerNote
          type
          links {
            _id
            title
            link
          }
          studentCount
          custom
          createdBy {
            username
          }
          createdAt
          lastModifiedBy {
            username
          }
          lastModifiedAt
          appointments {
            id
            title
            candidate {
              id
              fullName
              email
              phoneNumber
              dob {
                year
                month
                date
              }
            }
            courses {
              id
              name
              shortName
            }
            status
            note
            entranceTest {
              submitUrl
              testFileUrl
              submittedAt
              originalFilename
            }
            resultAfterTrial {
              isTrialed
              isHasOrder
              isHasPayment
            }
            createdAt
          }
          uplevelTestStudents {
            id
            centre {
              id
              name
            }
            class {
              id
              name
              students {
                _id
                student {
                  id
                  studentId
                  fullName
                  status
                  waitingStatus
                  phoneNumber
                  email
                  gender
                  dob
                  address
                  imageUrl
                  facebook
                  zalo
                  school
                  customer {
                    _id
                    fullName
                    phoneNumber
                    email
                    facebook
                    zalo
                  }
                }
                note
                activeInClass
                completed
                completionInfo {
                  status
                  note
                  reason
                }
                retentionDate
                classSite {
                  _id
                  name
                }
                createdBy
                createdAt
                lastModifiedAt
                lastModifiedBy
              }
            }
            student {
              id
              fullName
            }
            status
            note
            fileUrl
          }
          confirmAdditionalInfo {
            confirmAdditionalInfoStatus
            note
          }
        }
      }
    }
  `;

  const variables = { payload: { id } };
  
  try {
    const result = await lmsQuery<{ data: { officeHours: { approve: OfficeHour } } }>({ query, variables });
    
    if (!result.data?.officeHours?.approve) {
      throw new Error('API không trả về dữ liệu phê duyệt');
    }
    
    return result.data.officeHours.approve;
  } catch (error: any) {
    if (error.response?.errors?.length > 0) {
      const graphqlError = error.response.errors[0];
      const enhancedError = new Error(graphqlError.message);
      (enhancedError as any).response = error.response;
      throw enhancedError;
    }
    
    throw error;
  }
}

export async function updateOfficeHour(params: UpdateOfficeHourParams): Promise<OfficeHour> {
  const query = `
    mutation UpdateOfficeHour($payload: UpdateOfficeHourCommand!) {
      officeHours {
        update(payload: $payload) {
          id
          courses {
            id
            name
            shortName
          }
          courseLines {
            id
            name
          }
          courseTopics {
            id
            name
          }
          startTime
          endTime
          status
          centre {
            id
            name
            shortName
          }
          teacher {
            id
            username
            code
            fullName
            imageUrl
            email
            phoneNumber
          }
          class {
            id
            name
            sessions {
              id
              startTime
              endTime
            }
            students
          }
          classSiteId
          note
          managerNote
          type
          links {
            _id
            title
            link
          }
          studentCount
          custom
          createdBy {
            username
          }
          createdAt
          lastModifiedBy {
            username
          }
          lastModifiedAt
          appointments {
            id
            title
            candidate {
              id
              fullName
              email
              phoneNumber
              dob {
                year
                month
                date
              }
            }
            courses {
              id
              name
              shortName
            }
            status
            note
            entranceTest {
              submitUrl
              testFileUrl
              submittedAt
              originalFilename
            }
            resultAfterTrial {
              isTrialed
              isHasOrder
              isHasPayment
            }
            createdAt
          }
          uplevelTestStudents {
            id
            centre {
              id
              name
            }
            class {
              id
              name
              students {
                _id
                student {
                  id
                  studentId
                  fullName
                  status
                  waitingStatus
                  phoneNumber
                  email
                  gender
                  dob
                  address
                  imageUrl
                  facebook
                  zalo
                  school
                  customer {
                    _id
                    fullName
                    phoneNumber
                    email
                    facebook
                    zalo
                  }
                }
                note
                activeInClass
                completed
                completionInfo {
                  status
                  note
                  reason
                }
                retentionDate
                classSite {
                  _id
                  name
                }
                createdBy
                createdAt
                lastModifiedAt
                lastModifiedBy
              }
            }
            student {
              id
              fullName
            }
            status
            note
            fileUrl
          }
          confirmAdditionalInfo {
            confirmAdditionalInfoStatus
            note
          }
        }
      }
    }
  `;

  // Build the payload based on the current office hour data + updates
  const payload: any = {
    id: params.id,
  };

  // Add teacher if provided
  if (params.teacher !== undefined) {
    payload.teacher = params.teacher;
  }

  // Add teacher note if provided (stored in custom field as JSON)
  if (params.teacherNote !== undefined) {
    payload.custom = JSON.stringify({ teacherNote: params.teacherNote });
  }

  // Add studentCount if provided (required by API)
  if (params.studentCount !== undefined) {
    payload.studentCount = params.studentCount;
  }

  // Add centre if provided (required by API)
  if (params.centre !== undefined) {
    payload.centre = params.centre;
  }

  // Add other potentially required fields
  if (params.startTime !== undefined) {
    payload.startTime = params.startTime;
  }
  
  if (params.endTime !== undefined) {
    payload.endTime = params.endTime;
  }
  
  if (params.type !== undefined) {
    payload.type = params.type;
  }
  
  // Note: status is not accepted by UpdateOfficeHourCommand, so we don't include it

  const variables = { payload };
  
  try {
    const result = await lmsQuery<{ data: { officeHours: { update: OfficeHour } } }>({ query, variables });
    
    // Check if the update was successful
    if (!result.data?.officeHours?.update) {
      throw new Error('API không trả về dữ liệu cập nhật');
    }
    
    return result.data.officeHours.update;
  } catch (error: any) {
    // Re-throw with preserved original message for better user information
    if (error.response?.errors?.length > 0) {
      // GraphQL errors - preserve the original message (contains useful info like conflicts)
      const graphqlError = error.response.errors[0];
      const enhancedError = new Error(graphqlError.message); // Keep original message
      (enhancedError as any).response = error.response;
      throw enhancedError;
    }
    
    // Network or other errors - preserve original message
    throw error;
  }
}

export interface FetchOfficeHoursParams {
  pageIndex?: number;
  itemsPerPage?: number;
  centreIn?: string[];
  courseIn?: string[];
  courseLineIn?: string[];
  courseTopicIn?: string[];
  timeFrom?: string; // ISO-8601 UTC
  timeTo?: string;   // ISO-8601 UTC
  statusIn?: string[];
  typeIn?: string[];
  searchString?: string;
}

export async function fetchOfficeHours(
  params: FetchOfficeHoursParams,
  onProgress?: (loaded: number, total: number, chunk: OfficeHour[]) => void,
  abortSignal?: AbortSignal
): Promise<{ data: OfficeHour[]; pagination: OfficeHoursPagination }> {
  const query = `
    query GetOfficeHours($payload: OfficeHourQuery) {
      officeHours(payload: $payload) {
        data {
          id
          courses {
            id
            name
            shortName
          }
          courseLines {
            id
            name
          }
          courseTopics {
            id
            name
          }
          startTime
          endTime
          status
          centre {
            id
            name
            shortName
          }
          teacher {
            id
            username
            code
            fullName
            imageUrl
            email
            phoneNumber
          }
          class {
            id
            name
            sessions {
              id
              startTime
              endTime
            }
            students
          }
          classSiteId
          note
          managerNote
          type
          links {
            _id
            title
            link
          }
          studentCount
          custom
          createdBy {
            username
          }
          createdAt
          lastModifiedBy {
            username
          }
          lastModifiedAt
          appointments {
            id
            title
            candidate {
              id
              fullName
              email
              phoneNumber
              dob {
                year
                month
                date
              }
            }
            courses {
              id
              name
              shortName
            }
            status
            note
            entranceTest {
              submitUrl
              testFileUrl
              submittedAt
              originalFilename
            }
            resultAfterTrial {
              isTrialed
              isHasOrder
              isHasPayment
            }
            createdAt
          }
          uplevelTestStudents {
            id
            centre {
              id
              name
            }
            class {
              id
              name
              students {
                _id
                student {
                  id
                  studentId
                  fullName
                  status
                  waitingStatus
                  phoneNumber
                  email
                  gender
                  dob
                  address
                  imageUrl
                  facebook
                  zalo
                  school
                  customer {
                    _id
                    fullName
                    phoneNumber
                    email
                    facebook
                    zalo
                  }
                }
                note
                activeInClass
                completed
                completionInfo {
                  status
                  note
                  reason
                }
                retentionDate
                classSite {
                  _id
                  name
                }
                createdBy
                createdAt
                lastModifiedAt
                lastModifiedBy
              }
            }
            student {
              id
              fullName
            }
            status
            note
            fileUrl
          }
          confirmAdditionalInfo {
            confirmAdditionalInfoStatus
            note
          }
        }
        pagination {
          type
          total
        }
      }
    }
  `;

  const PAGE_SIZE = 100; // Increased from 50 for better performance
  let allOfficeHours: OfficeHour[] = [];
  let pageIndex = params.pageIndex || 0;
  let total = 0;
  let hasMore = true;

  while (hasMore) {
    if (abortSignal?.aborted) {
      break;
    }

    const variables = {
      payload: {
        pageIndex,
        itemsPerPage: params.itemsPerPage || PAGE_SIZE,
        orderBy: 'createdAt_desc',
        centreIn: params.centreIn || [],
        courseIn: params.courseIn || [],
        courseLineIn: params.courseLineIn || [],
        courseTopicIn: params.courseTopicIn || [],
        timeFrom: params.timeFrom || '',
        timeTo: params.timeTo || '',
        paginationType: 'OFFSET',
        searchString_wordSearch: params.searchString || '',
        ...(params.teacher && { teacher: params.teacher }),
        ...(params.id_in && { id_in: params.id_in }),
      }
    };

    const result = await lmsQuery<GetOfficeHoursResponse>({ query, variables });
    const { data, pagination } = result.data.officeHours;
    
    if (pageIndex === 0) {
      total = pagination.total;
    }

    allOfficeHours = [...allOfficeHours, ...data];
    if (onProgress) {
      onProgress(allOfficeHours.length, total, data);
    }

    // Stop if we asked for a specific page, OR if we fetched everything
    if (params.itemsPerPage !== undefined) {
      return { data: allOfficeHours, pagination };
    }

    if (allOfficeHours.length >= total || data.length < PAGE_SIZE) {
      hasMore = false;
    } else {
      pageIndex++;
    }
  }

  return { data: allOfficeHours, pagination: { type: 'OFFSET', total } };
}
// ─── Load All Teachers (Comprehensive Search Strategy) ────────────────────────
export async function loadAllTeachers(): Promise<Teacher[]> {
  const allTeachers = new Map<string, Teacher>(); // Use Map to avoid duplicates
  
  try {
    console.log('Strategy 1: Loading with empty search...');
    // First try empty search
    const emptyResult = await searchTeachers('', 0, 500);
    emptyResult.data.forEach(teacher => allTeachers.set(teacher.id, teacher));
    console.log('Empty search loaded:', emptyResult.data.length, 'of', emptyResult.total);
    
    // Strategy 2: Load with common Vietnamese names and letters
    console.log('Strategy 2: Loading with common search terms...');
    const commonTerms = [
      // Common Vietnamese surnames
      'Nguyen', 'Tran', 'Le', 'Pham', 'Hoang', 'Phan', 'Vu', 'Vo', 'Dang', 'Bui',
      'Do', 'Ho', 'Ngo', 'Duong', 'Ly', 'Mai', 'Trinh', 'Lam', 'Cao', 'Dinh',
      // Single letters (like the example "Phan " search)
      'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 
      'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
      // Common first names
      'Anh', 'Minh', 'Duc', 'Huy', 'Quan', 'Tuan', 'Duy', 'Khang', 'Long', 'Nam',
      'Linh', 'Huong', 'Lan', 'Mai', 'Nga', 'Oanh', 'Thao', 'Trang', 'Yen', 'Ha'
    ];
    
    let processedTerms = 0;
    for (const term of commonTerms) {
      try {
        const searchResult = await searchTeachers(term, 0, 100);
        const newTeachers = searchResult.data.filter(t => !allTeachers.has(t.id));
        newTeachers.forEach(teacher => allTeachers.set(teacher.id, teacher));
        
        console.log(`Search "${term}": ${searchResult.data.length} found, ${newTeachers.length} new, total unique: ${allTeachers.size}`);
        
        processedTerms++;
        // Small delay to avoid overwhelming API
        if (processedTerms % 5 === 0) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        // Stop if we've found a good amount
        if (allTeachers.size > 1500) {
          console.log('Reached 1500+ teachers, stopping search');
          break;
        }
      } catch (error) {
        console.error(`Error searching with term "${term}":`, error);
      }
    }
    
    console.log('Final unique teachers loaded:', allTeachers.size);
    return Array.from(allTeachers.values());
    
  } catch (error) {
    console.error('Error in loadAllTeachers:', error);
    // Fallback to simple search
    const fallback = await searchTeachers('', 0, 500);
    return fallback.data;
  }
}
export async function searchAllTeachers(search: string = ''): Promise<Teacher[]> {
  const PAGE_SIZE = 100; // Use smaller page size like original system
  let allTeachers: Teacher[] = [];
  let pageIndex = 0;
  let hasMore = true;

  while (hasMore) {
    try {
      const result = await searchTeachers(search, pageIndex, PAGE_SIZE);
      allTeachers = [...allTeachers, ...result.data];
      
      // Stop if we got less than PAGE_SIZE (last page) or if we've loaded everything
      if (result.data.length < PAGE_SIZE || allTeachers.length >= result.total) {
        hasMore = false;
      } else {
        pageIndex++;
      }
      
      // Safety break to avoid infinite loop
      if (pageIndex > 50) { // Max 5000 teachers
        console.warn('Reached maximum page limit for teacher search');
        hasMore = false;
      }
    } catch (error) {
      console.error('Error loading teachers page', pageIndex, error);
      hasMore = false;
    }
  }

  return allTeachers;
}

// ─── Search Teachers (with better parameters) ─────────────────────────────────
export async function searchTeachers(
  search: string = '', 
  pageIndex = 0, 
  itemsPerPage = 100
): Promise<{ data: Teacher[]; total: number }> {
  const query = `
    query GetTeachers($search: String, $isActive: Boolean, $courseLine: String, $course: String, $pageIndex: Int!, $itemsPerPage: Int!, $orderBy: String, $idNotIn: [String], $centers: [String], $teacherPointFrom: Float, $teacherPointTo: Float, $joinedDate: [String]) {
      teachers(payload: {
        searchString_wordSearch: $search,
        isActive_eq: $isActive,
        courseLines_eq: $courseLine,
        courses_eq: $course,
        id_nin: $idNotIn,
        pageIndex: $pageIndex,
        itemsPerPage: $itemsPerPage,
        orderBy: $orderBy,
        centres_in: $centers,
        teacherPoint_gte: $teacherPointFrom,
        teacherPoint_lte: $teacherPointTo,
        joinedDate: $joinedDate
      }) {
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
  
  const result = await lmsQuery<any>({
    query,
    variables: { 
      search: search || '', // Always provide search term, even if empty
      isActive: true, // Keep active filter like original system
      courseLine: null,
      course: null,
      idNotIn: [],
      pageIndex, 
      itemsPerPage, 
      orderBy: 'createdAt_desc',
      centers: null,
      teacherPointFrom: null,
      teacherPointTo: null,
      joinedDate: null
    },
    operationName: 'GetTeachers',
  });
  
  return {
    data: result.data.teachers.data as Teacher[],
    total: result.data.teachers.pagination.total,
  };
}
// Fixed data fetching
// Fixed data fetching
// Fixed data fetching

// Fixed data fetching
