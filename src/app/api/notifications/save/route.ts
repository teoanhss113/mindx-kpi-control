// API Route: Save Notifications to Database
// Saves notification history for users

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireAdmin, authErrorResponse } from '@/lib/auth/serverAuth';

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);

    const body = await request.json();
    const { notifications } = body;

    if (!notifications || !Array.isArray(notifications)) {
      return NextResponse.json(
        { error: 'Invalid notifications data' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('notifications')
      .insert(notifications)
      .select();

    if (error) {
      console.error('[Save Notifications] Database error:', error);
      return NextResponse.json({ error: 'Failed to save notifications' }, { status: 500 });
    }

    return NextResponse.json({ success: true, count: data?.length || 0 });
  } catch (error) {
    return authErrorResponse(error);
  }
}
