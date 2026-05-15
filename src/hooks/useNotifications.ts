// React Hook for Push Notifications
// Manages notification permissions, subscriptions, and state

import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '@/lib/auth/clientAuth';
import {
  isPushSupported,
  getNotificationPermission,
  requestNotificationPermission,
  registerServiceWorker,
  getServiceWorkerRegistration,
  subscribeToPush,
  unsubscribeFromPush,
  getPushSubscription,
  serializeSubscription,
  showLocalNotification
} from '@/lib/notifications';

interface NotificationState {
  supported: boolean;
  permission: NotificationPermission;
  subscribed: boolean;
  loading: boolean;
  error: string | null;
}

interface UseNotificationsReturn extends NotificationState {
  requestPermission: () => Promise<boolean>;
  subscribe: () => Promise<boolean>;
  unsubscribe: () => Promise<boolean>;
  testNotification: () => Promise<void>;
  clearError: () => void;
}

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

export function useNotifications(): UseNotificationsReturn {
  const [state, setState] = useState<NotificationState>({
    supported: false,
    permission: 'default',
    subscribed: false,
    loading: true,
    error: null
  });

  // Initialize notification state
  useEffect(() => {
    async function initialize() {
      try {
        const supported = isPushSupported();

        if (!supported) {
          setState(prev => ({
            ...prev,
            supported: false,
            loading: false,
            error: 'Browser không hỗ trợ push notifications'
          }));
          return;
        }

        const permission = getNotificationPermission();
        const registration = await getServiceWorkerRegistration();

        let subscribed = false;
        if (registration && permission === 'granted') {
          const subscription = await getPushSubscription(registration);
          subscribed = !!subscription;

          // Auto-sync: silently re-POST the existing browser subscription to the server.
          // This corrects any stale records saved under 'anonymous' before the auth fix,
          // ensuring the subscription is always linked to the current user's email.
          if (subscription && VAPID_PUBLIC_KEY) {
            try {
              const serialized = serializeSubscription(subscription);
              await authFetch('/api/notifications/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(serialized),
              });
            } catch {
              // Non-critical — ignore sync errors silently
            }
          }
        }

        setState({
          supported: true,
          permission,
          subscribed,
          loading: false,
          error: null,
        });
      } catch (error) {
        console.error('[useNotifications] Initialization error:', error);
        setState(prev => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : 'Lỗi khởi tạo notifications',
        }));
      }
    }

    initialize();
  }, []);

  // Request notification permission
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!state.supported) {
      setState(prev => ({ ...prev, error: 'Browser không hỗ trợ notifications' }));
      return false;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const permission = await requestNotificationPermission();
      
      setState(prev => ({
        ...prev,
        permission,
        loading: false
      }));

      return permission === 'granted';
    } catch (error) {
      console.error('[useNotifications] Permission request error:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Lỗi yêu cầu quyền'
      }));
      return false;
    }
  }, [state.supported]);

  // Subscribe to push notifications
  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!state.supported) {
      setState(prev => ({ ...prev, error: 'Browser không hỗ trợ notifications' }));
      return false;
    }

    if (state.permission !== 'granted') {
      const granted = await requestPermission();
      if (!granted) {
        return false;
      }
    }

    if (!VAPID_PUBLIC_KEY) {
      setState(prev => ({ ...prev, error: 'VAPID key chưa được cấu hình' }));
      return false;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      // Register service worker
      let registration = await getServiceWorkerRegistration();
      if (!registration) {
        registration = await registerServiceWorker();
      }

      // Subscribe to push
      const subscription = await subscribeToPush(registration, VAPID_PUBLIC_KEY);
      const serialized = serializeSubscription(subscription);

      // Send subscription to server (with Firebase auth token)
      const response = await authFetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serialized)
      });

      if (!response.ok) {
        throw new Error('Lỗi lưu subscription vào server');
      }

      setState(prev => ({
        ...prev,
        subscribed: true,
        loading: false
      }));

      return true;
    } catch (error) {
      console.error('[useNotifications] Subscribe error:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Lỗi đăng ký notifications'
      }));
      return false;
    }
  }, [state.supported, state.permission, requestPermission]);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!state.supported) {
      return false;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const registration = await getServiceWorkerRegistration();
      
      if (registration) {
        await unsubscribeFromPush(registration);
      }

      // Remove subscription from server (with Firebase auth token)
      await authFetch('/api/notifications/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      setState(prev => ({
        ...prev,
        subscribed: false,
        loading: false
      }));

      return true;
    } catch (error) {
      console.error('[useNotifications] Unsubscribe error:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Lỗi huỷ đăng ký notifications'
      }));
      return false;
    }
  }, [state.supported]);

  // Test notification
  const testNotification = useCallback(async (): Promise<void> => {
    if (!state.supported || state.permission !== 'granted') {
      throw new Error('Notifications chưa được bật');
    }

    try {
      await showLocalNotification('Test Notification', {
        body: 'Đây là thông báo thử nghiệm từ MindX Teaching Hub HCM1&4',
        tag: 'test-notification',
        requireInteraction: false
      });
    } catch (error) {
      console.error('[useNotifications] Test notification error:', error);
      throw error;
    }
  }, [state.supported, state.permission]);

  // Clear error
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  return {
    ...state,
    requestPermission,
    subscribe,
    unsubscribe,
    testNotification,
    clearError
  };
}
