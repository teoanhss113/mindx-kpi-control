# Design System Consistency Audit - Design Document

## Overview

This design document provides a systematic approach to fixing all design system inconsistencies across the MindX KPI Dashboard. The approach is comprehensive, covering 6 major categories beyond the already-fixed color system.

**Status:** Colors are 100% consistent ✅ - This plan addresses everything else.

---

## Problem Statement

The user has lost trust after multiple claims of "design system consistency complete" that only addressed colors. The actual scope is much broader:

1. **Spacing violations** - Hardcoded px values not using var(--space-*) or 8px grid
2. **Typography violations** - Incorrect weights, missing letter-spacing, wrong case
3. **Border violations** - Inconsistent radius usage
4. **Layout violations** - Inconsistent alignment, positioning, component order
5. **Table violations** - Inconsistent column structure, labels, meanings across pages
6. **Component pattern violations** - Cards, Panels, Toolbars, Modals, Filters, Forms not following same patterns

---

## Design Principles

### 1. Systematic Approach
- Audit one category at a time
- Document all violations before fixing
- Verify each category completely before moving to next
- No partial "complete" claims

### 2. Verification First
- Create automated checks where possible
- Manual verification for visual consistency
- Build passes without errors
- All pages render correctly

### 3. Regression Prevention
- DO NOT touch color-related code (already fixed)
- Maintain all existing functionality
- Preserve responsive behavior
- Keep performance characteristics

---

## Category 1: Spacing Violations

### Severity: HIGH
**Impact:** Visual inconsistency, breaks 8px grid system, makes maintenance difficult

### Audit Strategy

**Step 1: Identify all hardcoded spacing values**
```bash
# Search for hardcoded px values in CSS
grep -n "padding:\|margin:\|gap:" src/app/dashboard.module.css | grep -v "var(--space"
grep -n "padding:\|margin:\|gap:" src/app/globals.css | grep -v "var(--space"
```

**Step 2: Categorize violations**
- Padding violations (buttons, cards, inputs)
- Margin violations (spacing between elements)
- Gap violations (flex/grid layouts)
- Position offsets (top, bottom, left, right)

### Violations Found (from bugfix.md)

#### High Priority (Most Visible)
1. `.toolbar { padding: 10px var(--space-4); }` → should be `var(--space-3) var(--space-4)`
2. `.primaryBtn { padding: 6px var(--space-3); }` → should be `var(--space-2) var(--space-3)`
3. `.clearCacheBtn { padding: 6px var(--space-3); }` → should be `var(--space-2) var(--space-3)`
4. `.chartToggle { padding: 3px 10px; }` → should be `var(--space-1) var(--space-3)`
5. `.filterChip { padding: 6px var(--space-3); }` → should be `var(--space-2) var(--space-3)`
6. `.multiDropdownTrigger { padding: 6px var(--space-2); }` → should be `var(--space-2)`
7. `.dateInput { padding: 5px var(--space-2); }` → should be `var(--space-1) var(--space-2)` or `var(--space-2)`
8. `.filterInput { padding: 6px var(--space-2) 6px 30px; }` → should be `var(--space-2) var(--space-2) var(--space-2) 30px`
9. `.toast { padding: 10px var(--space-4); }` → should be `var(--space-3) var(--space-4)`

#### Medium Priority (Less Visible)
10. `.classItemHeader { padding: 7px var(--space-4); }` → 7px is optical adjustment, keep as-is OR use `var(--space-2)`
11. `.reasonCheckbox { margin-top: 2px; }` → should be `var(--space-1)` (4px) or remove
12. `.reasonsPreview { padding-top: 2px; }` → should be `var(--space-1)` (4px) or remove
13. `.modalTitle { margin: 0 0 2px; }` → should be `0 0 var(--space-1)`
14. `.reasonLabel { gap: 6px; }` → should be `var(--space-2)` (8px) - close enough
15. `.tooltipBox { bottom: calc(100% + 8px); }` → should be `calc(100% + var(--space-2))`
16. `.rangeSliderWrap { gap: 5px; }` → should be `var(--space-1)` (4px) or `var(--space-2)` (8px)
17. `.rangeThumbBubble { bottom: calc(100% + 5px); }` → should be `calc(100% + var(--space-1))`

#### Low Priority (Micro-adjustments)
18. `.reasonTag { padding: 2px 6px; }` → should be `var(--space-1) var(--space-2)` (4px 8px)
19. `.statusPill { padding: 2px 8px; }` → should be `var(--space-1) var(--space-2)` (4px 8px)
20. `.suggestPill { padding: 2px var(--space-2); }` → should be `var(--space-1) var(--space-2)`
21. `.groupBadge { padding: 1px 7px; }` → should be `var(--space-1) var(--space-2)` (4px 8px)

### Fix Plan

**Phase 1: High Priority Buttons & Inputs (9 fixes)**
- File: `src/app/dashboard.module.css`
- Lines: Multiple (toolbar, buttons, inputs sections)
- Changes: Replace hardcoded padding with spacing tokens
- Verification: Visual check all buttons/inputs, ensure no layout shift

**Phase 2: Medium Priority Layout Spacing (8 fixes)**
- File: `src/app/dashboard.module.css`
- Lines: Multiple (table, modal, tooltip sections)
- Changes: Replace hardcoded spacing with tokens
- Verification: Check table headers, modals, tooltips render correctly

**Phase 3: Low Priority Micro-adjustments (4 fixes)**
- File: `src/app/dashboard.module.css`
- Lines: Badge/pill sections
- Changes: Replace hardcoded padding with tokens
- Verification: Check all badges/pills render correctly

### Verification Criteria
- [ ] All spacing uses var(--space-*) tokens or is justified optical adjustment
- [ ] No hardcoded px values in padding/margin/gap (except optical adjustments)
- [ ] All buttons have consistent padding
- [ ] All inputs have consistent padding
- [ ] All badges/pills have consistent padding
- [ ] Build passes: `npm run build`
- [ ] Visual check: All pages render correctly
- [ ] No layout shifts or broken spacing

---

## Category 2: Typography Violations

### Severity: MEDIUM
**Impact:** Inconsistent text hierarchy, readability issues

### Audit Strategy

**Step 1: Verify font weights in CSS**
```bash
# Search for font-weight declarations
grep -n "font-weight:" src/app/dashboard.module.css
grep -n "font-weight:" src/app/globals.css
```

**Step 2: Verify letter-spacing in CSS**
```bash
# Search for letter-spacing declarations
grep -n "letter-spacing:" src/app/dashboard.module.css
grep -n "letter-spacing:" src/app/globals.css
```

**Step 3: Check inline styles in components**
```bash
# Search for inline font-weight in TSX files
grep -rn "fontWeight:" src/app/*.tsx src/components/
grep -rn "font-weight:" src/app/*.tsx src/components/
```

### Current Status (from bugfix.md)

**CSS appears correct:**
- Font weights: 400, 510, 590 ✅
- Letter-spacing: Correct negative values at display sizes ✅
- Text-transform: Correct uppercase for micro labels ✅

**Need to verify:**
- Inline styles in component files
- Dynamic style objects
- Framer Motion style props

### Fix Plan

**Phase 1: Component File Audit**
- Files: All page.tsx files, src/components/ui/index.tsx
- Search for: inline fontWeight, font-weight, letterSpacing, letter-spacing
- Verify: All use correct weights (400/510/590)
- Fix: Any incorrect weights or missing letter-spacing

**Phase 2: Framer Motion Styles**
- Files: All files using motion components
- Check: style props on motion.div, motion.span, etc.
- Verify: Typography properties match design system
- Fix: Any inconsistencies

### Verification Criteria
- [ ] All font weights are 400, 510, or 590
- [ ] Display sizes (≥20px) have negative letter-spacing
- [ ] Micro labels (11px) use uppercase + letter-spacing: 0.04em
- [ ] No inline styles override CSS typography
- [ ] Build passes: `npm run build`
- [ ] Visual check: Text hierarchy is consistent

---

## Category 3: Border Radius Violations

### Severity: LOW
**Impact:** Minor visual inconsistency

### Audit Strategy

**Step 1: Verify CSS border-radius**
```bash
# Search for border-radius declarations
grep -n "border-radius:" src/app/dashboard.module.css
grep -n "border-radius:" src/app/globals.css
```

**Step 2: Check inline styles**
```bash
# Search for inline borderRadius in TSX files
grep -rn "borderRadius:" src/app/*.tsx src/components/
grep -rn "border-radius:" src/app/*.tsx src/components/
```

**Step 3: Check chart bar radius**
```bash
# Search for Bar radius prop
grep -rn "radius={\[" src/app/*.tsx
```

### Current Status (from bugfix.md)

**CSS appears correct:**
- All border-radius values use var(--radius-*) tokens ✅
- Correct scale: 2px/4px/6px/8px/12px/9999px ✅

**Need to verify:**
- Inline styles in components
- Chart bar radius consistency
- Dynamic radius values

### Fix Plan

**Phase 1: Inline Style Audit**
- Files: All page.tsx files, src/components/ui/index.tsx
- Search for: inline borderRadius, border-radius
- Verify: All use correct radius scale
- Fix: Any hardcoded radius values

**Phase 2: Chart Radius Consistency**
- Files: All page.tsx files with charts
- Check: Bar radius prop values
- Verify: Horizontal bars use [0, 4, 4, 0], vertical bars use [4, 4, 0, 0]
- Fix: Any inconsistencies

### Verification Criteria
- [ ] All border-radius uses var(--radius-*) tokens
- [ ] Chart bars use consistent radius patterns
- [ ] No hardcoded radius values in inline styles
- [ ] Build passes: `npm run build`
- [ ] Visual check: All corners are consistently rounded

---

## Category 4: Layout Violations

### Severity: MEDIUM
**Impact:** Inconsistent user experience across pages

### Audit Strategy

**Step 1: Document page structure**
- Map out component order on each page
- Identify common patterns
- Note deviations

**Step 2: Check alignment patterns**
```bash
# Search for align-items declarations
grep -n "align-items:" src/app/dashboard.module.css
```

**Step 3: Check positioning patterns**
```bash
# Search for position declarations
grep -n "position:" src/app/dashboard.module.css
```

### Current Status

**Page Structure (Expected):**
1. Toolbar (date range, centre selection, fetch controls)
2. Stats Grid (3-4 stat cards)
3. Suggestions Bar (optional)
4. Charts Section (collapsible, 2-col grid)
5. Table Section (with filters, sorting)

**Need to verify:**
- All pages follow this structure
- Alignment is consistent (start vs center)
- No unnecessary absolute positioning

### Fix Plan

**Phase 1: Page Structure Audit**
- Files: All page.tsx files
- Document: Actual structure of each page
- Compare: Against expected structure
- Fix: Reorder components to match pattern

**Phase 2: Alignment Consistency**
- Files: src/app/dashboard.module.css
- Check: align-items usage
- Verify: Wrapping content uses start, single-line uses center
- Fix: Any inconsistencies

**Phase 3: Positioning Cleanup**
- Files: src/app/dashboard.module.css
- Check: position declarations
- Verify: Only fixed/sticky for sidebar/header, absolute for dropdowns
- Fix: Remove unnecessary absolute positioning

### Verification Criteria
- [ ] All pages follow consistent structure
- [ ] Alignment patterns are consistent
- [ ] No unnecessary absolute positioning
- [ ] Build passes: `npm run build`
- [ ] Visual check: Layout is consistent across pages

---

## Category 5: Table Structure Violations

### Severity: HIGH
**Impact:** Confusing user experience, inconsistent data presentation

### Audit Strategy

**Step 1: Document table columns per page**
- Main dashboard: columns and order
- Class Quality: columns and order
- Teacher Change: columns and order
- Teacher Schedule: columns and order
- Tickets: columns and order
- Office Hours: columns and order

**Step 2: Identify common columns**
- "Lớp học" (Class Name) - should be first everywhere
- "Cơ sở" (Centre) - should be consistent position
- "Giáo viên" (Teacher) - should be consistent position
- "Tiến độ" (Progress) - should be consistent position

**Step 3: Check header styles**
```bash
# Search for table header styles
grep -n "classItemHeader\|tableHeader\|th {" src/app/dashboard.module.css
```

### Fix Plan

**Phase 1: Column Standardization**
- Files: All page.tsx files
- Document: Current column structure per page
- Define: Standard column order for common columns
- Fix: Reorder columns to match standard

**Phase 2: Header Style Consistency**
- Files: src/app/dashboard.module.css
- Check: All table header styles
- Verify: Same font-size, weight, transform, letter-spacing
- Fix: Any inconsistencies

**Phase 3: Grid Template Consistency**
- Files: src/app/dashboard.module.css
- Check: grid-template-columns for all tables
- Verify: Consistent use of minmax(0, Xfr)
- Fix: Any inconsistencies

### Verification Criteria
- [ ] Common columns appear in same position across pages
- [ ] All table headers use same style
- [ ] All tables use minmax(0, Xfr) pattern
- [ ] Build passes: `npm run build`
- [ ] Visual check: Tables are consistent across pages

---

## Category 6: Component Pattern Violations

### Severity: MEDIUM
**Impact:** Inconsistent component appearance and behavior

### Audit Strategy

**Step 1: Card Pattern Audit**
```bash
# Search for card-related styles
grep -n "Card {" src/app/dashboard.module.css
```

**Step 2: Panel Pattern Audit**
```bash
# Search for panel/section styles
grep -n "Section {" src/app/dashboard.module.css
```

**Step 3: Toolbar Pattern Audit**
```bash
# Search for toolbar styles
grep -n "toolbar\|Toolbar" src/app/dashboard.module.css
```

### Violations Found

**Cards:**
- `.statCard { background: rgba(0, 0, 0, 0.02); }` ✅
- `.chartCard { background: rgba(0, 0, 0, 0.03); }` ❌ Should be 0.02
- `.filterPanel { background: rgba(0, 0, 0, 0.02); }` ✅

**Toolbars:**
- `.toolbar { padding: 10px var(--space-4); }` ❌ Should be var(--space-3) var(--space-4)

**Filters:**
- `.filterChip { padding: 6px var(--space-3); }` ❌ Should be var(--space-2) var(--space-3)
- `.multiDropdownTrigger { padding: 6px var(--space-2); }` ❌ Should be var(--space-2)

**Forms:**
- `.dateInput { padding: 5px var(--space-2); }` ❌ Should be var(--space-1) var(--space-2)
- `.filterInput { padding: 6px var(--space-2) 6px 30px; }` ❌ Should be var(--space-2)

### Fix Plan

**Phase 1: Card Background Consistency**
- File: src/app/dashboard.module.css
- Change: `.chartCard { background: rgba(0, 0, 0, 0.02); }` (was 0.03)
- Verify: All cards have same background opacity

**Phase 2: Toolbar Padding Consistency**
- File: src/app/dashboard.module.css
- Change: `.toolbar { padding: var(--space-3) var(--space-4); }` (was 10px)
- Verify: Toolbar padding matches other panels

**Phase 3: Filter Component Consistency**
- File: src/app/dashboard.module.css
- Changes: Update all filter component padding to use spacing tokens
- Verify: All filters have consistent padding

**Phase 4: Form Component Consistency**
- File: src/app/dashboard.module.css
- Changes: Update all form input padding to use spacing tokens
- Verify: All inputs have consistent padding

### Verification Criteria
- [ ] All cards use rgba(0, 0, 0, 0.02) background
- [ ] All toolbars use consistent padding
- [ ] All filters use consistent padding
- [ ] All forms use consistent padding
- [ ] Build passes: `npm run build`
- [ ] Visual check: Components look consistent

---

## Implementation Plan

### Phase 1: Critical Fixes (Week 1)
**Priority: HIGH - Most visible issues**

1. **Spacing - High Priority** (9 fixes)
   - Buttons: toolbar, primary, clear cache, chart toggle
   - Inputs: date, filter
   - Filters: chip, dropdown trigger
   - Toast: padding
   - Estimated time: 2 hours
   - Verification: Visual check all buttons/inputs

2. **Table Structure** (Column standardization)
   - Document current structure
   - Define standard column order
   - Reorder columns across pages
   - Estimated time: 4 hours
   - Verification: Check all tables

3. **Component Patterns - Cards** (1 fix)
   - Fix chartCard background opacity
   - Estimated time: 15 minutes
   - Verification: Visual check all cards

**Total Phase 1: ~6-7 hours**

### Phase 2: Important Fixes (Week 2)
**Priority: MEDIUM - Less visible but important**

4. **Spacing - Medium Priority** (8 fixes)
   - Table headers, modals, tooltips
   - Range slider, labels
   - Estimated time: 2 hours
   - Verification: Check tables, modals, tooltips

5. **Layout Consistency**
   - Page structure audit
   - Alignment consistency
   - Positioning cleanup
   - Estimated time: 3 hours
   - Verification: Check all pages

6. **Typography Verification**
   - Component file audit
   - Inline style check
   - Framer Motion styles
   - Estimated time: 2 hours
   - Verification: Check text hierarchy

**Total Phase 2: ~7 hours**

### Phase 3: Polish (Week 3)
**Priority: LOW - Micro-adjustments**

7. **Spacing - Low Priority** (4 fixes)
   - Badges, pills, micro-adjustments
   - Estimated time: 1 hour
   - Verification: Check all badges/pills

8. **Border Radius Verification**
   - Inline style audit
   - Chart radius consistency
   - Estimated time: 1 hour
   - Verification: Check all corners

9. **Component Patterns - Remaining**
   - Toolbar padding
   - Filter padding
   - Form padding
   - Estimated time: 1 hour
   - Verification: Check all components

**Total Phase 3: ~3 hours**

### Total Estimated Time: 16-17 hours

---

## Verification Strategy

### Automated Checks

**1. Build Check**
```bash
npm run build
```
- Must pass without errors
- No TypeScript errors
- No CSS errors

**2. Spacing Token Check**
```bash
# Check for hardcoded spacing (should return minimal results)
grep -rn "padding: [0-9]" src/app/dashboard.module.css | grep -v "var(--space"
grep -rn "margin: [0-9]" src/app/dashboard.module.css | grep -v "var(--space"
grep -rn "gap: [0-9]" src/app/dashboard.module.css | grep -v "var(--space"
```

**3. Font Weight Check**
```bash
# Check for incorrect font weights
grep -rn "font-weight: [0-9]" src/ | grep -v "400\|510\|590"
```

### Manual Checks

**1. Visual Consistency**
- [ ] All pages load without errors
- [ ] All buttons look consistent
- [ ] All inputs look consistent
- [ ] All cards look consistent
- [ ] All tables look consistent
- [ ] No layout shifts

**2. Responsive Behavior**
- [ ] Mobile: sidebar collapses, tables scroll
- [ ] Tablet: 2-column charts
- [ ] Desktop: full layout
- [ ] No horizontal scroll

**3. Functionality**
- [ ] All filters work
- [ ] All sorting works
- [ ] All modals open/close
- [ ] All charts render
- [ ] All animations play

**4. Regression Check**
- [ ] Colors still correct (no changes)
- [ ] Performance same (no slowdown)
- [ ] Accessibility preserved

---

## Success Criteria

### Definition of Done

**For each category:**
1. All violations documented
2. All fixes implemented
3. All verification checks pass
4. No regressions introduced
5. User confirms consistency

**Overall:**
- [ ] Category 1: Spacing - 100% consistent
- [ ] Category 2: Typography - 100% consistent
- [ ] Category 3: Border Radius - 100% consistent
- [ ] Category 4: Layout - 100% consistent
- [ ] Category 5: Tables - 100% consistent
- [ ] Category 6: Component Patterns - 100% consistent
- [ ] Build passes
- [ ] All pages render correctly
- [ ] No regressions
- [ ] User trust restored

---

## Risk Mitigation

### Potential Risks

**1. Breaking Layout**
- Risk: Spacing changes break layout
- Mitigation: Test each change visually before committing
- Rollback: Git revert if needed

**2. Regression in Colors**
- Risk: Accidentally changing color-related code
- Mitigation: DO NOT touch any color variables or hex values
- Verification: Visual check colors unchanged

**3. Performance Impact**
- Risk: CSS changes slow down rendering
- Mitigation: No new CSS, only value changes
- Verification: Performance profiling if needed

**4. Responsive Breakage**
- Risk: Changes break mobile/tablet layouts
- Mitigation: Test on multiple screen sizes
- Verification: Responsive check on all pages

### Rollback Plan

If any phase causes issues:
1. Git revert the specific commit
2. Document the issue
3. Adjust the fix approach
4. Re-implement with corrections
5. Re-verify

---

## Communication Plan

### Progress Updates

**After each phase:**
- Document what was fixed
- List verification results
- Note any issues found
- Estimate remaining work

**Format:**
```
Phase X Complete:
✅ Fixed: [list of fixes]
✅ Verified: [list of checks]
⚠️ Issues: [any problems found]
📊 Progress: X/6 categories complete
```

### Final Report

**After all phases:**
- Summary of all fixes
- Before/after comparisons
- Verification results
- Lessons learned
- Recommendations for maintenance

---

## Maintenance Guidelines

### Preventing Future Violations

**1. Pre-commit Checklist**
- No hardcoded spacing (use var(--space-*))
- No hardcoded colors (use var(--*))
- No incorrect font weights (400/510/590 only)
- No incorrect border radius (use var(--radius-*))

**2. Code Review Checklist**
- Spacing follows 8px grid
- Typography follows hierarchy
- Components follow patterns
- No regressions

**3. Documentation**
- Keep design-system.md updated
- Document any exceptions
- Explain optical adjustments

**4. Automated Linting**
- Consider CSS linting rules
- Consider custom ESLint rules
- Consider pre-commit hooks

---

## Conclusion

This design provides a systematic, comprehensive approach to fixing all design system inconsistencies. By following this plan:

1. **Systematic**: Each category is addressed completely
2. **Verifiable**: Clear criteria for each fix
3. **Safe**: Regression prevention built in
4. **Trustworthy**: No more partial "complete" claims

The user's trust will be restored through:
- Thorough documentation
- Systematic execution
- Complete verification
- Honest progress reporting

**Next Step:** Begin Phase 1 implementation with spacing high-priority fixes.
