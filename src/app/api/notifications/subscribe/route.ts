// API Route: Subscribe to Push Notifications
// Saves push subscription to database, tied to the verified user email.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireUser, authErrorResponse, AuthError } from '@/lib/auth/serverAuth';

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const body = await request.json();
    const { endpoint, keys } = body;

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json({ error: 'Invalid subscription data' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('push_subscriptions')
      .upsert(
        {
          user_id: user.email,
          endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'endpoint' },
      )
      .select()
      .single();

    if (error) {
      console.error('[Subscribe] Database error:', error);
      return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 });
    }

    return NextResponse.json({ success: true, subscription: data });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('[Subscribe] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
