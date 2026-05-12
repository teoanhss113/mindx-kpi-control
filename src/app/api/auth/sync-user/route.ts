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

    const email = verified.email?.trim().toLowerCase();
    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email not found in token' },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { displayName, photoURL } = body || {};
    const updates: Record<string, string | null> = {
      last_login_at: new Date().toISOString(),
    };

    if (displayName !== undefined) updates.display_name = displayName || null;
    if (photoURL !== undefined) updates.photo_url = photoURL || null;

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update(updates)
      .eq('email', email)
      .select(`*, roles (id, name, description)`)
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: {
        email,
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

    const email = verified.email?.trim().toLowerCase();
    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email not found in token' },
        { status: 400 }
      );
    }

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
      .eq('email', email)
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
