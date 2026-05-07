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
 * Uses email (from verified Firebase token) as the stable identifier.
 * Firebase UID is only used for auth verification, not stored as PK.
 */
export async function POST(request: NextRequest) {
  try {
    const idToken = extractBearer(request);
    const verified = await verifyFirebaseIdToken(idToken);

    const email = verified.email;
    if (!email) {
      return NextResponse.json(
        { error: 'Email not found in token' },
        { status: 400 }
      );
    }

    // Look up profile by email (stable identifier across both systems)
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (existingProfile) {
      return NextResponse.json({
        success: true,
        action: 'found',
        profile: existingProfile,
      });
    }

    // No profile yet — create one with no role
    const { data: newProfile, error: createError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: crypto.randomUUID(),
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
