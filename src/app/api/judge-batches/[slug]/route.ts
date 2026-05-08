/**
 * GET /api/judge-batches/[slug]
 * Returns batch info + all sessions + the calling teacher's requests.
 * Any authenticated user can call this (link-based access).
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireUser, authErrorResponse } from '@/lib/auth/serverAuth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const user = await requireUser(request);
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
    let myRequests: any[] = [];
    if (sessionIds.length > 0) {
      const { data: reqs } = await supabaseAdmin
        .from('judge_requests')
        .select('*')
        .eq('teacher_email', user.email)
        .in('final_session_id', sessionIds);
      myRequests = reqs || [];
    }

    const myRequestMap = Object.fromEntries(myRequests.map(r => [r.final_session_id, r]));

    const enrichedSessions = (sessions || []).map(s => ({
      ...s,
      myRequest: myRequestMap[s.id] || null,
    }));

    return NextResponse.json({ data: { ...batch, sessions: enrichedSessions } });
  } catch (err) {
    return authErrorResponse(err);
  }
}
