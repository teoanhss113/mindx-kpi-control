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
 * 
 * Automatically handles 401 errors by attempting token refresh once.
 */
export async function authFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  try {
    const token = await getValidToken();
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${token}`);
    
    const response = await fetch(input, { ...init, headers });
    
    // If 401, try to get a fresh token and retry once
    if (response.status === 401) {
      try {
        const { getValidToken, loadSession, refreshSession } = await import('@/services/authService');
        const session = loadSession();
        if (session) {
          const newSession = await refreshSession(session);
          const newHeaders = new Headers(init.headers);
          newHeaders.set('Authorization', `Bearer ${newSession.idToken}`);
          return fetch(input, { ...init, headers: newHeaders });
        }
      } catch {
        const { logout } = await import('@/services/authService');
        logout();
        throw new Error('Session expired - please login again');
      }
    }

    return response;
  } catch (error) {
    throw error;
  }
}

/**
 * Get the current Firebase ID token. Throws if the user is not signed in.
 * Use to pass tokens into Next server actions which need to verify them.
 */
export async function getAuthToken(): Promise<string> {
  return getValidToken();
}
