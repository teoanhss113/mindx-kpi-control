import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireAdmin, authErrorResponse, AuthError } from '@/lib/auth/serverAuth';

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);

    const { error } = await supabaseAdmin.rpc('exec_sql', {
      sql: `
        ALTER TABLE profiles
          DROP CONSTRAINT IF EXISTS profiles_email_key;

        ALTER TABLE profiles
          ADD CONSTRAINT profiles_email_key UNIQUE (email);

        CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
        CREATE INDEX IF NOT EXISTS idx_profiles_role_id ON profiles(role_id);
      `,
    });

    if (error) {
      return NextResponse.json(
        {
          success: false,
          error: 'Migration failed',
          note: 'Run the migration manually in the Supabase SQL Editor',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Migration completed',
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return NextResponse.json(
      { success: false, error: 'Internal error' },
      { status: 500 }
    );
  }
}
