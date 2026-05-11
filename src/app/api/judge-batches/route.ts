/**
 * GET /api/judge-batches
 * Lists all active + public judge batches for any authenticated active user.
 * Used by /judge-requests page to show batches without needing a shared link.
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { extractBearer, verifyFirebaseIdToken, authErrorResponse, AuthError } from '@/lib/auth/serverAuth';

export async function GET(request: NextRequest) {
  try {
    const idToken = extractBearer(request);
    const { uid, email } = await verifyFirebaseIdToken(idToken);

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, is_active')
      .or(`id.eq.${uid},email.eq.${email}`)
      .maybeSingle();

    if (!profile || !profile.is_active) {
      throw new AuthError('Access denied', 403);
    }

    const { data: batches, error } = await supabaseAdmin
      .from('judge_batches')
      .select('id, slug, title, week_from, week_to, notes, is_active, is_public')
      .eq('is_active', true)
      .eq('is_public', true)
      .order('week_from', { ascending: false });

    if (error) throw error;

    const batchIds = (batches || []).map(b => b.id);
    const sessionCountMap: Record<string, number> = {};

    if (batchIds.length > 0) {
      const { data: sessions } = await supabaseAdmin
        .from('final_sessions')
        .select('batch_id')
        .in('batch_id', batchIds);

      for (const s of sessions || []) {
        sessionCountMap[s.batch_id] = (sessionCountMap[s.batch_id] || 0) + 1;
      }
    }

    const enriched = (batches || []).map(b => ({
      ...b,
      session_count: sessionCountMap[b.id] || 0,
    }));

    return NextResponse.json({ data: enriched });
  } catch (err) {
    return authErrorResponse(err);
  }
}
