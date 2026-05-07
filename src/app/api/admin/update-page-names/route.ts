import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireAdmin, authErrorResponse, AuthError } from '@/lib/auth/serverAuth';

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);

    // Update page names to match Sidebar labels
    const updates = [
      { key: 'dashboard', name: 'Tổng quan' },
      { key: 'completion', name: 'Tỷ lệ Hoàn thành' },
      { key: 'teacher-change', name: 'Thay đổi Giáo viên' },
      { key: 'tickets', name: 'Phiếu Đánh giá' },
      { key: 'class-quality', name: 'Chất lượng Lớp học' },
      { key: 'office-hours', name: 'Ca Trải nghiệm' },
      { key: 'teacher-schedule', name: 'Điều phối Giáo viên' },
      { key: 'teachers', name: 'Quản lý Giáo viên' },
      { key: 'admin-users', name: 'Quản lý Tài khoản' },
      { key: 'admin-regions', name: 'Quản lý Khu vực' },
      { key: 'admin-roles', name: 'Quản lý Vai trò' },
      { key: 'admin-permissions', name: 'Phân quyền' },
    ];

    for (const update of updates) {
      const { error } = await supabaseAdmin
        .from('pages')
        .update({ page_name: update.name })
        .eq('key', update.key);

      if (error) {
        console.error(`[update-page-names] Error updating ${update.key}:`, error);
      } else {
        console.log(`[update-page-names] Updated ${update.key} → ${update.name}`);
      }
    }

    // Add missing pages if they don't exist
    const missingPages = [
      {
        key: 'completion',
        page_name: 'Tỷ lệ Hoàn thành',
        path: '/completion-rate',
        description: 'Theo dõi tỷ lệ hoàn thành lớp học',
        display_order: 2,
      },
      {
        key: 'teachers',
        page_name: 'Quản lý Giáo viên',
        path: '/teachers',
        description: 'Quản lý thông tin giáo viên',
        display_order: 8,
      },
      {
        key: 'admin-permissions',
        page_name: 'Phân quyền',
        path: '/admin/permissions',
        description: 'Phân quyền truy cập cho người dùng',
        display_order: 12,
      },
    ];

    for (const page of missingPages) {
      // Check if page exists
      const { data: existing } = await supabaseAdmin
        .from('pages')
        .select('id')
        .eq('key', page.key)
        .single();

      if (!existing) {
        const { error } = await supabaseAdmin
          .from('pages')
          .insert(page);

        if (error) {
          console.error(`[update-page-names] Error inserting ${page.key}:`, error);
        } else {
          console.log(`[update-page-names] Inserted missing page: ${page.key}`);
        }
      }
    }

    // Update display order
    const displayOrders = [
      { key: 'dashboard', order: 1 },
      { key: 'completion', order: 2 },
      { key: 'teacher-change', order: 3 },
      { key: 'tickets', order: 4 },
      { key: 'class-quality', order: 5 },
      { key: 'office-hours', order: 6 },
      { key: 'teacher-schedule', order: 7 },
      { key: 'teachers', order: 8 },
      { key: 'admin-users', order: 9 },
      { key: 'admin-regions', order: 10 },
      { key: 'admin-roles', order: 11 },
      { key: 'admin-permissions', order: 12 },
    ];

    for (const item of displayOrders) {
      const { error } = await supabaseAdmin
        .from('pages')
        .update({ display_order: item.order })
        .eq('key', item.key);

      if (error) {
        console.error(`[update-page-names] Error updating order for ${item.key}:`, error);
      }
    }

    console.log('[update-page-names] ✅ All page names updated successfully!');

    return NextResponse.json({
      success: true,
      message: 'Page names updated successfully',
      updated: updates.length,
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return NextResponse.json(
      { success: false, error: 'Operation failed' },
      { status: 500 }
    );
  }
}
