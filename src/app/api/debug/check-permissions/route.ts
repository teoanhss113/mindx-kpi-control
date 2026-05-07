import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireUser, authErrorResponse, AuthError } from '@/lib/auth/serverAuth';

/**
 * Debug endpoint: returns the caller's own profile + permissions.
 * Admins may query other users by passing ?userId=<uid>.
 */
export async function GET(request: NextRequest) {
  try {
    const caller = await requireUser(request);

    const requestedUserId = request.nextUrl.searchParams.get('userId') || caller.uid;
    if (requestedUserId !== caller.uid && !caller.isAdmin) {
      throw new AuthError('Cannot read another user\'s permissions', 403);
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', requestedUserId)
      .single();

    if (profileError) {
      return NextResponse.json(
        { error: 'Profile not found', userId: requestedUserId },
        { status: 404 }
      );
    }

    const { data: role } = await supabaseAdmin
      .from('roles')
      .select('*')
      .eq('id', profile.role_id)
      .single();

    const { data: permissions } = await supabaseAdmin
      .from('role_permissions')
      .select(`*, pages (*)`)
      .eq('role_id', profile.role_id);

    return NextResponse.json({
      success: true,
      userId: requestedUserId,
      profile,
      role: role || null,
      permissions: permissions || [],
      summary: {
        hasProfile: !!profile,
        hasRole: !!role,
        permissionCount: permissions?.length || 0,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return NextResponse.json(
      { error: 'Internal error' },
      { status: 500 }
    );
  }
}
