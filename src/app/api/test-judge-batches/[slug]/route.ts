import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireAdmin, authErrorResponse } from '@/lib/auth/serverAuth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    await requireAdmin(request);
    const { slug } = await params;
    const { data: batch, error: bErr } = await supabaseAdmin
      .from('judge_batches')
      .select('*')
      .eq('slug', slug)
      .single();

    if (bErr || !batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
    }

    return NextResponse.json({ data: batch });
  } catch (err) {
    return authErrorResponse(err);
  }
}
