/**
 * GET  /api/admin/judge-batches          → list all batches (with session + request counts)
 * POST /api/admin/judge-batches          → create a new batch
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requirePagePermission, authErrorResponse } from '@/lib/auth/serverAuth';

const PAGE_KEY = 'final-sessions';

export async function GET(request: NextRequest) {
  try {
    await requirePagePermission(request, PAGE_KEY, 'view');

    // Simpler approach — separate count queries are more reliable
    const { data: batches, error: bErr } = await supabaseAdmin
      .from('judge_batches')
      .select('*')
      .order('week_from', { ascending: false });

    if (bErr) throw bErr;

    // Get session counts per batch
    const { data: sessionCounts } = await supabaseAdmin
      .from('final_sessions')
      .select('batch_id');

    const sessionCountMap: Record<string, number> = {};
    for (const s of sessionCounts || []) {
      sessionCountMap[s.batch_id] = (sessionCountMap[s.batch_id] || 0) + 1;
    }

    // Get request counts per batch (join through final_sessions)
    const batchIds = (batches || []).map(b => b.id);
    const requestCountMap: Record<string, number> = {};
    if (batchIds.length > 0) {
      const { data: sessions } = await supabaseAdmin
        .from('final_sessions')
        .select('id, batch_id')
        .in('batch_id', batchIds);

      if (sessions?.length) {
        const sessionIds = sessions.map(s => s.id);
        const sessionBatchMap = Object.fromEntries(sessions.map(s => [s.id, s.batch_id]));
        const { data: requests } = await supabaseAdmin
          .from('judge_requests')
          .select('final_session_id')
          .in('final_session_id', sessionIds);

        for (const r of requests || []) {
          const bId = sessionBatchMap[r.final_session_id];
          if (bId) requestCountMap[bId] = (requestCountMap[bId] || 0) + 1;
        }
      }
    }

    const enriched = (batches || []).map(b => ({
      ...b,
      session_count: sessionCountMap[b.id] || 0,
      request_count: requestCountMap[b.id] || 0,
    }));

    return NextResponse.json({ data: enriched });
  } catch (err) {
    return authErrorResponse(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requirePagePermission(request, PAGE_KEY, 'edit');
    const body = await request.json();
    const { slug, title, week_from, week_to, notes, is_public } = body;

    if (!slug || !title || !week_from || !week_to) {
      return NextResponse.json({ error: 'slug, title, week_from, week_to are required' }, { status: 400 });
    }

    if (!/^[a-z0-9-]+$/.test(slug) || slug.length > 80) {
      return NextResponse.json({ error: 'Slug chỉ được chứa chữ thường, số, dấu gạch ngang, tối đa 80 ký tự' }, { status: 400 });
    }
    if (typeof title !== 'string' || title.length > 200) {
      return NextResponse.json({ error: 'Title tối đa 200 ký tự' }, { status: 400 });
    }
    if (notes !== undefined && notes !== null && (typeof notes !== 'string' || notes.length > 2000)) {
      return NextResponse.json({ error: 'Notes tối đa 2000 ký tự' }, { status: 400 });
    }
    const weekFromDate = new Date(week_from);
    const weekToDate = new Date(week_to);
    if (isNaN(weekFromDate.getTime()) || isNaN(weekToDate.getTime())) {
      return NextResponse.json({ error: 'week_from và week_to phải là ngày hợp lệ' }, { status: 400 });
    }
    if (weekFromDate > weekToDate) {
      return NextResponse.json({ error: 'week_from phải trước week_to' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('judge_batches')
      .insert({ slug, title, week_from, week_to, notes: notes || null, is_public: is_public === true, created_by: user.email })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'Slug đã tồn tại' }, { status: 409 });
      throw error;
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (err) {
    return authErrorResponse(err);
  }
}
