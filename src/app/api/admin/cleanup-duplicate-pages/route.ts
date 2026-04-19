import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function POST() {
  try {
    console.log('[cleanup-duplicate-pages] Starting cleanup...');

    // Delete the old 'completion-rate' key (we use 'completion' now)
    const { error } = await supabaseAdmin
      .from('pages')
      .delete()
      .eq('key', 'completion-rate');

    if (error) {
      console.error('[cleanup-duplicate-pages] Error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    console.log('[cleanup-duplicate-pages] ✅ Deleted duplicate page: completion-rate');

    return NextResponse.json({
      success: true,
      message: 'Duplicate page removed successfully',
    });
  } catch (error: any) {
    console.error('[cleanup-duplicate-pages] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
