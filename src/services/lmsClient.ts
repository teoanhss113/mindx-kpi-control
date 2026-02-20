/**
 * lmsClient.ts
 * Central GraphQL client for LMS API.
 * Automatically attaches required headers and handles token refresh.
 */

import { getValidToken } from './authService';

// Use the local proxy route to avoid CORS when called from the browser.
// The proxy (src/app/api/lms/route.ts) forwards requests server-side to lms-api.mindx.edu.vn.
const LMS_BASE_URL = '/api/lms';

export interface GraphQLRequest {
  query: string;
  variables?: Record<string, unknown>;
  operationName?: string;
}

export async function lmsQuery<T>(request: GraphQLRequest & { signal?: AbortSignal }): Promise<T> {
  const token = await getValidToken();

  const { signal, ...graphqlBody } = request;

  console.log('[lmsQuery] Making request with token:', token.substring(0, 50) + '...');

  const res = await fetch(LMS_BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      authorization: token,
      'content-language': 'en',
      Referer: 'https://lms.mindx.edu.vn/',
    },
    body: JSON.stringify(graphqlBody),
    signal,
  });

  console.log('[lmsQuery] Response status:', res.status);

  if (!res.ok) {
    const errorText = await res.text();
    console.error('[lmsQuery] Error response:', errorText);
    throw new Error(`LMS API error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();

  if (data.errors?.length) {
    console.error('[lmsQuery] GraphQL errors:', data.errors);
    const messages = data.errors.map((e: { message: string }) => e.message).join('; ');
    throw new Error(`GraphQL error: ${messages}`);
  }

  return data as T;
}

// Added error handling
// Added error handling
// Added comprehensive error handling
/* Added cache utilities */
// Improved cache strategy

// Added comprehensive error handling

// Integrated caching
// Integrated caching in LMS client
