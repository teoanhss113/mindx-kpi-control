import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { AuthError, authErrorResponse, requirePagePermission } from '@/lib/auth/serverAuth';
import { MANAGER_WORK_SESSIONS } from '@/constants';

const MANAGER_PAGE_KEY = 'manager-schedules';
const ADMIN_PAGE_KEY = 'admin-manager-schedules';
const SESSION_VALUES: Set<string> = new Set(MANAGER_WORK_SESSIONS.map(item => item.value));

interface ManagerProfileRow {
  id: string;
  email: string;
  display_name?: string | null;
  user_permissions?: Array<{
    regions?: { name?: string | null } | null;
  }> | null;
  roles?: {
    name?: string | null;
    role_permissions?: Array<{
      can_view?: boolean | null;
      can_edit?: boolean | null;
      pages?: { key?: string | null } | null;
    }> | null;
  } | null;
}

function normalizeDate(value: unknown) {
  const text = String(value || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
}

function normalizeText(value: unknown, maxLength = 255) {
  return String(value || '').trim().slice(0, maxLength);
}

function isMissingScheduleTableError(error: { code?: string; message?: string }) {
  const message = error.message?.toLowerCase() || '';
  const referencesScheduleTable = message.includes('manager_work_schedules');
  return (
    error.code === '42P01'
    || error.code === 'PGRST205'
    || (referencesScheduleTable && (
      message.includes('does not exist')
      || message.includes('schema cache')
      || message.includes('could not find')
    ))
  );
}

function canRegisterManagerSchedule(profile: ManagerProfileRow) {
  const roleName = String(profile.roles?.name || '').toLowerCase();
  if (roleName === 'admin' || roleName === 'manager') return true;

  const allowedPageKeys = new Set([MANAGER_PAGE_KEY, ADMIN_PAGE_KEY, 'admin-users']);
  return (profile.roles?.role_permissions || []).some(permission => (
    allowedPageKeys.has(permission.pages?.key || '')
    && (permission.can_view || permission.can_edit)
  ));
}

async function getManagerScheduleProfiles() {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select(`
      id,
      email,
      display_name,
      user_permissions (
        regions ( name )
      ),
      roles (
        name,
        role_permissions (
          can_view,
          can_edit,
          pages ( key )
        )
      )
    `)
    .eq('is_active', true)
    .order('email', { ascending: true });

  if (error) throw error;

  return ((data || []) as ManagerProfileRow[])
    .filter(profile => profile.email && canRegisterManagerSchedule(profile))
    .map(profile => ({
      id: profile.id,
      email: profile.email,
      name: profile.display_name || profile.email.split('@')[0] || profile.email,
      regionNames: [...new Set((profile.user_permissions || [])
        .map(permission => permission.regions?.name)
        .filter(Boolean))],
      roleName: profile.roles?.name || '',
    }));
}

export async function GET(request: NextRequest) {
  try {
    const adminMode = request.nextUrl.searchParams.get('admin') === '1';
    const managersMode = request.nextUrl.searchParams.get('managers') === '1';
    const mineOnly = request.nextUrl.searchParams.get('mine') === '1';
    const user = adminMode
      ? await requirePagePermission(request, ADMIN_PAGE_KEY, 'view')
      : await requirePagePermission(request, MANAGER_PAGE_KEY, 'view');

    if (managersMode) {
      if (!adminMode) throw new AuthError('Admin mode required', 403);
      const managers = await getManagerScheduleProfiles();
      return NextResponse.json({ data: managers });
    }

    const dateFrom = normalizeDate(request.nextUrl.searchParams.get('dateFrom'));
    const dateTo = normalizeDate(request.nextUrl.searchParams.get('dateTo'));
    const centreIds = request.nextUrl.searchParams.getAll('centreId').filter(Boolean);

    let query = supabaseAdmin
      .from('manager_work_schedules')
      .select('*')
      .order('work_date', { ascending: true })
      .order('session', { ascending: true })
      .order('centre_short_name', { ascending: true });

    if (dateFrom) query = query.gte('work_date', dateFrom);
    if (dateTo) query = query.lte('work_date', dateTo);
    if (centreIds.length > 0) query = query.in('centre_id', centreIds);
    if (mineOnly) query = query.eq('manager_email', user.email);

    const { data, error } = await query;
    if (error) {
      if (isMissingScheduleTableError(error)) return NextResponse.json({ data: [] });
      throw error;
    }

    return NextResponse.json({ data: data || [] });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('[manager-schedules GET]', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requirePagePermission(request, MANAGER_PAGE_KEY, 'edit');
    const body = await request.json().catch(() => ({}));
    const rawItems = Array.isArray(body?.items) ? body.items : [];

    if (rawItems.length === 0) {
      return NextResponse.json({ error: 'items required' }, { status: 400 });
    }

    const displayName = normalizeText(body?.managerName, 160) || user.email;
    const rows = rawItems.map((item: Record<string, unknown>) => {
      const workDate = normalizeDate(item.date);
      const session = normalizeText(item.session, 30);
      const centreId = normalizeText(item.centreId, 80);
      if (!workDate || !SESSION_VALUES.has(session) || !centreId) {
        throw new AuthError('Invalid schedule item', 400);
      }

      return {
        manager_id: user.profileId,
        manager_name: displayName,
        manager_email: user.email,
        centre_id: centreId,
        centre_name: normalizeText(item.centreName, 255),
        centre_short_name: normalizeText(item.centreShortName, 80),
        work_date: workDate,
        weekday: Number(item.weekday),
        session,
        note: normalizeText(item.note, 500) || null,
      };
    });

    const { data, error } = await supabaseAdmin
      .from('manager_work_schedules')
      .upsert(rows, {
        onConflict: 'manager_email,work_date,session',
        ignoreDuplicates: false,
      })
      .select('*');

    if (error) {
      if (isMissingScheduleTableError(error)) {
        return NextResponse.json({ error: 'Chưa có bảng manager_work_schedules. Vui lòng chạy migration 018_manager_work_schedules.sql.' }, { status: 500 });
      }
      throw error;
    }

    return NextResponse.json({ data: data || [] });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('[manager-schedules POST]', error);
    return NextResponse.json({ error: 'Operation failed' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const adminMode = request.nextUrl.searchParams.get('admin') === '1';
    const user = adminMode
      ? await requirePagePermission(request, ADMIN_PAGE_KEY, 'edit')
      : await requirePagePermission(request, MANAGER_PAGE_KEY, 'edit');
    const id = normalizeText(request.nextUrl.searchParams.get('id'), 80);

    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }

    let query = supabaseAdmin
      .from('manager_work_schedules')
      .delete()
      .eq('id', id);

    if (!adminMode) query = query.eq('manager_email', user.email);

    const { error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('[manager-schedules DELETE]', error);
    return NextResponse.json({ error: 'Operation failed' }, { status: 500 });
  }
}
