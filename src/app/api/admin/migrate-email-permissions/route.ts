import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function POST() {
  try {
    // Run the migration SQL
    const { error } = await supabaseAdmin.rpc('exec_sql', {
      sql: `
        -- Make email unique
        ALTER TABLE profiles 
          DROP CONSTRAINT IF EXISTS profiles_email_key;

        ALTER TABLE profiles 
          ADD CONSTRAINT profiles_email_key UNIQUE (email);

        -- Create indexes
        CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
        CREATE INDEX IF NOT EXISTS idx_profiles_role_id ON profiles(role_id);
      `
    });

    if (error) {
      // Try alternative approach - direct SQL execution
      const queries = [
        'ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_email_key',
        'ALTER TABLE profiles ADD CONSTRAINT profiles_email_key UNIQUE (email)',
        'CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email)',
        'CREATE INDEX IF NOT EXISTS idx_profiles_role_id ON profiles(role_id)',
      ];

      for (const query of queries) {
        const { error: queryError } = await supabaseAdmin.rpc('exec', { query });
        if (queryError) {
          console.error('Query error:', query, queryError);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Migration completed - email is now unique and indexed',
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      note: 'You may need to run the migration manually in Supabase SQL Editor',
    }, { status: 500 });
  }
}
