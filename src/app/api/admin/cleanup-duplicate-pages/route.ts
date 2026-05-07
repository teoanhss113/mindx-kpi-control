import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireAdmin, authErrorResponse, AuthError } from '@/lib/auth/serverAuth';

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);

    const { error } = await supabaseAdmin
      .from('pages')
      .delete()
      .eq('key', 'completion-rate');

    if (error) {
      return NextResponse.json(
        { success: false, error: 'Operation failed' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Duplicate page removed successfully',
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return NextResponse.json(
      { success: false, error: 'Internal error' },
      { status: 500 }
    );
  }
}
