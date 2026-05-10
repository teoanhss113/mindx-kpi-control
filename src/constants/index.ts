/**
 * MindX KPI Dashboard — Global Constants
 * Single Source of Truth for all labels, messages, and configuration
 * 
 * RULES:
 * 1. All user-facing text MUST come from this file
 * 2. All cache keys MUST use CACHE_KEYS constants
 * 3. All formatters MUST use FORMAT helpers
 * 4. All animation timing MUST use ANIMATION constants
 */

/**
 * CACHE KEYS — Standardized naming convention
 * Format: mindx_{feature}_v{version}
 */
export const CACHE_KEYS = {
  CENTRES: 'mindx_centres_v1',
  COMPLETION: 'mindx_completion_v1',
  TEACHER_CHANGE: 'mindx_teacher_change_v1',
  TEACHER_SCHEDULE: 'mindx_teacher_schedule_v1',
  TEACHERS: 'mindx_teachers_v1',
  TICKETS: 'mindx_tickets_v1',
  CLASS_QUALITY: 'mindx_class_quality_v1',
  OFFICE_HOURS: 'mindx_office_hours_v1',
  FILTER_STATE: 'mindx_filter_state_v1', // Shared filter state across pages
} as const;

/**
 * COLUMN LABELS — Standardized Vietnamese labels
 * Use these everywhere for consistency
 */
export const LABELS = {
  // Common
  CLASS_NAME: 'Lớp học',
  CENTRE: 'Cơ sở',
  TEACHER: 'Giáo viên',
  STATUS: 'Trạng thái',
  STUDENT: 'Học viên',
  STUDENTS: 'Học viên',
  DATE: 'Ngày',
  TIME: 'Thời gian',
  REASON: 'Lý do',
  ACTION: 'Hành động',
  SIZE: 'Sĩ số',
  COURSE_LINE: 'Khối',
  COURSE: 'Khoá học',
  CLASS_TITLE: 'Tên lớp',
  MAIN_TEACHER: 'Giáo viên chính',
  REGISTRATION_STATUS: 'Trạng thái đăng ký',
  
  // Progress/Sessions
  PROGRESS: 'Tiến độ',  // Simple, clear — no parentheses needed
  COMPLETED: 'Đã học',
  TOTAL: 'Tổng',
  SESSIONS: 'Buổi học',
  SESSION: 'Buổi',
  
  // Stats
  COMPLETION_RATE: 'Tỷ lệ Hoàn thành',
  TEACHER_CHANGE_RATE: 'Tỷ lệ thay đổi GV',
  TOTAL_CLASSES: 'Tổng số lớp',
  TOTAL_STUDENTS: 'Tổng học viên',
  TOTAL_TICKETS: 'Tổng phiếu',
  TOTAL_SESSIONS: 'Tổng số ca',
  
  // Dashboard
  DASHBOARD: 'Tổng quan',
  QUICK_ACCESS: 'Truy cập nhanh',
  ALERTS: 'Cảnh báo',
  ACTIONABLE_INSIGHTS: 'Gợi ý Hành động',
  REFRESH_ALL: 'Làm mới tất cả',
  LAST_UPDATED: 'Cập nhật lần cuối',
  NO_PERMISSION: 'Bạn chưa có quyền truy cập',
  NO_DATA_AVAILABLE: 'Chưa có dữ liệu',
  LOAD_DATA_PROMPT: 'Vui lòng tải dữ liệu từ các trang chi tiết',
  
  // Actions
  LOAD_DATA: 'Tải Dữ Liệu',
  REFRESH_DATA: 'Làm Mới Dữ Liệu',
  CLEAR_FILTERS: 'Xoá Bộ Lọc',
  STOP_LOADING: 'Dừng Tải',
  SEARCH: 'Tìm Kiếm',
  FILTER: 'Lọc',
  EXPORT: 'Xuất Dữ Liệu',
  CLOSE: 'Đóng',
  SAVE: 'Lưu',
  CANCEL: 'Huỷ',
  
  // CRUD Actions (Admin)
  CREATE: 'Tạo',           // Create new entity
  EDIT: 'Chỉnh sửa',       // Edit existing entity
  UPDATE: 'Cập nhật',      // Update/save changes
  DELETE: 'Xoá',           // Delete entity
  VIEW: 'Xem',             // View details
  CREATING: 'Đang tạo...', // Creating state
  UPDATING: 'Đang lưu...', // Updating state
  DELETING: 'Đang xoá...', // Deleting state
  
  // Filters
  ALL_CENTRES: 'Tất cả cơ sở',
  ALL_STATUSES: 'Tất cả trạng thái',
  ALL_TYPES: 'Tất cả loại',
  FROM: 'Từ',
  TO: 'đến',
  
  // Placeholders
  SEARCH_CLASS: 'Tìm lớp học...',
  SEARCH_TEACHER: 'Tìm giáo viên...',
  SEARCH_STUDENT: 'Tìm học viên...',
  SELECT_CENTRE: '-- Chọn cơ sở --',
  
  // Empty states
  NO_DATA: 'Chưa có dữ liệu',
  NO_RESULTS: 'Không tìm thấy kết quả',
  SELECT_DATE_RANGE: 'Chọn khoảng thời gian và nhấn "Tải dữ liệu"',
  
  // Section headers
  CHARTS_SECTION: 'Biểu Đồ Phân Tích',
  TABLE_SECTION: 'Danh Sách',
  FILTERS_SECTION: 'Bộ Lọc',
  
  // Checkpoint & Scores
  CP1: 'CP1 (Buổi 5)',
  CP2: 'CP2 (Buổi 9)',
  DEMO: 'Demo (Buổi 14)',
  CHECKPOINT_SCORES: 'Điểm Checkpoint & Cuối khoá',
  THEORY_SCORE: 'Điểm lý thuyết',
  PRACTICE_SCORE: 'Điểm thực hành',
  ABILITY_SCORE: 'Điểm năng lực',
  PRODUCT_SCORE: 'Điểm sản phẩm cuối khoá',
  DEMO_SCORE: 'Điểm Demo',
  CHECKPOINT_SCORE: 'Điểm Checkpoint',
  TBCK: 'Điểm TB cả khoá (TBCK)',
  PASS_RATE: 'Tỷ lệ đạt',
  AVERAGE_SCORE: 'Điểm TB',
  EXCELLENT: 'Xuất sắc',
  GOOD: 'Tốt',
  AVERAGE: 'Trung bình',
  POOR: 'Yếu',
  MISSING_SCORES: 'Thiếu điểm',
  
  // Grade Ranks
  RANK_A: 'Hạng A - Xuất sắc',
  RANK_B: 'Hạng B - Tốt',
  RANK_C: 'Hạng C - Đạt',
  RANK_D: 'Hạng D - Chưa Đạt',
  RANK: 'Xếp loại',
  NEEDS_RETAKE: 'Cần học lại',
  CAN_ADVANCE: 'Đủ điều kiện lên lớp',
} as const;

/**
 * TEACHER SCHEDULE — Page-specific labels and options.
 * Keep route UI text here so `/admin/operations` stays aligned with
 * the global wording system instead of scattering Vietnamese copies in JSX.
 */
export const TEACHER_SCHEDULE_LABELS = {
  PAGE_TITLE: 'Quản lý Vận hành',
  CALENDAR_VIEW: 'Lịch tuần',
  QUALITY_VIEW: 'Chất lượng lớp học',
  SCHEDULE_TYPE: 'Loại lịch',
  ALL_SCHEDULES: 'Tất cả lịch',
  CLASS_ONLY: 'Lớp học',
  TRIAL_ONLY: 'Ca trải nghiệm/Dạy bù',
  FIND_AVAILABLE_TEACHER: 'Tìm giáo viên rảnh để điều phối',
  WEEKLY_SCHEDULE: 'Lịch giảng dạy theo tuần',
  WEEK_PREFIX: 'Tuần',
  PREVIOUS_WEEK: 'Tuần trước',
  NEXT_WEEK: 'Tuần sau',
  TODAY: 'Hôm nay',
  CURRENT_SLOT_INFO: 'Thông tin ca hiện tại',
  EMPTY_SCHEDULE_TITLE: 'Chưa có dữ liệu lịch giảng dạy',
  EMPTY_QUALITY_TITLE: 'Chưa có dữ liệu chất lượng lớp',
  EMPTY_SUBTITLE: 'Chọn khoảng thời gian và nhấn "Tải dữ liệu"',
  FILTERED_TEACHERS: 'giáo viên đang hiển thị',
  TEACHERS_WITH_SCHEDULE: 'Giáo viên có lịch',
  TEACHING_SLOTS_IN_RANGE: 'Ca dạy trong kỳ',
  AVG_SLOTS_PER_TEACHER: 'Ca/giáo viên',
  RELOAD_DATA: 'Làm mới',
} as const;

export const TEACHER_SCHEDULE_TYPE_OPTIONS = [
  { value: 'ALL', label: TEACHER_SCHEDULE_LABELS.ALL_SCHEDULES },
  { value: 'CLASS', label: TEACHER_SCHEDULE_LABELS.CLASS_ONLY },
  { value: 'TRIAL', label: TEACHER_SCHEDULE_LABELS.TRIAL_ONLY },
] as const;

export const TEACHER_SCHEDULE_VIEW_OPTIONS = [
  { value: 'calendar', label: TEACHER_SCHEDULE_LABELS.CALENDAR_VIEW },
  { value: 'quality-table', label: TEACHER_SCHEDULE_LABELS.QUALITY_VIEW },
] as const;

export const CLASS_QUALITY_LABELS = {
  PANEL_TITLE: 'Tình hình lớp học',
  HAS_ISSUES: 'Có vấn đề',
  COMMENT_ISSUES: 'Nhận xét lỗi',
  ATTENDANCE_ALERTS: 'Chuyên cần cảnh báo',
  RESCHEDULED: 'Thay đổi lịch',
  TEACHER_COMMENTS: 'Nhận xét giáo viên',
  ATTENDANCE: 'Chuyên cần',
  SCHEDULE_CHANGES: 'Thay đổi lịch',
  CHECKPOINT_DEMO_SCORES: 'Điểm Checkpoint / Demo',
  RESCHEDULED_SESSIONS: 'Buổi dời',
  STUDENT_COUNT: 'Số lượng học viên',
} as const;

export const TICKET_LABELS = {
  PAGE_TITLE: 'Phiếu Đánh giá',
  LIST_VIEW: 'Danh sách Phiếu',
  CLASS_ANALYSIS_VIEW: 'Phân tích theo Lớp',
  TOTAL_TICKETS_STAT: 'TỔNG PHIẾU',
  NEW_TICKETS_STAT: 'PHIẾU MỚI',
  RESOLVE_RATE_STAT: 'TỶ LỆ DONE',
  LOW_SCORE: 'Điểm thấp (≤ 3.0)',
  TICKET_LIST: 'Danh sách Phiếu đánh giá',
  CLASS_ANALYSIS: 'Phân tích theo Lớp học',
  EMPTY_TITLE: 'Chưa có dữ liệu khảo sát',
  SEARCH_PLACEHOLDER: 'Mã phiếu, Lớp, Học viên, Nội dung...',
  TICKETS_BY_CENTRE: 'Số Phiếu Theo Cơ Sở',
  TICKETS_BY_COURSE_LINE: 'Số Phiếu Theo Khối',
  AVG_SCORE_GV: 'ĐIỂM TRUNG BÌNH (GV)',
  PENDING_SURVEYS: 'Cần khảo sát',
} as const;

/**
 * LOADING MESSAGES — Standardized Vietnamese messages
 */
export const MESSAGES = {
  LOADING: {
    CONNECTING: 'Đang kết nối tới hệ thống...',
    INITIALIZING: 'Đang khởi tạo...',
    LOADING_PROGRESS: (loaded: number, total: number) => 
      total > 0 ? `Đang tải ${loaded}/${total}` : 'Đang khởi tạo...',
    LOADING_CLASSES: 'Đang tải dữ liệu lớp học...',
    LOADING_TICKETS: 'Đang tải dữ liệu phiếu đánh giá...',
    LOADING_OFFICE_HOURS: 'Đang tải dữ liệu ca trải nghiệm...',
    SUCCESS: (count: number, entity: string) => `Tải thành công ${count} ${entity}!`,
    STOPPED: 'Đã dừng tải dữ liệu.',
  },
  CACHE: {
    CLEARED: 'Đã xoá dữ liệu tạm!',
  },
  ERROR: {
    GENERIC: 'Gặp sự cố. Vui lòng thử lại.',
    DATE_RANGE_REQUIRED: 'Vui lòng chọn khoảng thời gian',
    DATE_RANGE_INVALID: 'Ngày bắt đầu phải trước ngày kết thúc',
    NETWORK: 'Lỗi kết nối. Vui lòng kiểm tra mạng.',
  },
  SUCCESS: {
    CREATED: (entity: string) => `Tạo ${entity} thành công`,
    UPDATED: (entity: string) => `Cập nhật ${entity} thành công`,
    DELETED: (entity: string) => `Xoá ${entity} thành công`,
  },
} as const;

/**
 * ENTITY NAMES — For use in success messages
 */
export const ENTITIES = {
  CLASSES: 'lớp học',
  TICKETS: 'phiếu đánh giá',
  OFFICE_HOURS: 'ca học',
  STUDENTS: 'học viên',
  TEACHERS: 'giáo viên',
  USERS: 'tài khoản',
  ROLES: 'vai trò',
  REGIONS: 'khu vực',
  CENTRES: 'cơ sở',
  TEACHER_PROFILE: 'hồ sơ giáo viên',
} as const;

/**
 * ANIMATION TIMING — Standardized delays (in seconds)
 */
export const ANIMATION = {
  /** Delay increment between stat cards (0.07s) */
  STAT_CARD_DELAY: 0.07,
  
  /** Delay increment between table rows (0.012s) */
  TABLE_ROW_DELAY: 0.012,
  
  /** Maximum delay for table rows (0.3s cap) */
  TABLE_ROW_MAX_DELAY: 0.3,
  
  /** Duration for fade transitions (0.25s) */
  FADE_DURATION: 0.25,
  
  /** Duration for slide transitions (0.2s) */
  SLIDE_DURATION: 0.2,
} as const;

/**
 * FORMAT HELPERS — Standardized formatters
 */
export const FORMAT = {
  /** 
   * Format progress as "x/y"
   * @example FORMAT.progress(5, 10) → "5/10"
   */
  progress: (completed: number, total: number) => `${completed}/${total}`,
  
  /** 
   * Format percentage with 1 decimal
   * @example FORMAT.percentage(95.678) → "95.7%"
   */
  percentage: (value: number) => `${value.toFixed(1)}%`,
  
  /** 
   * Format date to Vietnamese locale
   * @example FORMAT.date(new Date()) → "22/04/2026"
   */
  date: (date: Date) => date.toLocaleDateString('vi-VN'),
  
  /** 
   * Format datetime to Vietnamese locale with time
   * @example FORMAT.datetime(new Date()) → "22/04/2026, 14:30"
   */
  datetime: (date: Date) => new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date),
  
  /**
   * Format time only (HH:mm)
   * @example FORMAT.time(new Date()) → "14:30"
   */
  time: (date: Date) => new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date),
  
  /**
   * Format number with thousand separators
   * @example FORMAT.number(1234567) → "1.234.567"
   */
  number: (value: number) => value.toLocaleString('vi-VN'),
} as const;

/**
 * DATE HELPERS — Standardized date utilities
 */
export const DATE_UTILS = {
  /**
   * Get default month range (first day to last day of current month)
   */
  defaultMonthRange: () => {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const pad = (n: number) => String(n).padStart(2, '0');
    return {
      from: `${first.getFullYear()}-${pad(first.getMonth() + 1)}-${pad(first.getDate())}`,
      to: `${last.getFullYear()}-${pad(last.getMonth() + 1)}-${pad(last.getDate())}`,
    };
  },
  
  /**
   * Pad number to 2 digits
   */
  pad2: (n: number) => String(n).padStart(2, '0'),
} as const;

/**
 * COURSES — Standardized course categories
 * Used across all filters and permissions
 * Based on courseLine categorization logic used throughout the app
 */
export const COURSES = ['Coding', 'Robotics', 'Art', 'Others'] as const;
export type Course = typeof COURSES[number];

export const COURSE_CATEGORY_COLORS: Record<Course, string> = {
  Coding: 'var(--status-success)',
  Robotics: 'var(--brand-indigo)',
  Art: 'var(--status-warning)',
  Others: 'var(--border-primary)',
};

export const COURSE_CATEGORY_ORDER: Record<Course, number> = {
  Coding: 0,
  Robotics: 1,
  Art: 2,
  Others: 3,
};

/**
 * CLASS STATUSES — Shared filtering rules for class-like LMS records
 */
export const CLASS_INACTIVE_STATUSES = new Set(['ABANDONED', 'REJECTED', 'CANCELLED', 'SUSPENDED', 'PREPARING']);

/**
 * LINEAR DESIGN SYSTEM COLORS — Chart colors with Linear Indigo as primary
 * Linear Indigo (#5e6ad2) is the singular chromatic accent per DESIGN.md
 * All other colors are supporting neutrals and status colors
 */
export const CHART_COLORS = {
  /** Primary chart color — Linear Indigo (brand accent) */
  PRIMARY: '#5e6ad2',
  
  /** Supporting chart colors — neutral and status tones */
  SECONDARY: ['#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'],
  
  /** Full palette for multi-series charts (Linear Indigo first) */
  PALETTE: ['#5e6ad2', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'],
} as const;
