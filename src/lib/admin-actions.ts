'use server';

/**
 * Admin Actions
 * Server actions for admin CRUD operations
 */

import { supabaseAdmin } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

// Types
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

// =====================================================
// USER ACTIONS
// =====================================================

export async function getUsers() {
  try {
    const timestamp = Date.now();
    console.log(`[getUsers ${timestamp}] Starting...`);
    
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select(`
        *,
        roles (id, name, description)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    console.log(`[getUsers ${timestamp}] Fetched profiles:`, data?.length || 0);
    
    return { success: true, data: (data || []) as any[] };
  } catch (error: any) {
    console.error('[getUsers] Error:', error);
    return { success: false, error: error.message, data: [] };
  }
}

export async function createUser(userData: CreateUserData) {
  try {
    const { error } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: crypto.randomUUID(), // Temporary - will be replaced by Firebase UID
        email: userData.email,
        role_id: userData.role_id,
        is_active: userData.is_active,
      });

    if (error) throw error;
    revalidatePath('/admin/users');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateUser(userData: UpdateUserData) {
  try {
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
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteUser(userId: string) {
  try {
    const { error } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', userId);

    if (error) throw error;
    revalidatePath('/admin/users');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// =====================================================
// REGION ACTIONS
// =====================================================

export async function getRegions() {
  try {
    const { data, error } = await supabaseAdmin
      .from('regions')
      .select(`
        *,
        region_centres (*)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { success: true, data: data as any[] || [] };
  } catch (error: any) {
    return { success: false, error: error.message, data: [] };
  }
}

export async function createRegion(regionData: CreateRegionData) {
  try {
    // Create region
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

    // Insert centres
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
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateRegion(regionData: UpdateRegionData) {
  try {
    // Update region
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

    // Delete old centres
    await supabaseAdmin
      .from('region_centres')
      .delete()
      .eq('region_id', regionData.id);

    // Insert new centres
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
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteRegion(regionId: string) {
  try {
    const { error } = await supabaseAdmin
      .from('regions')
      .delete()
      .eq('id', regionId);

    if (error) throw error;
    revalidatePath('/admin/regions');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// =====================================================
// PERMISSION ACTIONS
// =====================================================

export async function getPermissions() {
  try {
    const { data, error } = await supabaseAdmin
      .from('user_permissions')
      .select(`
        *,
        profiles!user_permissions_user_id_fkey (id, email),
        regions (id, name)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    console.log('[getPermissions] Raw data:', data);
    
    return { success: true, data: data as any[] || [] };
  } catch (error: any) {
    console.error('[getPermissions] Error:', error);
    return { success: false, error: error.message, data: [] };
  }
}

export async function getPermissionUsers() {
  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id, email')
      .order('email');

    if (error) throw error;
    return { success: true, data: data as any[] || [] };
  } catch (error: any) {
    return { success: false, error: error.message, data: [] };
  }
}

export async function getPermissionRegions() {
  try {
    const { data, error } = await supabaseAdmin
      .from('regions')
      .select('id, name')
      .eq('is_active', true)
      .order('name');

    if (error) throw error;
    return { success: true, data: data as any[] || [] };
  } catch (error: any) {
    return { success: false, error: error.message, data: [] };
  }
}

export async function createPermission(permissionData: CreatePermissionData) {
  try {
    // Check if permission already exists
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
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updatePermission(permissionData: UpdatePermissionData) {
  try {
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
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deletePermission(permissionId: string) {
  try {
    const { error } = await supabaseAdmin
      .from('user_permissions')
      .delete()
      .eq('id', permissionId);

    if (error) throw error;
    revalidatePath('/admin/permissions');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// =====================================================
// ROLE MANAGEMENT ACTIONS
// =====================================================

export async function getRoles() {
  try {
    const { data, error } = await supabaseAdmin
      .from('roles')
      .select(`
        *,
        role_permissions (
          *,
          pages (*)
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { success: true, data: data as any[] || [] };
  } catch (error: any) {
    return { success: false, error: error.message, data: [] };
  }
}

export async function getPages() {
  try {
    const { data, error } = await supabaseAdmin
      .from('pages')
      .select('*')
      .order('display_order');

    if (error) throw error;
    return { success: true, data: data as any[] || [] };
  } catch (error: any) {
    return { success: false, error: error.message, data: [] };
  }
}

export async function createRole(roleData: CreateRoleData) {
  try {
    // Check if role name already exists
    const { data: existing } = await supabaseAdmin
      .from('roles')
      .select('id')
      .eq('name', roleData.name.trim())
      .single();

    if (existing) {
      return { success: false, error: 'Tên vai trò đã tồn tại' };
    }

    // Create role
    const { data: newRole, error: createError } = await supabaseAdmin
      .from('roles')
      .insert({
        name: roleData.name.trim(),
        description: roleData.description?.trim() || null,
        is_system_role: false, // Custom roles are not system roles
        is_active: roleData.is_active,
      })
      .select()
      .single();

    if (createError) throw createError;

    // Insert role permissions with view/edit flags
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
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateRole(roleData: UpdateRoleData) {
  try {
    // Check if role name already exists (excluding current role)
    const { data: existing } = await supabaseAdmin
      .from('roles')
      .select('id')
      .eq('name', roleData.name.trim())
      .neq('id', roleData.id)
      .single();

    if (existing) {
      return { success: false, error: 'Tên vai trò đã tồn tại' };
    }

    // Update role
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

    // Delete old permissions
    await supabaseAdmin
      .from('role_permissions')
      .delete()
      .eq('role_id', roleData.id);

    // Insert new permissions with view/edit flags
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
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteRole(roleId: string) {
  try {
    // Check if role is system role
    const { data: role } = await supabaseAdmin
      .from('roles')
      .select('is_system_role, name')
      .eq('id', roleId)
      .single();

    if (role?.is_system_role) {
      return { success: false, error: 'Không thể xóa vai trò hệ thống' };
    }

    // Check if role is being used by any users
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
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

export async function getUserRoles() {
  try {
    const { data, error } = await supabaseAdmin
      .from('roles')
      .select('id, name, description, is_active, is_system_role, created_at')
      .eq('is_active', true)
      .order('name');

    if (error) throw error;
    return { success: true, data: data as any[] || [] };
  } catch (error: any) {
    return { success: false, error: error.message, data: [] };
  }
}

export async function getUserPermissionsByUserId(userId: string) {
  try {
    const { data, error } = await supabaseAdmin
      .from('user_permissions')
      .select('*')
      .eq('user_id', userId);

    if (error) throw error;
    return { success: true, data: data as any[] || [] };
  } catch (error: any) {
    return { success: false, error: error.message, data: [] };
  }
}

export async function saveUserPermissions(userId: string, permissions: Array<{
  region_id: string;
  courses: string[];
  can_view: boolean;
  can_edit: boolean;
  can_manage: boolean;
}>) {
  try {
    // Delete existing permissions
    await supabaseAdmin
      .from('user_permissions')
      .delete()
      .eq('user_id', userId);

    // Insert new permissions
    if (permissions.length > 0) {
      const { error } = await supabaseAdmin
        .from('user_permissions')
        .insert(permissions.map(p => ({
          user_id: userId,
          ...p
        })));

      if (error) throw error;
    }

    revalidatePath('/admin/users');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
