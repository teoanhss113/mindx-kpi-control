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
    const stored = loadSession();
    if (stored && isAuthenticated()) {
      setSession(stored);
    }
    setIsLoading(false);
  }, []);

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
