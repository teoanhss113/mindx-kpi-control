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
    description: 'Trang chủ dành cho người dùng',
  },
  {
    key: 'my-schedule',
    page_name: 'Lịch trực của tôi',
    description: 'Xem lịch trực ca trải nghiệm cá nhân',
  },
  {
    key: 'available-shifts',
    page_name: 'Ca trực khả dụng',
    description: 'Xem và đăng ký ca trực khả dụng',
  },
  // ── Trang quản trị ──
  {
    key: 'dashboard',
    page_name: 'Tổng quan',
    description: 'Trang tổng quan dashboard với các KPI chính',
  },
  {
    key: 'completion',
    page_name: 'Tỷ lệ Hoàn thành',
    description: 'Trang theo dõi tỷ lệ hoàn thành khóa học',
  },
  {
    key: 'teacher-change',
    page_name: 'Thay đổi Giáo viên',
    description: 'Trang quản lý thay đổi giáo viên',
  },
  {
    key: 'tickets',
    page_name: 'Phiếu Đánh giá',
    description: 'Trang quản lý phiếu đánh giá từ học viên',
  },
  {
    key: 'class-quality',
    page_name: 'Chất lượng Lớp học',
    description: 'Trang kiểm soát chất lượng lớp học',
  },
  {
    key: 'office-hours',
    page_name: 'Ca Trải nghiệm',
    description: 'Trang quản lý ca trải nghiệm và tỷ lệ chuyển đổi',
  },
  {
    key: 'teacher-schedule',
    page_name: 'Điều phối Giáo viên',
    description: 'Trang điều phối lịch giảng dạy của giáo viên',
  },
  {
    key: 'teachers',
    page_name: 'Quản lý Giáo viên',
    description: 'Trang quản lý thông tin giáo viên',
  },
  {
    key: 'admin-users',
    page_name: 'Quản lý Tài khoản',
    description: 'Trang quản lý tài khoản người dùng hệ thống',
  },
  {
    key: 'admin-regions',
    page_name: 'Quản lý Khu vực',
    description: 'Trang quản lý khu vực và cơ sở',
  },
  {
    key: 'admin-roles',
    page_name: 'Quản lý Vai trò',
    description: 'Trang quản lý vai trò và phân quyền',
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
              description: page.description,
              created_at: new Date().toISOString(),
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
      .order('key');

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
