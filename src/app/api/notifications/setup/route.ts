import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireAdmin, authErrorResponse } from '@/lib/auth/serverAuth';

let setupDone = false;

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);

    if (setupDone) {
      return NextResponse.json({ success: true, cached: true });
    }

    const [subCheck, notifCheck] = await Promise.all([
      supabaseAdmin.from('push_subscriptions').select('id').limit(1),
      supabaseAdmin.from('notifications').select('id').limit(1),
    ]);

    const pushOk = !subCheck.error;
    const notifOk = !notifCheck.error;

    if (pushOk && notifOk) {
      setupDone = true;
    }

    return NextResponse.json({ success: pushOk && notifOk, push_subscriptions: pushOk, notifications: notifOk });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);

    const [subCheck, notifCheck] = await Promise.all([
      supabaseAdmin.from('push_subscriptions').select('id').limit(1),
      supabaseAdmin.from('notifications').select('id').limit(1),
    ]);

    return NextResponse.json({
      push_subscriptions: !subCheck.error,
      notifications: !notifCheck.error,
      push_error: subCheck.error?.message,
      notif_error: notifCheck.error?.message,
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
