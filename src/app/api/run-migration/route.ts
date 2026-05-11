/**
 * API Route to run database migration
 * Access: http://localhost:3000/api/run-migration
 */

import { NextRequest, NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';
import { requireAdmin, authErrorResponse, AuthError } from '@/lib/auth/serverAuth';

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    await requireAdmin(request);

    const migrationPath = join(process.cwd(), 'supabase/migrations/011_office_hours_teacher_confirmation.sql');
    const sql = readFileSync(migrationPath, 'utf8');

    // Import supabase admin
    const { supabaseAdmin } = await import('@/lib/supabase/admin');

    // Split SQL into statements
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.match(/^\s*$/));

    const results = [];

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      try {
        // Execute each statement
        const { data, error } = await supabaseAdmin.rpc('exec_sql', { 
          sql_query: statement 
        });

        if (error) {
          results.push({
            index: i + 1,
            success: false,
            error: error.message,
            statement: statement.substring(0, 100) + '...'
          });
        } else {
          results.push({
            index: i + 1,
            success: true,
            statement: statement.substring(0, 100) + '...'
          });
        }
      } catch (err: any) {
        results.push({
          index: i + 1,
          success: false,
          error: err.message,
          statement: statement.substring(0, 100) + '...'
        });
      }
    }

    // Verify table creation
    const { data: testData, error: testError } = await supabaseAdmin
      .from('teacher_office_hour_confirmations')
      .select('*')
      .limit(1);

    const tableExists = !testError;

    return NextResponse.json({
      success: tableExists,
      tableExists,
      results,
      message: tableExists 
        ? '✅ Migration completed successfully!' 
        : '⚠️ Migration ran but table verification failed. Please check Supabase dashboard.',
    });

  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return NextResponse.json({
      success: false,
      error: 'Migration failed',
      message: '❌ Migration failed. Run SQL manually in Supabase dashboard.',
    }, { status: 500 });
  }
}
