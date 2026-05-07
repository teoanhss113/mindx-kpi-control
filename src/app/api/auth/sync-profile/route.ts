import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  extractBearer,
  verifyFirebaseIdToken,
  authErrorResponse,
  AuthError,
} from '@/lib/auth/serverAuth';

/**
 * Sync user profile from Firebase to Supabase.
 * The caller MUST present a valid Firebase ID token whose uid+email match
 * the body — otherwise anyone could rewrite or delete other people's profiles.
 */
export async function POST(request: NextRequest) {
  try {
    const idToken = extractBearer(request);
    const verified = await verifyFirebaseIdToken(idToken);

    const body = await request.json().catch(() => ({}));
    const uid = String(body?.uid || '').trim();
    const email = String(body?.email || '').trim().toLowerCase();

    if (!uid || !email) {
      return NextResponse.json(
        { error: 'uid and email are required' },
        { status: 400 }
      );
    }

    if (uid !== verified.uid || email !== verified.email) {
      throw new AuthError('Token does not match request body', 403);
    }

    // 1. Profile already exists with this UID
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .single();

    if (existingProfile) {
      return NextResponse.json({
        success: true,
        action: 'found',
        profile: existingProfile,
      });
    }

    // 2. A profile with this email exists (created with a temporary id) —
    //    rebind it to the verified Firebase UID. Use a single UPDATE; do NOT
    //    delete-then-recreate, which previously allowed cross-user takeover.
    const { data: profileByEmail } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('email', email)
      .single();

    if (profileByEmail) {
      const { data: updatedProfile, error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({ id: uid })
        .eq('email', email)
        .select()
        .single();

      if (updateError) {
        return NextResponse.json(
          { error: 'Failed to rebind profile' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        action: 'updated',
        profile: updatedProfile,
      });
    }

    // 3. No profile exists yet — create one with no role.
    const { data: newProfile, error: createError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: uid,
        email,
        role_id: null,
        is_active: true,
      })
      .select()
      .single();

    if (createError) {
      return NextResponse.json(
        { error: 'Failed to create profile' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      action: 'created',
      profile: newProfile,
      warning: 'No role assigned. Please contact admin to assign a role.',
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return NextResponse.json(
      { error: 'Internal error' },
      { status: 500 }
    );
  }
}
