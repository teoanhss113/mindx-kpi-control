import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * Sync Firebase user to Supabase profiles table
 * Called after successful Firebase authentication
 */
export async function POST(request: NextRequest) {
  try {
    const { uid, email, displayName, photoURL } = await request.json();

    if (!uid || !email) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: uid, email' },
        { status: 400 }
      );
    }

    // Upsert user to Supabase profiles
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: uid, // Firebase UID
        email,
        display_name: displayName || null,
        photo_url: photoURL || null,
        last_login_at: new Date().toISOString(),
        // role_id will be assigned by admin later
        // is_active defaults to true
      }, {
        onConflict: 'id',
        ignoreDuplicates: false,
      })
      .select(`
        *,
        roles (id, name, description)
      `)
      .single();

    if (error) {
      console.error('[sync-user] Supabase error:', error);
      throw error;
    }

    console.log('[sync-user] User synced successfully:', data.email);

    return NextResponse.json({ 
      success: true, 
      data: {
        id: data.id,
        email: data.email,
        role: data.roles?.name || null,
        is_active: data.is_active,
      }
    });
  } catch (error: any) {
    console.error('[sync-user] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * Get user profile and permissions
 * Called to check user access rights
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const uid = searchParams.get('uid');

    if (!uid) {
      return NextResponse.json(
        { success: false, error: 'Missing uid parameter' },
        { status: 400 }
      );
    }

    // Get user profile with role and permissions
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
            pages (
              id,
              page_name,
              key,
              path
            )
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

    // Get user-specific permissions (regions + courses)
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
  } catch (error: any) {
    console.error('[sync-user GET] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
