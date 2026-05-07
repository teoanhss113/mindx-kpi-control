/**
 * clientAuth.ts
 * Browser-side helpers that attach the Firebase ID token to fetch
 * requests / server actions so the server can authenticate the caller.
 */

import { getValidToken } from '@/services/authService';

/**
 * Wrapper around fetch that attaches the current Firebase ID token as
 * a Bearer Authorization header. Use for all calls to `/api/admin/*`,
 * `/api/auth/*`, `/api/run-migration`, and `/api/debug/*`.
 */
export async function authFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const token = await getValidToken();
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}

/**
 * Get the current Firebase ID token. Throws if the user is not signed in.
 * Use to pass tokens into Next server actions which need to verify them.
 */
export async function getAuthToken(): Promise<string> {
  return getValidToken();
}
