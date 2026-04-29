# Requirements Document

## Introduction

Tài liệu này mô tả yêu cầu cho việc tái cấu trúc trang chủ MindX KPI Dashboard. Hiện tại, đường dẫn "/" đang hiển thị trang "Tỷ lệ Hoàn thành" (Completion Rate). Mục tiêu là chuyển trang này sang đường dẫn mới và tạo một Dashboard tổng quan mới tại "/" để hiển thị thông tin quan trọng từ tất cả các trang.

## Glossary

- **Dashboard**: Trang tổng quan hiển thị các chỉ số KPI quan trọng từ tất cả các trang
- **Completion_Rate_Page**: Trang hiển thị tỷ lệ hoàn thành khóa học của học viên
- **KPI_Card**: Component hiển thị một chỉ số KPI với giá trị, màu sắc theo hiệu suất, và link đến trang chi tiết
- **Alert_Card**: Component hiển thị cảnh báo hoặc vấn đề cần chú ý
- **ActionableInsight**: Component hiển thị gợi ý hành động với severity level và link đến trang chi tiết
- **Navigation_System**: Hệ thống điều hướng sidebar của ứng dụng
- **PageLayout**: Component layout chính bao bọc tất cả các trang
- **Router**: Next.js router để điều hướng giữa các trang

## Requirements

### Requirement 1: Di chuyển Completion Rate Page

**User Story:** Là một người dùng, tôi muốn truy cập trang Tỷ lệ Hoàn thành qua đường dẫn mới, để trang chủ "/" có thể được sử dụng cho Dashboard tổng quan.

#### Acceptance Criteria

1. THE System SHALL di chuyển nội dung hiện tại của `src/app/page.tsx` sang `src/app/completion-rate/page.tsx`
2. THE System SHALL cập nhật navigation configuration trong `src/lib/navigation.tsx` để route của 'completion' page trỏ đến '/completion-rate'
3. THE System SHALL đảm bảo tất cả imports, styles, và dependencies hoạt động chính xác sau khi di chuyển
4. WHEN người dùng truy cập '/completion-rate', THE System SHALL hiển thị trang Tỷ lệ Hoàn thành với đầy đủ chức năng như trước
5. THE System SHALL cập nhật label trong navigation từ "Hoàn thành Khóa học" thành "Tỷ lệ Hoàn thành" để rõ ràng hơn

### Requirement 2: Tạo Dashboard Overview Page

**User Story:** Là một người dùng, tôi muốn thấy tổng quan các chỉ số quan trọng khi truy cập trang chủ, để nhanh chóng nắm bắt tình hình chung mà không cần vào từng trang chi tiết.

#### Acceptance Criteria

1. THE System SHALL tạo trang mới tại `src/app/page.tsx` với title "Dashboard"
2. THE System SHALL hiển thị page title là "Dashboard" trong PageLayout
3. THE System SHALL sử dụng icon phù hợp cho Dashboard (BarChart hoặc PieChart icon)
4. THE System SHALL cập nhật navigation configuration để thêm 'dashboard' page với route '/' ở vị trí đầu tiên trong sidebar
5. THE System SHALL đảm bảo Dashboard page tuân theo design system trong `.kiro/steering/design-system.md`

### Requirement 3: Hiển thị KPI Cards từ các trang

**User Story:** Là một người dùng, tôi muốn thấy các chỉ số KPI quan trọng nhất từ tất cả các trang trên Dashboard, để nhanh chóng đánh giá hiệu suất tổng thể.

#### Acceptance Criteria

1. THE Dashboard SHALL hiển thị KPI card cho "Tỷ lệ Hoàn thành" với giá trị tổng thể, màu sắc theo `completionColor()`, và link đến '/completion-rate'
2. THE Dashboard SHALL hiển thị KPI card cho "Tỷ lệ thay đổi GV" với giá trị tổng thể, màu sắc theo `teacherChangeColor()`, và link đến '/teacher-change'
3. THE Dashboard SHALL hiển thị KPI card cho "Điểm TB Khảo sát" với giá trị trung bình, màu sắc theo `surveyColor()`, và link đến '/tickets'
4. THE Dashboard SHALL hiển thị KPI card cho "Tỷ lệ chuyển đổi" với giá trị tổng thể, màu sắc theo `conversionColor()`, và link đến '/office-hours'
5. THE Dashboard SHALL hiển thị KPI card cho "Tỷ lệ lớp có 3+ GV" với giá trị tổng thể, màu sắc theo `multiTeacherScore()` và `kpiColor()`, và link đến '/teacher-change'
6. THE Dashboard SHALL hiển thị KPI card cho "Vi phạm Nhận xét" với tổng số vi phạm (brief + empty + duplicate), màu sắc theo count-based thresholds (0=green, 1-5=lime, 6-10=amber, 11-20=orange, >20=red), và link đến '/class-quality'
7. THE Dashboard SHALL hiển thị KPI card cho "Cảnh báo Chuyên cần" với tổng số cảnh báo (frequent + consecutive + late-stage), màu sắc theo count-based thresholds (0=green, 1-3=lime, 4-6=amber, 7-10=orange, >10=red), và link đến '/class-quality'
8. THE Dashboard SHALL hiển thị KPI card cho "Phiếu đánh giá mới" với số lượng tickets có status 'NEW' hoặc 'OPEN', màu sắc theo count-based thresholds (0=green, 1-5=lime, 6-10=amber, 11-20=orange, >20=red), và link đến '/tickets'
9. THE Dashboard SHALL sử dụng `KPICard` component từ `@/components/dashboard` để hiển thị các KPI cards (reuse existing component)
10. THE Dashboard SHALL hiển thị các KPI cards trong responsive grid layout với animation delay theo `ANIMATION.STAT_CARD_DELAY`
11. WHEN người dùng click vào một KPI card, THE System SHALL điều hướng đến trang chi tiết tương ứng

### Requirement 4: Hiển thị Actionable Insights

**User Story:** Là một người dùng, tôi muốn thấy các insights và gợi ý hành động cụ thể trên Dashboard, để biết cần xử lý vấn đề gì và ưu tiên như thế nào.

#### Acceptance Criteria

1. THE Dashboard SHALL hiển thị section "Gợi ý Hành động" với các insights dựa trên dữ liệu KPI
2. THE Dashboard SHALL hiển thị insight "X lớp chưa sắp xếp thuyết trình cuối khóa" khi có lớp với lý do `DEMO_NOT_ARRANGED`, với severity 'critical' và link đến '/completion-rate?filter=demo'
3. THE Dashboard SHALL hiển thị insight "Tỷ lệ hoàn thành đang ở mức X% - Cần thêm Y HV để đạt 95%" khi completion rate < 95%, với severity 'warning' và link đến '/completion-rate'
4. THE Dashboard SHALL hiển thị insight "X vi phạm nhận xét cần kiểm tra" khi có comment violations > 0, với severity dựa trên count (>20=critical, 11-20=warning, 1-10=info) và link đến '/class-quality?tab=violations'
5. THE Dashboard SHALL hiển thị insight "X cảnh báo chuyên cần cần theo dõi" khi có attendance alerts > 0, với severity dựa trên count (>10=critical, 7-10=warning, 1-6=info) và link đến '/class-quality?tab=attendance'
6. THE Dashboard SHALL hiển thị insight "X phiếu đánh giá mới cần xử lý" khi có tickets với status 'NEW' hoặc 'OPEN', với severity dựa trên count (>20=critical, 11-20=warning, 1-10=info) và link đến '/tickets?status=new'
7. THE Dashboard SHALL hiển thị insight "Tỷ lệ thay GV đang ở mức X% - Mục tiêu dưới 3%" khi teacher change rate > 3%, với severity dựa trên rate (>7%=critical, 5-7%=warning, 3-5%=info) và link đến '/teacher-change'
8. THE Dashboard SHALL hiển thị insight "Điểm khảo sát đang ở mức X - Cần cải thiện" khi survey score < 4.5, với severity dựa trên score (<3.5=critical, 3.5-4.0=warning, 4.0-4.5=info) và link đến '/tickets'
9. THE Dashboard SHALL hiển thị insight "Tỷ lệ chuyển đổi đang ở mức X% - Mục tiêu trên 30%" khi conversion rate < 30%, với severity dựa trên rate (<15%=critical, 15-25%=warning, 25-30%=info) và link đến '/office-hours'
10. THE Dashboard SHALL sử dụng `ActionableInsight` component từ `@/components/dashboard` để hiển thị insights (reuse existing component)
11. THE Dashboard SHALL sắp xếp insights theo severity: critical > warning > info
12. THE Dashboard SHALL hiển thị tối đa 6 insights quan trọng nhất
13. WHEN người dùng click vào một insight, THE System SHALL điều hướng đến trang chi tiết với filter tương ứng

### Requirement 5: Data Fetching Strategy

**User Story:** Là một người dùng, tôi muốn Dashboard load nhanh và hiển thị dữ liệu mới nhất, để có trải nghiệm tốt khi sử dụng.

#### Acceptance Criteria

1. THE Dashboard SHALL sử dụng cached data từ IndexedDB cho các KPI metrics
2. THE Dashboard SHALL hiển thị loading state khi đang fetch data
3. THE Dashboard SHALL hiển thị empty state với hướng dẫn khi chưa có data trong cache
4. THE Dashboard SHALL hiển thị last updated timestamp cho mỗi KPI section
5. THE Dashboard SHALL cung cấp nút "Làm mới tất cả" để refresh toàn bộ data
6. WHEN cache không có data, THE Dashboard SHALL hiển thị placeholder values với note "Chưa có dữ liệu"
7. WHEN cache có data, THE Dashboard SHALL tính toán KPI metrics từ cached data mà không cần fetch lại

### Requirement 6: Responsive Layout

**User Story:** Là một người dùng, tôi muốn Dashboard hiển thị tốt trên các kích thước màn hình khác nhau, để có thể xem trên laptop hoặc màn hình lớn.

#### Acceptance Criteria

1. THE Dashboard SHALL sử dụng CSS Grid với responsive breakpoints
2. THE Dashboard SHALL hiển thị 4 columns cho KPI cards trên màn hình lớn (≥1400px)
3. THE Dashboard SHALL hiển thị 3 columns cho KPI cards trên màn hình trung bình (≥1024px)
4. THE Dashboard SHALL hiển thị 2 columns cho KPI cards trên màn hình nhỏ (<1024px)
5. THE Dashboard SHALL đảm bảo tất cả elements có min-width phù hợp để tránh overflow

### Requirement 7: Design System Compliance

**User Story:** Là một developer, tôi muốn Dashboard tuân theo design system hiện có, để đảm bảo tính nhất quán về mặt hình ảnh và code.

#### Acceptance Criteria

1. THE Dashboard SHALL sử dụng design tokens từ `src/app/globals.css`
2. THE Dashboard SHALL sử dụng labels và messages từ `src/constants/index.ts`
3. THE Dashboard SHALL sử dụng components từ `@/components/ui` (StatCard, Icon, EmptyState, Spinner)
4. THE Dashboard SHALL sử dụng KPI scoring functions từ `@/lib/kpiScoring.ts`
5. THE Dashboard SHALL sử dụng animation timing từ `ANIMATION` constants
6. THE Dashboard SHALL sử dụng `styles` từ `dashboard.module.css` cho styling
7. THE Dashboard SHALL tuân theo naming conventions: camelCase cho variables, PascalCase cho components
8. THE Dashboard SHALL sử dụng Framer Motion cho animations với timing chuẩn

### Requirement 8: Navigation Integration

**User Story:** Là một người dùng, tôi muốn Dashboard được tích hợp vào navigation system, để có thể truy cập dễ dàng từ sidebar.

#### Acceptance Criteria

1. THE System SHALL thêm 'dashboard' page vào `PageKey` type trong `src/lib/navigation.tsx`
2. THE System SHALL thêm 'dashboard' entry vào `NAV_ITEMS` với label "Dashboard", icon `<Icon.BarChart />`, và route '/'
3. THE System SHALL đặt 'dashboard' entry ở vị trí đầu tiên trong `NAV_ITEMS` object
4. THE System SHALL cập nhật `getNavItemsWithRouter()` để hỗ trợ 'dashboard' page
5. THE Dashboard page SHALL sử dụng `PageLayout` component với `activePage="dashboard"`
6. WHEN người dùng ở Dashboard page, THE System SHALL highlight "Dashboard" item trong sidebar

### Requirement 9: Permission và Access Control

**User Story:** Là một người dùng, tôi muốn Dashboard chỉ hiển thị KPI cards và insights cho các trang tôi có quyền truy cập, để không thấy thông tin không liên quan.

#### Acceptance Criteria

1. THE Dashboard SHALL sử dụng `useAllowedPages()` hook để lấy danh sách trang được phép truy cập
2. THE Dashboard SHALL chỉ hiển thị KPI cards cho các trang trong `allowedPages` list
3. THE Dashboard SHALL chỉ hiển thị insights cho các trang trong `allowedPages` list
4. WHEN người dùng không có quyền truy cập bất kỳ trang nào, THE Dashboard SHALL hiển thị empty state với message "Bạn chưa có quyền truy cập"
5. THE Dashboard SHALL luôn hiển thị cho tất cả users có quyền đăng nhập (không cần permission riêng)

### Requirement 10: Error Handling

**User Story:** Là một người dùng, tôi muốn thấy thông báo rõ ràng khi có lỗi xảy ra, để biết cách xử lý.

#### Acceptance Criteria

1. WHEN cache read fails, THE Dashboard SHALL hiển thị error message "Không thể tải dữ liệu. Vui lòng thử lại."
2. WHEN KPI calculation fails, THE Dashboard SHALL hiển thị "N/A" cho metric đó
3. THE Dashboard SHALL sử dụng `useToast()` hook để hiển thị error messages
4. THE Dashboard SHALL log errors to console với context đầy đủ
5. THE Dashboard SHALL không crash khi một KPI metric fails, các metrics khác vẫn hiển thị bình thường

### Requirement 11: Performance Optimization

**User Story:** Là một người dùng, tôi muốn Dashboard load nhanh và mượt mà, để có trải nghiệm tốt.

#### Acceptance Criteria

1. THE Dashboard SHALL sử dụng `useMemo()` để cache KPI calculations
2. THE Dashboard SHALL chỉ re-calculate KPIs khi cached data thay đổi
3. THE Dashboard SHALL sử dụng lazy loading cho heavy components nếu cần
4. THE Dashboard SHALL render trong vòng 500ms với cached data
5. THE Dashboard SHALL sử dụng skeleton loading states cho các sections đang load

### Requirement 12: Testing và Verification

**User Story:** Là một developer, tôi muốn đảm bảo Dashboard hoạt động chính xác, để tránh bugs trong production.

#### Acceptance Criteria

1. THE System SHALL verify rằng tất cả routes hoạt động chính xác sau khi restructure
2. THE System SHALL verify rằng navigation links điều hướng đúng trang
3. THE System SHALL verify rằng KPI calculations chính xác bằng cách so sánh với trang chi tiết
4. THE System SHALL verify rằng permissions filtering hoạt động chính xác
5. THE System SHALL verify rằng responsive layout hiển thị tốt trên các breakpoints
6. THE System SHALL run `npm run build` thành công không có errors
7. THE System SHALL verify rằng không có TypeScript errors
8. THE System SHALL verify rằng tất cả pages load correctly sau khi deploy

### Requirement 13: Content và Labels

**User Story:** Là một người dùng, tôi muốn thấy labels và messages rõ ràng bằng tiếng Việt, để dễ hiểu.

#### Acceptance Criteria

1. THE System SHALL thêm labels mới vào `src/constants/index.ts` cho Dashboard:
   - `LABELS.DASHBOARD`: "Dashboard"
   - `LABELS.ACTIONABLE_INSIGHTS`: "Gợi ý Hành động"
   - `LABELS.REFRESH_ALL`: "Làm mới tất cả"
   - `LABELS.LAST_UPDATED`: "Cập nhật lần cuối"
   - `LABELS.NO_PERMISSION`: "Bạn chưa có quyền truy cập"
2. THE Dashboard SHALL sử dụng labels từ constants thay vì hardcoded text
3. THE Dashboard SHALL hiển thị tất cả text bằng tiếng Việt
4. THE Dashboard SHALL sử dụng `FORMAT` helpers từ constants cho formatting

### Requirement 14: Component Reuse

**User Story:** Là một developer, tôi muốn tái sử dụng components hiện có, để đảm bảo consistency và giảm code duplication.

#### Acceptance Criteria

1. THE Dashboard SHALL sử dụng `StatCard` component cho KPI cards
2. THE Dashboard SHALL sử dụng `Icon` components từ `@/components/ui`
3. THE Dashboard SHALL sử dụng `EmptyState` component khi không có data
4. THE Dashboard SHALL sử dụng `Spinner` component cho loading states
5. THE Dashboard SHALL sử dụng `PageLayout` component cho layout wrapper
6. THE Dashboard SHALL sử dụng `useToast()` hook cho notifications
7. THE Dashboard SHALL sử dụng `useAllowedPages()` hook cho permissions
8. THE Dashboard SHALL không tạo components mới nếu có thể reuse components hiện có

### Requirement 15: Cache Keys và Data Management

**User Story:** Là một developer, tôi muốn Dashboard sử dụng cache keys chuẩn, để dễ maintain và debug.

#### Acceptance Criteria

1. THE Dashboard SHALL sử dụng `CACHE_KEYS` từ `src/constants/index.ts`
2. THE Dashboard SHALL đọc data từ các cache keys sau:
   - `CACHE_KEYS.COMPLETION` cho completion rate data
   - `CACHE_KEYS.TEACHER_CHANGE` cho teacher change data
   - `CACHE_KEYS.TICKETS` cho tickets data
   - `CACHE_KEYS.OFFICE_HOURS` cho office hours data
   - `CACHE_KEYS.CLASS_QUALITY` cho class quality data
3. THE Dashboard SHALL sử dụng `getCache()` function từ `@/lib/idb` để đọc cache
4. THE Dashboard SHALL không modify cached data
5. THE Dashboard SHALL handle missing cache gracefully với fallback values

### Requirement 16: KPI Calculation Logic

**User Story:** Là một người dùng, tôi muốn các KPI metrics trên Dashboard chính xác, để đưa ra quyết định đúng đắn.

#### Acceptance Criteria

1. FOR "Tỷ lệ Hoàn thành", THE Dashboard SHALL tính: (tổng học viên passed / tổng học viên base) * 100
2. FOR "Tỷ lệ thay đổi GV", THE Dashboard SHALL tính: (số lớp có LEC change / tổng số lớp) * 100
3. FOR "Điểm TB Khảo sát", THE Dashboard SHALL tính: trung bình cộng của tất cả teacher scores từ tickets
4. FOR "Tỷ lệ chuyển đổi Ca trực", THE Dashboard SHALL tính: (số ca Trial chuyển thành paid / tổng số ca Trial) * 100
5. FOR "Tỷ lệ lớp có 3+ GV", THE Dashboard SHALL tính: (số lớp có ≥3 teachers (LEC + SUPPLY, no TA) / tổng số lớp) * 100
6. FOR "Vi phạm Nhận xét", THE Dashboard SHALL tính: tổng số (brief + empty + duplicate) comments từ class quality data
7. FOR "Cảnh báo Chuyên cần", THE Dashboard SHALL tính: tổng số (frequent + consecutive + late-stage) attendance alerts từ class quality data
8. FOR "Phiếu đánh giá mới", THE Dashboard SHALL tính: số lượng tickets có status 'NEW' hoặc 'OPEN'
9. THE Dashboard SHALL sử dụng cùng logic tính toán như các trang chi tiết
10. THE Dashboard SHALL hiển thị "N/A" khi không đủ data để tính toán
11. THE Dashboard SHALL format numbers theo `FORMAT.percentage()` và `FORMAT.number()` từ constants

### Requirement 17: Insight Generation Logic

**User Story:** Là một người dùng, tôi muốn insights được tạo tự động dựa trên thresholds rõ ràng, để biết khi nào cần hành động.

#### Acceptance Criteria

1. THE Dashboard SHALL tạo insight "X lớp chưa sắp xếp thuyết trình cuối khóa - Cần xử lý" khi có ≥1 lớp với lý do `DEMO_NOT_ARRANGED`
2. THE Dashboard SHALL tạo insight "Tỷ lệ hoàn thành đang ở mức X% - Cần thêm Y HV để đạt 95%" khi completion rate < 95%
3. THE Dashboard SHALL tạo insight "X vi phạm nhận xét cần kiểm tra" khi có ≥1 comment violation
4. THE Dashboard SHALL tạo insight "X cảnh báo chuyên cần cần theo dõi" khi có ≥1 attendance alert
5. THE Dashboard SHALL tạo insight "X phiếu đánh giá mới cần xử lý" khi có ≥1 ticket với status 'NEW' hoặc 'OPEN'
6. THE Dashboard SHALL tạo insight "Tỷ lệ thay GV đang ở mức X% - Cần giảm xuống dưới Y%" khi teacher change rate > 3%
7. THE Dashboard SHALL tính toán severity cho mỗi insight: critical (red) khi vượt ngưỡng cao, warning (amber) khi gần ngưỡng, good (green) khi dưới ngưỡng
8. THE Dashboard SHALL sắp xếp insights theo severity: critical > warning > info
9. THE Dashboard SHALL hiển thị tối đa 6 insights quan trọng nhất

### Requirement 18: Count-Based Color Thresholds

**User Story:** Là một developer, tôi muốn có thresholds rõ ràng cho count-based metrics, để đảm bảo màu sắc nhất quán.

#### Acceptance Criteria

1. FOR "Vi phạm Nhận xét" count, THE Dashboard SHALL sử dụng thresholds: 0=green (#059669), 1-5=lime (#84cc16), 6-10=amber (#d97706), 11-20=orange (#f97316), >20=red (#dc2626)
2. FOR "Cảnh báo Chuyên cần" count, THE Dashboard SHALL sử dụng thresholds: 0=green (#059669), 1-3=lime (#84cc16), 4-6=amber (#d97706), 7-10=orange (#f97316), >10=red (#dc2626)
3. FOR "Phiếu đánh giá mới" count, THE Dashboard SHALL sử dụng thresholds: 0=green (#059669), 1-5=lime (#84cc16), 6-10=amber (#d97706), 11-20=orange (#f97316), >20=red (#dc2626)
4. THE Dashboard SHALL tạo helper function `getCountColor(count: number, thresholds: number[]): string` để tính màu dựa trên count
5. THE Dashboard SHALL sử dụng cùng màu sắc từ `KPI_COLORS` trong `src/lib/kpiScoring.ts` để đảm bảo nhất quán

### Requirement 19: Accessibility

**User Story:** Là một người dùng, tôi muốn Dashboard dễ sử dụng và accessible, để mọi người đều có thể truy cập.

#### Acceptance Criteria

1. THE Dashboard SHALL sử dụng semantic HTML elements (section, nav, button)
2. THE Dashboard SHALL có proper heading hierarchy (h1 > h2 > h3)
3. THE Dashboard SHALL có sufficient color contrast cho text và backgrounds
4. THE Dashboard SHALL có focus states rõ ràng cho interactive elements
5. THE Dashboard SHALL có alt text cho icons quan trọng
6. THE Dashboard SHALL support keyboard navigation (Tab, Enter, Escape)

### Requirement 20: Documentation

**User Story:** Là một developer, tôi muốn có documentation rõ ràng cho Dashboard, để dễ maintain và extend.

#### Acceptance Criteria

1. THE Dashboard file SHALL có JSDoc comments cho main component
2. THE Dashboard file SHALL có comments giải thích KPI calculation logic
3. THE Dashboard file SHALL có comments cho complex useMemo dependencies
4. THE Dashboard file SHALL có TODO comments cho future improvements nếu có
5. THE System SHALL cập nhật README.md với thông tin về Dashboard page nếu cần
