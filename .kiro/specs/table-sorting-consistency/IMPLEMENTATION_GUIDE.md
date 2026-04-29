# Table Sorting Implementation Guide

**Status**: Ready to implement  
**Created**: 2026-04-24

---

## Reusable Components Created ✅

### 1. Hook: `useTableSort`
**Location**: `src/hooks/useTableSort.ts`

**Features**:
- Generic type-safe sorting
- Auto-detects data types (string, number, boolean, date)
- Vietnamese locale support
- Handles null/undefined values
- Memoized for performance

**Usage**:
```typescript
import { useTableSort } from '@/hooks/useTableSort';

const { sortedData, sortBy, sortOrder, handleSort } = useTableSort({
  data: myData,
  defaultSortKey: 'name',
  defaultSortOrder: 'asc'
});
```

### 2. Component: `SortableHeader`
**Location**: `src/components/ui/index.tsx`

**For**: `<table>` elements with `<th>` headers

**Usage**:
```typescript
import { SortableHeader } from '@/components/ui';

<thead>
  <tr>
    <SortableHeader
      label="Tên"
      sortKey="name"
      currentSortKey={sortBy}
      sortOrder={sortOrder}
      onSort={handleSort}
    />
  </tr>
</thead>
```

### 3. Component: `SortableColumn`
**Location**: `src/components/ui/index.tsx`

**For**: Grid-based tables with `<div>` headers

**Usage**:
```typescript
import { SortableColumn } from '@/components/ui';

<div className={styles.classItemHeader}>
  <SortableColumn
    label="Lớp học"
    sortKey="name"
    currentSortKey={sortBy}
    sortOrder={sortOrder}
    onSort={handleSort}
    className={styles.sortableCol}
  />
</div>
```

---

## Implementation Checklist

### Phase 1: Main Dashboard Tables (High Priority)

#### 1. Teacher Change - Main Table ⏳
**File**: `src/app/teacher-change/page.tsx`  
**Table Type**: Grid-based (`classItemHeader`)  
**Columns to sort**:
- [ ] Lớp học (name)
- [ ] Tiến độ (progress)
- [ ] Tỷ lệ thay đổi (changeRate)
- [ ] Số GV (uniqueTeacherCount)

**Steps**:
1. Import `useTableSortWithComparator` and `SortableColumn`
2. Add sort state with custom comparator
3. Replace existing column headers with `SortableColumn`
4. Use `sortedData` instead of `filteredClasses`

#### 2. Teacher Change - Inactive Table ⏳
**File**: `src/app/teacher-change/page.tsx`  
**Table Type**: Grid-based  
**Columns to sort**:
- [ ] Lớp học (name)
- [ ] Lý do (reason)
- [ ] Ngày huỷ (date)

#### 3. Tickets - Main Table ⏳
**File**: `src/app/tickets/page.tsx`  
**Table Type**: Grid-based  
**Columns to sort**:
- [ ] Mã phiếu (ticketCode)
- [ ] Lớp học (className)
- [ ] Học viên (studentName)
- [ ] Điểm TB (avgScore)
- [ ] Trạng thái (status)
- [ ] Mức độ (priority)
- [ ] Chủ đề (feedbackTopic)
- [ ] Ngày tạo (createdAt)

**Note**: Already has partial sorting, need to complete all columns

#### 4. Tickets - By Class Table ⏳
**File**: `src/app/tickets/page.tsx`  
**Table Type**: Grid-based  
**Columns to sort**:
- [ ] Lớp học (className)
- [ ] Số phiếu (count)
- [ ] Học viên (students)
- [ ] Điểm TB (avgScore)

**Note**: Already has sorting, verify completeness

#### 5. Class Quality - Comment Violations ⏳
**File**: `src/app/class-quality/page.tsx`  
**Table Type**: `<table>` with `<th>`  
**Columns to sort**:
- [ ] Lớp học (className)
- [ ] Giáo viên (teacherName)
- [ ] Buổi học (slotNumber)
- [ ] Ngày (date)
- [ ] Nhận xét (comment)
- [ ] Lý do vi phạm (reason)

#### 6. Class Quality - Attendance Violations ⏳
**File**: `src/app/class-quality/page.tsx`  
**Table Type**: `<table>` with `<th>`  
**Columns to sort**:
- [ ] Lớp học (className)
- [ ] Học viên (studentName)
- [ ] Số buổi vắng (absentCount)
- [ ] Vắng liên tiếp (hasConsecutive - boolean)
- [ ] Vắng cuối khoá (hasLateStage - boolean)

---

### Phase 2: Admin Tables (Medium Priority)

#### 7. Admin Users ⏳
**File**: `src/app/admin/users/page.tsx`  
**Table Type**: `<table>` with `<th>`  
**Columns to sort**:
- [ ] Email (email)
- [ ] Tên (full_name)
- [ ] Username (username)
- [ ] Vai trò (role)
- [ ] Trạng thái (is_active)
- [ ] Ngày tạo (created_at)

#### 8. Admin Permissions ⏳
**File**: `src/app/admin/permissions/page.tsx`  
**Table Type**: `<table>` with `<th>`  
**Columns to sort**:
- [ ] Tài khoản (email)
- [ ] Khu vực (region name)
- [ ] Khối (course_lines count)

---

### Phase 3: Modal Tables (Low Priority)

#### 9. Dashboard Modal - Student Details ⏳
**File**: `src/app/page.tsx`  
**Table Type**: `<table>` with `<th>`  
**Columns to sort**:
- [ ] Học viên (name)
- [ ] Trạng thái (status)
- [ ] Lý do (reason)
- [ ] Buổi vắng (absentCount)

#### 10. Teacher Change Modal - Slot Details ⏳
**File**: `src/app/teacher-change/page.tsx`  
**Table Type**: `<table>` with `<th>`  
**Columns to sort**:
- [ ] Buổi học (slotNumber)
- [ ] Ngày (date)
- [ ] GV chính (primaryTeacher)
- [ ] GV thực tế (actualTeacher)

#### 11. Tickets Modal - Edit History ⏳
**File**: `src/app/tickets/page.tsx`  
**Table Type**: `<table>` with `<th>`  
**Columns to sort**:
- [ ] Trường (field)
- [ ] Giá trị cũ (oldValue)
- [ ] Giá trị mới (newValue)
- [ ] Người thay đổi (changedBy)
- [ ] Thời gian (changedAt)

---

## Implementation Pattern

### For Grid-Based Tables (using `<div>`)

```typescript
// 1. Import
import { useTableSortWithComparator } from '@/hooks/useTableSort';
import { SortableColumn } from '@/components/ui';

// 2. Define sort keys type
type SortKey = 'name' | 'progress' | 'rate' | 'count';

// 3. Add sort state with custom comparator
const { sortedData, sortBy, sortOrder, handleSort } = useTableSortWithComparator({
  data: filteredData,
  defaultSortKey: 'name' as SortKey,
  defaultSortOrder: 'asc',
  comparator: (a, b, key) => {
    switch (key) {
      case 'name':
        return a.cls.name.localeCompare(b.cls.name, 'vi-VN');
      case 'progress':
        return a.cls.progress.localeCompare(b.cls.progress, 'vi-VN');
      case 'rate':
        return a.changeRate - b.changeRate;
      case 'count':
        return a.uniqueTeacherCount - b.uniqueTeacherCount;
      default:
        return 0;
    }
  }
});

// 4. Replace headers
<div className={styles.classItemHeader}>
  <SortableColumn
    label="Lớp học"
    sortKey="name"
    currentSortKey={sortBy}
    sortOrder={sortOrder}
    onSort={handleSort}
    className={styles.sortableCol}
  />
  {/* ... more columns */}
</div>

// 5. Use sortedData
{sortedData.map(item => (
  <div key={item.cls.id}>...</div>
))}
```

### For Table-Based Tables (using `<table>`)

```typescript
// 1. Import
import { useTableSort } from '@/hooks/useTableSort';
import { SortableHeader } from '@/components/ui';

// 2. Add sort state (auto-detection)
const { sortedData, sortBy, sortOrder, handleSort } = useTableSort({
  data: filteredData,
  defaultSortKey: 'email',
  defaultSortOrder: 'asc'
});

// 3. Replace headers
<thead>
  <tr>
    <SortableHeader
      label="Email"
      sortKey="email"
      currentSortKey={sortBy}
      sortOrder={sortOrder}
      onSort={handleSort}
    />
    {/* ... more columns */}
  </tr>
</thead>

// 4. Use sortedData
<tbody>
  {sortedData.map(item => (
    <tr key={item.id}>...</tr>
  ))}
</tbody>
```

---

## Testing Checklist

For each table after implementation:

- [ ] Click each sortable column header
- [ ] Verify ascending sort works correctly
- [ ] Click again, verify descending sort works
- [ ] Click different column, verify it switches to that column
- [ ] Verify sort indicator (arrow) shows correctly
- [ ] Verify active column is highlighted
- [ ] Test with empty data
- [ ] Test with null/undefined values
- [ ] Test with Vietnamese characters
- [ ] Verify performance with large datasets

---

## Notes

- All tables should have consistent sort behavior
- Sort state is local to each table (not global)
- Default sort should be the most commonly used column
- Inactive/cancelled items tables can have simpler sorting
- Modal tables can have fewer sortable columns
- Some columns (Actions, Checkboxes, Visual indicators) should NOT be sortable

---

**Next**: Start with Teacher Change main table, then proceed through the checklist systematically.
