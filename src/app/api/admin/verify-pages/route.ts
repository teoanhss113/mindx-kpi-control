import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireAdmin, authErrorResponse, AuthError } from '@/lib/auth/serverAuth';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);

    const { data: pages, error } = await supabaseAdmin
      .from('pages')
      .select('*')
      .order('display_order');

    if (error) throw error;

    return NextResponse.json({
      success: true,
      pages,
      count: pages?.length || 0,
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return NextResponse.json(
      { success: false, error: 'Operation failed' },
      { status: 500 }
    );
  }
}
