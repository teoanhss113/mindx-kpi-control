/**
 * GET    /api/admin/judge-batches/[id]/sessions   → list sessions in batch
 * POST   /api/admin/judge-batches/[id]/sessions   → bulk-add sessions from LMS data
 * PATCH  /api/admin/judge-batches/[id]/sessions   → assign judge to a final session
 * DELETE /api/admin/judge-batches/[id]/sessions?sessionId=<uuid>  → remove a session
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireAdmin, authErrorResponse } from '@/lib/auth/serverAuth';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(request);
    const { id } = await params;
    const { data, error } = await supabaseAdmin
      .from('final_sessions')
      .select('*, judge_requests(*)')
      .eq('batch_id', id)
      .order('session_date')
      .order('start_time_utc');
    if (error) throw error;
    return NextResponse.json({ data: data || [] });
  } catch (err) {
    return authErrorResponse(err);
  }
}

export interface SessionInsert {
  lms_class_id: string;
  lms_slot_id: string;
  class_name: string;
  course_short_name?: string;
  centre_id?: string;
  centre_name?: string;
  category?: string;
  session_date: string;        // YYYY-MM-DD
  start_time_utc?: string;     // ISO
  end_time_utc?: string;       // ISO
  main_teacher?: string;
  judge_teacher?: string | null;
  judge_teacher_id?: string | null;
  judge_teacher_email?: string | null;
  student_count?: number;
  notes?: string;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(request);
    const { id } = await params;
    const body = await request.json();
    const sessions: SessionInsert[] = body.sessions;

    if (!Array.isArray(sessions) || sessions.length === 0) {
      return NextResponse.json({ error: 'sessions array is required' }, { status: 400 });
    }

    const rows = sessions.map(session => ({
      batch_id: id,
      lms_class_id: session.lms_class_id,
      lms_slot_id: session.lms_slot_id,
      class_name: session.class_name,
      course_short_name: session.course_short_name,
      centre_id: session.centre_id,
      centre_name: session.centre_name,
      category: session.category,
      session_date: session.session_date,
      start_time_utc: session.start_time_utc,
      end_time_utc: session.end_time_utc,
      main_teacher: session.main_teacher,
      student_count: session.student_count,
      notes: session.notes,
    }));

    // Upsert: skip duplicates (same batch + lms_slot_id)
    const { data, error } = await supabaseAdmin
      .from('final_sessions')
      .upsert(rows, { onConflict: 'batch_id,lms_slot_id', ignoreDuplicates: true })
      .select();

    if (error) throw error;

    const sessionBySlot = new Map((data || []).map(session => [session.lms_slot_id, session]));
    const approvedJudgeRows = sessions
      .map(session => {
        const finalSession = sessionBySlot.get(session.lms_slot_id);
        if (!finalSession || !session.judge_teacher_email) return null;
        return {
          final_session_id: finalSession.id,
          teacher_email: session.judge_teacher_email,
          teacher_name: session.judge_teacher || session.judge_teacher_email,
          teacher_id: session.judge_teacher_id,
          status: 'approved',
          approved_at: new Date().toISOString(),
        };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row));

    if (approvedJudgeRows.length > 0) {
      const { error: judgeErr } = await supabaseAdmin
        .from('judge_requests')
        .upsert(approvedJudgeRows, { onConflict: 'final_session_id,teacher_email' });
      if (judgeErr) throw judgeErr;
    }

    return NextResponse.json({ data: data || [], inserted: data?.length || 0 }, { status: 201 });
  } catch (err) {
    return authErrorResponse(err);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAdmin(request);
    const { id } = await params;
    const body = await request.json();
    const {
      sessionId,
      requestId,
      teacherId,
      teacherName,
      teacherEmail,
    } = body || {};

    if (!sessionId || !teacherId || !teacherName) {
      return NextResponse.json({ error: 'sessionId, teacherId, teacherName are required' }, { status: 400 });
    }

    const { data: finalSession, error: sessionErr } = await supabaseAdmin
      .from('final_sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('batch_id', id)
      .maybeSingle();

    if (sessionErr) throw sessionErr;
    if (!finalSession) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

    let approvedRequestId = requestId as string | undefined;

    if (!approvedRequestId) {
      const { data: existingRequest, error: existingErr } = await supabaseAdmin
        .from('judge_requests')
        .select('id')
        .eq('final_session_id', sessionId)
        .eq('teacher_id', teacherId)
        .maybeSingle();
      if (existingErr) throw existingErr;
      approvedRequestId = existingRequest?.id;
    }

    if (!approvedRequestId) {
      const { data: existingRequest, error: existingErr } = await supabaseAdmin
        .from('judge_requests')
        .select('id')
        .eq('final_session_id', sessionId)
        .eq('teacher_email', teacherEmail || user.email)
        .maybeSingle();
      if (existingErr) throw existingErr;
      approvedRequestId = existingRequest?.id;
    }

    if (approvedRequestId) {
      const { error } = await supabaseAdmin
        .from('judge_requests')
        .update({
          status: 'approved',
          teacher_id: teacherId,
          teacher_name: teacherName,
          teacher_email: teacherEmail || user.email,
          updated_at: new Date().toISOString(),
        })
        .eq('id', approvedRequestId)
        .eq('final_session_id', sessionId);
      if (error) throw error;
    } else {
      const { data, error } = await supabaseAdmin
        .from('judge_requests')
        .insert({
          final_session_id: sessionId,
          teacher_email: teacherEmail || user.email,
          teacher_name: teacherName,
          teacher_id: teacherId,
          status: 'approved',
        })
        .select('id')
        .single();
      if (error) throw error;
      approvedRequestId = data.id;
    }

    const { error: rejectErr } = await supabaseAdmin
      .from('judge_requests')
      .update({
        status: 'rejected',
        rejection_reason: 'Đã chọn giám khảo khác',
        updated_at: new Date().toISOString(),
      })
      .eq('final_session_id', sessionId)
      .neq('id', approvedRequestId)
      .eq('status', 'pending');

    if (rejectErr) throw rejectErr;

    const { data, error: fetchErr } = await supabaseAdmin
      .from('final_sessions')
      .select('*, judge_requests(*)')
      .eq('id', sessionId)
      .single();

    if (fetchErr) throw fetchErr;
    return NextResponse.json({ data });
  } catch (err) {
    return authErrorResponse(err);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(request);
    const { id } = await params;
    const sessionId = request.nextUrl.searchParams.get('sessionId');
    if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 });

    const { error } = await supabaseAdmin
      .from('final_sessions')
      .delete()
      .eq('id', sessionId)
      .eq('batch_id', id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    return authErrorResponse(err);
  }
}
