import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireUser, authErrorResponse, AuthError } from '@/lib/auth/serverAuth';

/**
 * GET /api/teacher-confirmations
 *   - returns the caller's own confirmations.
 *   - admins may pass ?email=<other> to read someone else's list.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);

    const queryEmail = (request.nextUrl.searchParams.get('email') || '').toLowerCase();
    const targetEmail = queryEmail || user.email;

    if (targetEmail !== user.email && !user.isAdmin) {
      throw new AuthError('Cannot read another user\'s confirmations', 403);
    }

    const { data, error } = await supabaseAdmin
      .from('teacher_office_hour_confirmations')
      .select('*')
      .eq('teacher_email', targetEmail)
      .order('created_at', { ascending: false });

    if (error) {
      if (error.code === '42P01') return NextResponse.json({ data: [] });
      throw error;
    }
    return NextResponse.json({ data: data || [] });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

/**
 * POST /api/teacher-confirmations
 * body: { action: 'confirm' | 'reject', officeHourId, notes?, reason? }
 * Confirms / rejects on behalf of the caller — caller can only operate on own email.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const body = await request.json().catch(() => ({}));

    const action = body?.action;
    const officeHourId = String(body?.officeHourId || '').trim();
    if (!officeHourId || (action !== 'confirm' && action !== 'reject')) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const teacherEmail = user.email;
    const now = new Date().toISOString();

    const update =
      action === 'confirm'
        ? {
            status: 'confirmed' as const,
            confirmed_at: now,
            rejected_at: null,
            rejection_reason: null,
            notes: body?.notes ?? null,
          }
        : {
            status: 'rejected' as const,
            rejected_at: now,
            confirmed_at: null,
            rejection_reason: body?.reason ?? null,
          };

    const { data, error } = await supabaseAdmin
      .from('teacher_office_hour_confirmations')
      .upsert(
        {
          office_hour_id: officeHourId,
          teacher_email: teacherEmail,
          ...update,
        },
        { onConflict: 'office_hour_id,teacher_email' }
      )
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return NextResponse.json({ error: 'Operation failed' }, { status: 500 });
  }
}
