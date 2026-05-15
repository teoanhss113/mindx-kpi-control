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
  MANAGER_SCHEDULES: 'mindx_manager_schedules_v1',
  FILTER_STATE: 'mindx_filter_state_v1', // Shared filter state across pages
} as const;

export const TEACHER_SCHEDULE_CACHE_VERSION = 9;

/**
 * COLUMN LABELS — Standardized Vietnamese labelsconstant
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
  COPY: 'Sao chép',
  COPY_CLASS_CODE: 'Sao chép mã lớp',
  COPIED: 'Đã sao chép',
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

export const DATE_RANGE_LABELS = {
  CLEAR: 'Xoá',
  PLACEHOLDER: 'Chọn khoảng thời gian',
  RANGE_PLACEHOLDER: 'Khoảng thời gian',
  TODAY: 'Hôm nay',
  THIS_WEEK: 'Tuần này',
  PREVIOUS_WEEK: 'Tuần trước',
  NEXT_WEEK: 'Tuần sau',
  THIS_MONTH: 'Tháng này',
  PREVIOUS_MONTH: 'Tháng trước',
  NEXT_MONTH: 'Tháng sau',
} as const;

export const DATE_RANGE_PRESET_LABELS = [
  DATE_RANGE_LABELS.TODAY,
  DATE_RANGE_LABELS.THIS_WEEK,
  DATE_RANGE_LABELS.PREVIOUS_WEEK,
  DATE_RANGE_LABELS.NEXT_WEEK,
  DATE_RANGE_LABELS.THIS_MONTH,
  DATE_RANGE_LABELS.PREVIOUS_MONTH,
  DATE_RANGE_LABELS.NEXT_MONTH,
] as const;

export const SYSTEM_ADMIN_LABELS = {
  GROUP_TITLE: 'Quản trị Hệ thống',
  USERS_TITLE: 'Quản lý Tài khoản',
  USERS_NAV: 'Tài khoản',
  REGIONS_TITLE: 'Quản lý Khu vực',
  REGIONS_NAV: 'Khu vực',
  ROLES_TITLE: 'Quản lý Vai trò',
  ROLES_NAV: 'Vai trò',
  USAGE_TITLE: 'Phân tích Sử dụng',
  USAGE_NAV: 'Sử dụng',
} as const;

export const TEACHER_SCHEDULE_VIEW_OPTIONS = [
  { value: 'calendar', label: TEACHER_SCHEDULE_LABELS.CALENDAR_VIEW },
  { value: 'quality-table', label: TEACHER_SCHEDULE_LABELS.QUALITY_VIEW },
] as const;

export const MANAGER_SCHEDULE_LABELS = {
  PAGE_TITLE: 'Đăng ký lịch Quản lý',
  ADMIN_PAGE_TITLE: 'Lịch làm việc Quản lý',
  ADMIN_NAV_LABEL: 'Lịch quản lý',
  REGISTER_SECTION: 'Đăng ký lịch tuần',
  REGISTER_GRID_TITLE: 'Đăng ký theo từng buổi và cơ sở',
  STATS_SECTION: 'Thống kê lịch Quản lý',
  TABLE_SECTION: 'Danh sách đăng ký',
  CALENDAR_SECTION: 'Lịch đăng ký theo ngày và buổi',
  MANAGER: 'Quản lý',
  MANAGER_REGION: 'Khu vực quản lý',
  ROLE: 'Vai trò',
  WEEK_START: 'Tuần bắt đầu',
  WORK_SESSION: 'Buổi làm việc',
  SESSION_COLUMN: 'Buổi',
  SELECTED_SLOTS: 'Buổi đã chọn',
  TOTAL_REGISTRATIONS: 'Lượt đăng ký',
  TOTAL_SHIFTS: 'Tổng số buổi',
  ACTIVE_MANAGERS: 'Quản lý có lịch',
  BUSIEST_CENTRE: 'Cơ sở nhiều lịch nhất',
  WEEKEND_REQUIRED: 'Ngày bắt buộc',
  WEEKEND_MISSING: 'Thiếu lịch cuối tuần',
  WEEKEND_MISSING_SECTION: 'Quản lý chưa đăng ký ngày bắt buộc',
  WEEKEND_MISSING_DESC: 'Thứ 7/Chủ nhật cần tối thiểu 1 buổi/ngày',
  WEEKEND_REQUIRED_DAYS: 'Ngày bắt buộc trong kỳ',
  WEEKEND_COMPLIANT_MANAGERS: 'Quản lý đủ lịch',
  WEEKEND_MISSING_TABLE: 'Danh sách thiếu lịch cuối tuần',
  MANAGERS_BY_SHIFT_COUNT: 'Quản lý nhiều buổi nhất',
  LOW_MOBILITY: 'Ít luân chuyển cơ sở',
  LOW_MOBILITY_TABLE: 'Quản lý đăng ký lặp lại cùng cơ sở nhiều tuần',
  LOW_MOBILITY_DESC: 'Theo dõi quản lý ít thay đổi cơ sở làm việc qua các tuần',
  LOW_MOBILITY_EMPTY: 'Chưa có dấu hiệu lặp cơ sở qua nhiều tuần',
  REPEATED_CENTRE: 'Cơ sở lặp lại',
  REPEATED_PATTERN: 'Ngày/buổi lặp lại',
  REPEATED_PATTERNS: 'Các mẫu lặp',
  REPEATED_WEEKS: 'Số tuần lặp',
  REGISTERED_WEEKS: 'Tuần có lịch',
  REPEAT_RATE: 'Tỷ lệ lặp',
  MISSING_DATES: 'Ngày còn thiếu',
  REQUIRED_DATE: 'Ngày bắt buộc',
  MISSING_STATUS: 'Thiếu đăng ký',
  ALL_WEEKEND_REGISTERED: 'Tất cả quản lý đã đăng ký đủ ngày bắt buộc',
  REQUIRED_WEEKEND_BADGE: 'Bắt buộc',
  EMPTY_TITLE: 'Chưa có lịch làm việc',
  EMPTY_SUBTITLE: 'Chọn quản lý, cơ sở và các buổi trong tuần để tạo lịch',
  SEARCH_MANAGER: 'Tìm quản lý theo tên hoặc email...',
  ADD_SCHEDULE: 'Thêm lịch',
  CLEAR_SLOTS: 'Bỏ chọn',
  PREVIOUS_WEEK: 'Tuần trước',
  NEXT_WEEK: 'Tuần sau',
  REFRESH: 'Làm mới',
  CENTRE_PLACEHOLDER: 'Chọn cơ sở',
  SAVING_SLOT: 'Đang lưu...',
  EMPTY_SLOT: 'Chưa có ai đăng ký',
  SAVE_SUCCESS: 'Đã lưu lịch làm việc',
  DELETE_SUCCESS: 'Đã xoá lịch làm việc',
} as const;

export const MANAGER_REQUIRED_WEEKDAYS = [6, 0] as const;

export const MANAGER_WORK_SESSIONS = [
  { value: 'morning', label: 'Sáng', shortLabel: 'S', time: '08:00-12:00' },
  { value: 'afternoon', label: 'Chiều', shortLabel: 'C', time: '13:00-17:00' },
  { value: 'evening', label: 'Tối', shortLabel: 'T', time: '18:00-21:00' },
] as const;

export const WEEKDAY_OPTIONS = [
  { value: 1, label: 'Thứ 2' },
  { value: 2, label: 'Thứ 3' },
  { value: 3, label: 'Thứ 4' },
  { value: 4, label: 'Thứ 5' },
  { value: 5, label: 'Thứ 6' },
  { value: 6, label: 'Thứ 7' },
  { value: 0, label: 'Chủ nhật' },
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
  COMMENT_DETAIL_FILTER: 'Lọc lỗi nhận xét',
  ALL_COMMENT_DETAILS: 'Tất cả lỗi nhận xét',
  VISIBLE_CLASS_COUNT_SUFFIX: 'lớp',
} as const;

export const COMMENT_SLA_HOURS = {
  REGULAR: 48,
  CHECKPOINT_OR_FINAL: 72,
} as const;

export const COURSE_CHECKPOINT_SESSIONS = {
  Coding: [5, 9],
  Robotics: [4, 8],
  Art: [5, 9],
  Others: [5, 9],
} as const;

/**
 * Special checkpoint sessions for specific course codes
 * These override the category-level defaults
 */
export const COURSE_CODE_CHECKPOINT_SESSIONS: Record<string, number[]> = {
  // Robotics 4+ courses have checkpoints at sessions 5 and 9 instead of 4 and 8
  ROB4B: [5, 9],
  ROB4A: [5, 9],
  ROB4I: [5, 9],
};

export const TICKET_LABELS = {
  PAGE_TITLE: 'Phiếu Đánh giá',
  LIST_VIEW: 'Danh sách Phiếu',
  CLASS_ANALYSIS_VIEW: 'Phân tích theo Lớp',
  TOTAL_TICKETS_STAT: 'TỔNG PHIẾU',
  NEW_TICKETS_STAT: 'PHIẾU MỚI',
  RESOLVE_RATE_STAT: 'TỶ LỆ ĐÃ XỬ LÝ',
  LOW_SCORE: 'Điểm thấp (≤ 3.0)',
  TICKET_LIST: 'Danh sách Phiếu đánh giá',
  CLASS_ANALYSIS: 'Phân tích theo Lớp học',
  EMPTY_TITLE: 'Chưa có dữ liệu khảo sát',
  SEARCH_PLACEHOLDER: 'Mã phiếu, Lớp, Học viên, Nội dung...',
  TICKETS_BY_CENTRE: 'Số Phiếu Theo Cơ Sở',
  TICKETS_BY_COURSE_LINE: 'Số Phiếu Theo Khối',
  AVG_SCORE_GV: 'ĐIỂM TRUNG BÌNH (GIÁO VIÊN)',
  PENDING_SURVEYS: 'Cần khảo sát',
} as const;

export const KPI_LABELS = {
  SCORE: 'KPI SCORE',
  COMPLETION_RATE: 'TỶ LỆ HOÀN THÀNH',
  TEACHER_CHANGE_RATE: 'TỶ LỆ THAY GV CHÍNH (LEC)',
  MULTI_TEACHER_RATE: 'TỶ LỆ LỚP CÓ 3+ GIÁO VIÊN',
  SURVEY_SCORE: 'ĐIỂM KHẢO SÁT GIÁO VIÊN',
  TEACHER_POINT_RATE: 'TỶ LỆ LẤY KHẢO SÁT GIÁO VIÊN',
  CONVERSION_RATE: 'TỶ LỆ CHUYỂN ĐỔI',
  DATA_SCOPE: 'PHẠM VI DỮ LIỆU',
  NEW_TICKETS: 'PHIẾU MỚI',
  RESOLVE_RATE: 'TỶ LỆ ĐÃ XỬ LÝ',
  TRIAL_STUDENTS: 'HỌC VIÊN HỌC THỬ',
  COMMENT_QUALITY: 'NHẬN XÉT LỚP HỌC',
  ATTENDANCE_QUALITY: 'CHUYÊN CẦN HỌC VIÊN',
  NEW_FEEDBACK: 'PHIẾU PHẢN HỒI MỚI',
} as const;

export const KPI_DESCRIPTIONS = {
  COMPLETION_RATE: 'Theo ngưỡng tỷ lệ hoàn thành',
  TEACHER_CHANGE_RATE: 'Theo ngưỡng tỷ lệ thay GV chính',
  MULTI_TEACHER_RATE: 'Theo ngưỡng lớp có 3+ Giáo viên',
  SURVEY_SCORE: 'Theo ngưỡng điểm khảo sát Giáo viên',
  TEACHER_POINT_RATE: 'Theo ngưỡng tỷ lệ lấy Khảo sát Giáo viên',
  CONVERSION_RATE: 'Theo ngưỡng tỷ lệ học thử sang đơn hàng',
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
