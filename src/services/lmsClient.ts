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

export async function lmsQuery<T>(request: GraphQLRequest & { signal?: AbortSignal; allowPartialErrors?: boolean }): Promise<T> {
  const token = await getValidToken();

  const { signal, allowPartialErrors, ...graphqlBody } = request;

  const res = await fetch(LMS_BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(graphqlBody),
    signal,
  });

  const responseText = await res.text();
  let data: { errors?: Array<{ message?: string }>; error?: string; [key: string]: unknown };
  try {
    data = responseText ? JSON.parse(responseText) as typeof data : {};
  } catch {
    data = {};
  }

  if (!res.ok) {
    const details = data?.errors?.map((error: { message?: string }) => error.message).filter(Boolean).join('; ')
      || data?.error;
    throw new Error(`LMS API error: ${res.status} ${res.statusText}${details ? ` — ${details}` : ''}`);
  }

  if (data.errors?.length && !allowPartialErrors) {
    const messages = data.errors.map(error => error.message || 'Lỗi GraphQL không xác định').join('; ');
    throw new Error(`GraphQL error: ${messages}`);
  }

  return data as T;
}
