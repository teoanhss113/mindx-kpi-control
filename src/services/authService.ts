/**
 * authService.ts
 * Handles Firebase LMS authentication.
 * Simplified - no role lookup (Supabase removed).
 */

import { FirebaseSignInResponse, AuthSession } from '@/types/auth';

const FIREBASE_API_KEY = 'AIzaSyAh2Au-mk5ci-hN83RUBqj1fsAmCMdvJx4';
const FIREBASE_SIGN_IN_URL = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`;
const FIREBASE_CUSTOM_TOKEN_URL = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${FIREBASE_API_KEY}`;
const FIREBASE_REFRESH_URL = `https://securetoken.googleapis.com/v1/token?key=${FIREBASE_API_KEY}`;
const LMS_BASE_URL = 'https://base-api.mindx.edu.vn/';

const SESSION_KEY = 'kpi_session';

// ─── Sign In ────────────────────────────────────────────────────────────────

/**
 * Sign in with email or username
 * Automatically detects if input is email or username
 */
export async function signIn(emailOrUsername: string, password: string): Promise<AuthSession> {
  const isEmail = emailOrUsername.includes('@');
  
  if (isEmail) {
    return signInWithEmail(emailOrUsername, password);
  } else {
    // Try username login first
    try {
      return await signInWithUsername(emailOrUsername, password);
    } catch (error) {
      console.log('[signIn] Username login failed, trying with @mindx.com.vn suffix...');
      
      // If username login fails, try appending @mindx.com.vn
      // This handles cases where user enters "tuannh" but needs "tuannh@mindx.com.vn"
      try {
        return await signInWithEmail(`${emailOrUsername}@mindx.com.vn`, password);
      } catch (emailError) {
        // If both fail, throw the original username error
        throw error;
      }
    }
  }
}

/**
 * Sign in with email via Firebase directly
 */
async function signInWithEmail(email: string, password: string): Promise<AuthSession> {
  const res = await fetch(FIREBASE_SIGN_IN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      returnSecureToken: true,
      email,
      password,
      clientType: 'CLIENT_TYPE_WEB',
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const message = err?.error?.message ?? 'Authentication failed';
    throw new Error(message);
  }

  const data: FirebaseSignInResponse = await res.json();

  const session: AuthSession = {
    idToken: data.idToken,
    refreshToken: data.refreshToken,
    expiresAt: Date.now() + parseInt(data.expiresIn, 10) * 1000,
    uid: data.localId,
    displayName: data.displayName,
    email: data.email,
    provider: 'firebase',
  };

  persistSession(session);
  return session;
}

/**
 * Sign in with username via LMS GraphQL API (through proxy to avoid CORS)
 * Gets customToken from LMS, then exchanges it for Firebase tokens
 */
async function signInWithUsername(username: string, password: string): Promise<AuthSession> {
  console.log('[signInWithUsername] Starting login for username:', username);
  
  // Step 1: Get customToken from LMS via proxy endpoint
  const lmsRes = await fetch('/api/auth/login-username', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, password }),
  });

  if (!lmsRes.ok) {
    console.error('[signInWithUsername] LMS request failed:', lmsRes.status);
    const errorData = await lmsRes.json().catch(() => ({}));
    throw new Error(errorData.error || 'LMS authentication failed');
  }

  const lmsData = await lmsRes.json();
  console.log('[signInWithUsername] LMS response:', {
    hasErrors: !!lmsData.errors,
    hasData: !!lmsData.data,
    hasUsers: !!lmsData.data?.users,
    hasLoginWithUsername: !!lmsData.data?.users?.loginWithUsername,
    hasCustomToken: !!lmsData.data?.users?.loginWithUsername?.customToken,
    fullResponse: JSON.stringify(lmsData).substring(0, 200), // First 200 chars
  });
  
  if (lmsData.errors?.length) {
    console.error('[signInWithUsername] LMS errors:', lmsData.errors);
    const messages = lmsData.errors.map((e: { message: string }) => e.message).join('; ');
    throw new Error(messages);
  }

  const customToken = lmsData.data?.users?.loginWithUsername?.customToken;
  if (!customToken) {
    console.error('[signInWithUsername] No customToken in response');
    throw new Error('Invalid username or password');
  }

  console.log('[signInWithUsername] Got customToken, exchanging for Firebase tokens...');

  // Step 2: Exchange customToken for Firebase tokens
  const firebaseRes = await fetch(FIREBASE_CUSTOM_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: customToken,
      returnSecureToken: true,
    }),
  });

  if (!firebaseRes.ok) {
    console.error('[signInWithUsername] Firebase exchange failed:', firebaseRes.status);
    const err = await firebaseRes.json().catch(() => ({}));
    console.error('[signInWithUsername] Firebase error:', err);
    const message = err?.error?.message ?? 'Firebase authentication failed';
    throw new Error(message);
  }

  const firebaseData = await firebaseRes.json();
  console.log('[signInWithUsername] Firebase exchange successful');

  // Step 3: Get user info from Firebase (customToken exchange may not return displayName/email)
  const userInfoRes = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idToken: firebaseData.idToken,
      }),
    }
  );

  if (!userInfoRes.ok) {
    throw new Error('Failed to fetch user info');
  }

  const userInfoData = await userInfoRes.json();
  const userInfo = userInfoData.users?.[0];

  if (!userInfo) {
    throw new Error('User info not found');
  }

  const session: AuthSession = {
    idToken: firebaseData.idToken,
    refreshToken: firebaseData.refreshToken,
    expiresAt: Date.now() + parseInt(firebaseData.expiresIn, 10) * 1000,
    uid: firebaseData.localId || userInfo.localId,
    displayName: userInfo.displayName || '',
    email: userInfo.email || '',
    provider: 'firebase',
  };

  console.log('[signInWithUsername] Session created:', {
    uid: session.uid,
    displayName: session.displayName,
    email: session.email,
    hasToken: !!session.idToken,
  });

  persistSession(session);
  return session;
}

// ─── Token Refresh ──────────────────────────────────────────────────────────

export async function refreshSession(session: AuthSession): Promise<AuthSession> {
  // Firebase refresh
  const res = await fetch(FIREBASE_REFRESH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: session.refreshToken,
    }),
  });

  if (!res.ok) {
    throw new Error('Token refresh failed — please login again');
  }

  const data = await res.json();

  const newSession: AuthSession = {
    ...session,
    idToken: data.id_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + parseInt(data.expires_in, 10) * 1000,
    provider: 'firebase',
  };

  persistSession(newSession);
  return newSession;
}

// ─── Get Valid Token (auto-refresh if needed) ───────────────────────────────

export async function getValidToken(): Promise<string> {
  let session = loadSession();
  if (!session) throw new Error('Not authenticated');

  // Check if token is expired or about to expire (5 minutes buffer)
  const now = Date.now();
  const bufferTime = 5 * 60 * 1000; // 5 minutes
  
  if (now >= session.expiresAt - bufferTime) {
    try {
      console.log('[getValidToken] Token expiring soon, refreshing...', {
        expiresAt: new Date(session.expiresAt).toISOString(),
        now: new Date(now).toISOString(),
      });
      session = await refreshSession(session);
    } catch (error) {
      console.error('[getValidToken] Token refresh failed:', error);
      // Clear invalid session
      clearSession();
      throw new Error('Session expired - please login again');
    }
  }

  return session.idToken;
}

// ─── Session Persistence ────────────────────────────────────────────────────

export function persistSession(session: AuthSession): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function loadSession(): AuthSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as AuthSession) : null;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

export function isAuthenticated(): boolean {
  const session = loadSession();
  if (!session) return false;
  // Consider valid if still has time (even if we'd refresh soon)
  return Date.now() < session.expiresAt;
}
// Added error handling

// Added error handling
