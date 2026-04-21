import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    // 1. Check if user exists in profiles
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileError) {
      return NextResponse.json({
        step: 'profile_lookup',
        error: profileError.message,
        userId,
      }, { status: 404 });
    }

    // 2. Get role details
    const { data: role, error: roleError } = await supabaseAdmin
      .from('roles')
      .select('*')
      .eq('id', profile.role_id)
      .single();

    // 3. Get all permissions for this role
    const { data: permissions, error: permissionsError } = await supabaseAdmin
      .from('role_permissions')
      .select(`
        *,
        pages (*)
      `)
      .eq('role_id', profile.role_id);

    return NextResponse.json({
      success: true,
      userId,
      profile,
      role: roleError ? null : role,
      roleError: roleError?.message,
      permissions: permissionsError ? [] : permissions,
      permissionsError: permissionsError?.message,
      summary: {
        hasProfile: !!profile,
        hasRole: !!role,
        permissionCount: permissions?.length || 0,
      }
    });
  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
      stack: error.stack,
    }, { status: 500 });
  }
}
