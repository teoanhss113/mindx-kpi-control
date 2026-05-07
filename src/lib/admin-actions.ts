'use server';

/**
 * Admin Actions
 * Server actions for admin CRUD operations.
 *
 * Every action requires a Firebase ID token whose holder has the Admin
 * role. The token is verified server-side via requireAdminToken before
 * any privileged supabaseAdmin call is made.
 */

import { supabaseAdmin } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { requireAdminToken, AuthError } from '@/lib/auth/serverAuth';

interface CreateUserData {
  email: string;
  role_id: string;
  is_active: boolean;
}

interface UpdateUserData {
  id: string;
  email: string;
  role_id: string;
  is_active: boolean;
}

interface CreateRoleData {
  name: string;
  description?: string;
  is_active: boolean;
  pagePermissions: Array<{
    pageId: string;
    canView: boolean;
    canEdit: boolean;
  }>;
}

interface UpdateRoleData extends CreateRoleData {
  id: string;
}

interface CreateRegionData {
  name: string;
  description?: string;
  is_active: boolean;
  selectedCentres: string[];
  centresData: Array<{ id: string; name: string; shortName: string }>;
}

interface UpdateRegionData extends CreateRegionData {
  id: string;
}

interface CreatePermissionData {
  user_id: string;
  region_id: string;
  courses: string[];
  can_view: boolean;
  can_edit: boolean;
  can_manage: boolean;
}

interface UpdatePermissionData extends CreatePermissionData {
  id: string;
}

type ActionResult<T = void> =
  | (T extends void ? { success: true } : { success: true; data: T })
  | { success: false; error: string; data?: T };

function failure(error: unknown): { success: false; error: string } {
  if (error instanceof AuthError) {
    return { success: false, error: error.message };
  }
  return { success: false, error: 'Operation failed' };
}

// =====================================================
// USER ACTIONS
// =====================================================

export async function getUsers(idToken: string) {
  try {
    await requireAdminToken(idToken);

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select(`*, roles (id, name, description)`)
      .not('role_id', 'is', null)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { success: true, data: (data || []) as any[] };
  } catch (error) {
    { const f = failure(error); return { success: false as const, error: f.error, data: [] }; }
  }
}

export async function getUnmanagedUsers(idToken: string) {
  try {
    await requireAdminToken(idToken);

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select(`id, email, is_active, created_at, last_login_at`)
      .is('role_id', null)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { success: true, data: (data || []) as any[] };
  } catch (error) {
    { const f = failure(error); return { success: false as const, error: f.error, data: [] }; }
  }
}

export async function createUser(idToken: string, userData: CreateUserData) {
  try {
    await requireAdminToken(idToken);

    const { error } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: crypto.randomUUID(),
        email: userData.email,
        role_id: userData.role_id,
        is_active: userData.is_active,
      });

    if (error) throw error;
    revalidatePath('/admin/users');
    return { success: true as const };
  } catch (error) {
    return failure(error);
  }
}

export async function updateUser(idToken: string, userData: UpdateUserData) {
  try {
    await requireAdminToken(idToken);

    const { error } = await supabaseAdmin
      .from('profiles')
      .update({
        role_id: userData.role_id,
        is_active: userData.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userData.id);

    if (error) throw error;
    revalidatePath('/admin/users');
    return { success: true as const };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteUser(idToken: string, userId: string) {
  try {
    await requireAdminToken(idToken);

    const { error } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', userId);

    if (error) throw error;
    revalidatePath('/admin/users');
    return { success: true as const };
  } catch (error) {
    return failure(error);
  }
}

// =====================================================
// REGION ACTIONS
// =====================================================

export async function getRegions(idToken: string) {
  try {
    await requireAdminToken(idToken);

    const { data, error } = await supabaseAdmin
      .from('regions')
      .select(`*, region_centres (*)`)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { success: true, data: (data as any[]) || [] };
  } catch (error) {
    { const f = failure(error); return { success: false as const, error: f.error, data: [] }; }
  }
}

export async function createRegion(idToken: string, regionData: CreateRegionData) {
  try {
    await requireAdminToken(idToken);

    const { data: newRegion, error: createError } = await supabaseAdmin
      .from('regions')
      .insert({
        name: regionData.name.trim(),
        description: regionData.description?.trim() || null,
        is_active: regionData.is_active,
      })
      .select()
      .single();

    if (createError) throw createError;

    const centresToInsert = regionData.selectedCentres.map(centreId => {
      const centre = regionData.centresData.find(c => c.id === centreId);
      return {
        region_id: newRegion.id,
        centre_id: centreId,
        centre_name: centre?.name || null,
        centre_short_name: centre?.shortName || null,
      };
    });

    const { error: insertError } = await supabaseAdmin
      .from('region_centres')
      .insert(centresToInsert);

    if (insertError) throw insertError;

    revalidatePath('/admin/regions');
    return { success: true as const };
  } catch (error) {
    return failure(error);
  }
}

export async function updateRegion(idToken: string, regionData: UpdateRegionData) {
  try {
    await requireAdminToken(idToken);

    const { error: updateError } = await supabaseAdmin
      .from('regions')
      .update({
        name: regionData.name.trim(),
        description: regionData.description?.trim() || null,
        is_active: regionData.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq('id', regionData.id);

    if (updateError) throw updateError;

    await supabaseAdmin
      .from('region_centres')
      .delete()
      .eq('region_id', regionData.id);

    const centresToInsert = regionData.selectedCentres.map(centreId => {
      const centre = regionData.centresData.find(c => c.id === centreId);
      return {
        region_id: regionData.id,
        centre_id: centreId,
        centre_name: centre?.name || null,
        centre_short_name: centre?.shortName || null,
      };
    });

    const { error: insertError } = await supabaseAdmin
      .from('region_centres')
      .insert(centresToInsert);

    if (insertError) throw insertError;

    revalidatePath('/admin/regions');
    return { success: true as const };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteRegion(idToken: string, regionId: string) {
  try {
    await requireAdminToken(idToken);

    const { error } = await supabaseAdmin
      .from('regions')
      .delete()
      .eq('id', regionId);

    if (error) throw error;
    revalidatePath('/admin/regions');
    return { success: true as const };
  } catch (error) {
    return failure(error);
  }
}

// =====================================================
// PERMISSION ACTIONS
// =====================================================

export async function getPermissions(idToken: string) {
  try {
    await requireAdminToken(idToken);

    const { data, error } = await supabaseAdmin
      .from('user_permissions')
      .select(`
        *,
        profiles!user_permissions_user_id_fkey (id, email),
        regions (id, name)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { success: true, data: (data as any[]) || [] };
  } catch (error) {
    { const f = failure(error); return { success: false as const, error: f.error, data: [] }; }
  }
}

export async function getPermissionUsers(idToken: string) {
  try {
    await requireAdminToken(idToken);

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id, email')
      .order('email');

    if (error) throw error;
    return { success: true, data: (data as any[]) || [] };
  } catch (error) {
    { const f = failure(error); return { success: false as const, error: f.error, data: [] }; }
  }
}

export async function getPermissionRegions(idToken: string) {
  try {
    await requireAdminToken(idToken);

    const { data, error } = await supabaseAdmin
      .from('regions')
      .select('id, name')
      .eq('is_active', true)
      .order('name');

    if (error) throw error;
    return { success: true, data: (data as any[]) || [] };
  } catch (error) {
    { const f = failure(error); return { success: false as const, error: f.error, data: [] }; }
  }
}

export async function createPermission(idToken: string, permissionData: CreatePermissionData) {
  try {
    await requireAdminToken(idToken);

    const { data: existing } = await supabaseAdmin
      .from('user_permissions')
      .select('id')
      .eq('user_id', permissionData.user_id)
      .eq('region_id', permissionData.region_id)
      .single();

    if (existing) {
      return { success: false, error: 'Phân quyền cho tài khoản này tại khu vực này đã tồn tại' };
    }

    const { error } = await supabaseAdmin
      .from('user_permissions')
      .insert({
        user_id: permissionData.user_id,
        region_id: permissionData.region_id,
        courses: permissionData.courses,
        can_view: permissionData.can_view,
        can_edit: permissionData.can_edit,
        can_manage: permissionData.can_manage,
      });

    if (error) throw error;
    revalidatePath('/admin/permissions');
    return { success: true as const };
  } catch (error) {
    return failure(error);
  }
}

export async function updatePermission(idToken: string, permissionData: UpdatePermissionData) {
  try {
    await requireAdminToken(idToken);

    const { error } = await supabaseAdmin
      .from('user_permissions')
      .update({
        courses: permissionData.courses,
        can_view: permissionData.can_view,
        can_edit: permissionData.can_edit,
        can_manage: permissionData.can_manage,
        updated_at: new Date().toISOString(),
      })
      .eq('id', permissionData.id);

    if (error) throw error;
    revalidatePath('/admin/permissions');
    return { success: true as const };
  } catch (error) {
    return failure(error);
  }
}

export async function deletePermission(idToken: string, permissionId: string) {
  try {
    await requireAdminToken(idToken);

    const { error } = await supabaseAdmin
      .from('user_permissions')
      .delete()
      .eq('id', permissionId);

    if (error) throw error;
    revalidatePath('/admin/permissions');
    return { success: true as const };
  } catch (error) {
    return failure(error);
  }
}

// =====================================================
// ROLE MANAGEMENT ACTIONS
// =====================================================

export async function getRoles(idToken: string) {
  try {
    await requireAdminToken(idToken);

    const { data, error } = await supabaseAdmin
      .from('roles')
      .select(`*, role_permissions ( *, pages (*) )`)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { success: true, data: (data as any[]) || [] };
  } catch (error) {
    { const f = failure(error); return { success: false as const, error: f.error, data: [] }; }
  }
}

export async function getPages(idToken: string) {
  try {
    await requireAdminToken(idToken);

    const { data, error } = await supabaseAdmin
      .from('pages')
      .select('*')
      .order('display_order');

    if (error) throw error;
    return { success: true, data: (data as any[]) || [] };
  } catch (error) {
    { const f = failure(error); return { success: false as const, error: f.error, data: [] }; }
  }
}

export async function createRole(idToken: string, roleData: CreateRoleData) {
  try {
    await requireAdminToken(idToken);

    const { data: existing } = await supabaseAdmin
      .from('roles')
      .select('id')
      .eq('name', roleData.name.trim())
      .single();

    if (existing) {
      return { success: false, error: 'Tên vai trò đã tồn tại' };
    }

    const { data: newRole, error: createError } = await supabaseAdmin
      .from('roles')
      .insert({
        name: roleData.name.trim(),
        description: roleData.description?.trim() || null,
        is_system_role: false,
        is_active: roleData.is_active,
      })
      .select()
      .single();

    if (createError) throw createError;

    const permissionsToInsert = roleData.pagePermissions.map(perm => ({
      role_id: newRole.id,
      page_id: perm.pageId,
      can_view: perm.canView,
      can_edit: perm.canEdit,
    }));

    if (permissionsToInsert.length > 0) {
      const { error: insertError } = await supabaseAdmin
        .from('role_permissions')
        .insert(permissionsToInsert);
      if (insertError) throw insertError;
    }

    revalidatePath('/admin/roles');
    return { success: true as const };
  } catch (error) {
    return failure(error);
  }
}

export async function updateRole(idToken: string, roleData: UpdateRoleData) {
  try {
    await requireAdminToken(idToken);

    const { data: existing } = await supabaseAdmin
      .from('roles')
      .select('id')
      .eq('name', roleData.name.trim())
      .neq('id', roleData.id)
      .single();

    if (existing) {
      return { success: false, error: 'Tên vai trò đã tồn tại' };
    }

    const { error: updateError } = await supabaseAdmin
      .from('roles')
      .update({
        name: roleData.name.trim(),
        description: roleData.description?.trim() || null,
        is_active: roleData.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq('id', roleData.id);

    if (updateError) throw updateError;

    await supabaseAdmin
      .from('role_permissions')
      .delete()
      .eq('role_id', roleData.id);

    const permissionsToInsert = roleData.pagePermissions.map(perm => ({
      role_id: roleData.id,
      page_id: perm.pageId,
      can_view: perm.canView,
      can_edit: perm.canEdit,
    }));

    if (permissionsToInsert.length > 0) {
      const { error: insertError } = await supabaseAdmin
        .from('role_permissions')
        .insert(permissionsToInsert);
      if (insertError) throw insertError;
    }

    revalidatePath('/admin/roles');
    return { success: true as const };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteRole(idToken: string, roleId: string) {
  try {
    await requireAdminToken(idToken);

    const { data: role } = await supabaseAdmin
      .from('roles')
      .select('is_system_role, name')
      .eq('id', roleId)
      .single();

    if (role?.is_system_role) {
      return { success: false, error: 'Không thể xóa vai trò hệ thống' };
    }

    const { data: users } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('role_id', roleId)
      .limit(1);

    if (users && users.length > 0) {
      return { success: false, error: 'Không thể xóa vai trò đang được sử dụng' };
    }

    const { error } = await supabaseAdmin
      .from('roles')
      .delete()
      .eq('id', roleId);

    if (error) throw error;
    revalidatePath('/admin/roles');
    return { success: true as const };
  } catch (error) {
    return failure(error);
  }
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

export async function getUserRoles(idToken: string) {
  try {
    await requireAdminToken(idToken);

    const { data, error } = await supabaseAdmin
      .from('roles')
      .select('id, name, description, is_active, is_system_role, created_at')
      .eq('is_active', true)
      .order('name');

    if (error) throw error;
    return { success: true, data: (data as any[]) || [] };
  } catch (error) {
    { const f = failure(error); return { success: false as const, error: f.error, data: [] }; }
  }
}

export async function getUserPermissionsByUserId(idToken: string, userId: string) {
  try {
    await requireAdminToken(idToken);

    const { data, error } = await supabaseAdmin
      .from('user_permissions')
      .select('*')
      .eq('user_id', userId);

    if (error) throw error;
    return { success: true, data: (data as any[]) || [] };
  } catch (error) {
    { const f = failure(error); return { success: false as const, error: f.error, data: [] }; }
  }
}

export async function saveUserPermissions(
  idToken: string,
  userId: string,
  permissions: Array<{
    region_id: string;
    courses: string[];
    can_view: boolean;
    can_edit: boolean;
    can_manage: boolean;
  }>,
) {
  try {
    await requireAdminToken(idToken);

    await supabaseAdmin
      .from('user_permissions')
      .delete()
      .eq('user_id', userId);

    if (permissions.length > 0) {
      const { error } = await supabaseAdmin
        .from('user_permissions')
        .insert(permissions.map(p => ({ user_id: userId, ...p })));
      if (error) throw error;
    }

    revalidatePath('/admin/users');
    return { success: true as const };
  } catch (error) {
    return failure(error);
  }
}
