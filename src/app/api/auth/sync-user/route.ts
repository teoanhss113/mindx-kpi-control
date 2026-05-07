import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  extractBearer,
  verifyFirebaseIdToken,
  authErrorResponse,
  AuthError,
} from '@/lib/auth/serverAuth';

/**
 * POST — Update last_login_at for the authenticated user.
 * Uses email from the verified Firebase token as the lookup key.
 */
export async function POST(request: NextRequest) {
  try {
    const idToken = extractBearer(request);
    const verified = await verifyFirebaseIdToken(idToken);

    const body = await request.json().catch(() => ({}));
    const { displayName, photoURL } = body || {};

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update({
        display_name: displayName || null,
        photo_url: photoURL || null,
        last_login_at: new Date().toISOString(),
      })
      .eq('email', verified.email)
      .select(`*, roles (id, name, description)`)
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: {
        email: verified.email,
        role: data?.roles?.name || null,
        is_active: data?.is_active,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return NextResponse.json(
      { success: false, error: 'Internal error' },
      { status: 500 }
    );
  }
}

/**
 * GET — Return the caller's profile and role permissions.
 * Uses email from the verified Firebase token — no UID matching needed.
 */
export async function GET(request: NextRequest) {
  try {
    const idToken = extractBearer(request);
    const verified = await verifyFirebaseIdToken(idToken);

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select(`
        *,
        roles (
          id,
          name,
          description,
          role_permissions (
            page_id,
            can_view,
            can_edit,
            pages ( id, page_name, key, path )
          )
        )
      `)
      .eq('email', verified.email)
      .maybeSingle();

    if (profileError) throw profileError;

    if (!profile) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const { data: userPermissions, error: permError } = await supabaseAdmin
      .from('user_permissions')
      .select(`
        *,
        regions (
          id,
          name,
          region_centres (
            centre_id,
            centre_name,
            centre_short_name
          )
        )
      `)
      .eq('user_id', profile.id);

    if (permError) throw permError;

    return NextResponse.json({
      success: true,
      data: {
        profile,
        permissions: userPermissions || [],
      },
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return NextResponse.json(
      { success: false, error: 'Internal error' },
      { status: 500 }
    );
  }
}
