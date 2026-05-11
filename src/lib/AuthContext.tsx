'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { AuthSession } from '@/types/auth';
import { loadSession, logout as authLogout, isAuthenticated } from '@/services/authService';
import { useRouter } from 'next/navigation';

interface AuthContextValue {
  session: AuthSession | null;
  isLoading: boolean;
  logout: () => void;
  updateSession: (session: AuthSession) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    initializeAuth();
  }, []);

  async function initializeAuth() {
    const stored = loadSession();

    if (!stored) {
      // No localStorage metadata — try to restore entirely from httpOnly cookie
      const restored = await tryRestoreFromCookie();
      setSession(restored);
      setIsLoading(false);
      return;
    }

    if (!isAuthenticated()) {
      // Metadata says token is expired — try cookie-based refresh before giving up
      const restored = await tryRestoreFromCookie();
      if (!restored) {
        // Cookie is also gone/expired — clear stale localStorage and show login
        const { clearSession } = await import('@/services/authService');
        clearSession();
      }
      setSession(restored);
      setIsLoading(false);
      return;
    }

    // Token still valid — check if close to expiry and refresh proactively
    const bufferMs = 5 * 60 * 1000;
    if (Date.now() >= stored.expiresAt - bufferMs) {
      try {
        const { refreshSession } = await import('@/services/authService');
        const refreshed = await refreshSession(stored);
        setSession(refreshed);
      } catch {
        const { clearSession } = await import('@/services/authService');
        clearSession();
        setSession(null);
      }
    } else {
      setSession(stored);
    }

    setIsLoading(false);
  }

  async function tryRestoreFromCookie(): Promise<AuthSession | null> {
    try {
      const { tryRestoreFromCookie: restore } = await import('@/services/authService');
      return await restore();
    } catch {
      return null;
    }
  }

  // Proactive refresh: schedule a refresh 5 minutes before expiry
  useEffect(() => {
    if (!session?.expiresAt) return;

    const msUntilRefresh = session.expiresAt - Date.now() - 5 * 60 * 1000;
    if (msUntilRefresh <= 0) return;

    const timer = setTimeout(async () => {
      try {
        const { refreshSession } = await import('@/services/authService');
        const newSession = await refreshSession(session);
        setSession(newSession);
      } catch {
        // Don't force logout here — let the next API call surface the error gracefully
      }
    }, msUntilRefresh);

    return () => clearTimeout(timer);
  }, [session?.expiresAt]);

  const logout = useCallback(() => {
    authLogout(); // clears memory + localStorage + httpOnly cookie
    setSession(null);
    router.push('/login');
  }, [router]);

  const updateSession = useCallback((newSession: AuthSession) => {
    setSession(newSession);
  }, []);

  return (
    <AuthContext.Provider value={{ session, isLoading, logout, updateSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
