/**
 * lmsClient.ts
 * Central GraphQL client for LMS API.
 * Calls the local proxy `/api/lms`, which verifies the Firebase token
 * server-side before forwarding the request to lms-api.mindx.edu.vn.
 */

import { getValidToken } from './authService';

const LMS_BASE_URL = '/api/lms';

export interface GraphQLRequest {
  query: string;
  variables?: Record<string, unknown>;
  operationName?: string;
}

export async function lmsQuery<T>(request: GraphQLRequest & { signal?: AbortSignal }): Promise<T> {
  const token = await getValidToken();

  const { signal, ...graphqlBody } = request;

  const res = await fetch(LMS_BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(graphqlBody),
    signal,
  });

  if (!res.ok) {
    throw new Error(`LMS API error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();

  if (data.errors?.length) {
    const messages = data.errors.map((e: { message: string }) => e.message).join('; ');
    throw new Error(`GraphQL error: ${messages}`);
  }

  return data as T;
}
