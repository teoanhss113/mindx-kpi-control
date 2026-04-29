# Category 4: Layout Consistency Audit

**Date:** 2026-04-24  
**Status:** In Progress

---

## Objective

Audit and document page structure consistency across all dashboard pages to ensure:
1. Consistent component order
2. Consistent alignment patterns
3. Appropriate positioning usage
4. Uniform user experience

---

## Expected Structure Pattern

Based on design system, pages should follow this structure:

1. **Toolbar** - Date range, centre selection, fetch controls
2. **Stats Grid** - 3-4 stat cards showing key metrics
3. **Suggestions Bar** - Optional, conditional on data
4. **Charts Section** - Collapsible, 2-column grid
5. **Table Section** - With filters, sorting, data display

---

## Page Structure Audit

### 1. Main Dashboard (`src/app/page.tsx`)

**Structure Found:**
```
PageLayout
├── Toolbar (implicit in fetch controls)
├── Stats Grid ✅
│   ├── Tỷ lệ hoàn thành
│   ├── Điểm TB (GV)
│   ├── Điểm TB (HV)
│   └── Số lớp
├── Suggestions Bar ✅ (conditional)
├── Charts Section ✅
│   ├── Theo Cơ sở
│   ├── Theo Khối học
│   ├── Theo Giáo viên
│   └── Theo Trạng thái
├── Table Section ✅ (Normal classes)
├── Table Section ✅ (Cancelled classes - conditional)
└── Right Panel
    └── Charts Section (Exemption panel)
```

**Status:** ✅ Follows expected pattern  
**Notes:** 
- Has additional right panel for exemption settings
- Cancelled classes shown separately with reduced opacity
- All sections present and in correct order

---

### 2. Class Quality (`src/app/class-quality/page.tsx`)

**Structure Found:**
```
PageLayout
├── Toolbar (implicit in fetch controls)
├── Stats Grid ✅
│   ├── Tỷ lệ hoàn thành
│   ├── Điểm TB (GV)
│   ├── Điểm TB (HV)
│   └── Số lớp
├── Charts Section ✅
│   ├── Tỷ lệ hoàn thành theo cơ sở
│   └── Điểm trung bình theo cơ sở
├── Table Section ✅ (Normal classes)
├── Table Section ✅ (Cancelled classes - conditional)
└── Right Panel
    └── Charts Section (Filters)
```

**Status:** ✅ Follows expected pattern  
**Notes:**
- No suggestions bar (not applicable for this page)
- Similar structure to main dashboard
- Right panel for filters instead of exemptions

---

### 3. Teacher Change (`src/app/teacher-change/page.tsx`)

**Structure Found:**
```
PageLayout
├── Toolbar (implicit in fetch controls)
├── Stats Grid ✅
│   ├── Tỷ lệ thay đổi GV
│   ├── Số lớp bị thay
│   ├── Số GV tham gia
│   └── Số lần thay đổi
├── Suggestions Bar ✅ (warning style)
├── Charts Section ✅
│   ├── Theo Cơ sở
│   ├── Theo Khối học
│   └── Theo Giáo viên
├── Table Section ✅ (Classes with changes)
└── Table Section ✅ (Cancelled classes - conditional)
```

**Status:** ✅ Follows expected pattern  
**Notes:**
- Suggestions bar styled as warning (red theme)
- All sections present and in correct order
- Consistent with main dashboard pattern

---

### 4. Teacher Schedule (`src/app/teacher-schedule/page.tsx`)

**Structure Found:**
```
PageLayout
├── Toolbar (implicit in fetch controls)
├── Calendar View (unique to this page)
├── Stats Grid ✅
│   ├── Tổng số ca
│   ├── Số giáo viên
│   ├── Trung bình ca/GV
│   └── Tổng giờ dạy
├── Table Section ✅ (Teacher list)
└── Charts Section ✅ (Coordination modal)
```

**Status:** ⚠️ Different structure (intentional)  
**Notes:**
- Has unique calendar view at top (specific to scheduling)
- Stats grid comes after calendar
- No charts section in main view (only in modal)
- Structure variation is **intentional** for this page type

---

### 5. Office Hours (`src/app/office-hours/page.tsx`)

**Structure Found:**
```
PageLayout
├── Toolbar (implicit in fetch controls)
├── Stats Grid ✅
│   ├── Tổng số ca
│   ├── Tỷ lệ có GV
│   ├── Tỷ lệ phê duyệt
│   └── Tỷ lệ chuyển đổi
├── Charts Section ✅
│   ├── Theo Cơ sở
│   ├── Theo Khối học
│   └── Theo Giáo viên
├── Table Section ✅ (Office hours list)
└── Charts Section ✅ (Exemption panel - right side)
```

**Status:** ✅ Follows expected pattern  
**Notes:**
- No suggestions bar (not applicable)
- Right panel for exemption settings
- Consistent with main dashboard pattern

---

### 6. Tickets (`src/app/tickets/page.tsx`)

**Structure Found:**
```
PageLayout
├── Toolbar (implicit in fetch controls)
├── Stats Grid ✅
│   ├── Tổng số phiếu
│   ├── Đang xử lý
│   ├── Đã giải quyết
│   └── Thời gian TB
├── Charts Section ✅
│   ├── Theo Loại
│   ├── Theo Trạng thái
│   └── Theo Ưu tiên
└── Table Section ✅ (Tickets list)
```

**Status:** ✅ Follows expected pattern  
**Notes:**
- No suggestions bar (not applicable)
- All sections present and in correct order
- Consistent with main dashboard pattern

---

## Alignment Patterns Audit

### CSS Alignment Usage

Checked all `align-items` declarations in `dashboard.module.css`:

**Pattern 1: `align-items: center`** (Single-line content)
- Used for: Buttons, icons, single-line labels, toolbar items
- Examples:
  - `.sidebarLink` - Icon + text
  - `.headerLeft` - Logo + title
  - `.primaryBtn` - Icon + label
  - `.filterChip` - Icon + text
  - `.legendItem` - Swatch + label

**Pattern 2: `align-items: start`** (Multi-line/wrapping content)
- Used for: Table rows with wrapping content, reason columns
- Examples:
  - `.classItemHeader` - Table row with reasons that wrap
  - `.reasonItem` - Checkbox + multi-line label
  - `.dashboardLayout` - Grid with varying height items

**Status:** ✅ Consistent and appropriate  
**Reasoning:** 
- `center` for single-line = proper vertical centering
- `start` for multi-line = prevents awkward centering of wrapped text
- All usage is intentional and follows best practices

---

## Positioning Patterns Audit

### CSS Position Usage

Checked all `position` declarations in `dashboard.module.css`:

**Pattern 1: `position: fixed`**
- `.sidebar` - Fixed sidebar (mobile: off-canvas drawer)
- **Status:** ✅ Appropriate for persistent navigation

**Pattern 2: `position: sticky`**
- `.header` - Sticky header at top
- `.filterPanel` - Sticky filter panel (desktop only)
- `.tableHeader` - Sticky table header
- **Status:** ✅ Appropriate for persistent UI elements

**Pattern 3: `position: absolute`**
- `.multiDropdownMenu` - Dropdown menu positioning
- `.tooltipBox` - Tooltip positioning
- `.sidebarOverlay` - Modal overlay
- `.modalOverlay` - Modal backdrop
- `.rangeThumbBubble` - Slider value bubble
- **Status:** ✅ Appropriate for overlays and popovers

**Pattern 4: `position: relative`**
- `.searchWrapper` - Container for absolutely positioned icon
- `.tooltipWrap` - Container for absolutely positioned tooltip
- `.rangeSlider` - Container for absolutely positioned thumb
- **Status:** ✅ Appropriate for positioning context

**No unnecessary absolute positioning found.**

---

## Findings Summary

### ✅ Consistent Patterns

1. **Page Structure**
   - 5/6 pages follow expected pattern exactly
   - 1/6 page (teacher-schedule) has intentional variation for calendar view
   - All pages have logical, consistent section order

2. **Alignment Usage**
   - `align-items: center` for single-line content ✅
   - `align-items: start` for multi-line content ✅
   - All usage is intentional and appropriate

3. **Positioning Usage**
   - `fixed` for sidebar ✅
   - `sticky` for headers and panels ✅
   - `absolute` for dropdowns and overlays ✅
   - `relative` for positioning contexts ✅
   - No unnecessary positioning found

### ⚠️ Intentional Variations

1. **Teacher Schedule Page**
   - Has calendar view before stats grid
   - **Reason:** Calendar is primary feature for this page
   - **Status:** Intentional design decision, not a violation

2. **Suggestions Bar**
   - Only appears on pages where actionable suggestions exist
   - **Reason:** Conditional feature, not always applicable
   - **Status:** Intentional, not a consistency issue

3. **Right Panels**
   - Main dashboard: Exemption settings
   - Class quality: Filters
   - **Reason:** Page-specific functionality
   - **Status:** Intentional, enhances usability

---

## Verification Checklist

- [x] All pages documented
- [x] Structure patterns identified
- [x] Alignment patterns verified
- [x] Positioning patterns verified
- [x] Intentional variations noted
- [x] No violations found

---

## Conclusion

**Category 4: Layout Consistency - ✅ COMPLETE**

### Summary

All pages follow consistent layout patterns with only **intentional, justified variations**:

1. **Structure:** 5/6 pages follow exact pattern, 1 has intentional calendar-first layout
2. **Alignment:** Consistent use of `center` vs `start` based on content type
3. **Positioning:** Appropriate use of fixed/sticky/absolute/relative
4. **No violations found**

### Recommendations

**No changes needed.** All layout patterns are:
- Consistent across similar page types
- Intentional where variations exist
- Following best practices for alignment and positioning
- Providing good user experience

The layout system is **well-designed and properly implemented**.

---

**Status:** ✅ COMPLETE  
**Next:** Category 5 - Table Structure Consistency
