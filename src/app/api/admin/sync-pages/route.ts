// API Route: Sync Pages
// Automatically creates all required pages in database

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin, authErrorResponse } from '@/lib/auth/serverAuth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const REQUIRED_PAGES = [
  // ── Trang người dùng ──
  {
    key: 'home',
    page_name: 'Trang chủ',
    path: '/',
    description: 'Trang chủ dành cho người dùng',
    display_order: 1,
  },
  {
    key: 'available-shifts',
    page_name: 'Ca trực khả dụng',
    path: '/available-shifts',
    description: 'Xem và đăng ký ca trực khả dụng',
    display_order: 2,
  },
  {
    key: 'judge-requests',
    page_name: 'Giám khảo cuối khoá',
    path: '/judge-requests',
    description: 'Yêu cầu làm giám khảo cho buổi cuối khoá',
    display_order: 3,
  },
  {
    key: 'manager-schedules',
    page_name: 'Đăng ký lịch Quản lý',
    path: '/admin/schedule',
    description: 'Quản lý đăng ký lịch làm việc hằng tuần theo cơ sở và buổi',
    display_order: 10,
  },
  // ── Trang quản trị ──
  {
    key: 'dashboard',
    page_name: 'Tổng quan',
    path: '/admin/dashboard',
    description: 'Trang tổng quan dashboard với các KPI chính',
    display_order: 4,
  },
  {
    key: 'teacher-schedule',
    page_name: 'Quản lý Vận hành',
    path: '/admin/operations',
    description: 'Trang vận hành giảng dạy và kiểm soát chất lượng lớp học',
    display_order: 5,
  },
  {
    key: 'completion',
    page_name: 'Tỷ lệ Hoàn thành',
    path: '/admin/completion-rate',
    description: 'Trang theo dõi tỷ lệ hoàn thành khoá học',
    display_order: 6,
  },
  {
    key: 'teacher-change',
    page_name: 'Thay đổi Giáo viên',
    path: '/admin/teacher-change',
    description: 'Trang quản lý thay đổi giáo viên',
    display_order: 7,
  },
  {
    key: 'tickets',
    page_name: 'Phiếu Đánh giá',
    path: '/admin/tickets',
    description: 'Trang quản lý phiếu đánh giá từ học viên',
    display_order: 8,
  },
  {
    key: 'office-hours',
    page_name: 'Ca Trải nghiệm',
    path: '/admin/office-hours',
    description: 'Trang quản lý ca trải nghiệm và tỷ lệ chuyển đổi',
    display_order: 9,
  },
  {
    key: 'admin-manager-schedules',
    page_name: 'Quản trị lịch Quản lý',
    path: '/admin/manager-schedules',
    description: 'Admin theo dõi lịch làm việc của quản lý theo thời gian và cơ sở',
    display_order: 11,
  },
  {
    key: 'final-sessions',
    page_name: 'Giám khảo Cuối khoá',
    path: '/admin/final-sessions',
    description: 'Quản lý batch giám khảo và chia sẻ link cho giáo viên JUDGE',
    display_order: 12,
  },
  {
    key: 'teachers',
    page_name: 'Quản lý Giáo viên',
    path: '/admin/teachers',
    description: 'Trang quản lý thông tin giáo viên',
    display_order: 13,
  },
  {
    key: 'admin-users',
    page_name: 'Quản lý Tài khoản',
    path: '/admin/users',
    description: 'Trang quản lý tài khoản người dùng hệ thống',
    display_order: 14,
  },
  {
    key: 'admin-regions',
    page_name: 'Quản lý Khu vực',
    path: '/admin/regions',
    description: 'Trang quản lý khu vực và cơ sở',
    display_order: 15,
  },
  {
    key: 'admin-roles',
    page_name: 'Quản lý Vai trò',
    path: '/admin/roles',
    description: 'Trang quản lý vai trò và phân quyền',
    display_order: 16,
  },
  {
    key: 'admin-usage-analytics',
    page_name: 'Phân tích Sử dụng',
    path: '/admin/usage-analytics',
    description: 'Theo dõi tần suất sử dụng, nhu cầu, thiết bị và tải hệ thống',
    display_order: 17,
  },
];

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
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
        const { error } = await supabase
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
      } catch (err: unknown) {
        results.errors.push(`${page.key}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    const { count } = await supabase
      .from('pages')
      .select('*', { count: 'exact', head: true });

    // Clean up deprecated pages
    const requiredKeysSet = new Set(REQUIRED_PAGES.map(p => p.key));
    const deprecatedPages = existingPages?.filter(p => !requiredKeysSet.has(p.key)) || [];
    
    if (deprecatedPages.length > 0) {
      const deprecatedKeys = deprecatedPages.map(p => p.key);
      const { error: deleteError } = await supabase
        .from('pages')
        .delete()
        .in('key', deprecatedKeys);
        
      if (deleteError) {
        results.errors.push(`Delete deprecated: ${deleteError.message}`);
      } else {
        // We can optionally add deleted array to results
        // results.deleted = deprecatedKeys;
      }
    }

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
  } catch (error: unknown) {
    return authErrorResponse(error);
  }
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
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
  } catch (error: unknown) {
    return authErrorResponse(error);
  }
}
