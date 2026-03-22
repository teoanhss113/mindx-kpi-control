/**
 * User Lookup Service
 * Tìm kiếm thông tin user từ LMS API theo email hoặc username
 * Sử dụng users API giống như ticketService
 */

import { lmsQuery } from './lmsClient';

export interface LMSUser {
  id: string;
  email: string;
  username?: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  isActive?: boolean;
  fullName?: string;
}

// GraphQL query để tìm user - giống ticketService
const FIND_USER_QUERY = `
  query getUsers($search: String, $isActive: Boolean, $pageIndex: Int!, $itemsPerPage: Int!, $orderBy: String) {
    users(payload: {
      filter_textSearch: $search,
      isActive_equals: $isActive,
      pageIndex: $pageIndex,
      itemsPerPage: $itemsPerPage,
      orderBy: $orderBy
    }) {
      data {
        id
        username
        email
        displayName
        centres {
          id
          shortName
          name
        }
      }
      pagination {
        total
      }
    }
  }
`;

/**
 * Tìm kiếm user theo email - search theo username nếu không tìm thấy
 */
export async function findUserByEmail(email: string): Promise<LMSUser | null> {
  try {
    if (!email || !email.includes('@')) {
      console.log('[findUserByEmail] Invalid email:', email);
      return null;
    }

    // Extract username from email (part before @)
    const username = email.split('@')[0];
    
    console.log('[findUserByEmail] Searching for email:', email, 'username:', username);
    
    // Try searching by username first (more reliable)
    const response = await lmsQuery<any>({
      query: FIND_USER_QUERY,
      variables: { 
        search: username, // Search by username instead of full email
        isActive: true,
        pageIndex: 0,
        itemsPerPage: 20,
        orderBy: 'createdAt_desc'
      },
      operationName: 'getUsers',
    });

    const users = response.data?.users?.data || [];
    console.log('[findUserByEmail] Found users by username:', users.length, users.map((u: any) => ({ email: u.email, username: u.username, displayName: u.displayName })));
    
    if (users.length === 0) {
      return null;
    }
    
    // Try exact email match first
    let match = users.find((u: any) => u.email?.toLowerCase().trim() === email.toLowerCase().trim());
    
    // If no exact match, try username match
    if (!match) {
      match = users.find((u: any) => u.username?.toLowerCase() === username.toLowerCase());
    }
    
    // If no exact match, try partial email match
    if (!match) {
      match = users.find((u: any) => u.email?.toLowerCase().includes(username.toLowerCase()));
    }
    
    // If still no match, take first result
    if (!match) {
      console.log('[findUserByEmail] No exact match, using first result');
      match = users[0];
    }
    
    console.log('[findUserByEmail] Selected user:', { email: match.email, username: match.username, displayName: match.displayName });
    
    return {
      id: match.id,
      email: match.email,
      username: match.username,
      displayName: match.displayName,
      fullName: match.displayName,
      firstName: match.displayName?.split(' ')[0],
      lastName: match.displayName?.split(' ').slice(1).join(' '),
      isActive: true,
    };
  } catch (error) {
    console.error('[findUserByEmail] Error finding user by email:', error);
    return null;
  }
}

/**
 * Tìm kiếm user theo username - giống ticketService
 */
export async function findUserByUsername(username: string): Promise<LMSUser | null> {
  try {
    if (!username || username.length < 2) {
      return null;
    }

    console.log('[findUserByUsername] Searching for:', username);

    const response = await lmsQuery<any>({
      query: FIND_USER_QUERY,
      variables: { 
        search: username.trim(),
        isActive: true,
        pageIndex: 0,
        itemsPerPage: 20,
        orderBy: 'createdAt_desc'
      },
      operationName: 'getUsers',
    });

    const users = response.data?.users?.data || [];
    console.log('[findUserByUsername] Found users:', users.length);
    
    // Find exact username match
    const exactMatch = users.find((u: any) => u.username?.toLowerCase() === username.toLowerCase());
    
    if (exactMatch) {
      return {
        id: exactMatch.id,
        email: exactMatch.email,
        username: exactMatch.username,
        displayName: exactMatch.displayName,
        fullName: exactMatch.displayName,
        firstName: exactMatch.displayName?.split(' ')[0],
        lastName: exactMatch.displayName?.split(' ').slice(1).join(' '),
        isActive: true,
      };
    }
    
    return null;
  } catch (error) {
    console.error('[findUserByUsername] Error finding user by username:', error);
    return null;
  }
}

/**
 * Tìm kiếm user theo email hoặc username (auto-detect)
 */
export async function findUser(input: string): Promise<LMSUser | null> {
  if (!input || input.length < 2) {
    return null;
  }

  const trimmedInput = input.trim();
  
  // Nếu có @ thì tìm theo email
  if (trimmedInput.includes('@')) {
    return findUserByEmail(trimmedInput);
  }
  
  // Nếu không có @ thì tìm theo username
  return findUserByUsername(trimmedInput);
}

/**
 * Debounced user lookup để tránh gọi API quá nhiều
 */
export function createDebouncedUserLookup(
  onUserFound: (user: LMSUser | null) => void,
  delay: number = 500
) {
  let timeoutId: NodeJS.Timeout;

  return (input: string) => {
    clearTimeout(timeoutId);
    
    if (!input || input.length < 2) {
      onUserFound(null);
      return;
    }

    timeoutId = setTimeout(async () => {
      const user = await findUser(input);
      onUserFound(user);
    }, delay);
  };
}
// Fixed search logic
// Fixed search logic
// Fixed search algorithm

// Optimized search
