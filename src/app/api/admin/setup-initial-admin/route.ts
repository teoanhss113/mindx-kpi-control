import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireAdmin, authErrorResponse, AuthError } from '@/lib/auth/serverAuth';

/**
 * Setup initial admin account.
 * Bootstrap-only: allowed without auth ONLY when no Admin role+user exists yet.
 * Once an admin exists, the endpoint requires admin authentication.
 */
async function adminAlreadyConfigured(): Promise<boolean> {
  const { data: adminRole } = await supabaseAdmin
    .from('roles')
    .select('id')
    .eq('name', 'Admin')
    .maybeSingle();
  if (!adminRole) return false;

  const { count } = await supabaseAdmin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('role_id', adminRole.id)
    .eq('is_active', true);
  return (count || 0) > 0;
}

export async function POST(request: NextRequest) {
  try {
    if (await adminAlreadyConfigured()) {
      await requireAdmin(request);
    }

    // Step 1: Get all pages
    const { data: pages, error: pagesError } = await supabaseAdmin
      .from('pages')
      .select('id, page_name, key');

    if (pagesError) throw pagesError;

    console.log(`[setup-initial-admin] Found ${pages.length} pages`);

    // Step 2: Create Admin role
    let adminRole: any;
    const { data: newRole, error: roleError } = await supabaseAdmin
      .from('roles')
      .insert({
        name: 'Admin',
        description: 'Quản trị viên hệ thống - Toàn quyền',
        is_system_role: true,
        is_active: true,
      })
      .select()
      .single();

    if (roleError) {
      // Check if role already exists
      if (roleError.code === '23505') {
        console.log('[setup-initial-admin] Admin role already exists, fetching...');
        const { data: existingRole } = await supabaseAdmin
          .from('roles')
          .select('*')
          .eq('name', 'Admin')
          .single();
        
        if (existingRole) {
          console.log('[setup-initial-admin] Using existing Admin role');
          adminRole = existingRole;
        } else {
          throw roleError;
        }
      } else {
        throw roleError;
      }
    } else {
      adminRole = newRole;
      console.log('[setup-initial-admin] ✅ Created Admin role');
    }

    // Step 3: Create role permissions (all pages with view + edit)
    const permissions = pages.map(page => ({
      role_id: adminRole.id,
      page_id: page.id,
      can_view: true,
      can_edit: true,
    }));

    // Delete existing permissions for this role first
    await supabaseAdmin
      .from('role_permissions')
      .delete()
      .eq('role_id', adminRole.id);

    const { error: permError } = await supabaseAdmin
      .from('role_permissions')
      .insert(permissions);

    if (permError) throw permError;

    console.log(`[setup-initial-admin] ✅ Created ${permissions.length} permissions`);

    // Step 4: Create admin user profile
    const adminEmail = 'anhpnh@mindx.com.vn';
    
    const { data: adminUser, error: userError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: 'admin-anhpnh', // Temporary ID - will be replaced by Firebase UID
        email: adminEmail,
        display_name: 'Anh Phan',
        role_id: adminRole.id,
        is_active: true,
      }, {
        onConflict: 'email',
        ignoreDuplicates: false,
      })
      .select()
      .single();

    if (userError) throw userError;

    console.log('[setup-initial-admin] ✅ Created admin user');

    // Step 5: Verify setup
    const { data: verifyRole } = await supabaseAdmin
      .from('roles')
      .select(`
        *,
        role_permissions (
          id,
          can_view,
          can_edit,
          pages (page_name, key)
        )
      `)
      .eq('id', adminRole.id)
      .single();

    const { data: verifyUser } = await supabaseAdmin
      .from('profiles')
      .select(`
        *,
        roles (name, description)
      `)
      .eq('email', adminEmail)
      .single();

    return NextResponse.json({
      success: true,
      message: 'Initial admin setup completed successfully',
      data: {
        role: {
          id: verifyRole.id,
          name: verifyRole.name,
          permissions_count: verifyRole.role_permissions.length,
          pages: verifyRole.role_permissions.map((p: any) => p.pages.page_name),
        },
        user: {
          id: verifyUser.id,
          email: verifyUser.email,
          display_name: verifyUser.display_name,
          role: verifyUser.roles.name,
          is_active: verifyUser.is_active,
        },
      },
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('[setup-initial-admin] Error');
    return NextResponse.json(
      { success: false, error: 'Setup failed' },
      { status: 500 }
    );
  }
}

/**
 * Get current admin setup status.
 * Once an admin is configured, requires admin auth.
 */
export async function GET(request: NextRequest) {
  try {
    if (await adminAlreadyConfigured()) {
      await requireAdmin(request);
    }
    // Check if Admin role exists
    const { data: adminRole } = await supabaseAdmin
      .from('roles')
      .select(`
        *,
        role_permissions (count)
      `)
      .eq('name', 'Admin')
      .single();

    // Check if admin user exists
    const { data: adminUser } = await supabaseAdmin
      .from('profiles')
      .select(`
        *,
        roles (name)
      `)
      .eq('email', 'anhpnh@mindx.com.vn')
      .single();

    return NextResponse.json({
      success: true,
      data: {
        admin_role_exists: !!adminRole,
        admin_role_permissions: adminRole?.role_permissions?.[0]?.count || 0,
        admin_user_exists: !!adminUser,
        admin_user_active: adminUser?.is_active || false,
        setup_complete: !!adminRole && !!adminUser,
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
