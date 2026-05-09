import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const { data: batch, error: bErr } = await supabaseAdmin
      .from('judge_batches')
      .select('*')
      .eq('slug', slug)
      .single();

    if (bErr || !batch) {
      return NextResponse.json({ error: 'Batch not found', bErr }, { status: 404 });
    }

    return NextResponse.json({ data: batch });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
