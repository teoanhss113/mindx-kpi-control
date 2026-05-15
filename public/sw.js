// Service Worker for Push Notifications
// Handles background push events and notification clicks

const CACHE_NAME = 'mindx-notifications-v1';

// ── Lifecycle ────────────────────────────────────────────────────────────────

self.addEventListener('install', () => {
  console.log('[SW] Installing...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(self.clients.claim());
});

// ── Push event ───────────────────────────────────────────────────────────────

self.addEventListener('push', (event) => {
  console.log('[SW] Push received');

  // Defaults — shown if payload parse fails
  let title = 'MindX Teaching Hub HCM1&4';
  let options = {
    body: 'Bạn có thông báo mới',
    icon: '/logo/logo.svg',
    badge: '/logo/x_white.svg',
    tag: 'mindx-notification',
    data: { url: '/' },
    requireInteraction: false,
  };

  if (event.data) {
    try {
      const payload = event.data.json();

      title = payload.title || title;
      options = {
        body: payload.body || options.body,
        icon: payload.icon || options.icon,
        badge: payload.badge || options.badge,
        tag: payload.tag || options.tag,
        // Merge the top-level data object so click handler can read .url
        data: Object.assign({ url: '/' }, payload.data),
        requireInteraction: !!payload.requireInteraction,
        // actions only work in browsers that support them — safe to include
        ...(payload.actions && payload.actions.length > 0
          ? { actions: payload.actions }
          : {}),
      };
    } catch (e) {
      console.error('[SW] Failed to parse push payload:', e);
      options.body = event.data.text ? event.data.text() : options.body;
    }
  }

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// ── Notification click ───────────────────────────────────────────────────────

self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked, url:', event.notification.data?.url);
  event.notification.close();

  const urlToOpen = new URL(
    event.notification.data?.url || '/',
    self.location.origin
  ).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Focus an existing tab on the same origin
        for (const client of clientList) {
          if (client.url.startsWith(self.location.origin) && 'focus' in client) {
            client.focus();
            if ('navigate' in client) {
              return client.navigate(urlToOpen);
            }
            return;
          }
        }
        // No existing tab — open a new one
        return self.clients.openWindow(urlToOpen);
      })
  );
});

// ── Notification close ───────────────────────────────────────────────────────

self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification closed, tag:', event.notification.tag);
});
