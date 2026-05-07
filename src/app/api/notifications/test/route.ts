// API Route: Send a test push to the current authenticated user
// Returns detailed diagnostics so the caller can see exactly where the pipeline breaks.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireUser, authErrorResponse, AuthError } from '@/lib/auth/serverAuth';

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);

    // 1. Check subscriptions
    const { data: subs, error: subError } = await supabaseAdmin
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth, user_id, updated_at')
      .eq('user_id', user.email);

    const diagnostics: Record<string, any> = {
      email: user.email,
      vapidConfigured: !!(
        (process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) &&
        process.env.VAPID_PRIVATE_KEY
      ),
      subscriptionsFound: subs?.length ?? 0,
      subscriptionError: subError?.message ?? null,
    };

    if (!subs || subs.length === 0) {
      return NextResponse.json({
        success: false,
        diagnostics,
        error: 'Không tìm thấy push subscription. Hãy click "Bật thông báo" trong bell dropdown trước.',
      });
    }

    // 2. Attempt to send push
    const VAPID_PUB =
      process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
    const VAPID_PRIV = process.env.VAPID_PRIVATE_KEY || '';

    if (!VAPID_PUB || !VAPID_PRIV) {
      return NextResponse.json({
        success: false,
        diagnostics,
        error: 'VAPID keys chưa được cấu hình trên server.',
      });
    }

    const webpush = (await import('web-push')).default;
    webpush.setVapidDetails('mailto:admin@mindx.edu.vn', VAPID_PUB, VAPID_PRIV);

    const payload = JSON.stringify({
      title: '🔔 Test Push Notification',
      body: `Xác nhận thông báo đẩy hoạt động cho ${user.email}`,
      icon: '/logo/logo.svg',
      badge: '/logo/x_white.svg',
      tag: 'test-push',
      data: { url: '/' },
      requireInteraction: false,
    });

    const results: Array<{ endpoint: string; status: string; error?: string }> = [];
    const invalidIds: string[] = [];

    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        );
        results.push({ endpoint: sub.endpoint.slice(0, 60) + '...', status: 'sent' });
      } catch (err: any) {
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          invalidIds.push(sub.id);
          results.push({
            endpoint: sub.endpoint.slice(0, 60) + '...',
            status: 'expired',
            error: `HTTP ${err.statusCode} — subscription revoked by push service`,
          });
        } else {
          results.push({
            endpoint: sub.endpoint.slice(0, 60) + '...',
            status: 'error',
            error: err?.message ?? String(err),
          });
        }
      }
    }

    // Clean up expired subscriptions
    if (invalidIds.length > 0) {
      await supabaseAdmin.from('push_subscriptions').delete().in('id', invalidIds);
    }

    // 3. Save to notification history
    await supabaseAdmin.from('notifications').insert({
      user_id: user.email,
      title: '🔔 Test Push Notification',
      body: 'Xác nhận thông báo đẩy hoạt động',
      url: '/',
      type: 'test',
      read: false,
    });

    const sent = results.filter(r => r.status === 'sent').length;

    return NextResponse.json({
      success: sent > 0,
      sent,
      failed: results.length - sent,
      diagnostics,
      results,
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('[Test Push] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
