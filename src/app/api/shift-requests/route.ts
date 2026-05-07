import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireUser, authErrorResponse, AuthError } from '@/lib/auth/serverAuth';

/**
 * GET /api/shift-requests
 *   - ?officeHourId=<id> → admin-only, list all requests for that office hour.
 *   - ?teacherEmail=<self> → caller's own requests (admin may query any).
 *   - ?check=1&officeHourId=<id> → returns { exists: boolean } for the caller's email.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const sp = request.nextUrl.searchParams;

    const check = sp.get('check');
    const officeHourId = sp.get('officeHourId') || '';
    const queryEmail = (sp.get('teacherEmail') || '').toLowerCase();

    if (check === '1') {
      if (!officeHourId) return NextResponse.json({ exists: false });
      const { data } = await supabaseAdmin
        .from('office_hours_shift_requests')
        .select('id')
        .eq('office_hour_id', officeHourId)
        .eq('teacher_email', user.email)
        .maybeSingle();
      return NextResponse.json({ exists: !!data });
    }

    // Admin: list all requests for one office hour.
    if (officeHourId && !queryEmail) {
      if (!user.isAdmin) throw new AuthError('Admin access required', 403);
      const { data, error } = await supabaseAdmin
        .from('office_hours_shift_requests')
        .select('*')
        .eq('office_hour_id', officeHourId)
        .order('created_at', { ascending: false });
      if (error) {
        if (error.code === '42P01') return NextResponse.json({ data: [] });
        throw error;
      }
      return NextResponse.json({ data: data || [] });
    }

    // Teacher: list own requests.
    const targetEmail = queryEmail || user.email;
    if (targetEmail !== user.email && !user.isAdmin) {
      throw new AuthError('Cannot read another user\'s requests', 403);
    }

    const { data, error } = await supabaseAdmin
      .from('office_hours_shift_requests')
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
 * POST /api/shift-requests
 * body: { officeHourId, teacherName, teacherId, requestNote? }
 * Creates a request on behalf of the caller (teacher_email == verified email).
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const body = await request.json().catch(() => ({}));

    const officeHourId = String(body?.officeHourId || '').trim();
    const teacherName = String(body?.teacherName || '').trim() || null;
    const teacherId = String(body?.teacherId || '').trim() || null;
    const requestNote = body?.requestNote ?? null;

    if (!officeHourId) {
      return NextResponse.json({ error: 'officeHourId required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('office_hours_shift_requests')
      .insert({
        office_hour_id: officeHourId,
        teacher_email: user.email,
        teacher_name: teacherName,
        teacher_id: teacherId,
        status: 'pending',
        request_note: requestNote,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Already requested' }, { status: 409 });
      }
      if (error.code === '42P01') {
        return NextResponse.json({ error: 'Table not found' }, { status: 500 });
      }
      throw error;
    }
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return NextResponse.json({ error: 'Operation failed' }, { status: 500 });
  }
}

/**
 * DELETE /api/shift-requests?officeHourId=<id>
 * Cancels the caller's own pending request for the given office hour.
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const officeHourId = request.nextUrl.searchParams.get('officeHourId') || '';
    if (!officeHourId) {
      return NextResponse.json({ error: 'officeHourId required' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('office_hours_shift_requests')
      .delete()
      .eq('office_hour_id', officeHourId)
      .eq('teacher_email', user.email)
      .eq('status', 'pending');

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return NextResponse.json({ error: 'Operation failed' }, { status: 500 });
  }
}
