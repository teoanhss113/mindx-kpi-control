// API Route: Sync Pages
// Automatically creates all required pages in database

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// All pages required by the application
import { USER_PAGE_KEYS } from '@/lib/pageGroups';

const REQUIRED_PAGES = [
  // ── Trang người dùng ──
  {
    key: 'home',
    page_name: 'Trang chủ',
    path: '/',
    description: 'Trang chủ dành cho người dùng',
    display_order: 0,
  },
  {
    key: 'available-shifts',
    page_name: 'Ca trực khả dụng',
    path: '/available-shifts',
    description: 'Xem và đăng ký ca trực khả dụng',
    display_order: 2,
  },
  // ── Trang quản trị ──
  {
    key: 'dashboard',
    page_name: 'Tổng quan',
    path: '/admin/dashboard',
    description: 'Trang tổng quan dashboard với các KPI chính',
    display_order: 10,
  },
  {
    key: 'completion',
    page_name: 'Tỷ lệ Hoàn thành',
    path: '/admin/completion-rate',
    description: 'Trang theo dõi tỷ lệ hoàn thành khóa học',
    display_order: 11,
  },
  {
    key: 'teacher-change',
    page_name: 'Thay đổi Giáo viên',
    path: '/admin/teacher-change',
    description: 'Trang quản lý thay đổi giáo viên',
    display_order: 12,
  },
  {
    key: 'tickets',
    page_name: 'Phiếu Đánh giá',
    path: '/admin/tickets',
    description: 'Trang quản lý phiếu đánh giá từ học viên',
    display_order: 13,
  },
  {
    key: 'class-quality',
    page_name: 'Chất lượng Lớp học',
    path: '/admin/class-quality',
    description: 'Trang kiểm soát chất lượng lớp học',
    display_order: 14,
  },
  {
    key: 'office-hours',
    page_name: 'Ca Trải nghiệm',
    path: '/admin/office-hours',
    description: 'Trang quản lý ca trải nghiệm và tỷ lệ chuyển đổi',
    display_order: 15,
  },
  {
    key: 'teacher-schedule',
    page_name: 'Điều phối Giáo viên',
    path: '/admin/teacher-schedule',
    description: 'Trang điều phối lịch giảng dạy của giáo viên',
    display_order: 16,
  },
  {
    key: 'teachers',
    page_name: 'Quản lý Giáo viên',
    path: '/admin/teachers',
    description: 'Trang quản lý thông tin giáo viên',
    display_order: 17,
  },
  {
    key: 'admin-users',
    page_name: 'Quản lý Tài khoản',
    path: '/admin/users',
    description: 'Trang quản lý tài khoản người dùng hệ thống',
    display_order: 18,
  },
  {
    key: 'admin-regions',
    page_name: 'Quản lý Khu vực',
    path: '/admin/regions',
    description: 'Trang quản lý khu vực và cơ sở',
    display_order: 19,
  },
  {
    key: 'admin-roles',
    page_name: 'Quản lý Vai trò',
    path: '/admin/roles',
    description: 'Trang quản lý vai trò và phân quyền',
    display_order: 20,
  },
];

export async function POST() {
  try {
    const results = {
      created: [] as string[],
      updated: [] as string[],
      errors: [] as string[],
    };

    // Check existing pages
    const { data: existingPages } = await supabase
      .from('pages')
      .select('key, page_name');

    const existingKeys = new Set(existingPages?.map(p => p.key) || []);

    // Upsert each page
    for (const page of REQUIRED_PAGES) {
      try {
        const { data, error } = await supabase
          .from('pages')
          .upsert(
            {
              key: page.key,
              page_name: page.page_name,
              path: page.path,
              description: page.description,
              display_order: page.display_order,
            },
            {
              onConflict: 'key',
              ignoreDuplicates: false,
            }
          )
          .select()
          .single();

        if (error) {
          results.errors.push(`${page.key}: ${error.message}`);
        } else {
          if (existingKeys.has(page.key)) {
            results.updated.push(page.key);
          } else {
            results.created.push(page.key);
          }
        }
      } catch (err: any) {
        results.errors.push(`${page.key}: ${err.message}`);
      }
    }

    // Get final count
    const { count } = await supabase
      .from('pages')
      .select('*', { count: 'exact', head: true });

    return NextResponse.json({
      success: true,
      message: 'Pages synced successfully',
      results: {
        created: results.created.length,
        updated: results.updated.length,
        errors: results.errors.length,
        total: count || 0,
      },
      details: results,
    });
  } catch (error: any) {
    console.error('[Sync Pages] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to sync pages',
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    // Get all pages
    const { data: pages, error } = await supabase
      .from('pages')
      .select('*')
      .order('display_order');

    if (error) {
      throw error;
    }

    const existingKeys = new Set(pages?.map(p => p.key) || []);
    const requiredKeys = REQUIRED_PAGES.map(p => p.key);
    const missingKeys = requiredKeys.filter(k => !existingKeys.has(k));

    return NextResponse.json({
      success: true,
      pages: pages || [],
      total: pages?.length || 0,
      required: REQUIRED_PAGES.length,
      missing: missingKeys,
      needsSync: missingKeys.length > 0,
    });
  } catch (error: any) {
    console.error('[Get Pages] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to get pages',
      },
      { status: 500 }
    );
  }
}
