/**
 * POST   /api/judge-requests              → teacher submits a request
 * DELETE /api/judge-requests?sessionId=<uuid>  → teacher cancels a pending request
 * GET    /api/judge-requests?batchSlug=<slug>   → teacher's own requests for a batch
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireUser, authErrorResponse } from '@/lib/auth/serverAuth';
import { notifyUsers, getAdminEmailsForPage, NotifyTemplates } from '@/lib/notificationService';

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const { finalSessionId, teacherName, teacherId, requestNote } = await request.json();

    if (!finalSessionId) {
      return NextResponse.json({ error: 'finalSessionId is required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('judge_requests')
      .insert({
        final_session_id: finalSessionId,
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

    // Fetch session info for notification
    const { data: sessionData } = await supabaseAdmin
      .from('final_sessions')
      .select('class_name, centre_name')
      .eq('id', finalSessionId)
      .maybeSingle();

    // Notify admins who manage final-sessions
    void (async () => {
      try {
        const adminEmails = await getAdminEmailsForPage('final-sessions');
        await notifyUsers({
          userEmails: adminEmails,
          ...NotifyTemplates.judgeRequested(
            teacherName || user.email,
            { className: sessionData?.class_name, centreName: sessionData?.centre_name }
          ),
        });
      } catch (e) {
        console.error('[judge-requests POST] Notification error:', e);
      }
    })();

    return NextResponse.json({ data }, { status: 201 });
  } catch (err) {
    return authErrorResponse(err);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const sessionId = request.nextUrl.searchParams.get('sessionId');
    if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 });

    const { error } = await supabaseAdmin
      .from('judge_requests')
      .delete()
      .eq('final_session_id', sessionId)
      .eq('teacher_email', user.email)
      .eq('status', 'pending');

    if (error) throw error;

    // Fetch session info for notification
    const { data: sessionData } = await supabaseAdmin
      .from('final_sessions')
      .select('class_name, centre_name')
      .eq('id', sessionId)
      .maybeSingle();

    // Notify admins of cancellation
    void (async () => {
      try {
        const adminEmails = await getAdminEmailsForPage('final-sessions');
        await notifyUsers({
          userEmails: adminEmails,
          ...NotifyTemplates.judgeCancelled(
            user.email,
            { className: sessionData?.class_name, centreName: sessionData?.centre_name }
          ),
        });
      } catch (e) {
        console.error('[judge-requests DELETE] Notification error:', e);
      }
    })();

    return NextResponse.json({ success: true });
  } catch (err) {
    return authErrorResponse(err);
  }
}
