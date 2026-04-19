import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function GET() {
  try {
    const { data: pages, error } = await supabaseAdmin
      .from('pages')
      .select('*')
      .order('display_order');

    if (error) throw error;

    return NextResponse.json({
      success: true,
      pages: pages,
      count: pages?.length || 0,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// Standardized response format
// Standardized response format
// Standardized response format

// Standardized responses
