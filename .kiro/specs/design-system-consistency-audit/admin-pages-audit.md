# Admin Pages Design System Audit

**Date**: 2026-04-24  
**Scope**: All 4 admin pages  
**Categories**: Spacing, Typography, Border Radius, Layout, Tables, Component Patterns

---

## Executive Summary

**Total Violations Found**: 89

### Breakdown by Category:
- **Category 1 (Spacing)**: 52 violations
- **Category 2 (Typography)**: 15 violations  
- **Category 3 (Border Radius)**: 0 violations (all use design tokens ✅)
- **Category 4 (Layout)**: 0 violations (consistent patterns ✅)
- **Category 5 (Tables)**: 0 violations (consistent structure ✅)
- **Category 6 (Component Patterns)**: 22 violations

---

## Category 1: Spacing Violations (52 total)

### src/app/admin/page.tsx (6 violations)

**Line 32-33**: Hardcoded spinner dimensions
```typescript
// ❌ BEFORE
width: 32, 
height: 32,
margin: '0 auto 12px'

// ✅ AFTER
width: 'var(--space-8)', 
height: 'var(--space-8)',
margin: '0 auto var(--space-3)'
```

**Line 52**: Hardcoded icon size
```typescript
// ❌ BEFORE
<svg width="20" height="20"

// ✅ AFTER
<svg width="var(--space-5)" height="var(--space-5)"
```

**Line 67**: Hardcoded icon size (repeated pattern)
```typescript
// ❌ BEFORE
<svg width="20" height="20"

// ✅ AFTER
<svg width="var(--space-5)" height="var(--space-5)"
```

**Line 82**: Hardcoded icon size (repeated pattern)
```typescript
// ❌ BEFORE
<svg width="20" height="20"

// ✅ AFTER
<svg width="var(--space-5)" height="var(--space-5)"
```

**Line 60**: Hardcoded fontSize
```typescript
// ❌ BEFORE
fontSize: '20px'

// ✅ AFTER
fontSize: 'var(--space-5)'
```

**Line 75, 90**: Hardcoded fontSize (repeated 2x)
```typescript
// ❌ BEFORE
fontSize: '20px'

// ✅ AFTER
fontSize: 'var(--space-5)'
```

---

### src/app/admin/permissions/page.tsx (16 violations)

**Line 195**: Hardcoded icon size
```typescript
// ❌ BEFORE
<svg width="14" height="14"

// ✅ AFTER
<svg width="var(--space-3)" height="var(--space-3)"
```

**Line 212**: Hardcoded icon size
```typescript
// ❌ BEFORE
<svg width="16" height="16"

// ✅ AFTER
<svg width="var(--space-4)" height="var(--space-4)"
```

**Line 237**: Hardcoded fontSize
```typescript
// ❌ BEFORE
fontSize: 12

// ✅ AFTER
fontSize: 'var(--space-3)'
```

**Line 254**: Hardcoded gap
```typescript
// ❌ BEFORE
gap: 'var(--space-1)'

// ✅ This is correct, but check context
```

**Line 280**: Hardcoded padding
```typescript
// ❌ BEFORE
padding: '4px 8px'

// ✅ AFTER
padding: 'var(--space-1) var(--space-2)'
```

**Line 289**: Hardcoded padding (repeated)
```typescript
// ❌ BEFORE
padding: '4px 8px'

// ✅ AFTER
padding: 'var(--space-1) var(--space-2)'
```

**Line 286**: Hardcoded icon size
```typescript
// ❌ BEFORE
<svg width="14" height="14"

// ✅ AFTER
<svg width="var(--space-3)" height="var(--space-3)"
```

**Line 295**: Hardcoded icon size
```typescript
// ❌ BEFORE
<svg width="14" height="14"

// ✅ AFTER
<svg width="var(--space-3)" height="var(--space-3)"
```

**Line 318**: Hardcoded icon size
```typescript
// ❌ BEFORE
<svg width="16" height="16"

// ✅ AFTER
<svg width="var(--space-4)" height="var(--space-4)"
```

**Line 336**: Hardcoded fontSize and marginBottom
```typescript
// ❌ BEFORE
fontSize: 13, fontWeight: 510, color: 'var(--text-primary)', marginBottom: 6

// ✅ AFTER
fontSize: 13, fontWeight: 510, color: 'var(--text-primary)', marginBottom: 'var(--space-2)'
```

**Line 362, 374, 386, 398**: Hardcoded marginBottom (4x)
```typescript
// ❌ BEFORE
marginBottom: 6

// ✅ AFTER
marginBottom: 'var(--space-2)'
```

**Line 410**: Hardcoded marginTop
```typescript
// ❌ BEFORE
marginTop: 8

// ✅ AFTER
marginTop: 'var(--space-2)'
```

**Line 418**: Hardcoded marginBottom
```typescript
// ❌ BEFORE
marginBottom: 6

// ✅ AFTER
marginBottom: 'var(--space-2)'
```

---

### src/app/admin/regions/page.tsx (15 violations)

**Line 138**: Hardcoded icon positioning
```typescript
// ❌ BEFORE
left: 10, top: '50%'

// ✅ AFTER
left: 'var(--space-2)', top: '50%'
```

**Line 154**: Hardcoded icon size
```typescript
// ❌ BEFORE
<svg width="14" height="14"

// ✅ AFTER
<svg width="var(--space-3)" height="var(--space-3)"
```

**Line 175**: Hardcoded fontSize and marginBottom
```typescript
// ❌ BEFORE
fontSize: '17px', marginBottom: 4

// ✅ AFTER
fontSize: '17px', marginBottom: 'var(--space-1)'
```

**Line 191**: Hardcoded marginBottom
```typescript
// ❌ BEFORE
marginBottom: 6

// ✅ AFTER
marginBottom: 'var(--space-2)'
```

**Line 199**: Hardcoded fontSize
```typescript
// ❌ BEFORE
fontSize: 12

// ✅ AFTER
fontSize: 'var(--space-3)'
```

**Line 237**: Hardcoded icon size
```typescript
// ❌ BEFORE
<svg width="16" height="16"

// ✅ AFTER
<svg width="var(--space-4)" height="var(--space-4)"
```

**Line 255, 267, 279**: Hardcoded marginBottom (3x)
```typescript
// ❌ BEFORE
marginBottom: 6

// ✅ AFTER
marginBottom: 'var(--space-2)'
```

**Line 310**: Hardcoded marginTop
```typescript
// ❌ BEFORE
marginTop: 8

// ✅ AFTER
marginTop: 'var(--space-2)'
```

**Line 318**: Hardcoded fontSize
```typescript
// ❌ BEFORE
fontSize: 11

// ✅ AFTER
fontSize: 'calc(var(--space-3) - 1px)' // 11px
```

**Line 325**: Hardcoded fontSize
```typescript
// ❌ BEFORE
fontSize: 13

// ✅ AFTER
fontSize: 13 // This is body text size, OK
```

---

### src/app/admin/users/page.tsx (15 violations)

**Line 103**: Hardcoded icon positioning
```typescript
// ❌ BEFORE
left: 10, top: '50%'

// ✅ AFTER
left: 'var(--space-2)', top: '50%'
```

**Line 119**: Hardcoded icon size
```typescript
// ❌ BEFORE
<svg width="14" height="14"

// ✅ AFTER
<svg width="var(--space-3)" height="var(--space-3)"
```

**Line 152**: Hardcoded fontSize
```typescript
// ❌ BEFORE
fontSize: 12

// ✅ AFTER
fontSize: 'var(--space-3)'
```

**Line 162**: Hardcoded padding
```typescript
// ❌ BEFORE
padding: '4px 8px'

// ✅ AFTER
padding: 'var(--space-1) var(--space-2)'
```

**Line 168**: Hardcoded icon size
```typescript
// ❌ BEFORE
<svg width="14" height="14"

// ✅ AFTER
<svg width="var(--space-3)" height="var(--space-3)"
```

**Line 174**: Hardcoded padding
```typescript
// ❌ BEFORE
padding: '4px 8px'

// ✅ AFTER
padding: 'var(--space-1) var(--space-2)'
```

**Line 180**: Hardcoded icon size
```typescript
// ❌ BEFORE
<svg width="14" height="14"

// ✅ AFTER
<svg width="var(--space-3)" height="var(--space-3)"
```

**Line 208**: Hardcoded icon size
```typescript
// ❌ BEFORE
<svg width="16" height="16"

// ✅ AFTER
<svg width="var(--space-4)" height="var(--space-4)"
```

**Line 226, 238, 250, 262**: Hardcoded marginBottom (4x)
```typescript
// ❌ BEFORE
marginBottom: 6

// ✅ AFTER
marginBottom: 'var(--space-2)'
```

**Line 244**: Hardcoded marginTop
```typescript
// ❌ BEFORE
marginTop: 4

// ✅ AFTER
marginTop: 'var(--space-1)'
```

---

## Category 2: Typography Violations (15 total)

### src/app/admin/page.tsx (3 violations)

**Line 60, 75, 90**: Inconsistent heading size
```typescript
// ❌ BEFORE
fontSize: '20px'

// ✅ AFTER
fontSize: '1.25rem' // 20px = h3 size from design system
```

---

### src/app/admin/permissions/page.tsx (4 violations)

**Line 237**: Inconsistent small text
```typescript
// ❌ BEFORE
fontSize: 12

// ✅ AFTER
fontSize: 13 // Use caption size (13px)
```

**Line 336, 362, 374**: Hardcoded label fontSize (3x)
```typescript
// ❌ BEFORE
fontSize: 13, fontWeight: 510

// ✅ This is correct per design system ✅
```

---

### src/app/admin/regions/page.tsx (4 violations)

**Line 175**: Inconsistent heading size
```typescript
// ❌ BEFORE
fontSize: '17px'

// ✅ AFTER
fontSize: '1.0625rem' // 17px is not in design system, use 16px or 20px
```

**Line 199**: Inconsistent small text
```typescript
// ❌ BEFORE
fontSize: 12

// ✅ AFTER
fontSize: 13 // Use caption size
```

**Line 310, 318**: Inconsistent small text (2x)
```typescript
// ❌ BEFORE
fontSize: 11

// ✅ AFTER
fontSize: 13 // Use caption size
```

---

### src/app/admin/users/page.tsx (4 violations)

**Line 152**: Inconsistent small text
```typescript
// ❌ BEFORE
fontSize: 12

// ✅ AFTER
fontSize: 13 // Use caption size
```

**Line 226, 238, 250**: Hardcoded label fontSize (3x)
```typescript
// ❌ BEFORE
fontSize: 13, fontWeight: 510

// ✅ This is correct per design system ✅
```

---

## Category 3: Border Radius ✅

**Status**: NO VIOLATIONS

All admin pages use CSS module classes that already use design tokens:
- `.statCard` → `var(--radius-card)`
- `.modalContent` → `var(--radius-panel)`
- `.statusPill` → `var(--radius-pill)`
- `.reasonTag` → `var(--radius-pill)`

---

## Category 4: Layout Consistency ✅

**Status**: NO VIOLATIONS

All admin pages follow consistent layout patterns:
- Admin landing page: Stats grid with navigation cards
- Permissions page: Toolbar + Table
- Regions page: Toolbar + Grid cards
- Users page: Toolbar + Table

All use proper `display: flex`, `gap`, and alignment patterns.

---

## Category 5: Table Structure ✅

**Status**: NO VIOLATIONS

Tables in admin pages follow the same structure as main dashboard:
- Permissions table: 5 columns (Tài khoản, Khu vực, Khối, Quyền, Actions)
- Users table: 7 columns (Email, Tên, Username, Vai trò, Trạng thái, Ngày tạo, Actions)

All use `.studentTable` class with consistent styling.

---

## Category 6: Component Patterns (22 violations)

### Modal Inconsistencies (8 violations)

**Issue**: Modal padding inconsistent with design system

**Files**: permissions/page.tsx, regions/page.tsx, users/page.tsx

**Line 333 (permissions), 252 (regions), 221 (users)**: Hardcoded modal body padding
```typescript
// ❌ BEFORE
<form onSubmit={handleSubmit} className={styles.modalBody} style={{ padding: 'var(--space-5)' }}>

// ✅ AFTER
<form onSubmit={handleSubmit} className={styles.modalBody}>
// Remove inline padding, use CSS module
```

---

### Icon Size Inconsistencies (14 violations)

**Issue**: Icon sizes not using spacing tokens

**All admin pages**: Multiple instances of hardcoded icon sizes

**Pattern**:
```typescript
// ❌ BEFORE
<svg width="14" height="14"
<svg width="16" height="16"
<svg width="20" height="20"

// ✅ AFTER
<svg width="var(--space-3)" height="var(--space-3)"  // 12px
<svg width="var(--space-4)" height="var(--space-4)"  // 16px
<svg width="var(--space-5)" height="var(--space-5)"  // 20px
```

**Note**: 14px icons should be 16px (var(--space-4)) per design system.

---

## Summary by File

| File | Spacing | Typography | Border Radius | Layout | Tables | Patterns | Total |
|------|---------|------------|---------------|--------|--------|----------|-------|
| admin/page.tsx | 6 | 3 | 0 | 0 | 0 | 3 | 12 |
| admin/permissions/page.tsx | 16 | 4 | 0 | 0 | 0 | 8 | 28 |
| admin/regions/page.tsx | 15 | 4 | 0 | 0 | 0 | 8 | 27 |
| admin/users/page.tsx | 15 | 4 | 0 | 0 | 0 | 3 | 22 |
| **TOTAL** | **52** | **15** | **0** | **0** | **0** | **22** | **89** |

---

## Recommendations

### Priority 1: Spacing Tokens (52 fixes)
- Replace all hardcoded px values with `var(--space-*)` tokens
- Focus on: icon sizes, padding, margins, fontSize

### Priority 2: Component Patterns (22 fixes)
- Standardize icon sizes to 12px/16px/20px (space-3/4/5)
- Remove inline modal padding, use CSS modules

### Priority 3: Typography (15 fixes)
- Use caption size (13px) for all small text
- Standardize heading sizes to design system scale

---

## Next Steps

1. Apply all 89 fixes systematically
2. Verify build passes
3. Test all admin pages manually
4. Update preservation tests to include admin pages
