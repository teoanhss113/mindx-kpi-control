import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { authErrorResponse, requirePagePermission } from '@/lib/auth/serverAuth';
import type { ClassQualityFollowUpStatus } from '@/types/classQualityFollowUp';

const PAGE_KEY = 'teacher-schedule';
const VALID_STATUSES = new Set<ClassQualityFollowUpStatus>([
  'unprocessed',
  'in_progress',
  'resolved',
]);

function normalizedText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function isMissingFollowUpTableError(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const databaseError = error as { code?: string; message?: string };
  const message = databaseError.message?.toLowerCase() || '';
  return databaseError.code === '42P01'
    || databaseError.code === 'PGRST205'
    || (message.includes('class_quality_follow_ups') && (
      message.includes('does not exist')
      || message.includes('schema cache')
      || message.includes('could not find')
    ));
}

function routeErrorResponse(error: unknown) {
  if (isMissingFollowUpTableError(error)) {
    return NextResponse.json(
      { error: 'Chức năng quản lý xử lý chưa được khởi tạo trong cơ sở dữ liệu' },
      { status: 503 },
    );
  }
  return authErrorResponse(error);
}

export async function GET(request: NextRequest) {
  try {
    await requirePagePermission(request, PAGE_KEY, 'view');

    const { data, error } = await supabaseAdmin
      .from('class_quality_follow_ups')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ data: data || [] });
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await requirePagePermission(request, PAGE_KEY, 'edit');
    const body = await request.json().catch(() => ({}));
    const classId = normalizedText(body?.classId);
    const className = normalizedText(body?.className);
    const note = normalizedText(body?.note);
    const status = body?.status as ClassQualityFollowUpStatus;

    if (!classId || !className) {
      return NextResponse.json(
        { error: 'Thiếu mã lớp hoặc tên lớp' },
        { status: 400 },
      );
    }

    if (classId.length > 160 || className.length > 255) {
      return NextResponse.json(
        { error: 'Mã lớp hoặc tên lớp vượt quá độ dài cho phép' },
        { status: 400 },
      );
    }

    if (!VALID_STATUSES.has(status)) {
      return NextResponse.json(
        { error: 'Trạng thái xử lý không hợp lệ' },
        { status: 400 },
      );
    }

    if (typeof body?.note !== 'string' || body.note.trim().length > 2000) {
      return NextResponse.json(
        { error: 'Ghi chú tối đa 2.000 ký tự' },
        { status: 400 },
      );
    }

    const { data, error } = await supabaseAdmin
      .from('class_quality_follow_ups')
      .upsert({
        class_id: classId,
        class_name: className,
        status,
        note,
        updated_by_profile_id: user.profileId,
        updated_by_email: user.email,
      }, { onConflict: 'class_id' })
      .select('*')
      .single();

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
