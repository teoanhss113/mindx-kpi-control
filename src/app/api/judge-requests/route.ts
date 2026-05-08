import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireUser, authErrorResponse, AuthError } from '@/lib/auth/serverAuth';

/**
 * GET /api/judge-requests
 *   - ?check=1&sessionId=<id> → { exists: boolean } for the caller's email
 *   - (no params) → caller's own requests
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const sp = request.nextUrl.searchParams;
    const check = sp.get('check');
    const sessionId = sp.get('sessionId') || '';

    if (check === '1') {
      if (!sessionId) return NextResponse.json({ exists: false });
      const { data } = await supabaseAdmin
        .from('judge_requests')
        .select('id')
        .eq('session_id', sessionId)
        .eq('teacher_email', user.email)
        .maybeSingle();
      return NextResponse.json({ exists: !!data });
    }

    const { data, error } = await supabaseAdmin
      .from('judge_requests')
      .select('*')
      .eq('teacher_email', user.email)
      .order('created_at', { ascending: false });

    if (error) {
      if (error.code === '42P01') return NextResponse.json({ data: [] });
      throw error;
    }
    return NextResponse.json({ data: data || [] });
  } catch (err) {
    return authErrorResponse(err);
  }
}

/**
 * POST /api/judge-requests
 * Body: { sessionId, classId, teacherName, teacherId, requestNote? }
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const body = await request.json();
    const { sessionId, classId, teacherName, teacherId, requestNote } = body;

    if (!sessionId || !classId) {
      return NextResponse.json({ error: 'sessionId and classId are required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('judge_requests')
      .insert({
        session_id: sessionId,
        class_id: classId,
        teacher_email: user.email,
        teacher_name: teacherName || null,
        teacher_id: teacherId || null,
        request_note: requestNote || null,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Already requested' }, { status: 409 });
      }
      throw error;
    }

    return NextResponse.json({ data });
  } catch (err) {
    return authErrorResponse(err);
  }
}

/**
 * DELETE /api/judge-requests?sessionId=<id>
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const sessionId = request.nextUrl.searchParams.get('sessionId') || '';
    if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 });

    const { error } = await supabaseAdmin
      .from('judge_requests')
      .delete()
      .eq('session_id', sessionId)
      .eq('teacher_email', user.email)
      .eq('status', 'pending');

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    return authErrorResponse(err);
  }
}
