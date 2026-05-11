/**
 * authService.ts
 * Handles Firebase LMS authentication.
 *
 * Security model:
 *  - idToken  → kept in module-level memory only (lost on page refresh, not in localStorage)
 *  - refreshToken → stored in httpOnly Secure cookie via /api/auth/session (not accessible to JS)
 *  - Session metadata (uid, email, displayName, expiresAt) → localStorage (non-sensitive)
 *
 * On page refresh, getValidToken() automatically calls /api/auth/refresh which reads the
 * httpOnly cookie and returns a fresh idToken without ever exposing the refreshToken to JS.
 */

import { FirebaseSignInResponse, AuthSession } from '@/types/auth';

// ─── Firebase URLs ─────────────────────────────────────────────────────────────

function getFirebaseApiKey(): string {
  const key = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!key) throw new Error('NEXT_PUBLIC_FIREBASE_API_KEY is not configured');
  return key;
}

const FIREBASE_SIGN_IN_URL = () =>
  `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${getFirebaseApiKey()}`;
const FIREBASE_CUSTOM_TOKEN_URL = () =>
  `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${getFirebaseApiKey()}`;
const FIREBASE_REFRESH_URL = () =>
  `https://securetoken.googleapis.com/v1/token?key=${getFirebaseApiKey()}`;

// ─── In-memory token store ─────────────────────────────────────────────────────

// Tokens live here only — not persisted to localStorage.
// XSS can call getValidToken() but cannot steal the refreshToken (it's in httpOnly cookie).
let _mem: { idToken: string; refreshToken: string; expiresAt: number } | null = null;

// ─── localStorage key (metadata only, no tokens) ──────────────────────────────

const SESSION_KEY = 'kpi_session';

type SessionMeta = Omit<AuthSession, 'idToken' | 'refreshToken'>;

// ─── Sign In ───────────────────────────────────────────────────────────────────

export async function signIn(emailOrUsername: string, password: string): Promise<AuthSession> {
  const isEmail = emailOrUsername.includes('@');

  if (isEmail) {
    return signInWithEmail(emailOrUsername, password);
  }

  if (!/^[a-zA-Z0-9._-]+$/.test(emailOrUsername)) {
    throw new Error('Invalid username format');
  }

  try {
    return await signInWithUsername(emailOrUsername, password);
  } catch (error) {
    try {
      return await signInWithEmail(`${emailOrUsername}@mindx.com.vn`, password);
    } catch {
      throw error;
    }
  }
}

async function signInWithEmail(email: string, password: string): Promise<AuthSession> {
  const res = await fetch(FIREBASE_SIGN_IN_URL(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ returnSecureToken: true, email, password, clientType: 'CLIENT_TYPE_WEB' }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? 'Authentication failed');
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

  await persistSession(session);
  return session;
}

async function signInWithUsername(username: string, password: string): Promise<AuthSession> {
  const lmsRes = await fetch('/api/auth/login-username', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  if (!lmsRes.ok) {
    const errorData = await lmsRes.json().catch(() => ({}));
    throw new Error(errorData.error || 'LMS authentication failed');
  }

  const lmsData = await lmsRes.json();

  if (lmsData.errors?.length) {
    throw new Error(lmsData.errors.map((e: { message: string }) => e.message).join('; '));
  }

  const customToken = lmsData.data?.users?.loginWithUsername?.customToken;
  if (!customToken) throw new Error('Invalid username or password');

  const firebaseRes = await fetch(FIREBASE_CUSTOM_TOKEN_URL(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: customToken, returnSecureToken: true }),
  });

  if (!firebaseRes.ok) {
    const err = await firebaseRes.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? 'Firebase authentication failed');
  }

  const firebaseData = await firebaseRes.json();

  const userInfoRes = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${getFirebaseApiKey()}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: firebaseData.idToken }),
    },
  );

  if (!userInfoRes.ok) throw new Error('Failed to fetch user info');

  const userInfo = (await userInfoRes.json()).users?.[0];
  if (!userInfo) throw new Error('User info not found');

  const session: AuthSession = {
    idToken: firebaseData.idToken,
    refreshToken: firebaseData.refreshToken,
    expiresAt: Date.now() + parseInt(firebaseData.expiresIn, 10) * 1000,
    uid: firebaseData.localId || userInfo.localId,
    displayName: userInfo.displayName || '',
    email: userInfo.email || '',
    provider: 'firebase',
  };

  await persistSession(session);
  return session;
}

// ─── Token Refresh ─────────────────────────────────────────────────────────────

export async function refreshSession(session: AuthSession): Promise<AuthSession> {
  // Use in-memory refreshToken if available (e.g. token expiring within current page session)
  if (_mem?.refreshToken) {
    const res = await fetch(FIREBASE_REFRESH_URL(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: _mem.refreshToken }),
    });

    if (res.ok) {
      const data = await res.json();
      const newSession: AuthSession = {
        ...session,
        idToken: data.id_token,
        refreshToken: data.refresh_token,
        expiresAt: Date.now() + parseInt(data.expires_in, 10) * 1000,
        provider: 'firebase',
      };
      await persistSession(newSession);
      return newSession;
    }
  }

  // Fall back: use httpOnly cookie via server (page refresh scenario)
  return _refreshFromCookie(session);
}

// Restores a session from the httpOnly refreshToken cookie.
// Called on page load when in-memory state is gone.
export async function tryRestoreFromCookie(): Promise<AuthSession | null> {
  const meta = _loadMeta();
  if (!meta) return null; // No metadata to restore display info from

  const res = await fetch('/api/auth/refresh', { method: 'POST' });
  if (!res.ok) return null;

  const { idToken, expiresAt } = await res.json();
  _mem = { idToken, refreshToken: '', expiresAt };
  _saveMeta({ ...meta, expiresAt });

  return { ...meta, idToken, refreshToken: '', expiresAt };
}

async function _refreshFromCookie(session: AuthSession): Promise<AuthSession> {
  const res = await fetch('/api/auth/refresh', { method: 'POST' });
  if (!res.ok) throw new Error('Token refresh failed — please login again');

  const { idToken, expiresAt } = await res.json();
  _mem = { idToken, refreshToken: _mem?.refreshToken || '', expiresAt };
  _saveMeta({ uid: session.uid, email: session.email, displayName: session.displayName, expiresAt, provider: session.provider });

  return { ...session, idToken, refreshToken: '', expiresAt };
}

// ─── Get Valid Token ───────────────────────────────────────────────────────────

export async function getValidToken(): Promise<string> {
  const bufferMs = 5 * 60 * 1000;

  // Happy path: in-memory token still valid
  if (_mem?.idToken && Date.now() < _mem.expiresAt - bufferMs) {
    return _mem.idToken;
  }

  // Try refresh
  if (_mem?.refreshToken) {
    // In-memory refresh token available (within page session)
    const res = await fetch(FIREBASE_REFRESH_URL(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: _mem.refreshToken }),
    });
    if (res.ok) {
      const data = await res.json();
      _mem = {
        idToken: data.id_token,
        refreshToken: data.refresh_token,
        expiresAt: Date.now() + parseInt(data.expires_in, 10) * 1000,
      };
      const meta = _loadMeta();
      if (meta) _saveMeta({ ...meta, expiresAt: _mem.expiresAt });
      return _mem.idToken;
    }
  }

  // Last resort: cookie-based refresh (page refresh scenario)
  const res = await fetch('/api/auth/refresh', { method: 'POST' });
  if (!res.ok) {
    clearSession();
    throw new Error('Session expired - please login again');
  }

  const { idToken, expiresAt } = await res.json();
  _mem = { idToken, refreshToken: _mem?.refreshToken || '', expiresAt };
  const meta = _loadMeta();
  if (meta) _saveMeta({ ...meta, expiresAt });

  return idToken;
}

// ─── Session Persistence ───────────────────────────────────────────────────────

export async function persistSession(session: AuthSession): Promise<void> {
  // Keep tokens in memory only
  _mem = { idToken: session.idToken, refreshToken: session.refreshToken, expiresAt: session.expiresAt };

  // Save non-sensitive metadata to localStorage
  _saveMeta({
    uid: session.uid,
    email: session.email,
    displayName: session.displayName,
    expiresAt: session.expiresAt,
    provider: session.provider,
  });

  // Persist refreshToken in httpOnly cookie (best-effort, don't fail login on network error)
  if (session.refreshToken) {
    fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: session.refreshToken }),
    }).catch(() => {});
  }
}

export function loadSession(): AuthSession | null {
  const meta = _loadMeta();
  if (!meta) return null;
  return {
    ...meta,
    idToken: _mem?.idToken || '',
    refreshToken: '', // Never expose refreshToken to callers
  };
}

export function clearSession(): void {
  _mem = null;
  if (typeof window !== 'undefined') localStorage.removeItem(SESSION_KEY);
}

// Call this on explicit user logout — also clears the httpOnly cookie
export function logout(): void {
  clearSession();
  fetch('/api/auth/session', { method: 'DELETE' }).catch(() => {});
}

export function isAuthenticated(): boolean {
  const meta = _loadMeta();
  if (!meta) return false;
  return Date.now() < meta.expiresAt;
}

// ─── Internal helpers ──────────────────────────────────────────────────────────

function _loadMeta(): SessionMeta | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as SessionMeta) : null;
  } catch {
    return null;
  }
}

function _saveMeta(meta: SessionMeta): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SESSION_KEY, JSON.stringify(meta));
}
