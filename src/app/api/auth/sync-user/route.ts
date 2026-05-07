import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  extractBearer,
  verifyFirebaseIdToken,
  authErrorResponse,
  AuthError,
} from '@/lib/auth/serverAuth';

/**
 * Sync Firebase user to Supabase profiles table.
 * Caller must present a Firebase ID token whose uid+email match the body.
 */
export async function POST(request: NextRequest) {
  try {
    const idToken = extractBearer(request);
    const verified = await verifyFirebaseIdToken(idToken);

    const body = await request.json().catch(() => ({}));
    const uid = String(body?.uid || '').trim();
    const email = String(body?.email || '').trim().toLowerCase();
    const { displayName, photoURL } = body || {};

    if (!uid || !email) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: uid, email' },
        { status: 400 }
      );
    }

    if (uid !== verified.uid || email !== verified.email) {
      throw new AuthError('Token does not match request body', 403);
    }

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: uid,
        email,
        display_name: displayName || null,
        photo_url: photoURL || null,
        last_login_at: new Date().toISOString(),
      }, {
        onConflict: 'id',
        ignoreDuplicates: false,
      })
      .select(`
        *,
        roles (id, name, description)
      `)
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: {
        id: data.id,
        email: data.email,
        role: data.roles?.name || null,
        is_active: data.is_active,
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
 * Get the caller's own profile and permissions.
 * The `uid` query param must match the Firebase token uid.
 */
export async function GET(request: NextRequest) {
  try {
    const idToken = extractBearer(request);
    const verified = await verifyFirebaseIdToken(idToken);

    const uid = request.nextUrl.searchParams.get('uid');
    if (!uid) {
      return NextResponse.json(
        { success: false, error: 'Missing uid parameter' },
        { status: 400 }
      );
    }

    if (uid !== verified.uid) {
      throw new AuthError('Cannot read another user\'s profile', 403);
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
      .eq('id', uid)
      .single();

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
      .eq('user_id', uid);

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
