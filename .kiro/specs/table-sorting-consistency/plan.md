# Table Sorting Consistency - Implementation Plan

**Goal**: Add consistent sorting functionality to all tables in the project

---

## Current State Analysis

### Tables WITH Sorting ✅
1. **Dashboard (page.tsx)** - Main completion rate table
   - Sortable: Lớp học, Giáo viên, Tiến độ, HV, Tỷ lệ
   - Uses: `sortKey`, `sortOrder`, `handleSort()`, `SortIcon`

2. **Office Hours (office-hours/page.tsx)** - Two views
   - List view: Sortable by time, type, course, teacher, centre, students, paid, comments, confirmed
   - By-teacher view: Sortable by name, sessions, students, confirmed, paid, comments, conversion
   - Uses: `sortBy`, `sortOrder`, `handleSort()`, `teacherSortBy`, `teacherSortOrder`, `handleTeacherSort()`

### Tables WITHOUT Sorting ❌

#### Main Dashboard Pages
3. **Teacher Change (teacher-change/page.tsx)**
   - Main table: Lớp học, Tiến độ, Tỷ lệ thay đổi, Số GV, Lớp học
   - Inactive table: Lớp học, Lý do, Ngày huỷ
   - Modal table: Buổi học, Ngày, GV chính, GV thực tế, Loại thay đổi

4. **Teacher Schedule (teacher-schedule/page.tsx)**
   - Calendar view (no table)

5. **Tickets (tickets/page.tsx)**
   - Main table: Checkbox, Mã phiếu, Lớp học, Học viên, Điểm TB (GV), Trạng thái, Mức độ, Chủ đề, Ngày tạo
   - By-class table: Lớp học, Số phiếu, Học viên, Điểm TB (GV)
   - Modal survey table: Phân loại, Câu hỏi, Câu trả lời
   - Modal edit table: Trường, Giá trị cũ, Giá trị mới, Người thay đổi, Thời gian

6. **Class Quality (class-quality/page.tsx)**
   - Comment violations table: Lớp học, Giáo viên, Buổi học, Ngày, Nhận xét, Lý do vi phạm
   - Attendance violations table: Lớp học, Học viên, Số buổi vắng, Vắng liên tiếp, Vắng cuối khoá, Lịch sử điểm danh

#### Admin Pages
7. **Admin Users (admin/users/page.tsx)**
   - Table: Email, Tên, Username, Vai trò, Trạng thái, Ngày tạo, Actions

8. **Admin Permissions (admin/permissions/page.tsx)**
   - Table: Tài khoản, Khu vực, Khối, Quyền, Actions

9. **Admin Regions (admin/regions/page.tsx)**
   - Grid cards (not a table)

#### Modals
10. **Dashboard Modal** - Student details
    - Table: Học viên, Trạng thái, Lý do, Buổi vắng

11. **Teacher Change Modal** - Slot details
    - Table: Buổi học, Ngày, GV chính, GV thực tế, Loại thay đổi

12. **Tickets Modal** - Survey content
    - Table: Phân loại, Câu hỏi, Câu trả lời

13. **Tickets Modal** - Edit history
    - Table: Trường, Giá trị cũ, Giá trị mới, Người thay đổi, Thời gian

---

## Implementation Strategy

### Phase 1: Establish Sorting Pattern
- [x] Analyze existing sort implementations (page.tsx, office-hours/page.tsx)
- [ ] Create reusable sort utilities
- [ ] Document standard sort pattern

### Phase 2: Main Dashboard Tables
Priority: High (user-facing, frequently used)

1. [ ] Teacher Change - Main table
2. [ ] Teacher Change - Inactive table
3. [ ] Tickets - Main table
4. [ ] Tickets - By-class table
5. [ ] Class Quality - Comment violations
6. [ ] Class Quality - Attendance violations

### Phase 3: Admin Tables
Priority: Medium (admin-only, less frequent)

7. [ ] Admin Users
8. [ ] Admin Permissions

### Phase 4: Modal Tables
Priority: Low (detail views, less critical)

9. [ ] Dashboard Modal - Student details
10. [ ] Teacher Change Modal - Slot details
11. [ ] Tickets Modal - Edit history

### Phase 5: Non-Sortable Tables
Some tables don't need sorting:
- Tickets Modal - Survey content (read-only content)
- Small tables with < 5 rows

---

## Standard Sort Pattern

### State Management
```typescript
const [sortBy, setSortBy] = useState<'column1' | 'column2' | ...>('defaultColumn');
const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
```

### Sort Handler
```typescript
const handleSort = (key: typeof sortBy) => {
  if (sortBy === key) {
    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
  } else {
    setSortBy(key);
    setSortOrder('asc');
  }
};
```

### Sort Logic
```typescript
const sortedData = useMemo(() => {
  return [...data].sort((a, b) => {
    let comparison = 0;
    
    if (sortBy === 'column1') {
      comparison = a.column1.localeCompare(b.column1);
    } else if (sortBy === 'column2') {
      comparison = a.column2 - b.column2;
    }
    // ... more columns
    
    return sortOrder === 'asc' ? comparison : -comparison;
  });
}, [data, sortBy, sortOrder]);
```

### UI Pattern
```typescript
<div
  className={`${styles.sortableCol} ${sortBy === 'column1' ? styles.activeSort : ''}`}
  onClick={() => handleSort('column1')}
>
  Column Name
  {sortBy === 'column1' && (
    sortOrder === 'asc' ? (
      <svg>↑</svg>
    ) : (
      <svg>↓</svg>
    )
  )}
</div>
```

---

## Columns to Sort by Table

### Teacher Change - Main Table
- ✅ Lớp học (text)
- ✅ Tiến độ (text)
- ✅ Tỷ lệ thay đổi (number)
- ✅ Số GV (number)
- ❌ Actions (not sortable)

### Tickets - Main Table
- ❌ Checkbox (not sortable)
- ✅ Mã phiếu (text)
- ✅ Lớp học (text)
- ✅ Học viên (text)
- ✅ Điểm TB (number)
- ✅ Trạng thái (text)
- ✅ Mức độ (text)
- ✅ Chủ đề (text)
- ✅ Ngày tạo (date)

### Class Quality - Comment Violations
- ✅ Lớp học (text)
- ✅ Giáo viên (text)
- ✅ Buổi học (number)
- ✅ Ngày (date)
- ✅ Nhận xét (text)
- ✅ Lý do vi phạm (text)

### Class Quality - Attendance Violations
- ✅ Lớp học (text)
- ✅ Học viên (text)
- ✅ Số buổi vắng (number)
- ✅ Vắng liên tiếp (boolean)
- ✅ Vắng cuối khoá (boolean)
- ❌ Lịch sử điểm danh (not sortable - visual)

### Admin Users
- ✅ Email (text)
- ✅ Tên (text)
- ✅ Username (text)
- ✅ Vai trò (text)
- ✅ Trạng thái (text)
- ✅ Ngày tạo (date)
- ❌ Actions (not sortable)

### Admin Permissions
- ✅ Tài khoản (text)
- ✅ Khu vực (text)
- ✅ Khối (text - count)
- ❌ Quyền (not sortable - multiple values)
- ❌ Actions (not sortable)

---

## Next Steps

1. Start with Phase 2 - Main Dashboard Tables
2. Implement sorting for Teacher Change main table first
3. Test and verify
4. Continue with remaining tables

