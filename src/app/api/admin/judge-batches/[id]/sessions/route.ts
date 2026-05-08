/**
 * GET    /api/admin/judge-batches/[id]/sessions   → list sessions in batch
 * POST   /api/admin/judge-batches/[id]/sessions   → bulk-add sessions from LMS data
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

    const rows = sessions.map(s => ({ ...s, batch_id: id }));

    // Upsert: skip duplicates (same batch + lms_slot_id)
    const { data, error } = await supabaseAdmin
      .from('final_sessions')
      .upsert(rows, { onConflict: 'batch_id,lms_slot_id', ignoreDuplicates: true })
      .select();

    if (error) throw error;
    return NextResponse.json({ data: data || [], inserted: data?.length || 0 }, { status: 201 });
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
