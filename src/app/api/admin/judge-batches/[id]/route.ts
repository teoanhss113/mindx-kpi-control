/**
 * GET    /api/admin/judge-batches/[id]   → batch detail with sessions
 * PATCH  /api/admin/judge-batches/[id]   → update title / is_active / notes
 * DELETE /api/admin/judge-batches/[id]   → delete batch (cascades sessions + requests)
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requirePagePermission, authErrorResponse } from '@/lib/auth/serverAuth';

const PAGE_KEY = 'final-sessions';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePagePermission(request, PAGE_KEY, 'view');
    const { id } = await params;

    const { data: batch, error: bErr } = await supabaseAdmin
      .from('judge_batches')
      .select('*')
      .eq('id', id)
      .single();

    if (bErr || !batch) return NextResponse.json({ error: 'Batch not found' }, { status: 404 });

    const { data: sessions, error: sErr } = await supabaseAdmin
      .from('final_sessions')
      .select('*, judge_requests(*)')
      .eq('batch_id', id)
      .order('session_date', { ascending: true })
      .order('start_time_utc', { ascending: true });

    if (sErr) throw sErr;

    return NextResponse.json({ data: { ...batch, sessions: sessions || [] } });
  } catch (err) {
    return authErrorResponse(err);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePagePermission(request, PAGE_KEY, 'edit');
    const { id } = await params;
    const body = await request.json();
    const allowed = ['title', 'slug', 'week_from', 'week_to', 'notes', 'is_active', 'is_public'];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body) updates[key] = body[key];
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('judge_batches')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'Slug đã tồn tại' }, { status: 409 });
      throw error;
    }
    return NextResponse.json({ data });
  } catch (err) {
    return authErrorResponse(err);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePagePermission(request, PAGE_KEY, 'edit');
    const { id } = await params;
    const { error } = await supabaseAdmin.from('judge_batches').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    return authErrorResponse(err);
  }
}
