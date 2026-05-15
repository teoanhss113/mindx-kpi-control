import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  AuthError,
  authErrorResponse,
  extractBearer,
  verifyFirebaseIdToken,
} from '@/lib/auth/serverAuth';
import { MANAGER_SCHEDULE_LABELS, SYSTEM_ADMIN_LABELS } from '@/constants';

type UsageEventType = 'page_view' | 'heartbeat';

const PAGE_LABELS: Record<string, string> = {
  home: 'Trang chủ',
  dashboard: 'Tổng quan',
  'teacher-schedule': 'Quản lý Vận hành',
  completion: 'Tỷ lệ Hoàn thành',
  'teacher-change': 'Thay đổi Giáo viên',
  tickets: 'Phiếu Đánh giá',
  'office-hours': 'Ca Trải nghiệm',
  'final-sessions': 'Giám khảo Cuối khoá',
  teachers: 'Quản lý Giáo viên',
  'manager-schedules': MANAGER_SCHEDULE_LABELS.PAGE_TITLE,
  'admin-users': SYSTEM_ADMIN_LABELS.USERS_TITLE,
  'admin-regions': SYSTEM_ADMIN_LABELS.REGIONS_TITLE,
  'admin-roles': SYSTEM_ADMIN_LABELS.ROLES_TITLE,
  'admin-usage-analytics': SYSTEM_ADMIN_LABELS.USAGE_TITLE,
  'admin-manager-schedules': MANAGER_SCHEDULE_LABELS.ADMIN_PAGE_TITLE,
  'available-shifts': 'Ca trực khả dụng',
  'judge-requests': 'Giám khảo cuối khoá',
};

function inferPageKey(path: string) {
  if (path === '/') return 'home';
  if (path.startsWith('/admin/dashboard')) return 'dashboard';
  if (path.startsWith('/admin/operations')) return 'teacher-schedule';
  if (path.startsWith('/admin/completion-rate')) return 'completion';
  if (path.startsWith('/admin/teacher-change')) return 'teacher-change';
  if (path.startsWith('/admin/tickets')) return 'tickets';
  if (path.startsWith('/admin/office-hours')) return 'office-hours';
  if (path.startsWith('/admin/final-sessions')) return 'final-sessions';
  if (path.startsWith('/admin/teachers')) return 'teachers';
  if (path.startsWith('/admin/schedule')) return 'manager-schedules';
  if (path.startsWith('/admin/users')) return 'admin-users';
  if (path.startsWith('/admin/regions')) return 'admin-regions';
  if (path.startsWith('/admin/roles')) return 'admin-roles';
  if (path.startsWith('/admin/usage-analytics')) return 'admin-usage-analytics';
  if (path.startsWith('/admin/manager-schedules')) return 'admin-manager-schedules';
  if (path.startsWith('/available-shifts')) return 'available-shifts';
  if (path.startsWith('/judge-requests')) return 'judge-requests';
  return path.replace(/^\/+/, '').split('/')[0] || 'unknown';
}

function inferDevice(userAgent: string) {
  const ua = userAgent.toLowerCase();
  const device_type = /ipad|tablet/.test(ua) ? 'tablet' : /mobile|iphone|android/.test(ua) ? 'mobile' : 'desktop';
  const browser_name = ua.includes('edg/') ? 'Edge'
    : ua.includes('chrome/') || ua.includes('crios/') ? 'Chrome'
      : ua.includes('safari/') ? 'Safari'
        : ua.includes('firefox/') ? 'Firefox'
          : 'Khác';
  const os_name = ua.includes('windows') ? 'Windows'
    : ua.includes('mac os') || ua.includes('macintosh') ? 'macOS'
      : ua.includes('android') ? 'Android'
        : ua.includes('iphone') || ua.includes('ipad') ? 'iOS'
          : ua.includes('linux') ? 'Linux'
            : 'Khác';

  return { device_type, browser_name, os_name };
}

export async function POST(request: NextRequest) {
  try {
    const idToken = extractBearer(request);
    const verified = await verifyFirebaseIdToken(idToken);
    const email = verified.email?.trim().toLowerCase();

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email not found in token' },
        { status: 400 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const eventType = body.eventType === 'page_view' ? 'page_view' : 'heartbeat' as UsageEventType;
    const pagePath = typeof body.path === 'string' && body.path.trim() ? body.path.trim() : '/';
    const pageKey = typeof body.pageKey === 'string' ? body.pageKey : inferPageKey(pagePath);
    const userAgent = request.headers.get('user-agent') || '';
    const device = inferDevice(userAgent);
    const now = new Date().toISOString();

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    await supabaseAdmin
      .from('profiles')
      .update({ last_login_at: now, updated_at: now })
      .eq('email', email);

    const { error } = await supabaseAdmin
      .from('usage_events')
      .insert({
        user_email: email,
        user_id: profile?.id || null,
        event_type: eventType,
        page_path: pagePath,
        page_key: pageKey,
        page_title: PAGE_LABELS[pageKey] || pagePath,
        device_type: device.device_type,
        browser_name: device.browser_name,
        os_name: device.os_name,
        viewport_width: Number.isFinite(body.viewportWidth) ? body.viewportWidth : null,
        viewport_height: Number.isFinite(body.viewportHeight) ? body.viewportHeight : null,
        occurred_at: now,
      });

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return NextResponse.json(
      { success: false, error: 'Internal error' },
      { status: 500 },
    );
  }
}
