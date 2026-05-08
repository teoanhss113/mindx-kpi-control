/**
 * notificationService.ts
 * Server-side notification service.
 *
 * Handles everything directly via Supabase Admin + web-push — no HTTP round-trips.
 * Import this ONLY from API routes (server side), never from client components.
 */

import { supabaseAdmin } from '@/lib/supabase/admin';

// Lazy-load web-push so the module is never bundled on the client
async function getWebPush() {
  const wp = await import('web-push');
  const lib = wp.default ?? wp;

  const pubKey = process.env.VAPID_PUBLIC_KEY ?? process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';
  const privKey = process.env.VAPID_PRIVATE_KEY ?? '';

  if (pubKey && privKey) {
    lib.setVapidDetails('mailto:admin@mindx.edu.vn', pubKey, privKey);
  }

  return lib as typeof import('web-push');
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NotifyParams {
  /** One of: userEmail or userEmails must be provided */
  userEmail?: string;
  userEmails?: string[];
  title: string;
  body: string;
  /** Relative URL to open on click, e.g. '/admin/office-hours' */
  url: string;
  tag?: string;
  requireInteraction?: boolean;
  type?: string;
}

// ─── Core send function ───────────────────────────────────────────────────────

/**
 * Save notification to DB and send Web Push to all active browser subscriptions
 * for the specified user email(s).
 *
 * Safe to call from any API route — failures are logged but never thrown.
 */
export async function notifyUsers(params: NotifyParams): Promise<void> {
  try {
    const emails = params.userEmails ?? (params.userEmail ? [params.userEmail] : []);
    if (emails.length === 0) return;

    // 1. Save notification history records
    const records = emails.map(email => ({
      user_id: email,
      title: params.title,
      body: params.body,
      url: params.url,
      type: params.type ?? params.tag ?? 'generic',
      read: false,
    }));

    const { error: saveError } = await supabaseAdmin
      .from('notifications')
      .insert(records);

    if (saveError) {
      console.error('[notifyUsers] Failed to save notifications:', saveError.message);
    }

    // 2. Fetch push subscriptions for these users
    const { data: subs, error: subError } = await supabaseAdmin
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .in('user_id', emails);

    if (subError || !subs || subs.length === 0) return;

    // 3. Send push notifications
    const webpush = await getWebPush();
    const payload = JSON.stringify({
      title: params.title,
      body: params.body,
      icon: '/logo/logo.svg',
      badge: '/logo/x_white.svg',
      tag: params.tag ?? 'mindx-notification',
      requireInteraction: params.requireInteraction ?? false,
      data: { url: params.url },
    });

    const invalidIds: string[] = [];

    await Promise.allSettled(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
          );
        } catch (err: any) {
          // 410 Gone / 404 = subscription no longer valid — clean it up
          if (err?.statusCode === 410 || err?.statusCode === 404) {
            invalidIds.push(sub.id);
          } else {
            console.error('[notifyUsers] Push failed:', err?.message);
          }
        }
      }),
    );

    if (invalidIds.length > 0) {
      await supabaseAdmin
        .from('push_subscriptions')
        .delete()
        .in('id', invalidIds);
    }
  } catch (err: any) {
    // Never crash the caller
    console.error('[notifyUsers] Unexpected error:', err?.message);
  }
}

// ─── Helper: get admin emails for a given page ────────────────────────────────

/**
 * Returns emails of all active users whose role grants can_view on pageKey.
 * Used to broadcast notifications to everyone responsible for a page.
 */
export async function getAdminEmailsForPage(pageKey: string): Promise<string[]> {
  try {
    // Find the page id
    const { data: page } = await supabaseAdmin
      .from('pages')
      .select('id')
      .eq('key', pageKey)
      .maybeSingle();

    if (!page) return [];

    // Roles that can view this page
    const { data: rolePerms } = await supabaseAdmin
      .from('role_permissions')
      .select('role_id')
      .eq('page_id', page.id)
      .eq('can_view', true);

    if (!rolePerms || rolePerms.length === 0) return [];

    const roleIds = rolePerms.map(r => r.role_id);

    // Active users with those roles
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('email')
      .in('role_id', roleIds)
      .eq('is_active', true);

    return (profiles ?? []).map(p => p.email).filter(Boolean);
  } catch (err: any) {
    console.error('[getAdminEmailsForPage] Error:', err?.message);
    return [];
  }
}

// ─── Office hour info helper ──────────────────────────────────────────────────

import { formatOHLabel, type OHInfo } from '@/lib/notificationFormat';

export type OfficeHourInfo = OHInfo;

function buildOHUrl(info?: OfficeHourInfo): string {
  if (!info?.startTime) return '/admin/office-hours';
  try {
    const vnDate = new Date(new Date(info.startTime).toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
    const date = `${vnDate.getFullYear()}-${String(vnDate.getMonth() + 1).padStart(2, '0')}-${String(vnDate.getDate()).padStart(2, '0')}`;
    const params = new URLSearchParams({ date });
    if (info.centreId) params.set('centre', info.centreId);
    if (info.id) params.set('open', info.id);
    return `/admin/office-hours?${params}`;
  } catch {
    return '/admin/office-hours';
  }
}

// ─── Notification templates ───────────────────────────────────────────────────

export const NotifyTemplates = {
  /** Teacher submits an office-hours shift request */
  shiftRequested: (teacherName: string, info?: OfficeHourInfo) => {
    const label = formatOHLabel(info);
    return {
      title: `Yêu cầu xin trực${info?.type ? `: ${info.type}` : ''}`,
      body: label ? `${teacherName} · ${label}` : `${teacherName} vừa đăng ký ca trực`,
      url: buildOHUrl(info),
      tag: 'shift-requested',
      requireInteraction: false,
      type: 'shift-request',
    };
  },

  /** Teacher cancels a shift request */
  shiftCancelled: (teacherName: string, info?: OfficeHourInfo) => {
    const label = formatOHLabel(info);
    return {
      title: 'Huỷ đăng ký ca trực',
      body: label ? `${teacherName} huỷ · ${label}` : `${teacherName} đã huỷ đăng ký ca trực`,
      url: buildOHUrl(info),
      tag: 'shift-cancelled',
      type: 'shift-request',
    };
  },

  /** Teacher confirms participation in an office hour */
  teacherConfirmed: (teacherName: string, info?: OfficeHourInfo) => {
    const label = formatOHLabel(info);
    return {
      title: 'Giáo viên xác nhận tham gia',
      body: label ? `${teacherName} xác nhận · ${label}` : `${teacherName} đã xác nhận tham gia ca trực`,
      url: buildOHUrl(info),
      tag: 'teacher-confirmed',
      type: 'teacher-confirmation',
    };
  },

  /** Teacher rejects participation in an office hour */
  teacherRejected: (teacherName: string, info?: OfficeHourInfo, reason?: string) => {
    const label = formatOHLabel(info);
    const base = label ? `${teacherName} từ chối · ${label}` : `${teacherName} đã từ chối ca trực`;
    return {
      title: 'Giáo viên từ chối tham gia',
      body: reason ? `${base} — ${reason}` : base,
      url: buildOHUrl(info),
      tag: 'teacher-rejected',
      requireInteraction: true,
      type: 'teacher-confirmation',
    };
  },
};
