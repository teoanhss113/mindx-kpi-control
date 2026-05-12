'use server';

/**
 * Admin Actions
 * Server actions for admin CRUD operations.
 *
 * Every action requires a Firebase ID token whose holder has permission
 * for the related admin page before any privileged supabaseAdmin call is made.
 */

import { supabaseAdmin } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { requirePagePermissionToken, AuthError } from '@/lib/auth/serverAuth';

const ADMIN_USERS_PAGE = 'admin-users';
const ADMIN_REGIONS_PAGE = 'admin-regions';
const ADMIN_ROLES_PAGE = 'admin-roles';
const ADMIN_USAGE_ANALYTICS_PAGE = 'admin-usage-analytics';

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
    await requirePagePermissionToken(idToken, ADMIN_USERS_PAGE);

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
    await requirePagePermissionToken(idToken, ADMIN_USERS_PAGE);

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
    await requirePagePermissionToken(idToken, ADMIN_USERS_PAGE, 'edit');

    const email = userData.email.trim().toLowerCase();

    const { data: existingProfile, error: findError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (findError) throw findError;

    const { data: savedProfile, error } = existingProfile
      ? await supabaseAdmin
        .from('profiles')
        .update({
          role_id: userData.role_id,
          is_active: userData.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingProfile.id)
        .select('id, email')
        .single()
      : await supabaseAdmin
        .from('profiles')
        .insert({
          id: crypto.randomUUID(),
          email,
          role_id: userData.role_id,
          is_active: userData.is_active,
        })
        .select('id, email')
        .single();

    if (error) throw error;
    revalidatePath('/admin/users');
    return { success: true as const, data: savedProfile };
  } catch (error) {
    return failure(error);
  }
}

export async function updateUser(idToken: string, userData: UpdateUserData) {
  try {
    await requirePagePermissionToken(idToken, ADMIN_USERS_PAGE, 'edit');

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

/**
 * "deleteUser" — actually REVOKES permissions: sets role_id=null and is_active=false.
 * The profile record is preserved so the user can still authenticate via Firebase.
 * The account will appear in the "Tài khoản chưa phân quyền" table until re-assigned.
 */
export async function deleteUser(idToken: string, userId: string) {
  try {
    await requirePagePermissionToken(idToken, ADMIN_USERS_PAGE, 'edit');

    const { error } = await supabaseAdmin
      .from('profiles')
      .update({
        role_id: null,
        is_active: false,
        updated_at: new Date().toISOString(),
      })
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
    await requirePagePermissionToken(idToken, ADMIN_REGIONS_PAGE);

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
    await requirePagePermissionToken(idToken, ADMIN_REGIONS_PAGE, 'edit');

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
    await requirePagePermissionToken(idToken, ADMIN_REGIONS_PAGE, 'edit');

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
    await requirePagePermissionToken(idToken, ADMIN_REGIONS_PAGE, 'edit');

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
    await requirePagePermissionToken(idToken, ADMIN_USERS_PAGE);

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
    await requirePagePermissionToken(idToken, ADMIN_USERS_PAGE);

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
    await requirePagePermissionToken(idToken, ADMIN_USERS_PAGE);

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
    await requirePagePermissionToken(idToken, ADMIN_USERS_PAGE, 'edit');

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
    await requirePagePermissionToken(idToken, ADMIN_USERS_PAGE, 'edit');

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
    await requirePagePermissionToken(idToken, ADMIN_USERS_PAGE, 'edit');

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
    await requirePagePermissionToken(idToken, ADMIN_ROLES_PAGE);

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
    await requirePagePermissionToken(idToken, ADMIN_ROLES_PAGE);

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
    await requirePagePermissionToken(idToken, ADMIN_ROLES_PAGE, 'edit');

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
    await requirePagePermissionToken(idToken, ADMIN_ROLES_PAGE, 'edit');

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
    await requirePagePermissionToken(idToken, ADMIN_ROLES_PAGE, 'edit');

    const { data: role } = await supabaseAdmin
      .from('roles')
      .select('is_system_role, name')
      .eq('id', roleId)
      .single();

    if (role?.is_system_role) {
      return { success: false, error: 'Không thể xoá vai trò hệ thống' };
    }

    const { data: users } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('role_id', roleId)
      .limit(1);

    if (users && users.length > 0) {
      return { success: false, error: 'Không thể xoá vai trò đang được sử dụng' };
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
    await requirePagePermissionToken(idToken, ADMIN_USERS_PAGE);

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
    await requirePagePermissionToken(idToken, ADMIN_USERS_PAGE);

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
    await requirePagePermissionToken(idToken, ADMIN_USERS_PAGE, 'edit');

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

// =====================================================
// USAGE ANALYTICS
// =====================================================

type UsageEvent = {
  user_email: string;
  event_type: 'page_view' | 'heartbeat';
  page_path: string;
  page_key: string | null;
  page_title: string | null;
  device_type: string | null;
  browser_name: string | null;
  os_name: string | null;
  occurred_at: string;
};

type UsageAnalyticsRange = number | {
  fromDate?: string;
  toDate?: string;
};

const USAGE_PAGE_LABELS: Record<string, string> = {
  home: 'Trang chủ',
  dashboard: 'Tổng quan',
  'teacher-schedule': 'Quản lý Vận hành',
  completion: 'Tỷ lệ Hoàn thành',
  'teacher-change': 'Thay đổi Giáo viên',
  tickets: 'Phiếu Đánh giá',
  'office-hours': 'Ca Trải nghiệm',
  'final-sessions': 'Giám khảo Cuối khoá',
  teachers: 'Quản lý Giáo viên',
  'admin-users': 'Quản lý Tài khoản',
  'admin-regions': 'Quản lý Khu vực',
  'admin-roles': 'Quản lý Vai trò',
  'admin-usage-analytics': 'Phân tích Sử dụng',
  'available-shifts': 'Ca trực khả dụng',
  'judge-requests': 'Giám khảo cuối khoá',
};

function incrementMap(map: Map<string, number>, key: string, amount = 1) {
  map.set(key, (map.get(key) || 0) + amount);
}

function topEntries(map: Map<string, number>, limit = 10) {
  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'vi-VN'))
    .slice(0, limit);
}

function pageLabel(event: UsageEvent) {
  if (event.page_key && USAGE_PAGE_LABELS[event.page_key]) {
    return USAGE_PAGE_LABELS[event.page_key];
  }

  if (event.page_title && event.page_title !== 'MindX KPI Control — Tổng quan Quản trị') {
    return event.page_title;
  }

  return event.page_key || event.page_path || 'Không rõ';
}

function parseDateBoundary(value: string | undefined, boundary: 'start' | 'end') {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const time = boundary === 'start' ? '00:00:00.000' : '23:59:59.999';
  const date = new Date(`${value}T${time}+07:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function resolveUsageRange(range: UsageAnalyticsRange) {
  if (typeof range === 'number') {
    const safeDays = Math.min(Math.max(range, 1), 180);
    const to = new Date();
    const from = new Date(to.getTime() - safeDays * 24 * 60 * 60 * 1000);
    return { safeDays, since: from.toISOString(), until: to.toISOString() };
  }

  const fallbackTo = new Date();
  const requestedTo = parseDateBoundary(range.toDate, 'end') || fallbackTo;
  const requestedFrom = parseDateBoundary(range.fromDate, 'start') || new Date(requestedTo.getTime() - 30 * 24 * 60 * 60 * 1000);
  const to = requestedTo < requestedFrom ? requestedFrom : requestedTo;
  const maxFrom = new Date(to.getTime() - 180 * 24 * 60 * 60 * 1000);
  const from = requestedFrom < maxFrom ? maxFrom : requestedFrom;
  const safeDays = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)));

  return { safeDays, since: from.toISOString(), until: to.toISOString() };
}

export async function getUsageAnalytics(idToken: string, range: UsageAnalyticsRange = 30) {
  try {
    await requirePagePermissionToken(idToken, ADMIN_USAGE_ANALYTICS_PAGE);

    const { safeDays, since, until } = resolveUsageRange(range);

    const query = supabaseAdmin
      .from('usage_events')
      .select('user_email, event_type, page_path, page_key, page_title, device_type, browser_name, os_name, occurred_at')
      .gte('occurred_at', since)
      .lte('occurred_at', until)
      .order('occurred_at', { ascending: false })
      .limit(10000);

    const { data, error } = await query;

    if (error) throw error;

    const onlineSince = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: onlineData, error: onlineError } = await supabaseAdmin
      .from('usage_events')
      .select('user_email, event_type, page_path, page_key, page_title, device_type, browser_name, os_name, occurred_at')
      .gte('occurred_at', onlineSince)
      .order('occurred_at', { ascending: false })
      .limit(1000);

    if (onlineError) throw onlineError;

    const events = (data || []) as UsageEvent[];
    const onlineEvents = (onlineData || []) as UsageEvent[];
    const pageViews = events.filter(event => event.event_type === 'page_view');
    const heartbeats = events.filter(event => event.event_type === 'heartbeat');
    const activeUsers = new Set(events.map(event => event.user_email));
    const activePages = new Set(pageViews.map(event => event.page_path));

    const userEvents = new Map<string, number>();
    const userPageViews = new Map<string, number>();
    const pageViewCounts = new Map<string, number>();
    const pageUserCounts = new Map<string, Set<string>>();
    const deviceCounts = new Map<string, number>();
    const browserCounts = new Map<string, number>();
    const osCounts = new Map<string, number>();
    const dayCounts = new Map<string, number>();
    const weekCounts = new Map<string, number>();
    const hourCounts = new Map<string, number>();
    const dailyActiveUsers = new Map<string, Set<string>>();
    const weeklyActiveUsers = new Map<string, Set<string>>();
    const userPageMatrix = new Map<string, Map<string, number>>();
    const userLastActivity = new Map<string, string>();
    let lastActivityAt: string | null = null;

    events.forEach(event => {
      incrementMap(userEvents, event.user_email);

      const date = new Date(event.occurred_at);
      const dayKey = date.toISOString().slice(0, 10);
      const weekStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
      weekStart.setUTCDate(weekStart.getUTCDate() - ((weekStart.getUTCDay() + 6) % 7));
      const weekKey = weekStart.toISOString().slice(0, 10);
      const hourKey = `${String(date.getHours()).padStart(2, '0')}:00`;
      if (!dailyActiveUsers.has(dayKey)) dailyActiveUsers.set(dayKey, new Set());
      dailyActiveUsers.get(dayKey)?.add(event.user_email);
      if (!weeklyActiveUsers.has(weekKey)) weeklyActiveUsers.set(weekKey, new Set());
      weeklyActiveUsers.get(weekKey)?.add(event.user_email);

      if (!lastActivityAt || event.occurred_at > lastActivityAt) {
        lastActivityAt = event.occurred_at;
      }
      const currentLastActivity = userLastActivity.get(event.user_email);
      if (!currentLastActivity || event.occurred_at > currentLastActivity) {
        userLastActivity.set(event.user_email, event.occurred_at);
      }

      if (event.event_type !== 'page_view') return;

      const label = pageLabel(event);
      incrementMap(deviceCounts, event.device_type || 'Không rõ');
      incrementMap(browserCounts, event.browser_name || 'Không rõ');
      incrementMap(osCounts, event.os_name || 'Không rõ');
      incrementMap(dayCounts, dayKey);
      incrementMap(weekCounts, weekKey);
      incrementMap(hourCounts, hourKey);
      incrementMap(pageViewCounts, label);
      incrementMap(userPageViews, event.user_email);

      if (!pageUserCounts.has(label)) pageUserCounts.set(label, new Set());
      pageUserCounts.get(label)?.add(event.user_email);

      if (!userPageMatrix.has(event.user_email)) userPageMatrix.set(event.user_email, new Map());
      incrementMap(userPageMatrix.get(event.user_email)!, label);
    });

    const topPages = topEntries(pageViewCounts, 10).map(item => ({
      ...item,
      uniqueUsers: pageUserCounts.get(item.name)?.size || 0,
    }));

    const userPageDetails = Array.from(userPageMatrix.entries())
      .flatMap(([email, pageMap]) => Array.from(pageMap.entries()).map(([page, views]) => ({ email, page, views })))
      .sort((a, b) => a.email.localeCompare(b.email, 'vi-VN') || b.views - a.views || a.page.localeCompare(b.page, 'vi-VN'));

    const userSummaries = Array.from(userPageMatrix.entries())
      .map(([email, pageMap]) => {
        const pages = Array.from(pageMap.entries());
        const totalPageViews = pages.reduce((sum, [, views]) => sum + views, 0);
        const topPage = pages.sort((a, b) => b[1] - a[1])[0];

        return {
          email,
          uniquePages: pageMap.size,
          totalPageViews,
          totalEvents: userEvents.get(email) || 0,
          lastActivityAt: userLastActivity.get(email) || null,
          topPage: topPage?.[0] || '—',
        };
      })
      .sort((a, b) => b.totalPageViews - a.totalPageViews || a.email.localeCompare(b.email, 'vi-VN'));

    const dailyTrend = Array.from(dayCounts.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const weeklyTrend = Array.from(weekCounts.entries())
      .map(([weekStart, count]) => ({ weekStart, count }))
      .sort((a, b) => a.weekStart.localeCompare(b.weekStart));

    const dailyActiveTrend = Array.from(dailyActiveUsers.entries())
      .map(([date, users]) => ({ date, count: users.size }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const weeklyActiveTrend = Array.from(weeklyActiveUsers.entries())
      .map(([weekStart, users]) => ({ weekStart, count: users.size }))
      .sort((a, b) => a.weekStart.localeCompare(b.weekStart));

    const hourlyDistribution = Array.from(hourCounts.entries())
      .map(([hour, count]) => ({ hour, count }))
      .sort((a, b) => a.hour.localeCompare(b.hour));

    const busiestHour = hourlyDistribution.reduce(
      (best, current) => current.count > best.count ? current : best,
      { hour: '—', count: 0 },
    );

    const latestOnlineEvents = new Map<string, UsageEvent>();
    onlineEvents.forEach(event => {
      const current = latestOnlineEvents.get(event.user_email);
      if (!current || event.occurred_at > current.occurred_at) {
        latestOnlineEvents.set(event.user_email, event);
      }
    });

    const onlineUsers = Array.from(latestOnlineEvents.values())
      .map(event => ({
        email: event.user_email,
        lastSeenAt: event.occurred_at,
        page: pageLabel(event),
        device: event.device_type || 'Không rõ',
      }))
      .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt) || a.email.localeCompare(b.email, 'vi-VN'));

    return {
      success: true,
      data: {
        rangeDays: safeDays,
        since,
        lastActivityAt,
        summary: {
          totalEvents: events.length,
          totalPageViews: pageViews.length,
          totalHeartbeats: heartbeats.length,
          activeUsers: activeUsers.size,
          activePages: activePages.size,
          onlineUsers: onlineUsers.length,
          avgEventsPerUser: activeUsers.size ? events.length / activeUsers.size : 0,
          avgPageViewsPerUser: activeUsers.size ? pageViews.length / activeUsers.size : 0,
          avgEventsPerDay: events.length / safeDays,
          busiestHour: busiestHour.hour,
        },
        topUsers: topEntries(userEvents, 10).map(item => ({
          email: item.name,
          events: item.count,
          pageViews: userPageViews.get(item.name) || 0,
        })),
        topPages,
        devices: topEntries(deviceCounts, 10),
        browsers: topEntries(browserCounts, 10),
        operatingSystems: topEntries(osCounts, 10),
        userSummaries,
        userPageDetails,
        dailyTrend,
        weeklyTrend,
        dailyActiveTrend,
        weeklyActiveTrend,
        hourlyDistribution,
        onlineUsers,
      },
    };
  } catch (error) {
    { const f = failure(error); return { success: false as const, error: f.error, data: null }; }
  }
}
