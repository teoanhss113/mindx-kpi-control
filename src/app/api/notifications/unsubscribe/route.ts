// API Route: Unsubscribe from Push Notifications
// Removes push subscription from database for the verified user.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireUser, authErrorResponse, AuthError } from '@/lib/auth/serverAuth';

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);

    const { error } = await supabaseAdmin
      .from('push_subscriptions')
      .delete()
      .eq('user_id', user.email);

    if (error) {
      console.error('[Unsubscribe] Database error:', error);
      return NextResponse.json({ error: 'Failed to remove subscription' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('[Unsubscribe] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
