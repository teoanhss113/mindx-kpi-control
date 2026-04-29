# Admin Pages Design Consistency Bugfix Design

## Overview

The Roles admin page (`src/app/admin/roles/page.tsx`) has design inconsistencies compared to the Users and Regions admin pages. The page uses inline styles for modals instead of CSS module classes, doesn't use the `AdminTableSection` wrapper component, and has inconsistent form field styling. This fix will align the Roles page with the established design patterns used in Users and Regions pages, ensuring visual consistency across all admin pages and adherence to the design system standards defined in `DESIGN.md`.

**Impact:** Improved visual consistency, easier maintenance, compliance with design system standards.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug - when the Roles page renders UI elements using inline styles or inconsistent patterns instead of CSS module classes and reusable components
- **Property (P)**: The desired behavior - all admin pages should use consistent CSS module classes, reusable components, and follow the same visual structure
- **Preservation**: Existing functionality (form submission, data loading, filtering, deletion) that must remain unchanged by the fix
- **AdminTableSection**: The reusable wrapper component in `src/components/ui/index.tsx` that provides consistent table layout with title, count, loading state, and expand/collapse functionality
- **CSS Module Classes**: Styles defined in `src/app/dashboard.module.css` that should be used instead of inline styles (e.g., `styles.modalOverlay`, `styles.modalContent`, `styles.dateInput`)
- **Modal Pattern**: The standardized modal structure using `modalOverlay`, `modalContent`, `modalHeader`, `modalTitle`, `modalSubtitle`, `closeModalBtn`, and `modalBody` classes

## Bug Details

### Bug Condition

The bug manifests when the Roles page renders its modal and table components. The page is using inline styles (direct `style` props with hardcoded values) instead of CSS module classes, not wrapping the table in the `AdminTableSection` component, and using inconsistent form field styling compared to Users/Regions pages.

**Formal Specification:**
```
FUNCTION isBugCondition(element)
  INPUT: element of type ReactElement (modal, table, or form field)
  OUTPUT: boolean
  
  RETURN (element.type == 'modal' AND element.uses_inline_styles == true)
         OR (element.type == 'table' AND element.wrapper != 'AdminTableSection')
         OR (element.type == 'form_field' AND element.label_style != STANDARD_LABEL_STYLE)
         OR (element.type == 'button' AND element.class != 'styles.closeModalBtn')
         OR (element.type == 'textarea' AND element.style.minHeight != undefined)
END FUNCTION
```

### Examples

- **Modal overlay**: Currently uses `backgroundColor: 'rgba(0, 0, 0, 0.5)'` inline → Should use `className={styles.modalOverlay}`
- **Modal content**: Currently uses inline `backgroundColor`, `borderRadius`, `padding` → Should use `className={styles.modalContent}`
- **Form labels**: Currently uses inline `fontSize: 14, fontWeight: 510` → Should use `fontSize: 13, fontWeight: 510, color: 'var(--text-primary)', marginBottom: 'var(--space-2)'` to match Users/Regions
- **Close button**: Currently uses inline button styles → Should use `className={styles.closeModalBtn}` with standard SVG structure
- **Table wrapper**: Currently uses plain `<div>` → Should use `<AdminTableSection>` component
- **Textarea**: Currently uses inline `minHeight: '80px', resize: 'vertical'` → Should use `className={styles.dateInput}` with `resize: 'vertical', fontFamily: 'inherit'`

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Form submission logic must continue to validate and save role data correctly
- Data loading must continue to fetch roles and pages from the API correctly
- Search and sort operations must continue to filter and order data correctly
- Delete confirmation and deletion must continue to work correctly
- MultiSelect component for page permissions must continue to handle selection state correctly
- All existing event handlers and state management must remain functional

**Scope:**
All inputs that do NOT involve visual styling and component structure should be completely unaffected by this fix. This includes:
- API calls and data fetching logic
- Form validation logic
- State management (useState, useEffect hooks)
- Event handlers (onClick, onChange, onSubmit)
- Business logic (permission calculations, data transformations)

## Hypothesized Root Cause

Based on the bug description and code analysis, the most likely issues are:

1. **Inconsistent Development Timeline**: The Roles page may have been developed before the design system was fully established, or by a different developer who wasn't aware of the standardized patterns used in Users/Regions pages.

2. **Missing Component Awareness**: The developer may not have been aware of the `AdminTableSection` component or the standardized CSS module classes available in `dashboard.module.css`.

3. **Copy-Paste from Different Source**: The modal structure may have been copied from an older implementation or external source that didn't follow the project's design system.

4. **Lack of Design System Documentation**: At the time of development, the design system standards may not have been clearly documented, leading to ad-hoc inline styling decisions.

## Correctness Properties

Property 1: Bug Condition - CSS Module Classes Usage

_For any_ UI element in the Roles page where inline styles are currently used (modal overlay, modal content, modal header, form labels, buttons, inputs), the fixed implementation SHALL use CSS module classes from `dashboard.module.css` (`styles.modalOverlay`, `styles.modalContent`, `styles.modalHeader`, `styles.modalTitle`, `styles.modalSubtitle`, `styles.closeModalBtn`, `styles.dateInput`) instead of inline style objects.

**Validates: Requirements 2.1, 2.2, 2.4, 2.5, 2.6**

Property 2: Preservation - Functional Behavior

_For any_ user interaction that does NOT involve visual styling (form submission, data loading, filtering, sorting, deletion, permission selection), the fixed Roles page SHALL produce exactly the same behavior as the original implementation, preserving all existing functionality for data operations and business logic.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `src/app/admin/roles/page.tsx`

**Specific Changes**:

1. **Import CSS Module Styles**:
   - Add import: `import styles from '@/app/dashboard.module.css';`
   - This provides access to all standardized CSS classes

2. **Replace Modal Inline Styles with CSS Classes**:
   - Modal overlay: Replace inline `style` object with `className={styles.modalOverlay}`
   - Modal content: Replace inline `style` object with `className={styles.modalContent}`
   - Modal header: Replace inline `style` object with `className={styles.modalHeader}`
   - Modal title: Replace inline `style` with `className={styles.modalTitle}`
   - Add modal subtitle: Insert `<p className={styles.modalSubtitle}>` after title for consistency
   - Close button: Replace inline button styles with `className={styles.closeModalBtn}` and use standard SVG structure from Users/Regions pages

3. **Wrap Table in AdminTableSection Component**:
   - Import `AdminTableSection` from `@/components/ui`
   - Add state: `const [showTable, setShowTable] = useState(true);`
   - Replace plain `<div>` wrapper with:
     ```tsx
     <AdminTableSection
       title="Danh sách vai trò"
       count={filteredRoles.length}
       loading={loading}
       isExpanded={showTable}
       onToggle={() => setShowTable(!showTable)}
     >
       {/* existing table content */}
     </AdminTableSection>
     ```

4. **Standardize Form Field Labels**:
   - Update all label styles to match Users/Regions pattern:
     - `fontSize: 13` (not 14)
     - `fontWeight: 510`
     - `color: 'var(--text-primary)'`
     - `marginBottom: 'var(--space-2)'`

5. **Standardize Input and Textarea Styling**:
   - Replace inline input styles with `className={styles.dateInput}` and `style={{ width: '100%' }}`
   - Replace textarea inline styles with `className={styles.dateInput}` and `style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit' }}`
   - Remove inline `minHeight` from textarea (let CSS handle it)

6. **Add Modal Subtitle**:
   - Insert subtitle after modal title: `<p className={styles.modalSubtitle}>{editingRole ? 'Cập nhật thông tin vai trò' : 'Tạo vai trò và phân quyền trang'}</p>`

7. **Update Close Button SVG**:
   - Replace current SVG with standard structure from Users/Regions:
     ```tsx
     <svg width="var(--space-4)" height="var(--space-4)" viewBox="0 0 16 16" fill="none">
       <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
     </svg>
     ```

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code (visual inconsistencies), then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Manually inspect the Roles page and compare it side-by-side with Users and Regions pages. Document visual differences and styling inconsistencies. Run these observations on the UNFIXED code to confirm the bug exists.

**Test Cases**:
1. **Modal Overlay Test**: Open Roles modal and inspect element → Observe inline `backgroundColor` instead of CSS class (will fail on unfixed code)
2. **Modal Content Test**: Inspect modal content element → Observe inline `borderRadius`, `padding` instead of CSS class (will fail on unfixed code)
3. **Form Label Test**: Inspect form labels → Observe `fontSize: 14` instead of `fontSize: 13` (will fail on unfixed code)
4. **Table Wrapper Test**: Inspect table container → Observe plain `<div>` instead of `AdminTableSection` component (will fail on unfixed code)
5. **Close Button Test**: Inspect close button → Observe inline styles instead of `styles.closeModalBtn` class (will fail on unfixed code)

**Expected Counterexamples**:
- Modal elements use inline styles instead of CSS module classes
- Form labels have inconsistent font sizes (14px vs 13px)
- Table lacks the standardized wrapper component with title/count/toggle
- Close button lacks the standardized CSS class and SVG structure
- Possible causes: inconsistent development timeline, missing component awareness, lack of design system documentation

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds (UI elements with inline styles or inconsistent patterns), the fixed implementation produces the expected behavior (uses CSS module classes and reusable components).

**Pseudocode:**
```
FOR ALL element WHERE isBugCondition(element) DO
  result := renderElement_fixed(element)
  ASSERT usesStandardPattern(result)
  ASSERT matchesUsersRegionsPattern(result)
END FOR
```

**Test Plan**: After implementing the fix, manually inspect each changed element and verify it uses CSS module classes and matches the Users/Regions pattern.

**Test Cases**:
1. **Modal Styling Test**: Open Roles modal → Verify uses `styles.modalOverlay`, `styles.modalContent`, `styles.modalHeader`
2. **Form Labels Test**: Inspect all form labels → Verify `fontSize: 13`, `fontWeight: 510`, `color: 'var(--text-primary)'`
3. **Table Wrapper Test**: Verify table is wrapped in `AdminTableSection` with title, count, loading, expand/collapse
4. **Input Styling Test**: Verify all inputs use `className={styles.dateInput}` with `width: '100%'`
5. **Close Button Test**: Verify close button uses `className={styles.closeModalBtn}` with standard SVG

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold (functional behavior, business logic), the fixed implementation produces the same result as the original implementation.

**Pseudocode:**
```
FOR ALL interaction WHERE NOT isBugCondition(interaction) DO
  ASSERT handleInteraction_original(interaction) = handleInteraction_fixed(interaction)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-visual interactions

**Test Plan**: Observe behavior on UNFIXED code first for all functional interactions, then write tests capturing that behavior and verify it continues after fix.

**Test Cases**:
1. **Form Submission Preservation**: Submit create/edit forms with various inputs → Verify data is saved correctly (same API calls, same validation)
2. **Data Loading Preservation**: Load roles and pages data → Verify API calls and data transformations are unchanged
3. **Search Preservation**: Enter search terms → Verify filtering logic produces same results
4. **Sort Preservation**: Click sort headers → Verify sorting logic produces same order
5. **Delete Preservation**: Delete a role → Verify confirmation and deletion work correctly
6. **MultiSelect Preservation**: Select/deselect pages → Verify selection state is managed correctly

### Unit Tests

- Test that modal renders with correct CSS classes (not inline styles)
- Test that AdminTableSection wrapper is present with correct props
- Test that form labels have consistent styling (fontSize: 13, fontWeight: 510)
- Test that inputs and textareas use CSS module classes
- Test that close button uses standard CSS class and SVG structure

### Property-Based Tests

- Generate random role data and verify form submission works correctly across many scenarios
- Generate random search terms and verify filtering produces consistent results
- Generate random sort operations and verify table ordering is preserved
- Test that all non-visual interactions continue to work across many input combinations

### Integration Tests

- Test full create role flow: open modal → fill form → submit → verify data saved
- Test full edit role flow: click edit → modify data → submit → verify data updated
- Test full delete role flow: click delete → confirm → verify role removed
- Test search and filter flow: enter search → verify filtered results → clear search → verify all results shown
- Test that visual changes don't break any existing workflows
