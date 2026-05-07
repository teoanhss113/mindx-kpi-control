import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireAdmin, authErrorResponse, AuthError } from '@/lib/auth/serverAuth';

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);

    const { error: permError } = await supabaseAdmin
      .from('role_permissions')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (permError) throw permError;

    const { error: roleError } = await supabaseAdmin
      .from('roles')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (roleError) throw roleError;

    const { count: roleCount } = await supabaseAdmin
      .from('roles')
      .select('*', { count: 'exact', head: true });

    const { count: permCount } = await supabaseAdmin
      .from('role_permissions')
      .select('*', { count: 'exact', head: true });

    return NextResponse.json({
      success: true,
      message: 'Successfully deleted all roles and permissions',
      data: {
        roles_deleted: roleCount === 0,
        permissions_deleted: permCount === 0,
        roles_remaining: roleCount,
        permissions_remaining: permCount,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return NextResponse.json(
      { success: false, error: 'Operation failed' },
      { status: 500 }
    );
  }
}
