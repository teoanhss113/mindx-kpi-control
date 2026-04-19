import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * Delete all default roles and role_permissions
 * This is a one-time cleanup operation
 */
export async function POST() {
  try {
    console.log('[delete-default-roles] Starting deletion...');

    // Step 1: Delete all role_permissions first (due to foreign key)
    const { error: permError } = await supabaseAdmin
      .from('role_permissions')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (permError) {
      console.error('[delete-default-roles] Error deleting permissions:', permError);
      throw permError;
    }

    console.log('[delete-default-roles] ✅ Deleted all role_permissions');

    // Step 2: Delete all roles
    const { error: roleError } = await supabaseAdmin
      .from('roles')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (roleError) {
      console.error('[delete-default-roles] Error deleting roles:', roleError);
      throw roleError;
    }

    console.log('[delete-default-roles] ✅ Deleted all roles');

    // Step 3: Verify deletion
    const { count: roleCount } = await supabaseAdmin
      .from('roles')
      .select('*', { count: 'exact', head: true });

    const { count: permCount } = await supabaseAdmin
      .from('role_permissions')
      .select('*', { count: 'exact', head: true });

    console.log('[delete-default-roles] Verification:');
    console.log(`  - Roles remaining: ${roleCount}`);
    console.log(`  - Permissions remaining: ${permCount}`);

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
  } catch (error: any) {
    console.error('[delete-default-roles] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
