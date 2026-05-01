---
inclusion: always
---

# MindX KPI Dashboard — Design System
**Single Source of Truth cho toàn bộ dự án**

## 🎯 Mục đích
File này là **chuẩn duy nhất** cho:
- Design tokens (colors, spacing, typography)
- Component patterns
- Code conventions
- Refactoring guidelines

**LUẬT VÀNG**: Mọi thay đổi design/refactor PHẢI tuân theo file này.

---

## 📐 Design Tokens

### Colors
```typescript
// Backgrounds (Light Mode)
--bg-marketing:  #f7f8f8   // Page canvas
--bg-panel:      #f3f4f5   // Sidebar, toolbar
--bg-surface:    #ffffff   // Cards, panels
--bg-elevated:   #fafafa   // Elevated surfaces

// Text Hierarchy
--text-primary:     #111827  // Headings, strong emphasis
--text-secondary:   #374151  // Body text
--text-tertiary:    #6b7280  // Muted labels
--text-quaternary:  #9ca3af  // Placeholders

// Brand & Accent
--brand-indigo:   #5e6ad2  // Primary CTAs only
--accent-violet:  #7170ff  // Links, active states
--accent-hover:   #828fff  // Hover states

// Status Colors (KPI Scoring)
5: #059669  // Emerald — Xuất sắc (≥95%)
4: #84cc16  // Lime    — Tốt (≥85%)
3: #eab308  // Yellow  — Trung bình (≥70%)
2: #f97316  // Orange  — Yếu (≥50%)
1: #dc2626  // Red     — Kém (<50%)

// Borders
--border-primary:   #e6e6e6  // Standard borders
--border-secondary: #d0d6e0  // Inputs, dropdowns
--border-input:     #d0d6e0  // Input fields
```

### Spacing (8px grid)
```typescript
--space-1: 4px    // Micro
--space-2: 8px    // Base unit
--space-3: 12px   // Comfortable
--space-4: 16px   // Standard
--space-5: 20px   // Generous
--space-6: 24px   // Large
--space-8: 32px   // Extra large
```

### Border Radius
```typescript
--radius-micro:       2px     // Inline badges
--radius-standard:    4px     // List items
--radius-comfortable: 6px     // Buttons, inputs
--radius-card:        8px     // Cards, dropdowns
--radius-panel:       12px    // Panels, sections
--radius-pill:        9999px  // Chips, filters, status tags
```

### Typography
```typescript
// Font Family
font-family: 'Inter', 'SF Pro Display', -apple-system, system-ui, sans-serif
font-feature-settings: 'cv01', 'ss03'  // Geometric alternates

// Weights
400: Regular (body text)
510: Signature emphasis (headings)
590: Strong emphasis (h3)

// Sizes
h1: 32px / 2rem      (letter-spacing: -0.704px)
h2: 24px / 1.5rem    (letter-spacing: -0.288px)
h3: 20px / 1.25rem   (letter-spacing: -0.24px)
body: 14px           (letter-spacing: -0.13px)
caption: 13px        (letter-spacing: -0.08px)
```

### Shadows
```typescript
--shadow-surface:  0 1px 2px rgba(0,0,0,0.05), 0 1px 4px rgba(0,0,0,0.03)
--shadow-card:     0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)
--shadow-elevated: 0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)
--shadow-dialog:   0 20px 60px rgba(0,0,0,0.12), 0 8px 20px rgba(0,0,0,0.06)
```

### Animation
```typescript
// Timing (từ src/constants/index.ts)
STAT_CARD_DELAY: 0.07s       // Delay giữa các stat cards
TABLE_ROW_DELAY: 0.012s      // Delay giữa các table rows
TABLE_ROW_MAX_DELAY: 0.3s    // Max delay cho table rows
FADE_DURATION: 0.25s         // Fade transitions
SLIDE_DURATION: 0.2s         // Slide transitions

// Easing
ease-out: cubic-bezier(0.16, 1, 0.3, 1)  // Smooth deceleration
```

---

## 🧩 Component Patterns

### 1. Page Layout Structure
```typescript
<PageLayout title="..." icon={...}>
  {/* Stats Section */}
  <section className={styles.statsGrid}>
    <StatCard ... />
  </section>

  {/* Filters Section */}
  <section className={styles.filtersSection}>
    <FilterToolbar ... />
  </section>

  {/* Charts Section (optional) */}
  <section className={styles.chartsSection}>
    <ChartCard ... />
  </section>

  {/* Table Section */}
  <section className={styles.tableSection}>
    <DataTable ... />
  </section>
</PageLayout>
```

### 2. Naming Conventions

#### CSS Modules
```typescript
// ✅ ĐÚNG
styles.statsGrid
styles.filtersSection
styles.tableSection
styles.chartCard

// ❌ SAI
styles.stats_grid
styles.FiltersSection
```

#### Components
```typescript
// ✅ ĐÚNG - PascalCase
<StatCard />
<FilterToolbar />
<DataTable />

// ❌ SAI
<statCard />
<filter-toolbar />
```

#### Constants
```typescript
// ✅ ĐÚNG - SCREAMING_SNAKE_CASE
CACHE_KEYS.CENTRES
LABELS.CLASS_NAME
MESSAGES.LOADING.CONNECTING

// ❌ SAI
cacheKeys.centres
labels.className
```

### 3. Import Order
```typescript
// 1. React & Next.js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// 2. External libraries
import { motion } from 'framer-motion';

// 3. Internal components
import { PageLayout } from '@/components/PageLayout';
import { Icon } from '@/components/ui';

// 4. Services & utilities
import { fetchData } from '@/services/dataService';
import { LABELS, CACHE_KEYS } from '@/constants';

// 5. Types
import type { DataType } from '@/types/data';

// 6. Styles (cuối cùng)
import styles from './page.module.css';
```

### 4. State Management Pattern
```typescript
// ✅ ĐÚNG - Grouped related state
const [data, setData] = useState<DataType[]>([]);
const [filteredData, setFilteredData] = useState<DataType[]>([]);
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);

// Filter states
const [searchTerm, setSearchTerm] = useState('');
const [selectedCentre, setSelectedCentre] = useState('');
const [dateRange, setDateRange] = useState({ from: '', to: '' });

// ❌ SAI - Mixed order, unclear grouping
const [searchTerm, setSearchTerm] = useState('');
const [data, setData] = useState<DataType[]>([]);
const [selectedCentre, setSelectedCentre] = useState('');
const [loading, setLoading] = useState(false);
```

### 5. TableToolbar Filter Order

**LUẬT**: Thứ tự các field trong `filterSlots` PHẢI nhất quán trên tất cả các trang.

**Thứ tự chuẩn:**
1. **Centre (Cơ sở)** - Phạm vi địa lý (geographic scope)
2. **Course Line (Khối)** - Phạm vi học thuật (academic scope)
3. **Status (Trạng thái)** - Trạng thái chung (general status)
4. **Page-specific filters** - Các filter đặc thù của từng trang

```typescript
// ✅ ĐÚNG - Standard order
<TableToolbar
  filterSlots={
    <>
      {/* 1. Centre - Only show if 2+ centres */}
      {tableCentreIds.length > 1 && (
        <CentreSelect
          centres={centres}
          selected={tableSelectedCentres}
          onChange={setTableSelectedCentres}
          filterToIds={tableCentreIds}
          placeholder="Tất cả cơ sở"
          searchable
          maxDisplay={1}
        />
      )}
      
      {/* 2. Course Line */}
      {courseLineOptions.length > 0 && (
        <MultiSelect
          options={courseLineOptions}
          selected={selectedCourseLines}
          onChange={setSelectedCourseLines}
          placeholder="Tất cả khối"
          maxDisplay={2}
        />
      )}
      
      {/* 3. Status */}
      {statusOptions.length > 0 && (
        <MultiSelect
          options={statusOptions}
          selected={selectedStatuses}
          onChange={setSelectedStatuses}
          placeholder="Tất cả trạng thái"
        />
      )}
      
      {/* 4. Page-specific filters */}
      {levelOptions.length > 0 && (
        <MultiSelect
          options={levelOptions}
          selected={selectedLevels}
          onChange={setSelectedLevels}
          placeholder="Tất cả cấp độ"
        />
      )}
    </>
  }
/>

// ❌ SAI - Wrong condition (shows when only 1 centre)
{tableCentreIds.length > 0 && <CentreSelect ... />}  // ❌

// ❌ SAI - Wrong order
<TableToolbar
  filterSlots={
    <>
      <MultiSelect placeholder="Tất cả khối" />      // Course Line first ❌
      <CentreSelect placeholder="Tất cả cơ sở" />    // Centre second ❌
      <MultiSelect placeholder="Tất cả trạng thái" />
    </>
  }
/>
```

**Lý do thứ tự này:**
- **Centre first**: Phạm vi địa lý là filter rộng nhất
- **Course Line second**: Phạm vi học thuật thu hẹp dữ liệu
- **Status third**: Trạng thái chung áp dụng cho hầu hết các trang
- **Specific last**: Filter đặc thù của từng trang đặt cuối cùng

**QUAN TRỌNG - Điều kiện hiển thị:**
- **Centre filter**: Chỉ hiện khi `tableCentreIds.length > 1` (có 2+ cơ sở để chọn)
- **Other filters**: Hiện khi `options.length > 0` (có ít nhất 1 option)
- **Lý do**: Nếu chỉ có 1 option thì không cần filter (không có gì để chọn)

**Common page-specific filters:**
- Level (Cấp độ): `placeholder="Tất cả cấp độ"`
- Operation (Hình thức): `placeholder="Tất cả hình thức"`
- Type (Loại): `placeholder="Tất cả loại"`
- Topic (Chủ đề): `placeholder="Tất cả chủ đề"`
- Reason (Lý do): `placeholder="Mọi lý do"`

---

## 📋 Content Standards

### CRUD Terminology (Admin Pages)
**LUẬT**: Dùng từ ngữ nhất quán cho các action CRUD

```typescript
// ✅ ĐÚNG - Dùng constants
import { LABELS, MESSAGES, ENTITIES } from '@/constants';

// Button label
actionLabel={`${LABELS.CREATE} ${ENTITIES.USERS}`}  // "Tạo tài khoản"

// Modal title
title={editingUser ? `${LABELS.EDIT} ${ENTITIES.USERS}` : `${LABELS.CREATE} ${ENTITIES.USERS} mới`}

// Success message
addToast(MESSAGES.SUCCESS[editingUser ? 'UPDATED' : 'CREATED'](ENTITIES.USERS), 'success');

// ❌ SAI - Hardcoded và không nhất quán
actionLabel="Thêm tài khoản"  // ❌ Dùng "Thêm" thay vì "Tạo"
title="Tạo vai trò mới"       // ❌ Hardcoded
addToast('Cập nhật khu vực thành công', 'success')  // ❌ Hardcoded
```

**Quy tắc từ ngữ:**
- **"Tạo"** (`LABELS.CREATE`) - Create new entity (button, modal title)
- **"Chỉnh sửa"** (`LABELS.EDIT`) - Edit existing entity (modal title)
- **"Cập nhật"** (`LABELS.UPDATE`) - Update/save changes (button)
- **"Xoá"** (`LABELS.DELETE`) - Delete entity
- **"Đang tạo..."** (`LABELS.CREATING`) - Creating state
- **"Đang lưu..."** (`LABELS.UPDATING`) - Updating state

**Entities có sẵn:**
- `ENTITIES.USERS` - "tài khoản"
- `ENTITIES.ROLES` - "vai trò"
- `ENTITIES.REGIONS` - "khu vực"
- `ENTITIES.CENTRES` - "cơ sở"

### Labels & Messages
**LUẬT**: Tất cả text hiển thị PHẢI lấy từ `src/constants/index.ts`

```typescript
// ✅ ĐÚNG
import { LABELS, MESSAGES } from '@/constants';

<h3>{LABELS.CLASS_NAME}</h3>
<p>{MESSAGES.LOADING.CONNECTING}</p>

// ❌ SAI - Hardcoded text
<h3>Lớp học</h3>
<p>Đang kết nối...</p>
```

### Cache Keys
```typescript
// ✅ ĐÚNG
import { CACHE_KEYS } from '@/constants';
const cached = await db.get(CACHE_KEYS.CENTRES);

// ❌ SAI
const cached = await db.get('centres_data');
```

### Formatters
```typescript
// ✅ ĐÚNG
import { FORMAT } from '@/constants';

FORMAT.progress(5, 10)        // "5/10"
FORMAT.percentage(95.678)     // "95.7%"
FORMAT.date(new Date())       // "22/04/2026"
FORMAT.number(1234567)        // "1.234.567"

// ❌ SAI
`${completed}/${total}`
`${value.toFixed(1)}%`
```

---

## 🔄 Refactoring Guidelines

### Khi nào cần refactor?
1. **Code duplication** - Cùng logic xuất hiện ≥3 lần
2. **Inconsistent naming** - Không theo conventions
3. **Hardcoded values** - Text/numbers không dùng constants
4. **Poor structure** - Component >300 lines hoặc function >50 lines
5. **Missing types** - Dùng `any` hoặc không có type definitions

### Quy trình refactor chuẩn

#### Bước 1: Đánh giá
```typescript
// Checklist:
☐ File nào cần refactor?
☐ Vấn đề cụ thể là gì?
☐ Impact scope (chỉ 1 file hay nhiều files)?
☐ Có breaking changes không?
```

#### Bước 2: Plan
```typescript
// Tạo plan ngắn gọn:
1. Extract constants → src/constants/index.ts
2. Create shared component → src/components/ui/
3. Update imports in affected files
4. Test manually
```

#### Bước 3: Execute
```typescript
// Thứ tự ưu tiên:
1. Constants & types trước
2. Shared components sau
3. Update consuming files cuối
4. Verify không có errors
```

#### Bước 4: Verify
```typescript
// Checklist:
☐ npm run build - No errors
☐ All pages load correctly
☐ No console errors
☐ Filters/interactions work
☐ Data displays correctly
```

### Anti-patterns cần tránh

#### ❌ Over-engineering
```typescript
// SAI - Tạo abstraction không cần thiết
const useComplexDataFetcher = (config: FetchConfig) => {
  // 200 lines of generic logic
};

// ĐÚNG - Simple & direct
const fetchClasses = async () => {
  const response = await lmsClient.get('/classes');
  return response.data;
};
```

#### ❌ Premature optimization
```typescript
// SAI - Optimize trước khi có vấn đề
useMemo(() => data.filter(...), [data, filter1, filter2, filter3]);

// ĐÚNG - Optimize khi cần
const filtered = data.filter(...);  // Simple first
```

#### ❌ Breaking existing patterns
```typescript
// SAI - Đột ngột đổi pattern
// Old files: styles.statsGrid
// New file: styles.stats-grid  ← Inconsistent!

// ĐÚNG - Follow existing pattern
// All files: styles.statsGrid
```

---

## 🎨 Component Library

### Chart Components

**LUẬT**: Tất cả biểu đồ PHẢI có label rõ ràng cho axes và legend nhất quán theo loại.

#### Chart Axes (Trục biểu đồ)

```typescript
import {
  StandardXAxis,
  StandardYAxisCategory,
  StandardYAxisNumber,
  VerticalBarChartConfig,
  ComposedChartConfig,
} from '@/components/ui';

// ✅ ĐÚNG - Vertical Bar Chart với labels đầy đủ
<BarChart data={data} {...VerticalBarChartConfig}>
  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" horizontal={false} />
  <StandardXAxis label="Giá trị" />
  <StandardYAxisCategory dataKey="name" label="Cơ sở" />
  <CustomTooltip />
  <Bar dataKey="Số lớp" fill="#06b6d4" radius={[0, 4, 4, 0]} />
</BarChart>

// ✅ ĐÚNG - Dual Axis Chart với labels cho cả 2 trục
<ComposedChart data={data} {...ComposedChartConfig}>
  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" horizontal={false} />
  <StandardXAxis label="Giá trị" />
  <StandardYAxisCategory dataKey="name" label="Cơ sở" />
  <StandardYAxisNumber yAxisId="right" orientation="right" label="Tỷ lệ (%)" />
  <CustomTooltip />
  <Bar dataKey="Số ca" fill="#06b6d4" yAxisId="left" />
  <Line dataKey="Tỷ lệ chuyển đổi (%)" stroke="#10b981" yAxisId="right" />
</ComposedChart>

// ❌ SAI - Không có label cho axes
<XAxis type="number" tick={{ fontSize: 11 }} />
<YAxis dataKey="name" type="category" />
```

#### Chart Legends (Chú giải biểu đồ)

**CÓ HAI LOẠI LEGEND - KHÔNG ĐƯỢC NHẦM LẪN:**

##### 1. KPI Legend (Chú giải theo mức độ hiệu suất)

**Khi nào dùng:** Biểu đồ hiển thị chỉ số KPI có ngưỡng đánh giá hiệu suất.

**Đặc điểm:**
- Màu sắc thể hiện mức độ hiệu suất (xanh = xuất sắc, đỏ = kém)
- Legend hiển thị các khoảng giá trị với màu tương ứng
- Tooltip hiển thị giá trị với màu theo hiệu suất

**KPI Legends có sẵn:**
- `COMPLETION_LEGEND` - Tỷ lệ hoàn thành (%)
- `TEACHER_CHANGE_LEGEND` - Tỷ lệ thay đổi giáo viên (%)
- `SURVEY_LEGEND` - Điểm khảo sát (1-5)
- `CONVERSION_LEGEND` - Tỷ lệ chuyển đổi (%)

```typescript
import { 
  COMPLETION_LEGEND, 
  KPI_COLORS, 
  completionColor, 
  completionScore 
} from '@/lib/kpiScoring';
import { ChartLegend, CustomTooltip } from '@/components/ui';

// ✅ ĐÚNG - KPI Legend cho Completion Rate
<BarChart data={data} layout="vertical">
  <Bar dataKey="rate">
    {data.map((d, i) => (
      <Cell key={i} fill={completionColor(d.rate)} />
    ))}
  </Bar>
</BarChart>

<ChartLegend items={COMPLETION_LEGEND.map(l => ({
  color: KPI_COLORS[l.score],
  label: l.label,
}))} />

// ✅ ĐÚNG - KPI Legend cho Teacher Change Rate
import { TEACHER_CHANGE_LEGEND, teacherChangeColor } from '@/lib/kpiScoring';

<Bar dataKey="changeRate">
  {data.map((d, i) => (
    <Cell key={i} fill={teacherChangeColor(d.changeRate)} />
  ))}
</Bar>

<ChartLegend items={TEACHER_CHANGE_LEGEND.map(l => ({
  color: KPI_COLORS[l.score],
  label: l.label,
}))} />

// ✅ ĐÚNG - KPI Legend cho Survey Scores
import { SURVEY_LEGEND, surveyColor } from '@/lib/kpiScoring';

<Bar dataKey="score">
  {data.map((d, i) => (
    <Cell key={i} fill={surveyColor(d.score)} />
  ))}
</Bar>

<ChartLegend items={SURVEY_LEGEND.map(l => ({
  color: KPI_COLORS[l.score],
  label: l.label,
}))} />

// ✅ ĐÚNG - KPI Legend cho Conversion Rate
import { CONVERSION_LEGEND, conversionColor } from '@/lib/kpiScoring';

<Line 
  dataKey="conversionRate" 
  stroke={conversionColor(dataPoint.conversionRate)}
/>

<ChartLegend items={CONVERSION_LEGEND.map(l => ({
  color: KPI_COLORS[l.score],
  label: l.label,
}))} />
```

##### 2. Data Legend (Chú giải theo chuỗi dữ liệu)

**Khi nào dùng:** Biểu đồ hiển thị nhiều chuỗi dữ liệu cần phân biệt.

**Đặc điểm:**
- Mỗi chuỗi có màu cố định (không phụ thuộc hiệu suất)
- Legend xác định ý nghĩa của từng chuỗi dữ liệu
- Có thể bao gồm thông tin trục cho biểu đồ dual-axis

```typescript
import { ChartLegend } from '@/components/ui';

// ✅ ĐÚNG - Data Legend cho Dual-Axis Chart (không có KPI scoring)
<ChartLegend items={[
  { color: '#06b6d4', label: 'Số ca (trục trái)' },
  { color: '#10b981', label: 'Tỷ lệ chuyển đổi % (trục phải)' },
]} />

// ✅ ĐÚNG - Data Legend cho Grouped Bar Chart
<ChartLegend items={[
  { color: '#f59e0b', label: 'Vi phạm Nhận xét' },
  { color: '#ef4444', label: 'Cảnh báo Chuyên cần' },
]} />

// ❌ SAI - Dùng Data Legend cho KPI metric
// Nếu "Tỷ lệ chuyển đổi" là KPI metric, phải dùng KPI Legend!
<ChartLegend items={[
  { color: '#10b981', label: 'Tỷ lệ chuyển đổi %' },
]} />
```

#### Legend Decision Matrix

| Loại biểu đồ | Loại metric | Loại Legend | Ví dụ |
|--------------|-------------|-------------|-------|
| Single-axis bar | KPI metric | **KPI Legend** | Tỷ lệ hoàn thành theo cơ sở |
| Single-axis bar | Count/sum | **Data Legend** | Số lớp theo cơ sở |
| Dual-axis | Cả 2 là KPI | **KPI Legend** | Hiển thị KPI chính |
| Dual-axis | KPI + Count | **KPI Legend** | Màu theo KPI, legend hiển thị khoảng KPI |
| Grouped bars | Cùng KPI | **KPI Legend** | Dùng cùng KPI cho tất cả series |
| Grouped bars | Khác loại | **Data Legend** | Vi phạm + Cảnh báo |

#### Tooltip Standards

**LUẬT**: Tất cả biểu đồ PHẢI dùng `CustomTooltip` hoặc custom tooltip với màu theo context.

```typescript
import { CustomTooltip } from '@/components/ui';

// ✅ ĐÚNG - Dùng CustomTooltip component
<Tooltip content={<CustomTooltip />} />

// ✅ ĐÚNG - Custom tooltip với màu KPI
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{ 
      background: '#1f2937', 
      color: '#f9fafb', 
      padding: '8px 12px',
      borderRadius: 7,
      fontSize: 12,
      boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
    }}>
      <div style={{ fontWeight: 590, marginBottom: 4 }}>{label}</div>
      <div>
        Tỷ lệ: <strong style={{ color: completionColor(d.rate) }}>
          {d.rate.toFixed(1)}%
        </strong>
      </div>
      <div style={{ color: '#9ca3af' }}>{d.pass}/{d.base} HV</div>
    </div>
  );
}

// ❌ SAI - Tooltip không có màu hoặc màu cố định
<div>Tỷ lệ: <strong>{d.rate.toFixed(1)}%</strong></div>
```

#### Chart Naming Conventions
```typescript
// Data keys PHẢI rõ ràng và có đơn vị
'Số phiếu'              // ✅ Clear
'Điểm TB (GV)'          // ✅ Clear with context
'Tỷ lệ chuyển đổi (%)'  // ✅ Clear with unit
'count'                 // ❌ Unclear
'rate'                  // ❌ Unclear
'value'                 // ❌ Unclear

// Axis labels PHẢI có trong tiếng Việt
label="Cơ sở"           // ✅ Clear
label="Giá trị"         // ✅ Clear
label="Tỷ lệ (%)"       // ✅ Clear with unit
label="Centre"          // ❌ English
label="Value"           // ❌ English
// No label              // ❌ Missing
```

#### Common Chart Patterns

##### Pattern 1: Single KPI Metric Bar Chart
```typescript
// Use case: Show completion rate by centre
import { COMPLETION_LEGEND, completionColor, KPI_COLORS } from '@/lib/kpiScoring';
import { ChartLegend } from '@/components/ui';

<BarChart data={centreData} layout="vertical">
  <StandardXAxis label="Giá trị" />
  <StandardYAxisCategory dataKey="name" label="Cơ sở" />
  <Bar dataKey="rate">
    {data.map((d, i) => (
      <Cell key={i} fill={completionColor(d.rate)} />
    ))}
  </Bar>
</BarChart>

<ChartLegend items={COMPLETION_LEGEND.map(l => ({
  color: KPI_COLORS[l.score],
  label: l.label,
}))} />
```

##### Pattern 2: Dual-Axis with KPI Metric
```typescript
// Use case: Show count + conversion rate (KPI)
import { CONVERSION_LEGEND, conversionColor, KPI_COLORS } from '@/lib/kpiScoring';

<ComposedChart data={data}>
  <StandardXAxis label="Giá trị" />
  <StandardYAxisCategory dataKey="name" label="Cơ sở" />
  <StandardYAxisNumber yAxisId="right" orientation="right" label="Tỷ lệ (%)" />
  
  {/* Bars colored by conversion rate KPI */}
  <Bar dataKey="Số ca" yAxisId="left">
    {data.map((d, i) => (
      <Cell key={i} fill={conversionColor(d.conversionRate)} />
    ))}
  </Bar>
  
  {/* Line also colored by conversion rate */}
  <Line 
    dataKey="Tỷ lệ chuyển đổi (%)" 
    stroke="#10b981"
    yAxisId="right"
  />
</ComposedChart>

{/* Show KPI legend for conversion rate */}
<ChartLegend items={CONVERSION_LEGEND.map(l => ({
  color: KPI_COLORS[l.score],
  label: l.label,
}))} />
```

##### Pattern 3: Grouped Bars (Different Types)
```typescript
// Use case: Show violations + alerts (not KPI scored)
<BarChart data={data}>
  <StandardXAxis label="Giá trị" />
  <StandardYAxisCategory dataKey="name" label="Cơ sở" />
  <Bar dataKey="Vi phạm" fill="#f59e0b" />
  <Bar dataKey="Cảnh báo" fill="#ef4444" />
</BarChart>

{/* Data legend to identify series */}
<ChartLegend items={[
  { color: '#f59e0b', label: 'Vi phạm Nhận xét' },
  { color: '#ef4444', label: 'Cảnh báo Chuyên cần' },
]} />
```

---

### StatCard
```typescript
interface StatCardProps {
  label: string;      // Từ LABELS constant
  value: string;      // Formatted value
  icon?: ReactNode;   // Optional icon
  delay?: number;     // Animation delay
}

// Usage
<StatCard
  label={LABELS.TOTAL_CLASSES}
  value={FORMAT.number(totalClasses)}
  icon={<Icon.Classes />}
  delay={0}
/>
```

### FilterToolbar
```typescript
interface FilterToolbarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  selectedCentre: string;
  onCentreChange: (value: string) => void;
  centres: string[];
  // ... other filters
}

// Pattern: Controlled components
<FilterToolbar
  searchTerm={searchTerm}
  onSearchChange={setSearchTerm}
  {...otherProps}
/>
```

### DataTable
```typescript
interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  loading?: boolean;
  emptyMessage?: string;
}

// Pattern: Generic type for flexibility
<DataTable<ClassData>
  data={filteredData}
  columns={classColumns}
  loading={loading}
  emptyMessage={LABELS.NO_DATA}
/>
```

---

## 🚀 Performance Guidelines

### 1. Lazy Loading
```typescript
// ✅ ĐÚNG - Lazy load heavy components
const ChartComponent = dynamic(() => import('./ChartComponent'), {
  loading: () => <div>Loading chart...</div>,
  ssr: false,
});
```

### 2. Memoization (khi cần)
```typescript
// ✅ Khi nào dùng useMemo:
// - Expensive calculations (>10ms)
// - Large array operations (>1000 items)
// - Complex filtering/sorting

const expensiveResult = useMemo(() => {
  return data.filter(...).map(...).reduce(...);
}, [data, dependency]);

// ❌ Không cần useMemo:
// - Simple operations
// - Small datasets (<100 items)
// - Already fast operations
```

### 3. Debouncing Search
```typescript
// ✅ ĐÚNG - Debounce search input
const debouncedSearch = useMemo(
  () => debounce((value: string) => setSearchTerm(value), 300),
  []
);

<input onChange={(e) => debouncedSearch(e.target.value)} />
```

---

### Modal Component

**LUẬT**: Tất cả modals PHẢI hỗ trợ 3 cách đóng:
1. Click nút X
2. Click outside modal (overlay)
3. **Press ESC key**

#### Using Modal Component (Recommended)
```typescript
import { Modal, ModalHeader } from '@/components/ui';

// ✅ ĐÚNG - ESC support built-in
<Modal open={showModal} onClose={() => setShowModal(false)}>
  <ModalHeader 
    title="Modal Title" 
    subtitle="Optional subtitle"
    onClose={() => setShowModal(false)} 
  />
  <div className={styles.modalBody}>
    {/* Content */}
  </div>
</Modal>
```

#### Custom Modal (Add ESC Handler)
```typescript
// ✅ ĐÚNG - Add ESC handler for custom modals
const [showModal, setShowModal] = useState(false);

useEffect(() => {
  if (!showModal) return;
  
  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      setShowModal(false);
    }
  };
  
  document.addEventListener('keydown', handleEscape);
  return () => document.removeEventListener('keydown', handleEscape);
}, [showModal]);

// ❌ SAI - No ESC support
<div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
  {/* Modal without ESC handler */}
</div>
```

**Modal closing methods:**
- ✅ Click X button
- ✅ Click outside modal (overlay)
- ✅ Press ESC key

---

## 📦 File Structure

```
src/
├── app/                          # Next.js pages
│   ├── page.tsx                  # Dashboard home
│   ├── class-quality/page.tsx    # Feature pages
│   └── ...
├── components/
│   ├── PageLayout.tsx            # Main layout wrapper
│   ├── ui/
│   │   └── index.tsx             # Shared UI components
│   └── layout/                   # Layout components
├── constants/
│   └── index.ts                  # ⭐ Single source of truth
├── services/                     # API clients
├── types/                        # TypeScript types
├── lib/                          # Utilities
└── app/globals.css               # ⭐ Design tokens
```

---

## ✅ Pre-commit Checklist

Trước khi commit, verify:

```typescript
☐ No hardcoded text (dùng LABELS/MESSAGES)
☐ No hardcoded colors (dùng CSS variables)
☐ No magic numbers (dùng constants)
☐ Consistent naming (camelCase, PascalCase, SCREAMING_SNAKE_CASE)
☐ Proper imports order
☐ No console.log() statements
☐ No unused imports
☐ npm run build passes
☐ No TypeScript errors
☐ Components render correctly
```

---

## 🔍 Common Issues & Solutions

### Issue: Modal overflow
```typescript
// ❌ SAI
<div style={{ width: '600px' }}>

// ✅ ĐÚNG
<div style={{ width: '100%', maxWidth: '600px' }}>
```

### Issue: Input width in toolbar
```typescript
// ❌ SAI
<input style={{ minWidth: '200px' }} />

// ✅ ĐÚNG
<input style={{ width: '100%', maxWidth: '200px' }} />
```

### Issue: Inconsistent spacing
```typescript
// ❌ SAI
margin: 15px;
padding: 10px 18px;

// ✅ ĐÚNG - Dùng spacing scale
margin: var(--space-4);
padding: var(--space-3) var(--space-4);
```

---

## 📚 References

- **Design Philosophy**: Linear-inspired light mode
- **Typography**: Inter Variable with OpenType features
- **Color System**: Light neutrals + brand indigo accents
- **Spacing**: 8px base grid with optical adjustments
- **Animation**: Subtle, purposeful motion

**Nguồn chính thức**:
- `src/constants/index.ts` - Content & constants
- `src/app/globals.css` - Design tokens
- `.kiro/steering/design-system.md` - This file

---

**Last Updated**: 2026-04-23
**Version**: 1.0.0
# Updated documentation

# Updated docs
