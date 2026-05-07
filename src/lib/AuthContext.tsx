'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { AuthSession } from '@/types/auth';
import { loadSession, clearSession, isAuthenticated } from '@/services/authService';
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
      setIsLoading(false);
      return;
    }

    // Check if token is still valid
    if (!isAuthenticated()) {
      console.log('[AuthProvider] Session expired, clearing...');
      clearSession();
      setSession(null);
      setIsLoading(false);
      return;
    }

    // Check if token needs refresh (within 5 minutes of expiry)
    const now = Date.now();
    const bufferTime = 5 * 60 * 1000; // 5 minutes
    
    if (now >= stored.expiresAt - bufferTime) {
      console.log('[AuthProvider] Token expiring soon, refreshing...');
      try {
        const { refreshSession } = await import('@/services/authService');
        const refreshed = await refreshSession(stored);
        setSession(refreshed);
      } catch (error) {
        console.error('[AuthProvider] Token refresh failed:', error);
        clearSession();
        setSession(null);
      }
    } else {
      setSession(stored);
    }
    
    setIsLoading(false);
  }

  const logout = useCallback(() => {
    clearSession();
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
// Improved auth state management

// Improved auth state management

// Improved auth state
