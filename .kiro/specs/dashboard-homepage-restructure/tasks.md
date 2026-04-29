# Implementation Plan: Dashboard Homepage Restructure

## Overview

This implementation plan restructures the MindX KPI Dashboard homepage by moving the Completion Rate page to `/completion-rate` and creating a new Dashboard overview at `/` that aggregates key metrics from all pages. The implementation follows a cache-first approach, maximizes component reuse, and ensures permission-aware display.

## Tasks

- [x] 1. Phase 1: File Restructure
  - [x] 1.1 Create completion-rate directory and move page
    - Create `src/app/completion-rate/` directory
    - Move `src/app/page.tsx` to `src/app/completion-rate/page.tsx`
    - Verify all imports, styles, and dependencies work correctly
    - _Requirements: 1.1, 1.3_
  
  - [x] 1.2 Update hardcoded route references
    - Search codebase for hardcoded references to "/" route
    - Update any navigation links or router.push('/') calls to use '/completion-rate'
    - Verify no broken links remain
    - _Requirements: 1.4_
  
  - [x] 1.3 Test completion rate page at new route
    - Navigate to `/completion-rate` and verify page loads
    - Test all functionality (filters, data loading, charts, table)
    - Verify no console errors or TypeScript errors
    - _Requirements: 1.4_

- [x] 2. Phase 2: Navigation Update
  - [x] 2.1 Update navigation configuration
    - Add 'dashboard' to `PageKey` type in `src/lib/navigation.tsx`
    - Add 'dashboard' entry to `NAV_ITEMS` with label "Dashboard", icon `<Icon.BarChart />`, route '/'
    - Place 'dashboard' entry at first position in `NAV_ITEMS` object
    - Update 'completion' route from '/' to '/completion-rate'
    - Update 'completion' label from "Hoàn thành Khóa học" to "Tỷ lệ Hoàn thành"
    - _Requirements: 1.2, 1.5, 2.4, 9.1, 9.2, 9.3_
  
  - [x] 2.2 Update PageLayout navigation rendering
    - Update `PageLayout.tsx` to add "Dashboard" nav item at first position
    - Add support for `activePage="dashboard"` highlighting
    - Ensure "Dashboard" nav item navigates to '/'
    - Ensure "Tỷ lệ Hoàn thành" nav item navigates to '/completion-rate'
    - _Requirements: 9.4, 9.6_
  
  - [x] 2.3 Test navigation from all pages
    - Click "Dashboard" from each page and verify navigation to '/'
    - Click "Tỷ lệ Hoàn thành" from each page and verify navigation to '/completion-rate'
    - Verify active state highlights correctly on Dashboard page
    - _Requirements: 9.5, 9.6_

- [x] 3. Phase 3: Dashboard Components
  - [x] 3.1 Create dashboard components directory
    - Create `src/components/dashboard/` directory
    - _Requirements: 2.1_
  
  - [x] 3.2 Implement KPICard component
    - Create `src/components/dashboard/KPICard.tsx`
    - Implement props: label, value, description, color, icon, href, delay, lastUpdated
    - Add Framer Motion animation with opacity and y transition
    - Add click handler to navigate to href using Next.js router
    - Add hover effect with cursor pointer
    - _Requirements: 3.1, 3.5, 3.6, 3.7, 8.8_
  
  - [x] 3.3 Implement ActionableInsight component
    - Create `src/components/dashboard/ActionableInsight.tsx`
    - Implement props: title, description, severity, icon, href, delay
    - Add severity colors: good (var(--status-success)), warning (var(--status-warning)), critical (var(--status-error))
    - Add Framer Motion animation with opacity and y transition
    - Add click handler to navigate to href
    - Add left border colored by severity
    - Add chevron right icon at end
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10_
  
  - [x] 3.4 Add dashboard styles
    - Add styles to `src/app/dashboard.module.css` for:
      - `.kpiCard` - card container with hover effect
      - `.kpiHeader` - header with icon and label
      - `.kpiIcon` - icon styling
      - `.kpiLabel` - label text (13px, weight 600)
      - `.kpiValue` - value text (32px, weight 590)
      - `.kpiDescription` - description text (13px, weight 400)
      - `.kpiTimestamp` - timestamp text (11px, weight 400)
      - `.insightCard` - insight card with left border
      - `.insightHeader` - insight header
      - `.insightIcon` - insight icon
      - `.insightContent` - insight content wrapper
      - `.insightTitle` - insight title
      - `.insightDescription` - insight description
    - Use design tokens from `src/app/globals.css`
    - Follow spacing scale (var(--space-*))
    - Follow border radius scale (var(--radius-*))
    - _Requirements: 8.1, 8.6_

- [x] 4. Phase 4: Dashboard Page Implementation
  - [x] 4.1 Create new Dashboard page structure
    - Create new `src/app/page.tsx` with PageLayout wrapper
    - Set title="Dashboard" and activePage="dashboard"
    - Add two main sections: Stats (KPI Cards), Actionable Insights
    - Use semantic HTML (section elements with aria-labelledby)
    - _Requirements: 2.1, 2.2, 2.3, 9.5, 19.1, 19.2_
  
  - [x] 4.2 Implement cache reading logic
    - Import `getCache` from `@/lib/idb` and `CACHE_KEYS` from `@/constants`
    - Create state for all cache data: completionData, teacherChangeData, ticketsData, officeHoursData, classQualityData
    - Create loading and error states
    - Implement `loadCachedData()` function to read all caches in parallel
    - Handle cache read errors gracefully with try-catch
    - Set loading states appropriately
    - _Requirements: 6.1, 6.2, 6.6, 6.7, 11.1, 11.4, 16.2, 16.3, 16.4, 16.5_
  
  - [x] 4.3 Implement KPI calculation functions
    - Import KPI scoring functions from `@/lib/kpiScoring`
    - Implement `calculateCompletionRate()`: (totalPass / totalBase) * 100
    - Implement `calculateTeacherChangeRate()`: (classesWithChange / totalClasses) * 100
    - Implement `calculateSurveyScore()`: average of all teacher scores from tickets
    - Implement `calculateConversionRate()`: (paidSessions / trialSessions) * 100
    - Use `useMemo()` to cache calculations based on data dependencies
    - Return null for metrics when insufficient data
    - Handle calculation errors with try-catch, return null on error
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7, 11.2, 12.1, 12.2_
  
  - [ ]* 4.4 Write property test for KPI calculation consistency
    - **Property 1: KPI Calculation Consistency**
    - **Validates: Requirements 17.1, 17.2, 17.3, 17.4, 17.5**
    - Generate random cached data sets
    - Calculate KPI metrics multiple times
    - Assert all calculations produce identical results
    - Test with edge cases: empty data, zero values, null values
  
  - [x] 4.5 Implement alert logic with thresholds
    - Calculate "Lớp chưa thuyết trình" count from completion data (reason: DEMO_NOT_ARRANGED)
    - Calculate "Vi phạm Nhận xét" count from class quality data
    - Calculate "Cảnh báo Chuyên cần" count from class quality data
    - Calculate "Phiếu đánh giá mới" count from tickets data (status: NEW or OPEN)
    - Apply thresholds: demo ≥5, violations ≥10, attendance ≥5, tickets ≥1
    - Filter alerts to only show those meeting thresholds
    - Sort alerts by severity: error > warning > info
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 18.1, 18.2, 18.3, 18.4, 18.5_
  
  - [ ]* 4.6 Write property test for insight generation consistency
    - **Property 3: Insight Generation Consistency**
    - **Validates: Requirements 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9**
    - Generate random KPI data with varying values
    - For each insight type, test values below, at, and above thresholds
    - Assert insights only visible when conditions are met
    - Assert severity levels are correctly assigned based on thresholds
    - Test with edge cases: zero values, exactly at threshold, very large values
  
  - [x] 4.7 Implement KPI cards rendering with all 8 metrics
    - Create KPI cards array with data for all 8 metrics:
      1. Completion Rate (percentage-based, use completionColor)
      2. Teacher Change Rate (percentage-based, use teacherChangeColor)
      3. Survey Score (score-based, use surveyColor)
      4. Conversion Rate (percentage-based, use conversionColor)
      5. Multi-teacher Rate (percentage-based, use multiTeacherScore + kpiColor)
      6. Comment Violations (count-based, use count thresholds)
      7. Attendance Alerts (count-based, use count thresholds)
      8. New Tickets (count-based, use count thresholds)
    - Map cards to KPICard components with staggered animation delays
    - Use `ANIMATION.STAT_CARD_DELAY` for delay increment
    - Pass KPI colors from scoring functions
    - Format values using `FORMAT.percentage()` and `FORMAT.number()`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11_
  
  - [ ]* 4.8 Write property test for permission filtering
    - **Property 2: Permission Filtering**
    - **Validates: Requirements 9.2, 9.3**
    - Generate random sets of allowed pages
    - Render Dashboard with each permission set
    - Assert only KPI cards for allowed pages are displayed
    - Assert insights only show for allowed pages
    - Test with edge cases: empty allowedPages, single page, all pages
  
  - [x] 4.9 Implement actionable insights generation with severity calculation
    - Generate insights based on KPI thresholds:
      1. Demo Not Arranged (critical when count > 0)
      2. Completion Rate Gap (warning when < 95%, critical when < 80%)
      3. Comment Violations (info when 1-10, warning when 11-20, critical when > 20)
      4. Attendance Alerts (info when 1-6, warning when 7-10, critical when > 10)
      5. New Tickets (info when 1-10, warning when 11-20, critical when > 20)
      6. Teacher Change Rate (info when 3-5%, warning when 5-7%, critical when > 7%)
      7. Survey Score Low (info when 4.0-4.5, warning when 3.5-4.0, critical when < 3.5)
      8. Conversion Rate Low (info when 25-30%, warning when 15-25%, critical when < 15%)
    - Calculate severity based on thresholds
    - Filter insights to only show those meeting visibility criteria
    - Sort insights by severity: critical > warning > info
    - Limit to top 6 insights
    - Map to ActionableInsight components with staggered delays
    - Set href to detail pages with appropriate filters
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, 4.11, 4.12, 4.13_
  
  - [ ]* 4.10 Write property test for navigation consistency
    - **Property 4: Navigation Consistency**
    - **Validates: Requirements 3.11, 4.13**
    - Generate list of all clickable elements (KPI cards, insight cards)
    - For each element, simulate click
    - Assert navigation occurs to correct detail page
    - Assert no navigation errors occur
    - Test with all page types
  
  - [x] 4.11 Implement empty state and error handling
    - Show empty state when no cached data exists with message "Chưa có dữ liệu"
    - Show prompt "Vui lòng tải dữ liệu từ các trang chi tiết"
    - Display "N/A" for individual KPI metrics that fail calculation
    - Use `useToast()` hook for error notifications
    - Show loading spinner while loading cached data
    - _Requirements: 5.3, 5.6, 10.1, 10.2, 10.3, 10.5_
  
  - [ ]* 4.12 Write property test for cache read safety
    - **Property 5: Cache Read Safety**
    - **Validates: Requirements 10.1, 10.2, 10.5**
    - Test with missing cache entries (null/undefined)
    - Test with corrupted cache data (invalid JSON, wrong structure)
    - Assert Dashboard handles errors gracefully
    - Assert "N/A" or appropriate fallback displayed
    - Assert no crashes or unhandled exceptions
  
  - [x] 4.13 Implement refresh functionality
    - Add "Làm mới tất cả" button in toolbar
    - Implement `handleRefreshAll()` to clear all caches
    - Show confirmation toast after clearing caches
    - Prompt user to reload data from detail pages
    - _Requirements: 6.5_

- [x] 5. Phase 5: Constants and Content Update
  - [x] 5.1 Add new labels to constants
    - Add to `src/constants/index.ts` LABELS object:
      - `DASHBOARD: 'Dashboard'`
      - `ACTIONABLE_INSIGHTS: 'Gợi ý Hành động'`
      - `REFRESH_ALL: 'Làm mới tất cả'`
      - `LAST_UPDATED: 'Cập nhật lần cuối'`
      - `NO_DATA_AVAILABLE: 'Chưa có dữ liệu'`
      - `LOAD_DATA_PROMPT: 'Vui lòng tải dữ liệu từ các trang chi tiết'`
    - _Requirements: 13.1, 7.2_
  
  - [x] 5.2 Replace hardcoded text with constants
    - Search Dashboard page for hardcoded Vietnamese text
    - Replace all hardcoded text with LABELS constants
    - Use FORMAT helpers for number and percentage formatting
    - Verify all text displays correctly
    - _Requirements: 13.2, 13.3, 13.4, 7.2_

- [x] 6. Phase 6: Testing, Polish, and Verification
  - [x] 6.1 Test all 8 KPI calculations accuracy
    - Navigate to each detail page and note KPI values
    - Navigate to Dashboard and compare all 8 KPI values
    - Verify Dashboard KPIs match detail page calculations
    - Test count-based metrics (violations, alerts, tickets) match detail pages
    - Test with different date ranges and filters
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7, 16.8_
  
  - [x] 6.2 Test permission filtering (removed - no permission filtering needed)
  
  - [x] 6.3 Test responsive layout on all breakpoints
    - Test on desktop large (≥1400px) - verify 4 columns
    - Test on desktop medium (≥1024px) - verify 3 columns
    - Test on tablet (<1024px) - verify 2 columns
    - Test on mobile (<640px) - verify 1 column
    - Verify no overflow or layout issues
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 13.5_
  
  - [ ]* 6.4 Write property test for responsive layout adaptation
    - **Property 6: Responsive Layout Adaptation**
    - **Validates: Requirements 7.2, 7.3, 7.4, 7.5**
    - Test with various viewport widths
    - Assert correct number of columns per breakpoint
    - Assert no overflow occurs at any width
    - Test with different numbers of KPI cards (1-10)
  
  - [x] 6.3 Test navigation from all elements
    - Click each KPI card and verify navigation to correct page
    - Click each insight card and verify navigation with correct filters
    - Verify back button returns to Dashboard
    - _Requirements: 12.2, 3.11, 4.13_
  
  - [x] 6.4 Test error handling scenarios
    - Clear all caches and verify empty state displays
    - Corrupt cache data and verify error handling
    - Verify error toasts display for cache failures
    - Verify Dashboard doesn't crash on errors
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_
  
  - [x] 6.5 Run build and verify no errors
    - Run `npm run build` command
    - Verify build completes successfully with no errors
    - Verify no TypeScript errors
    - Verify no console errors in browser
    - _Requirements: 13.6, 13.7_
  
  - [x] 6.8 Test all routes after restructure
    - Navigate to '/' and verify Dashboard loads
    - Navigate to '/completion-rate' and verify Completion Rate page loads
    - Navigate to all other pages and verify they load correctly
    - Verify navigation between all pages works
    - _Requirements: 13.1, 13.8_
  
  - [x] 6.9 Accessibility verification
    - Verify semantic HTML structure (section, nav, button)
    - Verify heading hierarchy (h1 > h2)
    - Test keyboard navigation (Tab, Enter, Escape)
    - Verify focus states visible on interactive elements
    - Verify color contrast meets WCAG AA standards
    - Test with screen reader (basic verification)
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5, 19.6_
  
  - [x] 6.10 Performance verification
    - Verify Dashboard renders in <500ms with cached data
    - Verify KPI calculations use useMemo correctly
    - Verify no unnecessary re-renders
    - Check browser DevTools Performance tab
    - _Requirements: 12.1, 12.2, 12.3, 12.4_

- [x] 7. Checkpoint - Final verification
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional property-based tests and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from design document
- Implementation uses TypeScript/React with Next.js framework
- All components follow design system standards from `.kiro/steering/design-system.md`
- Cache-first approach: Dashboard only reads from IndexedDB, never writes
- Permission-aware: Uses `useAllowedPages()` hook to filter visible elements
- Responsive layout: 4/3/2/1 columns based on viewport width
- Component reuse: Maximizes use of existing UI components from `@/components/ui`

## Implementation Strategy

1. **Phase 1-2**: File restructure and navigation updates (low risk, foundational)
2. **Phase 3**: Component creation (isolated, can be developed in parallel)
3. **Phase 4**: Dashboard page implementation (core functionality, includes property tests)
4. **Phase 5**: Content standardization (quick polish)
5. **Phase 6**: Comprehensive testing and verification (quality assurance)

## Property-Based Tests Summary

The design document defines 6 correctness properties. Property tests are marked optional (`*`) to allow faster MVP delivery:

1. **Property 1**: KPI Calculation Consistency (Task 4.4)
2. **Property 2**: Permission Filtering (Task 4.8)
3. **Property 3**: Alert Threshold Enforcement (Task 4.6)
4. **Property 4**: Navigation Consistency (Task 4.11)
5. **Property 5**: Cache Read Safety (Task 4.13)
6. **Property 6**: Responsive Layout Adaptation (Task 6.4)

Each property test validates specific requirements and ensures correctness across all valid inputs.
