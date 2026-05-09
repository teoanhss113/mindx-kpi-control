import { supabaseAdmin } from './src/lib/supabase/admin';
import { readFileSync } from 'fs';
import { join } from 'path';

async function run() {
  const sql = readFileSync(join(process.cwd(), 'supabase/migrations/014_judge_batches.sql'), 'utf8');
  
  // Send the entire SQL text if exec_sql supports it, or split if needed
  const { data, error } = await supabaseAdmin.rpc('exec_sql', { sql_query: sql });
  console.log('Result:', data, error);
}

run();
