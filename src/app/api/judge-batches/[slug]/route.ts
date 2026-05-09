/**
 * GET /api/judge-batches/[slug]
 * Returns batch info + all sessions + the calling teacher's requests.
 * Any authenticated user can call this (link-based access).
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { extractBearer, verifyFirebaseIdToken, authErrorResponse } from '@/lib/auth/serverAuth';

interface JudgeRequestRow {
  final_session_id: string;
  teacher_name?: string | null;
  teacher_email: string;
  teacher_id?: string | null;
  status: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    // Only verify the Firebase token — no Supabase profile lookup needed.
    // This page is link-based: any authenticated Firebase user (teacher) can access it.
    const idToken = extractBearer(request);
    const { email } = await verifyFirebaseIdToken(idToken);
    const { slug } = await params;

    const { data: batch, error: bErr } = await supabaseAdmin
      .from('judge_batches')
      .select('*')
      .eq('slug', slug)
      .single();

    if (bErr || !batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
    }

    // All sessions in this batch
    const { data: sessions, error: sErr } = await supabaseAdmin
      .from('final_sessions')
      .select('*')
      .eq('batch_id', batch.id)
      .order('session_date', { ascending: true })
      .order('start_time_utc', { ascending: true });

    if (sErr) throw sErr;

    // This teacher's requests for sessions in this batch
    const sessionIds = (sessions || []).map(s => s.id);
    let myRequests: JudgeRequestRow[] = [];
    let approvedRequests: JudgeRequestRow[] = [];
    if (sessionIds.length > 0) {
      const { data: reqs } = await supabaseAdmin
        .from('judge_requests')
        .select('*')
        .eq('teacher_email', email)
        .in('final_session_id', sessionIds);
      myRequests = reqs || [];

      const { data: approvedReqs } = await supabaseAdmin
        .from('judge_requests')
        .select('final_session_id, teacher_name, teacher_email, teacher_id, status')
        .eq('status', 'approved')
        .in('final_session_id', sessionIds);
      approvedRequests = approvedReqs || [];
    }

    const myRequestMap = Object.fromEntries(myRequests.map(r => [r.final_session_id, r]));
    const approvedRequestMap = Object.fromEntries(approvedRequests.map(r => [r.final_session_id, r]));

    const enrichedSessions = (sessions || []).map(s => ({
      ...s,
      myRequest: myRequestMap[s.id] || null,
      approvedJudge: approvedRequestMap[s.id] || null,
    }));

    return NextResponse.json({ data: { ...batch, sessions: enrichedSessions } });
  } catch (err) {
    return authErrorResponse(err);
  }
}
