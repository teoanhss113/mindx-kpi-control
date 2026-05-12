'use client';

import { useCallback, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { authFetch, getAuthToken } from '@/lib/auth/clientAuth';

const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000;

export function ActivityTracker() {
  const { session, isLoading } = useAuth();
  const pathname = usePathname();
  const lastActivityAtRef = useRef(0);
  const lastSentAtRef = useRef(0);
  const tokenRef = useRef<string | null>(null);
  const sendingRef = useRef(false);

  const markActive = useCallback(() => {
    lastActivityAtRef.current = Date.now();
  }, []);

  const eventPayload = useCallback((eventType: 'page_view' | 'heartbeat') => ({
    eventType,
    path: pathname || '/',
    viewportWidth: typeof window !== 'undefined' ? window.innerWidth : null,
    viewportHeight: typeof window !== 'undefined' ? window.innerHeight : null,
  }), [pathname]);

  const sendUsageEvent = useCallback(async (eventType: 'page_view' | 'heartbeat', force = false) => {
    if (!session?.uid || document.visibilityState === 'hidden' || sendingRef.current) return;

    const now = Date.now();
    const hasRecentActivity = lastActivityAtRef.current > lastSentAtRef.current;
    if (eventType === 'heartbeat' && !force && (!hasRecentActivity || now - lastSentAtRef.current < HEARTBEAT_INTERVAL_MS)) return;

    sendingRef.current = true;
    try {
      const token = await getAuthToken();
      tokenRef.current = token;

      const response = await authFetch('/api/usage/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventPayload(eventType)),
      });

      if (response.ok) {
        lastSentAtRef.current = now;
      }
    } catch (error) {
      console.error('[ActivityTracker] Failed to update activity:', error);
    } finally {
      sendingRef.current = false;
    }
  }, [eventPayload, session?.uid]);

  const sendFinalHeartbeat = useCallback(() => {
    if (!session?.uid || !tokenRef.current) return;

    fetch('/api/usage/track', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenRef.current}`,
      },
      body: JSON.stringify(eventPayload('heartbeat')),
      keepalive: true,
    }).catch(() => {});
  }, [eventPayload, session?.uid]);

  useEffect(() => {
    if (isLoading || !session?.uid) return;

    markActive();
    sendUsageEvent('page_view', true);

    const activityEvents: Array<keyof WindowEventMap> = [
      'pointerdown',
      'keydown',
      'scroll',
      'focus',
    ];

    activityEvents.forEach(eventName => {
      window.addEventListener(eventName, markActive, { passive: true });
    });

    const heartbeatTimer = window.setInterval(() => {
      sendUsageEvent('heartbeat');
    }, HEARTBEAT_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        markActive();
        sendUsageEvent('heartbeat', true);
        return;
      }

      sendFinalHeartbeat();
    };

    const handlePageHide = () => {
      sendFinalHeartbeat();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      activityEvents.forEach(eventName => {
        window.removeEventListener(eventName, markActive);
      });
      window.clearInterval(heartbeatTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [isLoading, markActive, sendFinalHeartbeat, sendUsageEvent, session?.uid]);

  return null;
}
